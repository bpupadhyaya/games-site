// Shove ha'penny: state and flow. The engine is sim.js, the match rules match.js, the rivals ai.js, drawing view.js and menus.js.
// This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, records, play (also Watch & Learn), result, howto/about/rules, demolimit.
// A strike: the coin waits on the near edge; drag along the edge to place it, drag up the board to set where it should stop
// and release. The same physics (sim.simulate) runs live for the player, the rivals and the ghost coin, so the ghost never lies.
import {
  STEP, START_Y, TW, R, MIN_PULL, AIM_MIN_Y, AIM_MAX_Y, clamp, startX, makeCoin, strikeVelocity, stepCoins, simulate, bedOf, bedCenterY,
  resetIds, FAR_EDGE,
} from './sim.js';
import { newMatch, afterCoin, beds, chalkTotals, afterSweep } from './match.js';
import { PROFILES, HAND, wobble, createPlanner, executePlan } from './ai.js';
import { inRect, TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, toWorld } from './layout.js';
import { renderPlay, layoutOf, nameOf } from './view.js';
import {
  renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderRecords,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, setupPinRects, lockupZone,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export { meta };
const DEMO_MATCH_CAP = 2;
const MAX_PARTS = 120;
const OFFSET_PX = 76;           // the marker rides this far above the fingertip so the finger does not hide it
const KB_STEP = 1.6;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();
  const handRng = rng.fork();
  resetIds();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, textIdx: 0, thinkIdx: 1 },
    record: { wins: [0, 0, 0, 0], played: 0, streak: 0, best: 0, bestSolo: 0, bestRound: 0, demoMatches: 0, coins: 0, inBed: 0 },
    setup: { mode: 'ai', opp: 0, target: 9 }, setupMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0,
    att: null, m: null, world: { coins: [] }, aim: { x: TW / 2, tx: TW / 2, ty: bedCenterY(4) }, showAim: false, ghost: null, guideTrace: null,
    act: null, moving: null, falls: [], dead: [], pulse: [Array(9).fill(0), Array(9).fill(0)], hint: null, hintBusy: false, heel: null, queue: [], shown: [Array(9).fill(0), Array(9).fill(0)], pendingOver: false,
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
    strike: (p) => { tone({ freq: 160 + 120 * p, to: 70, dur: 0.1, type: 'triangle', vol: 0.07 + 0.05 * p }); tone({ freq: 1200, to: 500, dur: 0.04, type: 'square', vol: 0.025 }); },
    clack: (v) => { if (clackT > 0) return; clackT = 0.04; tone({ freq: 1400 + Math.min(500, v * 2), to: 600, dur: 0.05, type: 'triangle', vol: 0.05 + Math.min(0.08, v / 2500) }); },
    fall: () => tone({ freq: 140, to: 60, dur: 0.22, type: 'sine', vol: 0.1 }),
    sweep: () => tone({ freq: 360, to: 200, dur: 0.1, type: 'triangle', vol: 0.04 }),
    chalk: (k) => { tone({ freq: 523 * Math.pow(1.19, k), dur: 0.22, type: 'sine', vol: 0.09 }); tone({ freq: 1046 * Math.pow(1.19, k), dur: 0.12, type: 'triangle', vol: 0.04 }); },
    bed: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.28 + i * 0.04, type: 'triangle', vol: 0.1 })),
    waste: () => tone({ freq: 260, to: 180, dur: 0.18, type: 'triangle', vol: 0.05 }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    win: () => [0, 2, 4, 7, 9].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- effects (world units) ------------------------------------------------------------------
  const addPart = (parts, q) => { if (parts.length < MAX_PARTS) parts.push(q); };
  const sparkle = (parts, x, y, n, col = '#ffd35a') => {
    for (let i = 0; i < n; i++) {
      const a = fx.next() * Math.PI * 2, s = 30 + fx.next() * 80;
      addPart(parts, { kind: 3, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.6 + fx.next() * 0.4, size: 2.5 + fx.next() * 3, col });
    }
  };
  const ring = (parts, x, y, size, col) => addPart(parts, { kind: 1, x, y, vx: 0, vy: 0, t: 0, max: 0.5, size, col });
  const dust = (parts, x, y, n) => {
    for (let i = 0; i < n; i++) {
      const a = fx.next() * Math.PI * 2, s = 8 + fx.next() * 28;
      addPart(parts, { kind: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.35 + fx.next() * 0.3, size: 1 + fx.next() * 1.3, col: 'rgba(255,236,200,0.75)' });
    }
  };
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };
  const pop = (x, y, text, col, size = 30) => { state.pops.push({ x, y, text, col, size, t: 0, max: 1.3 }); if (state.pops.length > 8) state.pops.shift(); };

  // ---- the attract board behind the menus ----------------------------------------------------
  const startAttract = () => {
    state.att = { world: { coins: [] }, falls: [], parts: [], dead: [], wait: 1.0, n: 0, moving: null, scene: null, t: 0 };
    state.att.scene = { side: 0, sides: 2, t: 0, table: [], moving: null, falls: state.att.falls, parts: state.att.parts, dead: state.att.dead,
      chalks: [Array(9).fill(0), Array(9).fill(0)], pulse: null, aim: { x: TW / 2, tx: 0, ty: 0 }, ready: false, showAim: false };
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    a.t += dt; a.scene.t = a.t;
    a.wait -= dt;
    if (a.wait <= 0 && !a.moving) {
      a.wait = 2.0;
      if (a.n % 9 === 0) { a.world.coins.length = 0; }
      const bed = [2, 5, 0, 7, 3, 6, 1, 8, 4][a.n % 9];
      const x = 30 + ((a.n * 71) % 150), tx = 28 + ((a.n * 53) % 160);
      const c = makeCoin(a.n % 2, x, a.n);
      const v = strikeVelocity(c.x, tx, bedCenterY(bed));
      c.vx = v.vx; c.vy = v.vy;
      a.world.coins.push(c); a.moving = c; a.n++; a.scene.side = c.side;
    }
    if (a.moving) {
      for (let i = 0; i < 4; i++) {
        stepCoins(a.world.coins, STEP, null);
        if (a.moving.out || (a.moving.vx === 0 && a.moving.vy === 0)) {
          a.moving = null;
          a.world.coins = a.world.coins.filter((c) => !c.out && bedOf(c) >= 0);
          break;
        }
      }
    }
    stepParts(a.parts, dt);
    a.scene.table = a.world.coins.filter((c) => !c.out);
  };

  // ---- match flow ------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const isAI = (side) => mode() === 'watch' || (mode() === 'ai' && side === 1);
  const profOf = (side) => (mode() === 'watch' ? PROFILES[side === 0 ? state.m.cfg.watchA : state.m.cfg.opp] : PROFILES[state.m.cfg.opp]);
  const lying = () => state.world.coins.filter((c) => !c.out);
  const aimDefault = () => { state.aim.tx = state.aim.x; state.aim.ty = bedCenterY(4); state.showAim = false; };

  const beginTurn = (newSide = false) => {
    const m = state.m, side = m.side;
    state.humanTurn = !isAI(side);
    state.hint = null; state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.fl = null;
    state.ghost = null; state.guideTrace = null; guideKey = ''; state.heel = null;
    state.aim.x = startX(state.aim.x); aimDefault(); state.kb = false;
    state.pass = null; void newSide;
    if (state.humanTurn) {
      if (m.cfg.mode === 'two') toast(`${nameOf(state, side)}: your coin`, 2.0);
      else if (m.placed[side] === 0 && m.round === 0) toast('Drag along the edge to place the coin, then drag up the board to aim and let go', 5);
    } else if (m.cfg.mode !== 'watch') toast(`${nameOf(state, side)} is thinking…`, 1.4);
  };
  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoMatches >= DEMO_MATCH_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    resetIds();
    const first = cfg.first !== undefined ? cfg.first : (cfg.mode === 'two' || cfg.mode === 'ai' ? aiRng.int(2) : 0);
    const m = newMatch({ mode: 'ai', opp: 0, target: 9, watchA: 3, ...cfg, first });
    state.m = m;
    state.world = { coins: [] };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.parts = []; state.pops = []; state.act = null; state.moving = null; state.falls = []; state.dead = []; state.endT = -1; state.pass = null;
    state.queue = []; state.pendingOver = false; state.shown = [Array(9).fill(0), Array(9).fill(0)];
    state.pulse = [Array(9).fill(0), Array(9).fill(0)];
    state.aim.x = TW / 2;
    if (cfg.mode !== 'watch' && state.demo) { state.record.demoMatches++; save(); }
    beginTurn(false);
  };
  const startWatch = () => {
    const picks = [0, 1, 2, 3];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, target: 5, first: 0 });
  };

  // ---- ghost and hint --------------------------------------------------------------------------
  const ghostFor = (spec) => {
    const key = `${spec.x.toFixed(1)}|${spec.tx.toFixed(1)}|${spec.ty.toFixed(1)}|${state.world.coins.length}`;
    if (key === guideKey) return;
    guideKey = key;
    const r = simulate(lying(), { ...spec, side: state.m.side, n: state.m.idx }, { trace: true, maxT: 6 });
    state.guideTrace = r.trace;
    state.ghost = r.fell ? null : { x: r.thrown.x, y: r.thrown.y };
  };
  const planGhost = (p) => {
    const r = simulate(lying(), { x: p.x, tx: p.tx, ty: p.ty, side: state.m.side, n: state.m.idx }, { trace: true, maxT: 6 });
    return { trace: r.trace, ghost: r.fell ? null : { x: r.thrown.x, y: r.thrown.y } };
  };

  // ---- the act of a strike ---------------------------------------------------------------------
  const startStrike = (spec) => {
    const m = state.m, side = m.side;
    if (state.act || m.over || state.pendingOver) return;
    const x = startX(spec.x);
    const ty = clamp(spec.ty, AIM_MIN_Y, AIM_MAX_Y), tx = clamp(spec.tx, 0, TW);
    const c = makeCoin(side, x, m.idx);
    const v = strikeVelocity(x, tx, ty, spec.dp ?? 0, spec.dx ?? 0);
    c.vx = v.vx; c.vy = v.vy;
    const before = lying().length;
    state.world.coins.push(c);
    state.moving = c;
    state.act = { side, acc: 0, simT: 0, settle: 0, c, before, fell: 0, fellOthers: 0 };
    state.aim.x = x;
    state.humanTurn = false; state.hint = null; state.showAim = false; state.ghost = null; state.guideTrace = null; guideKey = '';
    state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.fl = null; state.pass = null;
    state.toastT = Math.min(state.toastT, 0.2);
    state.heel = { t: 0, x };
    sfx.strike(clamp((v.v - 60) / 360, 0, 1));
    dust(state.parts, x, START_Y - 4, 4);
  };
  const handleEvents = (ev) => {
    const a = state.act;
    for (const e of ev) {
      if (e.type === 'hit') { sfx.clack(e.v); if (e.v > 40) dust(state.parts, a.c.x, a.c.y, 2); }
      else if (e.type === 'fall') {
        sfx.fall(); if (e.coin === a.c) a.fell++; else a.fellOthers++;
        state.falls.push({ x: e.coin.x, y: e.coin.y, t: 0, max: 0.4, side: e.coin.side });
      }
    }
  };
  const settle = () => {
    const m = state.m, a = state.act, side = a.side;
    for (const c of state.world.coins) { c.vx = 0; c.vy = 0; }
    const all = state.world.coins.filter((c) => !c.out);
    const { kept, dead } = afterSweep(all);
    // coins that were lying before and are now gone (off the board or swept) were knocked out by this strike
    const knocked = a.fellOthers + dead.filter((c) => c !== a.c).length;
    for (const d of dead) {
      const ang = fx.next() * Math.PI * 2;
      state.dead.push({ x: d.x, y: d.y, vx: Math.cos(ang) * 40, vy: Math.sin(ang) * 40, side: d.side, t: 0, max: 0.45 });
    }
    if (dead.length) sfx.sweep();
    state.world = { coins: kept };
    state.moving = null; state.act = null;
    const inBed = kept.includes(a.c) && bedOf(a.c) >= 0;
    if (mode() !== 'watch') { state.record.coins++; if (inBed) state.record.inBed++; }
    if (!inBed) {
      if (a.c.out) pop(TW / 2, FAR_EDGE + 40, 'Off the board', '#ffd9c8', 26);
      else if (dead.includes(a.c)) pop(a.c.x, a.c.y, 'Short: dead', '#ffd9c8', 24);
      else pop(a.c.x, a.c.y - 10, 'On a line: dead', '#ffd9c8', 24);
    }
    if (knocked) pop(TW / 2, 120, `${knocked} coin${knocked === 1 ? '' : 's'} knocked out`, '#ffd35a', 24);
    const r = afterCoin(m, kept, { swept: dead.length, knocked, fell: a.fell });
    r.awards.forEach((aw, i) => { state.queue.push({ at: state.t + 0.12 + i * 0.3, aw, coins: kept }); });
    if (r.over) { state.pendingOver = true; state.humanTurn = false; return; }
    if (r.kind === 'round-end') {
      for (const c of kept) state.dead.push({ x: c.x, y: c.y, vx: 0, vy: -30, side: c.side, t: 0, max: 0.7 });
      state.world = { coins: [] };
      const g = m.sides === 2 ? `${nameOf(state, 0)} ${m.got[0]}` : '';
      void g;
      toast(m.sides === 2 ? `Round over. ${nameOf(state, m.side)} starts the next` : 'Round over. Coins picked up', 2.2);
    }
    beginTurn(false);
  };
  const updateAct = (dt) => {
    const a = state.act;
    a.acc += dt;
    let n = 0, moving = true;
    const ev = [];
    while (a.acc >= STEP && n < 20) {
      a.acc -= STEP; n++; a.simT += STEP;
      ev.length = 0;
      moving = stepCoins(state.world.coins, STEP, ev);
      if (ev.length) handleEvents(ev);
      if (!moving) break;
    }
    if (!moving || a.simT > 10) { a.settle += dt; if (a.settle > 0.4 || a.simT > 10) settle(); }
    else a.settle = 0;
  };

  // ---- chalks appear one by one -----------------------------------------------------------------
  const updateQueue = () => {
    const m = state.m;
    while (state.queue.length && state.queue[0].at <= state.t) {
      const { aw, coins } = state.queue.shift();
      const c = coins.find((q) => q.id === aw.id);
      if (aw.side < 0) { sfx.waste(); if (c) pop(c.x, c.y, 'Wasted', '#cfd6dd', 22); continue; }
      const sh = state.shown[aw.side];
      const before = sh[aw.bed];
      sh[aw.bed]++;
      state.pulse[aw.side][aw.bed] = 1;
      if (c) { ring(state.parts, c.x, c.y, 20, 'rgba(255,240,180,0.95)'); sparkle(state.parts, c.x, c.y, 6); }
      if (sh[aw.bed] >= 3 && before < 3) { sfx.bed(); toast(`${nameOf(state, aw.side)} fills bed ${aw.bed + 1}`, 1.8); }
      else sfx.chalk(aw.bed % 5);
      if (aw.by !== aw.side && c) pop(c.x, c.y, `for ${nameOf(state, aw.side)}`, '#ffd9a0', 20);
      else if (c) pop(c.x, c.y, 'chalk', '#ffe9bf', 20);
    }
    if (state.pendingOver && !state.queue.length) { state.pendingOver = false; finishMatch(); }
    void m;
  };
  const finishMatch = () => {
    const m = state.m, o = m.over;
    state.endT = 0; state.humanTurn = false; state.moving = null; state.act = null;
    if (m.cfg.mode === 'watch') return;
    const r = state.record;
    r.played++;
    if (m.cfg.mode === 'solo') { if (o.win === 0 && m.target === 9) r.bestSolo = r.bestSolo ? Math.min(r.bestSolo, o.rounds) : o.rounds; }
    else if (m.cfg.mode === 'ai') {
      if (o.win === 0) { r.wins[m.cfg.opp]++; r.streak++; r.best = Math.max(r.best, r.streak); sfx.win(); } else r.streak = 0;
    }
    r.bestRound = Math.max(r.bestRound | 0, ...m.best);
    save();
  };

  // ---- AI turn ---------------------------------------------------------------------------------
  const describePlan = (p) => {
    const bed = clamp(Math.round(8.5 - p.ty / 27), 0, 8) + 1;
    return `shove it to bed ${bed}${p.tx < TW * 0.33 ? ' on the left' : p.tx > TW * 0.67 ? ' on the right' : ''}`;
  };
  const updateAI = (dt) => {
    const m = state.m;
    if (state.act || m.over || !isAI(m.side) || state.paused || state.pass || state.pendingOver) return;
    const prof = profOf(m.side), watch = mode() === 'watch', side = m.side;
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur, phase: 'think', plan: null, p: null, from: { x: state.aim.x, tx: state.aim.tx, ty: state.aim.ty } };
      planner = createPlanner(lying(), side, m.chalks, prof, aiRng, { idx: m.idx, sides: m.sides });
      if (watch) toast(`${nameOf(state, side)} is thinking…`, dur);
    }
    const th = state.think;
    th.t += dt;
    if (planner) { if (!planner.done) planner.step(30); if (planner.done) { th.plan = planner.result; planner = null; } }
    if (th.phase === 'think' && th.t >= th.dur && th.plan) {
      th.p = executePlan(th.plan, prof, aiRng);
      if (watch) {
        th.phase = 'reveal'; th.t = 0; th.dur = 2;
        const g = planGhost(th.plan);
        state.hint = { x: th.plan.x, tx: th.plan.tx, ty: th.plan.ty, trace: g.trace, ghost: g.ghost };
        toast(`${nameOf(state, side)}: ${describePlan(th.plan)}`, 2.1);
      } else { th.phase = 'aim'; th.t = 0; th.dur = 0.7; th.from = { x: state.aim.x, tx: state.aim.tx, ty: state.aim.ty }; }
    } else if (th.phase === 'aim' || th.phase === 'reveal') {
      const dur = th.phase === 'aim' ? th.dur : 0.5;
      const k = clamp(th.t / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
      const f = th.from, p = th.plan;
      state.aim.x = f.x + (p.x - f.x) * e;
      if (th.phase === 'aim') { state.aim.tx = f.tx + (p.tx - f.tx) * e; state.aim.ty = f.ty + (p.ty - f.ty) * e; state.showAim = true; }
      if (th.t >= th.dur) startStrike(th.p);
    }
  };

  // ---- hint ------------------------------------------------------------------------------------
  const requestHint = () => {
    const m = state.m;
    if (state.hintBusy || state.act || !state.humanTurn || m.over || state.pendingOver) return;
    state.hintBusy = true;
    hintPlanner = createPlanner(lying(), m.side, m.chalks, PROFILES[4], aiRng, { perfect: true, idx: m.idx, sides: m.sides });
  };
  const updateHint = () => {
    if (!hintPlanner) return;
    if (!hintPlanner.done) hintPlanner.step(40);
    if (hintPlanner.done) {
      const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.act || !state.humanTurn) return;
      const g = planGhost(r);
      state.hint = { x: r.x, tx: r.tx, ty: r.ty, trace: g.trace, ghost: g.ghost };
      state.aim.x = r.x; state.aim.tx = r.tx; state.aim.ty = r.ty; state.showAim = false; state.kb = true; state.guideTrace = null; state.ghost = null; guideKey = '';
      toast(`Hint: ${describePlan(r)}. Place the coin as shown and aim at the gold mark`, 5);
    }
  };

  // ---- the play scene --------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.fl = null; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };

  const humanStrike = () => startStrike({ x: state.aim.x, tx: state.aim.tx, ty: state.aim.ty, dx: wobble(handRng) * HAND.aim, dp: wobble(handRng) * HAND.pow });

  const updatePlay = (dt, input) => {
    const { m } = state;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch';
    const L = layoutOf(state);
    if (config.dev && keys.pressed.has('KeyK')) {
      m.chalks[0].fill(3); if (m.sides > 1) m.chalks[1] = [3, 3, 3, 3, 3, 2, 3, 2, 3];
      m.over = { win: 0, beds: beds(m), chalks: chalkTotals(m), rounds: m.round + 1 }; state.act = null; state.moving = null; state.queue = []; state.pendingOver = false; state.shown = m.chalks.map((c) => c.slice()); finishMatch(); state.scene = 'result'; state.ui.scroll = 0; return;
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
    if (m.over && state.endT >= 0 && !state.act && !state.pendingOver) {
      state.endT += dt;
      if (state.endT > 1.8 || (ptr.pressed && state.endT > 0.6)) { state.scene = 'result'; state.ui.scroll = 0; state.endT = -1; return; }
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
    } else if (state.humanTurn && !state.paused && !state.act && !m.over && !state.pendingOver) {
      if (ptr.pressed && !onButton) {
        const w = toWorld(L, ptr.x, ptr.y), r = L.rect;
        if (ptr.x >= r.x - 30 && ptr.x <= r.x + r.w + 30 && ptr.y >= r.y - 30 && ptr.y <= r.y + r.h + 30) {
          state.fl = { mode: w.y > START_Y - 30 ? 'place' : 'aim' };
          state.kb = false; state.hint = null;
        }
      }
      const fl = state.fl;
      if (fl) {
        if (ptr.down || ptr.released) {
          const w = toWorld(L, ptr.x, ptr.y);
          const ty = w.y - OFFSET_PX / L.s;
          if (fl.mode === 'place') {
            if (w.y > START_Y - 70) state.aim.x = startX(w.x);
            else { fl.mode = 'aim'; }
          }
          if (fl.mode === 'aim') {
            state.aim.tx = clamp(w.x, 0, TW); state.aim.ty = clamp(ty, AIM_MIN_Y, AIM_MAX_Y + 30);
            state.showAim = state.aim.ty <= AIM_MAX_Y;
            if (state.showAim) ghostFor({ x: state.aim.x, tx: state.aim.tx, ty: state.aim.ty });
            else { state.ghost = null; state.guideTrace = null; guideKey = ''; }
          }
        }
        if (ptr.released) {
          state.fl = null;
          if (fl.mode === 'aim' && state.showAim) humanStrike();
          else { state.showAim = false; state.ghost = null; state.guideTrace = null; guideKey = ''; }
        }
      }
      // keyboard
      const k = keys.down;
      let kbUsed = false;
      if (k.has('ArrowLeft')) { state.aim.x = startX(state.aim.x - KB_STEP); kbUsed = true; }
      if (k.has('ArrowRight')) { state.aim.x = startX(state.aim.x + KB_STEP); kbUsed = true; }
      if (k.has('KeyA')) { state.aim.tx = clamp(state.aim.tx - KB_STEP, 0, TW); kbUsed = true; }
      if (k.has('KeyD')) { state.aim.tx = clamp(state.aim.tx + KB_STEP, 0, TW); kbUsed = true; }
      if (k.has('KeyW') || k.has('ArrowUp')) { state.aim.ty = clamp(state.aim.ty - KB_STEP, AIM_MIN_Y, AIM_MAX_Y); kbUsed = true; }
      if (k.has('KeyS') || k.has('ArrowDown')) { state.aim.ty = clamp(state.aim.ty + KB_STEP, AIM_MIN_Y, AIM_MAX_Y); kbUsed = true; }
      if (kbUsed) { state.kb = true; state.showAim = true; if (state.hint) state.hint = null; }
      if (state.kb && !state.fl && state.showAim) ghostFor({ x: state.aim.x, tx: state.aim.tx, ty: state.aim.ty });
      if (keys.pressed.has('KeyH')) requestHint();
      if (keys.pressed.has('Space') || keys.pressed.has('Enter')) humanStrike();
    } else if (state.fl && !state.humanTurn) state.fl = null;
    if (state.paused) return;
    updateHint();
    updateAI(dt);
    if (state.act) updateAct(dt);
    updateQueue();
    clackT = Math.max(0, clackT - dt);
    for (const row of state.pulse) for (let i = 0; i < 9; i++) if (row[i] > 0) row[i] = Math.max(0, row[i] - dt * 1.6);
    for (const f of state.falls) f.t += dt;
    state.falls = state.falls.filter((f) => f.t < f.max);
    for (const d of state.dead) d.t += dt;
    state.dead = state.dead.filter((d) => d.t < d.max);
    if (state.heel) { state.heel.t += dt; if (state.heel.t > 0.3) state.heel = null; }
    stepParts(state.parts, dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
  };

  const leaveMatch = () => {
    state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.think = null; planner = null; hintPlanner = null;
    state.hintBusy = false; state.fl = null; state.act = null; state.moving = null; state.pass = null; state.falls = []; state.dead = []; state.queue = []; state.pendingOver = false;
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
    else if (id === 'len5') s.target = 5;
    else if (id === 'len9') s.target = 9;
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, target: s.target });
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
      if (state.restoreBusy || monetization.owns('unlock_game')) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => {
        state.restoreBusy = false;
        state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.';
      }).catch(() => { state.restoreBusy = false; state.restoreMsg = 'The store is not available right now. Please try again later.'; });
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

  // ---- store screenshots: ?shot=1&seed=N shows one fixed, scripted screen (the kit's monkey input is ignored) ---------------------
  let shotMode = false;
  try { shotMode = /[?&]shot=/.test(globalThis.location.search); } catch { shotMode = false; }
  const applyPreset = () => {
    const n = Number(config.seed) || 1;
    const run = (list, cfg = {}) => {
      startMatch({ mode: 'ai', opp: 1, target: 9, first: 0, ...cfg });
      for (const [bed, x, tx] of list) {
        startStrike({ x, tx, ty: bedCenterY(bed) });
        for (let i = 0; i < 4000 && state.act; i++) updateAct(STEP * 4);
        state.t += 3; updateQueue();
        state.parts = []; state.pops = []; state.falls = []; state.dead = []; state.toastT = 0;
      }
    };
    const aimAt = (x, tx, bed) => { state.aim.x = x; state.aim.tx = tx; state.aim.ty = bedCenterY(bed); state.showAim = true; ghostFor({ x, tx, ty: state.aim.ty }); };
    if (n === 9) { run([[2, 60, 60], [4, 150, 150], [5, 100, 100], [6, 70, 150]]); aimAt(108, 100, 6); return; }
    if (n === 14) {
      run([[1, 50, 50], [3, 160, 160], [4, 60, 60], [4, 170, 170], [6, 110, 110], [5, 150, 150], [7, 60, 60], [2, 100, 100], [8, 150, 150], [6, 70, 70],
        [3, 60, 60], [5, 140, 140], [7, 100, 100]], { opp: 2 });
      state.toastT = 0; state.hint = { x: 108, tx: 100, ty: bedCenterY(7), ...planGhost({ x: 108, tx: 100, ty: bedCenterY(7) }) };
      state.aim.x = 108; state.aim.tx = 100; state.aim.ty = bedCenterY(7); state.humanTurn = true; return;
    }
    if (n === 21) {
      run([[2, 60, 60], [4, 150, 150], [5, 100, 100], [6, 70, 150]], { opp: 0 });
      const m = state.m; m.chalks[0] = [3, 3, 3, 3, 3, 3, 3, 3, 3]; m.chalks[1] = [3, 3, 2, 3, 1, 3, 0, 2, 3];
      m.over = { win: 0, beds: beds(m), chalks: chalkTotals(m), rounds: 6 }; state.act = null; state.moving = null; state.queue = []; state.pendingOver = false;
      state.shown = m.chalks.map((c) => c.slice()); state.scene = 'result'; state.ui.scroll = 0; return;
    }
    if (n === 30 || n === 31 || n === 32) { state.scene = ['rules', 'about', 'howto'][n - 30]; state.back = 'title'; state.refScroll = n === 30 ? 700 : 0; return; }
    state.scene = 'title';
  };

  startAttract();
  resetMenus();
  if (shotMode) applyPreset();

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused || !!state.pass,
    update(dt, input) {
      if (shotMode) { syncSize(); return; }
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'setup', 'settings', 'result', 'demolimit', 'records'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, Math.max(0, flowMeta().h ?? 0));
        });
      }
      syncSize();
      state.owned = monetization.owns('unlock_game');
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
    lockupZone: () => lockupZone(),
  };
}
void R; void MIN_PULL;
