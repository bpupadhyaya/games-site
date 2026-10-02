// Stone and Sweep: state and flow. Physics lives in sim.js, rules in match.js, drawing in view.js and menus.js, the
// computer players in ai.js, hints in explain.js, lessons in lessons.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, learn, quiz, play (also Watch & Learn and lessons), result, howto/about/rules, demolimit.
// A throw: drag on the ice to put the broom where the stone should stop, choose the weight and the turn, press Throw.
// Then rub the ice to sweep. Time is compressed while the stone slides; everything advances in fixed steps.
import {
  H as STEP, HOG_FAR, BACK, createWorld, addStone, launch, stepWorld, cloneWorld, predictStone, settleWorld, solveShot, clamp,
} from './sim.js';
import {
  FORMATS, WEIGHTS, newMatch, beginEnd, afterShot, scoreCurrentEnd, applyEnd, resolveShot, protectedIds, snapshotStones, shotParams, other,
} from './match.js';
import { PROFILES, createPlanner, sweepDecision } from './ai.js';
import { throwNoise, applyNoise, HUMAN } from './noise.js';
import { explainShot, situation } from './explain.js';
import { LESSONS, lessonById, lessonIndex } from './lessons.js';
import { W, H, inRect, REF_BACK, REF_NEXT, TEXT_DEC, TEXT_INC, TEXT_SCALES, THINK_STEPS, SETUP_PINS } from './layout.js';
import { renderPlay, layoutFor, makeCam, camToWorld, cardRect, lengthShape } from './view.js';
import {
  renderTitle, renderSetup, renderSettings, renderLearn, renderQuiz, renderResult, renderPause, renderShotOptions, renderReason, renderLessonResult, renderPages, renderDemoLimit,
  hitScreen, flowMeta, pageCount, ensureLayout, resetMenus,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export const meta = { width: W, height: H };
const DEMO_END_CAP = 2;
const SHOT_MODE = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();

const PACE = 2.6;   // sim steps per update at the house (grows smoothly towards the far end, see lengthShape)
export function createGame(env) {
  const nowMs = () => (env.clock ? env.clock() : 0);   // display clock from the shell; absent in headless runs (alpha stays 1)
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, shotOpts: false, reasonOpen: false, demo: !!config.demo,
    settings: { sound: true, textIdx: 0, thinkIdx: 1, guide: 0, easy: false, left: false },
    record: { wins: [0, 0, 0, 0, 0], played: 0, streak: 0, best: 0, demoEnds: 0, throws: 0 },
    learn: { done: {} },
    setup: { mode: 'ai', opp: 0, format: 'short', ends: 4 }, setupMsg: '',
    ui: { scroll: 0, drag: null }, page: 0,
    att: null, w: null, m: null, names: ['You', 'Louise'], cam: {}, ctl: 'aim',
    aim: { x: 0, y: 0, w: 0, turn: 1, placed: false }, pv: null, finalPreview: null, weightsOk: [true, true, true, true],
    humanTurn: false, fl: null, trail: [], parts: [], pops: [], toast: '', toastT: 0, card: null, hl: null,
    think: null, hintBusy: false, wlabel: '', restT: 0, saved: null, quiz: null, lesson: null, lessonRes: null, loaded: false, restoreMsg: '', ff: false, pre: null,
    drag: null, sweepIn: { px: 0, py: 0, sp: 0, on: false }, humanSweeps: false, shotMode: null, assist: false, resumeAim: null, lastNotes: [],
  };
  let planner = null, hintPlanner = null, previewKey = '';

  // ---- persistence ------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); storage.set('learn', state.learn); };
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('learn', null), storage.get('match', null)]).then(([s, r, l, mt]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    if (l && l.done && typeof l.done === 'object') state.learn = { done: { ...l.done } };
    if (!state.saved) state.saved = validSnapshot(mt);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    state.settings.guide = clamp(state.settings.guide | 0, 0, 2);
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 5) state.record.wins = [0, 0, 0, 0, 0];
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // A match is written down at every safe point (a throw is about to start, so every stone is at rest) and offered as
  // Continue on the menu. Watch & Learn and lessons are never saved.
  const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  function validSnapshot(sn) {
    try {
      if (!sn || sn.v !== 1 || !sn.cfg || !(sn.cfg.mode === 'ai' || sn.cfg.mode === 'two')) return null;
      const c = sn.cfg;
      if (!num(c.opp, 0, PROFILES.length - 1) || !num(c.ends, 1, 99) || !FORMATS[c.format] || !num(c.seed, 0, 4294967295) || !num(c.hammer0, 0, 1)) return null;
      const per = FORMATS[c.format].perSide;
      if (!num(sn.end, 1, 99) || !num(sn.ends, sn.end, 99) || !num(sn.turn, 0, 1) || !num(sn.shot, 0, 99) || !num(sn.hammer, 0, 1)) return null;
      if (!Array.isArray(sn.scores) || sn.scores.length !== 2 || !sn.scores.every((v) => num(v, 0, 9999))) return null;
      if (!Array.isArray(sn.thrown) || sn.thrown.length !== 2 || !sn.thrown.every((v) => num(v, 0, per)) || sn.thrown[sn.turn] >= per) return null;
      if (!Array.isArray(sn.log) || sn.log.length > 99 || !sn.log.every((r) => r && num(r.end, 1, 99) && (r.team === null || r.team === 0 || r.team === 1) && num(r.pts, 0, 99) && num(r.hammer, 0, 1))) return null;
      if (!Array.isArray(sn.stones) || sn.stones.length > 24 || !num(sn.nextId, 1, 99999)) return null;
      if (!sn.stones.every((d) => d && num(d.id, 1, 99999) && (d.team === 0 || d.team === 1) && num(d.x, -4, 4) && num(d.y, -40, 4) && num(d.ang, -1e6, 1e6) && num(d.fr, 0.5, 1.5) && num(d.cv, 0.3, 2))) return null;
      if (!sn.aim || !num(sn.aim.x, -4, 4) || !num(sn.aim.y, -10, 4) || !num(sn.aim.w, 0, 3) || !(sn.aim.turn === 1 || sn.aim.turn === -1)) return null;
      return sn;
    } catch { return null; }
  }
  const snapshot = () => {
    const { m, w } = state;
    return {
      v: 1, cfg: { mode: m.cfg.mode, opp: m.cfg.opp, format: m.cfg.format, ends: m.cfg.ends, seed: m.cfg.seed, hammer0: m.cfg.hammer0 },
      end: m.end, ends: m.ends, scores: m.scores.slice(), hammer: m.hammer, thrown: m.thrown.slice(), shot: m.shot, turn: m.turn,
      log: m.log.map((r) => ({ end: r.end, team: r.team, pts: r.pts, hammer: r.hammer, steal: !!r.steal })), nextId: w.nextId,
      stones: w.stones.filter((s) => s.mode === 'play').map((s) => ({ id: s.id, team: s.team, x: s.x, y: s.y, ang: s.ang, fr: s.fr, cv: s.cv })),
      aim: { x: state.aim.x, y: state.aim.y, w: state.aim.w, turn: state.aim.turn },
    };
  };
  const persistMatch = () => { if (state.m && (state.m.cfg.mode === 'ai' || state.m.cfg.mode === 'two') && !state.m.over) { state.saved = snapshot(); storage.set('match', state.saved); } };
  const clearSaved = () => { if (state.saved) { state.saved = null; storage.set('match', null); } };

  // ---- sound ------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    release: () => { tone({ freq: 180, to: 90, dur: 0.25, type: 'sine', vol: 0.06 }); tone({ freq: 900, to: 300, dur: 0.12, type: 'sawtooth', vol: 0.012 }); },
    clack: (v) => {
      const q = Math.min(1, v / 3);
      tone({ freq: 240 + fx.next() * 60, to: 120, dur: 0.1, type: 'triangle', vol: 0.06 + 0.12 * q });
      tone({ freq: 1500 + fx.next() * 400, to: 700, dur: 0.04, type: 'square', vol: 0.02 + 0.04 * q });
    },
    scrub: (e) => tone({ freq: 2400 + fx.next() * 1200, to: 1800, dur: 0.05, type: 'sawtooth', vol: 0.006 + 0.014 * e }),
    slide: (sp) => tone({ freq: 62 + sp * 14, dur: 0.12, type: 'sine', vol: 0.014 }),
    out: () => tone({ freq: 200, to: 90, dur: 0.22, type: 'sawtooth', vol: 0.06 }),
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 220, to: 140, dur: 0.2, type: 'sawtooth', vol: 0.06 }),
    place: () => tone({ freq: 660, dur: 0.07, type: 'triangle', vol: 0.05 }),
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.19, i), dur: 0.22, type: 'sine', vol: 0.09 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };

  // ---- particles ----------------------------------------------------------------------------------------------
  const MAX_PARTS = 140;
  const addPart = (parts, q) => { if (parts.length < MAX_PARTS) parts.push(q); };
  const chips = (parts, x, y, n, speed = 1) => {
    for (let i = 0; i < n; i++) { const a = fx.next() * Math.PI * 2, s = (0.4 + fx.next() * 1.4) * speed; addPart(parts, { kind: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.4 + fx.next() * 0.4, size: 1.4 + fx.next() * 2, col: fx.next() < 0.5 ? '#ffffff' : '#bfe3ff' }); }
  };
  const ring = (parts, x, y, size, col) => addPart(parts, { kind: 2, x, y, vx: 0, vy: 0, t: 0, max: 0.4, size, col });
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.95; q.vy *= 0.95; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };
  const pop = (x, y, text, col, size = 26) => { state.pops.push({ x, y, text, col, size, t: 0, max: 1.4 }); if (state.pops.length > 10) state.pops.shift(); };

  const worldEvents = (w, parts, ev, live) => {
    for (const e of ev) {
      if (e.k === 'hit') {
        chips(parts, e.x, e.y, Math.min(12, 3 + Math.floor(e.v * 3)), 1.2);
        ring(parts, e.x, e.y, 26 + e.v * 12, '#ffffff');
        for (const s of w.stones) if (s.id === e.a || s.id === e.b) s.heat = Math.min(1, e.v / 2.5);
        if (live) { sfx.clack(e.v); }
      } else if (e.k === 'out') {
        chips(parts, e.x, e.y, 8, 1.4);
        if (live) { sfx.out(); pop(clamp(e.x, -2, 2), Math.min(e.y, BACK + 0.2), e.why === 'back' ? 'Out the back' : 'Out', '#ffb48a', 26); }
      }
    }
  };

  // ---- the attract ice behind the menus -----------------------------------------------------------------------
  const startAttract = () => {
    const w = createWorld();
    for (const [t, x, y] of [[0, 0.55, -0.4], [1, -0.3, 0.2], [0, -0.9, -0.9], [1, 0.4, 0.9]]) addStone(w, t, x, y);
    state.att = { w, parts: [], wait: 1.6, n: 0, trail: [], fl: null, acc: 0, eff: 0, cmd: 0, phase: 0, tick: 0, id: 0, team: 0, pl: { x: 0, y: 0 } };
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    for (const s of a.w.stones) { if (s.heat > 0) s.heat = Math.max(0, s.heat - dt * 2.2); if (s.mode === 'out') s.out += dt; }
    if (a.w.settled) {
      a.wait -= dt;
      if (a.wait <= 0) {
        a.w.stones = a.w.stones.filter((s) => s.mode === 'play');
        if (a.w.stones.length > 7) a.w.stones.splice(0, 3);
        a.wait = 2.2; a.trail = [];
        const team = a.n++ % 2, tx = (fx.next() - 0.5) * 2.2, ty = -0.8 + fx.next() * 1.8, turn = fx.next() < 0.5 ? 1 : -1;
        const hit = fx.next() < 0.3 && a.w.stones.length > 0;
        const tg = hit ? a.w.stones[fx.int(a.w.stones.length)] : null;
        const sol = hit ? solveShot(tg.x, tg.y, 1.8, turn) : solveShot(tx, ty, 0, turn);
        if (sol.ok) { const s = launch(a.w, team, { v0: sol.v0, theta: sol.theta, turn }); a.id = s.id; a.team = team; a.pl = hit ? { x: tg.x, y: tg.y } : { x: tx, y: ty }; a.eff = 0; a.cmd = 0; }
      }
    } else {
      const s = a.w.stones.find((q) => q.id === a.id);
      a.acc += s && s.y < -10 ? 7 : 3;
      let n = Math.floor(a.acc); a.acc -= n;
      const ev = [];
      while (n-- > 0 && !a.w.settled) {
        a.tick++;
        if (s && s.mode === 'play' && (s.vx || s.vy) && s.y > -14 && a.tick % 20 === 0) a.cmd = sweepDecision(a.w, a.id, a.pl, PROFILES[3], fx);
        a.eff += clamp(a.cmd - a.eff, -0.01, 0.01);
        stepWorld(a.w, { team: a.team, eff: s && s.y > -14 ? a.eff : 0 }, ev);
        if (s && s.mode === 'play' && a.tick % 4 === 0) a.trail.push([s.x, s.y, s.y > -14 ? a.eff : 0]);
      }
      if (ev.length) worldEvents(a.w, a.parts, ev, false);
      a.phase += dt * (3 + a.eff * 18);
      a.fl = s && s.mode === 'play' && (s.vx || s.vy) && s.y > -4.5 ? { x: s.x, y: s.y, eff: a.eff, phase: a.phase, team: a.team } : null;
      if (a.w.settled) a.fl = null;
    }
    stepParts(a.parts, dt);
  };

  // ---- names, modes -------------------------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const isAI = (t) => mode() === 'watch' || (mode() === 'ai' && t === 1);
  const profOf = (t) => (mode() === 'watch' ? PROFILES[t === 0 ? state.m.cfg.watchA : state.m.cfg.opp] : PROFILES[state.m.cfg.opp]);
  const setNames = () => {
    const c = state.m.cfg;
    state.names = c.mode === 'two' ? ['Red', 'Yellow'] : c.mode === 'watch' ? [PROFILES[c.watchA].name, PROFILES[c.opp].name] : c.mode === 'lesson' ? ['You', 'Yellow'] : ['You', PROFILES[c.opp].name];
  };
  const hand = () => (state.settings.left ? -1 : 1);
  const turnSign = (aimTurn) => aimTurn * hand();
  const namesFor = (team) => ({ me: state.names[team], foe: state.names[other(team)] });

  // ---- the aim -----------------------------------------------------------------------------------------------------
  const defaultAim = () => ({ x: 0, y: 0, w: 0, turn: 1, placed: false });
  const clampTarget = (x, y) => ({ x: clamp(x, -1.9, 1.9), y: clamp(y, HOG_FAR + 0.15, 1.7) });
  const allowedWeights = () => (state.lesson ? state.lesson.def.weights : [0, 1, 2, 3]);
  function updatePreview(force = false) {
    const { m, w, aim } = state;
    const key = `${m.turn}|${aim.x.toFixed(3)}|${aim.y.toFixed(3)}|${aim.w}|${aim.turn}|${aim.placed}|${state.settings.left}|${state.settings.guide}|${w.stones.length}`;
    if (!force && key === previewKey) return;
    previewKey = key;
    const allow = allowedWeights();
    for (let i = 0; i < 4; i++) state.weightsOk[i] = allow.includes(i) && solveShot(aim.x, aim.y, WEIGHTS[i].arrival, turnSign(aim.turn)).ok;
    state.pv = null; state.finalPreview = null;
    if (!aim.placed || state.settings.guide === 2) return;
    const p = shotParams({ x: aim.x, y: aim.y, w: aim.w, turn: turnSign(aim.turn) });
    if (!p.ok) return;
    const w2 = cloneWorld(w);
    const s = launch(w2, m.turn, { v0: p.v0, theta: p.theta, turn: p.turn });
    const pr = predictStone(w2, s.id, 0, { path: true });
    if (!pr) return;
    state.pv = { path: pr.path, end: { x: pr.x, y: pr.y, kind: pr.kind }, v0: p.v0 };
    if (state.settings.guide === 1) {
      const w3 = cloneWorld(w);
      launch(w3, m.turn, { v0: p.v0, theta: p.theta, turn: p.turn });
      settleWorld(w3, null);
      state.finalPreview = w3.stones.filter((q) => q.mode === 'play' && (q.id === w3.thrown || !w.stones.some((o) => o.id === q.id && Math.hypot(o.x - q.x, o.y - q.y) < 0.02))).map((q) => ({ x: q.x, y: q.y, team: q.team }));
    }
  }
  const setAim = (patch) => { Object.assign(state.aim, patch); if (state.card && state.card.sticky) state.card = null; };

  // ---- turns ---------------------------------------------------------------------------------------------------------
  function beginTurn(resumed = false) {
    const m = state.m, team = m.turn;
    m.phase = 'aim'; state.ctl = 'aim';
    state.w.stones = state.w.stones.filter((s) => s.mode === 'play');
    state.humanTurn = !isAI(team);
    state.fl = null; state.trail = []; state.pv = null; state.finalPreview = null; state.hl = null; state.think = null; state.hintBusy = false; state.drag = null; state.card = null; state.assist = false;
    planner = null; hintPlanner = null; previewKey = '';
    const prev = state.aim;
    state.aim = state.lesson ? defaultAim() : { ...defaultAim(), w: 0, turn: prev.turn || 1 };
    if (resumed && state.resumeAim) { state.aim = { ...state.resumeAim, placed: false }; state.resumeAim = null; }
    updatePreview(true);
    if (resumed) toast('Match restored. Press Resume to carry on', 3.2);
    else if (state.humanTurn) {
      if (state.lesson) toast(state.lesson.def.how, 6);
      else toast(mode() === 'two' ? `${state.names[team]}: your stone. Drag on the ice to set the broom` : `Your stone${m.hammer === team ? ' (last stone)' : ''}: drag on the ice to set the broom`, 3.2);
    } else if (mode() !== 'watch') toast(`${state.names[team]} is thinking…`, 2.0);
    if (!resumed && !state.lesson) persistMatch();
  }
  function startEnd() {
    const m = state.m;
    beginEnd(m, state.w);
    state.parts = []; state.pops = [];
    beginTurn();
    toast(`End ${m.end}: ${state.names[m.hammer]} ${state.names[m.hammer] === 'You' ? 'have' : 'has'} the last stone`, 2.8);
  }
  function startMatch(cfg) {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoEnds >= DEMO_END_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const seed = cfg.seed ?? aiRng.int(1000000);
    const hammer0 = cfg.hammer0 ?? aiRng.int(2);
    state.w = createWorld();
    state.lesson = null;
    state.m = newMatch({ mode: 'ai', opp: 0, format: 'short', ends: 4, watchA: 3, ...cfg, seed, hammer0 });
    state.m.hammer = hammer0;
    setNames();
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.shotOpts = false; state.reasonOpen = false; state.ui.scroll = 0; state.aim = defaultAim();
    startEnd();
  }
  function resumeMatch() {
    const sn = state.saved;
    if (!sn) return;
    if (state.demo && state.record.demoEnds >= DEMO_END_CAP) { clearSaved(); state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const w = createWorld();
    for (const d of sn.stones) { const s = addStone(w, d.team, d.x, d.y); s.id = d.id; s.ang = d.ang; s.fr = d.fr; s.cv = d.cv; }
    w.nextId = Math.max(sn.nextId, ...w.stones.map((s) => s.id + 1), 1);
    const m = newMatch({ watchA: 3, ...sn.cfg });
    Object.assign(m, { end: sn.end, ends: sn.ends, scores: sn.scores.slice(), hammer: sn.hammer, thrown: sn.thrown.slice(), shot: sn.shot, turn: sn.turn, log: sn.log.map((r) => ({ ...r })), phase: 'aim' });
    state.w = w; state.m = m; state.lesson = null; setNames();
    state.scene = 'play'; state.ui.scroll = 0; state.parts = []; state.pops = []; state.reasonOpen = false;
    state.resumeAim = sn.aim;
    beginTurn(true);
    openPause();    // always resumes paused: nothing moves, and no preview time is used, until the player presses Resume
  }
  function startWatch() {
    const picks = [1, 2, 3, 4];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, ends: 1, format: 'short' });
  }
  function startLesson(id) {
    const def = lessonById(id);
    if (!def) return;
    if (def.kind === 'quiz') { state.quiz = { def, idx: lessonIndex(id), chosen: null, correct: def.options.indexOf(def.answer()) }; state.scene = 'quiz'; state.ui.scroll = 0; return; }
    state.w = createWorld();
    state.lesson = { def, tries: 0 };
    state.m = newMatch({ mode: 'lesson', format: 'short', ends: 1, opp: 0, seed: 11 + lessonIndex(id), hammer: 1 });
    setNames();
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.shotOpts = false; state.reasonOpen = false; state.ui.scroll = 0; state.lessonRes = null;
    resetLesson();
  }
  function resetLesson() {
    const { def } = state.lesson;
    state.w = createWorld();
    for (const [t, x, y] of def.stones) addStone(state.w, t, x, y);
    state.m.thrown = [0, 0]; state.m.shot = 4; state.m.turn = 0; state.m.hammer = 1; state.m.phase = 'aim';
    state.parts = []; state.pops = []; state.lessonRes = null;
    beginTurn();
    if (def.fixed) { state.aim = { x: def.fixed.x, y: def.fixed.stopY, w: 0, turn: def.fixed.turn, placed: true }; updatePreview(true); }
  }
  const nextLesson = () => {
    const cur = state.lesson ? state.lesson.def.id : state.quiz.def.id;
    const n = LESSONS[lessonIndex(cur) + 1];
    if (n) startLesson(n.id); else { state.scene = 'learn'; state.ui.scroll = 0; state.lesson = null; }
  };

  // ---- throwing -------------------------------------------------------------------------------------------------------
  function launchShot(team, shot, human) {
    const { m, w } = state;
    const sig = human ? HUMAN : { sigV: profOf(team).sigV, sigA: profOf(team).sigA };
    const fixed = state.lesson && state.lesson.def.fixed;
    const p = fixed ? (() => { const r = solveShot(fixed.x, fixed.stopY, 0, fixed.turn); return { v0: r.v0, theta: r.theta, turn: fixed.turn }; })() : shotParams({ x: shot.x, y: shot.y, w: shot.w, turn: shot.turn });
    const nz = state.lesson ? { dv: 0, dth: 0, fr: 1, cv: 1 } : throwNoise(m.cfg.seed, m.end, m.shot + 1, sig.sigV, sig.sigA);
    state.pre = { protect: protectedIds(m, w, team), stones: snapshotStones(w) };
    const s = launch(w, team, applyNoise(p, nz));
    s.heat = 0;
    m.phase = 'fly'; state.ctl = 'fly';
    state.fl = { team, id: s.id, eff: 0, tgt: 0, disp: 0, phase: 0, acc: 0, cmd: 0, nextAt: w.t, plan: shot, t: 0, tickT: 0, scrubT: 0 };
    state.humanSweeps = human && !state.assist;
    if (human && state.assist) state.fl.plan = fixed ? { x: 0, y: 0 } : shot;
    state.trail = []; state.humanTurn = false; state.pv = null; state.finalPreview = null; state.drag = null; state.card = null; state.think = null; state.restT = 0; state.hl = null;
    if (human) state.record.throws = (state.record.throws | 0) + 1;
    state.sweepIn = { px: 0, py: 0, sp: 0, on: false };
    for (const q of w.stones) { q.dx = undefined; q.d0x = undefined; }
    sfx.release();
    if (human && state.humanSweeps && state.lesson && state.lesson.def.kind === 'sweep') toast('Sweep now: rub the ice side to side', 3);
  }
  const humanThrow = () => {
    const a = state.aim;
    if (!state.humanTurn || state.m.phase !== 'aim' || state.paused) return;
    const fixed = state.lesson && state.lesson.def.fixed;
    if (!fixed && (!a.placed || !state.weightsOk[a.w])) { toast(a.placed ? 'That shot is out of reach' : 'Drag on the ice to set the broom first', 2); sfx.no(); return; }
    launchShot(state.m.turn, { x: a.x, y: a.y, w: a.w, turn: turnSign(a.turn) }, true);
  };

  // effort from the player's finger: rubbing back and forth quickly gives full effort
  function humanEffort(dt, input) {
    const ptr = input.pointer, keys = input.keys, si = state.sweepIn;
    const lay = state.cam.lay;
    let tgt = 0;
    const onIce = lay && ptr.y >= lay.regionTop && ptr.y <= lay.regionBottom;
    if (ptr.down && onIce) {
      if (state.settings.easy) tgt = 0.8;
      else {
        if (si.on) { const d = Math.hypot(ptr.x - si.px, ptr.y - si.py) / dt; si.sp += (Math.min(d, 4000) - si.sp) * 0.22; }
        tgt = clamp(si.sp / 950, 0, 1);
      }
      si.on = true; si.px = ptr.x; si.py = ptr.y;
    } else { si.on = false; si.sp *= 0.8; }
    if (keys.down.has('Space') || keys.down.has('KeyS')) tgt = Math.max(tgt, 0.9);
    return tgt;
  }

  // The sweepers: smooth, game-clock driven. The anchor trails the stone with a slight lag, the heading turns smoothly, the sweep
  // oscillates sinusoidally (about 2-3 Hz when working) with an eased width, and the pair fades in and out. The sim never reads this.
  function updateBrushes(dt, s, mv) {
    const fl = state.fl;
    if (!fl.b) fl.b = { x: s ? s.x : 0, y: s ? s.y : 0, ang: Math.PI / 2, ph: 0, amp: 0.1, a: 0 };
    const b = fl.b;
    b.x0 = b.x; b.y0 = b.y; b.ang0 = b.ang; b.ph0 = b.ph; b.amp0 = b.amp; b.a0 = b.a;
    const kp = 1 - Math.exp(-dt / 0.09), ka = 1 - Math.exp(-dt / 0.12), kw = 1 - Math.exp(-dt / 0.18);
    if (s && s.mode === 'play') {
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > 0.02) { let d = Math.atan2(s.vy, s.vx) - b.ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; b.ang += d * (1 - Math.exp(-dt / 0.08)); }
      const tx = s.dx ?? s.x, ty = s.dy ?? s.y;
      b.x += (tx - b.x) * kp; b.y += (ty - b.y) * kp;
    }
    const want = mv ? 1 : 0;
    b.a += (want - b.a) * ka;
    const eff = fl.eff;
    b.amp += (0.12 + 0.3 * eff - b.amp) * kw;
    b.ph += dt * Math.PI * 2 * (1.8 + 1.0 * eff);
  }

  // ---- flight --------------------------------------------------------------------------------------------------------
  function updateFlight(dt, input) {
    const { w, fl } = state;
    const s = w.stones.find((q) => q.id === fl.id);
    const moving = () => s && s.mode === 'play' && (s.vx !== 0 || s.vy !== 0);
    if (state.humanSweeps) { fl.tgt = humanEffort(dt, input); fl.eff += clamp(fl.tgt - fl.eff, -0.1, 0.07); }
    state.ff = !!(input.pointer.down && inRect(state.cam.lay?.ctrl?.fast, input.pointer.x, input.pointer.y)) || (!state.humanSweeps && input.keys.down.has('Space'));
    // advance the ice: time is compressed by the inverse of the on-screen scale at the stone, so the stone's on-screen speed is
    // exactly proportional to its real speed along the whole path (smooth, no jump in pace; faster pace far from the house)
    fl.acc += (PACE / lengthShape(s ? s.y : 0)) * (state.ff ? 2 : 1);
    let n = Math.floor(fl.acc); fl.acc -= n;
    const ev = [];
    let stepped = 0;
    while (n-- > 0 && !w.settled) {
      if (!state.humanSweeps) {
        if (moving() && w.t >= fl.nextAt && s.y > -26) { fl.cmd = sweepDecision(w, s.id, fl.plan, profOf(fl.team), aiRng); fl.nextAt = w.t + 0.35; }
        fl.eff += clamp(fl.cmd - fl.eff, -4 * STEP, 4 * STEP);
      }
      for (const q of w.stones) { q.lx = q.x; q.ly = q.y; q.la = q.ang; }
      stepWorld(w, { team: fl.team, eff: moving() ? fl.eff : 0 }, ev);
      stepped++;
      fl.t += STEP;
      if (s && s.mode === 'play' && Math.round(fl.t / STEP) % 3 === 0 && state.trail.length < 900) state.trail.push([s.x, s.y, fl.eff]);
    }
    // displayed state: the sim sits at step k, the frame is a fraction acc of the way to step k+1; draw at step k-1 + acc so the
    // picture advances by exactly `rate` steps every update (no 2-3-2-3 stepping) and sub-update blending does the rest
    for (const q of w.stones) {
      q.d0x = q.dx; q.d0y = q.dy; q.d0a = q.da;
      if (stepped && !w.settled) { q.dx = q.lx + (q.x - q.lx) * fl.acc; q.dy = q.ly + (q.y - q.ly) * fl.acc; q.da = q.la + (q.ang - q.la) * fl.acc; }
      else { q.dx = q.x; q.dy = q.y; q.da = q.ang; }
    }
    state.stepped = true;
    updateBrushes(dt, s, moving());
    if (ev.length) worldEvents(w, state.parts, ev, true);
    fl.disp += (fl.eff - fl.disp) * 0.25;
    fl.phase += dt * (3 + fl.eff * 16);
    if (moving() && fl.eff > 0.12) {
      fl.scrubT -= dt;
      if (fl.scrubT <= 0) { sfx.scrub(fl.eff); fl.scrubT = 0.1; }
      if (fx.next() < 0.5 * fl.eff) addPart(state.parts, { kind: 0, x: s.x + (fx.next() - 0.5) * 0.7, y: s.y + 0.9 + fx.next() * 0.3, vx: (fx.next() - 0.5) * 0.8, vy: 0.2 + fx.next() * 0.5, t: 0, max: 0.5, size: 1.4 + fx.next(), col: '#e4f4ff' });
    }
    fl.tickT -= dt;
    if (moving() && fl.tickT <= 0) { sfx.slide(Math.hypot(s.vx, s.vy)); fl.tickT = 0.14; }
    if (w.settled) { state.restT += dt; if (state.restT > 0.55) onSettled(); } else state.restT = 0;
    if (fl.t > 90) for (const q of w.stones) { q.vx = 0; q.vy = 0; }
  }

  const NOTE_TEXT = {
    hog: 'Hog line: the stone did not clear the far hog line, so it is removed',
    hogOther: 'A stone ended short of the far hog line, so it is removed',
    back: 'Out of play: the stone went past the back line',
    side: 'Out of play: the stone touched the side line',
    fgz: 'Free guard zone: a guard was knocked out too early, so the stone is removed and everything is put back',
  };
  function onSettled() {
    const { m, w } = state;
    const before = w.stones.map((s) => ({ id: s.id, x: s.x, y: s.y }));
    const res = resolveShot(m, w, state.pre);
    if (res.restored) {
      for (const s of w.stones) { const b = before.find((q) => q.id === s.id); if (b && s.mode === 'play') { s.ox = b.x - s.x; s.oy = b.y - s.y; } }
    }
    for (const n of res.notes) {
      toast(NOTE_TEXT[n.k], 3.6); sfx.no();
      pop(clamp(n.x ?? 0, -2, 2), clamp(n.y ?? 0, HOG_FAR - 1, BACK), n.k === 'fgz' ? 'Guard rule' : n.k === 'hog' || n.k === 'hogOther' ? 'Hog line' : 'Removed', '#ffb48a', 24);
      chips(state.parts, n.x ?? 0, n.y ?? 0, 8, 1);
    }
    state.lastNotes = res.notes;
    m.phase = 'settle'; state.restT = 0;
    if (state.lesson) finishLessonShot();
  }
  function finishSettle() {
    const { m, w } = state;
    state.fl = null;
    const over = afterShot(m);
    if (over) {
      const info = scoreCurrentEnd(m, w);
      state.ctl = 'score'; state.hl = new Set(info.counted);
      if (m.cfg.mode === 'watch') state.wlabel = 'The end is counted';
      for (let i = 0; i < Math.min(6, info.pts); i++) sfx.chime(i);
      toast(info.team === null ? 'Blank end: nobody scores' : `${state.names[info.team]} ${state.names[info.team] === 'You' ? 'score' : 'scores'} ${info.pts}`, 3);
    } else beginTurn();
  }
  function afterEnd() {
    const m = state.m;
    applyEnd(m);
    if (m.cfg.mode === 'watch' && !m.over) m.over = { win: m.scores[0] >= m.scores[1] ? 0 : 1, extra: false };
    if (m.cfg.mode !== 'watch') state.record.demoEnds = (state.record.demoEnds | 0) + 1;
    if (m.over) {
      state.scene = 'result'; state.ui.scroll = 0; state.ctl = 'aim';
      if (m.cfg.mode === 'ai') {
        state.record.played++;
        if (m.over.win === 0) { state.record.wins[m.cfg.opp]++; state.record.streak++; state.record.best = Math.max(state.record.best, state.record.streak); sfx.win(); } else state.record.streak = 0;
      }
      clearSaved(); save();
    } else if (state.demo && m.cfg.mode !== 'watch' && state.record.demoEnds >= DEMO_END_CAP) { clearSaved(); save(); state.scene = 'demolimit'; state.ui.scroll = 0; }
    else { save(); startEnd(); }
  }

  // ---- lessons -------------------------------------------------------------------------------------------------------
  function finishLessonShot() {
    const { w } = state;
    const stone = w.stones.find((s) => s.id === w.thrown);
    const before = state.lesson.def.stones.filter((q) => q[0] === 1).length;
    const removed = before - w.stones.filter((s) => s.team === 1 && s.mode === 'play').length;
    const r = state.lesson.def.check({ stone, w, removed });
    state.lesson.tries++;
    if (r.ok && !state.assist) { state.learn.done[state.lesson.def.id] = true; save(); sfx.win(); } else if (r.ok) sfx.chime(2); else sfx.no();
    state.lessonRes = { ok: r.ok, msg: r.msg + (state.assist && r.ok ? ' (That one was the demonstration.)' : ''), id: state.lesson.def.id };
    state.m.phase = 'lessonres'; state.ctl = 'aim'; state.fl = null;
  }

  // ---- AI turn ----------------------------------------------------------------------------------------------------
  const describe = (plan, team) => explainShot(state.m, state.w, team, plan, namesFor(team));
  function previewFor(p) {
    const { w, m } = state;
    const pr0 = shotParams({ x: p.x, y: p.y, w: p.w, turn: p.turn });
    const w2 = cloneWorld(w);
    const s = launch(w2, m.turn, { v0: pr0.v0, theta: pr0.theta, turn: pr0.turn });
    const pr = predictStone(w2, s.id, 0, { path: true });
    state.pv = pr ? { path: pr.path, end: { x: pr.x, y: pr.y, kind: pr.kind } } : null;
  }
  function updateAI(dt) {
    const { m } = state;
    if (m.phase !== 'aim' || !isAI(m.turn) || state.paused) return;
    const prof = profOf(m.turn), watch = mode() === 'watch', side = m.turn;
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur, phase: 'think', plan: null };
      planner = createPlanner(state.w, side, m, prof, aiRng, {});
      if (watch) { state.wlabel = `${state.names[side]} is thinking…`; toast(`${state.names[side]} is thinking…`, Math.min(dur, 3)); }
    }
    const th = state.think;
    th.t += dt;
    if (planner && !planner.done) { planner.step(6); if (planner.done) { th.plan = planner.result; planner = null; } }
    if (th.phase === 'think' && th.t >= th.dur && th.plan) {
      th.phase = 'reveal'; th.t = 0; th.dur = watch ? 2 : 0.9;
      const p = th.plan;
      state.aim = { x: p.x, y: p.y, w: p.w, turn: p.turn * hand(), placed: true };
      previewFor(p);
      if (watch) {
        const ex = describe(p, side);
        state.card = { title: `${state.names[side]}: ${ex.title}`, text: `${situation(m, side, namesFor(side))}. ${ex.reason}${p.alts && p.alts.length ? ` Other ideas it weighed: ${p.alts.map((a) => a.name).join(', ')}.` : ''}`, sticky: true };
        state.wlabel = `${state.names[side]} will play: ${p.name}`;
      }
    } else if (th.phase === 'reveal' && th.t >= th.dur) {
      state.card = null;
      launchShot(side, { x: th.plan.x, y: th.plan.y, w: th.plan.w, turn: th.plan.turn }, false);
      state.fl.plan = th.plan;
      if (watch) state.wlabel = `${state.names[side]} is delivering`;
    }
  }

  // ---- Think (hint for the human) --------------------------------------------------------------------------------
  function applyAdvice(r, team) {
    state.aim = { x: r.x, y: r.y, w: r.w, turn: r.turn * hand(), placed: true };
    previewKey = ''; updatePreview(true);
    const ex = describe(r, team);
    state.card = { title: `Think: ${ex.title}`, text: `${situation(state.m, team, namesFor(team))}. ${ex.reason}${r.alts && r.alts.length ? ` Other ideas: ${r.alts.map((a) => a.name).join(', ')}.` : ''}`, sticky: true };
  }
  function showModel() {
    const d = state.lesson.def;
    if (d.fixed || !d.model) return;
    state.aim = { x: d.model.x, y: d.model.y, w: d.model.w, turn: d.model.turn * hand(), placed: true };
    previewKey = ''; updatePreview(true);
    state.card = { title: `Show me: ${d.title}`, text: `${d.goal} The broom, weight and turn are set for you: press Throw.`, sticky: true };
    state.assist = true;
  }
  function requestHint() {
    const { m } = state;
    if (state.hintBusy || m.phase !== 'aim' || !state.humanTurn || (state.lesson && state.lesson.def.fixed)) return;
    if (state.lesson) { showModel(); return; }
    state.hintBusy = true;
    hintPlanner = createPlanner(state.w, m.turn, m, PROFILES[4], aiRng, { perfect: true });
  }
  function updateHint() {
    if (!hintPlanner) return;
    hintPlanner.step(5);
    if (hintPlanner.done) {
      const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.m.phase !== 'aim' || !state.humanTurn) return;
      applyAdvice(r, state.m.turn);
    }
  }

  // ---- the play scene ------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.shotOpts = false; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leaveMatch = () => {
    const wasLesson = !!state.lesson;
    state.scene = wasLesson ? 'learn' : 'title'; state.paused = false; state.pauseMenu = false; state.shotOpts = false; state.reasonOpen = false; state.ui.scroll = 0;
    state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.drag = null; state.fl = null; state.card = null; state.lesson = null;
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
  function modalInput(ptr, key, handler) {
    ensureLayout(state, key);
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
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
    else if (id === 'p-guide') { st.guide = (st.guide + 1) % 3; save(); previewKey = ''; }
    else if (id === 'p-txtdec') { st.textIdx = Math.max(0, st.textIdx - 1); save(); }
    else if (id === 'p-txtinc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); save(); }
    else if (id === 'quit') leaveMatch();
  }
  function handleShotTap(id) {
    if (!id) return;
    sfx.tick();
    if (/^w\d$/.test(id)) { const i = Number(id.slice(1)); if (state.weightsOk[i]) { state.aim.w = i; updatePreview(); } }
    else if (id === 'turn1') { state.aim.turn = 1; updatePreview(); }
    else if (id === 'turn-1') { state.aim.turn = -1; updatePreview(); }
    else if (id === 'shot-done') state.shotOpts = false;
  }
  function lessonInput(ptr) {
    modalInput(ptr, 'lessonres', (id) => {
      if (!id) return;
      sfx.tick();
      if (id === 'les-next') nextLesson();
      else if (id === 'les-again') resetLesson();
      else if (id === 'les-show') { const d = state.lesson.def; resetLesson(); if (d.fixed) { state.assist = true; toast('Watch the sweepers carry it in. Press Throw', 4); } else showModel(); }
      else if (id === 'les-list') leaveMatch();
    });
  }

  function updatePlay(dt, input) {
    const { m } = state;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch';
    const lay = layoutFor(state);
    state.cam.lay = lay;
    if (config.dev && keys.pressed.has('KeyK') && !state.lesson) { clearSaved(); m.scores[0] = 6; m.scores[1] = 3; m.over = { win: 0, extra: false }; m.phase = 'over'; state.scene = 'result'; state.ui.scroll = 0; return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) {
      if (state.pauseMenu) closePause(); else if (state.shotOpts) state.shotOpts = false; else if (state.reasonOpen) state.reasonOpen = false;
      else if (!watch) openPause(); else state.paused = !state.paused;
    }
    if (state.pauseMenu) { modalInput(ptr, 'pause', handlePauseTap); return; }
    if (state.shotOpts) { modalInput(ptr, 'shot', handleShotTap); return; }
    if (state.reasonOpen) { modalInput(ptr, 'reason', (id) => { if (id === 'reason-close') state.reasonOpen = false; }); return; }
    if (m.phase === 'lessonres') { lessonInput(ptr); stepFx(dt); return; }

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
      if (ptr.pressed) {
        if (inRect(c.menu, ptr.x, ptr.y)) { openPause(); sfx.tick(); return; }
        if (state.card && inRect(cardRect(state, lay), ptr.x, ptr.y)) { state.reasonOpen = true; state.ui.scroll = 0; return; }
        if (state.humanTurn && !state.paused && m.phase === 'aim') {
          if (c.inline) {
            c.chips.forEach((r, i) => { if (inRect(r, ptr.x, ptr.y) && state.weightsOk[i]) { state.aim.w = i; sfx.tick(); updatePreview(); } });
            if (inRect(c.turn[0], ptr.x, ptr.y)) { state.aim.turn = 1; sfx.tick(); updatePreview(); }
            if (inRect(c.turn[1], ptr.x, ptr.y)) { state.aim.turn = -1; sfx.tick(); updatePreview(); }
          } else if (inRect(c.shot, ptr.x, ptr.y)) { state.shotOpts = true; state.ui.scroll = 0; sfx.tick(); return; }
          if (inRect(c.think, ptr.x, ptr.y)) { requestHint(); sfx.tick(); }
          else if (inRect(c.throw, ptr.x, ptr.y)) { humanThrow(); return; }
          else if (ptr.y >= lay.regionTop && ptr.y <= lay.regionBottom && !(state.lesson && state.lesson.def.fixed)) state.drag = { moved: false };
        }
      }
      if (state.drag && state.humanTurn && !state.paused) {
        if (ptr.down) {
          const cam = makeCam(state, lay);
          const wp = camToWorld(cam, ptr.x, ptr.y - 64 * Math.min(1.4, cam.ppm / 100));
          const t = clampTarget(wp.x, wp.y);
          if (!state.aim.placed || Math.abs(t.x - state.aim.x) > 0.004 || Math.abs(t.y - state.aim.y) > 0.004) { if (!state.drag.moved) sfx.place(); setAim({ x: t.x, y: t.y, placed: true }); state.drag.moved = true; updatePreview(); }
        }
        if (ptr.released || !ptr.down) state.drag = null;
      } else if (state.drag) state.drag = null;
      if (state.humanTurn && !state.paused && m.phase === 'aim') {
        const a = state.aim;
        let touched = false;
        const k = 0.02;
        if (keys.down.has('ArrowLeft')) { a.x = clamp(a.x - k, -1.9, 1.9); touched = true; }
        if (keys.down.has('ArrowRight')) { a.x = clamp(a.x + k, -1.9, 1.9); touched = true; }
        if (keys.down.has('ArrowUp')) { a.y = clamp(a.y + k, HOG_FAR + 0.15, 1.7); touched = true; }
        if (keys.down.has('ArrowDown')) { a.y = clamp(a.y - k, HOG_FAR + 0.15, 1.7); touched = true; }
        if (touched) { a.placed = true; updatePreview(); }
        if (keys.pressed.has('KeyW')) { for (let j = 1; j <= 4; j++) { const i = (a.w + j) % 4; if (state.weightsOk[i]) { a.w = i; break; } } updatePreview(); }
        if (keys.pressed.has('KeyQ') || keys.pressed.has('KeyE')) { a.turn = -a.turn; updatePreview(); }
        if (keys.pressed.has('KeyH')) requestHint();
        if (keys.pressed.has('Space') || keys.pressed.has('Enter')) humanThrow();
      }
    } else if (state.ctl === 'fly') {
      if (ptr.pressed && inRect(c.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
    }
    if (state.ctl === 'score') {
      if (!state.paused) m.endInfo.t += dt;
      if (!watch && ptr.pressed && inRect(c.go, ptr.x, ptr.y) && m.endInfo.t > 0.4) { sfx.tick(); afterEnd(); return; }
      if (watch && m.endInfo.t > 4.8 && !state.paused) { afterEnd(); return; }
      if (!watch && (keys.pressed.has('Enter') || keys.pressed.has('Space')) && m.endInfo.t > 0.4) { afterEnd(); return; }
    }
    if (state.paused) return;
    stepFx(dt);
    updateHint();
    updateAI(dt);
    // fixed camera rule: the playing surface never moves; only stones, sweepers, trails and effects do
    if (m.phase === 'fly') updateFlight(dt, input);
    else if (m.phase === 'settle' && !state.lesson) { state.restT += dt; if (state.restT > 0.7) finishSettle(); }
  }
  function stepFx(dt) {
    for (const s of state.w.stones) {
      if (s.heat > 0) s.heat = Math.max(0, s.heat - dt * 2.2);
      if (s.mode === 'out') s.out += dt;
      if (s.ox) { s.ox *= 0.86; s.oy *= 0.86; if (Math.abs(s.ox) < 0.002 && Math.abs(s.oy) < 0.002) { s.ox = 0; s.oy = 0; } }
    }
    stepParts(state.parts, dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
  }

  // ---- menus ----------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
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
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id.startsWith('fmt-')) s.format = id.slice(4);
    else if (id.startsWith('ends')) s.ends = Number(id.slice(4));
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, format: s.format, ends: s.ends });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-guide') st.guide = (st.guide + 1) % 3;
    else if (id === 'set-easy') st.easy = !st.easy;
    else if (id === 'set-left') st.left = !st.left;
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
    if (id === 'again') startMatch({ ...cfg, seed: undefined, hammer0: other(cfg.hammer0 ?? 0) });
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

  // ---- showcase (store screenshots: ?shot=1 plays a scripted, real position instead of the random player) ------------
  function setupShowcase(kind) {
    state.shotMode = { kind, tick: 0 };
    const cfg = { mode: 'ai', opp: 3, format: 'standard', ends: 4, seed: 4242 + kind, hammer0: kind % 2 };
    state.w = createWorld(); state.lesson = null;
    state.m = newMatch({ watchA: 3, ...cfg });
    state.m.hammer = cfg.hammer0; setNames(); state.scene = 'play';
    beginEnd(state.m, state.w);
    const lay0 = [[1, 0.0, -3.7], [0, 0.15, 0.1], [1, -0.5, -0.4], [0, 1.0, -3.0], [1, 0.45, 0.55], [0, -0.7, -0.1]];
    if (kind !== 5) for (const [t, x, y] of lay0) { const s = addStone(state.w, t, x, y); s.ang = x * 5 + y; }
    state.m.thrown = kind !== 5 ? [3, 3] : [0, 0]; state.m.shot = kind !== 5 ? 6 : 0; state.m.turn = kind !== 5 ? 0 : 1;
    state.aim = defaultAim(); state.humanTurn = true;
  }
  function showcaseStep() {
    const sm = state.shotMode, k = sm.kind;
    sm.tick++;
    const a = state.aim, m = state.m;
    const go = () => { state.humanTurn = true; m.phase = 'aim'; m.turn = 0; humanThrow(); state.humanSweeps = false; };
    if (k === 0 || k === 5) {
      if (sm.tick === 2) { Object.assign(a, { x: 0.35, y: 0.2, w: 0, turn: 1, placed: true }); state.humanTurn = true; previewKey = ''; updatePreview(true); }
      if (sm.tick === 4 && k === 0) applyAdvice({ x: -0.35, y: 0.0, w: 2, turn: 1, kind: 'takeout', name: 'Takeout', alts: [{ name: 'Draw' }] }, 0);
    } else if (k === 1) {
      if (sm.tick === 2) { Object.assign(a, { x: 0.1, y: -0.35, w: 0, turn: -1, placed: true }); go(); }
      if (state.fl) { state.fl.cmd = 0.85; state.humanSweeps = false; }
    } else if (k === 2) {
      if (sm.tick === 2) { Object.assign(a, { x: 0.15, y: 0.1, w: 2, turn: 1, placed: true }); go(); }
      if (state.fl) { state.fl.cmd = 0; state.humanSweeps = false; }
    } else if (k === 3) {
      if (sm.tick === 2) { m.thrown = [8, 8]; m.shot = 16; scoreCurrentEnd(m, state.w); state.ctl = 'score'; state.hl = new Set(m.endInfo.counted); }
    } else if (k === 4) {
      if (sm.tick === 2) { startLesson('curl'); state.aim = { x: 0, y: 0, w: 0, turn: 1, placed: true }; previewKey = ''; updatePreview(true); }
    }
  }

  // wall-clock drawing helpers stay out of the enumerable state (hashes and saves never see them)
  for (const k of ['alpha', 'updAt']) Object.defineProperty(state, k, { value: undefined, writable: true, enumerable: false });
  startAttract();
  resetMenus();
  if (SHOT_MODE) {
    setupShowcase((Number(config.seed) | 0) % 6);
    // review aid: ?view=title|setup|settings|learn|quiz|result|rules|about|howto|pause|lessonres and ?zoom=0..4
    const q = (k) => { try { const m = new RegExp(`[?&]${k}=([a-z0-9]+)`).exec(globalThis.location.search); return m ? m[1] : null; } catch { return null; } };
    if (q('zoom')) state.settings.textIdx = clamp(Number(q('zoom')) | 0, 0, 4);
    const v = q('view');
    if (v) {
      state.shotMode = v === 'pause' || v === 'lessonres' ? state.shotMode : null;
      if (v === 'pause') openPause();
      else if (v === 'lessonres') { startLesson('draw'); state.lessonRes = { ok: false, msg: 'Light: the stone stopped 1.2 m short of the button.' }; state.m.phase = 'lessonres'; state.shotMode = null; }
      else if (v === 'result') { state.m.over = { win: 0, extra: false }; state.m.scores = [6, 3]; state.m.log = [{ end: 1, team: 0, pts: 2, steal: false }, { end: 2, team: 1, pts: 1, steal: true }]; state.scene = 'result'; }
      else if (v === 'quiz') { startLesson('count'); }
      else if (v === 'rules' || v === 'about' || v === 'howto') { state.scene = v; state.back = 'title'; state.page = Number(q('page')) | 0; }
      else if (v === 'watch') { startWatch(); state.shotMode = null; }
      else state.scene = v;
    }
    const adv = Number(q('ticks')) | 0;   // review aid: play this many fixed steps before the first frame
    if (adv > 0 && state.scene === 'play') {
      const blank = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
      for (let i = 0; i < adv; i++) { state.t += 1 / 60; if (state.shotMode) showcaseStep(); updatePlay(1 / 60, blank); }
    }
  }

  return {
    // Watch & Learn, lessons and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch' && state.m.cfg.mode !== 'lesson') || state.paused,
    update(dt, input) {
      state.stepped = false; state.updAt = nowMs();
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') updateAttract(dt);
      if (state.shotMode) {
        const blank = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
        showcaseStep();
        if (state.scene === 'play') updatePlay(dt, blank);
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
      state.alpha = state.stepped && env.clock ? Math.max(0, Math.min(1, (nowMs() - state.updAt) / (STEP * 1000))) : 1;
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
          else if (state.shotOpts) renderShotOptions(ctx, state);
          else if (state.reasonOpen) renderReason(ctx, state);
          else if (state.m && state.m.phase === 'lessonres') renderLessonResult(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
  };
}
