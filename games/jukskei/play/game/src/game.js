// Jukskei: state and flow. Physics lives in sim.js, rules in match.js, drawing in view.js and menus.js, the rivals in ai.js.
// This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, ladder, howto/about/rules, demolimit.
// Throwing: press the sand to put the gold ring where the pin should first land, choose Lob / Skim / Whirl, press Throw, then
// press Release when the marker is in the green. The game works out the heading and speed; the timing sets how steady the arm is.
import {
  createWorld, makePitch, newPin, launch, stepWorld, solveThrow, previewThrow, setWind, clamp, STEPS_PER_TICK, LANE_HALF, PITCH_IDS,
} from './sim.js';
import { newMatch, beginRound, driftWind, whoNext, judgeThrow, scoreRound, applyRound } from './match.js';
import { createPlanner, executePlan, planLabel, gauss } from './ai.js';
import { PROFILES, HUMAN, LADDER } from './opponents.js';
import { inRect, TEXT_SCALES, THINK_STEPS, layoutFor } from './layout.js';
import { fitSpan, projector } from './cam.js';
import { renderPlay, viewRect, splitNow, loupeCam } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderLadder, hitScreen, flowMeta, REF, ensureLayout, flowRects, lockupZone } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';
import { GL } from './glbridge.js';

// `meta.width/height` are updated live by the kit on every resize (fluid mode: the short side is always 720 units).
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_ROUND_CAP = 2;
const FINGER_OFFSET = 58;       // the ring sits this far above the finger (virtual units) so the finger never covers it
const SWING_SECS = 1.5;
const THROW_SECS = 0.26;

// a tiny seeded stream so the daily lane is the same for everybody on the same day
const dailyRng = (day) => {
  let s = (Math.imul(day | 0, 2654435761) + 12345) >>> 0;
  const next = () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return (s >>> 8) / 16777216; };
  return { next, int: (n) => Math.floor(next() * n) };
};

// About, plus the third-party credits of the 3D layer when it is in use (web/vendor3d/LICENSES.md, shown whole, as its terms ask).
let aboutKey = '', aboutCache = ABOUT;
const aboutList = () => {
  const txt = GL.licenses || '';
  if (!GL.on || !txt) return ABOUT;
  if (aboutKey === txt) return aboutCache;
  aboutKey = txt;
  const from = txt.indexOf('## '), body = from >= 0 ? txt.slice(from) : txt;
  const paras = body.split(/\n\s*\n/).map((t) => t.replace(/^#+\s*/, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  aboutCache = [...ABOUT, { title: 'Credits: the 3D people and venue', p: paras }];
  return aboutCache;
};

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const lay = () => layoutFor(meta.width, meta.height);
  const fx = rng.fork();
  const aiRng = rng.fork();
  const windRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, guide: 0, textIdx: 0, thinkIdx: 1 },
    record: { wins: [0, 0, 0, 0, 0, 0], played: 0, streak: 0, best: 0, demoRounds: 0, thrown: 0, ladder: 0, cups: 0, stakes: 0 },
    setup: { mode: 'ai', opp: 0, pitch: 'club', rounds: 5 }, setupMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0,
    att: null, w: null, m: null, labels: [{ name: 'You', sub: null }, { name: 'Rival', sub: null }], ladder: null,
    cam: { cx: 12, s: 28 }, camSnap: true, aim: { x: 20, y: 0, style: 0 }, prev: null, hintPlan: null, hintBusy: false,
    humanTurn: false, think: null, swing: null, throwAnim: null, holding: true, trail: [], parts: [], toast: '', toastT: 0, pop: null, ff: 1,
    judgeT: 0, restT: 0, explain: null, dragging: false, loaded: false, restoreMsg: '', flying: -1, spec: null,
  };
  let planner = null, hintPlanner = null, prevKey = '', lastStyle = 0;

  // ---- persistence -------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    while (state.record.wins.length < PROFILES.length) state.record.wins.push(0);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    state.settings.guide = clamp(state.settings.guide | 0, 0, 2);
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound -------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    whoosh: () => tone({ freq: 380, to: 150, dur: 0.3, type: 'sawtooth', vol: 0.035 }),
    swing: () => tone({ freq: 200, to: 320, dur: 0.12, type: 'sine', vol: 0.04 }),
    thud: (v) => tone({ freq: 130, to: 60, dur: 0.16, type: 'sine', vol: Math.min(0.22, 0.05 + v / 40) }),
    clack: (v) => {
      const q = Math.min(1, v / 5);
      tone({ freq: 1500 + fx.next() * 300, to: 900, dur: 0.05, type: 'square', vol: 0.02 + 0.05 * q });
      tone({ freq: 520 + fx.next() * 80, to: 340, dur: 0.14, type: 'triangle', vol: 0.05 + 0.1 * q });
    },
    knock: () => { tone({ freq: 330, to: 140, dur: 0.22, type: 'triangle', vol: 0.18 }); tone({ freq: 1100, to: 500, dur: 0.07, type: 'square', vol: 0.05 }); },
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 220, to: 140, dur: 0.2, type: 'sawtooth', vol: 0.055 }),
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.11 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };

  // ---- particles ---------------------------------------------------------------------------------------------
  const MAX_PARTS = 110;
  const puff = (list, x, y, n, size = 3, col, up = 1.5) => {
    for (let i = 0; i < n && list.length < MAX_PARTS; i++) list.push({ kind: 0, x, y, z: 0.05, vx: (fx.next() - 0.5) * 2.2, vy: (fx.next() - 0.5) * 1.0, vz: 0.6 + fx.next() * up, t: 0, max: 0.5 + fx.next() * 0.5, size, col });
  };
  const sparks = (list, x, y, n) => {
    for (let i = 0; i < n && list.length < MAX_PARTS; i++) list.push({ kind: 1, x, y, z: 0.15, vx: (fx.next() - 0.5) * 4, vy: (fx.next() - 0.5) * 2, vz: 1 + fx.next() * 2.4, t: 0, max: 0.25 + fx.next() * 0.25 });
  };
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= 9 * dt; q.vx *= 0.97; if (q.z < 0) { q.z = 0; q.vz *= -0.2; q.vx *= 0.7; } }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };
  const worldEvents = (ev, parts, loud) => {
    for (const e of ev) {
      if (e.t === 'land') {
        puff(parts, e.x, e.y, e.flat ? 5 : 9, e.flat ? 3 : 4, 'rgba(226,196,138,0.9)');
        if (loud) sfx.thud(e.v);
      } else if (e.t === 'bounce') { puff(parts, e.x, e.y, 4, 3); if (loud) sfx.thud(e.v * 0.6); }
      else if (e.t === 'hit') { sparks(parts, e.x, e.y, Math.min(8, 2 + Math.floor(e.v * 1.5))); parts.push({ kind: 2, x: e.x, y: e.y, z: 0, vx: 0, vy: 0, vz: 0, t: 0, max: 0.4 }); if (loud) sfx.clack(e.v); }
      else if (e.t === 'stake') { sparks(parts, e.x, e.y, 10); puff(parts, e.x, e.y, 6, 3, 'rgba(255,240,200,0.9)'); parts.push({ kind: 2, x: e.x, y: e.y, z: 0, vx: 0, vy: 0, vz: 0, t: 0, max: 0.5 }); if (loud) sfx.knock(); }
      else if (e.t === 'tap') { sparks(parts, e.x, e.y, 3); if (loud) sfx.clack(1.5); }
    }
  };

  // ---- the attract lane behind the menus ---------------------------------------------------------------------
  const startAttract = () => {
    const w = createWorld(makePitch('club', null));
    setWind(w, 1.4, 0.35);
    state.att = { w, t: 0, n: 0, wait: 1.0, parts: [], trail: [], throwAnim: null, holding: true, spec: null, id: 1 };
  };
  const updateAttract = (dt) => {
    const a = state.att, w = a.w;
    a.t += dt;
    if (a.throwAnim) {
      a.throwAnim.t += dt;
      if (a.spec && a.throwAnim.t >= a.throwAnim.dur) {
        const pin = newPin(a.id++, a.n % 2);
        launch(w, pin, a.spec); a.spec = null; a.holding = false; a.trail = []; a.n++;
      }
      if (a.throwAnim.t > a.throwAnim.dur + 1.2) { a.throwAnim = null; a.holding = true; }
    }
    if (!w.settled) {
      for (let i = 0; i < STEPS_PER_TICK; i++) {
        const ev = stepWorld(w, 1, []);
        worldEvents(ev, a.parts, false);
        const fl = w.pins[w.pins.length - 1];
        if (fl && fl.mode === 'air' && a.trail.length < 900 && i === 0) a.trail.push(fl.x, fl.y, fl.z);
      }
      if (w.settled) a.wait = 2.2;
    } else {
      a.wait -= dt;
      if (a.wait <= 0 && !a.throwAnim) {
        if (w.pins.length >= 6) w.pins = [];
        if (w.stake.fallen) { w.stake.fallen = false; w.stake.rise = 0.35; }
        const style = a.n % 3, tx = w.D - 1.5 + fx.next() * 3, ty = (fx.next() - 0.5) * 1.6;
        const sol = solveThrow(w, style, tx, ty);
        a.spec = { style, theta: sol.theta, v0: sol.v0 };
        a.throwAnim = { t: 0, dur: 0.5 }; a.trail = [];
      }
    }
    if (w.stake.rise > 0) w.stake.rise = Math.max(0, w.stake.rise - dt);
    stepParts(a.parts, dt);
  };

  // ---- match flow --------------------------------------------------------------------------------------------
  const isAI = (side) => {
    const c = state.m.cfg;
    if (c.mode === 'watch') return true;
    if (c.mode === 'two') return false;
    return side === 1;
  };
  const profOf = (side) => {
    const c = state.m.cfg;
    if (c.mode === 'watch') return side === 0 ? PROFILES[c.watchA] : PROFILES[c.opp];
    return PROFILES[c.profile ?? c.opp];
  };
  const makeLabels = (c) => {
    if (c.mode === 'two') return [{ name: 'Player 1', sub: 'Amber pins' }, { name: 'Player 2', sub: 'Teal pins' }];
    if (c.mode === 'watch') return [{ name: PROFILES[c.watchA].name, sub: 'Amber pins' }, { name: PROFILES[c.opp].name, sub: 'Teal pins' }];
    return [{ name: 'You', sub: 'Amber pins' }, { name: PROFILES[c.profile ?? c.opp].name, sub: 'Teal pins' }];
  };
  const clearAim = () => {
    state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.hintPlan = null; state.explain = null; state.dragging = false;
    prevKey = ''; state.prev = null; state.swing = null;
  };

  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoRounds >= DEMO_ROUND_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const pitch = makePitch(cfg.pitch, cfg.pitch === 'daily' ? dailyRng(config.day | 0) : null);
    state.w = createWorld(pitch);
    state.m = newMatch({ rounds: 5, mode: 'ai', opp: 0, pitch: cfg.pitch, lead: aiRng.int(2), watchA: 3, ...cfg });
    state.labels = makeLabels(state.m.cfg);
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.parts = []; state.pop = null; state.trail = []; state.ff = 1; state.camSnap = true; state.throwAnim = null;
    clearAim();
    beginRound(state.m, state.w, windRng);
    startAim(true);
  };
  const startWatch = () => {
    const picks = [1, 2, 3, 4, 5];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, pitch: PITCH_IDS[aiRng.int(4)], rounds: 2 });
  };

  const startAim = (first = false) => {
    const m = state.m, w = state.w;
    if (!first) driftWind(w, windRng);
    m.turn = whoNext(m);
    if (m.turn < 0) { finishRound(); return; }
    m.phase = 'aim';
    clearAim();
    state.trail = []; state.throwAnim = null; state.holding = true; state.spec = null;
    state.humanTurn = !isAI(m.turn);
    state.aim = { x: w.D - 0.8, y: 0, style: lastStyle };
    if (m.cfg.mode === 'two') toast(`${state.labels[m.turn].name}: your pin`, 1.6);
    else if (state.humanTurn && (state.record.thrown | 0) < 3) toast('Press the sand to place the ring, then Throw', 4.2);
  };

  // what the player's own shot would do right now (solved heading + speed, then a full run among the pins)
  const refreshPrev = () => {
    const m = state.m;
    if (m.phase !== 'aim') { state.prev = null; return; }
    const a = state.aim, w = state.w;
    const key = `${a.x.toFixed(3)}|${a.y.toFixed(3)}|${a.style}|${m.turn}|${w.pins.length}|${w.wind.speed.toFixed(2)}|${w.wind.dir.toFixed(2)}`;
    if (key === prevKey) return;
    prevKey = key;
    const sol = solveThrow(w, a.style, a.x, a.y);
    const pv = previewThrow(w, m.turn, { style: a.style, theta: sol.theta, v0: sol.v0 });
    state.prev = {
      path: pv.path, land: pv.land, flat: pv.flat, rest: pv.rest, moved: pv.moved, kind: pv.kind, clamped: sol.clamped,
      spread: { x: 2 * HUMAN.len * pv.land.x, y: HUMAN.ang * pv.land.x },
    };
  };

  // ---- throwing ----------------------------------------------------------------------------------------------
  const qualityOf = (u) => { const d = Math.abs(u - 0.5); return d <= 0.1 ? 1 : Math.max(0, 1 - (d - 0.1) / 0.4); };
  const beginSwing = () => {
    const m = state.m;
    if (!state.humanTurn || state.paused || m.phase !== 'aim') return;
    state.swing = { on: true, u: 0, dur: SWING_SECS, ai: false };
    m.phase = 'swing';
    state.dragging = false;
    sfx.swing();
  };
  const releaseSwing = (auto = false) => {
    const m = state.m, sw = state.swing;
    if (!sw || !sw.on) return;
    const q = auto ? 0 : qualityOf(sw.u);
    const sol = solveThrow(state.w, state.aim.style, state.aim.x, state.aim.y);
    const scale = 1 + 2.5 * (1 - q);
    const spec = { style: state.aim.style, theta: sol.theta + gauss(fx) * HUMAN.ang * scale, v0: Math.min(sol.v0 * (1 + gauss(fx) * HUMAN.len * scale), 25) };
    state.spec = spec; state.swing = { ...sw, on: false };
    state.throwAnim = { t: 0, dur: THROW_SECS };
    state.humanTurn = false;
    lastStyle = state.aim.style;
    m.phase = 'throw';
    sfx.whoosh();
    if (q >= 0.95 && !auto) toast('Clean release', 1.2);
  };
  const deliver = () => {
    const { m, w } = state;
    const side = m.turn;
    const pin = newPin(m.nextId++, side);
    w.pins = w.pins.filter((p) => !(p.out && p.fade >= 1));
    launch(w, pin, state.spec);
    m.left[side]--; m.thrown++; m.phase = 'fly';
    state.flying = pin.id; state.trail = []; state.holding = false; state.restT = 0;
    if (!isAI(side)) state.record.thrown = (state.record.thrown | 0) + 1;
    clearAim();
  };

  const judge = () => {
    const { m, w } = state;
    const pin = w.pins.find((p) => p.id === state.flying);
    const r = judgeThrow(m, w, pin);
    m.throwLog.push({ team: pin.team, pts: r.pts, kind: r.kind, d: r.d });
    const big = r.pts > 0 ? `+${r.pts}` : r.kind === 'out' ? 'Out' : '0';
    const small = r.kind === 'stake' ? 'Stake down!' : r.kind === 'touch' ? 'Touching the stake' : r.kind === 'near' ? 'In the zone' : r.kind === 'out' ? 'Out of the lane' : 'No score';
    state.pop = { big, small, team: pin.team, t: 0, dur: 1.5 };
    if (r.kind === 'stake') { if (!isAI(pin.team)) state.record.stakes = (state.record.stakes | 0) + 1; for (let i = 0; i < 3; i++) sfx.chime(i); }
    else if (r.pts > 0) sfx.chime(r.pts - 1); else sfx.no();
    m.phase = 'judge'; state.judgeT = 0;
    state.humanTurn = false;
  };

  const finishRound = () => {
    const { m, w } = state;
    const info = scoreRound(m, w);
    m.phase = 'score';
    m.roundInfo = { ...info, t: 0 };
    state.humanTurn = false; clearAim();
    if (info.bonusTeam >= 0) sfx.chime(2);
    if (w.stake.fallen) { w.stake.fallen = false; w.stake.rise = 0.35; }
  };

  const afterRound = () => {
    const { m } = state;
    applyRound(m, m.roundInfo);
    if (m.cfg.mode !== 'watch') state.record.demoRounds++;
    if (m.over) {
      state.scene = 'result'; state.ui.scroll = 0;
      const win = m.over.win === 0 && !m.over.draw;
      if (m.cfg.mode === 'ai' || m.cfg.mode === 'ladder') {
        state.record.played++;
        if (win) { state.record.wins[m.cfg.opp]++; state.record.streak++; state.record.best = Math.max(state.record.best, state.record.streak); } else state.record.streak = 0;
      }
      if (m.cfg.mode === 'ladder') ladderResult(win);
      if (win && m.cfg.mode !== 'watch' && m.cfg.mode !== 'two') sfx.win();
      save();
    } else if (state.demo && m.cfg.mode !== 'watch' && state.record.demoRounds >= DEMO_ROUND_CAP) { save(); state.scene = 'demolimit'; state.ui.scroll = 0; }
    else { save(); beginRound(m, state.w, windRng); state.pop = null; startAim(true); }
  };

  const ladderResult = (win) => {
    const l = state.ladder;
    if (!l) return;
    if (!win) { l.lost = true; return; }
    if (l.rung >= LADDER.length - 1) { l.done = true; state.record.cups = (state.record.cups | 0) + 1; state.record.ladder = LADDER.length - 1; return; }
    l.rung++;
    state.record.ladder = Math.max(state.record.ladder | 0, l.rung);
  };
  const startLadderMatch = () => {
    const l = state.ladder, r = LADDER[l.rung];
    startMatch({ mode: 'ladder', opp: r.opp, profile: r.opp, pitch: r.pitch, rounds: 5 });
  };

  // ---- the rival's turn --------------------------------------------------------------------------------------
  const setAimFromPlan = (p) => { state.aim = { x: p.tx, y: p.ty, style: p.style }; };
  const updateAI = (dt) => {
    const { m } = state;
    if (m.phase !== 'aim' || !isAI(m.turn) || state.paused) return;
    const prof = profOf(m.turn), watch = m.cfg.mode === 'watch';
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur, phase: 'think', plan: null };
      planner = createPlanner(state.w, m, m.turn, prof, aiRng, {});
    }
    const th = state.think;
    th.t += dt;
    if (planner && !planner.done) {
      planner.step(10);
      state.explain = { head: `${state.labels[m.turn].name} is thinking…`, lines: [`Trying ${planner.sims} throws on a copy of the lane`, 'Lob, skim and whirl; wind and pins'] };
      if (planner.done) { th.plan = planner.result; planner = null; }
    }
    if (th.phase === 'think' && th.t >= th.dur && th.plan) {
      th.phase = 'reveal'; th.t = 0; th.dur = watch ? 2 : 0.9;
      setAimFromPlan(th.plan);
      state.explain = watch ? { head: `${state.labels[m.turn].name} chooses: ${planLabel(th.plan)}`, lines: th.plan.alts.map((a, i) => `${i + 1}. ${planLabel(a)}  (${a.score >= 0 ? '+' : ''}${a.score.toFixed(1)})`) } : null;
    } else if (th.phase === 'reveal' && th.t >= th.dur) {
      const e = executePlan(th.plan, prof, aiRng);
      state.spec = e; lastStyle = e.style;
      state.swing = { on: true, u: 0, dur: 0.9, ai: true, target: 0.42 + aiRng.next() * 0.16 };
      m.phase = 'swing'; sfx.swing();
      state.humanTurn = false; state.think = null; state.explain = null; state.prev = null;
    }
  };

  // ---- the hint ----------------------------------------------------------------------------------------------
  const requestHint = () => {
    const m = state.m;
    if (state.hintBusy || m.phase !== 'aim') return;
    state.hintBusy = true;
    hintPlanner = createPlanner(state.w, m, m.turn, PROFILES[PROFILES.length - 1], aiRng, { perfect: true });
  };
  const updateHint = () => {
    if (!hintPlanner) return;
    hintPlanner.step(12);
    if (hintPlanner.done) {
      const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.m.phase !== 'aim') return;
      state.hintPlan = r; setAimFromPlan(r);
      toast(`Hint: ${planLabel(r)}`, 3.4);
    }
  };

  // ---- the camera --------------------------------------------------------------------------------------------
  const camTarget = (L) => {
    const m = state.m, w = state.w, P = viewRect(L, state), D = w.D;
    if (m.phase === 'fly') {
      const p = w.pins.find((q) => q.id === state.flying);
      if (p) {
        const a = Math.max(-1.5, Math.min(p.x - 4, D - 9)), b = a + 12;
        return fitSpan(P, a, b, { margin: 14, apex: Math.max(3, w.apex * 1.05), max: 80 });
      }
    }
    if (m.phase === 'judge' || m.phase === 'score') return fitSpan(P, D - 8, D + 4, { margin: 14, apex: 3, max: 80 });
    return fitSpan(P, -2.8, D + 2.6, { margin: 14, apex: 7, max: 80 });
  };
  const updateCam = (dt, L) => {
    const t = camTarget(L), c = state.cam;
    if (state.camSnap) { c.cx = t.cx; c.s = t.s; state.camSnap = false; return; }
    const k = Math.min(1, dt * 4.5);
    c.cx += (t.cx - c.cx) * k;
    c.s = Math.exp(Math.log(c.s) + (Math.log(t.s) - Math.log(c.s)) * Math.min(1, dt * 3.2));
  };

  // ---- the play scene ----------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const setAimWorld = (x, y) => {
    const a = state.aim, D = state.w.D;
    a.x = clamp(x, 4, D + 2.5);
    a.y = clamp(y, -LANE_HALF + 0.15, LANE_HALF - 0.15);
    state.hintPlan = null;
  };

  const updatePlay = (dt, input) => {
    const { m } = state;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch', L = lay(), P = L.play;
    if (config.dev && keys.pressed.has('KeyK')) { m.scores[0] = Math.max(m.scores[0], m.scores[1] + 1); m.round = m.cfg.rounds; m.over = { win: 0, margin: 1 }; state.scene = 'result'; if (m.cfg.mode === 'ladder') ladderResult(true); return; }
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
        else if (inRect(P.demo.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); }
        else if (inRect(P.demo.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); }
        else if (inRect(P.demo.rules, ptr.x, ptr.y)) { state.paused = true; state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; sfx.tick(); return; }
        else if (P.demo.howto && inRect(P.demo.howto, ptr.x, ptr.y)) { state.paused = true; state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; sfx.tick(); return; }
        else if (inRect(P.demo.exit, ptr.x, ptr.y)) { leaveMatch(); return; }
      }
    } else if (ptr.pressed && inRect(P.menu, ptr.x, ptr.y)) { openPause(); return; }
    state.ff = m.phase === 'fly' && ptr.down && !state.paused && !watch ? 3 : 1;
    const pr = projector(viewRect(L, state), state.cam);
    const lp = projector(P.loupe, loupeCam(L, state.w.D));
    if (!state.paused && state.humanTurn && m.phase === 'aim') {
      const a = state.aim;
      if (ptr.pressed) {
        if (inRect(P.throwB, ptr.x, ptr.y)) { beginSwing(); return; }
        let hit = true;
        const si = P.styles.findIndex((r) => inRect(r, ptr.x, ptr.y));
        if (si >= 0) { a.style = si; state.hintPlan = null; sfx.tick(); }
        else if (inRect(P.hint, ptr.x, ptr.y)) { requestHint(); sfx.tick(); }
        else hit = false;
        if (!hit) {
          if (inRect(P.loupe, ptr.x, ptr.y) && (P.split || true)) state.dragging = 'loupe';
          else if (inRect(viewRect(L, state), ptr.x, ptr.y)) state.dragging = 'view';
        }
      }
      if (state.dragging && ptr.down) {
        if (state.dragging === 'loupe') { const p = lp.inv(ptr.x, ptr.y - 20); setAimWorld(p.x, p.y); }
        else { const p = pr.inv(ptr.x, ptr.y - FINGER_OFFSET); setAimWorld(p.x, p.y); }
      }
      if (ptr.released && state.dragging) state.dragging = false;
      const k = 0.06;
      if (keys.down.has('ArrowLeft')) setAimWorld(a.x - k * 3, a.y);
      if (keys.down.has('ArrowRight')) setAimWorld(a.x + k * 3, a.y);
      if (keys.down.has('ArrowUp')) setAimWorld(a.x, a.y - k);
      if (keys.down.has('ArrowDown')) setAimWorld(a.x, a.y + k);
      for (let i = 0; i < 3; i++) if (keys.pressed.has(`Digit${i + 1}`)) { a.style = i; state.hintPlan = null; }
      if (keys.pressed.has('KeyH')) requestHint();
      if (keys.pressed.has('Space') || keys.pressed.has('Enter')) { beginSwing(); return; }
      refreshPrev();
    } else if (state.humanTurn && m.phase === 'swing' && !state.paused) {
      if ((ptr.pressed && (inRect(P.throwB, ptr.x, ptr.y) || inRect(P.view, ptr.x, ptr.y))) || keys.pressed.has('Space') || keys.pressed.has('Enter')) releaseSwing(false);
    } else if (state.dragging) state.dragging = false;
    if (!state.paused) {
      updateHint();
      updateAI(dt);
      if (isAI(m.turn) && m.phase === 'aim' && state.think && state.think.phase === 'reveal') refreshPrev();
    }
    if (state.paused) { updateCam(dt, L); return; }
    // the swing: the marker sweeps once; a rival's arm just goes through the motion
    if (m.phase === 'swing' && state.swing && state.swing.on) {
      const sw = state.swing;
      sw.u += dt / sw.dur;
      if (sw.ai) {
        if (sw.u >= sw.target) {
          state.swing = { ...sw, on: false };
          state.throwAnim = { t: 0, dur: THROW_SECS }; m.phase = 'throw'; sfx.whoosh();
        }
      } else if (sw.u >= 1) { sw.u = 1; releaseSwing(true); }
    }
    if (m.phase === 'throw' && state.throwAnim) {
      state.throwAnim.t += dt;
      if (state.throwAnim.t >= state.throwAnim.dur) deliver();
    } else if (state.throwAnim && m.phase !== 'throw') {
      state.throwAnim.t += dt;
      if (state.throwAnim.t > state.throwAnim.dur + 1.2) state.throwAnim = null;
    }
    // physics: the pin in flight, sliding and settling
    if (m.phase === 'fly') {
      const w = state.w;
      for (let i = 0; i < state.ff; i++) {
        for (let s = 0; s < STEPS_PER_TICK; s++) {
          const ev = stepWorld(w, 1, []);
          if (ev.length) worldEvents(ev, state.parts, true);
          const fl = w.pins.find((p) => p.id === state.flying);
          if (fl && fl.mode === 'air' && s === 0 && state.trail.length < 1500) state.trail.push(fl.x, fl.y, fl.z);
        }
        if (w.settled) { state.restT += dt; if (state.restT > 0.45) { judge(); break; } } else state.restT = 0;
      }
    }
    if (m.phase === 'judge') {
      state.judgeT += dt;
      if (state.judgeT > 1.5) { state.w.stake.fallen = false; state.w.stake.rise = 0.35; state.judgeT = 0; startAim(false); }
    }
    // out pins fade away; the stake stands back up
    for (const p of state.w.pins) if (p.out && p.mode === 'rest') p.fade = Math.min(1.2, p.fade + dt * 0.7);
    if (state.w.stake.rise > 0) state.w.stake.rise = Math.max(0, state.w.stake.rise - dt);
    stepParts(state.parts, dt);
    updateCam(dt, L);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.pop) { state.pop.t += dt; if (state.pop.t > state.pop.dur) state.pop = null; }
    if (m.phase === 'score') {
      m.roundInfo.t += dt;
      const auto = watch && m.roundInfo.t > 5;
      if ((ptr.pressed && m.roundInfo.t > 0.8) || auto || (keys.pressed.has('Space') && m.roundInfo.t > 0.8)) afterRound();
    }
  };

  const leaveMatch = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; clearAim(); state.parts = []; };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'p-guide') { state.settings.guide = (state.settings.guide + 1) % 3; prevKey = ''; save(); }
    else if (id === 'quit') leaveMatch();
  }

  // ---- menus -------------------------------------------------------------------------------------------------
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
    else if (id === 'ladder') { if (state.demo) { state.scene = 'demolimit'; state.ui.scroll = 0; return; } state.ladder = { rung: Math.min(state.record.ladder | 0, LADDER.length - 1), lost: false, done: false }; state.scene = 'ladder'; state.ui.scroll = 0; }
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
    else if (id.startsWith('pit')) { const c = id.slice(3); if (state.demo && c !== 'club') { state.setupMsg = 'That lane is in the full game.'; return; } s.pitch = c; state.setupMsg = ''; }
    else if (id === 'rounds5') s.rounds = 5;
    else if (id === 'rounds8') s.rounds = 8;
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, pitch: s.pitch, rounds: s.rounds });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleLadder = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'ladder-go') startLadderMatch();
    else if (id === 'ladder-new') { state.record.ladder = 0; state.ladder = { rung: 0, lost: false, done: false }; save(); }
    else if (id === 'ladder-retry') { state.ladder.lost = false; startLadderMatch(); }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-guide') { st.guide = (st.guide + 1) % 3; prevKey = ''; }
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
    if (id === 'again') {
      if (cfg.mode === 'ladder') {
        const l = state.ladder;
        if (l.done) { state.record.ladder = 0; state.ladder = { rung: 0, lost: false, done: false }; }
        else l.lost = false;
        startLadderMatch();
      } else startMatch({ ...cfg, lead: aiRng.int(2) });
    }
    else if (id === 'next') { state.scene = 'ladder'; state.ui.scroll = 0; }
    else if (id === 'new') { state.setup.mode = cfg.mode === 'watch' || cfg.mode === 'ladder' ? 'ai' : cfg.mode; state.scene = 'setup'; state.ui.scroll = 0; }
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
    if (k.pressed.has('KeyG') && !state.demo) state.setup.pitch = PITCH_IDS[(PITCH_IDS.indexOf(state.setup.pitch) + 1) % PITCH_IDS.length];
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

  // `?shot=1` (store screenshots): a staged, real position instead of whatever a random player reaches.
  const setupShot = (kind = (((config.seed | 0) - 3) % 6 + 6) % 6, live = false) => {
    if (kind === 2) { state.shot = !live; return; }                     // the title screen with the attract lane (frozen, so no monkey input can leave it)
    state.record.thrown = 10;
    startMatch({ mode: 'two', opp: 0, pitch: 'club', rounds: 5, lead: 0 });
    const w = state.w, m = state.m;
    const mk = (id, team, x, y, th = 0) => { const p = newPin(id, team); p.x = x; p.y = y; p.mode = 'rest'; p.th = th; p.yaw = (id % 3) * 0.2 - 0.2; return p; };
    w.pins = [mk(1, 0, w.D - 0.6, 0.3), mk(2, 1, w.D + 0.35, -0.5), mk(3, 0, w.D - 1.4, -0.9), mk(4, 1, w.D + 0.1, 0.12), mk(5, 0, w.D + 0.8, 0.7), mk(6, 1, w.D - 2.0, 0.6)];
    w.settled = true; m.left = [1, 1]; m.thrown = 6; m.nextId = 7; m.scores = [7, 6]; m.round = 3; m.first = 0;
    m.throwLog = [{ team: 0, pts: 2 }, { team: 1, pts: 1 }, { team: 0, pts: 1 }, { team: 1, pts: 3 }, { team: 0, pts: 0 }, { team: 1, pts: 0 }];
    setWind(w, 2.6, 0.5);
    state.toastT = 0; state.camSnap = true;
    if (kind === 1) { m.left = [0, 0]; m.thrown = 8; finishRound(); m.roundInfo.t = 2; }
    else { m.phase = 'aim'; m.turn = 0; state.humanTurn = true; state.aim = { x: w.D - 0.3, y: 0.1, style: 1 }; }
    if (kind === 3) { m.phase = 'swing'; state.holding = true; state.swing = { on: true, u: 0.5, dur: SWING_SECS, ai: false }; }              // the release bar at the green
    if (kind === 4) {                                                                                                                   // a pin in the air
      const sol = solveThrow(w, 1, w.D - 0.3, 0.1);
      state.spec = { style: 1, theta: sol.theta, v0: sol.v0 };
      deliver(); state.trail = [];
      for (let i = 0; i < 14; i++) for (let s = 0; s < STEPS_PER_TICK; s++) { stepWorld(w, 1, []); const fl = w.pins.find((p) => p.id === state.flying); if (fl && fl.mode === 'air' && s === 0) state.trail.push(fl.x, fl.y, fl.z); }
    }
    if (kind === 5) { state.record.ladder = 2; state.ladder = { rung: 2, lost: false, done: false }; state.scene = 'ladder'; state.ui.scroll = 0; ensureLayout(state, 'ladder', lay()); }
    state.shot = !live;
  };
  if (config.shot) setupShot();

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused,
    update(dt, input) {
      if (state.shot) { if (state.scene === 'title') { if (state.att) updateAttract(dt); ensureLayout(state, 'title', lay()); state.t += dt; return; } if (state.m && state.m.phase === 'aim') refreshPrev(); if (state.m) updateCam(dt, lay()); state.t += dt; return; }
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'ladder': updateFlowScene(dt, input, handleLadder, 'ladder'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx, view) {
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height);
      // the canvas is transparent: the 3D layer (when on) shows through wherever the 2D layer does not paint
      ctx.clearRect(0, 0, L.w, L.h);
      if (!GL.on) { ctx.fillStyle = '#2a1a0a'; ctx.fillRect(0, 0, L.w, L.h); }
      switch (state.scene) {
        case 'title': renderTitle(ctx, state, L); break;
        case 'setup': renderSetup(ctx, state, L); break;
        case 'settings': renderSettings(ctx, state, L); break;
        case 'result': renderResult(ctx, state, L); break;
        case 'ladder': renderLadder(ctx, state, L); break;
        case 'demolimit': renderDemoLimit(ctx, state, L); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play', L); break;
        case 'about': renderPages(ctx, state, aboutList(), 'About', L); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules', L); break;
        case 'play':
          if (state.m) renderPlay(ctx, state, L);
          if (state.pauseMenu) renderPause(ctx, state, L);
          break;
        default: break;
      }
    },
    wheel(dy) { if (['about', 'howto', 'rules'].includes(state.scene)) { state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max); return; } if (['title', 'setup', 'settings', 'result', 'demolimit', 'ladder'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, flowMeta().max); },
    stage: (kind) => setupShot(kind, true),   // dev / QA: the same staged positions, but playable
    getState: () => state,
    debug: () => ({ lockup: lockupZone(), layout: lay(), flow: flowRects(state.ui.scroll), flowMax: flowMeta().max }),
  };
}
