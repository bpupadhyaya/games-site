// Snooker: Cue and Frame. State and flow. Physics lives in sim.js, rules in rules.js, the computer players in ai.js, the aim guide
// in guide.js, drawing in view.js and menus.js, lessons in lessons.js, hints in explain.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, learn, quiz, play (also Watch & Learn and lessons), result, howto/about/rules, demolimit.
// A turn: aim (drag on the table, fine-tune in the magnifier), choose the spin, pull the cue back and release. Everything advances
// in fixed physics steps; the display blends between two updates so motion is smooth at any refresh rate.
import {
  CUE, R, TW, TL, MID_X, rackWorld, createWorld, addBall, ballById, strike, stepWorld, anyMoving, nearestInD, isRed,
} from './sim.js';
import {
  newFrame, FORMATS, MATCH_LENGTHS, other, ballsOn, judge, applyShot, beforeShot, placeCue, defaultCuePos, whyText,
} from './rules.js';
import { PROFILES, createPlanner, execNoise, bestPlacement, wantsReplay } from './ai.js';
import { aimRay, objectLine, previewShot, snapAim } from './guide.js';
import { explainShot, situation } from './explain.js';
import { LESSONS, lessonById, lessonIndex, lessonWorld } from './lessons.js';
import { inRect, REF_BACK, REF_NEXT, TEXT_DEC, TEXT_INC, TEXT_SCALES, THINK_STEPS, SETUP_PINS } from './layout.js';
import { renderPlay, layoutFor, camFor, aimToTable, cardRect, verdictScroll } from './view.js';
import {
  renderTitle, renderSetup, renderSettings, renderLearn, renderQuiz, renderResult, renderPause, renderSpin, renderReason, renderLessonResult, renderPages, renderDemoLimit,
  hitScreen, flowMeta, docMeta, ensureLayout, resetMenus, artRect,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';
import { pressLockup } from './brand.js';

export { meta } from './layout.js';
const DEMO_FRAME_CAP = 2;
const SHOT_MODE = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();
const PACE = 4;                 // physics steps per update: 4 x 1/240 s = real time at 60 updates per second
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TAU = Math.PI * 2;

const BLANK = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };

export function createGame(env) {
  const nowMs = () => (env.clock ? env.clock() : 0);   // display clock from the shell; absent in headless runs
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, spinOpts: false, reasonOpen: false, demo: !!config.demo,
    settings: { sound: true, textIdx: 0, thinkIdx: 1, guide: 1, assist: 1 },
    record: { wins: [0, 0, 0, 0, 0], played: 0, streak: 0, best: 0, high: 0, demoFrames: 0 },
    learn: { done: {} },
    setup: { mode: 'ai', opp: 0, format: 'six', best: 1 }, setupMsg: '',
    ui: { scroll: 0, drag: null }, page: 0,
    m: null, f: null, w: null, names: ['You', 'Mia'], ctl: 'aim', phaseKind: 'aim',
    aim: { angle: Math.PI / 2, a: 0, b: 0, pull: 0, pulling: false, hint: null }, guide: null,
    humanTurn: false, parts: [], pops: [], toast: '', toastT: 0, card: null, hl: null, verdict: null, verdictT: 0,
    think: null, hintBusy: false, wlabel: '', rollLabel: '', saved: null, quiz: null, lesson: null, lessonRes: null, loaded: false, restoreMsg: '', ff: false,
    drag: null, stroke: null, pre: null, settleT: 0, shotMode: null, attract: [], lastShot: null, evs: [], assist: false, kpow: 0.45,
  };
  let planner = null, hintPlanner = null, guideKey = '';

  // ---- persistence ------------------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); storage.set('learn', state.learn); };
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('learn', null), storage.get('match', null)]).then(([s, r, l, mt]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    if (l && l.done && typeof l.done === 'object') state.learn = { done: { ...l.done } };
    if (!state.saved) state.saved = validSnapshot(mt);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    state.settings.guide = clamp(state.settings.guide | 0, 0, 2);
    state.settings.assist = state.settings.assist ? 1 : 0;
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 5) state.record.wins = [0, 0, 0, 0, 0];
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // A match is written down at every safe point (a turn is about to start, every ball is at rest) and offered as Continue.
  const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  function validSnapshot(sn) {
    try {
      if (!sn || sn.v !== 1 || !sn.cfg || !(sn.cfg.mode === 'ai' || sn.cfg.mode === 'two')) return null;
      const c = sn.cfg;
      if (!num(c.opp, 0, PROFILES.length - 1) || !FORMATS[c.format] || !MATCH_LENGTHS.includes(c.best) || !num(c.breaker0, 0, 1)) return null;
      if (!num(sn.frameNo, 1, 9) || !Array.isArray(sn.frames) || sn.frames.length !== 2 || !sn.frames.every((v) => num(v, 0, 9))) return null;
      const f = sn.f;
      if (!f || !Array.isArray(f.scores) || f.scores.length !== 2 || !f.scores.every((v) => num(v, 0, 999))) return null;
      if (!num(f.turn, 0, 1) || !num(f.breaker, 0, 1) || !['red', 'colour', 'order'].includes(f.on) || !num(f.next ?? 16, 16, 21) || !num(f.visit, 0, 200)) return null;
      if (!Array.isArray(f.high) || f.high.length !== 2 || !Array.isArray(f.fouls) || f.fouls.length !== 2) return null;
      if (!Array.isArray(sn.balls) || sn.balls.length < 2 || sn.balls.length > 22) return null;
      if (!sn.balls.every((q) => q && num(q.id, 0, 21) && num(q.x, -1, TW + 1) && num(q.y, -1, TL + 1) && typeof q.on === 'boolean')) return null;
      if (!sn.aim || !num(sn.aim.angle, -10, 10) || !num(sn.aim.a, -1, 1) || !num(sn.aim.b, -1, 1)) return null;
      return sn;
    } catch { return null; }
  }
  const snapshot = () => {
    const { m, f, w } = state;
    return {
      v: 1, cfg: { mode: m.cfg.mode, opp: m.cfg.opp, format: m.cfg.format, best: m.cfg.best, seed: m.cfg.seed, breaker0: m.cfg.breaker0 }, frameNo: m.frameNo, frames: m.frames.slice(),
      f: { scores: f.scores.slice(), turn: f.turn, breaker: f.breaker, on: f.on, next: f.next, visit: f.visit, free: !!f.free, inHand: !!f.inHand, shots: f.shots, blackOff: !!f.blackOff, nReds: f.nReds, high: f.high.slice(), fouls: f.fouls.slice() },
      balls: w.b.map((q) => ({ id: q.id, x: q.x, y: q.y, on: q.on })), aim: { angle: state.aim.angle, a: state.aim.a, b: state.aim.b },
    };
  };
  const persistMatch = () => {
    if (state.m && (state.m.cfg.mode === 'ai' || state.m.cfg.mode === 'two') && state.f && !state.f.over && !state.lesson && !anyMoving(state.w)) { state.saved = snapshot(); storage.set('match', state.saved); }
  };
  const clearSaved = () => { if (state.saved) { state.saved = null; storage.set('match', null); } };

  // ---- sound ---------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    clack: (v) => {
      const q = Math.min(1, v / 4);
      tone({ freq: 1500 + fx.next() * 500, to: 800, dur: 0.035, type: 'square', vol: 0.02 + 0.05 * q });
      tone({ freq: 420 + fx.next() * 60, to: 220, dur: 0.07, type: 'triangle', vol: 0.05 + 0.1 * q });
    },
    thud: (v) => tone({ freq: 140 + fx.next() * 30, to: 70, dur: 0.1, type: 'sine', vol: 0.03 + 0.07 * Math.min(1, v / 3) }),
    pot: () => { tone({ freq: 190, to: 70, dur: 0.22, type: 'sine', vol: 0.12 }); tone({ freq: 620, to: 300, dur: 0.08, type: 'triangle', vol: 0.05 }); },
    cue: (p) => { tone({ freq: 900 + 600 * p, to: 500, dur: 0.04, type: 'triangle', vol: 0.05 + 0.1 * p }); tone({ freq: 130, to: 80, dur: 0.1, type: 'sine', vol: 0.05 }); },
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 220, to: 140, dur: 0.2, type: 'sawtooth', vol: 0.06 }),
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.19, i), dur: 0.22, type: 'sine', vol: 0.09 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };

  // ---- particles (localised only; the table never moves) ------------------------------------------------------------------------
  const MAX_PARTS = 120;
  const addPart = (q) => { if (state.parts.length < MAX_PARTS) state.parts.push(q); };
  const sparks = (x, y, n, speed = 1, col = '#ffffff') => {
    for (let i = 0; i < n; i++) { const a = fx.next() * TAU, s = (0.15 + fx.next() * 0.5) * speed; addPart({ kind: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, z: 0.02, t: 0, max: 0.3 + fx.next() * 0.25, size: 1.5 + fx.next() * 1.8, col }); }
  };
  const ring = (x, y, size, col, max = 0.4) => addPart({ kind: 2, x, y, vx: 0, vy: 0, t: 0, max, size, col });
  const stepParts = (dt) => {
    for (const q of state.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94; }
    for (let i = state.parts.length - 1; i >= 0; i--) if (state.parts[i].t >= state.parts[i].max) state.parts.splice(i, 1);
  };
  const pop = (x, y, text, col, size = 26) => { state.pops.push({ x, y, text, col, size, t: 0, max: 1.5 }); if (state.pops.length > 8) state.pops.shift(); };
  const worldEvents = (ev, live) => {
    for (const e of ev) {
      if (e.k === 'hit') {
        sparks(e.x, e.y, Math.min(9, 2 + Math.floor(e.v * 1.5)), 1.1);
        ring(e.x, e.y, 18 + e.v * 8, '#ffffff', 0.35);
        if (live) sfx.clack(e.v);
      } else if (e.k === 'cush' || e.k === 'jaw') {
        if (e.v > 0.35) ring(e.x, e.y, 12 + e.v * 5, 'rgba(200,255,220,0.9)', 0.3);
        if (live) sfx.thud(e.v);
      } else if (e.k === 'pot') {
        sparks(e.x, e.y, 8, 1.2, '#ffe08a');
        ring(e.x, e.y, 34, '#ffe08a', 0.5);
        if (live) sfx.pot();
      }
    }
  };

  // ---- the attract table behind the menus -----------------------------------------------------------------------------------------
  const startAttract = () => {
    const w = rackWorld(6);
    const r = fx.fork();
    const balls = w.b.filter((q) => q.on).map((q) => ({ id: q.id, x: q.x, y: q.y, mx: 0.3, my: 0.2, mz: 0.93 }));
    for (const b of balls) {
      if (b.id >= 1 && b.id <= 15) { b.x += (r.next() - 0.5) * 0.8; b.y -= r.next() * 1.2; }
      if (b.id === 0) { b.x = MID_X + 0.2; b.y = 0.6; }
    }
    for (let i = 0; i < balls.length; i++) for (let j = 0; j < i; j++) {
      const a = balls[i], c2 = balls[j];
      if (Math.hypot(a.x - c2.x, a.y - c2.y) < 2 * R + 0.01) { a.x += 0.16; a.y -= 0.14; }
    }
    for (const b of balls) { b.x = clamp(b.x, R + 0.03, TW - R - 0.03); b.y = clamp(b.y, R + 0.03, TL - R - 0.03); }
    state.attract = balls;
  };

  // ---- modes, names -------------------------------------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const isAI = (t) => mode() === 'watch' || (mode() === 'ai' && t === 1);
  const profOf = (t) => (mode() === 'watch' ? PROFILES[t === 0 ? state.m.cfg.watchA : state.m.cfg.opp] : PROFILES[state.m.cfg.opp]);
  const setNames = () => {
    const c = state.m.cfg;
    state.names = c.mode === 'two' ? ['Player 1', 'Player 2'] : c.mode === 'watch' ? [PROFILES[c.watchA].name, PROFILES[c.opp].name] : c.mode === 'lesson' ? ['You', 'Opponent'] : ['You', PROFILES[c.opp].name];
    if (state.f) state.f.cfg = { ...state.f.cfg, names: state.names };
  };
  const namesFor = (team) => ({ me: state.names[team], foe: state.names[other(team)] });
  const cue = () => ballById(state.w, CUE);

  // ---- the aim -----------------------------------------------------------------------------------------------------------------------------
  function defaultAngle() {
    const c = cue(), w = state.w, f = state.f;
    if (!c || !c.on) return Math.PI / 2;
    const ids = f.free ? w.b.filter((q) => q.on && q.id !== CUE).map((q) => q.id) : ballsOn(f, w);
    let best = null, bd = 1e9;
    for (const id of ids) { const q = ballById(w, id); const d = Math.hypot(q.x - c.x, q.y - c.y); if (d < bd) { bd = d; best = q; } }
    return best ? Math.atan2(best.y - c.y, best.x - c.x) : Math.PI / 2;
  }
  function updateGuide(force = false) {
    const { w, aim } = state;
    const c = cue();
    const key = `${aim.angle.toFixed(5)}|${aim.a.toFixed(2)}|${aim.b.toFixed(2)}|${aim.pulling ? aim.pull.toFixed(2) : 'x'}|${state.settings.guide}|${c ? c.x.toFixed(3) + c.y.toFixed(3) + c.on : ''}|${w.b.length}`;
    if (!force && key === guideKey) return;
    guideKey = key;
    if (!c || !c.on) { state.guide = null; return; }
    const ray = aimRay(w, aim.angle);
    const g = { ray, obj: objectLine(w, ray), pv: null };
    if (state.settings.guide === 2) g.pv = previewShot(w, { angle: aim.angle, power: aim.pulling && aim.pull > 0.04 ? aim.pull : (aim.hint ?? 0.45), a: aim.a, b: aim.b });
    state.guide = g;
  }
  const setAngle = (ang) => {
    let a = ang;
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    state.aim.angle = a;
    if (state.settings.assist) { const easy = state.m && state.m.cfg.mode === 'ai' && state.m.cfg.opp <= 1; const s = snapAim(state.w, a, easy ? 2.2 : 1.4); if (s !== null) state.aim.angle = s; }
    if (state.card && state.card.sticky) state.card = null;
  };

  // ---- turns ----------------------------------------------------------------------------------------------------------------------------------
  function beginTurn(resumed = false) {
    const f = state.f, w = state.w;
    state.ctl = 'aim'; state.phaseKind = 'aim';
    for (const q of w.b) { q.ox = q.x; q.oy = q.y; }
    state.humanTurn = !isAI(f.turn);
    state.stroke = null; state.verdict = null; state.hl = null; state.think = null; state.hintBusy = false; state.drag = null; state.card = null; state.settleT = 0; state.assist = false;
    planner = null; hintPlanner = null; guideKey = '';
    state.aim.pulling = false; state.aim.pull = 0; state.aim.hint = null;
    state.evs = [];
    if (f.inHand || !cue().on) {
      state.phaseKind = 'place';
      if (state.humanTurn) { const p = defaultCuePos(w); placeCue(w, p.x, p.y); f.inHand = true; }
    }
    if (!state.lesson) { state.aim.a = 0; state.aim.b = 0; }
    if (cue().on) state.aim.angle = defaultAngle();
    if (resumed && state.resumeAim) { Object.assign(state.aim, state.resumeAim); state.resumeAim = null; }
    updateGuide(true);
    if (resumed) toast('Frame restored. Press Resume to carry on', 3.2);
    else if (state.humanTurn) {
      if (state.lesson) toast(state.lesson.def.how, 6);
      else if (f.inHand) toast('The white is in hand: drag it inside the D, then aim', 3.4);
      else if (f.free) toast('Free ball: you are snookered, so any ball may be played as the ball on', 3.6);
      else toast(mode() === 'two' ? `${state.names[f.turn]}: your shot. Drag on the table to aim` : 'Your shot: drag on the table to aim, pull the cue back to shoot', 3.0);
    } else if (mode() !== 'watch') toast(`${state.names[f.turn]} is thinking…`, 2.0);
    if (!resumed && !state.lesson) persistMatch();
  }
  function startFrame() {
    const m = state.m;
    state.w = rackWorld(FORMATS[m.cfg.format].reds);
    cue().on = false;
    state.f = newFrame({ format: m.cfg.format, breaker: m.cfg.breaker0 ^ ((m.frameNo - 1) & 1), names: state.names });
    state.parts = []; state.pops = [];
    beginTurn();
    toast(`${state.names[state.f.turn]} ${state.names[state.f.turn] === 'You' ? 'break' : 'breaks'} off`, 2.4);
  }
  function startMatch(cfg) {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoFrames >= DEMO_FRAME_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const seed = cfg.seed ?? aiRng.int(1000000);
    const breaker0 = cfg.breaker0 ?? aiRng.int(2);
    state.lesson = null;
    state.m = { cfg: { mode: 'ai', opp: 0, format: 'six', best: 1, watchA: 3, ...cfg, seed, breaker0 }, frames: [0, 0], frameNo: 1, results: [], over: null };
    setNames();
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.spinOpts = false; state.reasonOpen = false; state.ui.scroll = 0;
    state.aim = { angle: Math.PI / 2, a: 0, b: 0, pull: 0, pulling: false, hint: null };
    startFrame();
  }
  function resumeMatch() {
    const sn = state.saved;
    if (!sn) return;
    if (state.demo && state.record.demoFrames >= DEMO_FRAME_CAP) { clearSaved(); state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const w = createWorld();
    for (const d of sn.balls) { const q = addBall(w, d.id, d.x, d.y); q.on = d.on; }
    const f = newFrame({ format: sn.cfg.format, breaker: sn.f.breaker });
    Object.assign(f, { scores: sn.f.scores.slice(), turn: sn.f.turn, on: sn.f.on, next: sn.f.next, visit: sn.f.visit, free: sn.f.free, inHand: sn.f.inHand, shots: sn.f.shots, blackOff: sn.f.blackOff, high: sn.f.high.slice(), fouls: sn.f.fouls.slice() });
    f.redsLeft = w.b.filter((q) => q.on && isRed(q.id)).length;
    state.w = w; state.f = f; state.lesson = null;
    state.m = { cfg: { watchA: 3, ...sn.cfg }, frames: sn.frames.slice(), frameNo: sn.frameNo, results: [], over: null };
    setNames();
    state.scene = 'play'; state.ui.scroll = 0; state.parts = []; state.pops = []; state.reasonOpen = false;
    state.resumeAim = sn.aim;
    beginTurn(true);
    openPause();    // always resumes paused: nothing moves, and no preview time is used, until the player presses Resume
  }
  function startWatch() {
    const picks = [1, 2, 3, 4];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, best: 1, format: 'six' });
  }

  // ---- lessons ---------------------------------------------------------------------------------------------------------------------------------
  function startLesson(id) {
    const def = lessonById(id);
    if (!def) return;
    if (def.kind === 'quiz') { state.quiz = { def, idx: lessonIndex(id), chosen: null, correct: def.options.indexOf(def.answer()) }; state.scene = 'quiz'; state.ui.scroll = 0; return; }
    state.lesson = { def, tries: 0 };
    state.m = { cfg: { mode: 'lesson', opp: 0, format: 'six', best: 1, seed: 11, breaker0: 0 }, frames: [0, 0], frameNo: 1, results: [], over: null };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.spinOpts = false; state.reasonOpen = false; state.ui.scroll = 0; state.lessonRes = null;
    resetLesson();
  }
  function resetLesson() {
    const { def } = state.lesson;
    const lw = lessonWorld(def);
    state.w = lw.w; state.f = lw.f;
    setNames();
    state.parts = []; state.pops = []; state.lessonRes = null;
    state.aim = { angle: Math.PI / 2, a: 0, b: 0, pull: 0, pulling: false, hint: null };
    beginTurn();
    if (def.aim !== undefined) { state.aim.angle = def.aim; updateGuide(true); }
  }
  const nextLesson = () => {
    const cur = state.lesson ? state.lesson.def.id : state.quiz.def.id;
    const n = LESSONS[lessonIndex(cur) + 1];
    if (n) startLesson(n.id); else { state.scene = 'learn'; state.ui.scroll = 0; state.lesson = null; }
  };

  // ---- the stroke and the roll ------------------------------------------------------------------------------------------------------------------------
  function takeShot(team, shot, human) {
    const f = state.f, w = state.w;
    const sh = human || state.lesson ? { ...shot } : execNoise(shot, profOf(team), aiRng);
    state.pre = { balls: w.b.map((q) => ({ id: q.id, x: q.x, y: q.y, on: q.on, mx: q.mx, my: q.my, mz: q.mz })), f: JSON.parse(JSON.stringify({ ...f, cfg: undefined })), before: beforeShot(f, w), team };
    state.stroke = { t: 0, dur: 0.3, power: sh.power, shot: sh };
    state.ctl = 'roll'; state.phaseKind = 'stroke'; state.humanTurn = false;
    state.guide = null; state.card = null; state.think = null; state.drag = null; state.aim.pulling = false; state.aim.hint = null;
    state.aim.angle = sh.angle;
    state.rollLabel = `${Math.round(shot.power * 100)}% power${shot.b > 0.2 ? ' · top spin' : shot.b < -0.2 ? ' · back spin' : ''}${shot.a > 0.2 ? ' · right spin' : shot.a < -0.2 ? ' · left spin' : ''}`;
    state.lastShot = { team, shot: sh };
    state.evs = [];
    sfx.cue(shot.power);
  }
  function humanShoot(power) {
    if (!state.humanTurn || state.paused || state.ctl !== 'aim' || !cue().on) return;
    const a = state.aim;
    takeShot(state.f.turn, { angle: a.angle, power: clamp(power, 0.03, 1), a: a.a, b: a.b }, true);
  }
  function updateRoll(dt, input) {
    const { w } = state;
    if (state.stroke) {
      state.stroke.t += dt;
      if (state.stroke.t >= state.stroke.dur) {
        strike(w, state.stroke.shot);
        state.stroke = null; state.phaseKind = 'roll'; state.shotT0 = w.t;
        for (const q of w.b) { q.ox = q.x; q.oy = q.y; }
      }
      return;
    }
    state.ff = !!(input.pointer.down && inRect(layoutFor(state).ctrl.fast, input.pointer.x, input.pointer.y)) || (state.m.cfg.mode === 'watch' && input.keys.down.has('Space'));
    for (const q of w.b) { q.ox = q.x; q.oy = q.y; }
    const steps = PACE * (state.ff ? 3 : 1);
    const ev = [];
    for (let i = 0; i < steps; i++) {
      stepWorld(w);
      if (w.ev.length) { for (const e of w.ev) ev.push(e); w.ev.length = 0; }
      if (!anyMoving(w)) break;
    }
    if (ev.length) { worldEvents(ev, true); for (const e of ev) state.evs.push(e); }
    state.stepped = true;
    if (!anyMoving(w)) {
      state.settleT += dt;
      if (state.settleT > 0.5) onSettled();
    } else state.settleT = 0;
    if (w.t - (state.shotT0 ?? 0) > 70) for (const q of w.b) { q.vx = 0; q.vy = 0; q.wx = 0; q.wy = 0; }
  }

  // After everything is at rest: judge the shot, apply the rules, show what happened.
  function onSettled() {
    const { f, w } = state;
    for (const q of w.b) { q.vx = 0; q.vy = 0; q.wx = 0; q.wy = 0; q.wz = 0; q.ox = q.x; q.oy = q.y; }
    if (state.lesson) { finishLessonShot(); return; }
    const pre = state.pre, team = pre.team;
    const res = judge(f, w, state.evs, pre.before);
    const out = applyShot(f, w, res, pre.before);
    if (state.replayed) { f.pendingMiss = null; state.replayed = false; }          // a shot that was replayed cannot be replayed again
    for (const q of w.b) if (q.respotted) { q.rt = 0; ring(q.x, q.y, 30, '#ffffff', 0.6); }
    state.lastRes = res;
    const names = state.names;
    if (!res.foul && res.scored > 0) {
      const last = res.potted[res.potted.length - 1];
      const ex = state.evs.find((e) => e.k === 'pot' && e.id === last);
      pop(ex ? ex.x : MID_X, ex ? ex.y : TL / 2, `+${res.scored}`, '#ffe08a', 34);
      for (let i = 0; i < Math.min(4, res.scored); i++) sfx.chime(i);
    }
    if (f.over) { endFrame(); return; }
    if (res.foul) {
      sfx.no();
      const vs = [`The ${whyText(res)}.`];
      if (f.inHand) vs.push(`${names[f.turn]} places the white in the D.`);
      if (f.free) vs.push('Free ball: the next player is snookered and may play any ball as the ball on.');
      for (const n of out.notes) if (n.k === 'blackoff') vs.push(n.text);
      state.verdict = { title: `Foul: ${res.foulPts} to ${names[other(team)]}`, tone: 'bad', lines: vs, buttons: [{ id: 'cont', label: 'Continue', primary: true }] };
      // the miss rule: the incoming player may ask for the balls to be put back
      if (f.pendingMiss) {
        if (!isAI(f.turn)) {
          state.verdict.lines.push('This counts as a miss: the white should have hit a ball on. You can play on from here, or make the other player take the shot again.');
          state.verdict.buttons = [{ id: 'replay', label: 'Play it again', primary: false }, { id: 'cont', label: 'Play on', primary: true }];
        } else if (wantsReplay(f, w, profOf(f.turn))) {
          state.verdict.lines.push(`${names[f.turn]} asks for the balls to be put back: ${names[team]} must play the shot again.`);
          state.verdict.buttons = [{ id: 'replay', label: 'Replace the balls', primary: true }];
        } else state.verdict.lines.push(`${names[f.turn]} plays on from here.`);
      }
      state.ctl = 'verdict'; state.phaseKind = 'verdict'; state.humanTurn = false;
      if (mode() === 'watch') state.verdictT = 3.2;
      return;
    }
    for (const n of out.notes) if (n.k === 'blackoff') toast(n.text, 4);
    // a clean shot: carry on straight away (the visit continues, or the turn passes)
    if (out.turnEnds && mode() !== 'watch') toast(`${names[f.turn]} to play`, 1.6);
    beginTurn();
  }
  function endFrame() {
    const { f, m } = state;
    const win = f.over.win;
    m.frames[win]++;
    m.results.push({ scores: f.scores.slice(), win, high: f.high.slice() });
    const matchOver = m.frames[win] > m.cfg.best / 2 || m.cfg.mode === 'watch';
    if (m.cfg.mode !== 'watch') state.record.demoFrames = (state.record.demoFrames | 0) + 1;
    state.record.high = Math.max(state.record.high | 0, f.high[0]);
    if (matchOver) m.over = { win };
    sfx.win();
    const nm = state.names[win];
    state.verdict = {
      title: `${nm} ${nm === 'You' ? 'win' : 'wins'} the frame`, tone: win === 0 || m.cfg.mode === 'two' ? 'good' : 'bad',
      lines: [`${f.scores[0]} – ${f.scores[1]}  ·  ${f.over.why}`, m.cfg.best > 1 ? `Frames: ${m.frames[0]} – ${m.frames[1]}` : ''].filter(Boolean),
      buttons: [{ id: matchOver ? 'result' : 'nextframe', label: matchOver ? 'See the result' : 'Next frame', primary: true }],
    };
    state.ctl = 'verdict'; state.phaseKind = 'frameover'; state.humanTurn = false;
    if (m.cfg.mode === 'watch') state.verdictT = 4;
    if (matchOver && m.cfg.mode === 'ai') {
      state.record.played++;
      if (win === 0) { state.record.wins[m.cfg.opp]++; state.record.streak++; state.record.best = Math.max(state.record.best, state.record.streak); } else state.record.streak = 0;
    }
    clearSaved(); save();
  }
  function verdictTap(id) {
    sfx.tick();
    const { f, m } = state;
    if (id === 'cont') { beginTurn(); return; }
    if (id === 'replay') {
      // put the balls back, keep the foul points, the offender plays again
      const pre = state.pre, w = state.w;
      for (const d of pre.balls) { const q = ballById(w, d.id); if (q) { q.x = d.x; q.y = d.y; q.on = d.on; q.vx = 0; q.vy = 0; q.wx = 0; q.wy = 0; q.wz = 0; q.mx = d.mx; q.my = d.my; q.mz = d.mz; q.pk = -1; q.pt = 0; q.respotted = 0; q.ox = d.x; q.oy = d.y; } }
      const keep = f.scores.slice(), fouls = f.fouls.slice(), high = f.high.slice();
      Object.assign(f, pre.f, { cfg: f.cfg, scores: keep, fouls, high, pendingMiss: null, over: null });
      f.turn = pre.team; f.visit = 0; state.replayed = true;
      toast(`${state.names[f.turn]} plays the shot again`, 2.4);
      beginTurn();
      return;
    }
    if (id === 'nextframe') { m.frameNo++; startFrame(); return; }
    if (id === 'result') { state.scene = 'result'; state.ui.scroll = 0; state.ctl = 'aim'; }
  }

  // ---- lessons: judge one shot -----------------------------------------------------------------------------------------------------------------------------
  function finishLessonShot() {
    const { w, f } = state;
    const res = judge(f, w, state.evs, state.pre.before);
    const r = state.lesson.def.check({ w, res, shot: state.lastShot.shot, cue: ballById(w, CUE) });
    state.lesson.tries++;
    if (r.ok && !state.assist) { state.learn.done[state.lesson.def.id] = true; save(); sfx.win(); } else if (r.ok) sfx.chime(2); else sfx.no();
    state.lessonRes = { ok: r.ok, msg: r.msg + (state.assist && r.ok ? ' (That one was the demonstration.)' : ''), id: state.lesson.def.id };
    state.ctl = 'aim'; state.phaseKind = 'lessonres';
  }

  // ---- the computer player's turn ---------------------------------------------------------------------------------------------------------------------------
  const describe = (res, team) => explainShot(state.f, state.w, res, namesFor(team));
  function applyPlan(p) {
    const a = state.aim;
    a.angle = p.shot.angle; a.a = p.shot.a; a.b = p.shot.b; a.hint = p.shot.power;
    guideKey = ''; updateGuide(true);
  }
  function runBudget(pl, n) {
    if (!env.clock) { pl.step(n * 24); return; }
    const t0 = nowMs();
    do { pl.step(1); } while (!pl.done && nowMs() - t0 < 6);
  }
  function updateAI(dt) {
    const { f } = state;
    if (state.ctl !== 'aim' || !isAI(f.turn) || state.paused || state.lesson) return;
    const prof = profOf(f.turn), watch = mode() === 'watch', side = f.turn;
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur, phase: 'think', plan: null };
      if (f.inHand || !cue().on) { const p = bestPlacement(f, state.w, prof, aiRng); placeCue(state.w, p.x, p.y); f.inHand = false; state.phaseKind = 'aim'; state.aim.angle = defaultAngle(); }
      planner = createPlanner(f, state.w, prof, aiRng, {});
      if (watch) { state.wlabel = `${state.names[side]} is thinking…`; toast(`${state.names[side]} is thinking…`, Math.min(dur, 3)); }
    }
    const th = state.think;
    th.t += dt;
    if (planner && !planner.done) { runBudget(planner, 1); if (planner.done) { th.plan = planner.result; planner = null; } }
    if (th.phase === 'think' && th.t >= th.dur && th.plan) {
      th.phase = 'reveal'; th.t = 0; th.dur = watch ? 2 : 0.9;
      applyPlan(th.plan);
      if (watch) {
        const ex = describe(th.plan, side);
        state.card = { title: `${state.names[side]}: ${ex.title}`, text: `${situation(f, state.w, namesFor(side))}. ${ex.reason}`, sticky: true };
        state.wlabel = `${state.names[side]} will play: ${ex.title}`;
      }
    } else if (th.phase === 'reveal') {
      // ease the cue back during the reveal so the shot is visibly about to happen
      state.aim.pull = clamp(th.t / th.dur, 0, 1) * th.plan.shot.power; state.aim.pulling = true;
      if (th.t >= th.dur) {
        state.aim.pulling = false;
        takeShot(side, th.plan.shot, false);
        if (watch) state.wlabel = `${state.names[side]} plays the shot`;
      }
    }
  }

  // ---- Think (hint for the human) ---------------------------------------------------------------------------------------------------------------------------
  function applyAdvice(r) {
    const a = state.aim;
    a.angle = r.shot.angle; a.a = r.shot.a; a.b = r.shot.b; a.hint = r.shot.power;
    guideKey = ''; updateGuide(true);
    const ex = describe(r, state.f.turn);
    state.card = { title: `Think: ${ex.title}`, text: `${situation(state.f, state.w, namesFor(state.f.turn))}. ${ex.reason}`, sticky: true };
  }
  function showModel() {
    const d = state.lesson.def;
    if (!d.model) return;
    const a = state.aim;
    a.angle = d.model.angle; a.a = d.model.a ?? 0; a.b = d.model.b ?? 0; a.hint = d.model.power;
    guideKey = ''; updateGuide(true);
    state.card = { title: `Show me: ${d.title}`, text: `${d.goal} The aim and spin are set. Pull the cue back to the marked power and release.`, sticky: true };
    state.assist = true;
  }
  function requestHint() {
    if (state.hintBusy || state.ctl !== 'aim' || !state.humanTurn) return;
    if (state.lesson) { showModel(); return; }
    if (state.f.inHand) { toast('Place the white first, then use Think', 2); return; }
    state.hintBusy = true; state.think = { t: 0, dur: 0, phase: 'hint', plan: null };
    hintPlanner = createPlanner(state.f, state.w, PROFILES[4], aiRng, { perfect: true });
  }
  function updateHint() {
    if (!hintPlanner) return;
    runBudget(hintPlanner, 2);
    if (hintPlanner.done) {
      const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false; state.think = null;
      if (state.ctl !== 'aim' || !state.humanTurn) return;
      applyAdvice(r);
    }
  }

  // ---- the play scene -------------------------------------------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.spinOpts = false; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leaveMatch = () => {
    const wasLesson = !!state.lesson;
    state.scene = wasLesson ? 'learn' : 'title'; state.paused = false; state.pauseMenu = false; state.spinOpts = false; state.reasonOpen = false; state.ui.scroll = 0;
    state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.drag = null; state.card = null; state.lesson = null; state.stroke = null; state.verdict = null;
  };
  function scrollFlow(ptr) {
    const d = state.ui.drag;
    const mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) {
      const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top));
      state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max);
    }
  }
  function modalInput(ptr, key, handler, onArt) {
    ensureLayout(state, key);
    if (ptr.pressed) {
      state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0, art: false };
      if (onArt) { const r = artRect('spinArt', state.ui.scroll); if (r && inRect(r, ptr.x, ptr.y)) { state.ui.drag.art = true; } }
    }
    if (state.ui.drag && state.ui.drag.art) {
      if (ptr.down || ptr.released) onArt(ptr.x, ptr.y);
      if (ptr.released || !ptr.down) state.ui.drag = null;
      return;
    }
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      if (d.moved < 10 && flowMeta().key === key) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
    }
  }
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    const st = state.settings;
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; }
    else if (id === 'p-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); save(); }
    else if (id === 'p-guide') { st.guide = (st.guide + 1) % 3; save(); guideKey = ''; }
    else if (id === 'p-assist') { st.assist = st.assist ? 0 : 1; save(); }
    else if (id === 'p-txtdec') { st.textIdx = Math.max(0, st.textIdx - 1); save(); }
    else if (id === 'p-txtinc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); save(); }
    else if (id === 'p-concede') concede();
    else if (id === 'quit') leaveMatch();
  }
  function concede() {
    if (!state.f || state.f.over || state.lesson || mode() === 'watch' || state.ctl === 'verdict') return;
    const f = state.f, loser = mode() === 'two' ? f.turn : 0;
    f.over = { win: other(loser), why: 'Frame conceded' };
    closePause();
    endFrame();
  }
  function handleSpinTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'spin-centre') { state.aim.a = 0; state.aim.b = 0; guideKey = ''; }
    else if (id === 'spin-done') state.spinOpts = false;
  }
  function setSpinFrom(cx, cy, r, px, py) {
    let a = (px - cx) / (r * 0.86), b = -(py - cy) / (r * 0.86);
    const l = Math.hypot(a, b);
    if (l > 1) { a /= l; b /= l; }
    if (Math.abs(a) < 0.07) a = 0;
    if (Math.abs(b) < 0.07) b = 0;
    state.aim.a = a; state.aim.b = b;
  }
  function lessonInput(ptr) {
    modalInput(ptr, 'lessonres', (id) => {
      if (!id) return;
      sfx.tick();
      if (id === 'les-next') nextLesson();
      else if (id === 'les-again') resetLesson();
      else if (id === 'les-show') { resetLesson(); showModel(); }
      else if (id === 'les-list') leaveMatch();
    });
  }

  function updatePlay(dt, input) {
    const { m } = state;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch';
    const lay = layoutFor(state);
    const cam = camFor(state);
    if (config.dev && keys.pressed.has('KeyK') && !state.lesson && state.f && !state.f.over) { state.f.scores[0] = 40; state.f.scores[1] = 12; state.f.over = { win: 0, why: 'Dev shortcut' }; endFrame(); return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) {
      if (state.pauseMenu) closePause(); else if (state.spinOpts) state.spinOpts = false; else if (state.reasonOpen) state.reasonOpen = false;
      else if (!watch) openPause(); else state.paused = !state.paused;
    }
    if (state.pauseMenu) { modalInput(ptr, 'pause', handlePauseTap); return; }
    if (state.spinOpts) { modalInput(ptr, 'spin', handleSpinTap, (x, y) => { const r = artRect('spinArt', state.ui.scroll); if (r) setSpinFrom(r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) / 2 - 6, x, y); }); return; }
    if (state.reasonOpen) { modalInput(ptr, 'reason', (id) => { if (id === 'reason-close') state.reasonOpen = false; }); return; }
    if (state.phaseKind === 'lessonres') { lessonInput(ptr); stepFx(dt); return; }
    const c = lay.ctrl;
    if (watch) {
      if (ptr.pressed) {
        if (inRect(c.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(c.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(c.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(c.exit, ptr.x, ptr.y)) { leaveMatch(); return; }
        else if (state.card && inRect(cardRect(state, lay), ptr.x, ptr.y)) { state.reasonOpen = true; state.ui.scroll = 0; return; }
      }
    } else if (state.ctl === 'aim') {
      humanAimInput(ptr, keys, lay, cam);
    } else if (state.ctl === 'roll') {
      if (ptr.pressed && inRect(c.pause, ptr.x, ptr.y)) { openPause(); sfx.tick(); }
    } else if (state.ctl === 'verdict') {
      const v = state.verdict;
      if (v && ptr.pressed && ptr.y >= verdictScroll.top && ptr.y <= verdictScroll.bottom && inRect(c.box, ptr.x, ptr.y)) state.vdrag = { y0: ptr.y, s0: v.scroll ?? 0 };
      if (v && state.vdrag && ptr.down) v.scroll = clamp(state.vdrag.s0 - (ptr.y - state.vdrag.y0), 0, verdictScroll.max);
      if (!ptr.down) state.vdrag = null;
      if (v && ptr.pressed) {
        const n = v.buttons.length;
        const rects = n === 1 ? [c.go] : n === 2 ? [c.half1, c.half2] : [c.go2, c.go];
        v.buttons.forEach((b, i) => { if (inRect(rects[i], ptr.x, ptr.y)) verdictTap(b.id); });
      }
      if (v && state.verdict === v && (keys.pressed.has('Enter') || keys.pressed.has('Space'))) verdictTap(v.buttons[v.buttons.length - 1].id);
    }
    if (watch && state.ctl === 'verdict' && state.verdict && !state.paused) {
      state.verdictT -= dt;
      if (state.verdictT <= 0) verdictTap(state.verdict.buttons[state.verdict.buttons.length - 1].id);
    }
    if (state.paused) return;
    stepFx(dt);
    updateHint();
    if (state.ctl === 'aim') updateAI(dt);
    if (state.ctl === 'roll') updateRoll(dt, input);
    if (state.ctl === 'aim' && (state.humanTurn || (state.think && state.think.phase === 'reveal'))) updateGuide();
  }

  // The human's aim: drag on the table to aim, drag in the magnifier for fine aim, drag on the spin circle, pull the cue back to shoot.
  function humanAimInput(ptr, keys, lay, cam) {
    const c = lay.ctrl;
    const mineTurn = state.humanTurn && !state.paused;
    if (ptr.pressed) {
      if (inRect(c.menu, ptr.x, ptr.y)) { openPause(); sfx.tick(); return; }
      if (state.card && inRect(cardRect(state, lay), ptr.x, ptr.y)) { state.reasonOpen = true; state.ui.scroll = 0; return; }
      if (mineTurn) {
        if (inRect(c.think, ptr.x, ptr.y)) { requestHint(); sfx.tick(); }
        else if (c.guide && inRect(c.guide, ptr.x, ptr.y)) { state.settings.guide = (state.settings.guide + 1) % 3; sfx.tick(); save(); guideKey = ''; }
        else if (c.shot && inRect(c.shot, ptr.x, ptr.y)) { state.spinOpts = true; state.ui.scroll = 0; sfx.tick(); return; }
        else if (c.spin && inRect(c.spin, ptr.x, ptr.y)) state.drag = { kind: 'spin' };
        else if (inRect(c.power, ptr.x, ptr.y)) { if (cue().on) { state.drag = { kind: 'pull', x0: ptr.x, last: 0 }; state.aim.pulling = true; state.aim.pull = 0; } }
        else if (inRect(c.inset, ptr.x, ptr.y)) state.drag = { kind: 'fine', x0: ptr.x, a0: state.aim.angle };
        else if (inRect(lay.region, ptr.x, ptr.y)) {
          const cb = cue();
          if (state.f.inHand && cb.on) {
            const [sx, sy] = cam.px(cb.x, cb.y, R);
            state.drag = { kind: Math.hypot(ptr.x - sx, ptr.y - sy) < 56 ? 'cue' : 'aim' };
          } else state.drag = { kind: 'aim' };
        }
      }
    }
    const d = state.drag;
    if (d && mineTurn && state.ctl === 'aim') {
      if (d.kind === 'aim' && ptr.down) {
        const cb = cue();
        const q = aimToTable(cam, ptr.x, ptr.y);
        if (Math.hypot(q.x - cb.x, q.y - cb.y) > 0.06) setAngle(Math.atan2(q.y - cb.y, q.x - cb.x));
      } else if (d.kind === 'fine' && ptr.down) {
        setAngle(d.a0 - (ptr.x - d.x0) * 0.00045);
      } else if (d.kind === 'spin' && ptr.down) {
        const S = c.spin; setSpinFrom(S.x + S.w / 2, S.y + S.h / 2, S.w / 2 - 4, ptr.x, ptr.y);
      } else if (d.kind === 'cue' && ptr.down) {
        const q = cam.unproj(ptr.x, ptr.y - 26);
        const p = nearestInD(state.w, q.x, q.y);
        const cb = cue(); cb.x = p.x; cb.y = p.y; cb.ox = p.x; cb.oy = p.y;
      } else if (d.kind === 'pull') {
        if (ptr.down) {
          const T = c.pullT;
          let want = clamp((d.x0 - ptr.x) / T, 0, 1);
          want = clamp(want, d.last - 0.35, d.last + 0.35);       // a stray second finger cannot make the cue jump
          d.last = want; state.aim.pull = want;
        }
        if (ptr.released) {
          const p = state.aim.pull; state.drag = null; state.aim.pulling = false;
          if (p > 0.04) humanShoot(p); else state.aim.pull = 0;
          return;
        }
      }
      if (!ptr.down && d.kind !== 'pull') state.drag = null;
      if (!ptr.down && d.kind === 'pull' && !ptr.released) { state.drag = null; state.aim.pulling = false; state.aim.pull = 0; }
    } else if (d) { state.drag = null; state.aim.pulling = false; }
    // keyboard (web demo)
    if (mineTurn && state.ctl === 'aim') {
      const a = state.aim, fine = keys.down.has('ShiftLeft') || keys.down.has('ShiftRight');
      const k = fine ? 0.0004 : 0.004;
      if (keys.down.has('ArrowLeft')) setAngle(a.angle + k);
      if (keys.down.has('ArrowRight')) setAngle(a.angle - k);
      if (keys.down.has('ArrowUp')) state.kpow = clamp(state.kpow + 0.008, 0.04, 1);
      if (keys.down.has('ArrowDown')) state.kpow = clamp(state.kpow - 0.008, 0.04, 1);
      if (keys.pressed.has('KeyW')) a.b = clamp(a.b + 0.25, -1, 1);
      if (keys.pressed.has('KeyS')) a.b = clamp(a.b - 0.25, -1, 1);
      if (keys.pressed.has('KeyE')) a.a = clamp(a.a + 0.25, -1, 1);
      if (keys.pressed.has('KeyQ')) a.a = clamp(a.a - 0.25, -1, 1);
      if (keys.pressed.has('KeyC')) { a.a = 0; a.b = 0; }
      if (keys.pressed.has('KeyH')) requestHint();
      if (keys.pressed.has('KeyG')) { state.settings.guide = (state.settings.guide + 1) % 3; guideKey = ''; save(); }
      if (keys.pressed.has('Space') || keys.pressed.has('Enter')) humanShoot(state.kpow);
    }
  }

  function stepFx(dt) {
    for (const q of state.w ? state.w.b : []) {
      if (!q.on) q.pt += dt;
      if (q.respotted && q.rt !== undefined && q.rt < 1) q.rt += dt;
    }
    stepParts(dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
  }

  // ---- menus ------------------------------------------------------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { pressLockup(); env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'resume') resumeMatch();
    else if (id === 'play') { state.setup.mode = 'ai'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'two') { state.setup.mode = 'two'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'learn') { state.scene = 'learn'; state.ui.scroll = 0; }
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That opponent is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id.startsWith('fmt-')) { const fm = id.slice(4); if (state.demo && fm === 'full') { state.setupMsg = 'The 15-red frame is in the full game.'; return; } s.format = fm; state.setupMsg = ''; }
    else if (id.startsWith('best')) { const n = Number(id.slice(4)); if (state.demo && n > 1) { state.setupMsg = 'Longer matches are in the full game.'; return; } s.best = n; state.setupMsg = ''; }
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, format: s.format, best: s.best });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-guide') st.guide = (st.guide + 1) % 3;
    else if (id === 'set-assist') st.assist = st.assist ? 0 : 1;
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
  const handleLearn = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
    else if (id.startsWith('les-')) startLesson(id.slice(4));
  };
  const handleQuiz = (id) => {
    if (!id) return;
    const q = state.quiz;
    sfx.tick();
    if (id === 'back') { state.scene = 'learn'; state.ui.scroll = 0; }
    else if (id === 'quiz-next') nextLesson();
    else if (/^q\d$/.test(id) && q.chosen === null) {
      q.chosen = Number(id.slice(1));
      if (q.chosen === q.correct) { state.learn.done[q.def.id] = true; save(); sfx.win(); } else sfx.no();
    }
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.m.cfg;
    if (id === 'again') startMatch({ ...cfg, seed: undefined, breaker0: other(cfg.breaker0 ?? 0) });
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
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) { handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };
  // Reference pages scroll like any long page: drag, mouse wheel, arrow / page keys, and the Next button (a screenful at a time); the left button is always Close.
  let pageDrag = null, wheelAcc = 0;
  try { globalThis.addEventListener('wheel', (e) => { if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') wheelAcc += e.deltaY; }, { passive: true }); } catch { /* no window */ }
  Object.defineProperty(state, 'pageDragging', { get: () => !!pageDrag, enumerable: false });
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys, dm = docMeta();
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.page = 0; };
    const go = (d) => { state.page = clamp(state.page + d, 0, dm.max); };
    const screenful = () => Math.round(dm.view * 0.85);
    if (ptr.pressed) {
      if (inRect(REF_NEXT, ptr.x, ptr.y)) { if (state.page >= dm.max - 4) close(); else go(screenful()); pageDrag = null; }
      else if (inRect(REF_BACK, ptr.x, ptr.y)) { close(); pageDrag = null; }   // always leaves the reader; scrolling up is drag / wheel / keys
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
      else pageDrag = { y0: ptr.y, s0: state.page };
    }
    if (pageDrag && ptr.down) state.page = clamp(pageDrag.s0 - (ptr.y - pageDrag.y0), 0, dm.max);
    if (!ptr.down) pageDrag = null;
    if (wheelAcc) { go(wheelAcc); wheelAcc = 0; }
    if (keys.down.has('ArrowDown')) go(14);
    if (keys.down.has('ArrowUp')) go(-14);
    if (keys.pressed.has('PageDown') || keys.pressed.has('ArrowRight')) go(screenful());
    if (keys.pressed.has('PageUp') || keys.pressed.has('ArrowLeft')) go(-screenful());
    if (keys.pressed.has('Home')) state.page = 0;
    if (keys.pressed.has('End')) state.page = dm.max;
    if (keys.pressed.has('Escape')) close();
  };

  // ---- showcase (store screenshots: ?shot=1 plays a scripted, real position instead of the random player) ---------------------------------------------------------------------
  function setupShowcase(kind) {
    state.shotMode = { kind, tick: 0 };
    const cfg = { mode: 'ai', opp: 3, format: 'full', best: 3, seed: 4242 + kind, breaker0: kind % 2 };
    state.lesson = null;
    state.m = { cfg: { watchA: 3, ...cfg }, frames: [1, 0], frameNo: 2, results: [], over: null };
    state.w = rackWorld(15); state.f = newFrame({ format: 'full', breaker: 0, names: ['You', 'Expert'] });
    setNames();
    state.scene = 'play';
    const w = state.w, f = state.f;
    f.inHand = false;
    if (kind === 5) { f.inHand = true; cue().on = false; beginTurn(); return; }
    // a mid-frame position: some reds gone, a break in progress
    for (const id of [1, 2, 3, 4, 5, 6, 7]) ballById(w, id).on = false;
    const place = (id, x, y) => { const q = ballById(w, id); q.x = x; q.y = y; q.ox = x; q.oy = y; };
    place(8, 0.85, 3.0); place(9, 1.1, 2.55); place(10, 0.55, 2.2); place(11, 1.3, 1.95); place(12, 0.45, 2.95); place(13, 1.5, 3.05); place(14, 0.95, 1.45); place(15, 1.25, 2.9);
    place(0, 1.05, 0.95);
    f.scores = [31, 14]; f.on = 'red'; f.visit = 14; f.turn = 0; f.redsLeft = 8; f.shots = 12; f.high = [31, 22];
    beginTurn();
    state.aim.a = 0; state.aim.b = 0;
    const r15 = ballById(w, 15), c0 = cue();
    state.aim.angle = Math.atan2(r15.y - c0.y, r15.x - c0.x);
    updateGuide(true);
  }
  function showcaseStep() {
    const sm = state.shotMode, k = sm.kind;
    sm.tick++;
    const a = state.aim;
    if (k === 0) {
      if (sm.tick === 3) { const pl = createPlanner(state.f, state.w, PROFILES[4], aiRng, { perfect: true }); pl.runAll(); applyAdvice(pl.result); state.humanTurn = true; }
    } else if (k === 1) {
      if (sm.tick === 2) { const pl = createPlanner(state.f, state.w, PROFILES[4], aiRng, { perfect: true }); pl.runAll(); const s = pl.result.shot; state.humanTurn = true; takeShot(0, s, true); state.stroke.dur = 0.05; }
    } else if (k === 2) {
      if (sm.tick === 2) { a.b = 0.55; a.a = 0.2; a.pulling = true; a.pull = 0.55; state.humanTurn = true; updateGuide(true); }
    } else if (k === 3) {
      if (sm.tick === 2) { state.settings.guide = 2; guideKey = ''; a.pulling = true; a.pull = 0.42; state.humanTurn = true; updateGuide(true); }
    } else if (k === 4) {
      if (sm.tick === 2) { startLesson('cut'); state.aim.pulling = false; showModel(); }
    } else if (k === 5) {
      if (sm.tick === 2) { placeCue(state.w, MID_X - 0.17, 0.5); state.f.inHand = true; const r1 = ballById(state.w, 15); state.aim.angle = Math.atan2(r1.y - 0.5, r1.x - (MID_X - 0.17)); state.humanTurn = true; state.phaseKind = 'place'; updateGuide(true); }
    }
  }

  // wall-clock drawing helpers stay out of the enumerable state (hashes and saves never see them)
  for (const k of ['alpha', 'updAt', 'cam', 'replayed', 'stepped', 'shotT0', 'lastRes', 'resumeAim', 'vdrag']) Object.defineProperty(state, k, { value: undefined, writable: true, enumerable: false });
  startAttract();
  resetMenus();
  let ivl = 1000 / 60;
  if (SHOT_MODE) {
    setupShowcase((Number(config.seed) | 0) % 6);
    // review aid: ?view=title|setup|settings|learn|quiz|result|rules|about|howto|pause|spin|verdict|watch|lesson and ?zoom=0..4
    const q = (k) => { try { const m = new RegExp(`[?&]${k}=([a-z0-9]+)`).exec(globalThis.location.search); return m ? m[1] : null; } catch { return null; } };
    if (q('zoom')) state.settings.textIdx = clamp(Number(q('zoom')) | 0, 0, 4);
    const v = q('view');
    if (v) {
      state.shotMode = v === 'pause' || v === 'spin' || v === 'verdict' ? state.shotMode : null;
      if (v === 'pause') openPause();
      else if (v === 'spin') state.spinOpts = true;
      else if (v === 'verdict') { state.verdict = { title: 'Foul: 4 to Expert', tone: 'bad', lines: ['The wrong ball was hit first.', 'Expert places the white in the D.'], buttons: [{ id: 'cont', label: 'Continue', primary: true }] }; state.ctl = 'verdict'; state.shotMode = null; }
      else if (v === 'result') { state.m.frames = [2, 1]; state.m.over = { win: 0 }; state.m.results = [{ scores: [64, 31], win: 0, high: [35, 12] }, { scores: [22, 51], win: 1, high: [14, 28] }, { scores: [58, 40], win: 0, high: [22, 18] }]; state.scene = 'result'; }
      else if (v === 'quiz') startLesson('fouls');
      else if (v === 'rules' || v === 'about' || v === 'howto') { state.scene = v; state.back = 'title'; state.page = (Number(q('page')) | 0) * 300; }
      else if (v === 'watch') { startWatch(); state.shotMode = null; }
      else if (v === 'lesson') { startLesson(q('id') ?? 'pot'); state.shotMode = null; }
      else state.scene = v;
    }
  }

  return {
    // Watch & Learn, lessons and every menu are free; only real play counts against the free preview (a paused game does not).
    // Only live action counts: balls rolling, the computer taking its turn. Menus, Rules, Learn, Watch & Learn, pause, results, and the
    // player's own aiming / verdict screens (nothing is moving) are free.
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch' && state.m.cfg.mode !== 'lesson') || state.paused
      || state.pauseMenu || state.spinOpts || state.reasonOpen || state.ctl === 'verdict' || (state.ctl === 'aim' && !!state.humanTurn && !state.stroke),
    update(dt, inputIn) {
      const input = SHOT_MODE ? BLANK : inputIn;      // store screenshots never use the random player
      state.stepped = false;
      const t = nowMs();
      if (state.updAt !== undefined && t > state.updAt) ivl = clamp(ivl * 0.9 + (t - state.updAt) * 0.1, 8, 34);
      state.updAt = t;
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.shotMode) {
        showcaseStep();
        if (state.scene === 'play') updatePlay(dt, BLANK);
        return;
      }
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'learn': updateFlowScene(dt, input, handleLearn, 'learn'); break;
        case 'quiz': updateFlowScene(dt, input, handleQuiz, 'quiz'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      state.alpha = state.stepped && env.clock && state.updAt !== undefined ? Math.max(0, Math.min(1, (nowMs() - state.updAt) / ivl)) : 1;
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'learn': renderLearn(ctx, state); break;
        case 'quiz': renderQuiz(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.m) renderPlay(ctx, state);
          if (state.pauseMenu) renderPause(ctx, state);
          else if (state.spinOpts) renderSpin(ctx, state);
          else if (state.reasonOpen) renderReason(ctx, state);
          else if (state.phaseKind === 'lessonres') renderLessonResult(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
  };
}
