// Bolas Criollas: state and flow. Physics lives in sim.js, rules in match.js, opponents in ai.js, drawing in view.js / menus.js.
// This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto / about / rules, demolimit.
// A throw: put the aim ring where the ball should land (drag on the cancha strip or on the loupe), pick Roll, Lob or Shot, then
// hold SWING and let go while the needle is in the green. The release decides how close to the aim ring the ball really lands.
import { createRng } from '../kit/rng.js';
import {
  COURT, STYLES, COURT_IDS, COURTS, R_BALL, createWorld, makeSurface, newBall, launch, stepWorld, previewThrow, releaseError, theMingo, clamp,
} from './sim.js';
import { newMatch, beginEnd, judgeMingo, whoNext, firstThrower, scoreEnd, applyEnd } from './match.js';
import { createPlanner, executePlan, planMingo } from './ai.js';
import { PROFILES } from './opponents.js';
import { inRect, TEXT_SCALES, THINK_STEPS, layoutFor } from './layout.js';
import { renderPlay, stripView, loupeView } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, hitScreen, flowMeta, pageCount, REF, ensureLayout, flowRects, lockupZone } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';
import { v3 } from './v3.js';

// `meta.width/height` are updated live by the kit on every resize (fluid mode: the short side is always 720 units).
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_END_CAP = 3;
const SWEET = { roll: 0.12, lob: 0.095, shot: 0.075 };
const SWING_SPEED = { roll: 0.72, lob: 0.82, shot: 0.98 };   // sweeps of the bar per second

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const lay = () => layoutFor(meta.width, meta.height);
  const fx = rng.fork();
  const aiRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, calm: false, textIdx: 0, thinkIdx: 1, slow: false },
    record: { wins: [0, 0, 0, 0, 0], played: 0, streak: 0, best: 0, demoEnds: 0, thrown: 0, perfect: 0 },
    setup: { mode: 'ai', opp: 0, court: 'clay', target: 12 }, setupMsg: '', restoreMsg: '', restoreBusy: false, owned: false,
    ui: { scroll: 0, drag: null }, refScroll: 0,
    att: null, w: null, m: null, labels: [{ name: 'You' }, { name: 'Rival' }],
    sel: 0, guide: null, preview: null, swing: null, lastRel: null, hintBusy: false,
    parts: [], toast: '', toastT: 0, humanTurn: false, restT: 0, think: null, explain: null, pop: null, loupe: { uc: 10, half: 2.4 }, thinkSecs: 5,
    loaded: false, lk: '',
  };
  let planner = null, hintPlanner = null, previewKey = '', aiPlan = null;
  const styleId = () => STYLES[state.sel].id;

  // ---- persistence ---------------------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    while (state.record.wins.length < PROFILES.length) state.record.wins.push(0);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ---------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    whoosh: () => tone({ freq: 420, to: 150, dur: 0.24, type: 'sawtooth', vol: 0.035 }),
    thud: (v) => tone({ freq: 95, to: 50, dur: 0.14, type: 'sine', vol: Math.min(0.24, 0.05 + v / 45) }),
    clack: (v) => {
      const q = Math.min(1, v / 7);
      tone({ freq: 1500 + fx.next() * 400, to: 900, dur: 0.06, type: 'square', vol: 0.02 + 0.05 * q });
      tone({ freq: 520 + fx.next() * 90, to: 330, dur: 0.14, type: 'triangle', vol: 0.05 + 0.11 * q });
    },
    knock: (v) => tone({ freq: 170 + fx.next() * 30, to: 100, dur: 0.1, type: 'triangle', vol: Math.min(0.15, 0.04 + v / 40) }),
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 210, to: 130, dur: 0.22, type: 'sawtooth', vol: 0.06 }),
    good: () => tone({ freq: 660, to: 990, dur: 0.16, type: 'triangle', vol: 0.09 }),
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.12 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- particles -----------------------------------------------------------------------------------------------------------
  const MAX_PARTS = 90;
  const dust = (parts, x, y, n, size = 1, col) => {
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) parts.push({ kind: 0, x, y, z: 0.05, vx: (fx.next() - 0.5) * 1.4, vy: (fx.next() - 0.5) * 0.9, vz: 0.3 + fx.next() * 0.7, t: 0, max: 0.5 + fx.next() * 0.5, size, col });
  };
  const sparks = (parts, x, y, z, n) => {
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) parts.push({ kind: 1, x, y, z: z + 0.1, vx: (fx.next() - 0.5) * 4, vy: (fx.next() - 0.5) * 2.5, vz: 1 + fx.next() * 2.5, t: 0, max: 0.2 + fx.next() * 0.2, size: 1.4 });
  };
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= 5 * dt; q.vx *= 0.97; q.vy *= 0.97; if (q.z < 0) { q.z = 0; q.vz = 0; } }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };

  // ---- the attract court behind the menus ----------------------------------------------------------------------------------
  const startAttract = () => {
    const w = createWorld(makeSurface('clay', fx.fork()));
    const k = newBall(0, -1, true); k.x = 10.2; k.y = 0.15; w.balls.push(k);
    [[0, 9.7, -0.5], [1, 10.8, 0.5]].forEach(([side, x, y], i) => { const b = newBall(1 + i, side); b.x = x; b.y = y; w.balls.push(b); });
    state.att = { w, parts: [], t: 0, n: 3, wait: 1.8 };
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    a.wait -= dt;
    if (a.wait <= 0 && a.w.settled) {
      a.wait = 4.4;
      if (a.w.balls.length > 6) a.w.balls = a.w.balls.filter((b) => b.k || b.id > a.n - 4);
      const b = newBall(a.n, a.n % 2); a.n++;
      a.w.balls.push(b);
      const k = theMingo(a.w), style = a.n % 3 === 0 ? 'lob' : 'roll';
      if (!k) { startAttract(); return; }
      launch(a.w, b, { style, tx: k.x - 0.35 + (fx.next() - 0.5) * 0.6, ty: k.y + (fx.next() - 0.5) * 1.1 });
    }
    if (!a.w.settled) {
      const ev = [];
      stepWorld(a.w, dt, ev);
      for (const e of ev) { if (e.t === 'land' && e.v > 1.5) dust(a.parts, e.x, e.y, 3); else if (e.t === 'hit') sparks(a.parts, e.x, e.y, 0.1, 4); }
      a.w.balls = a.w.balls.filter((b) => !(b.st === 'out' && b.fade > 1.1));
    }
    stepParts(a.parts, dt);
  };

  // ---- match flow ----------------------------------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  // who throws: a profile (computer) or null (a person)
  const playerOf = (side) => {
    const c = state.m.cfg;
    if (c.mode === 'watch') return side === 0 ? PROFILES[c.watchA] : PROFILES[c.opp];
    if (c.mode === 'two') return null;
    return side === 0 ? null : PROFILES[c.opp];
  };
  const isAI = (side) => playerOf(side) !== null;
  const makeLabels = (c) => {
    if (c.mode === 'two') return [{ name: 'Player 1' }, { name: 'Player 2' }];
    if (c.mode === 'watch') return [{ name: PROFILES[c.watchA].name }, { name: PROFILES[c.opp].name }];
    return [{ name: 'You' }, { name: PROFILES[c.opp].name }];
  };
  const defaultGuide = () => {
    const m = state.m, k = theMingo(state.w);
    const mg = m.phase === 'mingo' || !k;
    state.guide = mg ? { style: 'roll', tx: 10.5, ty: 0 } : { style: styleId(), tx: clamp(k.x - 0.25, COURT.minThrow, COURT.maxThrow), ty: clamp(k.y, -1.2, 1.2) };
    previewKey = '';
  };
  const resetTurnState = () => { state.swing = null; state.think = null; planner = null; aiPlan = null; state.explain = null; state.guide = null; state.preview = null; };

  // The bar shows the green before the swing starts, so the player can plan the release; the needle only moves once SWING is held.
  const idleSwing = () => {
    const style = state.m.phase === 'mingo' ? 'roll' : styleId();
    state.swing = { live: false, t: 0, centre: 0.4 + fx.next() * 0.3, half: sweetHalf(style), needle: 0, style, speed: SWING_SPEED[style] * (state.settings.slow ? 0.62 : 1) };
  };
  const startMingoPhase = () => {
    const m = state.m;
    m.phase = 'mingo';
    resetTurnState();
    state.humanTurn = !isAI(m.turn);
    state.sel = 0;
    if (state.humanTurn) {
      defaultGuide(); idleSwing();
      if ((state.record.thrown | 0) < 3) toast('Toss the mingo: aim into the teal zone, hold SWING, let go in the green', 4.5);
      else toast(mode() === 'two' ? `${state.labels[m.turn].name}: toss the mingo` : 'Your toss: put the mingo in the teal zone', 2.4);
    }
  };
  const startAim = () => {
    const m = state.m;
    m.phase = 'aim';
    resetTurnState();
    state.humanTurn = !isAI(m.turn);
    if (state.humanTurn) {
      defaultGuide(); idleSwing();
      if (m.cfg.mode === 'two') toast(`${state.labels[m.turn].name}: your throw`, 1.6);
      else if ((state.record.thrown | 0) < 3) toast('Your throw: drag the aim ring, choose Roll / Lob / Shot, hold SWING', 4);
    }
  };
  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoEnds >= DEMO_END_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const surf = makeSurface(cfg.court, cfg.court === 'daily' ? createRng((config.day | 0) * 7919 + 13) : fx.fork());
    state.w = createWorld(surf);
    state.m = newMatch({ target: 12, mode: 'ai', opp: 0, court: cfg.court, lead: aiRng.int(2), watchA: 2, ...cfg });
    state.labels = makeLabels(state.m.cfg);
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.parts = []; state.pop = null; state.lastRel = null; state.hintBusy = false; hintPlanner = null;
    state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
    beginEnd(state.m, state.w);
    startMingoPhase();
  };
  const startWatch = () => {
    const picks = [1, 2, 3, 4];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, court: COURT_IDS[aiRng.int(3)], target: 6 });
  };

  const handleEvents = (ev) => {
    for (const e of ev) {
      if (e.t === 'land') {
        if (e.v > 1.0) dust(state.parts, e.x, e.y, 3 + Math.floor(e.v * 0.6), 1.2, e.loose ? '170,110,70' : undefined);
        sfx.thud(e.v);
      } else if (e.t === 'hit') {
        sparks(state.parts, e.x, e.y, e.z ?? 0.1, Math.min(9, 2 + Math.floor(e.v * 1.1)));
        sfx.clack(e.v);
      } else if (e.t === 'board') { sfx.knock(e.v); dust(state.parts, e.x, e.y, 2, 1, '200,160,110'); }
      else if (e.t === 'out') { if (!e.k) toast(e.why === 'end' ? 'Past the dead line: that ball is out' : 'Out of the cancha: that ball is out', 2.2); sfx.no(); }
    }
  };

  // Release a ball. p = {style, tx, ty} (already including any release error)
  const throwBall = (side, p, mingo) => {
    const { m, w } = state;
    const b = mingo ? newBall(0, -1, true) : newBall(m.nextId++, side, false);
    if (mingo) w.balls = w.balls.filter((q) => !q.k);
    w.balls.push(b);
    launch(w, b, p);
    if (!mingo) { m.hand[side]--; m.thrown++; m.last = side; }
    if (!isAI(side)) state.record.thrown = (state.record.thrown | 0) + 1;
    m.phase = mingo ? 'mingo-fly' : 'fly';
    state.humanTurn = false; state.guide = null; state.preview = null; state.swing = null; state.think = null; state.explain = null;
    planner = null; hintPlanner = null; state.hintBusy = false; state.restT = 0; aiPlan = null;
    sfx.whoosh();
  };

  const finishEnd = (res) => {
    const m = state.m;
    m.phase = 'score';
    m.endInfo = { ...res, t: 0 };
    state.humanTurn = false; state.guide = null; state.preview = null;
    if (res.pts > 0) { state.pop = { text: `+${res.pts}`, t: 0, team: res.team }; for (let i = 0; i < Math.min(res.pts, 4); i++) sfx.chime(i); } else sfx.no();
    toast(res.text || `${state.labels[res.team].name} ${state.labels[res.team].name === 'You' ? 'score' : 'scores'} ${res.pts}`, 3.6);
  };

  const onSettled = () => {
    const { m, w } = state;
    const mingoPhase = m.phase === 'mingo-fly';
    w.balls = w.balls.filter((b) => !(b.st === 'out' && !b.k));
    if (mingoPhase) {
      const r = judgeMingo(m, w);
      if (r.ok) { m.turn = firstThrower(m); startAim(); return; }
      m.mingoTries++;
      w.balls = w.balls.filter((b) => !b.k);
      if (m.mingoTries >= 2) {
        const k = newBall(0, -1, true); k.x = 10.5; k.y = 0; w.balls.push(k);
        toast('Mingo placed in the middle of the zone', 3);
        m.turn = firstThrower(m); startAim(); return;
      }
      toast(r.msg, 3.2); sfx.no();
      m.turn = 1 - m.turn; startMingoPhase();
      return;
    }
    const k = theMingo(w);
    if (!k) {
      toast('The mingo left the cancha: this end is played again', 3.4);
      beginEnd(m, w); startMingoPhase(); return;
    }
    const n = whoNext(m);
    if (n === null) { finishEnd(scoreEnd(m, w)); return; }
    m.turn = n; startAim();
  };

  const afterEnd = () => {
    const m = state.m;
    applyEnd(m, m.endInfo);
    if (m.cfg.mode !== 'watch') state.record.demoEnds++;
    if (m.over) {
      state.scene = 'result'; state.ui.scroll = 0;
      const win = m.over.win === 0;
      if (m.cfg.mode === 'ai') {
        state.record.played++;
        if (win) { state.record.wins[m.cfg.opp]++; state.record.streak++; state.record.best = Math.max(state.record.best, state.record.streak); } else state.record.streak = 0;
      }
      if (win && m.cfg.mode !== 'watch' && m.cfg.mode !== 'two') sfx.win();
      save();
    } else if (state.demo && m.cfg.mode !== 'watch' && state.record.demoEnds >= DEMO_END_CAP) { save(); state.scene = 'demolimit'; state.ui.scroll = 0; }
    else { save(); beginEnd(m, state.w); startMingoPhase(); }
  };

  // ---- aiming ---------------------------------------------------------------------------------------------------------------
  const aimLimits = () => (state.m.phase === 'mingo' ? { lo: 4, hi: 15 } : { lo: COURT.minThrow, hi: COURT.maxThrow });
  const setAim = (u, v) => {
    const { lo, hi } = aimLimits();
    state.guide = { style: state.m.phase === 'mingo' ? 'roll' : styleId(), tx: clamp(u, lo, hi), ty: clamp(v, -COURT.half + 0.25, COURT.half - 0.25) };
  };
  const refreshPreview = () => {
    const g = state.guide;
    if (!g || !state.w) { state.preview = null; return; }
    const key = `${g.style}|${Math.round(g.tx * 40)}|${Math.round(g.ty * 40)}|${state.w.balls.length}|${state.m.phase}`;
    if (key === previewKey) return;
    previewKey = key;
    const mg = state.m.phase === 'mingo';
    const pv = previewThrow(state.w, { style: g.style, tx: g.tx, ty: g.ty, side: state.m.turn }, { every: 3, mingo: mg, alone: mg });
    state.preview = { path: state.settings.calm ? pv.path : [], rest: pv.rest, land: pv.land };
  };

  const sweetHalf = (style) => SWEET[style] * (state.settings.calm ? 1.5 : 1);
  const beginSwing = () => {
    if (!state.swing || state.swing.live) idleSwing();
    state.swing.live = true; state.swing.t = 0; state.swing.needle = 0;
    sfx.tick();
  };
  const needleAt = (t, speed) => { const p = (t * speed) % 2; return p < 1 ? p : 2 - p; };
  const releaseSwing = () => {
    const sw = state.swing, m = state.m, g = state.guide;
    if (!sw || !g) { state.swing = null; return; }
    const dev = sw.needle - sw.centre;
    const err = releaseError(dev, sw.half, g.style, fx.next() * 2 - 1, fx.next() * 2 - 1);
    const ang = Math.atan2(g.ty, g.tx), ca = Math.cos(ang), sa = Math.sin(ang);
    const p = {
      style: g.style, tx: clamp(g.tx + ca * err.along - sa * err.across, 1, COURT.maxThrow + 0.5),
      ty: clamp(g.ty + sa * err.along + ca * err.across, -COURT.half + 0.12, COURT.half - 0.12),
    };
    const word = err.e <= 0.35 ? 'Perfect release!' : err.e <= 1 ? 'Good release' : dev < 0 ? 'Too early: it will land short' : 'Too late: it will carry long';
    state.lastRel = { label: word, e: err.e, t: 0 };
    if (err.e <= 0.35) { state.record.perfect = (state.record.perfect | 0) + 1; sfx.good(); }
    throwBall(m.turn, p, m.phase === 'mingo');
  };

  const describePlan = (plan) => {
    const s = STYLES.find((q) => q.id === plan.params.style).name;
    return `${s}: ${plan.kind === 'knock' ? 'knock a rival ball away' : plan.kind === 'mingo' ? 'drive the mingo' : 'place it beside the mingo'}`;
  };

  // ---- computer turn --------------------------------------------------------------------------------------------------------
  const updateAI = (dt) => {
    const { m } = state;
    if (!(m.phase === 'aim' || m.phase === 'mingo') || !isAI(m.turn) || state.paused) return;
    const prof = playerOf(m.turn), watch = mode() === 'watch';
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur, phase: 'think' };
      if (m.phase === 'mingo') aiPlan = { params: planMingo(aiRng, prof), mingo: true };
      else planner = createPlanner(state.w, m, m.turn, prof, aiRng, {});
    }
    const th = state.think;
    th.t += dt;
    if (planner && !planner.done) {
      planner.step(10);
      state.explain = { head: `${state.labels[m.turn].name} is thinking…`, lines: [`Tried ${planner.sims} throws on a copy of the cancha`, 'Placing beside the mingo, driving it, knocking rivals away'] };
      if (planner.done) { aiPlan = planner.result; planner = null; }
    }
    if (th.phase === 'think' && th.t >= th.dur && aiPlan) {
      if (watch && !aiPlan.mingo) {
        th.phase = 'reveal'; th.t = 0; th.dur = 2;
        const q = aiPlan.params;
        state.sel = STYLES.findIndex((s) => s.id === q.style);
        state.guide = { style: q.style, tx: q.tx, ty: q.ty }; previewKey = '';
        toast(`${state.labels[m.turn].name}: ${describePlan(aiPlan)}`, 2.2);
        state.explain = { head: `${state.labels[m.turn].name} chooses: ${describePlan(aiPlan)}`, lines: aiPlan.alts.map((a, i) => `${i + 1}. ${STYLES.find((s) => s.id === a.params.style).name} to ${a.params.tx.toFixed(1)} m: ${a.kind === 'knock' ? 'knock away' : a.kind === 'mingo' ? 'drive the mingo' : 'place'}  (${a.score >= 0 ? '+' : ''}${a.score.toFixed(1)})`) };
      } else beginAISwing(th);
    } else if (th.phase === 'reveal' && th.t >= th.dur) beginAISwing(th);
    else if (th.phase === 'swing') {
      state.swing.t = th.t; state.swing.needle = needleAt(th.t, state.swing.speed);
      if (th.t >= th.dur) { const p = th.p, mg = m.phase === 'mingo'; throwBall(m.turn, p, mg); }
    }
  };
  const beginAISwing = (th) => {
    const m = state.m, prof = playerOf(m.turn);
    const p = aiPlan.mingo ? aiPlan.params : executePlan(aiPlan, prof, aiRng);
    const style = p.style;
    th.p = p; th.phase = 'swing'; th.t = 0; th.dur = 0.62;
    state.sel = Math.max(0, STYLES.findIndex((s) => s.id === style));
    const g0 = aiPlan.mingo ? p : aiPlan.params;
    state.guide = { style, tx: g0.tx, ty: g0.ty }; previewKey = '';
    state.swing = { live: true, t: 0, centre: 0.55, half: sweetHalf(style), needle: 0, style, speed: 0.9 / th.dur };
    if (mode() !== 'watch') state.explain = null;
  };

  // ---- the play scene -------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };

  const requestHint = () => {
    const m = state.m;
    if (state.hintBusy || m.phase !== 'aim') return;
    state.hintBusy = true;
    hintPlanner = createPlanner(state.w, m, m.turn, PROFILES[PROFILES.length - 1], aiRng, { perfect: true });
    toast('Looking for a good throw…', 1.2);
  };
  const updateHint = () => {
    if (!hintPlanner) return;
    hintPlanner.step(12);
    if (hintPlanner.done) {
      const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.m.phase !== 'aim' || !state.humanTurn) return;
      state.sel = STYLES.findIndex((s) => s.id === r.params.style);
      state.guide = { style: r.params.style, tx: r.params.tx, ty: r.params.ty }; previewKey = '';
      toast(`Hint: ${describePlan(r)}`, 3.4);
    }
  };

  const frameLoupe = (dt) => {
    const { w, m } = state, k = theMingo(w), L = state.loupe;
    const minHalf = lay().play.loupeHalf;
    let tu = L.uc, th = minHalf;
    const fly = m.phase === 'fly' || m.phase === 'mingo-fly';
    let mover = null, bv = 0.5;
    if (fly) for (const b of w.balls) { if (b.st === 'out' || b.k) continue; const v = Math.hypot(b.vx, b.vy); if (v > bv) { bv = v; mover = b; } }
    if (k) {
      tu = k.x; th = minHalf;
      const q = mover ? mover.x : state.guide ? state.guide.tx : null;
      if (q !== null && Math.abs(q - k.x) > 1.2) { tu = (k.x + q) / 2; th = clamp(Math.abs(q - k.x) / 2 + 1.3, minHalf, 8); }
    } else if (state.guide) { tu = state.guide.tx; th = Math.max(minHalf, 3); }
    const kk = Math.min(1, dt * 4);
    L.uc += (tu - L.uc) * kk; L.half += (th - L.half) * kk;
  };

  const updatePlay = (dt, input) => {
    const { m } = state;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch', L = lay(), P = L.play;
    if (state.lk !== L.key) { state.lk = L.key; }
    meta.previewBadge = { x: P.loupe.x + P.loupe.w - 12, y: P.loupe.y + 10, align: 'right' };
    if (config.dev && keys.pressed.has('KeyK')) { m.scores[0] = m.cfg.target; m.over = { win: 0, shutout: m.scores[1] === 0 }; m.phase = 'over'; state.scene = 'result'; return; }
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
    if (watch) {
      if (ptr.pressed) {
        if (inRect(P.demo.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(P.demo.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); }
        else if (inRect(P.demo.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); }
        else if (inRect(P.demo.exit, ptr.x, ptr.y)) { leaveMatch(); return; }
      }
    } else if (ptr.pressed && inRect(P.menu, ptr.x, ptr.y)) { openPause(); return; }

    const aimPhase = m.phase === 'aim' || m.phase === 'mingo';
    if (state.humanTurn && !state.paused && aimPhase) {
      const mg = m.phase === 'mingo', sw = state.swing && state.swing.live ? state.swing : null;
      if (ptr.pressed && !sw) {
        let hit = false;
        P.styles.forEach((r, i) => { if (inRect(r, ptr.x, ptr.y)) { hit = true; if (!(mg && i !== 0)) { state.sel = i; if (state.guide) state.guide = { ...state.guide, style: mg ? 'roll' : STYLES[i].id }; if (state.swing && !state.swing.live) { state.swing.half = sweetHalf(mg ? 'roll' : STYLES[i].id); state.swing.speed = SWING_SPEED[mg ? 'roll' : STYLES[i].id] * (state.settings.slow ? 0.62 : 1); } sfx.tick(); } } });
        if (inRect(P.hint, ptr.x, ptr.y)) { hit = true; if (!mg) { requestHint(); sfx.tick(); } }
        if (inRect(P.swing, ptr.x, ptr.y)) { hit = true; if (state.guide) beginSwing(); else toast('Touch the cancha to place the aim ring first', 1.8); state.swingHold = 'ptr'; }
        if (!hit) {
          const sv = stripView(P.strip), lv = loupeView(P.loupe, state.loupe.uc, state.loupe.half);
          if (inRect(P.loupe, ptr.x, ptr.y)) { const q = lv.inv(ptr.x, ptr.y + lv.rad(R_BALL, 0) * 0.9); setAim(q.u, q.v); state.aimDrag = 'loupe'; }
          else if (inRect(P.strip, ptr.x, ptr.y)) { const q = sv.inv(ptr.x, ptr.y + 8); setAim(q.u, q.v); state.aimDrag = 'strip'; }
        }
      }
      if (state.aimDrag && ptr.down && !sw) {
        const src = state.aimDrag === 'loupe' ? loupeView(P.loupe, state.loupe.uc, state.loupe.half) : stripView(P.strip);
        const q = src.inv(ptr.x, ptr.y + (state.aimDrag === 'loupe' ? src.rad(R_BALL, 0) * 0.9 : 8));
        setAim(q.u, q.v);
      }
      if (!ptr.down) state.aimDrag = null;
      // keyboard
      const g = state.guide;
      if (g && !sw) {
        let touched = false;
        if (keys.down.has('ArrowLeft')) { setAim(g.tx - 0.06, g.ty); touched = true; }
        if (keys.down.has('ArrowRight')) { setAim(g.tx + 0.06, g.ty); touched = true; }
        if (keys.down.has('ArrowUp')) { setAim(g.tx, g.ty - 0.03); touched = true; }
        if (keys.down.has('ArrowDown')) { setAim(g.tx, g.ty + 0.03); touched = true; }
        for (let i = 0; i < 3; i++) if (keys.pressed.has(`Digit${i + 1}`) && !(mg && i !== 0)) { state.sel = i; state.guide = { ...state.guide, style: STYLES[i].id }; if (state.swing && !state.swing.live) { state.swing.half = sweetHalf(STYLES[i].id); state.swing.speed = SWING_SPEED[STYLES[i].id] * (state.settings.slow ? 0.62 : 1); } touched = true; }
        if (keys.pressed.has('KeyH') && !mg) requestHint();
        if (keys.pressed.has('Space')) { beginSwing(); state.swingHold = 'key'; }
        void touched;
      }
      // swing in progress: the needle sweeps while the thumb (or Space) is held; letting go throws
      if (state.swing && state.swing.live && state.humanTurn) {
        const s2 = state.swing;
        s2.t += dt; s2.needle = needleAt(s2.t, s2.speed);
        const held = state.swingHold === 'key' ? keys.down.has('Space') : ptr.down;
        if (!held) { state.swingHold = null; releaseSwing(); }
      }
    } else if (!state.humanTurn) { state.aimDrag = null; }
    if (state.guide && state.humanTurn) refreshPreview();
    else if (state.guide && watch) refreshPreview();
    if (state.paused) return;
    updateHint();
    updateAI(dt);
    frameLoupe(dt);
    if (m.phase === 'fly' || m.phase === 'mingo-fly') {
      const ff = ptr.down && !state.humanTurn ? 3 : 1;
      for (let i = 0; i < ff; i++) {
        const ev = [];
        stepWorld(state.w, dt, ev);
        if (ev.length) handleEvents(ev);
        state.w.balls = state.w.balls.filter((b) => !(b.st === 'out' && b.fade > 1.1 && !b.k));
        if (state.w.settled) { state.restT += dt; if (state.restT > 0.45) { onSettled(); break; } } else state.restT = 0;
      }
    }
    stepParts(state.parts, dt);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.lastRel) state.lastRel.t += dt;
    if (state.pop) { state.pop.t += dt; if (state.pop.t > 1.8) state.pop = null; }
    if (m.phase === 'score') {
      m.endInfo.t += dt;
      const auto = watch && m.endInfo.t > 4.5;
      if ((ptr.pressed && m.endInfo.t > 0.9) || auto || (keys.pressed.has('Space') && m.endInfo.t > 0.9)) afterEnd();
    }
  };

  const leaveMatch = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; resetTurnState(); hintPlanner = null; state.hintBusy = false; state.aimDrag = null; state.swingHold = null; };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'p-calm') { state.settings.calm = !state.settings.calm; previewKey = ''; save(); }
    else if (id === 'quit') leaveMatch();
  }

  // ---- menus ----------------------------------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.cols.length) state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, mt.max);
  }
  const openSetup = (md) => { state.setup.mode = md; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; };
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'play') openSetup('ai');
    else if (id === 'two') openSetup('two');
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id.startsWith('crt')) { const c = id.slice(3); if (state.demo && c !== 'clay') { state.setupMsg = 'That court is in the full game.'; return; } s.court = c; state.setupMsg = ''; }
    else if (id === 'len12') s.target = 12;
    else if (id === 'len6') s.target = 6;
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, court: s.court, target: s.target });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-calm') { st.calm = !st.calm; previewKey = ''; }
    else if (id === 'set-slow') st.slow = !st.slow;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') { st.thinkIdx = Math.max(0, st.thinkIdx - 1); state.thinkSecs = THINK_STEPS[st.thinkIdx]; }
    else if (id === 'think-inc') { st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1); state.thinkSecs = THINK_STEPS[st.thinkIdx]; }
    else if (id === 'restore') {
      if (state.restoreBusy) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.())
        .then(() => { state.owned = !!monetization.owns('unlock_game'); state.restoreMsg = state.owned ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; })
        .catch(() => { state.restoreMsg = 'The store is not available right now. Please try again.'; })
        .finally(() => { state.restoreBusy = false; });
    }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.m.cfg;
    if (id === 'again') startMatch({ ...cfg, lead: aiRng.int(2) });
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
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };

  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('KeyO') && state.setup.mode !== 'two') state.setup.opp = (state.setup.opp + 1) % (state.demo ? 2 : PROFILES.length);
    if (k.pressed.has('KeyC') && !state.demo) state.setup.court = COURT_IDS[(COURT_IDS.indexOf(state.setup.court) + 1) % COURT_IDS.length];
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    const pins = lay().pins;
    if (ptr.pressed && (inRect(pins.start, ptr.x, ptr.y) || inRect(pins.back, ptr.x, ptr.y))) { handleSetup(inRect(pins.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  let refDrag = null;
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.refScroll = 0; };
    const ref = lay().ref, set = (v) => { state.refScroll = clamp(v, 0, REF.max); };
    if (ptr.pressed) {
      if (inRect(ref.next, ptr.x, ptr.y) || inRect(ref.back, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(ref.dec, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.refScroll = 0; save(); }
      else if (inRect(ref.inc, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.refScroll = 0; save(); }
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
  state.owned = !!monetization.owns?.('unlock_game');
  monetization.onChange?.(() => { state.owned = !!monetization.owns('unlock_game'); });

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused,
    update(dt, input) {
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play') meta.previewBadge = null;
      if (state.att && state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx, view) {
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height);
      if (v3.on) ctx.clearRect(0, 0, L.w, L.h);   // the transparent canvas sits over the 3D scene: erase last frame first
      switch (state.scene) {
        case 'title': renderTitle(ctx, state, L); break;
        case 'setup': renderSetup(ctx, state, L); break;
        case 'settings': renderSettings(ctx, state, L); break;
        case 'result': renderResult(ctx, state, L); break;
        case 'demolimit': renderDemoLimit(ctx, state, L); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play', L); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About', L); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules', L); break;
        case 'play':
          if (state.m) renderPlay(ctx, state, L);
          if (state.pauseMenu) renderPause(ctx, state, L);
          break;
        default: break;
      }
    },
    wheel(dy) { if (['about', 'howto', 'rules'].includes(state.scene)) { state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max); return; } if (['title', 'setup', 'settings', 'result', 'demolimit'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, flowMeta().max); },
    getState: () => state,
    debug: () => ({ lockup: lockupZone(), layout: lay(), flow: flowRects(state.ui.scroll), flowMax: flowMeta().max, pages: pageCount() }),
  };
}
