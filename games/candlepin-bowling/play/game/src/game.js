// Candlepin Bowling: state and flow. Physics lives in sim.js, scoring in match.js, the rivals in ai.js, drawing in view.js,
// hud.js and menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn and puzzles), result, puzzles, howto/about/rules, demolimit.
// Play phases: aim (choosing, or a rival thinking) -> roll (physics) -> settle (the result is shown) -> back to aim.
import {
  LANE, PACES, MAX_CURVE, DT, clamp, createWorld, newBall, launch, step, standingCount, previewPath, layout as makeLayout, newRack,
} from './sim.js';
import { newMatch, recordBall, totals } from './match.js';
import { createPlanner, executePlan, gauss, PROFILES, BEST } from './ai.js';
import { PUZZLES } from './puzzles.js';
import { inRect, TEXT_SCALES, THINK_STEPS, layoutFor } from './layout.js';
import { makeCam } from './cam.js';
import { renderPlay, curveName } from './hud.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderPuzzles, hitScreen, flowMeta, pageCount, REF, ensureLayout, flowRects, lockupZone } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';
import { setAlley, ALLEY_IDS } from './art.js';
import { v3 } from './v3.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_FRAME_CAP = 3;
const WINDUP = 0.42;                // seconds from ROLL to the release (the bowler steps and swings)
const SUB = 4;                       // physics sub-steps per 1/60 s tick (DT = 1/240)
const H = LANE.headY;
const AIM_MAX = 0.56, START_MAX = 0.46;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const lay = () => layoutFor(meta.width, meta.height);
  const fx = rng.fork(), jr = rng.fork(), aiRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, guide: true, textIdx: 0, thinkIdx: 1, alley: 'harbor' },
    record: { wins: [0, 0, 0, 0, 0, 0], played: 0, best: 0, games: 0, strikes: 0, spares: 0, demoFrames: 0, thrown: 0, stars: {} },
    setup: { mode: 'ai', opp: 0, alley: 'harbor', wood: 'classic' }, setupMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0,
    mode: 'ai', cfg: { opp: 0, watchA: 3, watchB: 2, alley: 'harbor', wood: 'classic' }, w: null, m: null, pz: null, pzResult: null, labels: [{ name: 'You' }, { name: 'Rival' }],
    phase: 'aim', humanTurn: false, pending: null, shake: null, parts: [], toast: '', toastT: 0, pop: null, sweep: null,
    sel: { pace: 1, curve: 0 }, x0: 0, aimX: 0, guide: null, hint: null, hintGuide: null, hintBusy: false,
    think: null, explain: null, ff: 1, att: null, showCard: false, drag: null, loaded: false, before: 10, settleT: 0, kbOn: false, restoreMsg: '', restoreBusy: false, owned: false,
    lastRes: null, lastP: 0, pzDone: false,
  };
  let planner = null, hintPlanner = null, rumble = 0;

  // ---- persistence -----------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  const applySettings = () => {
    const st = state.settings;
    st.textIdx = clamp(st.textIdx | 0, 0, TEXT_SCALES.length - 1);
    st.thinkIdx = clamp(st.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!ALLEY_IDS.includes(st.alley)) st.alley = 'harbor';
    setAlley(st.alley);
    try { config.textScale = TEXT_SCALES[st.textIdx]; } catch { /* config may be frozen */ }
  };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    while (state.record.wins.length < PROFILES.length) state.record.wins.push(0);
    if (!state.record.stars) state.record.stars = {};
    applySettings();
    state.setup.alley = state.settings.alley;
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });
  applySettings();

  // ---- sound -----------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 220, to: 140, dur: 0.2, type: 'sawtooth', vol: 0.06 }),
    launch: () => tone({ freq: 140, to: 70, dur: 0.18, type: 'sawtooth', vol: 0.05 }),
    clack: (v) => {
      const q = Math.min(1, v / 7);
      tone({ freq: 1500 + fx.next() * 600, to: 700, dur: 0.06, type: 'square', vol: 0.02 + 0.07 * q });
      tone({ freq: 240 + fx.next() * 120, to: 140, dur: 0.12, type: 'triangle', vol: 0.05 + 0.1 * q });
    },
    knock: (v) => tone({ freq: 160 + fx.next() * 30, to: 90, dur: 0.1, type: 'triangle', vol: Math.min(0.14, 0.04 + v / 40) }),
    thud: () => tone({ freq: 90, to: 45, dur: 0.22, type: 'sine', vol: 0.12 }),
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.12 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- particles (world coordinates, presentation only) ---------------------------------------------
  const MAX_PARTS = 140;
  const burst = (parts, x, y, n, kind = 0, speed = 1.2) => {
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) parts.push({ kind, x, y, z: 0.05, vx: (fx.next() - 0.5) * speed * 2, vy: (fx.next() - 0.5) * speed * 2, vz: 0.4 + fx.next() * 1.2, t: 0, max: 0.4 + fx.next() * 0.5, size: 1 + fx.next() * 1.5 });
  };
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= 5 * dt; if (q.z < 0) { q.z = 0; q.vz *= -0.3; } }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };
  const handleEvents = (parts, ev, silent = false) => {
    for (const e of ev) {
      if (e.t === 'hit') {
        burst(parts, e.x, e.y, Math.min(8, 1 + Math.floor(e.v * 0.8)), e.v > 3 ? 1 : 0, 0.8 + e.v * 0.15);
        if (!silent) { sfx.clack(e.v); if (e.v > 6 && !state.shake) state.shake = { t: 0, dur: 0.25, a: Math.min(5, 1.5 + e.v * 0.3) }; }
      } else if (e.t === 'wall') { if (!silent) sfx.knock(e.v); }
      else if (e.t === 'gutter' && !silent) sfx.knock(4);
      else if (e.t === 'pit' && !silent) sfx.thud();
    }
    ev.length = 0;
  };

  // ---- the attract lane behind the menus ----------------------------------------------------------
  const startAttract = () => { state.att = { w: createWorld(), parts: [], t: 0, wait: 1.6, n: 0 }; };
  const updateAttract = (dt) => {
    const a = state.att;
    a.t += dt;
    if (a.w.settled) {
      a.wait -= dt;
      if (a.wait <= 0) {
        if (a.n >= 2 || standingCount(a.w) === 0) { a.w = createWorld(); a.wait = 1.2; a.n = 0; return; }
        const aim = (fx.next() - 0.5) * 0.2 + (a.n === 0 ? 0.03 : -0.14);
        launch(a.w, newBall((fx.next() - 0.5) * 0.3, aim, 1, a.n === 0 ? 0 : 1)); a.n++; a.wait = 3.2;
      }
    } else {
      for (let i = 0; i < SUB; i++) step(a.w, DT);
      handleEvents(a.parts, a.w.ev, true);
    }
    stepParts(a.parts, dt);
  };

  // ---- match flow --------------------------------------------------------------------------------
  const isAI = (side) => (state.mode === 'watch' ? true : state.mode === 'ai' ? side === 1 : false);
  const profFor = (side) => (state.mode === 'watch' ? PROFILES[side === 0 ? state.cfg.watchA : state.cfg.watchB] : PROFILES[state.cfg.opp]);
  const ballsLeft = () => (state.pz ? state.pz.left : 3 - state.m.ball);

  function refreshGuide() {
    state.guide = state.settings.guide ? previewPath(state.x0, state.aimX, state.sel.pace, state.sel.curve, 0.5) : null;
  }
  const resetAim = () => {
    state.x0 = 0; state.aimX = 0; state.sel.curve = 0; state.hint = null; state.hintGuide = null; state.think = null; state.explain = null;
    planner = null; hintPlanner = null; state.hintBusy = false; state.drag = null; state.kbOn = false;
    refreshGuide();
  };
  const beginTurn = () => {
    state.phase = 'aim'; state.pending = null;
    state.humanTurn = state.pz ? true : !isAI(state.m.turn);
    resetAim();
    if (state.humanTurn && state.mode !== 'watch') {
      if (state.mode === 'two') toast(`${state.labels[state.m.turn].name}: your ball`, 1.8);
      else if ((state.record.thrown | 0) < 3) toast('Slide the ball, aim at the pins, then press ROLL', 4.5);
    }
  };
  const demoDone = () => state.demo && state.mode !== 'watch' && state.record.demoFrames >= DEMO_FRAME_CAP;

  const startGame = (cfg) => {
    if (cfg.mode !== 'watch' && demoDone()) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.cfg = { opp: 0, watchA: 3, watchB: 2, alley: state.settings.alley, wood: 'classic', ...cfg };
    state.mode = cfg.mode; state.pz = null;
    setAlley(state.cfg.alley);
    state.m = newMatch({ mode: cfg.mode, players: 2 });
    if (cfg.mode === 'two') state.labels = [{ name: 'Player 1' }, { name: 'Player 2' }];
    else if (cfg.mode === 'watch') state.labels = [{ name: PROFILES[state.cfg.watchA].name }, { name: PROFILES[state.cfg.watchB].name }];
    else state.labels = [{ name: 'You' }, { name: PROFILES[state.cfg.opp].name }];
    state.w = createWorld(); state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.parts = []; state.pop = null; state.sweep = null; state.showCard = false;
    beginTurn();
  };
  const startWatch = () => {
    const picks = [2, 3, 4, 5];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startGame({ mode: 'watch', watchA: a, watchB: b, alley: ALLEY_IDS[aiRng.int(3)], wood: 'classic' });
  };
  const startPuzzle = (index) => {
    if (state.demo) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const pz = PUZZLES[index];
    state.mode = 'puzzle'; state.m = null; state.cfg = { opp: 0, watchA: 3, watchB: 2, alley: state.settings.alley, wood: 'classic' };
    state.pz = { index, title: pz.title, budget: pz.budget, left: 3, used: 0, score: 0 };
    state.w = createWorld(makeLayout(pz.standing, pz.wood));
    state.labels = [{ name: 'You' }, { name: '' }];
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.parts = []; state.pop = null; state.sweep = null; state.showCard = false;
    setAlley(state.settings.alley);
    beginTurn();
    toast(`Clear the ${pz.standing.length} standing pins. Wood stays where it lies.`, 4);
  };

  // ---- rolling ------------------------------------------------------------------------------------
  const rollBall = (params, jitter) => {
    const w = state.w;
    state.before = standingCount(w);
    w.ev = [];
    // the bowler's wind-up and step (WINDUP s) happen before the ball leaves the hand; the physics starts at the release
    state.pending = { ball: newBall(params.x0, params.aim, params.pace, params.curve, jitter), t: 0, dur: WINDUP, x0: params.x0, side: state.m ? state.m.turn : 0, pace: params.pace };
    state.phase = 'roll'; state.humanTurn = false; state.guide = null; state.hint = null; state.hintGuide = null; state.drag = null;
    state.think = null; state.explain = null; planner = null; hintPlanner = null; state.hintBusy = false; state.kbOn = false;
    if (state.mode === 'puzzle' || (state.mode !== 'watch' && !isAI(state.m.turn))) state.record.thrown = (state.record.thrown | 0) + 1;
    rumble = 0;
  };
  const humanRoll = () => {
    const j = { x: gauss(jr) * 0.004, v: gauss(jr) * 0.004, a: gauss(jr) * 0.0006 };
    rollBall({ x0: state.x0, aim: state.aimX, pace: state.sel.pace, curve: state.sel.curve }, j);
  };

  const popFor = (down, res, clearedAll) => {
    if (res && res.strike) return { text: 'STRIKE!', sub: 'all ten', color: '#ffd35a', big: true, t: 0 };
    if (res && res.spare) return { text: 'SPARE!', sub: 'all ten', color: '#7ff0e4', big: true, t: 0 };
    if (clearedAll) return { text: 'CLEAR!', color: '#ffd35a', big: true, t: 0 };
    return { text: down === 0 ? 'No pins' : down === 1 ? '1 pin' : `${down} pins`, color: '#fff3d6', big: false, t: 0 };
  };

  const onSettled = () => {
    const w = state.w, down = state.before - standingCount(w), cleared = standingCount(w) === 0;
    state.phase = 'settle'; state.settleT = 0;
    if (state.pz) {
      const p = state.pz;
      p.left--; p.used++; p.score += down;
      state.pop = popFor(down, null, cleared);
      state.pzDone = cleared || p.left <= 0;
      if (cleared) { for (let i = 0; i < 4; i++) sfx.chime(i); } else if (down === 0) sfx.no();
      return;
    }
    state.lastP = state.m.turn;
    const res = recordBall(state.m, down, cleared);
    state.lastRes = res;
    state.pop = popFor(down, res, false);
    if (res.strike) { state.record.strikes++; for (let i = 0; i < 4; i++) sfx.chime(i); state.shake = { t: 0, dur: 0.4, a: 4 }; }
    else if (res.spare) { state.record.spares++; sfx.chime(1); sfx.chime(3); }
    else if (down === 0) sfx.no();
    if (res.frameDone && state.mode !== 'watch' && (state.mode === 'two' || state.lastP === 0)) state.record.demoFrames++;
  };

  const finishBall = () => {
    state.pop = null;
    if (state.pz) {
      const p = state.pz;
      if (state.pzDone) {
        const cleared = standingCount(state.w) === 0;
        const stars = cleared ? (p.used <= p.budget ? 3 : p.used === p.budget + 1 ? 2 : 1) : 0;
        if (stars > (state.record.stars[p.index] ?? 0)) state.record.stars[p.index] = stars;
        state.pzResult = { index: p.index, stars, used: p.used, left: standingCount(state.w) };
        save();
        state.scene = 'result'; state.ui.scroll = 0;
        if (stars) sfx.win();
        return;
      }
      beginTurn();
      return;
    }
    const res = state.lastRes;
    if (res.gameOver) { endGame(); return; }
    if (res.rack) { state.sweep = { t: 0, then: 'rack' }; return; }
    if (state.cfg.wood === 'easy') { state.sweep = { t: 0, then: 'wood' }; return; }
    beginTurn();
  };
  const afterSweep = () => {
    const kind = state.sweep.then;
    state.sweep = null;
    if (kind === 'rack') state.w = createWorld(newRack());
    else for (const p of state.w.pins) if (p.s === 1) p.s = 2;
    if (state.lastRes && state.lastRes.frameDone && demoDone()) { save(); state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    beginTurn();
  };
  const endGame = () => {
    const m = state.m, o = m.over;
    state.scene = 'result'; state.ui.scroll = 0;
    if (state.mode === 'ai') {
      state.record.played++; state.record.games++;
      const mine = totals(m)[0];
      if (mine > state.record.best) state.record.best = mine;
      if (o.win === 0 && !o.tie) { state.record.wins[state.cfg.opp]++; sfx.win(); }
    }
    save();
  };

  // ---- AI turn ----------------------------------------------------------------------------------
  const describe = (p) => `${PACES[p.pace].name} ball, ${curveName(p.curve).toLowerCase()}, aimed ${Math.abs(p.aim) < 0.02 ? 'at the head pin' : p.aim < 0 ? `${Math.round(-p.aim * 100)} cm left of the head pin` : `${Math.round(p.aim * 100)} cm right of the head pin`}`;
  const setPlan = (p) => { state.x0 = p.x0; state.aimX = p.aim; state.sel.pace = p.pace; state.sel.curve = p.curve; };
  const updateAI = (dt) => {
    if (state.phase !== 'aim' || state.humanTurn || state.paused || state.pz) return;
    const m = state.m, side = m.turn, prof = profFor(side), watch = state.mode === 'watch';
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur, phase: 'think', plan: null };
      planner = createPlanner(state.w, { ballsLeft: ballsLeft(), firstBall: m.ball === 0, clearBonus: 'spare' }, prof, aiRng);
    }
    const th = state.think;
    th.t += dt;
    if (planner && !planner.done) {
      planner.step(14);
      state.explain = watch ? { head: `${state.labels[side].name} is thinking…`, lines: [`Trying ${planner.sims} rolls on a copy of the lane`, 'Counting pins knocked and how good the leave is'] } : null;
      if (planner.done) { th.plan = planner.result; planner = null; }
    }
    if (th.phase === 'think' && th.t >= th.dur && th.plan) {
      if (watch) {
        th.phase = 'reveal'; th.t = 0; th.dur = 2;
        const pr = th.plan.params;
        setPlan(pr); refreshGuide();
        state.hint = pr; state.hintGuide = previewPath(pr.x0, pr.aim, pr.pace, pr.curve, 0.5);
        state.explain = { head: `${state.labels[side].name} chooses: ${describe(pr)}`, lines: th.plan.alts.map((a, i) => `${i + 1}. ${describe(a.params)}  (${a.down} pin${a.down === 1 ? '' : 's'}${a.left === 0 ? ', clears the deck' : `, ${a.left} left`})`) };
        toast(`${state.labels[side].name}: ${describe(pr)}`, 2.2);
      } else execute(th, prof);
    } else if (th.phase === 'reveal' && th.t >= th.dur) execute(th, prof);
  };
  const execute = (th, prof) => {
    const ex = executePlan(th.plan, prof, aiRng);
    setPlan({ x0: ex.x0, aim: ex.aim, pace: ex.pace, curve: ex.curve });
    rollBall({ x0: ex.x0, aim: ex.aim, pace: ex.pace, curve: ex.curve }, ex.jitter);
  };

  // ---- hint -----------------------------------------------------------------------------------
  const requestHint = () => {
    if (state.hintBusy || state.phase !== 'aim' || !state.humanTurn) return;
    state.hintBusy = true;
    hintPlanner = createPlanner(state.w, { ballsLeft: ballsLeft(), firstBall: state.m ? state.m.ball === 0 : false, clearBonus: 'spare' }, BEST, aiRng);
  };
  const updateHint = () => {
    if (!hintPlanner) return;
    hintPlanner.step(16);
    if (hintPlanner.done) {
      const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.phase !== 'aim') return;
      const p = r.best;
      setPlan(p); refreshGuide(); state.hint = p; state.hintGuide = previewPath(p.x0, p.aim, p.pace, p.curve, 0.5);
      toast(`Hint: ${describe(p)}`, 3.4);
    }
  };

  // ---- aiming input -----------------------------------------------------------------------------
  // screen x -> lane x at a given distance down the lane (the aim-pose camera is the reference, so touch is stable)
  const laneX = (pose, sx, yWorld) => {
    const c = makeCam(pose), p0 = c.project(0, yWorld, 0), p1 = c.project(1, yWorld, 0);
    return (sx - p0.x) / (p1.x - p0.x);
  };
  const changed = () => { refreshGuide(); state.hint = null; state.hintGuide = null; };

  const updateAimInput = (ptr, keys, L, P) => {
    if (ptr.pressed) {
      let hit = false;
      P.pace.forEach((r, i) => { if (inRect(r, ptr.x, ptr.y)) { state.sel.pace = i; hit = true; sfx.tick(); changed(); } });
      if (inRect(P.curveDec, ptr.x, ptr.y)) { state.sel.curve = Math.max(-MAX_CURVE, state.sel.curve - 1); hit = true; sfx.tick(); changed(); }
      if (inRect(P.curveInc, ptr.x, ptr.y)) { state.sel.curve = Math.min(MAX_CURVE, state.sel.curve + 1); hit = true; sfx.tick(); changed(); }
      if (inRect(P.curveLabel, ptr.x, ptr.y)) { state.sel.curve = 0; hit = true; sfx.tick(); changed(); }
      if (inRect(P.hint, ptr.x, ptr.y)) { hit = true; requestHint(); sfx.tick(); }
      if (inRect(P.roll, ptr.x, ptr.y)) { humanRoll(); return; }
      if (!hit) {
        if (inRect(P.lanePanel, ptr.x, ptr.y)) { state.drag = { kind: 'slide' }; state.x0 = clamp(laneX(L.poses.lane, ptr.x, 0.1), -START_MAX, START_MAX); changed(); }
        else if (inRect(P.deckPanel, ptr.x, ptr.y)) {
          state.aimX = clamp(laneX(L.poses.deck, ptr.x, H), -AIM_MAX, AIM_MAX);
          state.drag = { kind: 'aim', px0: ptr.x, a0: state.aimX, moved: 0 }; changed();
        }
      }
    }
    if (state.drag) {
      const d = state.drag;
      if (ptr.down) {
        if (d.kind === 'slide') { state.x0 = clamp(laneX(L.poses.lane, ptr.x, 0.1), -START_MAX, START_MAX); changed(); }
        else if (d.kind === 'aim') {
          d.moved = Math.max(d.moved, Math.abs(ptr.x - d.px0));
          if (d.moved > 4) { state.aimX = clamp(d.a0 + (laneX(L.poses.deck, ptr.x, H) - laneX(L.poses.deck, d.px0, H)) * 0.6, -AIM_MAX, AIM_MAX); changed(); }
        }
      } else state.drag = null;
    }
    let kb = false;
    if (keys.down.has('ArrowLeft')) { state.aimX = clamp(state.aimX - 0.006, -AIM_MAX, AIM_MAX); kb = true; }
    if (keys.down.has('ArrowRight')) { state.aimX = clamp(state.aimX + 0.006, -AIM_MAX, AIM_MAX); kb = true; }
    if (keys.down.has('KeyQ')) { state.x0 = clamp(state.x0 - 0.006, -START_MAX, START_MAX); kb = true; }
    if (keys.down.has('KeyE')) { state.x0 = clamp(state.x0 + 0.006, -START_MAX, START_MAX); kb = true; }
    if (keys.pressed.has('ArrowUp')) { state.sel.pace = Math.min(2, state.sel.pace + 1); kb = true; }
    if (keys.pressed.has('ArrowDown')) { state.sel.pace = Math.max(0, state.sel.pace - 1); kb = true; }
    if (keys.pressed.has('KeyZ')) { state.sel.curve = Math.max(-MAX_CURVE, state.sel.curve - 1); kb = true; }
    if (keys.pressed.has('KeyX')) { state.sel.curve = Math.min(MAX_CURVE, state.sel.curve + 1); kb = true; }
    if (kb) changed();
    if (keys.pressed.has('KeyH')) requestHint();
    if (keys.pressed.has('Space') || keys.pressed.has('Enter')) humanRoll();
  };

  // ---- the play scene ----------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leaveGame = () => {
    state.scene = state.pz ? 'puzzles' : 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.drag = null; state.showCard = false; state.pop = null; state.sweep = null;
  };
  const closeCard = () => { state.showCard = false; if (state.m && state.m.over) { state.scene = 'result'; state.ui.scroll = 0; } };

  const updatePlay = (dt, input) => {
    const ptr = input.pointer, keys = input.keys;
    const watch = state.mode === 'watch', L = lay(), P = L.play;
    if (state.lk !== L.key) { if (state.lk && state.drag) state.drag = null; state.lk = L.key; }
    if (config.dev && keys.pressed.has('KeyK') && state.phase === 'aim' && state.humanTurn) { state.before = standingCount(state.w); state.w.pins.forEach((p) => { if (p.s === 0) p.s = 2; }); onSettled(); return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) {
      if (state.showCard) closeCard();
      else if (state.pauseMenu) closePause();
      else if (!watch) openPause();
      else state.paused = !state.paused;
    }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) {
        const d = state.ui.drag; state.ui.drag = null;
        if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      }
      return;
    }
    if (state.showCard) { if (ptr.pressed) closeCard(); return; }
    if (watch) {
      if (ptr.pressed) {
        if (inRect(P.demo.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(P.demo.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); }
        else if (inRect(P.demo.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); }
        else if (inRect(P.demo.exit, ptr.x, ptr.y)) { leaveGame(); return; }
        else if (state.m && (inRect(P.cards[0], ptr.x, ptr.y) || inRect(P.cards[1], ptr.x, ptr.y))) { state.showCard = true; return; }
      }
    } else if (ptr.pressed && inRect(P.menu, ptr.x, ptr.y)) { openPause(); return; }
    else if (ptr.pressed && state.m && (inRect(P.cards[0], ptr.x, ptr.y) || inRect(P.cards[1], ptr.x, ptr.y))) { state.showCard = true; return; }

    state.ff = state.phase === 'roll' && ptr.down && !state.paused ? 2 : 1;
    if (state.phase === 'aim' && state.humanTurn && !state.paused && !watch) updateAimInput(ptr, keys, L, P);
    else if (state.drag && !state.humanTurn) state.drag = null;
    if (state.paused) return;
    updateHint();
    updateAI(dt);

    if (state.phase === 'roll' && state.pending) {
      const pd = state.pending;
      pd.t += dt * state.ff;
      if (pd.t >= pd.dur) { launch(state.w, pd.ball); state.pending = null; sfx.launch(); }
    } else if (state.phase === 'roll') {
      const w = state.w;
      for (let i = 0; i < SUB * state.ff; i++) {
        step(w, DT);
        if (w.ev.length) handleEvents(state.parts, w.ev);
        if (w.settled) break;
      }
      rumble -= dt;
      if (rumble <= 0 && w.ball && w.ball.live && !w.ball.gut) {
        const v = Math.hypot(w.ball.vx, w.ball.vy);
        tone({ freq: 52 + v * 4, to: 46, dur: 0.1, type: 'sawtooth', vol: Math.min(0.03, 0.006 + v / 500) }); rumble = 0.09;
      }
      if (w.settled) onSettled();
    }
    stepParts(state.parts, dt);
    if (state.shake) { state.shake.t += dt; if (state.shake.t >= state.shake.dur) state.shake = null; }
    if (state.toastT > 0) state.toastT -= dt;
    if (state.pop) state.pop.t += dt;
    if (state.sweep) { state.sweep.t += dt; if (state.sweep.t >= 0.75) afterSweep(); }
    if (state.phase === 'settle') {
      state.settleT += dt;
      const auto = watch || (state.m && isAI(state.lastP)) ? 1.7 : 2.4;
      if (((ptr.pressed && state.settleT > 0.6 && !watch) || state.settleT > auto) && !state.sweep) { state.phase = 'done'; finishBall(); }
    }
  };

  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-card') { closePause(); state.showCard = true; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'p-guide') { state.settings.guide = !state.settings.guide; refreshGuide(); save(); }
    else if (id === 'quit') leaveGame();
  }

  // ---- menus ------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.cols.length) state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, mt.max);
  }
  const openSetup = (md) => { state.setup.mode = md; state.setup.alley = state.demo ? 'harbor' : state.settings.alley; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; };
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'play') openSetup('ai');
    else if (id === 'two') openSetup('two');
    else if (id === 'puzzles') { state.scene = 'puzzles'; state.ui.scroll = 0; }
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 0) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id.startsWith('aly')) { const a = id.slice(3); if (state.demo && a !== 'harbor') { state.setupMsg = 'That alley is in the full game.'; return; } s.alley = a; state.setupMsg = ''; }
    else if (id === 'woodclassic') s.wood = 'classic';
    else if (id === 'woodeasy') s.wood = 'easy';
    else if (id === 'start') startGame({ mode: s.mode, opp: s.opp, alley: s.alley, wood: s.wood });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handlePuzzles = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
    else if (id.startsWith('pz')) startPuzzle(Number(id.slice(2)));
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-guide') st.guide = !st.guide;
    else if (id === 'set-alley') { if (!state.demo) { st.alley = ALLEY_IDS[(ALLEY_IDS.indexOf(st.alley) + 1) % ALLEY_IDS.length]; setAlley(st.alley); } }
    else if (id === 'txt-dec') { st.textIdx = Math.max(0, st.textIdx - 1); applySettings(); }
    else if (id === 'txt-inc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); applySettings(); }
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      if (state.restoreBusy || state.demo || monetization.owns('unlock_game')) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.())
        .then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; })
        .catch(() => { state.restoreMsg = 'The store is not available right now. Please try again later.'; })
        .finally(() => { state.restoreBusy = false; });
    }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    if (state.mode === 'puzzle') {
      const r = state.pzResult;
      if (id === 'again') startPuzzle(r.index);
      else if (id === 'next') startPuzzle(r.index + 1);
      else if (id === 'list') { state.scene = 'puzzles'; state.ui.scroll = 0; }
      else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
      return;
    }
    const cfg = state.cfg;
    if (id === 'again') startGame({ ...cfg });
    else if (id === 'sheet') { state.scene = 'play'; state.showCard = true; }
    else if (id === 'new') { state.setup.mode = cfg.mode === 'watch' ? 'ai' : cfg.mode; state.scene = 'setup'; state.ui.scroll = 0; }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };

  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key, lay());
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const scrollable = flowMeta().max > 0;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const max = flowMeta().max;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); applySettings(); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); applySettings(); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };

  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('KeyO') && state.setup.mode !== 'two') state.setup.opp = (state.setup.opp + 1) % (state.demo ? 1 : PROFILES.length);
    if (k.pressed.has('KeyA') && !state.demo) state.setup.alley = ALLEY_IDS[(ALLEY_IDS.indexOf(state.setup.alley) + 1) % ALLEY_IDS.length];
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    const pins = lay().pins;
    if (ptr.pressed && (inRect(pins.start, ptr.x, ptr.y) || inRect(pins.back, ptr.x, ptr.y))) {
      handleSetup(inRect(pins.start, ptr.x, ptr.y) ? 'start' : 'back');
      return;
    }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  let refDrag = null;
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.refScroll = 0; };
    const ref = lay().ref, set = (v) => { state.refScroll = clamp(v, 0, REF.max); };
    if (ptr.pressed) {
      if (inRect(ref.next, ptr.x, ptr.y) || inRect(ref.back, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(ref.dec, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); applySettings(); state.refScroll = 0; save(); }
      else if (inRect(ref.inc, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); applySettings(); state.refScroll = 0; save(); }
      else if (inRect(ref.panel, ptr.x, ptr.y)) refDrag = { y0: ptr.y, s0: state.refScroll };
    }
    if (refDrag) { if (ptr.down) set(refDrag.s0 - (ptr.y - refDrag.y0)); else refDrag = null; }
    if (keys.pressed.has('ArrowDown')) set(state.refScroll + 70);
    if (keys.pressed.has('ArrowUp')) set(state.refScroll - 70);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) set(state.refScroll + REF.view * 0.9);
    if (keys.pressed.has('PageUp')) set(state.refScroll - REF.view * 0.9);
    if (keys.pressed.has('Home')) set(0);
    if (keys.pressed.has('End')) set(1e9);
    if (keys.pressed.has('Escape')) close();
  };

  startAttract();

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused game does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.mode !== 'watch' && !(state.m && state.m.over)) || state.paused,
    update(dt, input) {
      setPress(input.pointer);
      state.owned = !!monetization.owns?.('unlock_game');
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'puzzles': updateFlowScene(dt, input, handlePuzzles, 'puzzles'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx, view) {
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height);
      if (v3.on) ctx.clearRect(0, 0, L.w, L.h);       // the 3D canvas behind shows through; the kit does not clear a transparent canvas
      switch (state.scene) {
        case 'title': renderTitle(ctx, state, L); break;
        case 'setup': renderSetup(ctx, state, L); break;
        case 'settings': renderSettings(ctx, state, L); break;
        case 'result': renderResult(ctx, state, L); break;
        case 'puzzles': renderPuzzles(ctx, state, L); break;
        case 'demolimit': renderDemoLimit(ctx, state, L); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play', L); break;
        case 'about': renderPages(ctx, state, v3.credits ? [...ABOUT, v3.credits] : ABOUT, 'About', L); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules', L); break;
        case 'play':
          if (v3.on && state.pauseMenu) ctx.globalAlpha = 0.3;
          renderPlay(ctx, state, L);
          ctx.globalAlpha = 1;
          if (state.pauseMenu) renderPause(ctx, state, L);
          break;
        default: break;
      }
    },
    wheel(dy) {
      if (['about', 'howto', 'rules'].includes(state.scene)) { state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max); return; }
      if (['title', 'setup', 'settings', 'result', 'demolimit', 'puzzles'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, flowMeta().max);
    },
    getState: () => state,
    debug: () => ({ lockup: lockupZone(), layout: lay(), flow: flowRects(state.ui.scroll), flowMax: flowMeta().max, pages: pageCount() }),
  };
}
