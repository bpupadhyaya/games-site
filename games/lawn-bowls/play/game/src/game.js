// Lawn Bowls: state and flow. Physics lives in sim.js, rules in match.js, drawing in view.js and menus.js, the rivals in ai.js.
// This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, ladder, howto/about/rules, demolimit.
// Bowling: press the green to put the target ring where you want the bowl to finish (or to arrive, for Firm and Drive), choose the hand
// the bowl leans to and the weight, then press Roll. The game works out the heading and speed; your hand adds a small shake.
import { createRng } from '../kit/rng.js';
import {
  createWorld, makeGreen, newBowl, newJack, launch, stepWorld, solveShot, jackShot, previewShot, soloRun, theJack, ranking, WEIGHTS,
  STEPS_PER_TICK, RINK, GREEN_IDS, clamp, liveBowls,
} from './sim.js';
import { newMatch, beginEnd, judgeJack, whoNext, scoreEnd, applyEnd } from './match.js';
import { createPlanner, executePlan, planJack, planLabel, gauss } from './ai.js';
import { PROFILES, HUMAN, LADDER } from './opponents.js';
import { inRect, TEXT_SCALES, THINK_STEPS, layoutFor, host } from './layout.js';
import { fitBox } from './cam.js';
import { renderPlay, miniMap, projFor } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderLadder, hitScreen, flowMeta, REF, ensureLayout, flowRects, lockupZone } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';
import { v3 } from './v3.js';

// `meta.width/height` are updated live by the kit on every resize (fluid mode: the short side is always 720 units).
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_END_CAP = 2;
// the ring sits ahead of the finger so the fingertip never covers it: at least 62 virtual units, and never under ~52 css px on small phones
const fingerOffset = () => Math.max(62, 52 / Math.max(0.2, host.px || 0.6));

export function createGame(env) {
  const WINDUP = 0.62;   // seconds from the press of Roll to the bowl leaving the hand
  const { rng, audio, storage, config, monetization } = env;
  const lay = () => layoutFor(meta.width, meta.height);
  const fx = rng.fork();
  const aiRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, guide: 0, textIdx: 0, thinkIdx: 1 },
    record: { wins: [0, 0, 0, 0, 0, 0], played: 0, streak: 0, best: 0, demoEnds: 0, bowled: 0, ladder: 0, cups: 0 },
    setup: { mode: 'ai', opp: 0, green: 'village', ends: 6 }, setupMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0,
    att: null, w: null, m: null, labels: [{ name: 'You', sub: null }, { name: 'Rival', sub: null }], ladder: null,
    cam: { cx: 0, cy: 26, s: 40 }, camSnap: true, aim: { x: 0, y: 26, hand: -1, weight: 0 }, prev: null, hintPlan: null, hintBusy: false,
    humanTurn: false, think: null, trail: [], parts: [], toast: '', toastT: 0, pop: null, ff: 1, restT: 0, explain: null, coach: false, dragging: false,
    loaded: false, windup: null, restoreMsg: '', centre: null, flying: -1, jackDitchSaid: false,
  };
  let planner = null, hintPlanner = null, prevKey = '', solveCache = null, rumble = 0, lastHand = -1;

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
    release: () => tone({ freq: 210, to: 110, dur: 0.18, type: 'sine', vol: 0.06 }),
    clack: (v) => {
      const q = Math.min(1, v / 5);
      tone({ freq: 1900 + fx.next() * 400, to: 1300, dur: 0.05, type: 'square', vol: 0.02 + 0.05 * q });
      tone({ freq: 640 + fx.next() * 90, to: 420, dur: 0.14, type: 'triangle', vol: 0.05 + 0.1 * q });
    },
    thud: (v) => tone({ freq: 110, to: 52, dur: 0.16, type: 'sine', vol: Math.min(0.24, 0.06 + v / 24) }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 220, to: 140, dur: 0.2, type: 'sawtooth', vol: 0.055 }),
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.11 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };

  // ---- particles ---------------------------------------------------------------------------------------------
  const MAX_PARTS = 90;
  const puff = (x, y, n, size = 3, col) => {
    for (let i = 0; i < n && state.parts.length < MAX_PARTS; i++) state.parts.push({ kind: 0, x, y, z: 0.05, vx: (fx.next() - 0.5) * 0.9, vy: (fx.next() - 0.5) * 0.9, vz: 0.2 + fx.next() * 0.6, t: 0, max: 0.5 + fx.next() * 0.5, size, col });
  };
  const sparks = (x, y, n) => {
    for (let i = 0; i < n && state.parts.length < MAX_PARTS; i++) state.parts.push({ kind: 1, x, y, z: 0.08, vx: (fx.next() - 0.5) * 3, vy: (fx.next() - 0.5) * 3, vz: 0.6 + fx.next() * 1.4, t: 0, max: 0.2 + fx.next() * 0.2 });
  };
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= 4 * dt; q.vx *= 0.97; q.vy *= 0.97; if (q.z < 0) { q.z = 0; q.vz = 0; } }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };

  // ---- the attract green behind the menus --------------------------------------------------------------------
  // one attract bowl: aimed at the jack with a little scatter, alternating teams
  // The attract bowl is planned first (so the bowler can wind up against `a.windup`) and launched when the wind-up ends.
  const attractPlan = (a) => {
    const w = a.w;
    if (liveBowls(w).length >= 7) { w.balls = w.balls.filter((b) => b.k); const j = w.balls[0]; j.x = 0.1; j.y = 26.5; j.vx = 0; j.vy = 0; j.out = false; j.ditch = false; j.fade = 0; }
    const j = theJack(w), team = a.n % 2, hand = fx.next() < 0.5 ? -1 : 1;
    const tx = j.x + (fx.next() - 0.5) * 0.9, ty = j.y + (fx.next() - 0.5) * 0.7 - 0.1;
    const sol = solveShot(w.green, hand, 0, tx, ty);
    return { team, hand, sol, id: 10 + a.n };
  };
  const attractFire = (a, p) => {
    const b = newBowl(p.id, p.team, p.hand); a.n++;
    launch(a.w, b, { theta: p.sol.theta, v0: p.sol.v0 });
  };
  const attractThrow = (a) => { attractFire(a, attractPlan(a)); };
  const startAttract = () => {
    const w = createWorld(makeGreen('village', fx.fork()));
    const j = newJack(); j.x = 0.1; j.y = 26.5; w.balls.push(j);
    state.att = { w, t: 0, n: 0, wait: 1.2, parts: [], windup: null, side: 0 };
    // the title never shows a lone jack: a few bowls are already resting round it when the menu opens
    for (let i = 0; i < 4; i++) {
      attractThrow(state.att);
      for (let g = 0; g < 6000 && !w.settled; g++) stepWorld(w, STEPS_PER_TICK);
      for (const b of w.balls) b.run = false;
    }
  };
  const updateAttract = (dt) => {
    const a = state.att, w = a.w;
    a.wait -= dt;
    if (a.wait <= 0 && w.settled && !a.windup) {
      const p = attractPlan(a);
      a.windup = { t: 0, dur: WINDUP, side: p.team, plan: p };
    }
    if (a.windup) {
      a.windup.t += dt;
      if (a.windup.t >= a.windup.dur) { attractFire(a, a.windup.plan); a.side = a.windup.side; a.windup = null; a.wait = 3.6; }
    }
    if (!w.settled) {
      const ev = stepWorld(w, STEPS_PER_TICK);
      for (const e of ev) if (e.t === 'hit' && e.v > 0.4) {
        for (let i = 0; i < 3 && a.parts.length < 40; i++) a.parts.push({ kind: 1, x: e.x, y: e.y, z: 0.08, vx: (fx.next() - 0.5) * 3, vy: (fx.next() - 0.5) * 3, vz: 0.6 + fx.next() * 1.4, t: 0, max: 0.2 + fx.next() * 0.2 });
      }
      if (w.settled) for (const b of w.balls) b.run = false;
    }
    stepParts(a.parts, dt);
  };

  // ---- match flow --------------------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
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
    if (c.mode === 'two') return [{ name: 'Player 1', sub: 'Black bowls' }, { name: 'Player 2', sub: 'Ivory bowls' }];
    if (c.mode === 'watch') return [{ name: PROFILES[c.watchA].name, sub: 'Black bowls' }, { name: PROFILES[c.opp].name, sub: 'Ivory bowls' }];
    return [{ name: 'You', sub: 'Black bowls' }, { name: PROFILES[c.profile ?? c.opp].name, sub: 'Ivory bowls' }];
  };
  const clearAim = () => {
    state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.hintPlan = null; state.explain = null; state.dragging = false;
    prevKey = ''; state.prev = null;
  };

  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoEnds >= DEMO_END_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const gseed = cfg.green === 'daily' ? createRng((config.day | 0) * 7919 + 13) : fx.fork();
    const green = makeGreen(cfg.green, gseed);
    state.w = createWorld(green);
    state.m = newMatch({ ends: 6, mode: 'ai', opp: 0, green: cfg.green, lead: aiRng.int(2), watchA: 3, ...cfg });
    state.labels = makeLabels(state.m.cfg);
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.parts = []; state.pop = null; state.trail = []; state.ff = 1; state.camSnap = true; state.jackDitchSaid = false; state.windup = null;
    clearAim();
    beginEnd(state.m, state.w);
    startJackPhase();
  };
  const startWatch = () => {
    const picks = [2, 3, 4, 5];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, green: GREEN_IDS[aiRng.int(4)], ends: 3 });
  };

  const startJackPhase = () => {
    const m = state.m;
    m.phase = 'jack'; m.turn = m.lead;
    clearAim();
    state.trail = [];
    state.humanTurn = !isAI(m.turn);
    state.aim = { x: 0, y: 26.5, hand: 0, weight: 0 };
    if (state.humanTurn && (state.record.bowled | 0) < 4) toast('Press the green to choose how far the jack runs, then Roll', 4.5);
  };

  const startAim = () => {
    const m = state.m, j = theJack(state.w);
    m.phase = 'aim'; m.turn = whoNext(m);
    clearAim();
    state.trail = [];
    state.humanTurn = !isAI(m.turn);
    state.aim = { x: j.x, y: clamp(j.y - 0.15, 6, 33), hand: lastHand || -1, weight: 0 };
    if (m.cfg.mode === 'two') toast(`${state.labels[m.turn].name}: your bowl`, 1.6);
    else if (state.humanTurn && (state.record.bowled | 0) < 3) toast('Place the ring, pick a hand and a weight, then Roll', 4);
  };

  // what the player's own shot would do right now (solved heading + speed, then a full run among the bowls)
  const solveAim = () => {
    const m = state.m, g = state.w.green, a = state.aim;
    if (m.phase === 'jack') { const j = jackShot(g, a.y); return { theta: j.theta, v0: j.v0, err: 0 }; }
    const guess = solveCache && solveCache.hand === a.hand && solveCache.weight === a.weight ? solveCache.sol : null;
    const sol = solveShot(g, a.hand, WEIGHTS[a.weight].arrive, a.x, a.y, guess);
    solveCache = { hand: a.hand, weight: a.weight, sol };
    return sol;
  };
  const refreshPrev = () => {
    const m = state.m;
    if (!(m.phase === 'aim' || m.phase === 'jack')) { state.prev = null; return; }
    const a = state.aim, j = theJack(state.w);
    const key = `${m.phase}|${a.x.toFixed(3)}|${a.y.toFixed(3)}|${a.hand}|${a.weight}|${m.turn}|${state.w.balls.length}|${j ? j.x.toFixed(2) + j.y.toFixed(2) : ''}`;
    if (key === prevKey) return;
    prevKey = key;
    const g = state.w.green;
    if (m.phase === 'jack') {
      const s = jackShot(g, a.y), r = soloRun(g, 0, s.theta, s.v0, { path: true, jack: true });
      state.prev = { path: r.path, rest: { x: r.x, y: r.y }, moved: [], spread: { x: 0.04, y: a.y * 0.01 } };
      return;
    }
    const sol = solveAim();
    const pv = previewShot(state.w, { theta: sol.theta, v0: sol.v0 }, a.hand, m.turn);
    const D = Math.hypot(a.x, a.y);
    state.prev = {
      path: pv.path, rest: pv.rest, moved: pv.moved, toucher: pv.toucher, out: pv.out, ditch: pv.ditch,
      spread: { x: HUMAN.ang * D, y: a.weight === 0 ? 2 * HUMAN.len * D : HUMAN.ang * D * 1.3 },
    };
  };

  // ---- bowling -----------------------------------------------------------------------------------------------
  // The bowler winds up for WINDUP seconds before the bowl leaves the hand (the 3D presenter plays the delivery against this clock;
  // the 2D fallback just waits). The shot itself (theta, v0) is already decided here, so the sim stays deterministic.
  const deliver = (theta, v0) => {
    if (state.windup) return;
    const { m } = state;
    state.windup = { t: 0, dur: WINDUP, theta, v0, side: m.turn, jack: m.phase === 'jack', hand: state.aim.hand, weight: state.aim.weight };
    state.humanTurn = false; state.think = null; state.explain = null;
    clearAim();
    sfx.release();
  };
  const releaseBowl = (theta, v0, hand) => {
    const { m, w } = state;
    const side = m.turn;
    for (const b of w.balls) b.run = false;
    if (m.phase === 'jack') {
      const j = newJack(0);
      launch(w, j, { theta, v0 });
      m.phase = 'jack-fly';
    } else {
      const b = newBowl(m.nextId++, side, hand);
      launch(w, b, { theta, v0 });
      m.left[side]--; m.thrown++; m.last = side; m.phase = 'fly';
      state.flying = b.id; lastHand = b.bias;
      if (!isAI(side)) state.record.bowled = (state.record.bowled | 0) + 1;
    }
    state.humanTurn = false; state.trail = []; state.restT = 0;
    clearAim();
  };
  const humanRoll = () => {
    const m = state.m;
    if (!state.humanTurn || state.paused || !(m.phase === 'aim' || m.phase === 'jack')) return;
    const sol = solveAim();
    const noise = m.phase === 'jack' ? { ang: 0.0016, len: 0.004 } : HUMAN;
    deliver(sol.theta + gauss(fx) * noise.ang, sol.v0 * (1 + gauss(fx) * noise.len));
  };

  const finishEnd = () => {
    const { m, w } = state;
    const res = scoreEnd(m, w);
    m.phase = 'score';
    const rk = ranking(w);
    const best = rk.length ? rk[0] : null;
    const other = best ? rk.find((r) => r.b.team !== best.b.team) : null;
    const lines = rk.slice(0, 5).map((r) => ({ id: r.b.id, d: r.d, scores: !res.dead && !res.tie && !!best && r.b.team === best.b.team && (!other || r.d < other.d - 0.0005) }));
    m.endInfo = { ...res, t: 0, lines };
    state.humanTurn = false; clearAim(); state.trail = [];
    if (res.pts > 0) { state.pop = { text: `+${res.pts}`, t: 0, team: res.team }; for (let i = 0; i < Math.min(res.pts, 4); i++) sfx.chime(i); } else sfx.no();
    if (!res.text && res.team >= 0) {
      const nm = state.labels[res.team].name;
      m.endInfo.text = `${nm === 'You' ? 'You score' : `${nm} scores`} ${res.pts} shot${res.pts === 1 ? '' : 's'}`;
    }
  };

  const onSettled = () => {
    const { m, w } = state;
    for (const b of w.balls) b.run = false;
    if (m.phase === 'jack-fly') {
      const j = theJack(w), r = judgeJack(m, w);
      if (!r.ok) {
        m.jackTries++;
        w.balls = [];
        if (m.jackTries >= 3) {
          // after three bad rolls the jack is simply set at the standard spot
          const jj = newJack(0); jj.x = 0; jj.y = RINK.centreSpot; w.balls.push(jj);
          toast('The jack is set at 25 m', 2.6);
          state.centre = null; m.phase = 'centre'; state.restT = 0;
          return;
        }
        toast(r.msg, 3);
        sfx.no();
        startJackPhase();
        return;
      }
      state.centre = { from: j.x };
      m.phase = 'centre'; state.restT = 0;
      return;
    }
    // bowls: dead ones leave; a jack out of the rink ends the end
    for (const b of w.balls) if (!b.k && (b.out || (b.ditch && !b.toucher))) b.out = true;
    const j = theJack(w);
    if (!j || j.out) { finishEnd(); return; }
    if (j.ditch && !state.jackDitchSaid) { state.jackDitchSaid = true; toast('The jack is in the ditch: only touchers count', 3); }
    const n = whoNext(m);
    if (n < 0) { finishEnd(); return; }
    startAim();
  };

  const afterEnd = () => {
    const { m } = state;
    applyEnd(m, m.endInfo);
    if (!m.endInfo.dead && m.cfg.mode !== 'watch') state.record.demoEnds++;
    state.jackDitchSaid = false;
    if (m.over) {
      state.scene = 'result'; state.ui.scroll = 0;
      const win = m.over.win === 0;
      if (m.cfg.mode === 'ai' || m.cfg.mode === 'ladder') {
        state.record.played++;
        if (win) { state.record.wins[m.cfg.opp]++; state.record.streak++; state.record.best = Math.max(state.record.best, state.record.streak); } else state.record.streak = 0;
      }
      if (m.cfg.mode === 'ladder') ladderResult(win);
      if (win && m.cfg.mode !== 'watch' && m.cfg.mode !== 'two') sfx.win();
      save();
    } else if (state.demo && m.cfg.mode !== 'watch' && state.record.demoEnds >= DEMO_END_CAP) { save(); state.scene = 'demolimit'; state.ui.scroll = 0; }
    else { save(); beginEnd(m, state.w); startJackPhase(); }
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
    startMatch({ mode: 'ladder', opp: r.opp, profile: r.opp, green: r.green, ends: 6 });
  };

  // ---- the rival's turn --------------------------------------------------------------------------------------
  const setAimFromPlan = (p) => { state.aim = { x: p.tx, y: p.ty, hand: p.hand, weight: p.weight }; };
  const updateAI = (dt) => {
    const { m } = state;
    if (state.windup) return;
    if (!(m.phase === 'aim' || m.phase === 'jack') || !isAI(m.turn) || state.paused) return;
    const prof = profOf(m.turn), watch = mode() === 'watch';
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur: m.phase === 'jack' ? Math.min(dur, 1.8) : dur, phase: 'think', plan: null, jack: null };
      if (m.phase === 'jack') state.think.jack = planJack(aiRng);
      else planner = createPlanner(state.w, m, m.turn, prof, aiRng, {});
    }
    const th = state.think;
    th.t += dt;
    if (planner && !planner.done) {
      planner.step(8);
      state.explain = { head: `${state.labels[m.turn].name} is thinking…`, lines: [`Trying ${planner.sims} bowls on a copy of the green`, 'Draws, blocks, firm and drive, curving each way'] };
      if (planner.done) { th.plan = planner.result; planner = null; }
    }
    const ready = th.jack || th.plan;
    if (th.phase === 'think' && th.t >= th.dur && ready) {
      th.phase = 'reveal'; th.t = 0; th.dur = watch ? 2 : 0.9;
      if (th.jack) state.aim = { x: 0, y: th.jack.length, hand: 0, weight: 0 };
      else {
        setAimFromPlan(th.plan);
        state.explain = watch ? { head: `${state.labels[m.turn].name} chooses: ${planLabel(th.plan)}`, lines: th.plan.alts.map((a, i) => `${i + 1}. ${planLabel(a)}  (${a.score >= 0 ? '+' : ''}${a.score.toFixed(1)})`) } : null;
      }
    } else if (th.phase === 'reveal' && th.t >= th.dur) {
      let theta, v0;
      if (th.jack) { const s = jackShot(state.w.green, th.jack.length); theta = s.theta + gauss(aiRng) * 0.002; v0 = s.v0 * (1 + gauss(aiRng) * 0.006); }
      else { const e = executePlan(th.plan, prof, aiRng); theta = e.theta; v0 = e.v0; }
      deliver(theta, v0);
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
    hintPlanner.step(10);
    if (hintPlanner.done) {
      const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.m.phase !== 'aim') return;
      state.hintPlan = r; setAimFromPlan(r);
      toast(`Hint: ${planLabel(r)}`, 3.4);
    }
  };

  // ---- the camera --------------------------------------------------------------------------------------------
  const headBox = () => {
    const w = state.w, j = theJack(w), a = state.aim, m = state.m;
    if (!j) return { x0: -2.3, x1: 2.3, y0: -1.2, y1: RINK.bank + 0.4 };
    // 3D: a tighter head so a 12 cm bowl is readable (real size); 2D keeps the whole rink width
    const hw = v3.on ? 1.25 : RINK.half + 0.1;
    let x0 = Math.min(-hw, j.x - 1.0), x1 = Math.max(hw, j.x + 1.0), y0 = j.y - (v3.on ? 2.6 : 3.2), y1 = j.y + (v3.on ? 1.2 : 1.5);
    for (const b of w.balls) {
      if (b.k || b.out) continue;
      if (Math.hypot(b.x - j.x, b.y - j.y) < 3.4) { y0 = Math.min(y0, b.y - 0.45); y1 = Math.max(y1, b.y + 0.45); x0 = Math.min(x0, b.x - 0.45); x1 = Math.max(x1, b.x + 0.45); }
    }
    if ((m.phase === 'aim') && !state.dragging) { y0 = Math.min(y0, a.y - 0.6); y1 = Math.max(y1, a.y + 0.6); x0 = Math.min(x0, a.x - 0.6); x1 = Math.max(x1, a.x + 0.6); }
    return { x0, x1, y0, y1 };
  };
  const camTarget = (L) => {
    const m = state.m, w = state.w, P = L.play;
    if (v3.on && state.windup) return fitBox(P.head, L.wide, { x0: -1.7, x1: 1.7, y0: -2.6, y1: 3.4 }, { margin: 18, max: 200 });
    if (m.phase === 'jack' || (m.phase === 'jack-fly' && !(v3.on && theJack(w))) || !theJack(w)) return fitBox(P.head, L.wide, { x0: -RINK.half, x1: RINK.half, y0: -1.2, y1: RINK.bank + 0.5 }, { margin: 10 });
    if (m.phase === 'score') {
      const j = theJack(w), rk = ranking(w).slice(0, 5);
      let x0 = j.x - 0.5, x1 = j.x + 0.5, y0 = j.y - 0.5, y1 = j.y + 0.5;
      for (const r of rk) { x0 = Math.min(x0, r.b.x - 0.3); x1 = Math.max(x1, r.b.x + 0.3); y0 = Math.min(y0, r.b.y - 0.3); y1 = Math.max(y1, r.b.y + 0.3); }
      const R = { ...P.head, h: Math.max(60, P.head.h - (L.wide ? 140 : 130)) };
      return fitBox(R, L.wide, { x0, x1, y0, y1 }, { margin: 40, max: 170 });
    }
    if (v3.on) {
      // 3D: stay close. The bowler's delivery first, then follow the bowl down the green; the head joins once it is near.
      const hb = headBox();
      const wu = state.windup;
      if (wu) return fitBox(P.head, L.wide, { x0: -1.7, x1: 1.7, y0: -2.6, y1: 3.4 }, { margin: 18, max: 200 });
      if (m.phase === 'fly' || m.phase === 'jack-fly') {
        const b = w.balls.find((q) => (m.phase === 'jack-fly' ? q.k : q.id === state.flying && !q.k));
        if (b) {
          const near = hb.y0 - b.y < 6.5;
          return fitBox(P.head, L.wide, { x0: Math.min(-1.5, b.x - 0.8, near ? hb.x0 : 9), x1: Math.max(1.5, b.x + 0.8, near ? hb.x1 : -9), y0: Math.min(b.y - 2.2, near ? hb.y0 : 1e9), y1: near ? Math.max(b.y + 3, hb.y1) : b.y + 4.6 }, { margin: 18, max: 200 });
        }
      }
    } else {
    if (state.windup && !state.windup.jack) {
      const hb = headBox();
      return fitBox(P.head, L.wide, { x0: Math.min(hb.x0, -1.6), x1: Math.max(hb.x1, 1.6), y0: -2.2, y1: hb.y1 }, { margin: 18 });
    }
    if (m.phase === 'fly') {
      const b = w.balls.find((q) => q.id === state.flying && !q.k), hb = headBox();
      if (b) return fitBox(P.head, L.wide, { x0: Math.min(hb.x0, b.x - 1.2), x1: Math.max(hb.x1, b.x + 1.2), y0: Math.min(hb.y0, b.y - 1.6), y1: hb.y1 }, { margin: 18 });
    }
    }
    return fitBox(P.head, L.wide, headBox(), { margin: 16 });
  };
  const updateCam = (dt, L) => {
    if (state.dragging && !state.camSnap) return;
    const t = camTarget(L), c = state.cam;
    if (state.camSnap) { c.cx = t.cx; c.cy = t.cy; c.s = t.s; state.camSnap = false; return; }
    const k = Math.min(1, dt * 4.5);
    c.cx += (t.cx - c.cx) * k; c.cy += (t.cy - c.cy) * k;
    c.s = Math.exp(Math.log(c.s) + (Math.log(t.s) - Math.log(c.s)) * Math.min(1, dt * 3.2));
  };

  // ---- the play scene ----------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const setAimWorld = (x, y) => {
    const m = state.m, a = state.aim, jack = m.phase === 'jack';
    a.x = jack ? 0 : clamp(x, -RINK.half + 0.1, RINK.half - 0.1);
    a.y = clamp(y, jack ? RINK.minJack : 5, jack ? RINK.maxJack : RINK.ditch - 0.4);
    state.hintPlan = null;
  };

  const handleEvents = (ev) => {
    for (const e of ev) {
      if (e.t === 'hit') {
        sparks(e.x, e.y, Math.min(8, 2 + Math.floor(e.v * 2)));
        sfx.clack(e.v);
        state.parts.push({ kind: 2, x: e.x, y: e.y, z: 0, vx: 0, vy: 0, vz: 0, t: 0, max: 0.4 });
      } else if (e.t === 'ditch') { puff(e.x, e.y, 6, 4, 'rgba(210,190,140,0.9)'); sfx.thud(e.v); }
      else if (e.t === 'out') { toast(e.k ? 'The jack left the rink: dead end' : 'Out of the rink: that bowl is dead', 2.4); sfx.no(); }
    }
  };

  const updatePlay = (dt, input) => {
    const { m } = state;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch', L = lay(), P = L.play;
    if (config.dev && keys.pressed.has('KeyK')) { m.scores[0] = Math.max(m.scores[0], m.scores[1] + 1); m.end = m.cfg.ends + 1; m.over = { win: 0, shutout: false }; state.scene = 'result'; if (m.cfg.mode === 'ladder') ladderResult(true); return; }
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
    state.coach = state.humanTurn && !state.dragging && (state.record.bowled | 0) < 2 && !state.paused;
    state.ff = (m.phase === 'fly' || m.phase === 'jack-fly') && ptr.down && !state.paused ? 3 : 1;
    const pr = projFor(L, state.cam);
    if (state.humanTurn && !state.paused && (m.phase === 'aim' || m.phase === 'jack')) {
      const jack = m.phase === 'jack', a = state.aim;
      const mp = miniMap(L);
      if (ptr.pressed) {
        let hit = true;
        if (!jack && inRect(P.handL, ptr.x, ptr.y)) { a.hand = -1; state.hintPlan = null; sfx.tick(); }
        else if (!jack && inRect(P.handR, ptr.x, ptr.y)) { a.hand = 1; state.hintPlan = null; sfx.tick(); }
        else if (!jack && P.weights.some((r, i) => { if (inRect(r, ptr.x, ptr.y)) { a.weight = i; state.hintPlan = null; sfx.tick(); return true; } return false; })) { /* chosen */ }
        else if (!jack && inRect(P.hint, ptr.x, ptr.y)) { requestHint(); sfx.tick(); }
        else if (inRect(P.roll, ptr.x, ptr.y)) { humanRoll(); return; }
        else hit = false;
        if (!hit) {
          if (inRect(P.mini, ptr.x, ptr.y)) state.dragging = 'mini';
          else if (inRect(P.head, ptr.x, ptr.y)) state.dragging = 'head';
        }
      }
      if (state.dragging && ptr.down) {
        if (state.dragging === 'mini') { const p = mp.inv(ptr.x, ptr.y); setAimWorld(p.x, p.y); }
        else { const p = pr.inv(ptr.x + pr.fwd.x * fingerOffset(), ptr.y + pr.fwd.y * fingerOffset()); setAimWorld(p.x, p.y); }
      }
      if (ptr.released && state.dragging) state.dragging = false;
      // keyboard
      const k = 0.012;
      if (keys.down.has('ArrowLeft')) setAimWorld(a.x - k, a.y);
      if (keys.down.has('ArrowRight')) setAimWorld(a.x + k, a.y);
      if (keys.down.has('ArrowUp')) setAimWorld(a.x, a.y + k * 2);
      if (keys.down.has('ArrowDown')) setAimWorld(a.x, a.y - k * 2);
      if (!jack) {
        if (keys.pressed.has('KeyA')) a.hand = -1;
        if (keys.pressed.has('KeyD')) a.hand = 1;
        for (let i = 0; i < 3; i++) if (keys.pressed.has(`Digit${i + 1}`)) a.weight = i;
        if (keys.pressed.has('KeyH')) requestHint();
      }
      if (keys.pressed.has('Space') || keys.pressed.has('Enter')) { humanRoll(); return; }
      refreshPrev();
    } else if (state.dragging) state.dragging = false;
    if (!state.paused) {
      updateHint();
      updateAI(dt);
      if (isAI(m.turn) && (m.phase === 'aim' || m.phase === 'jack') && state.think && state.think.phase === 'reveal') refreshPrev();
    }
    const L2 = L;
    if (state.paused) { updateCam(dt, L2); return; }
    if (state.windup) {
      const u = state.windup;
      u.t += dt;
      if (u.t >= u.dur) { state.windup = null; releaseBowl(u.theta, u.v0, u.hand); }
    }
    // physics: the rolling bowl (or jack)
    if (m.phase === 'fly' || m.phase === 'jack-fly') {
      const w = state.w;
      for (let i = 0; i < state.ff; i++) {
        const ev = stepWorld(w, STEPS_PER_TICK, []);
        if (ev.length) handleEvents(ev);
        const mover = w.balls.find((b) => (m.phase === 'jack-fly' ? b.k : b.id === state.flying && !b.k));
        if (mover && !mover.out && state.trail.length < 1600) state.trail.push(mover.x, mover.y);
        rumble -= dt;
        if (rumble <= 0) {
          let v = 0;
          for (const b of w.balls) if (!b.out) v = Math.max(v, Math.hypot(b.vx, b.vy));
          if (v > 0.15) { tone({ freq: 52 + v * 14, to: 44, dur: 0.14, type: 'sawtooth', vol: Math.min(0.03, 0.008 + v / 200) }); rumble = 0.12; } else rumble = 0.05;
        }
        if (w.settled) { state.restT += dt; if (state.restT > 0.5) { onSettled(); break; } } else state.restT = 0;
      }
    }
    if (m.phase === 'centre') {
      // the jack slides onto the middle line before the first bowl
      const j = theJack(state.w), c = state.centre;
      state.restT += dt;
      if (j) { const k = Math.min(1, state.restT / 0.7); j.x = c ? c.from * (1 - k) : 0; if (k >= 1) { j.x = 0; state.restT = 0; state.centre = null; startAim(); } }
      else startAim();
    }
    // dead bowls fade out
    for (const b of state.w.balls) if (!b.k && b.out && b.vx === 0 && b.vy === 0) b.fade += dt * 0.9;
    if (m.phase !== 'fly') state.w.balls = state.w.balls.filter((b) => b.fade <= 1.1);
    stepParts(state.parts, dt);
    updateCam(dt, L2);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.pop) { state.pop.t += dt; if (state.pop.t > 1.8) state.pop = null; }
    if (m.phase === 'score') {
      m.endInfo.t += dt;
      const auto = watch && m.endInfo.t > 5;
      if ((ptr.pressed && m.endInfo.t > 0.8) || auto || (keys.pressed.has('Space') && m.endInfo.t > 0.8)) afterEnd();
    }
  };

  const leaveMatch = () => { state.windup = null; state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; clearAim(); state.parts = []; };
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
    else if (id.startsWith('grn')) { const c = id.slice(3); if (state.demo && c !== 'village') { state.setupMsg = 'That green is in the full game.'; return; } s.green = c; state.setupMsg = ''; }
    else if (id === 'ends6') s.ends = 6;
    else if (id === 'ends10') s.ends = 10;
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, green: s.green, ends: s.ends });
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
      if (state.restoreBusy || monetization.owns('unlock_game')) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; })
        .catch(() => { state.restoreMsg = 'The store is not available right now. Please try again later.'; })
        .then(() => { state.restoreBusy = false; });
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
    if (k.pressed.has('KeyG') && !state.demo) state.setup.green = GREEN_IDS[(GREEN_IDS.indexOf(state.setup.green) + 1) % GREEN_IDS.length];
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
  const setupShot = () => {
    const kind = (config.seed | 0) % 3;
    if (kind === 2) { state.shot = true; return; }   // the title screen with the attract green (input is ignored, so it stays a title)
    state.record.bowled = 10;
    startMatch({ mode: 'two', opp: 0, green: 'village', ends: 6, lead: 0 });
    const w = state.w, m = state.m;
    const j = newJack(0); j.x = 0; j.y = 27.2;
    const mk = (id, team, x, y, bias) => { const b = newBowl(id, team, bias); b.x = x; b.y = y; return b; };
    w.balls = [j, mk(1, 0, 0.34, 26.8, 1), mk(2, 1, -0.2, 27.6, -1), mk(3, 0, 0.78, 27.7, -1), mk(4, 1, -0.55, 26.6, 1), mk(5, 0, -0.08, 27.0, 1), mk(6, 1, 0.5, 27.4, -1)];
    w.settled = true; m.left = [1, 1]; m.thrown = 6; m.nextId = 7; m.last = 1; m.end = 3; m.scores = [4, 3];
    state.toastT = 0; state.camSnap = true;
    if (kind === 1) { m.left = [0, 0]; m.last = 1; finishEnd(); m.endInfo.t = 2; state.pop = null; }
    else { m.phase = 'aim'; m.turn = 0; state.humanTurn = true; state.aim = { x: 0.15, y: 27.0, hand: -1, weight: 0 }; }
    state.shot = true;
  };
  if (config.shot) setupShot();

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused,
    update(dt, input) {
      if (state.shot) {
        if (state.m) { if (state.m.phase === 'aim') refreshPrev(); updateCam(dt, lay()); } else if (state.att) updateAttract(dt);
        state.t += dt; return;
      }
      setPress(input.pointer);
      state.owned = !!monetization.owns?.('unlock_game');
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
      // landscape: the kit's preview pill would sit on the "End n of 6" line, so park it in the top-left corner of the green, under the map strip
      meta.previewBadge = L.wide && state.scene === 'play' ? { x: L.play.head.x + 10, y: L.play.head.y + 6, align: 'left' } : null;
      switch (state.scene) {
        case 'title': renderTitle(ctx, state, L); break;
        case 'setup': renderSetup(ctx, state, L); break;
        case 'settings': renderSettings(ctx, state, L); break;
        case 'result': renderResult(ctx, state, L); break;
        case 'ladder': renderLadder(ctx, state, L); break;
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
    wheel(dy) { if (['about', 'howto', 'rules'].includes(state.scene)) { state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max); return; } if (['title', 'setup', 'settings', 'result', 'demolimit', 'ladder'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, flowMeta().max); },
    getState: () => state,
    debug: () => ({ lockup: lockupZone(), layout: lay(), flow: flowRects(state.ui.scroll), flowMax: flowMeta().max }),
  };
}
