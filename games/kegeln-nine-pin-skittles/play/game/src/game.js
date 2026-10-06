// Kegeln: state and flow. Rules live in engine.js, the physics in phys.js, the opponents and the Think hint in ai.js, the lane
// scene in scene.js, the play screen in view.js, every other screen in menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, learn, play (also Watch & Learn and the lessons), result, howto / about / rules, demolimit.
// Play phases: intro, aim (a person plans the throw), think (a computer plans it), rolling, result, replay, sweep.
import { meta, syncSize, refGeom, setupGeom, TEXT_SCALES, THINK_STEPS, REVEAL_SECS, BALLZONE, inRect, SCENE_Y0 } from './layout.js';
import { DT, newSim, stepSim, simResult, launchFor, pathPoints, PIN_Z0, ALL } from './phys.js';
import { newMatch, applyThrow, standingFor, totals, LENGTHS, phaseName, toMask } from './engine.js';
import { PROFILES, ASSIST, HUMAN_LAT, tableJob, chooseFromTable, rollWithError, verifyPlan, explainHint } from './ai.js';
import { fixedCam, scaleAt, snapSim } from './scene.js';
import { renderPlay, computeLayout, resultText, sideName, statusText, whyTitle } from './view.js';
import { pressLockup } from './brand.js';
import { renderTitle, renderSetup, renderSettings, renderLearn, renderResult, renderPause, renderSheet, renderWhy, renderPages, renderDemoLimit, hitScreen, flowMeta, flowMax, READER, refCloseRect, ensureLayout } from './menus.js';
import { ABOUT, HOWTO, RULES, LESSONS } from './content.js';
import { setPress } from './ui.js';

export { meta };
export const wheelInput = { dy: 0 };   // { width, height, fluid }: the kit keeps width / height current on every resize (see layout.js)
const DEMO_MATCH_CAP = 2;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_PARTS = 150;
const START_MAX = 0.5, AIM_MAX = 0.62;
const FIXED_CAM = fixedCam();   // the one camera: the playing surface never moves
const NOLAUNCH = { x0: 0, vx0: 0, vz: 0, A: 0, T: 3 };

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork(), hand = rng.fork(), aiR = rng.fork();
  const rn = () => aiR.next(), hn = () => hand.next();
  let shotMode = false;
  try { shotMode = /[?&]shot=/.test(globalThis.location.search); } catch { shotMode = false; }
  let shotSeed = config.seed | 0;
  // The kit has a single pointer: a second finger would make it jump and its lift would end the aim or the flick. So every touch
  // that is not the primary one is dropped in the capture phase, before the kit's canvas listeners ever see it.
  try {
    if (typeof globalThis.addEventListener === 'function' && !shotMode) {
      const dropStray = (e) => { if (e.pointerType === 'touch' && e.isPrimary === false) e.stopImmediatePropagation(); };
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) globalThis.addEventListener(type, dropStray, true);
    }
  } catch { /* no DOM (headless): nothing to guard */ }
  let aiJob = null, hintJob = null;      // the heavy search jobs live outside `state` (they are big and not state)

  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, assist: 1, textIdx: 0, thinkIdx: 1, replay: true },
    record: { played: 0, wins: [0, 0, 0, 0, 0], learn: 0, alle: 0, kranz: 0, pudel: 0, bestTotal: 0, demoMatches: 0, throws: 0 },
    setup: { mode: 'ai', opp: 0, len: 1 }, setupMsg: '', restoreMsg: '',
    ui: { scroll: 0, drag: null }, page: 0, resume: null, loaded: false,
    m: null, ph: 'intro', pt: 0, humanTurn: false, plan: { x0: 0, aimX: 0, power: 1, hook: 0 }, plans: [null, null],
    cam: fixedCam(), sim: null, ballShow: null, ballOpts: null, overlay: null, parts: [], banner: null, toast: '', toastT: 0,
    why: null, hint: null, think: null, res: null, lastPath: null, fade: 0, drops: null, sheet: false, thrown: null, final: null, pipParts: [], alpha: 0,
    drag: null, rt: 0, fast: false, thinkSecs: 5, rec: [], recT: 0, rumbleT: 0, acc: 0, autoReplayDone: false, lastPhaseShown: 0, shot: false, showcase: false,
    att: { cam: null, sim: null, wait: 1, n: 0, parts: [], acc: 0 },
  };
  
  state.sim = newSim(ALL(), NOLAUNCH);
  state.ballShow = { x: 0, z: 0, on: true };
  const record = state.record;

  // ---- persistence ---------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  // What is written so a killed app can Continue: the whole match, after every throw.
  const saveResume = () => {
    const m = state.m;
    if (!m || m.cfg.mode === 'watch' || m.cfg.mode === 'learn') return;
    if (m.over) { clearResume(); return; }
    state.resume = JSON.parse(JSON.stringify(m));
    storage.set('resume', state.resume);
  };
  const clearResume = () => { state.resume = null; storage.remove('resume'); };
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  const boolArr = (a) => Array.isArray(a) && a.length === 9 && a.every((v) => typeof v === 'boolean');
  const validResume = (r) => !!r && !!r.cfg && (r.cfg.mode === 'ai' || r.cfg.mode === 'two') && int(r.cfg.len, 0, 2) && (r.cfg.mode === 'two' || int(r.cfg.opp, 0, PROFILES.length - 1))
    && int(r.each, 1, 15) && r.each === LENGTHS[r.cfg.len].each && (r.phase === 0 || r.phase === 1) && (r.turn === 0 || r.turn === 1) && !r.over
    && Array.isArray(r.done) && r.done.length === 2 && r.done.every((d) => Array.isArray(d) && d.length === 2 && d.every((v) => int(v, 0, 15)))
    && Array.isArray(r.standing) && r.standing.length === 2 && r.standing.every(boolArr) && Array.isArray(r.throws) && r.throws.length === 2
    && r.throws.every((t) => Array.isArray(t) && t.length <= 30 && t.every((x) => x && int(x.pins, 0, 9) && (x.phase === 0 || x.phase === 1)))
    && Number.isFinite(r.laneK) && r.laneK > 0.8 && r.laneK < 1.2 && r.done.every((d) => d[0] <= r.each && d[1] <= r.each);
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('resume', null)]).then(([s, r, res]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const st = state.settings;
    st.textIdx = clamp(st.textIdx | 0, 0, TEXT_SCALES.length - 1);
    st.thinkIdx = clamp(st.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    st.assist = clamp(st.assist | 0, 0, ASSIST.length - 1);
    st.replay = st.replay !== false;
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 5) state.record.wins = [0, 0, 0, 0, 0];
    if (validResume(res) && !shotMode) state.resume = res;
    state.loaded = true;
    audio.setMuted?.(!st.sound);
  }).catch(() => { state.loaded = true; });

  // ---- sound ---------------------------------------------------------------------------------------
  let toneBudget = 0;
  const tone = (o) => { if (state.settings.sound && toneBudget < 6) { toneBudget++; audio.tone(o); } };
  const sfx = {
    whoosh: () => tone({ freq: 380, to: 120, dur: 0.3, type: 'sawtooth', vol: 0.03 }),
    rumble: (v) => tone({ freq: 52 + v * 6, to: 46 + v * 6, dur: 0.17, type: 'triangle', vol: 0.09 }),
    crack: (s = 1) => { tone({ freq: 1100, to: 260, dur: 0.07, type: 'square', vol: 0.07 * s }); tone({ freq: 140, to: 55, dur: 0.18, type: 'sine', vol: 0.3 * s }); },
    clack: (s = 1) => tone({ freq: 620 + fx.next() * 700, to: 300, dur: 0.05, type: 'square', vol: 0.045 * s }),
    thump: (s = 1) => tone({ freq: 110, to: 60, dur: 0.12, type: 'sine', vol: 0.16 * s }),
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.12 }),
    plop: () => tone({ freq: 180, to: 90, dur: 0.08, type: 'sine', vol: 0.1 }),
    gutter: () => tone({ freq: 90, to: 70, dur: 0.5, type: 'sawtooth', vol: 0.05 }),
    big: () => [0, 4, 7, 12, 16].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.22 + i * 0.04, type: 'triangle', vol: 0.1 })),
    win: () => [0, 2, 4, 7, 9, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.3 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.2) => { state.toast = text; state.toastT = secs; };
  const showBanner = (text, sub = '', kind = '', dur = 1.7, size = 76) => { state.banner = { text, sub, kind, t: 0, dur, size }; };

  // ---- particles ----------------------------------------------------------------------------------
  const addPart = (list, p) => { if (list.length < MAX_PARTS) list.push({ t: 0, vx: 0, vy: 0, vz: 0, rot: 0, spin: 0, ...p }); };
  const dust = (list, x, z, n, big = 1) => { for (let i = 0; i < n; i++) addPart(list, { k: 'dust', x: x + (fx.next() - 0.5) * 0.1, y: 0.05, z: z + (fx.next() - 0.5) * 0.1, vx: (fx.next() - 0.5) * 0.7 * big, vy: 0.2 + fx.next() * 0.4, vz: (fx.next() - 0.5) * 0.7 * big, size: 0.04 + fx.next() * 0.03, max: 0.5 + fx.next() * 0.5, col: fx.next() < 0.5 ? '#e6d2a4' : '#b99a64' }); };
  const chips = (list, x, z, n) => { for (let i = 0; i < n; i++) addPart(list, { k: 'chip', x, y: 0.1, z, vx: (fx.next() - 0.5) * 2.4, vy: 1 + fx.next() * 1.6, vz: (fx.next() - 0.3) * 2.4, size: 0.035 + fx.next() * 0.03, max: 0.8 + fx.next() * 0.5, rot: fx.next() * TAU, spin: (fx.next() - 0.5) * 14, col: fx.next() < 0.5 ? '#f1e6c8' : '#c0392b' }); };
  const stepParts = (list, dt) => {
    for (const p of list) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.k === 'chip') { p.vy -= 7 * dt; if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; } } else { p.vx *= 0.97; p.vz *= 0.97; p.vy *= 0.98; } }
    return list.filter((p) => p.t < p.max);
  };

  // ---- who is who -------------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const isAI = (side) => mode() === 'watch' || (mode() === 'ai' && side === 1);
  const profOf = (side) => (mode() === 'watch' ? PROFILES[side === 0 ? state.m.cfg.watchA : state.m.cfg.opp] : PROFILES[state.m.cfg.opp]);
  const curStanding = () => (mode() === 'learn' ? state.m.lesson.standing.slice() : standingFor(state.m));
  const aimPts = (p) => pathPoints(p.x0, p.aimX, p.power, p.hook, 18);
  const maskArr = (list) => { const a = new Array(9).fill(false); list.forEach((i) => { a[i] = true; }); return a; };

  // ---- match flow ---------------------------------------------------------------------------------------------------
  const resetPins = (standing, drop) => {
    state.sim = newSim(standing, NOLAUNCH);
    state.fade = 0; state.res = null;
    state.drops = drop ? standing.map((v, i) => (v ? 0.55 + 0.05 * i : 0)) : null;
    if (drop) sfx.plop();
  };
  const defaultPlan = () => ({ x0: 0, aimX: 0, power: 1, hook: 0 });
  const beginTurn = (intro, drop = true) => {
    const m = state.m, side = m.turn;
    state.humanTurn = !isAI(side);
    state.plan = { ...(state.plans[side] ?? defaultPlan()) };
    resetPins(curStanding(), drop);
    state.hint = null; hintJob = null; state.think = null; aiJob = null; state.sheet = false; state.why = null; state.drag = null;
    state.pt = 0; state.fast = false;
    state.ph = intro ? 'intro' : state.humanTurn ? 'aim' : 'think';
    if (state.ph === 'think') startThink();
  };
  const showPhaseBanner = () => {
    const m = state.m;
    if (m.cfg.mode === 'learn') { showBanner(`Lesson ${m.lesson.idx + 1}`, m.lesson.title, '', 1.8, 64); return; }
    showBanner(phaseName(m.phase), m.phase === 0 ? 'Each throw is at a full set of nine pins' : 'Throw at the pins that are left', '', 1.9, 84);
  };
  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch') {
      if (record.demoMatches >= DEMO_MATCH_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
      cfg = { ...cfg, len: 0 };
    }
    const first = cfg.first ?? aiR.int(2);
    const laneK = 0.92 + aiR.next() * 0.16;
    state.m = newMatch({ mode: 'ai', opp: 0, len: 1, watchA: 1, ...cfg, first, laneK });
    if (state.demo && cfg.mode !== 'watch') { record.demoMatches++; save(); }
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.plans = [null, null]; state.parts = []; state.banner = null; state.lastPath = null; state.lastPhaseShown = 0;
    
    showPhaseBanner();
    beginTurn(true, true);
  };
  const startWatch = () => {
    const picks = [1, 2, 3, 4];
    const a = picks.splice(aiR.int(picks.length), 1)[0], b = picks[aiR.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, len: 0, first: aiR.int(2) });
  };
  const resumeMatch = () => {
    const r = state.resume;
    if (!r) return;
    state.m = JSON.parse(JSON.stringify(r));
    state.scene = 'play'; state.ui.scroll = 0; state.plans = [null, null]; state.parts = []; state.banner = null; state.lastPath = null;
    state.lastPhaseShown = state.m.phase;
    
    beginTurn(false, false);
    state.paused = true; state.pauseMenu = true;   // a resumed match starts paused
  };
  const startLesson = (idx) => {
    const L = LESSONS[idx];
    const m = newMatch({ mode: 'learn', len: 0, first: 0, laneK: 1 });
    m.lesson = { idx, title: L.title, tries: L.tries, goal: L.goal, carry: L.carry, used: 0, passed: false, standing: maskArr(L.standing), text: L.text };
    state.m = m; state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.plans = [null, null]; state.parts = []; state.lastPath = null; 
    showBanner(`Lesson ${idx + 1}`, L.title, '', 2.2, 64);
    beginTurn(true, true);
  };

  // ---- the roll ------------------------------------------------------------------------------------------------------
  const launch = (L) => {
    const m = state.m, standing = curStanding();
    state.thrown = { standing, L: { ...L } };
    state.sim = newSim(standing, L, m.laneK);
    state.ph = 'rolling'; state.pt = 0; state.rt = 0; state.hint = null; hintJob = null; state.sheet = false; state.fast = false; state.acc = 0;
    state.rec = [{ x: L.x0, z: 0 }]; state.recT = 0; state.rumbleT = 0;
    state.plans[m.turn] = { ...state.plan };
    state.banner = null;
    sfx.whoosh();
    if (state.humanTurn && mode() !== 'watch') record.throws = (record.throws | 0) + 1;
  };
  const doRoll = (q) => {
    const lat = HUMAN_LAT[state.settings.assist] * q;
    launch(rollWithError(state.plan, lat, 0.02 * q, hn));
  };
  const handleEvents = (sim, list) => {
    for (const e of sim.events) {
      if (e.k === 'tip') {
        dust(list, e.x, e.z, 3, 1 + e.s); if (e.s > 0.3) chips(list, e.x, e.z, 2 + Math.round(e.s * 3));
        if (e.ball) { sfx.crack(0.6 + e.s * 0.6); } else sfx.clack(0.5 + e.s);
      } else if (e.k === 'clack') { sfx.clack(e.s); }
      else if (e.k === 'tap') sfx.clack(0.5);
      else if (e.k === 'thump') { sfx.thump(e.s); dust(list, e.x, e.z, 2, 0.8); }
      else if (e.k === 'gutter') { sfx.gutter(); toast('Pudel: the ball left the lane', 1.8); }
      else if (e.k === 'net') sfx.thump(0.8);
    }
    sim.events.length = 0;
  };
  const finishThrow = () => {
    const m = state.m, sim = state.sim;
    const res = simResult(sim);
    const wasHuman = state.humanTurn && mode() !== 'watch';
    let rec;
    if (mode() === 'learn') {
      const L = m.lesson; L.used++;
      const before = L.standing.filter(Boolean).length;
      rec = { pins: res.count, pudel: res.pudel, alle: res.count === 9 && before === 9, kranz: res.count === 8 && res.kingStands && before === 9, cleared: false };
      L.passed = L.carry ? res.standing.every((v) => !v) : res.count >= L.goal;
      if (L.carry) L.standing = res.standing;
    } else rec = applyThrow(m, res);
    if (mode() !== 'learn') saveResume();
    state.res = rec; state.ph = 'result'; state.pt = 0; state.fast = false; state.autoReplayDone = false;
    if (wasHuman) { if (rec.alle) record.alle++; if (rec.kranz) record.kranz++; if (rec.pudel) record.pudel++; }
    if (state.rec.length > 1) state.lastPath = state.rec.slice();
    const n = rec.pins;
    if (rec.pudel) showBanner('PUDEL', 'The ball left the lane', 'bad', 2, 84);
    else if (rec.alle) { showBanner('ALLE NEUNE!', 'All nine pins down', '', 2.4, 76); sfx.big(); sfx.crack(1.2); }
    else if (rec.kranz) { showBanner('KRANZ!', 'The King stands in a ring of fallen pins', '', 2.4, 84); sfx.big(); }
    else if (n === 0) showBanner('No pins', 'The ball found no pin', 'bad', 1.7, 76);
    else { showBanner(String(n), resultText(rec), '', 1.9, 120); sfx.chime(n >= 7 ? 2 : 0); }
    if (rec.cleared && !rec.alle) toast('Cleared: a fresh set next time', 2);
    save();
  };
  const startReplay = () => {
    const t = state.thrown;
    if (!t) { beginSweep(); return; }
    // The main view keeps showing the finished throw (state.final); the replay plays in a small fixed close-up inset (state.sim).
    state.final = state.sim; state.pipParts = [];
    state.sim = newSim(t.standing, t.L, state.m.laneK);
    state.ph = 'replay'; state.rt = 0; state.pt = 0; state.autoReplayDone = true; state.acc = 0;
  };
  const beginSweep = () => { if (state.final) { state.sim = state.final; state.final = null; state.pipParts = []; } state.ph = 'sweep'; state.pt = 0; state.fade = 0; state.banner = null; };
  const nextAfterThrow = () => {
    const m = state.m;
    if (m.cfg.mode === 'learn') {
      const L = m.lesson;
      if (L.passed || L.used >= L.tries) {
        if (L.passed) record.learn = Math.max(record.learn, L.idx + 1);
        save(); state.scene = 'result'; state.ui.scroll = 0; state.banner = null; return;
      }
      beginTurn(false, true); return;
    }
    if (m.over) { finishMatch(); return; }
    saveResume();
    const newPhase = m.phase !== state.lastPhaseShown;
    state.lastPhaseShown = m.phase;
    const handOver = m.cfg.mode === 'two';
    if (newPhase) showPhaseBanner();
    else if (handOver) showBanner(sideName(state, m.turn), 'Your turn', '', 1.1, 84);
    beginTurn(newPhase || handOver, true);
  };
  const finishMatch = () => {
    const m = state.m;
    state.scene = 'result'; state.ui.scroll = 0; state.page = 0; state.banner = null;
    clearResume();
    const a = totals(m, 0).total;
    if (m.cfg.mode === 'ai') {
      record.played++;
      if (m.over.win === 0) record.wins[m.cfg.opp] = (record.wins[m.cfg.opp] | 0) + 1;
    }
    if (m.cfg.mode !== 'watch') record.bestTotal = Math.max(record.bestTotal | 0, a);
    if (m.over.win === 0 || m.cfg.mode === 'two') sfx.win();
    save();
  };

  // ---- the plan: what a person controls -----------------------------------------------------------------------
  const setPlan = (patch) => {
    const p = { ...state.plan, ...patch };
    p.x0 = clamp(Math.round(p.x0 * 1000) / 1000, -START_MAX, START_MAX);
    p.aimX = clamp(Math.round(p.aimX * 1000) / 1000, -AIM_MAX, AIM_MAX);
    state.plan = p;
  };
  const requestHint = () => {
    if (!state.humanTurn || state.ph !== 'aim') return;
    if (state.hint && !state.hint.busy) { state.hint = null; return; }
    if (state.hint) return;
    hintJob = tableJob(curStanding());
    state.hint = { busy: true, progress: 0, text: '', plan: null };
    sfx.tick();
  };
  const stepHint = () => {
    if (!hintJob || !state.hint || !state.hint.busy) return;
    if (hintJob.step(16)) {
      const st = curStanding(), best = hintJob.table[0];
      const v = verifyPlan(st, best, HUMAN_LAT[state.settings.assist]);
      const phase = mode() === 'learn' || state.m.phase === 1 ? 1 : 0;
      state.hint = { busy: false, progress: 1, plan: { x0: best.x0, aimX: best.aimX, power: best.power, hook: best.hook }, text: explainHint(st, best, v, phase) };
      hintJob = null;
    } else state.hint.progress = hintJob.progress;
  };
  const useHint = () => {
    if (!state.hint || state.hint.busy) return;
    setPlan(state.hint.plan); state.hint = null; sfx.tick();
  };

  // ---- computer players -------------------------------------------------------------------------------------------
  function startThink() {
    const m = state.m, side = m.turn, prof = profOf(side), watch = mode() === 'watch';
    const st = curStanding();
    aiJob = tableJob(st);
    const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiR.next() * (prof.think[1] - prof.think[0]);
    state.think = { t: 0, dur, phase: 'think', text: '', plan: null, x0From: state.plan.x0, progress: 0 };
    state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
  }
  const updateThink = (dt) => {
    const m = state.m, side = m.turn, prof = profOf(side), watch = mode() === 'watch', th = state.think;
    if (!th) { startThink(); return; }
    if (th.phase === 'think') {
      let table = null;
      if (aiJob) { if (aiJob.step(16)) table = aiJob.table; else th.progress = aiJob.progress; }
      th.t += dt;
      if (table && !th.plan) {
        const pick = chooseFromTable(table, prof, rn);
        th.plan = { x0: pick.x0, aimX: pick.aimX, power: pick.power, hook: pick.hook };
        if (watch) { const st = curStanding(); th.text = explainHint(st, pick, verifyPlan(st, pick, 0.035), m.phase); }
        aiJob = null; th.progress = 1;
      }
      if (th.plan && th.t >= th.dur) {
        th.t = 0;
        if (watch) { th.phase = 'reveal'; th.dur = REVEAL_SECS * (1 + (TEXT_SCALES[state.settings.textIdx] - 1)); sfx.tick(); } else { th.phase = 'act'; th.dur = 0.9; }
      }
    } else if (th.phase === 'reveal') {
      th.t += dt;
      if (th.t >= th.dur) { th.phase = 'act'; th.t = 0; th.dur = 0.9; }
    } else if (th.phase === 'act') {
      th.t += dt;
      const k = clamp(th.t / th.dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
      state.plan = { x0: th.x0From + (th.plan.x0 - th.x0From) * e, aimX: th.plan.aimX * e, power: th.plan.power, hook: th.plan.hook };
      if (th.t >= th.dur) { state.plan = { ...th.plan }; launch(rollWithError(th.plan, prof.lat, prof.spd, rn)); }
    }
  };

  // ---- the play scene --------------------------------------------------------------------------------------------------
  const openPause = () => { if (state.scene !== 'play' || mode() === 'watch') return; state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.drag = null; };
  // The full "Why?" reader for a status text that was cut short (Watch & Learn reason, Think line). Watch & Learn is paused while it is open.
  const openWhy = () => {
    const text = statusText(state);
    if (!text) return;
    state.why = { text, title: whyTitle(state), wasPaused: state.paused };
    if (mode() === 'watch') state.paused = true;
    state.ui.scroll = 0; state.drag = null; sfx.tick();
  };
  const closeWhy = () => { if (!state.why) return; if (mode() === 'watch') state.paused = !!state.why.wasPaused; state.why = null; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leaveMatch = () => {
    if (mode() === 'learn') state.scene = 'learn'; else { saveResume(); state.scene = 'title'; }
    state.paused = false; state.pauseMenu = false; state.why = null; state.ui.scroll = 0; state.think = null; state.banner = null; state.sheet = false; state.drag = null; aiJob = null; hintJob = null;
  };
  const setOverlay = () => {
    const ph = state.ph, th = state.think;
    if (ph === 'aim' && state.humanTurn) {
      const h = state.hint && !state.hint.busy ? { pts: aimPts({ ...state.hint.plan }), aimX: state.hint.plan.aimX } : null;
      state.overlay = { plan: { pts: aimPts(state.plan), aimX: state.plan.aimX, label: 'Aim' }, last: state.lastPath, hint: h };
    } else if (ph === 'think' && th && (th.phase === 'reveal' || th.phase === 'act') && th.plan) {
      const p = th.phase === 'act' ? state.plan : th.plan;
      state.overlay = { plan: { pts: aimPts(p), aimX: p.aimX, label: th.phase === 'reveal' ? 'Plan' : '', col: '#bfe8ff' }, last: null, hint: null };
    } else state.overlay = null;
    if (ph === 'rolling' || ph === 'replay' || ph === 'replayHold') state.ballShow = state.sim.ball.on ? state.sim.ball : null;
    else if (ph === 'result' || ph === 'sweep') state.ballShow = null;
    else state.ballShow = { x: state.plan.x0, z: 0, on: true };
    state.ballOpts = ph === 'aim' ? { glow: 0.25 + 0.1 * Math.sin(state.t * 4) } : null;
  };
  const stepVisuals = (dt) => {
    state.parts = stepParts(state.parts, dt); state.pipParts = stepParts(state.pipParts, dt);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.dur) state.banner = null; }
    if (state.drops) {
      let any = false;
      state.drops = state.drops.map((d) => { const n = Math.max(0, d - dt * 1.6); if (n > 0) any = true; return n; });
      if (!any) state.drops = null;
    }
  };

  const pressRect = (R, ptr) => { for (const id of Object.keys(R)) if (inRect(R[id], ptr.x, ptr.y)) return id; return null; };
  const hookMove = (d) => setPlan({ hook: clamp(state.plan.hook + d, -3, 3) });
  const handleTrayId = (id) => {
    if (!id) return false;
    if (id.startsWith('hook') && id.length === 5) { setPlan({ hook: Number(id.slice(4)) - 3 }); sfx.tick(); return true; }
    if (id.startsWith('pow')) { setPlan({ power: Number(id.slice(3)) }); sfx.tick(); return true; }
    switch (id) {
      case 'think': requestHint(); return true;
      case 'use': useHint(); return true;
      case 'more': openWhy(); return true;
      case 'left': setPlan({ aimX: state.plan.aimX - 0.02 }); sfx.tick(); return true;
      case 'right': setPlan({ aimX: state.plan.aimX + 0.02 }); sfx.tick(); return true;
      case 'roll': doRoll(1); return true;
      case 'menu': openPause(); return true;
      case 'setup': state.sheet = true; state.ui.scroll = 0; return true;
      case 'replay': startReplay(); return true;
      case 'next': beginSweep(); return true;
      case 'skip': if (state.ph === 'replay') beginSweep(); else state.fast = true; return true;
      default: return false;
    }
  };

  // Touch: drag on the lane to move the aim ring; drag the ball to change the start spot; flick the ball up the lane to roll.
  const updateAimInput = (dt, input, lay) => {
    const ptr = input.pointer, keys = input.keys, R = lay.rects;
    if (ptr.pressed) {
      const id = pressRect(R, ptr);
      if (id && handleTrayId(id)) return;
      const p = { x: (ptr.x - lay.vx) / lay.s, y: (ptr.y - lay.vy) / lay.s + SCENE_Y0 };
      const inView = inRect(lay.sceneRect, ptr.x, ptr.y);   // the lane picture: between the side columns (landscape) or between the scoreboard and the controls
      if (inView) state.drag = { kind: p.y >= BALLZONE.y0 ? 'ball' : 'aim', x: ptr.x, y: ptr.y, sx: ptr.x, sy: ptr.y, t0: state.t, x00: state.plan.x0, sliding: false };
    }
    const d = state.drag;
    if (d && ptr.down) {
      const dx = clamp((ptr.x - d.x) / lay.s, -90, 90);   // a second finger can make the pointer jump: ignore big jumps
      if (d.kind === 'aim') setPlan({ aimX: state.plan.aimX + dx / scaleAt(state.cam, PIN_Z0) });
      else if (d.sliding || Math.abs(ptr.x - d.sx) > Math.abs(ptr.y - d.sy) * 1.2) { d.sliding = true; setPlan({ x0: state.plan.x0 + dx / scaleAt(state.cam, 0) }); }
      d.x = ptr.x; d.y = ptr.y;
    }
    if (d && ptr.released) {
      state.drag = null;
      if (d.kind === 'ball') {
        const dy = (d.sy - ptr.y) / lay.s, dx = (ptr.x - d.sx) / lay.s, dur = state.t - d.t0;
        if (dy >= 100 && dur <= 0.8 && dur > 0.06 && Math.abs(dx) <= dy * 0.6) {
          const v = dy / dur, straight = Math.abs(dx) / dy;
          const q = 0.7 + 0.55 * clamp(straight / 0.35, 0, 1) + 0.55 * clamp((700 - v) / 500, 0, 1);
          setPlan({ x0: d.x00 });
          doRoll(q);
          return;
        }
      }
    }
    if (!ptr.down && state.drag) state.drag = null;
    const sp = 0.3 * dt;
    if (keys.down.has('ArrowLeft')) setPlan({ aimX: state.plan.aimX - sp });
    if (keys.down.has('ArrowRight')) setPlan({ aimX: state.plan.aimX + sp });
    if (keys.down.has('KeyA')) setPlan({ x0: state.plan.x0 - sp });
    if (keys.down.has('KeyD')) setPlan({ x0: state.plan.x0 + sp });
    if (keys.pressed.has('Digit1')) setPlan({ power: 0 });
    if (keys.pressed.has('Digit2')) setPlan({ power: 1 });
    if (keys.pressed.has('Digit3')) setPlan({ power: 2 });
    if (keys.pressed.has('KeyZ')) hookMove(-1);
    if (keys.pressed.has('KeyX')) hookMove(1);
    if (keys.pressed.has('KeyH')) requestHint();
    if (keys.pressed.has('Space') || keys.pressed.has('Enter')) doRoll(1);
  };

  const handleSheet = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'hook-') hookMove(-1); else if (id === 'hook+') hookMove(1);
    else if (id === 'pow-') setPlan({ power: Math.max(0, state.plan.power - 1) });
    else if (id === 'pow+') setPlan({ power: Math.min(2, state.plan.power + 1) });
    else if (id === 'aim-') setPlan({ aimX: state.plan.aimX - 0.02 }); else if (id === 'aim+') setPlan({ aimX: state.plan.aimX + 0.02 });
    else if (id === 'st-') setPlan({ x0: state.plan.x0 - 0.03 }); else if (id === 'st+') setPlan({ x0: state.plan.x0 + 0.03 });
    else if (id === 'think') requestHint(); else if (id === 'use') useHint();
    else if (id === 'close') state.sheet = false;
    else if (id === 'smenu') { state.sheet = false; openPause(); }
  };

  const updatePlay = (dt, input) => {
    const m = state.m, ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch';
    const lay = computeLayout(state, null);
    if (state.why) {
      if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) closeWhy();
      else updateFlowScene(dt, input, (id) => { if (id === 'wclose') closeWhy(); }, 'why');
      return;
    }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (state.sheet) state.sheet = false; else if (!watch) openPause(); else state.paused = !state.paused; }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
      return;
    }
    if (state.sheet && state.ph === 'aim') {
      updateFlowScene(dt, input, handleSheet, 'sheet');
      stepHint();
      return;
    }
    if (watch && ptr.pressed) {
      const id = pressRect(lay.rects, ptr);
      if (id === 'wpause') { state.paused = !state.paused; sfx.tick(); }
      else if (id === 'wdec') { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); }
      else if (id === 'winc') { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); }
      else if (id === 'more') openWhy();
      else if (id === 'wexit') { leaveMatch(); return; }
    }
    // Everything below is frozen while paused: timers, the computer's thinking, the ball, the pins, the replay.
    if (state.paused) return;
    toneBudget = 0;
    stepVisuals(dt);
    state.pt += dt;
    const ph = state.ph;
    if (!watch && ptr.pressed && (ph === 'think' || ph === 'intro' || ph === 'sweep') && pressRect(lay.rects, ptr) === 'menu') { openPause(); return; }
    if (ph === 'intro') {
      const wait = m.cfg.mode === 'learn' ? 1e9 : 1.5;
      if (state.pt >= wait || (ptr.pressed && state.pt > 0.4)) { state.banner = null; state.ph = state.humanTurn ? 'aim' : 'think'; state.pt = 0; if (state.ph === 'think') startThink(); }
    } else if (ph === 'aim') {
      stepHint();
      if (state.humanTurn) updateAimInput(dt, input, lay);
    } else if (ph === 'think') updateThink(dt);
    else if (ph === 'rolling') {
      if (!watch && ptr.pressed) { const id = pressRect(lay.rects, ptr); if (id) handleTrayId(id); }
      const sim = state.sim, b = sim.ball;
      const speed = state.fast ? 6 : 1;
      state.rt += dt;
      let acc = dt * speed + state.acc, n = 0;
      while (acc >= DT && !sim.done && n < 90) { snapSim(sim); stepSim(sim); acc -= DT; n++; }
      state.acc = acc; state.alpha = acc / DT;
      if (!b.contact && b.on) {
        state.recT += dt; if (state.recT > 0.12) { state.recT = 0; state.rec.push({ x: b.x, z: b.z }); }
        state.rumbleT -= dt; if (state.rumbleT <= 0) { state.rumbleT = 0.15; sfx.rumble(Math.hypot(b.vx, b.vz)); }
      }
      handleEvents(sim, state.parts);
      if (sim.done) finishThrow();
    } else if (ph === 'result') {
      if (!watch && ptr.pressed) { const id = pressRect(lay.rects, ptr); if (id) { handleTrayId(id); return; } }
      const big = state.res.pins >= 8 || state.res.alle || state.res.kranz;
      if (state.settings.replay && !state.autoReplayDone && big && state.pt >= 1.4) { startReplay(); return; }
      if (state.pt >= 2.4 || (!watch && ptr.pressed && state.pt > 0.5)) beginSweep();
    } else if (ph === 'replay') {
      if (!watch && ptr.pressed) { const id = pressRect(lay.rects, ptr); if (id) { handleTrayId(id); return; } if (state.pt > 0.5) { beginSweep(); return; } }
      const sim = state.sim;
      state.rt += dt;
      state.acc += dt * (sim.ball.on && sim.ball.z < PIN_Z0 - 1.3 ? 8 : 0.45);   // skip the long roll, then show the crash slowly in the inset
      let n = 0;
      while (state.acc >= DT && !sim.done && n < 90) { snapSim(sim); stepSim(sim); state.acc -= DT; n++; }
      state.alpha = state.acc / DT;
      handleEvents(sim, state.pipParts);
      if (sim.done) { state.pt = 0; state.ph = 'replayHold'; }
    } else if (ph === 'replayHold') {
      if (state.pt >= 0.9 || (!watch && ptr.pressed)) beginSweep();
    } else if (ph === 'sweep') {
      state.fade = clamp(state.pt / 0.7, 0, 1);
      if (state.pt >= 0.75) nextAfterThrow();
    }
    setOverlay();
  };

  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'quit') leaveMatch();
  }

  // ---- menus --------------------------------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) {
      state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, Math.max(0, flowMax()));
    }
  }
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { pressLockup(); env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'play') { state.setup.mode = 'ai'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'two') { state.setup.mode = 'two'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'learn') { state.scene = 'learn'; state.ui.scroll = 0; }
    else if (id === 'continue') resumeMatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That opponent is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id.startsWith('len')) { const i = Number(id.slice(3)); if (state.demo && i > 0) { state.setupMsg = 'That length is in the full game.'; return; } s.len = i; state.setupMsg = ''; }
    else if (id.startsWith('as')) { state.settings.assist = Number(id.slice(2)); save(); }
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, len: state.demo ? 0 : s.len });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-replay') st.replay = !st.replay;
    else if (id.startsWith('as')) st.assist = Number(id.slice(2));
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      state.restoreMsg = 'Checking with the store...';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleLearn = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
    else if (id.startsWith('lesson')) startLesson(Number(id.slice(6)));
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.m.cfg;
    if (cfg.mode === 'learn') {
      const idx = state.m.lesson.idx;
      if (id === 'lnext') startLesson(idx + 1); else if (id === 'lagain') startLesson(idx); else if (id === 'lmenu') { state.scene = 'learn'; state.ui.scroll = 0; }
      return;
    }
    if (id === 'again') { if (cfg.mode === 'watch') startWatch(); else startMatch({ ...cfg, first: undefined }); }
    else if (id === 'new') { state.setup.mode = cfg.mode === 'watch' ? 'ai' : cfg.mode; state.scene = 'setup'; state.ui.scroll = 0; }
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
      const scrollable = !!lay.lay && flowMax() > 0;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta();
    const max = mt.lay ? Math.max(0, flowMax()) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (wheelInput.dy) { state.ui.scroll = clamp(state.ui.scroll + wheelInput.dy, 0, max); wheelInput.dy = 0; }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('KeyO') && state.setup.mode === 'ai') state.setup.opp = (state.setup.opp + 1) % (state.demo ? 2 : PROFILES.length);
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    const sg = setupGeom();
    if (ptr.pressed && (inRect(sg.start, ptr.x, ptr.y) || inRect(sg.back, ptr.x, ptr.y))) {
      handleSetup(inRect(sg.start, ptr.x, ptr.y) ? 'start' : 'back');
      return;
    }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.page = 0; state.ui.scroll = 0; state.ui.drag = null; };
    const setScroll = (v) => { state.ui.scroll = clamp(v, 0, READER.max); };
    syncSize();
    const G = refGeom();
    if (ptr.pressed) {
      if (inRect(refCloseRect(), ptr.x, ptr.y)) { close(); return; }
      else if (inRect(G.dec, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
      else if (inRect(G.inc, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
      else if (ptr.y >= READER.y0 && ptr.y <= READER.y1) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll };
    }
    if (state.ui.drag && ptr.down) setScroll(state.ui.drag.s0 - (ptr.y - state.ui.drag.y0));
    if (ptr.released) state.ui.drag = null;
    if (wheelInput.dy) { setScroll(state.ui.scroll + wheelInput.dy); wheelInput.dy = 0; }
    const step = 70, pgs = Math.max(100, READER.view - 80);
    if (keys.pressed.has('ArrowDown')) setScroll(state.ui.scroll + step);
    if (keys.pressed.has('ArrowUp')) setScroll(state.ui.scroll - step);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) setScroll(state.ui.scroll + pgs);
    if (keys.pressed.has('PageUp')) setScroll(state.ui.scroll - pgs);
    if (keys.pressed.has('Home')) setScroll(0);
    if (keys.pressed.has('End')) setScroll(READER.max);
    if (keys.pressed.has('Escape') || keys.pressed.has('Enter')) close();
  };

  // ---- the live lane behind the title and the menus ---------------------------------------------------------------------
  const ATTRACT = [[0.08, 1, 1], [-0.14, 2, 1], [0.2, -2, 1], [-0.06, 0, 1], [0.02, 1, 2], [-0.25, -1, 1]];   // aim, hook, power
  const newAttractCam = () => fixedCam();
  const startAttract = () => {
    const a = state.att, pick = ATTRACT[a.n++ % ATTRACT.length];
    a.sim = newSim(ALL(), launchFor(0, pick[0], pick[2], pick[1]), 1);
    a.wait = 0; a.acc = 0;
  };
  let warm = null;
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a.cam) { a.cam = newAttractCam(); startAttract(); }
    if (!shotMode) { if (!warm) warm = tableJob(ALL()); else if (!warm.table) warm.step(6); }   // the full-set table is ready before the first match
    a.parts = stepParts(a.parts, dt);
    const s = a.sim;
    if (!s.done) {
      a.acc += dt * 0.9;
      let n = 0;
      while (a.acc >= DT && !s.done && n < 60) { snapSim(s); stepSim(s); a.acc -= DT; n++; }
      a.alpha = a.acc / DT;
      for (const e of s.events) if (e.k === 'tip') dust(a.parts, e.x, e.z, 3, 1);
      s.events.length = 0;
    } else { a.wait += dt; if (a.wait > 1.6) startAttract(); }
  };

  // ---- shot presets (store screenshots): ?shot=1&seed=N picks a fixed, deterministic screen ----------------------------
  const shotMatch = (cfg, throws) => {
    startMatch({ first: 0, ...cfg });
    const m = state.m;
    throws.forEach(([phase, pins, side]) => { m.throws[side].push({ phase, pins, pudel: false, alle: pins === 9, kranz: false, cleared: false, left: ALL(), before: ALL() }); m.done[side][phase]++; });
    state.banner = null; state.ph = 'aim'; state.humanTurn = true; state.drops = null;
  };
  const SHOT_THROWS = [[0, 6, 0], [0, 5, 1], [0, 7, 0], [0, 4, 1]];
  const shotRoll = (steps, plan, standing = ALL()) => {
    shotMatch({ mode: 'ai', opp: 2, len: 1 }, SHOT_THROWS);
    state.plan = { ...plan };
    const L = launchFor(plan.x0, plan.aimX, plan.power, plan.hook);
    launch(L); state.sim = newSim(standing, L, 1);
    const s = state.sim; let n = 0; while (n++ < steps && !s.done) stepSim(s);
        state.ph = 'rolling'; handleEvents(s, state.parts);
    state.parts = stepParts(state.parts, 0.05);
    setOverlay();
  };
  const NOINPUT = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const applyPreset = () => {
    if (shotSeed >= 1000) { shotRoll((shotSeed - 1000) * 12, { x0: 0.12, aimX: -0.07, power: 1, hook: -2 }); return; }   // filmstrip: seed 1000 + k = k * 12 physics steps into the roll
    const n = ((shotSeed % 100) + 100) % 100;
    if (n === 60) {   // showcase: two computer players play for real while the shot runs its ticks (input ignored)
      state.showcase = true; state.settings.thinkIdx = 0; state.thinkSecs = 2;
      startMatch({ mode: 'watch', watchA: 3, opp: 4, len: 0, first: 0 }); return;
    }
    state.shot = true;
    updateAttract(0);
    if (n === 1) { const a = state.att; a.cam = newAttractCam(); a.n = 1; startAttract(); const s = a.sim; let k = 0; while (k++ < 700 && !s.done) stepSim(s); s.events.length = 0; state.scene = 'title'; return; }
    if (n === 2) { shotMatch({ mode: 'ai', opp: 2, len: 1 }, [...SHOT_THROWS, [0, 8, 0], [0, 6, 1]]); state.plan = { x0: 0.12, aimX: -0.07, power: 1, hook: -2 }; state.lastPath = pathPoints(0, 0.12, 1, 0, 10); setOverlay(); return; }
    if (n === 3) { shotRoll(300, { x0: 0.12, aimX: -0.07, power: 1, hook: -2 }); return; }
    if (n === 4) { shotRoll(780, { x0: 0.12, aimX: -0.07, power: 1, hook: -2 }); return; }
    if (n === 5) {
      shotMatch({ mode: 'ai', opp: 3, len: 1 }, [...SHOT_THROWS, [0, 8, 0], [0, 6, 1], [1, 4, 0], [1, 3, 1]]);
      state.m.phase = 1; state.m.standing[0] = maskArr([1, 3, 6, 7]); state.m.turn = 0; resetPins(curStanding(), false);
      state.plan = { x0: 0.25, aimX: -0.38, power: 1, hook: 2 };
      state.hint = { busy: false, plan: { x0: 0.3, aimX: -0.43, power: 1, hook: 2 }, text: 'From 30 cm right, aim 43 cm left of the centre line, medium hook right, Medium weight. 4 pins are left. Twelve test rolls cleared 3.1 on average (1 to 4).' };
      setOverlay(); return;
    }
    if (n === 6) {
      startMatch({ mode: 'ai', opp: 2, len: 1, first: 0 }); const m = state.m;
      const t = (p, k, side) => { m.throws[side].push({ phase: p, pins: k, pudel: false, alle: k === 9, kranz: false, cleared: false, left: ALL(), before: ALL() }); m.done[side][p]++; };
      [6, 5, 7, 4, 8, 6, 5, 9, 4, 7].forEach((v, i) => t(0, v, i % 2)); [3, 5, 2, 4, 6, 3, 2, 5, 4, 3].forEach((v, i) => t(1, v, i % 2));
      m.over = { win: totals(m, 0).total > totals(m, 1).total ? 0 : 1 }; state.scene = 'result'; return;
    }
    if (n === 7) { state.back = 'title'; state.scene = 'rules'; state.ui.scroll = 0; return; }
    if (n === 8) { state.back = 'title'; state.scene = 'howto'; state.ui.scroll = 0; return; }
    if (n === 9) { state.scene = 'setup'; return; }
    if (n === 10) { state.scene = 'settings'; return; }
    if (n === 11) { state.back = 'title'; state.scene = 'about'; return; }
    if (n === 12) { shotRoll(840, { x0: 0, aimX: 0.05, power: 2, hook: 0 }); return; }
    if (n === 13) {
      startWatch(); state.m.cfg.watchA = 3; state.m.cfg.opp = 2; state.plan = { x0: -0.3, aimX: 0.07, power: 1, hook: 2 };
      state.think = { t: 0.8, dur: 2, phase: 'reveal', plan: { ...state.plan }, text: 'From 30 cm left, aim 7 cm right of the centre line, medium hook right, Medium weight. Twelve test rolls dropped 7.5 pins on average (6 to 9).', x0From: 0, progress: 1 };
      state.ph = 'think'; state.banner = null; state.drops = null; setOverlay(); return;
    }
    if (n === 14) { state.scene = 'learn'; return; }
    if (n === 30) { state.settings.textIdx = 4; startWatch(); state.m.cfg.watchA = 3; state.m.cfg.opp = 2; state.plan = { x0: -0.3, aimX: 0.07, power: 1, hook: 2 }; state.think = { t: 0.8, dur: 2, phase: 'reveal', plan: { ...state.plan }, text: 'From 30 cm left, aim 7 cm right of the centre line, medium hook right, Medium weight. Twelve test rolls dropped 7.5 pins on average (6 to 9).', x0From: 0, progress: 1 }; state.ph = 'think'; state.banner = null; state.drops = null; setOverlay(); return; }
    if (n === 31) { state.settings.textIdx = 4; startLesson(1); state.banner = null; return; }
    if (n === 32) { state.settings.textIdx = 4; state.m = null; startLesson(1); state.banner = null; state.ph = 'aim'; state.humanTurn = true; state.drops = null; setOverlay(); return; }
    if (n === 15) { startLesson(2); state.banner = null; state.ph = 'aim'; state.humanTurn = true; state.drops = null; state.plan = { x0: 0.3, aimX: -0.42, power: 1, hook: 2 }; setOverlay(); return; }
    if (n === 16) { shotRoll(1100, { x0: 0.12, aimX: -0.07, power: 1, hook: -2 }); state.ph = 'result'; state.res = { pins: 7, pudel: false }; showBanner('7', '7 pins down', '', 99, 120); state.banner.t = 0.5; return; }
    if (n === 18) { shotRoll(1500, { x0: 0.4, aimX: 0.06, power: 1, hook: 0 }); state.ph = 'result'; state.res = { pins: 9, alle: true }; showBanner('ALLE NEUNE!', 'All nine pins down', '', 99, 76); state.banner.t = 0.5; return; }
    if (n === 17) {   // the replay inset: the main view shows the finished throw, the inset replays the crash
      shotRoll(60, { x0: 0.12, aimX: -0.07, power: 1, hook: -2 });
      const L = state.thrown.L, full = newSim(ALL(), L, 1); let k = 0; while (k++ < 3400 && !full.done) stepSim(full);
      state.final = full; state.sim = newSim(ALL(), L, 1); k = 0; while (k++ < 800 && !state.sim.done) stepSim(state.sim);
      state.ph = 'replay'; state.rt = 2; state.parts = []; state.pipParts = []; handleEvents(state.sim, state.pipParts); state.ballShow = null; return;
    }
    if (n >= 20 && n <= 29) {
      state.settings.textIdx = 4;
      if (n === 20) { state.back = 'title'; state.scene = 'rules'; state.ui.scroll = 1800; }
      else if (n === 21) state.scene = 'title';
      else if (n === 22) { shotMatch({ mode: 'ai', opp: 2, len: 1 }, [[0, 6, 0], [0, 5, 1]]); setOverlay(); }
      else if (n === 23) state.scene = 'settings';
      else if (n === 24) state.scene = 'setup';
      else if (n === 25) { shotMatch({ mode: 'ai', opp: 2, len: 1 }, [[0, 6, 0], [0, 5, 1]]); state.sheet = true; }
      else if (n === 26) {
        startMatch({ mode: 'ai', opp: 2, len: 1, first: 0 }); const m = state.m; m.over = { win: 0, a: 80, b: 70 };
        [6, 5, 7, 4, 8].forEach((v, i) => { m.throws[i % 2].push({ phase: 0, pins: v, pudel: false, alle: false, kranz: false, cleared: false, left: ALL(), before: ALL() }); }); state.scene = 'result';
      } else if (n === 27) { state.back = 'title'; state.scene = 'about'; }
      else if (n === 28) { shotRoll(840, { x0: 0, aimX: 0.05, power: 2, hook: 0 }); state.ph = 'result'; state.res = { pins: 7 }; showBanner('7', '7 pins down', '', 99, 120); state.banner.t = 0.5; }
      else if (n === 29) { state.back = 'title'; state.scene = 'howto'; state.ui.scroll = 900; }
      return;
    }
    if (n >= 40 && n <= 59) { state.back = 'title'; state.scene = 'rules'; state.ui.scroll = (n - 40) * 900; }
  };

  // ---- the object the kit and the shell see --------------------------------------------------------------------------------
  const game = {
    // Watch & Learn, the lessons and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch' && state.m.cfg.mode !== 'learn') || state.paused,
    update(dt, input) {
      syncSize();
      if (state.showcase) input = NOINPUT;
      setPress(input.pointer);
      if (state.shot) { state.t += dt; return; }
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      toneBudget = 0;
      if (state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'learn': updateFlowScene(dt, input, handleLearn, 'learn'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
      wheelInput.dy = 0;
    },
    render(ctx) {
      syncSize();
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'learn': renderLearn(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.m) {
            setOverlay();
            renderPlay(ctx, state);
            if (state.sheet && state.ph === 'aim') renderSheet(ctx, state);
            if (state.why) renderWhy(ctx, state);
            if (state.pauseMenu) renderPause(ctx, state);
          }
          break;
        default: break;
      }
    },
    getState: () => state,
    // Dev tools (main.js exposes them only with ?dev=1): jump to a screen with the store-shot presets, and list the tap rectangles on screen.
    devPreset(n) {
      state.shot = false; state.showcase = false; state.pauseMenu = false; state.paused = false; state.sheet = false; state.why = null; state.ui.scroll = 0;
      if (n === 'pause') { shotSeed = 2; applyPreset(); state.shot = false; openPause(); return; }
      if (n === 'why') { shotSeed = 13; applyPreset(); state.shot = false; openWhy(); return; }
      if (n === 'lesson') { startLesson(1); return; }
      if (n === 'lessonresult') { startLesson(0); state.m.lesson.passed = true; state.m.lesson.used = 1; state.scene = 'result'; return; }
      if (n === 'demolimit') { state.scene = 'demolimit'; return; }
      if (typeof n === 'number' && n >= 100) { state.settings.textIdx = n - 100; return; }
      shotSeed = n; applyPreset();
    },
    devRects() {
      const out = [], sc = state.scene;
      const add = (id, r) => { if (r) out.push({ id, x: r.x, y: r.y, w: r.w, h: r.h, scroll: !!r.scroll }); };
      if (sc === 'play' && state.m) {
        if (state.why || state.sheet || state.pauseMenu) { const mt = flowMeta(); for (const c of mt.cols) for (const it of c.lay.items) if (it.w.t === 'btn') add(it.w.id, { x: it.x, y: c.top + it.y - state.ui.scroll, w: it.wd, h: it.h, scroll: true }); }
        else { const R = computeLayout(state, null).rects; for (const k of Object.keys(R)) add(k, R[k]); }
      } else if (sc === 'howto' || sc === 'about' || sc === 'rules') { const G = refGeom(); ['dec', 'inc', 'back', 'next'].forEach((k) => add(k, G[k])); }
      else { ensureLayout(state, sc); const mt = flowMeta(); for (const c of mt.cols) for (const it of c.lay.items) if (it.w.t === 'btn') add(it.w.id, { x: it.x, y: c.top + it.y - state.ui.scroll, w: it.wd, h: it.h, scroll: true }); if (sc === 'setup') { const g = setupGeom(); add('start', g.start); add('sback', g.back); } }
      return out;
    },
  };
  updateAttract(0);
  if (shotMode) applyPreset();
  return game;
}
