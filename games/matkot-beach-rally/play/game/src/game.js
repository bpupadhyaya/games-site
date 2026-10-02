// Matkot Beach Rally: state and flow. Physics and rules live in sim.js, the computer players in ai.js, drawing in view.js and
// menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto / about / rules, demolimit.
// Controls: press anywhere and drag to run (the figure keeps its offset from your thumb); lift the thumb to swing.
import { W, H, project, unproject, clamp } from './cam.js';
import { newWorld, step, toss, REACH, MID, shotFor, canHit } from './sim.js';
import { newAI, aiTick, coachPlan } from './ai.js';
import { PROFILES, PARTNER, COACH } from './opponents.js';
import { lightAt } from './art.js';
import { renderScene, drawHud, drawBanner, drawThink, drawPlan, drawReticle, dropPoint, ring, tierOf, TIER_NAMES } from './view.js';
import { inRect, PAUSE_BTN, HINT_BTN, WATCH_BAR, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, TEXT_SCALES, THINK_STEPS, SETUP_PINS } from './layout.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, hitScreen, flowMeta, pageCount, ensureLayout } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export const meta = { width: W, height: H };
export const DEMO_RALLY_CAP = 6;
const SHOT = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();
const SHOT_SC = (() => { try { return new URLSearchParams(globalThis.location.search).get('sc'); } catch { return null; } })();
const SHOT_ZOOM = (() => { try { return Number(new URLSearchParams(globalThis.location.search).get('zoom')) || 0; } catch { return 0; } })();
const SHOT_PAGE = (() => { try { return Number(new URLSearchParams(globalThis.location.search).get('page')) || 0; } catch { return 0; } })();
const SHOT_SEED = (() => { try { return Number(new URLSearchParams(globalThis.location.search).get('seed')) || 1; } catch { return 1; } })();
const SHOT_HUMAN = (() => { try { return ['guide', 'hint', 'pause', 'coophuman'].includes(new URLSearchParams(globalThis.location.search).get('sc')); } catch { return false; } })();
const READY_SECS = 1.0, POINT_SECS = 1.7, REVEAL_SECS = 2;
const LIGHT_POS = [0, 1, 2];     // Morning, Afternoon, Golden hour
export const WINDS = [0, 0.35, 0.85];
export const WIND_NAMES = ['None', 'Breeze', 'Gusty'];

export function createGame(env) {
  const { audio, storage, config, monetization, rng } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();
  const worldRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, shot: SHOT, btnPress: false,
    settings: { sound: true, calm: false, guides: true, textIdx: 0, thinkIdx: 1 },
    record: { bestRally: 0, bestScore: 0, wins: [0, 0, 0, 0, 0], played: 0, rallies: 0, demoRallies: 0 },
    setup: { opp: 0, to: 7, light: 1, wind: 0 }, setupMsg: '', restoreMsg: '',
    ui: { scroll: 0, drag: null }, page: 0, run: null, att: null, hold: null, kbOn: false,
    hintOk: false, thinkSecs: THINK_STEPS[1], loaded: false, toast: '', toastT: 0,
  };
  let ais = [null, null], attAIs = [null, null];

  // ---- persistence ---------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound -----------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    tok: (h, speed) => {
      const q = clamp(speed / 8, 0.3, 1);
      tone({ freq: 1500 - h * 160, to: 620, dur: 0.05, type: 'triangle', vol: 0.1 + 0.08 * q });
      tone({ freq: 300 + h * 60, to: 190, dur: 0.1, type: 'sine', vol: 0.14 });
    },
    chime: (i = 0) => { tone({ freq: 660 * Math.pow(1.122, Math.min(i, 10)), dur: 0.22, type: 'sine', vol: 0.09 }); tone({ freq: 990 * Math.pow(1.122, Math.min(i, 10)), dur: 0.3, type: 'sine', vol: 0.05 }); },
    swish: () => tone({ freq: 700, to: 240, dur: 0.16, type: 'sawtooth', vol: 0.025 }),
    thud: (v) => tone({ freq: 130, to: 55, dur: 0.14, type: 'sine', vol: clamp(0.08 + v / 60, 0.08, 0.2) }),
    no: () => tone({ freq: 260, to: 150, dur: 0.24, type: 'triangle', vol: 0.07 }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.28 + i * 0.05, type: 'triangle', vol: 0.09 })),
    tier: () => [0, 7, 12, 16].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.35 + i * 0.06, type: 'sine', vol: 0.09 })),
  };
  const toast = (text, secs = 2.2) => { state.toast = text; state.toastT = secs; };

  // ---- worlds and effects -----------------------------------------------------------------------------------
  const makeWorld = (o) => {
    const w = newWorld({ ...o, rng: worldRng.fork() });
    const r = w.rng;
    delete w.rng;
    Object.defineProperty(w, 'rng', { value: r, enumerable: false, writable: true });
    return w;
  };
  const MAX_PARTS = 120;
  const addPart = (parts, q) => { if (parts.length < MAX_PARTS) parts.push(q); };
  const puff = (parts, x, y, n, z = 0.05, size = 1) => {
    for (let i = 0; i < n; i++) addPart(parts, { kind: 0, x: x + (fx.next() - 0.5) * 0.3, y: y + (fx.next() - 0.5) * 0.3, z, vx: (fx.next() - 0.5) * 1.6, vy: (fx.next() - 0.5) * 1.6, vz: 0.6 + fx.next() * 1.4, t: 0, max: 0.5 + fx.next() * 0.4, size });
  };
  const sparks = (parts, x, y, z, n) => {
    for (let i = 0; i < n; i++) addPart(parts, { kind: 1, x, y, z, vx: (fx.next() - 0.5) * 6, vy: (fx.next() - 0.5) * 6, vz: 1 + fx.next() * 3, t: 0, max: 0.25 + fx.next() * 0.2 });
  };
  const ringFx = (parts, x, y, z, size, col) => addPart(parts, { kind: 2, x, y, z, vx: 0, vy: 0, vz: 0, t: 0, max: 0.4, size, col });
  const popText = (parts, x, y, z, text, col, size = 34) => addPart(parts, { kind: 3, x, y, z, vx: 0, vy: 0, vz: 0, t: 0, max: 1.1, text, col, size });
  const confetti = (parts, n) => {
    const cols = ['#ffc24b', '#ff6a4a', '#14a3b4', '#ffffff', '#3bb273'];
    for (let i = 0; i < n; i++) addPart(parts, { kind: 4, x: (fx.next() - 0.5) * 8, y: 3 + fx.next() * 4, z: 4 + fx.next() * 2, vx: (fx.next() - 0.5) * 3, vy: (fx.next() - 0.5) * 3, vz: 1 + fx.next() * 3, t: 0, max: 1.4 + fx.next() * 0.6, col: cols[i % cols.length], rot: fx.next() * 6 });
  };
  const stepParts = (parts, dt) => {
    for (const q of parts) {
      q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.kind === 0 || q.kind === 1 || q.kind === 4) q.vz -= 9 * dt;
      if (q.kind === 0 && q.z < 0.02) { q.z = 0.02; q.vz = 0; q.vx *= 0.8; q.vy *= 0.8; }
    }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };
  const pushTrail = (trail, b) => { trail.push({ x: b.x, y: b.y, z: b.z }); if (trail.length > 12) trail.shift(); };

  // ---- the attract world behind the menus --------------------------------------------------------------------------
  const startAttract = () => {
    const w = makeWorld({ wind: 0, pace: 1.1 });
    w.p[0].speed = 4.6; w.p[1].speed = 4.6;
    attAIs = [newAI(PARTNER, aiRng.fork()), newAI(PARTNER, aiRng.fork())];
    state.att = { w, parts: [], trail: [], t: 0, wait: 0.5, n: 0 };
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    const w = a.w;
    if (w.phase === 'dead' || w.phase === 'idle') {
      a.wait -= dt;
      if (a.wait <= 0) { toss(w, a.n % 2, (fx.next() - 0.5) * 0.4); attAIs.forEach((x) => { x.plan = null; x.key = -2; }); a.trail = []; a.n++; }
    }
    const ctrl = [aiTick(w, 0, attAIs[0], { coop: true, difficulty: 0.1, stretch: 0.25 }), aiTick(w, 1, attAIs[1], { coop: true, difficulty: 0.1, stretch: 0.25 })];
    const ev = step(w, dt, ctrl);
    if (w.b.live) pushTrail(a.trail, w.b);
    for (const e of ev) {
      if (e.t === 'hit') { ringFx(a.parts, e.x, e.y, e.z, 0.5, 'rgba(255,255,255,A)'); sparks(a.parts, e.x, e.y, e.z, 4); if (state.scene === 'title' && !SHOT) sfx.tok(e.h, e.speed * 0.5); }
      else if (e.t === 'land') { puff(a.parts, e.x, e.y, 6); a.wait = 1.2; }
    }
    if (w.phase === 'rally' && w.hits > 24) { w.b.live = false; w.phase = 'dead'; a.wait = 0.3; }
    stepParts(a.parts, dt);
    a.t += dt;
  };

  // ---- runs --------------------------------------------------------------------------------------------------------------
  const banner = (text, sub = null, dur = 1.6, size = 44, extra = {}) => { state.run.banner = { text, sub, t: 0, dur, size, ...extra }; };
  const resetAIs = () => ais.forEach((a) => { if (a) { a.plan = null; a.key = -2; } });
  const tossBall = () => {
    const r = state.run, w = r.w;
    const isHuman = !r.auto[r.serve];
    if (r.mode !== 'coop') w.wind = r.windBase * (fx.next() < 0.5 ? -1 : 1);
    toss(w, r.serve, isHuman ? (fx.next() < 0.5 ? -1 : 1) * (0.1 + fx.next() * 0.25) : (fx.next() - 0.5) * 0.4);
    r.phase = 'play'; r.phaseT = 0; r.rally = 0; r.trail = [];
    resetAIs();
  };
  const beginRally = () => {
    const r = state.run, w = r.w;
    r.phase = 'ready'; r.phaseT = 0; r.rally = 0; r.guide = null; r.think = null; r.trail = [];
    w.phase = 'idle'; w.b.live = false; w.b.rest = true; w.b.z = -5; w.verdict = null;
    for (const p of w.p) { p.swingT = -1; p.vx = 0; p.vy = 0; }
    w.p[0].tx = w.p[0].x; w.p[0].ty = w.p[0].y;
    banner(r.mode === 'coop' ? 'Dana serves' : r.serve === 0 && !r.auto[0] ? 'Your serve' : `${r.names[r.serve]} serves`, r.mode === 'match' && r.serve === 0 ? 'Wait for the toss, then lift your thumb to swing' : r.mode === 'coop' ? 'Lift your thumb to swing at the ball' : null, 1.0, 40, { y: 320 });
    resetAIs();
  };

  const startRun = (cfg) => {
    const mode = cfg.mode;
    if (state.demo && mode !== 'watch' && state.record.demoRallies >= DEMO_RALLY_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const calm = state.settings.calm;
    const w = makeWorld({ wind: 0, pace: calm ? 1.15 : 1, p0: { reach: calm ? 1.5 : REACH } });
    let oppProf, names, looks, auto;
    if (mode === 'coop') { oppProf = PARTNER; names = ['You', 'Dana']; looks = ['you', 'dana']; auto = [false, true]; }
    else if (mode === 'match') { oppProf = PROFILES[cfg.opp]; names = ['You', oppProf.name]; looks = ['you', oppProf.id]; auto = [false, true]; }
    else { const a = PROFILES[2], b = PROFILES[3]; oppProf = b; names = [a.name, b.name]; looks = [a.id, b.id]; auto = [true, true]; }
    w.p[1].speed = oppProf.speed;
    if (mode === 'watch') w.p[0].speed = PROFILES[2].speed;
    if (SHOT && !SHOT_HUMAN) { auto = [true, true]; if (mode !== 'watch') w.p[0].speed = 5.2; }
    const profs = mode === 'watch' ? [PROFILES[2], PROFILES[3]] : SHOT && !SHOT_HUMAN ? [PROFILES[3], oppProf] : [null, oppProf];
    ais = [profs[0] ? newAI(profs[0], aiRng.fork()) : null, newAI(profs[1], aiRng.fork())];
    const first = mode === 'coop' ? 1 : aiRng.int(2);
    state.run = {
      mode, cfg: { ...cfg }, w, parts: [], trail: [], names, looks, auto, to: cfg.to ?? 7, score: [0, 0], serve: first, firstServe: first,
      phase: 'ready', phaseT: 0, rally: 0, best: 0, points: 0, combo: 0, mult: 1, banner: null, think: null, guide: null, hitstop: 0,
      light: mode === 'coop' ? 1 : LIGHT_POS[cfg.light ?? 1], lightTarget: mode === 'coop' ? 1 : LIGHT_POS[cfg.light ?? 1],
      windBase: calm ? 0 : WINDS[cfg.wind ?? 0], windSign: fx.next() < 0.5 ? -1 : 1, adapt: 0.35, over: null, pointInfo: null, total: 0,
      stats: { longest: 0, sweet: 0, hits: 0, whiffs: 0, hints: 0, smashes: 0, newBest: false }, tierSeen: 0,
    };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.hold = null; state.hintOk = false;
    state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
    beginRally();
  };
  const startWatch = () => startRun({ mode: 'watch', to: 3, light: 2, wind: 0 });
  const leaveRun = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.hold = null; };

  // ---- the plan text for Think / Reveal / hints ----------------------------------------------------------------------------
  const laneName = (x) => (x <= -2.4 ? 'far left' : x <= -0.9 ? 'left' : x < 0.9 ? 'middle' : x < 2.4 ? 'right' : 'far right');
  const describePlan = (w, side, plan) => {
    const r = state.run, opp = w.p[1 - side], oppName = r.names[1 - side];
    const sh = shotFor(w.p[side], plan.P, plan.h, { aim: plan.aim, pace: w.pace });
    const run = Math.hypot(plan.aim.tx - opp.x, sh.ty - opp.y);
    const depth = plan.aim.depth <= -0.5 ? ', short' : plan.aim.depth >= 0.5 ? ', deep' : '';
    const styleW = { smash: 'a fast smash', drive: 'a drive', lob: 'a high lob' }[plan.style];
    const where = laneName(plan.aim.tx) === 'middle' ? 'down the middle' : `to the ${laneName(plan.aim.tx)}`;
    const text = `${styleW}${depth}, ${where}`;
    const styles = [...new Set((plan.alts ?? []).map((x) => x.style))];
    const lines = [
      `It will drop through hitting height near the ${laneName(plan.P.x)} in ${plan.tMeet.toFixed(1)} s.`,
      `Reachable in time: ${styles.join(', ') || 'none'} (${Math.max(0, plan.slack ?? 0).toFixed(2)} s to spare).`,
      `Choice: ${text}.`,
      `${oppName === 'You' ? 'You' : oppName} would have to run ${run.toFixed(1)} m in ${sh.T.toFixed(2)} s.`,
    ];
    return { text, lines };
  };

  // ---- human control -------------------------------------------------------------------------------------------------------
  const humanCtrl = (input, w) => {
    const ptr = input.pointer, keys = input.keys, p = w.p[0], c = {};
    if (ptr.pressed && !state.btnPress) {
      const pr = project(p.x, p.y, 0);
      state.hold = { gx: pr.x - ptr.x, gy: pr.y - ptr.y };
    }
    if (state.hold && ptr.down) {
      const g = unproject(ptr.x + state.hold.gx, ptr.y + state.hold.gy);
      c.tx = g.x; c.ty = g.y;
    }
    if (ptr.released && state.hold) { c.swing = true; state.hold = null; }
    else if (!ptr.down && state.hold) state.hold = null;
    const k = keys.down;
    const dx = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    const dy = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0);
    if (dx || dy) { c.tx = p.x + dx * 3; c.ty = p.y + dy * 3; state.kbOn = true; }
    else if (state.kbOn) { c.tx = p.x; c.ty = p.y; state.kbOn = false; }
    if (keys.pressed.has('Space')) c.swing = true;
    return c;
  };

  // ---- decisions for Watch & Learn and hints -------------------------------------------------------------------------------
  const incomingFor = (w, side) => w.phase === 'rally' && w.b.live && canHit(w, side);
  const pressureOf = () => { const r = state.run; if (!r || r.mode === 'coop') return 0; const m = Math.max(r.score[0], r.score[1]); return m >= r.to - 2 && Math.abs(r.score[0] - r.score[1]) <= 1 ? 1 : 0; };
  const coopParams = (r) => ({ coop: true, difficulty: clamp(r.rally / 70, 0, 1), stretch: clamp(0.12 + 0.55 * r.adapt + 0.2 * clamp(r.rally / 70, 0, 1), 0, 0.9) });
  const startThink = (side, human) => {
    const r = state.run, w = r.w;
    let plan, name;
    if (human) {
      const feed = r.mode === 'coop';
      plan = coachPlan(w, 0, aiRng.fork(), { prof: COACH, mode: feed ? 'coop' : 'match', extra: feed ? { feedX: clamp(w.p[1].x * 0.5, -2.5, 2.5), preferStyle: r.rally > 20 ? 'drive' : 'lob' } : {} });
      name = 'Coach';
    } else {
      aiTick(w, side, ais[side], { pressure: pressureOf(), eager: true });
      plan = ais[side].plan;
      name = r.names[side];
    }
    if (!plan || !plan.feasible) { r.think = null; if (human) toast('Too late for a hint on this one', 1.6); return; }
    const d = describePlan(w, side, plan);
    plan.text = d.text;
    r.think = { side, name, phase: 'think', t: 0, dur: human ? Math.min(1.5, state.thinkSecs) : state.thinkSecs, plan, lines: d.lines, human };
    if (human) { r.guide = plan; r.stats.hints++; }
  };
  const updateThink = (dt) => {
    const th = state.run.think;
    if (!th) return false;
    th.t += dt;
    if (th.phase === 'think' && th.t >= th.dur) { th.phase = 'reveal'; th.t = 0; th.dur = REVEAL_SECS; sfx.tick(); }
    else if (th.phase === 'reveal' && th.t >= th.dur) state.run.think = null;
    return true;
  };
  const requestHint = () => {
    const r = state.run;
    if (!r || r.mode === 'watch' || r.phase !== 'play' || r.think) return false;
    if (!incomingFor(r.w, 0)) { toast('Hints appear once the ball is coming to you', 1.6); return false; }
    startThink(0, true);
    return true;
  };

  // ---- events -----------------------------------------------------------------------------------------------------------------
  const reasonText = (v) => {
    const r = state.run;
    const poss = (s) => (s === 0 && r.mode !== 'watch' ? 'Your' : `${r.names[s]}'s`);
    const who = (s) => (s === 0 && r.mode !== 'watch' ? 'You' : r.names[s]);
    if (v.reason === 'serve') return `${who(r.serve)} missed the serve`;
    if (v.reason === 'out') return `${poss(v.last)} shot landed outside the lines`;
    if (v.reason === 'short') return `${poss(v.last)} shot dropped on their own side`;
    return `${who(1 - v.last)} could not return it`;
  };
  const endPoint = (v) => {
    const r = state.run;
    r.phase = 'point'; r.phaseT = 0; r.pointInfo = v; r.guide = null; r.think = null; r.total++;
    if (r.mode !== 'watch' && !SHOT) state.record.demoRallies = (state.record.demoRallies | 0) + 1;
    state.record.rallies = (state.record.rallies | 0) + 1;
    r.stats.longest = Math.max(r.stats.longest, r.rally);
    if (r.mode === 'coop') {
      const why = v.reason === 'unreturned' ? 'The ball touched the sand on your side' : v.reason === 'serve' ? 'The serve missed' : v.last === 0 ? (v.reason === 'out' ? 'Your shot landed out' : 'It dropped on your side') : "Dana's shot went wide";
      r.stats.newBest = r.rally > state.record.bestRally;
      banner(`Rally over: ${r.rally}`, why, POINT_SECS, 46, { y: 320 });
      sfx.no();
    } else {
      r.score[v.winner]++;
      const who = v.winner === 0 && r.mode !== 'watch' ? 'You' : r.names[v.winner];
      banner(`Point: ${who}`, reasonText(v) + (r.rally > 3 ? `. Rally of ${r.rally}.` : ''), POINT_SECS, 44, { y: 320 });
      if (v.winner === 0 && r.mode !== 'watch') sfx.chime(4); else sfx.no();
    }
  };
  const handleEvents = (ev) => {
    const r = state.run, w = r.w;
    for (const e of ev) {
      if (e.t === 'hit') {
        r.rally = e.hits; r.stats.hits++; r.best = Math.max(r.best, r.rally);
        sfx.tok(e.h, e.speed);
        ringFx(r.parts, e.x, e.y, e.z, e.sweet ? 1.0 : 0.6, e.sweet ? 'rgba(255,236,150,A)' : 'rgba(255,255,255,A)');
        sparks(r.parts, e.x, e.y, e.z, e.sweet ? 9 : 4);
        if (e.style === 'smash') { ringFx(r.parts, e.x, e.y, e.z, 1.4, 'rgba(255,170,90,A)'); sparks(r.parts, e.x, e.y, e.z, 8); r.stats.smashes++; }
        if (e.sweet || e.style === 'smash') r.hitstop = 0.045;
        puff(r.parts, w.p[e.side].x, w.p[e.side].y, 2, 0.05, 0.8);
        if (r.mode === 'coop') {
          // the beach gets faster and windier, and the sky slides toward dusk, as the rally grows
          const d = clamp(e.hits / 70, 0, 1);
          w.pace = (state.settings.calm ? 1.15 : 1) * (1 - 0.18 * d);
          w.wind = !state.settings.calm && e.hits >= 12 ? r.windSign * (0.25 + 0.5 * clamp((e.hits - 12) / 60, 0, 1)) : 0;
          r.lightTarget = 1 + clamp(e.hits / 80, 0, 1) * 2;
        }
        if (e.side === 0 && (!r.auto[0] || SHOT)) {
          r.guide = null;
          if (e.sweet) { r.stats.sweet++; popText(r.parts, e.x, e.y, e.z + 0.5, 'SWEET', '#ffe28a', 28); }
          if (r.mode === 'coop') {
            if (e.sweet) r.combo++; else r.combo = 0;
            r.mult = clamp(1 + Math.floor(r.combo / 3), 1, 5);
            const add = (1 + (e.sweet ? 1 : 0)) * r.mult;
            r.points += add;
            if (!e.sweet) popText(r.parts, e.x, e.y, e.z + 0.5, `+${add}`, '#ffffff', 26);
            r.adapt = clamp(r.adapt + (e.sweet ? 0.05 : -0.02), 0, 1);
          }
          if (e.sweet) sfx.chime(r.mode === 'coop' ? r.combo : 2);
        } else if (e.sweet && r.auto[0] && r.mode === 'watch') r.stats.sweet++;
        if (r.mode === 'coop') {
          const tier = tierOf(r.rally);
          if (tier > r.tierSeen) { r.tierSeen = tier; banner(`${TIER_NAMES[tier]}!`, `${r.rally} in a row`, 2.2, 56, { fill: 'rgba(255,106,74,0.92)', y: 300 }); sfx.tier(); confetti(r.parts, 40); }
        }
      } else if (e.t === 'whiff') {
        if (!r.auto[e.side]) { r.stats.whiffs++; popText(r.parts, w.p[e.side].x, w.p[e.side].y, 1.6, 'miss', '#dfe8ee', 24); if (r.mode === 'coop') { r.combo = 0; r.mult = 1; r.adapt = clamp(r.adapt - 0.12, 0, 1); } }
        sfx.swish();
      } else if (e.t === 'land') {
        puff(r.parts, e.x, e.y, 9, 0.05, 1.3);
        ringFx(r.parts, e.x, e.y, 0.02, 0.8, e.out ? 'rgba(255,120,100,A)' : 'rgba(255,255,255,A)');
        sfx.thud(Math.abs(e.vz));
      } else if (e.t === 'point') endPoint(e);
    }
  };
  const finishRun = () => {
    const r = state.run;
    if (r.mode === 'coop') {
      state.record.bestRally = Math.max(state.record.bestRally | 0, r.rally);
      state.record.bestScore = Math.max(state.record.bestScore | 0, r.points);
      state.record.played = (state.record.played | 0) + 1;
      r.over = { rally: r.rally, points: r.points, newBest: r.stats.newBest, tier: tierOf(r.rally) };
      if (r.stats.newBest) sfx.win();
    } else {
      const win = r.score[0] > r.score[1] ? 0 : 1;
      r.over = { win, score: [...r.score] };
      if (r.mode === 'match') {
        state.record.played = (state.record.played | 0) + 1;
        if (win === 0) { state.record.wins[r.cfg.opp] = (state.record.wins[r.cfg.opp] | 0) + 1; sfx.win(); }
      }
    }
    save();
    state.scene = 'result'; state.ui.scroll = 0;
  };
  const afterPoint = () => {
    const r = state.run;
    if (r.mode === 'coop') { finishRun(); return; }
    if (Math.max(r.score[0], r.score[1]) >= r.to) { finishRun(); return; }
    if (state.demo && r.mode !== 'watch' && state.record.demoRallies >= DEMO_RALLY_CAP) { save(); state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    r.serve = (r.firstServe + Math.floor(r.total / 2)) % 2;
    beginRally();
  };

  // ---- the play scene ---------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.hold = null; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };

  const updatePlay = (dt, input) => {
    const r = state.run, w = r.w, ptr = input.pointer, keys = input.keys;
    const watch = r.mode === 'watch';
    if (SHOT && SHOT_SC === 'hint' && state.hintOk && !r.think && !r.guide) requestHint();
    if (SHOT && SHOT_SC === 'pause' && r.rally >= 1 && !state.pauseMenu) openPause();
    if (config.dev && keys.pressed.has('KeyK') && r.mode !== 'coop') { r.score = [r.to, Math.min(r.score[1], r.to - 1)]; finishRun(); return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else state.paused = !state.paused; }
    if (state.pauseMenu) { pauseMenuInput(ptr); return; }
    state.btnPress = false;
    if (ptr.pressed) {
      if (watch) {
        state.btnPress = true;
        if (inRect(WATCH_BAR.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(WATCH_BAR.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); }
        else if (inRect(WATCH_BAR.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); }
        else if (inRect(WATCH_BAR.exit, ptr.x, ptr.y)) { leaveRun(); return; }
        else state.btnPress = false;
      } else if (inRect(PAUSE_BTN, ptr.x, ptr.y)) { state.btnPress = true; openPause(); sfx.tick(); return; }
      else if (inRect(HINT_BTN, ptr.x, ptr.y)) { state.btnPress = true; requestHint(); sfx.tick(); }
    }
    if (keys.pressed.has('KeyH') && !watch) requestHint();
    if (state.paused) return;   // paused: nothing below advances (timers, plans, animations)
    if (state.toastT > 0) state.toastT -= dt;
    if (r.banner) { r.banner.t += dt; if (r.banner.t >= r.banner.dur) r.banner = null; }
    r.light += (r.lightTarget - r.light) * Math.min(1, dt * 2);
    stepParts(r.parts, dt);
    const human = !r.auto[0];
    // Touches are read every tick, even while the rally is frozen, so a press during a hit-stop or a hint is never lost.
    let hc = null;
    if (human && r.phase !== 'point') hc = humanCtrl(input, w);
    else if (human) state.hold = null;
    if (hc) r.carry = { ...(r.carry ?? {}), ...hc };
    if (updateThink(dt)) { if (r.carry) delete r.carry.swing; return; }    // Think / Reveal freeze the rally (hints and Watch & Learn)
    if (r.hitstop > 0) { r.hitstop -= dt; return; }
    r.phaseT += dt;
    const ctrl = [{}, {}];
    if (human && r.carry) { ctrl[0] = r.carry; r.carry = null; }
    state.hintOk = human && r.phase === 'play' && incomingFor(w, 0) && !r.think;
    const press = pressureOf(), eager = watch;
    const extra1 = r.mode === 'coop' ? coopParams(r) : {};
    if (r.phase === 'ready') {
      if (!human) ctrl[0] = aiTick(w, 0, ais[0], { pressure: press, eager });
      ctrl[1] = aiTick(w, 1, ais[1], { pressure: press, eager, ...extra1 });
      step(w, dt, ctrl);
      if (r.phaseT >= READY_SECS) { tossBall(); if (watch) startThink(r.serve, false); }
      return;
    }
    if (r.phase === 'play') {
      if (watch) for (const s of [0, 1]) if (incomingFor(w, s) && ais[s].key !== w.hits && !r.think) { startThink(s, false); if (r.think) return; }
      if (!human) ctrl[0] = aiTick(w, 0, ais[0], { pressure: press, eager });
      ctrl[1] = aiTick(w, 1, ais[1], { pressure: press, eager, ...extra1 });
      const ev = step(w, dt, ctrl);
      if (w.b.live) pushTrail(r.trail, w.b);
      handleEvents(ev);
      return;
    }
    if (r.phase === 'point') {
      step(w, dt, [human ? {} : aiTick(w, 0, ais[0], {}), aiTick(w, 1, ais[1], {})]);
      if (r.phaseT >= POINT_SECS || (r.phaseT > 0.7 && ptr.pressed && !state.btnPress && !SHOT)) afterPoint();
    }
  };

  function pauseMenuInput(ptr) {
    if (flowMeta().key !== 'pause') return;
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll));
    }
  }
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'p-calm') { state.settings.calm = !state.settings.calm; toast('Calm mode applies from the next game', 1.8); save(); }
    else if (id === 'quit') leaveRun();
  }

  // ---- menus ------------------------------------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag, m = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && m.lay) {
      const max = Math.max(0, m.lay.contentH - (m.bottom - m.top));
      state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max);
    }
  }
  const handleTitle = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'coop') startRun({ mode: 'coop' });
    else if (id === 'match') { state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id === 'to7') s.to = 7;
    else if (id === 'to11') s.to = 11;
    else if (id.startsWith('lt')) { const i = Number(id.slice(2)); if (state.demo && i !== 1) { state.setupMsg = 'That light is in the full game.'; return; } s.light = i; state.setupMsg = ''; }
    else if (id.startsWith('wd')) { const i = Number(id.slice(2)); if (state.demo && i !== 0) { state.setupMsg = 'Wind is in the full game.'; return; } s.wind = i; state.setupMsg = ''; }
    else if (id === 'start') startRun({ mode: 'match', opp: s.opp, to: s.to, light: s.light, wind: s.wind });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-calm') st.calm = !st.calm;
    else if (id === 'set-guides') st.guides = !st.guides;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    state.thinkSecs = THINK_STEPS[st.thinkIdx];
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.run.cfg;
    if (id === 'again') startRun(cfg);
    else if (id === 'new') { state.scene = cfg.mode === 'match' ? 'setup' : 'title'; state.ui.scroll = 0; }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };

  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key);
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta();
      const scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const m = flowMeta();
    const max = m.lay ? Math.max(0, m.lay.contentH - (m.bottom - m.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) {
      handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back');
      return;
    }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const n = pageCount();
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.page = 0; };
    const next = () => { if (state.page >= n - 1) close(); else state.page++; };
    const prev = () => { if (state.page <= 0) close(); else state.page--; };
    if (ptr.pressed) {
      if (inRect(REF_NEXT, ptr.x, ptr.y)) next();
      else if (inRect(REF_BACK, ptr.x, ptr.y)) prev();
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    }
    if (keys.pressed.has('ArrowRight')) next();
    if (keys.pressed.has('ArrowLeft')) prev();
    if (keys.pressed.has('Escape')) close();
  };

  startAttract();

  // Screenshot mode (?shot=1): jump straight into a scene with a computer-driven player so every shot shows real content.
  if (SHOT) {
    const sc = SHOT_SC ?? ['title', 'coop', 'match', 'match', 'watch', 'coop', 'result', 'setup'][SHOT_SEED % 8];
    state.loaded = true;
    state.settings.textIdx = clamp(SHOT_ZOOM, 0, 4);
    if (sc === 'coop' || sc === 'guide' || sc === 'hint' || sc === 'pause' || sc === 'coophuman') startRun({ mode: 'coop' });
    else if (sc === 'match') startRun({ mode: 'match', opp: SHOT_SEED % 5, to: 7, light: SHOT_SEED % 3, wind: SHOT_SEED % 2 });
    else if (sc === 'watch') startWatch();
    else if (['setup', 'settings', 'rules', 'howto', 'about'].includes(sc)) { state.scene = sc; state.page = SHOT_PAGE; }
    else if (sc === 'coopresult') { startRun({ mode: 'coop' }); state.run.rally = 37; state.run.points = 91; state.run.stats = { ...state.run.stats, sweet: 19, newBest: true }; finishRun(); }
    else if (sc === 'result') { startRun({ mode: 'match', opp: 1, to: 7, light: 2, wind: 0 }); state.run.score = [7, 4]; state.run.stats = { ...state.run.stats, longest: 14, sweet: 11, hits: 52 }; finishRun(); }
  }

  const blank = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused game does not).
    isPreviewExempt: () => SHOT || !(state.scene === 'play' && state.run && state.run.mode !== 'watch') || state.paused || !!(state.run && state.run.think),
    update(dt, input) {
      if (SHOT) input = blank;
      setPress(input.pointer);
      if (!(state.scene === 'play' && state.paused)) state.t += dt;
      if (state.att && state.scene !== 'play') updateAttract(dt);
      if (state.toastT > 0 && state.scene !== 'play') state.toastT -= dt;
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
    render(ctx) {
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play': if (state.run) renderPlay(ctx, state); if (state.pauseMenu) renderPause(ctx, state); break;
        default: break;
      }
    },
    getState: () => state,
  };
}

// ---- play-scene rendering (needs the run's view model) -----------------------------------------------------------------------
export function sceneFor(state, src, L) {
  return { w: src.w, L, parts: src.parts, trail: src.trail, looks: src.looks ?? ['you', 'dana'], t: state.t, cue: false, guides: null };
}
const incoming0 = (w) => w.phase === 'rally' && w.b.live && canHit(w, 0);

function renderPlay(ctx, st) {
  const r = st.run, w = r.w, L = lightAt(r.light);
  const human = !r.auto[0];
  const S = sceneFor(st, { w, parts: r.parts, trail: r.trail, looks: r.looks }, L);
  S.cue = human && r.phase === 'play';
  const th = r.think;
  S.guides = (c2) => {
    const p0 = w.p[0];
    if (human) {
      if (r.phase !== 'point') ring(c2, p0.x, p0.y, p0.reach, 'rgba(255,255,255,0.32)', 2.4, [6, 7]);
      if (r.phase === 'play' && incoming0(w)) {
        const P = dropPoint(w);
        if (P) {
          const pulse = 0.5 + 0.5 * Math.sin(st.t * 7);
          ring(c2, P.x, P.y, 0.3 + pulse * 0.06, 'rgba(255,255,255,0.95)', 3, null, 'rgba(255,255,255,0.18)');
          if (st.settings.guides && !r.guide) {
            const near = Math.hypot(P.x - p0.x, P.y - (p0.y + 0.3)) <= p0.reach * 1.5;
            const sh = shotFor(p0, { x: P.x, y: P.y }, 1.15, { pace: w.pace });
            drawReticle(c2, sh.tx, sh.ty, sh.sigma + 0.1, near ? 'rgba(255,214,90,0.95)' : 'rgba(255,214,90,0.4)', st.t, near ? 'AIM' : null);
          }
        }
      }
      if (r.guide && r.phase === 'play' && !th) drawPlan(c2, w, r.guide, st.t, { side: 0, col: 'rgba(96,255,180,0.95)' });
    }
    if (th) {
      if (th.phase === 'reveal') drawPlan(c2, w, th.plan, st.t, { side: th.side, alts: true, standLabel: th.human ? 'STAND HERE' : 'MOVES HERE', aimLabel: th.human ? 'AIM' : 'TARGET' });
      else {
        const al = th.plan.alts ?? [], f = clamp(th.t / th.dur, 0, 1), k = Math.ceil(f * al.length * 1.3);
        al.slice(0, k).forEach((a) => ring(c2, a.P.x, a.P.y, 0.3, 'rgba(255,255,255,0.8)', 2.5, [5, 5]));
      }
    }
  };
  renderScene(ctx, st, S);
  drawHud(ctx, st, st.t);
  if (th) drawThink(ctx, st, st.t);
  drawBanner(ctx, r);
  if (st.toastT > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(1, st.toastT / 0.3); ctx.font = '800 24px sans-serif'; ctx.textAlign = 'center';
    const tw = ctx.measureText(st.toast).width + 44;
    ctx.fillStyle = 'rgba(8,28,44,0.78)'; ctx.beginPath(); ctx.roundRect(W / 2 - tw / 2, 1010, tw, 54, 27); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(st.toast, W / 2, 1038);
    ctx.restore();
  }
}
void MID; void H;
