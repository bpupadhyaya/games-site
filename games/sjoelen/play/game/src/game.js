// Sjoelen: state and flow. The engine is sim.js, the match rules match.js, the rivals ai.js, drawing view.js and menus.js.
// This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, records, play (also Watch & Learn), result, howto/about/rules, demolimit.
// A slide: the disc waits at the player's end; drag sideways to place it, flick up the board to slide it. The same
// physics (sim.stepDiscs) runs live for the player, the rivals and the dotted guide, so the guide never lies.
import {
  STEP, START_Y, TW, R, D, ANGLE_LIMIT, V_MIN, V_MAX, clamp, startX, makeDisc, velocityOf, stepDiscs, simulate, laneX, setsOf, scoreOf,
  resetIds,
} from './sim.js';
import { newMatch, applySlide, afterSlide, totals } from './match.js';
import { PROFILES, createPlanner, executePlan } from './ai.js';
import { inRect, TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, toWorld } from './layout.js';
import { renderPlay, layoutOf, nameOf } from './view.js';
import {
  renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderRecords,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, setupPinRects, lockupZone,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';
import { v3 } from './v3.js';
const worldAt = (L, x, y) => (v3.on && v3.toWorld ? v3.toWorld(x, y) : toWorld(L, x, y));

export { meta };
const DEMO_MATCH_CAP = 2;
const MAX_PARTS = 120;
const FLICK_MIN = 420;          // slowest flick (virtual units per second) that slides the disc
const FLICK_GAIN = 0.36;        // slide speed per unit of flick speed
const ANGLE_SOFT = 0.4;         // flick direction is softened so a wobbling finger still hits an arch
const KB_V = [300, 780];

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();
  resetIds();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, textIdx: 0, thinkIdx: 1 },
    record: { wins: [0, 0, 0, 0], played: 0, streak: 0, best: 0, bestSolo: 0, bestSets: 0, demoMatches: 0, slides: 0, passed: 0 },
    setup: { mode: 'ai', opp: 0, rounds: 1 }, setupMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0,
    att: null, m: null, world: { discs: [] }, aim: { x: TW / 2, angle: 0, v: 560 },
    act: null, moving: null, falls: [], live: [0, 0, 0, 0], pulse: [0, 0, 0, 0], guide: null, hint: null, hintBusy: false,
    parts: [], pops: [], toast: '', toastT: 0, humanTurn: false, pass: null, think: null, restoreMsg: '', endT: -1, fl: null, kb: false,
  };
  let planner = null, hintPlanner = null, guideKey = '';

  // ---- persistence ---------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 4) state.record.wins = [0, 0, 0, 0];
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ---------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  let clackT = 0;
  const sfx = {
    push: (p) => tone({ freq: 220 + 160 * p, to: 90, dur: 0.12, type: 'triangle', vol: 0.06 + 0.05 * p }),
    rail: (v) => { if (clackT > 0) return; clackT = 0.05; tone({ freq: 330 + Math.min(200, v), to: 180, dur: 0.07, type: 'square', vol: 0.04 + Math.min(0.06, v / 4000) }); },
    post: (v) => { if (clackT > 0) return; clackT = 0.05; tone({ freq: 520 + Math.min(300, v), to: 260, dur: 0.06, type: 'triangle', vol: 0.06 }); },
    clack: (v) => { if (clackT > 0) return; clackT = 0.04; tone({ freq: 900, to: 420, dur: 0.05, type: 'triangle', vol: 0.05 + Math.min(0.08, v / 3000) }); },
    cap: (k) => { tone({ freq: 392 * Math.pow(1.26, k), dur: 0.2, type: 'sine', vol: 0.09 }); tone({ freq: 784 * Math.pow(1.26, k), dur: 0.14, type: 'triangle', vol: 0.04 }); },
    set: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.28 + i * 0.04, type: 'triangle', vol: 0.1 })),
    miss: () => tone({ freq: 300, to: 200, dur: 0.18, type: 'triangle', vol: 0.05 }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    win: () => [0, 2, 4, 7, 9].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- effects (world units) ------------------------------------------------------------------
  const addPart = (parts, q) => { if (parts.length < MAX_PARTS) parts.push(q); };
  const sparkle = (parts, x, y, n, col = '#ffd35a') => {
    for (let i = 0; i < n; i++) {
      const a = fx.next() * Math.PI * 2, s = 40 + fx.next() * 110;
      addPart(parts, { kind: 3, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.6 + fx.next() * 0.4, size: 3 + fx.next() * 3.4, col });
    }
  };
  const ring = (parts, x, y, size, col) => addPart(parts, { kind: 1, x, y, vx: 0, vy: 0, t: 0, max: 0.5, size, col });
  const dust = (parts, x, y, n) => {
    for (let i = 0; i < n; i++) {
      const a = fx.next() * Math.PI * 2, s = 10 + fx.next() * 35;
      addPart(parts, { kind: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.35 + fx.next() * 0.3, size: 1.2 + fx.next() * 1.4, col: 'rgba(255,236,200,0.8)' });
    }
  };
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };
  const pop = (x, y, text, col, size = 34) => { state.pops.push({ x, y, text, col, size, t: 0, max: 1.3 }); if (state.pops.length > 8) state.pops.shift(); };

  // ---- the attract board behind the menus ----------------------------------------------------
  const ATTRACT = [[2, 0.0, 600], [0, 0.0, 640], [3, 0.0, 620], [1, 0.0, 590], [2, 0.02, 610], [1, -0.01, 650], [3, 0.0, 600], [0, 0.015, 630]];
  const startAttract = () => {
    state.att = { world: { discs: [] }, pile: [0, 0, 0, 0], falls: [], parts: [], wait: 1.0, n: 0, side: 0, scene: null, moving: null };
    state.att.scene = { side: 0, queue: 0, table: [], moving: null, falls: state.att.falls, parts: state.att.parts, pile: state.att.pile, pulse: null, guide: null, hint: null, aim: { x: TW / 2 }, ready: false };
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    a.wait -= dt;
    if (a.wait <= 0 && !a.moving) {
      a.wait = 2.2;
      if (a.n % 8 === 0) { a.world.discs.length = 0; a.pile.fill(0); }
      const [k, ang, v] = ATTRACT[a.n % ATTRACT.length];
      const d = makeDisc(a.n % 2, laneX(k));
      const vel = velocityOf(ang, v); d.vx = vel.vx; d.vy = vel.vy;
      a.world.discs.push(d); a.moving = d; a.n++; a.side = d.side;
    }
    if (a.moving) {
      for (let i = 0; i < 4; i++) {
        const ev = [];
        stepDiscs(a.world.discs, STEP, ev);
        for (const e of ev) if (e.type === 'cap') { a.pile[e.lane]++; sparkle(a.parts, laneX(e.lane), -D / 2, 5); }
        if (a.moving.cap >= 0 || (a.moving.vx === 0 && a.moving.vy === 0)) { a.moving = null; break; }
      }
    }
    stepParts(a.parts, dt);
    a.scene.table = a.world.discs.filter((d) => d.cap < 0);
    a.scene.side = a.side;
  };

  // ---- match flow ------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const isAI = (side) => mode() === 'watch' || (mode() === 'ai' && side === 1);
  const profOf = (side) => (mode() === 'watch' ? PROFILES[side === 0 ? state.m.cfg.watchA : state.m.cfg.opp] : PROFILES[state.m.cfg.opp]);
  const remainingAfter = () => { const m = state.m; return Math.max(0, m.queue - 1) + 10 * (m.rounds - m.round - 1); };
  const lying = () => state.world.discs.filter((d) => d.cap < 0);

  const beginTurn = (newSide = false) => {
    const m = state.m, side = m.side;
    state.humanTurn = !isAI(side);
    state.hint = null; state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.fl = null; state.guide = null; guideKey = '';
    state.aim.angle = 0; state.aim.v = 560; state.kb = false;
    state.pass = state.humanTurn && m.cfg.mode === 'two' && newSide ? { t: 0 } : null;
    state.live = [0, 0, 0, 0];
    if (state.humanTurn) {
      if (m.cfg.mode === 'two') toast(`${nameOf(state, side)}: ${m.queue} disc${m.queue === 1 ? '' : 's'} to slide`, 2.2);
      else if (m.slid[side] === 0) toast('Drag the disc sideways, then flick it up the board', 4);
    } else if (m.cfg.mode !== 'watch') toast(`${nameOf(state, side)} is thinking…`, 1.4);
  };
  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoMatches >= DEMO_MATCH_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    resetIds();
    const first = cfg.first !== undefined ? cfg.first : (cfg.mode === 'two' || cfg.mode === 'ai' ? aiRng.int(2) : 0);
    const m = newMatch({ mode: 'ai', opp: 0, rounds: 1, watchA: 3, ...cfg, first });
    state.m = m;
    state.world = { discs: m.table };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.parts = []; state.pops = []; state.act = null; state.moving = null; state.falls = []; state.endT = -1; state.pass = null;
    state.aim.x = TW / 2;
    if (cfg.mode !== 'watch' && state.demo) { state.record.demoMatches++; save(); }
    beginTurn(false);
  };
  const startWatch = () => {
    const picks = [0, 1, 2, 3];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, rounds: 1, first: 0 });
  };

  // ---- guide and hint --------------------------------------------------------------------------
  const guideFor = (spec) => {
    const key = `${spec.x.toFixed(1)}|${spec.angle.toFixed(3)}|${spec.v.toFixed(0)}|${state.world.discs.length}`;
    if (key === guideKey) return;
    guideKey = key;
    const r = simulate(lying(), { ...spec, side: state.m.side }, { trace: true, maxT: 6 });
    state.guide = r.trace;
  };

  // ---- the act of a slide ----------------------------------------------------------------------
  const startThrow = (spec) => {
    const m = state.m, side = m.side;
    if (state.act || m.over || m.queue <= 0) return;
    const d = makeDisc(side, startX(spec.x));
    const vel = velocityOf(clamp(spec.angle, -ANGLE_LIMIT, ANGLE_LIMIT), clamp(spec.v, V_MIN, V_MAX));
    d.vx = vel.vx; d.vy = vel.vy;
    state.world.discs.push(d);
    state.moving = d;
    state.act = { side, caps: [], acc: 0, simT: 0, settle: 0, d };
    state.aim.x = d.x;
    state.humanTurn = false; state.hint = null; state.guide = null; guideKey = ''; state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.fl = null;
    state.pass = null; state.toastT = Math.min(state.toastT, 0.2);
    sfx.push(clamp((spec.v - V_MIN) / (V_MAX - V_MIN), 0, 1));
    dust(state.parts, d.x, START_Y, 5);
  };
  const handleEvents = (ev) => {
    const a = state.act;
    for (const e of ev) {
      if (e.type === 'rail') { sfx.rail(e.v); if (e.v > 60) dust(state.parts, a.d.x, a.d.y, 2); }
      else if (e.type === 'post') sfx.post(e.v);
      else if (e.type === 'disc') sfx.clack(e.v);
      else if (e.type === 'cap') {
        a.caps.push({ lane: e.lane, side: e.disc.side });
        state.pulse[e.lane] = 1;
        sfx.cap(e.lane);
        ring(state.parts, laneX(e.lane), -D / 2, 22, 'rgba(255,240,180,0.95)');
        sparkle(state.parts, laneX(e.lane), -D / 2, 6, '#ffe08a');
        state.live[e.lane]++;
        state.falls.push({ x: e.disc.x, y: e.disc.y, vx: e.disc.vx * 0.5, vy: e.disc.vy * 0.5, t: 0, max: 0.22, side: e.disc.side });
      }
    }
  };
  const settle = () => {
    const m = state.m, a = state.act, side = a.side;
    const setsBefore = setsOf(m.stack[side]);
    const table = state.world.discs.filter((d) => d.cap < 0);
    for (const d of table) { d.vx = 0; d.vy = 0; }
    const out = applySlide(m, { caps: a.caps, table });
    state.world = { discs: m.table };
    state.moving = null; state.act = null; state.live = [0, 0, 0, 0];
    if (mode() !== 'watch') { state.record.slides++; state.record.passed += out.caps; }
    const sets = setsOf(m.stack[side]);
    if (out.caps === 0) { pop(TW / 2, 90, 'Short', '#ffe9bf', 28); sfx.miss(); }
    else if (sets > setsBefore) {
      pop(TW / 2, 60, `SET! +${out.gained}`, '#ffe08a', 42);
      sfx.set(); sparkle(state.parts, TW / 2, -D / 2, 22);
    } else pop(a.caps.length ? laneX(a.caps[0].lane) : TW / 2, 40, `+${out.gained}`, '#fff3d8', 34);
    const e = afterSlide(m);
    if (m.over) { finishMatch(); return; }
    if (e.kind === 'again') toast(`${e.n} stray${e.n === 1 ? '' : 's'} slide again`, 2.6);
    else if (e.kind === 'round-end') {
      const who = e.lost ? `${e.lost} disc${e.lost === 1 ? '' : 's'} out` : 'every disc counted';
      if (e.next === 'side') toast(`${nameOf(state, 1 - m.side)} finishes the round: ${who}. ${nameOf(state, m.side)} now`, 3);
      else if (e.next === 'round') toast(`Round ${m.round + 1} of ${m.rounds}`, 2.4);
    }
    beginTurn(e.kind === 'round-end' && e.next === 'side');
  };
  const updateAct = (dt) => {
    const a = state.act;
    a.acc += dt;
    let n = 0, moving = true;
    const ev = [];
    while (a.acc >= STEP && n < 20) {
      a.acc -= STEP; n++; a.simT += STEP;
      ev.length = 0;
      moving = stepDiscs(state.world.discs, STEP, ev);
      if (ev.length) handleEvents(ev);
      if (!moving) break;
    }
    if (!moving || a.simT > 14) { a.settle += dt; if (a.settle > 0.45 || a.simT > 14) settle(); }
    else a.settle = 0;
  };
  const finishMatch = () => {
    const m = state.m, o = m.over, t = totals(m);
    state.endT = 0; state.humanTurn = false; state.moving = null; state.act = null;
    if (m.cfg.mode === 'watch') return;
    const r = state.record;
    r.played++;
    if (m.cfg.mode === 'solo') { if (m.rounds === 3) r.bestSolo = Math.max(r.bestSolo | 0, t[0]); }
    else if (m.cfg.mode === 'ai') {
      if (o.win === 0) { r.wins[m.cfg.opp]++; r.streak++; r.best = Math.max(r.best, r.streak); sfx.win(); } else r.streak = 0;
      if (m.rounds === 3) r.bestSolo = Math.max(r.bestSolo | 0, t[0]);
    }
    r.bestSets = Math.max(r.bestSets | 0, ...m.stack.map(setsOf));
    save();
  };

  // ---- AI turn ---------------------------------------------------------------------------------
  const describePlan = (p) => {
    const k = Math.abs(p.angle) > 0.12 ? ' off the rail' : '';
    return `slide from ${p.x < TW * 0.33 ? 'the left' : p.x > TW * 0.67 ? 'the right' : 'the middle'}${k}`;
  };
  const planPath = (p) => simulate(lying(), { x: p.x, angle: p.angle, v: p.v, side: state.m.side }, { trace: true, maxT: 6 }).trace;
  const updateAI = (dt) => {
    const m = state.m;
    if (state.act || m.over || !isAI(m.side) || state.paused || state.pass) return;
    const prof = profOf(m.side), watch = mode() === 'watch', side = m.side;
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur, phase: 'think', plan: null, p: null, fromX: state.aim.x };
      planner = createPlanner(lying(), side, m.stack[side], prof, aiRng, { remaining: remainingAfter() });
      if (watch) toast(`${nameOf(state, side)} is thinking…`, dur);
    }
    const th = state.think;
    th.t += dt;
    if (planner) { if (!planner.done) planner.step(18); if (planner.done) { th.plan = planner.result; planner = null; } }
    if (th.phase === 'think' && th.t >= th.dur && th.plan) {
      th.p = executePlan(th.plan, prof, aiRng);
      if (watch) {
        th.phase = 'reveal'; th.t = 0; th.dur = 2;
        state.hint = { x: th.plan.x, angle: th.plan.angle, v: th.plan.v, trace: planPath(th.plan) };
        toast(`${nameOf(state, side)}: ${describePlan(th.plan)}`, 2.1);
      } else { th.phase = 'aim'; th.t = 0; th.dur = 0.6; th.fromX = state.aim.x; }
    } else if (th.phase === 'aim') {
      const k = clamp(th.t / th.dur, 0, 1);
      state.aim.x = th.fromX + (th.p.x - th.fromX) * (1 - Math.pow(1 - k, 3));
      if (th.t >= th.dur) startThrow(th.p);
    } else if (th.phase === 'reveal') {
      const k = clamp(th.t / 0.5, 0, 1);
      state.aim.x = th.fromX + (th.p.x - th.fromX) * k;
      if (th.t >= th.dur) startThrow(th.p);
    }
  };

  // ---- hint ------------------------------------------------------------------------------------
  const requestHint = () => {
    const m = state.m;
    if (state.hintBusy || state.act || !state.humanTurn || m.over) return;
    state.hintBusy = true;
    hintPlanner = createPlanner(lying(), m.side, m.stack[m.side], PROFILES[4], aiRng, { perfect: true, remaining: remainingAfter() });
  };
  const updateHint = () => {
    if (!hintPlanner) return;
    if (!hintPlanner.done) hintPlanner.step(30);
    if (hintPlanner.done) {
      const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.act || !state.humanTurn) return;
      state.hint = { x: r.x, angle: r.angle, v: r.v, trace: planPath(r) };
      state.aim.x = r.x; state.aim.angle = r.angle; state.aim.v = r.v; state.kb = true; state.guide = null; guideKey = '';
      toast(`Hint: ${describePlan(r)} and flick along the gold line`, 4.5);
    }
  };

  // ---- the play scene --------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.fl = null; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };

  const flickFrom = (samples, L) => {
    if (samples.length < 2) return null;
    const last = samples[samples.length - 1];
    let first = last;
    for (let i = samples.length - 2; i >= 0; i--) { if (last.t - samples[i].t > 0.11) break; first = samples[i]; }
    const dtw = Math.max(0.025, last.t - first.t);
    const vx = (last.x - first.x) / dtw, vy = (last.y - first.y) / dtw;
    const S = Math.hypot(vx, vy) * L.s;
    if (S < FLICK_MIN || -vy < 0.5 * Math.hypot(vx, vy)) return null;
    const th = Math.atan2(vx, -vy);
    return { angle: clamp(th * ANGLE_SOFT, -ANGLE_LIMIT, ANGLE_LIMIT), v: clamp(FLICK_GAIN * S, V_MIN, V_MAX), S };
  };

  const updatePlay = (dt, input) => {
    const { m } = state;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch';
    const L = layoutOf(state);
    if (config.dev && keys.pressed.has('KeyK')) {
      m.stack[0] = [5, 5, 5, 5]; if (m.sides > 1) m.stack[1] = [4, 4, 5, 4];
      m.over = { win: 0, a: 1, b: 0 }; state.act = null; state.moving = null; finishMatch(); state.scene = 'result'; state.ui.scroll = 0; return;
    }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else state.paused = !state.paused; }
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
    if (m.over && state.endT >= 0 && !state.act) {
      state.endT += dt;
      if (state.endT > 1.6 || (ptr.pressed && state.endT > 0.6)) { state.scene = 'result'; state.ui.scroll = 0; state.endT = -1; return; }
    }
    let onButton = false;
    if (watch) {
      if (ptr.pressed) {
        const D2 = L.demo;
        if (inRect(D2.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(D2.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(D2.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(D2.exit, ptr.x, ptr.y)) { leaveMatch(); return; }
      }
    } else if (ptr.pressed && L.btns) {
      if (inRect(L.btns.menu, ptr.x, ptr.y) && !state.pass) { openPause(); return; }
      if (inRect(L.btns.hint, ptr.x, ptr.y)) { onButton = true; if (state.humanTurn && !state.pass) { requestHint(); sfx.tick(); } }
    }
    if (state.pass) {
      state.pass.t += dt;
      if (ptr.pressed && state.pass.t > 0.35) { state.pass = null; sfx.tick(); }
    } else if (state.humanTurn && !state.paused && !state.act && !m.over) {
      // gesture: place along the near end, flick up the board
      if (ptr.pressed && !onButton) {
        const w = worldAt(L, ptr.x, ptr.y), r = L.rect;
        if (ptr.x >= r.x - 30 && ptr.x <= r.x + r.w + 30 && ptr.y >= r.y - 30 && ptr.y <= r.y + r.h + 30) {
          state.fl = { samples: [], strip: w.y > START_Y - 44 };
          state.kb = false; state.hint = null;
        }
      }
      const fl = state.fl;
      if (fl) {
        if (ptr.down || ptr.released) {
          const w = worldAt(L, ptr.x, ptr.y);
          fl.samples.push({ t: state.t, x: w.x, y: w.y });
          if (fl.samples.length > 14) fl.samples.shift();
          if (fl.strip && w.y > START_Y - 34) state.aim.x = startX(w.x); else fl.strip = false;
        }
        const f = flickFrom(fl.samples, L);
        if (ptr.down && f) guideFor({ x: state.aim.x, angle: f.angle, v: f.v });
        else if (ptr.down) { state.guide = null; guideKey = ''; }
        if (ptr.released) {
          state.fl = null;
          if (f) startThrow({ x: state.aim.x, angle: f.angle, v: f.v });
          else {
            state.guide = null; guideKey = '';
            if (!fl.strip && fl.samples.length > 2 && m.slid[m.side] < 3) toast('Flick up the board a little faster', 1.8);
          }
        }
      }
      // keyboard
      const k = keys.down, st = 2.2;
      let kbUsed = false;
      if (k.has('ArrowLeft')) { state.aim.x = startX(state.aim.x - st); kbUsed = true; }
      if (k.has('ArrowRight')) { state.aim.x = startX(state.aim.x + st); kbUsed = true; }
      if (k.has('KeyA')) { state.aim.angle = clamp(state.aim.angle - 0.004, -ANGLE_LIMIT, ANGLE_LIMIT); kbUsed = true; }
      if (k.has('KeyD')) { state.aim.angle = clamp(state.aim.angle + 0.004, -ANGLE_LIMIT, ANGLE_LIMIT); kbUsed = true; }
      if (k.has('KeyW') || k.has('ArrowUp')) { state.aim.v = clamp(state.aim.v + 4, KB_V[0], KB_V[1]); kbUsed = true; }
      if (k.has('KeyS') || k.has('ArrowDown')) { state.aim.v = clamp(state.aim.v - 4, KB_V[0], KB_V[1]); kbUsed = true; }
      if (kbUsed) { state.kb = true; if (state.hint && state.hint.x !== state.aim.x) state.hint = null; }
      if (state.kb && !state.fl) guideFor({ x: state.aim.x, angle: state.aim.angle, v: state.aim.v });
      if (keys.pressed.has('KeyH')) requestHint();
      if (keys.pressed.has('Space') || keys.pressed.has('Enter')) startThrow({ x: state.aim.x, angle: state.aim.angle, v: state.aim.v });
    } else if (state.fl && !state.humanTurn) state.fl = null;
    if (state.paused) return;
    updateHint();
    updateAI(dt);
    if (state.act) updateAct(dt);
    clackT = Math.max(0, clackT - dt);
    for (let i = 0; i < 4; i++) if (state.pulse[i] > 0) state.pulse[i] = Math.max(0, state.pulse[i] - dt * 2.4);
    for (const f of state.falls) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.9; f.vy *= 0.9; f.y = Math.max(f.y, -D + R); }
    state.falls = state.falls.filter((f) => f.t < f.max);
    stepParts(state.parts, dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
  };

  const leaveMatch = () => {
    state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.think = null; planner = null; hintPlanner = null;
    state.hintBusy = false; state.fl = null; state.act = null; state.moving = null; state.pass = null; state.falls = []; state.live = [0, 0, 0, 0];
  };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'quit') leaveMatch();
  }

  // ---- menus -----------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag;
    const mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) {
      const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top));
      state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max);
    }
  }
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'play') { state.setup.mode = 'ai'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'two') { state.setup.mode = 'two'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'solo') { state.setup.mode = 'solo'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'records') { state.scene = 'records'; state.ui.scroll = 0; }
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id === 'len1') s.rounds = 1;
    else if (id === 'len3') s.rounds = 3;
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, rounds: s.rounds });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
    }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.m.cfg;
    if (id === 'again') startMatch({ ...cfg, first: cfg.mode === 'solo' ? 0 : aiRng.int(2) });
    else if (id === 'new') { state.setup.mode = cfg.mode === 'watch' ? 'ai' : cfg.mode; state.scene = 'setup'; state.ui.scroll = 0; }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };

  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key);
    { const m0 = flowMeta(); state.ui.scroll = clamp(state.ui.scroll, 0, m0.lay ? Math.max(0, m0.lay.contentH - (m0.bottom - m0.top)) : 0); }
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta();
      const scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta();
    const max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };

  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('KeyO') && state.setup.mode === 'ai') state.setup.opp = (state.setup.opp + 1) % (state.demo ? 2 : 4);
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    ensureLayout(state, 'setup');
    const pins = setupPinRects(state);
    if (ptr.pressed && (inRect(pins.start, ptr.x, ptr.y) || inRect(pins.back, ptr.x, ptr.y))) {
      handleSetup(inRect(pins.start, ptr.x, ptr.y) ? 'start' : 'back');
      return;
    }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  let refDrag = null, wheelHooked = false;
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const RL = refLayout(), set = (v) => { state.refScroll = clamp(v, 0, REF.max); };
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.refScroll = 0; };
    if (ptr.pressed) {
      if (inRect(RL.next, ptr.x, ptr.y) || inRect(RL.back, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(RL.dec, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.refScroll = 0; save(); }
      else if (inRect(RL.inc, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.refScroll = 0; save(); }
      else if (inRect(RL.panel, ptr.x, ptr.y)) refDrag = { y0: ptr.y, s0: state.refScroll };
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
  resetMenus();

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused || !!state.pass,
    update(dt, input) {
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'setup', 'settings', 'result', 'demolimit', 'records'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, Math.max(0, flowMeta().h ?? 0));
        });
      }
      syncSize();
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'records': updateFlowScene(dt, input, (id) => { if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; } }, 'records'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      syncSize();
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'records': renderRecords(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.m) renderPlay(ctx, state);
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    // Dev / screenshot hook (?spec=<json>): jump straight to a screen. Not reachable in production flows.
    devScene(spec = {}) {
      const sc = spec.scene || 'title';
      if (spec.text !== undefined) state.settings.textIdx = clamp(spec.text | 0, 0, TEXT_SCALES.length - 1);
      if (sc === 'play' || sc === 'result') {
        startMatch({ mode: spec.mode || 'ai', opp: spec.opp ?? 0, rounds: spec.rounds ?? 1, first: spec.first ?? 0 });
        for (const th of spec.throws || []) { startThrow({ x: th[0], angle: th[1], v: th[2] }); let n = 0; while (state.act && n++ < 6000) updateAct(1 / 60); }
        if (spec.live) { const th = spec.live; startThrow({ x: th[0], angle: th[1], v: th[2] }); for (let i = 0; i < (th[3] || 10); i++) if (state.act) updateAct(1 / 60); }
        if (spec.pause) openPause();
        if (spec.freeze) state.paused = true;
        if (sc === 'result') { const m = state.m; m.stack[0] = [5, 5, 5, 5]; if (m.sides > 1) m.stack[1] = [4, 4, 5, 4]; m.over = { win: 0, a: 1, b: 0 }; state.act = null; state.moving = null; finishMatch(); state.scene = 'result'; }
      } else if (['setup', 'settings', 'records', 'howto', 'about', 'rules', 'demolimit'].includes(sc)) {
        if (sc === 'setup') state.setup.mode = spec.mode || 'ai';
        if (['howto', 'about', 'rules'].includes(sc)) { state.back = 'title'; state.refScroll = spec.scroll || 0; }
        state.scene = sc; state.ui.scroll = spec.scroll || 0;
      } else state.scene = 'title';
      if (spec.calm) state.calm = true;
    },
    lockupZone: () => lockupZone(),
  };
}
void scoreOf;
