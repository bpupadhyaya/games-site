// Ulu Maika: state and flow. Physics lives in sim.js, rules in match.js, opponents in ai.js, drawing in view.js / menus.js.
// This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto / about / rules, demolimit.
// A roll: drag on the scope (or the strip) to turn the sight, set the lean, then press the ROLL pad, swipe up (the distance is
// the power) and let go. The disc rolls with the real physics of sim.js; sights, lean and power are all you control.
import {
  H, TRACK_IDS, makeTrack, startRoll, stepRoll, judge, simulate, powerToStopAt, releaseNoise, clamp, ANG_MAX, FAR_R, DISC_R,
} from './sim.js';
import { newMatch, applyRoll, advance } from './match.js';
import { createPlanner, executePlan } from './ai.js';
import { PROFILES } from './opponents.js';
import { inRect, TEXT_SCALES, THINK_STEPS, layoutFor } from './layout.js';
import { renderPlay } from './view.js';
import { stripGeom } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, hitScreen, flowMeta, pageCount, REF, ensureLayout, flowRects, lockupZone } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';
import { gl } from './glhook.js';

// `meta.width/height` are updated live by the kit on every resize (fluid mode: the short side is always 720 units).
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_MATCH_CAP = 3;
const CAM_BACK = 4.0;
const MAX_PARTS = 80;
const PLAYBACK = 2;       // the roll is animated at twice real time so a long roll takes about five seconds

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const isWatch = () => state.scene === 'play' && !!state.m && state.m.cfg.mode === 'watch';
  const lay = () => layoutFor(meta.width, meta.height, isWatch());
  const fx = rng.fork();
  const aiRng = rng.fork();
  const bestInit = () => Object.fromEntries(TRACK_IDS.map((t) => [t, 0]));
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, calm: false, fine: false, textIdx: 0, thinkIdx: 1 },
    record: { wins: [0, 0, 0, 0, 0], played: 0, streak: 0, best: bestInit(), demoMatches: 0, thrown: 0 },
    setup: { mode: 'ai', opp: 0, track: 'meadow', rolls: 6 }, setupMsg: '', restoreMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0,
    att: null, track: makeTrack('meadow'), m: null, labels: [{ name: 'You' }, { name: 'Rival' }],
    aim: { ang: 0, lean: 0 }, hold: { on: false, power: 0, y0: 0 }, lastPower: 0.5, preview: null, ticks: [],
    roll: null, rests: [], pathTrace: [], parts: [], cam: { x: 0, y: -CAM_BACK, yaw: 0 }, scene3: null,
    toast: '', toastT: 0, pop: null, humanTurn: false, restT: 0, think: null, explain: null, hintBusy: false, newBest: false,
    evts: [], sightDrag: null, stripDrag: false, thinkSecs: 5, loaded: false, lk: '', rumble: 0, acc: 0,
  };
  let planner = null, hintPlanner = null, aiPlan = null, previewKey = '';

  // ---- persistence ---------------------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) {
      const best = { ...bestInit(), ...(r.best || {}) };
      Object.assign(state.record, r, { best });
    }
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
    whoosh: () => tone({ freq: 360, to: 130, dur: 0.22, type: 'sawtooth', vol: 0.03 }),
    rumble: (v) => tone({ freq: 62 + v * 9, to: 48 + v * 6, dur: 0.12, type: 'triangle', vol: Math.min(0.07, 0.015 + v * 0.007) }),
    clack: (v) => {
      const q = Math.min(1, v / 6);
      tone({ freq: 1700 + fx.next() * 300, to: 1000, dur: 0.05, type: 'square', vol: 0.015 + 0.04 * q });
      tone({ freq: 640 + fx.next() * 80, to: 380, dur: 0.14, type: 'triangle', vol: 0.05 + 0.1 * q });
    },
    thud: (v) => tone({ freq: 110, to: 55, dur: 0.14, type: 'sine', vol: Math.min(0.2, 0.05 + v / 40) }),
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 210, to: 130, dur: 0.22, type: 'sawtooth', vol: 0.06 }),
    gate: (i = 0) => { tone({ freq: 659 * Math.pow(1.26, i), dur: 0.22, type: 'sine', vol: 0.11 }); tone({ freq: 1318 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.045 }); },
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.12 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- particles -----------------------------------------------------------------------------------------------------------
  const puff = (parts, x, y, n, size = 1, col) => {
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) parts.push({ kind: 0, x, y, z: 0.05, vx: (fx.next() - 0.5) * 1.2, vy: (fx.next() - 0.5) * 0.9, vz: 0.3 + fx.next() * 0.7, t: 0, max: 0.5 + fx.next() * 0.5, size, col });
  };
  const sparks = (parts, x, y, z, n) => {
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) parts.push({ kind: 1, x, y, z: z + 0.1, vx: (fx.next() - 0.5) * 3.5, vy: (fx.next() - 0.5) * 2.5, vz: 1 + fx.next() * 2.5, t: 0, max: 0.25 + fx.next() * 0.25, size: 1.3 });
  };
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= 5 * dt; q.vx *= 0.97; q.vy *= 0.97; if (q.z < 0) { q.z = 0; q.vz = 0; } }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };

  // ---- helpers shared by play and the attract lane ---------------------------------------------------------------------------
  const makeTicks = (track) => {
    const out = [];
    track.gates.forEach((g, i) => out.push({ p: powerToStopAt(track, g.y), label: track.gates.length > 1 ? `G${i + 1}` : 'G' }));
    out.push({ p: powerToStopAt(track, track.far.y - FAR_R - DISC_R), label: 'F' });
    return out;
  };
  let evId = 0;
  const handleEvents = (ev, parts) => {
    for (const e of ev) {
      state.evts.push({ ...e, id: ++evId, tt: state.t }); if (state.evts.length > 16) state.evts.shift();
      if (e.t === 'stake') { sparks(parts, e.x, e.y, 0.5, 4); sfx.clack(e.v); }
      else if (e.t === 'rock') { puff(parts, e.x, e.y, 5, 1.3); sfx.thud(e.v); }
      else if (e.t === 'far') { sparks(parts, e.x, e.y, 0.8, 9); sfx.clack(e.v + 2); sfx.chime(2); }
      else if (e.t === 'gate') { sparks(parts, e.x, e.y, 0.3, 6); sfx.gate(e.i); }
      else if (e.t === 'out') sfx.no();
    }
  };
  const camFollow = (cam, roll, yaw, dt, fast, hold, track) => {
    const k = Math.min(1, dt * (fast ? 5 : 3));
    const at = roll ? roll.s : hold || null, back = CAM_BACK, far = track.len - (roll ? 5.5 : 8);
    const ty = at ? clamp(at.y - back, -CAM_BACK, Math.max(-CAM_BACK, far)) : -CAM_BACK, tx = at ? at.x * 0.55 : 0;
    cam.y += (ty - cam.y) * k; cam.x += (tx - cam.x) * k; cam.yaw = yaw;
  };

  // ---- the attract lane behind the menus -----------------------------------------------------------------------------------------
  const startAttract = () => {
    const track = makeTrack('meadow');
    state.att = { track, rests: [], roll: null, parts: [], cam: { x: 0, y: -CAM_BACK, yaw: 0.02 }, wait: 1.2, n: 0, pf: powerToStopAt(track, track.len - 0.3), acc: 0 };
    state.att.scene = { track, cam: state.att.cam, t: 0, rests: state.att.rests, roll: null, held: { x: 0, y: 0, side: 0 }, preview: null, parts: state.att.parts, pathTrace: [] };
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    a.scene.t = state.t;
    if (!a.roll) {
      a.wait -= dt;
      a.scene.held = { x: 0, y: 0, side: a.n % 2 };
      if (a.wait <= 0) {
        if (a.rests.length >= 4) a.rests.length = 0;
        const ang = (a.n % 3 === 0 ? 0 : a.n % 3 === 1 ? 0.012 : -0.008) + (fx.next() - 0.5) * 0.004;
        a.roll = { s: startRoll(a.track, { ang, power: clamp(a.pf * (0.94 + fx.next() * 0.1), 0.2, 1), lean: 0 }), side: a.n % 2 };
        a.cam.yaw = ang; a.scene.roll = a.roll; a.scene.held = null; a.n++; a.acc = 0;
      }
    } else {
      a.acc += dt * PLAYBACK;
      const ev = [];
      while (a.acc >= H && !a.roll.s.rest && !a.roll.s.out) { stepRoll(a.track, a.roll.s, ev); a.acc -= H; }
      for (const e of ev) { if (e.t === 'far' || e.t === 'stake') sparks(a.parts, e.x, e.y, 0.5, 4); state.evts.push({ ...e, id: ++evId, tt: state.t }); if (state.evts.length > 16) state.evts.shift(); }
      if (a.roll.s.rest || a.roll.s.out) {
        a.rests.push({ x: a.roll.s.x, y: a.roll.s.y, side: a.roll.side, out: a.roll.s.out, spin: a.n });
        a.roll = null; a.scene.roll = null; a.wait = 2.6;
      }
    }
    stepParts(a.parts, dt);
  };

  // ---- match flow ----------------------------------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  // who rolls: a profile (computer) or null (a person)
  const playerOf = (side) => {
    const c = state.m.cfg;
    if (c.mode === 'watch') return side === 0 ? PROFILES[c.watchA] : PROFILES[c.opp];
    if (c.mode === 'two' || c.mode === 'solo') return null;
    return side === 0 ? null : PROFILES[c.opp];
  };
  const isAI = (side) => playerOf(side) !== null;
  const makeLabels = (c) => {
    if (c.mode === 'two') return [{ name: 'Player 1' }, { name: 'Player 2' }];
    if (c.mode === 'watch') return [{ name: PROFILES[c.watchA].name }, { name: PROFILES[c.opp].name }];
    if (c.mode === 'solo') return [{ name: 'You' }, { name: 'Best' }];
    return [{ name: 'You' }, { name: PROFILES[c.opp].name }];
  };
  const resetTurnState = () => {
    state.think = null; planner = null; aiPlan = null; state.explain = null; state.hold = { on: false, power: 0, y0: 0 };
    state.sightDrag = null; state.stripDrag = false; previewKey = '';
  };
  const beginTurn = () => {
    const m = state.m;
    m.phase = 'aim'; m.phaseT = 0;
    resetTurnState();
    state.roll = null; state.pathTrace = [];
    state.humanTurn = !isAI(m.turn);
    state.aim = { ang: 0, lean: 0 };
    if (state.humanTurn) {
      // start the sight on the first gate so the first look is already sensible
      const g = state.track.gates[0];
      state.aim.ang = clamp(Math.atan2(g.x, g.y), -ANG_MAX, ANG_MAX);
      if ((state.record.thrown | 0) < 3) toast('Drag the picture to turn the sight. Press ROLL, swipe up, let go.', 4.5);
      else if (m.cfg.mode === 'two') toast(`${state.labels[m.turn].name}: your roll`, 1.6);
    }
  };
  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoMatches >= DEMO_MATCH_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const full = { track: 'meadow', rolls: 6, mode: 'ai', opp: 0, watchA: 2, lead: aiRng.int(2), ...cfg };
    if (state.demo && full.mode !== 'watch') full.rolls = 3;
    state.track = makeTrack(full.track, config.day | 0);
    state.m = newMatch(full);
    state.labels = makeLabels(full);
    state.ticks = makeTicks(state.track);
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.rests = []; state.parts = []; state.pop = null; state.roll = null; state.pathTrace = []; state.newBest = false;
    state.hintBusy = false; hintPlanner = null; state.lastPower = 0.5;
    state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
    state.cam = { x: 0, y: -CAM_BACK, yaw: 0 };
    beginTurn();
  };
  const startWatch = () => {
    const picks = [1, 2, 3, 4];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, track: TRACK_IDS[aiRng.int(4)], rolls: 3 });
  };

  // Release a disc. p = {ang, power, lean} (already including any release wobble)
  const doRoll = (side, p) => {
    const m = state.m;
    state.roll = { s: startRoll(state.track, p), side };
    state.pathTrace = [{ x: 0, y: 0 }];
    state.aim = { ang: p.ang, lean: p.lean };
    m.phase = 'roll'; m.phaseT = 0;
    state.humanTurn = false; state.preview = null; state.think = null; state.explain = null;
    state.hold = { on: false, power: 0, y0: 0 }; planner = null; hintPlanner = null; state.hintBusy = false; state.restT = 0; aiPlan = null;
    state.acc = 0; state.rumble = 0;
    if (!isAI(side)) state.record.thrown = (state.record.thrown | 0) + 1;
    sfx.whoosh();
  };
  const humanRelease = (power) => {
    const m = state.m, a = state.aim;
    const n1 = fx.next() + fx.next() - 1, n2 = fx.next() + fx.next() - 1;
    const e = releaseNoise(power, state.settings.calm, n1, n2);
    state.lastPower = power;
    doRoll(m.turn, { ang: clamp(a.ang + e.dAng, -ANG_MAX - 0.02, ANG_MAX + 0.02), power: clamp(power * (1 + e.dPow), 0.02, 1), lean: a.lean });
  };

  const finishRoll = () => {
    const m = state.m, r = state.roll;
    const res = judge(state.track, r.s);
    state.rests.push({ x: r.s.x, y: r.s.y, side: r.side, out: r.s.out, spin: m.no });
    state.roll = null;
    applyRoll(m, r.side, res);
    m.phase = 'result'; m.phaseT = 0;
    if (res.points > 0) { state.pop = { text: `+${res.points}`, t: 0 }; for (let i = 0; i < Math.min(res.points, 4); i++) sfx.chime(i); } else sfx.no();
  };

  const afterRoll = () => {
    const m = state.m;
    const next = advance(m);
    if (m.over) {
      state.scene = 'result'; state.ui.scroll = 0;
      const win = m.over.win === 0;
      if (m.cfg.mode === 'ai') {
        state.record.played++;
        if (win) { state.record.wins[m.cfg.opp]++; state.record.streak++; } else if (m.over.win === 1) state.record.streak = 0;
      }
      const id = state.track.id;
      if (m.cfg.mode === 'solo' && m.scores[0] > (state.record.best[id] | 0)) { state.record.best[id] = m.scores[0]; state.newBest = true; }
      if (m.cfg.mode !== 'watch') state.record.demoMatches++;
      if (win && m.cfg.mode !== 'watch' && m.cfg.mode !== 'two') sfx.win();
      save();
      return;
    }
    m.turn = next;
    beginTurn();
  };

  // ---- aiming ---------------------------------------------------------------------------------------------------------------
  const setAng = (a) => { state.aim.ang = clamp(a, -ANG_MAX, ANG_MAX); };
  const setLean = (l) => { state.aim.lean = clamp(l, -2, 2); };
  const refreshPreview = () => {
    if (!state.m || state.m.phase !== 'aim' || !(state.humanTurn || state.m.cfg.mode === 'watch')) { state.preview = null; return; }
    const a = state.aim, live = state.hold.on, power = live ? state.hold.power : state.lastPower;
    const key = `${Math.round(a.ang * 4000)}|${Math.round(power * 200)}|${a.lean}|${live}|${state.track.id}`;
    if (key === previewKey) return;
    previewKey = key;
    if (power < 0.02) { state.preview = { path: [], power, faint: !live }; return; }
    const r = simulate(state.track, { ang: a.ang, power, lean: a.lean }, { every: 8 });
    state.preview = { path: r.path, power, faint: !live, res: r.result };
  };

  const describePlan = (plan) => {
    const p = plan.params, deg = Math.abs((p.ang * 180) / Math.PI).toFixed(1);
    const dir = p.ang < -0.002 ? `${deg}° left` : p.ang > 0.002 ? `${deg}° right` : 'straight';
    const lean = p.lean === 0 ? 'no lean' : p.lean < 0 ? `lean left ${-p.lean}` : `lean right ${p.lean}`;
    return `sight ${dir}, ${lean}, power ${Math.round(p.power * 100)}%`;
  };

  // ---- computer turn --------------------------------------------------------------------------------------------------------
  const beginAISwipe = (th) => {
    const m = state.m, prof = playerOf(m.turn);
    const p = executePlan(aiPlan, prof, aiRng);
    th.p = p; th.phase = 'swipe'; th.t = 0; th.dur = 0.7;
    state.aim = { ang: p.ang, lean: p.lean }; previewKey = '';
    if (mode() !== 'watch') state.explain = null;
  };
  const updateAI = (dt) => {
    const { m } = state;
    if (m.phase !== 'aim' || !isAI(m.turn) || state.paused) return;
    const prof = playerOf(m.turn), watch = mode() === 'watch';
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur, phase: 'think' };
      planner = createPlanner(state.track, prof, aiRng);
    }
    const th = state.think;
    th.t += dt;
    if (planner && !planner.done) {
      planner.step(12);
      state.explain = { head: `${state.labels[m.turn].name} is thinking…`, lines: watch ? [`Tried ${planner.sims} rolls on a copy of the course`, 'Looking for the gate, the far stake and a roll that survives a wobble'] : [] };
      if (planner.done) { aiPlan = planner.result; planner = null; }
    }
    if (th.phase === 'think' && th.t >= th.dur && aiPlan) {
      if (watch) {
        th.phase = 'reveal'; th.t = 0; th.dur = 2;
        const q = aiPlan.params;
        state.lastPower = q.power; state.aim = { ang: q.ang, lean: q.lean }; previewKey = '';
        toast(`${state.labels[m.turn].name}: ${describePlan(aiPlan)}`, 2.2);
        state.explain = { head: `${state.labels[m.turn].name} chooses: ${describePlan(aiPlan)}`, lines: aiPlan.alts.map((a, i) => `${i + 1}. ${describePlan(a)}  (value ${a.score.toFixed(1)})`) };
      } else beginAISwipe(th);
    } else if (th.phase === 'reveal' && th.t >= th.dur) beginAISwipe(th);
    else if (th.phase === 'swipe') {
      const k = clamp(th.t / th.dur, 0, 1);
      state.hold = { on: true, power: th.p.power * k, y0: 0 };
      if (th.t >= th.dur) doRoll(m.turn, th.p);
    }
  };

  // ---- the play scene -------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };

  const requestHint = () => {
    const m = state.m;
    if (state.hintBusy || m.phase !== 'aim') return;
    state.hintBusy = true;
    hintPlanner = createPlanner(state.track, PROFILES[PROFILES.length - 1], aiRng);
    toast('Looking for a good roll…', 1.2);
  };
  const updateHint = () => {
    if (!hintPlanner) return;
    hintPlanner.step(16);
    if (hintPlanner.done) {
      const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.m.phase !== 'aim' || !state.humanTurn) return;
      state.aim = { ang: r.params.ang, lean: r.params.lean }; state.lastPower = r.params.power; previewKey = '';
      toast(`Hint: ${describePlan(r)}. Swipe the pad to the marker.`, 4);
    }
  };

  const stepRollFrame = (dt, input) => {
    const r = state.roll;
    if (!r) return;
    const ff = input.pointer.down ? 3 : 1;
    const ev = [];
    state.acc += dt * ff * PLAYBACK;
    let n = 0;
    while (state.acc >= H && !r.s.rest && !r.s.out && n < 120) { stepRoll(state.track, r.s, ev); state.acc -= H; n++; }
    if (ev.length) handleEvents(ev, state.parts);
    const last = state.pathTrace[state.pathTrace.length - 1];
    if (!last || Math.hypot(r.s.x - last.x, r.s.y - last.y) > 0.25) state.pathTrace.push({ x: r.s.x, y: r.s.y });
    const v = Math.hypot(r.s.vx, r.s.vy);
    state.rumble -= dt * ff * PLAYBACK;
    if (state.rumble <= 0 && v > 0.3) { sfx.rumble(v); state.rumble = 0.13; }
    if (v > 1.5 && fx.next() < 0.08) puff(state.parts, r.s.x, r.s.y, 1, 0.8, '150,200,120');
    if (r.s.rest || r.s.out) {
      state.restT += dt;
      if (state.restT > 0.5) finishRoll();
    } else state.restT = 0;
  };

  const updatePlay = (dt, input) => {
    const { m } = state;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch', L = lay(), P = L.play;
    if (state.lk !== L.key) { state.lk = L.key; }
    meta.previewBadge = { x: P.scope.x + P.scope.w - 70, y: P.scope.y + 10, align: 'right' };
    if (config.dev && keys.pressed.has('KeyK')) { m.scores[0] = 99; m.rolls = [m.cfg.rolls, m.cfg.rolls]; advance(m); state.scene = 'result'; return; }
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

    const aimPhase = m.phase === 'aim' && state.humanTurn && !state.paused;
    if (aimPhase) {
      const fine = state.settings.fine ? 0.4 : 1, f = P.scope.w * 0.9;
      if (ptr.pressed) {
        let hit = false;
        if (inRect(P.leanDec, ptr.x, ptr.y)) { hit = true; setLean(state.aim.lean - 1); sfx.tick(); }
        else if (inRect(P.leanInc, ptr.x, ptr.y)) { hit = true; setLean(state.aim.lean + 1); sfx.tick(); }
        else if (inRect(P.leanShow, ptr.x, ptr.y)) { hit = true; setLean(0); sfx.tick(); }
        else if (inRect(P.hint, ptr.x, ptr.y)) { hit = true; requestHint(); sfx.tick(); }
        else if (inRect(P.pad, ptr.x, ptr.y)) { hit = true; state.hold = { on: true, power: 0, y0: ptr.y }; sfx.tick(); previewKey = ''; }
        if (!hit) {
          if (inRect(P.scope, ptr.x, ptr.y)) state.sightDrag = { x0: ptr.x, a0: state.aim.ang };
          else if (inRect(P.map, ptr.x, ptr.y)) state.stripDrag = true;
        }
      }
      if (state.sightDrag && ptr.down) setAng(state.sightDrag.a0 - ((ptr.x - state.sightDrag.x0) / f) * fine);
      if (state.stripDrag && ptr.down) {
        const G = stripGeom(P.map, state.track), y = (ptr.x - G.x0) / G.k, x = (ptr.y - G.cy) / G.k;
        if (y > 1) setAng(Math.atan2(x, y));
      }
      if (!ptr.down) { state.sightDrag = null; state.stripDrag = false; }
      // the swipe on the pad
      if (state.hold.on) {
        state.hold.power = clamp((state.hold.y0 - ptr.y) / P.padDrag, 0, 1);
        if (!ptr.down) {
          const pw = state.hold.power;
          state.hold = { on: false, power: 0, y0: 0 };
          if (pw >= 0.06) humanRelease(pw); else toast('Swipe up from the pad: the farther, the harder', 2.2);
        }
      }
      // keyboard
      const kf = keys.down.has('ShiftLeft') || keys.down.has('ShiftRight') ? 0.25 : 1;
      if (keys.down.has('ArrowLeft')) setAng(state.aim.ang - 0.0035 * kf);
      if (keys.down.has('ArrowRight')) setAng(state.aim.ang + 0.0035 * kf);
      if (keys.pressed.has('KeyQ') || keys.pressed.has('BracketLeft')) setLean(state.aim.lean - 1);
      if (keys.pressed.has('KeyE') || keys.pressed.has('BracketRight')) setLean(state.aim.lean + 1);
      if (keys.down.has('ArrowUp')) state.lastPower = clamp(state.lastPower + 0.006 * kf, 0.05, 1);
      if (keys.down.has('ArrowDown')) state.lastPower = clamp(state.lastPower - 0.006 * kf, 0.05, 1);
      if (keys.pressed.has('KeyH')) requestHint();
      if (keys.pressed.has('Space') && !state.hold.on) humanRelease(state.lastPower);
    } else if (!state.humanTurn) { state.sightDrag = null; state.stripDrag = false; }

    refreshPreview();
    if (state.paused) return;
    updateHint();
    updateAI(dt);
    const lastRest = m.phase === 'result' ? state.rests[state.rests.length - 1] : null;
    camFollow(state.cam, state.roll, state.aim.ang, dt, m.phase === 'roll', lastRest, state.track);
    if (m.phase === 'roll') stepRollFrame(dt, input);
    stepParts(state.parts, dt);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.pop) { state.pop.t += dt; if (state.pop.t > 1.8) state.pop = null; }
    if (m.phase === 'result') {
      m.phaseT += dt;
      const auto = m.phaseT > (watch ? 3.6 : 7);
      if ((ptr.pressed && m.phaseT > 0.7) || auto || (keys.pressed.has('Space') && m.phaseT > 0.7)) afterRoll();
    }
  };

  function leaveMatch() { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; resetTurnState(); hintPlanner = null; state.hintBusy = false; state.roll = null; }
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'p-calm') { state.settings.calm = !state.settings.calm; save(); }
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
    else if (id === 'solo') openSetup('solo');
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
    else if (id.startsWith('trk')) { const c = id.slice(3); if (state.demo && c !== 'meadow' && c !== 'slope') { state.setupMsg = 'That course is in the full game.'; return; } s.track = c; state.setupMsg = ''; }
    else if (id === 'len6') s.rolls = 6;
    else if (id === 'len3') s.rolls = 3;
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, track: s.track, rolls: s.rolls });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-calm') st.calm = !st.calm;
    else if (id === 'set-fine') st.fine = !st.fine;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') { st.thinkIdx = Math.max(0, st.thinkIdx - 1); state.thinkSecs = THINK_STEPS[st.thinkIdx]; }
    else if (id === 'think-inc') { st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1); state.thinkSecs = THINK_STEPS[st.thinkIdx]; }
    else if (id === 'restore') {
      if (state.demo || state.restoreBusy || monetization.owns('unlock_game')) { save(); return; }
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreBusy = false; state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found for this account.'; })
        .catch(() => { state.restoreBusy = false; state.restoreMsg = 'The store is not available right now. Please try again later.'; });
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
    if (k.pressed.has('KeyO') && state.setup.mode === 'ai') state.setup.opp = (state.setup.opp + 1) % (state.demo ? 2 : PROFILES.length);
    if (k.pressed.has('KeyC')) { const ids = state.demo ? ['meadow', 'slope'] : TRACK_IDS; state.setup.track = ids[(ids.indexOf(state.setup.track) + 1) % ids.length] || ids[0]; }
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

  const buildScene3 = () => {
    const m = state.m;
    const aimed = m.phase === 'aim' && !state.roll;
    state.scene3 = {
      track: state.track, cam: state.cam, t: state.t, rests: state.rests, roll: state.roll, parts: state.parts, pathTrace: state.pathTrace,
      held: aimed ? { x: 0, y: 0, side: m.turn } : null, preview: aimed ? state.preview : null,
    };
  };

  // What the 3D layer should show this frame (see src/glhook.js): the play scene in the scope window, or the attract lane full-screen
  // behind the menus. Pure data; the presenter never writes back.
  const buildFrame = (L) => {
    if (state.scene === 'play' && state.m) {
      const m = state.m, aimed = m.phase === 'aim' && !state.roll;
      return {
        mode: 'play', rect: L.play.scope, W: L.w, H: L.h, track: state.track, cam: state.cam, sides: m.sides, turn: m.turn, phase: m.phase,
        humanTurn: state.humanTurn, aim: state.aim, hold: state.hold, roll: state.roll, rests: state.rests, held: aimed ? { side: m.turn } : null,
        preview: aimed ? state.preview : null, pathTrace: state.pathTrace, parts: state.parts, evts: state.evts, paused: state.paused, t: state.t,
      };
    }
    const a = state.att;
    if (!a) return null;
    const turn = a.roll ? a.roll.side : a.n % 2;
    return {
      mode: 'hero', rect: { x: 0, y: 0, w: L.w, h: L.h }, W: L.w, H: L.h, track: a.track, cam: a.cam, sides: 2, turn, phase: a.roll ? 'roll' : 'aim',
      humanTurn: false, aim: { ang: a.cam.yaw, lean: 0 }, hold: { on: false, power: 0 }, roll: a.roll, rests: a.rests, held: a.roll ? null : { side: turn },
      preview: null, pathTrace: [], parts: a.parts, evts: state.evts, paused: false, t: state.t, scene: state.scene, wide: L.wide,
    };
  };

  const api = {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused,
    update(dt, input) {
      if (state.shotLock) return;                    // store-screenshot scenes (shotScene) are frozen
      setPress(input.pointer);
      state.owned = !!monetization.owns?.('unlock_game');
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
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height, isWatch());
      if (gl.active) { ctx.clearRect(0, 0, L.w, L.h); gl.frame = buildFrame(L); }
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
          if (state.m) { buildScene3(); renderPlay(ctx, state, L); }
          if (state.pauseMenu) renderPause(ctx, state, L);
          break;
        default: break;
      }
    },
    wheel(dy) { if (['about', 'howto', 'rules'].includes(state.scene)) { state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max); return; } if (['title', 'setup', 'settings', 'result', 'demolimit'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, flowMeta().max); },
    getState: () => state,
    // Dev / verification only (main.js calls it for ?dev=1&scene=...): jump straight to a screen.
    devJump(scene, o = {}) {
      if (['title', 'settings', 'about', 'howto', 'rules', 'setup'].includes(scene)) { state.scene = scene; state.back = 'title'; state.refScroll = 0; state.ui.scroll = 0; if (o.text !== undefined) state.settings.textIdx = clamp(o.text | 0, 0, TEXT_SCALES.length - 1); return; }
      if (o.text !== undefined) state.settings.textIdx = clamp(o.text | 0, 0, TEXT_SCALES.length - 1);
      startMatch({ mode: o.mode || 'ai', opp: o.opp ?? 1, track: o.track || 'meadow', rolls: 6, lead: 0 });
      if (scene === 'pause') { state.paused = true; state.pauseMenu = true; }
      if (scene === 'result') { state.m.scores[0] = 11; state.m.scores[1] = 7; state.m.rolls = [state.m.cfg.rolls, state.m.cfg.rolls]; advance(state.m); state.scene = 'result'; state.ui.scroll = 0; }
    },
    // Store screenshots only (main.js calls it for ?shot=1): builds a real, repeatable scene by playing the engine with a
    // scripted player, then freezes the game. kind 'mid' = four discs already resting, 'aim' = a fresh turn with the sight on the first gate, 'roll' = a disc
    // part-way up the lane, 'result' = a finished practice match. trackIdx picks the course.
    shotScene(kind, trackIdx = 0) {
      const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { pressed: new Set(), down: new Set() } };
      const tick = () => api.update(1 / 60, idle);
      state.settings.thinkIdx = 0;
      startMatch({ mode: 'solo', track: TRACK_IDS[trackIdx] || 'meadow', rolls: 6, lead: 0 });
      state.toast = ''; state.toastT = 0;
      const roll = () => {
        const far = state.ticks[state.ticks.length - 1].p;
        humanRelease(far);
      };
      for (let i = 0; i < 30; i++) tick();
      if (kind === 'aim') { requestHint(); for (let i = 0; i < 3000 && state.hintBusy; i++) tick(); for (let i = 0; i < 20; i++) tick(); }
      state.toast = ''; state.toastT = 0;
      if (kind === 'roll' || kind === 'result' || kind === 'mid') {
        let guard = 0;
        const throwsLeft = kind === 'result' ? 99 : kind === 'mid' ? 4 : 1;
        let thrown = 0;
        while (guard++ < 60000 && state.scene === 'play') {
          if (state.humanTurn && state.m.phase === 'aim' && !state.roll) {
            if (thrown >= throwsLeft) break;
            roll(); thrown++;
            if (kind === 'roll') { for (let i = 0; i < 70; i++) tick(); break; }
          }
          tick();
        }
        if (kind === 'result') { for (let i = 0; i < 30; i++) tick(); }
        if (kind === 'mid') { for (let i = 0; i < 240; i++) tick(); }
        state.toast = ''; state.toastT = 0;
      }
      state.shotLock = true;
    },
    debug: () => ({ lockup: lockupZone(), layout: lay(), flow: flowRects(state.ui.scroll), flowMax: flowMeta().max, pages: pageCount() }),
  };
  return api;
}
