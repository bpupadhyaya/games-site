// Tumbang Preso: Can Toss. State and flow. Physics lives in sim.js, the computer players and hints in ai.js, Watch & Learn
// explanations in explain.js, lessons in lessons.js, drawing in view.js, art.js and menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, learn, quiz, play (matches, Watch & Learn and lessons), result, howto/about/rules, demolimit.
// A match is a few rounds in one role (thrower or guard). A round plays in real time at 60 fixed steps a second.
import {
  DT, createWorld, stepWorld, throwers, slipOf, doThrow, canThrow, isHome, canUp, LINE_Z, CAN, FIELD, SPEED, clamp, ROUND_LIMIT,
} from './sim.js';
import {
  THROWER_PROFILES, TAYA_PROFILES, newBrains, applyProfiles, aiStep, scatter, HUMAN_SIG, adviseThrower, adviseTaya, bestTarget,
} from './ai.js';
import { explainThrow, explainDash, explainTaya } from './explain.js';
import { LESSONS, lessonById, lessonIndex, quizWorld } from './lessons.js';
import { W, H, inRect, REF_CLOSE, TEXT_DEC, TEXT_INC, TEXT_SCALES, THINK_STEPS, SETUP_PINS, setSize, sizeKey } from './layout.js';
import { renderPlay, layoutFor, camFor, bigBarIds } from './view.js';
import { readerGeo, setupPinsGeo, host } from './layout.js';
import {
  renderTitle, renderSetup, renderSettings, renderLearn, renderQuiz, renderResult, renderPause, renderSheet, renderReason, renderRoundOver, renderLessonResult, renderPages, renderDemoLimit,
  hitScreen, flowMeta, readerMax, ensureReader, ensureLayout, resetMenus,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';
import { pressLockup } from './brand.js';

export const meta = { width: W, height: H, fluid: { short: 720 } };
export const DEMO_ROUND_CAP = 2;
const SHOT_MODE = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();
const tagsNeeded = (rounds) => Math.ceil((rounds + 0.5) / 2);   // guard: tags to win
const strikesAllowed = (rounds) => Math.floor((rounds - 1) / 2);   // thrower: rounds you may be tagged in and still win
export const POINTS = { hit: 2, safe: 1, tagged: -2, timeout: 2 };

export function createGame(env) {
  const textScale = () => TEXT_SCALES[state.settings.textIdx];
  const nowMs = () => (env.clock ? env.clock() : 0);   // display clock from the shell; absent in headless runs (alpha stays 1)
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork();
  const aiRng = rng.fork();
  const humanRng = rng.fork();
  const newFx = () => ({ parts: [], rings: [], pops: [], ping: 0 });
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, haptics: true, textIdx: 0, thinkIdx: 1, guide: 0, assist: true },
    record: { played: 0, wins: { thrower: [0, 0, 0, 0, 0], taya: [0, 0, 0, 0, 0] }, streak: 0, best: 0, demoRounds: 0 },
    learn: { done: {} },
    setup: { role: 'thrower', level: 2, rounds: 3 }, setupMsg: '',
    ui: { scroll: 0, drag: null }, page: 0,
    m: null, w: null, br: null, human: -1, names: {}, cam: {},
    aim: { x: 0, z: CAN.z, style: 'lob' }, humanTurnAim: false, drag: null, auto: null, hint: null, hintT: 0, hl: null, thinkBusy: false, idleT: 0,
    fx: newFx(), toast: '', toastT: 0, att: null, think: null, thinkOk: null, card: null, runDust: {},
    reasonOpen: false, sheet: false, saved: null, quiz: null, lesson: null, lessonRes: null, lessonT: 0, roundRes: null, roundOver: false, loaded: false, restoreMsg: '', shotMode: null,
  };

  // ---- persistence ------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); storage.set('learn', state.learn); };
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('learn', null), storage.get('match', null)]).then(([s, r, l, mt]) => {
    if (s) Object.assign(state.settings, s);
    if (r) {
      Object.assign(state.record, r);
      const wn = state.record.wins;
      state.record.wins = { thrower: Array.isArray(wn && wn.thrower) && wn.thrower.length >= 5 ? wn.thrower.slice(0, 5) : [0, 0, 0, 0, 0], taya: Array.isArray(wn && wn.taya) && wn.taya.length >= 5 ? wn.taya.slice(0, 5) : [0, 0, 0, 0, 0] };
    }
    if (l && l.done && typeof l.done === 'object') state.learn = { done: { ...l.done } };
    if (!state.saved) state.saved = validSnapshot(mt);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    state.settings.guide = clamp(state.settings.guide | 0, 0, 2);
    state.settings.assist = state.settings.assist !== false;
    state.settings.haptics = state.settings.haptics !== false;
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });
  // A match is written down at the start of every round (all positions reset then) and offered as Continue.
  const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  function validSnapshot(sn) {
    try {
      if (!sn || sn.v !== 1 || !sn.cfg || !(sn.cfg.role === 'thrower' || sn.cfg.role === 'taya')) return null;
      const c = sn.cfg;
      if (!num(c.level, 0, 4) || !(c.rounds === 3 || c.rounds === 5) || !num(sn.round, 1, c.rounds) || !num(sn.strikes, 0, 99) || !num(sn.tags, 0, 99) || !num(sn.escapes, 0, 99)) return null;
      if (!sn.pts || !num(sn.pts.you, -999, 999)) return null;
      if (!Array.isArray(sn.log) || sn.log.length > 9 || !sn.log.every((r) => r && num(r.round, 1, 9) && typeof r.text === 'string' && r.text.length < 80)) return null;
      return sn;
    } catch { return null; }
  }
  const snapshot = () => {
    const m = state.m;
    return { v: 1, cfg: { role: m.cfg.role, level: m.cfg.level, rounds: m.cfg.rounds }, round: m.round, pts: { ...m.pts }, strikes: m.strikes, tags: m.tags, escapes: m.escapes, log: m.log.map((r) => ({ round: r.round, text: r.text })) };
  };
  const persistMatch = () => { if (state.m && state.m.cfg.mode === 'ai' && !state.m.over) { state.saved = snapshot(); storage.set('match', state.saved); } };
  const clearSaved = () => { if (state.saved) { state.saved = null; storage.set('match', null); } };

  // ---- sound ------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    whoosh: () => { tone({ freq: 700, to: 260, dur: 0.18, type: 'sawtooth', vol: 0.014 }); tone({ freq: 220, to: 120, dur: 0.12, type: 'sine', vol: 0.03 }); },
    thud: (v) => tone({ freq: 130 + fxRng.next() * 20, to: 70, dur: 0.1, type: 'sine', vol: 0.03 + Math.min(0.06, v * 0.008) }),
    ping: (v) => {
      const q = Math.min(1, v / 8);
      tone({ freq: 1760 + fxRng.next() * 80, to: 1500, dur: 0.55, type: 'sine', vol: 0.07 + 0.06 * q });
      tone({ freq: 2640, to: 2400, dur: 0.35, type: 'sine', vol: 0.03 + 0.03 * q });
      tone({ freq: 3520, to: 3200, dur: 0.18, type: 'sine', vol: 0.015 });
      tone({ freq: 320, to: 160, dur: 0.09, type: 'square', vol: 0.03 });
    },
    tap: () => { tone({ freq: 1900, to: 1700, dur: 0.22, type: 'sine', vol: 0.035 }); },
    bounce: () => tone({ freq: 900 + fxRng.next() * 200, to: 400, dur: 0.12, type: 'triangle', vol: 0.03 }),
    erect: () => { tone({ freq: 523, dur: 0.12, type: 'triangle', vol: 0.07 }); tone({ freq: 784, dur: 0.2, type: 'triangle', vol: 0.06 }); },
    pick: () => tone({ freq: 660, dur: 0.07, type: 'triangle', vol: 0.05 }),
    safe: () => { tone({ freq: 587, dur: 0.1, type: 'triangle', vol: 0.07 }); tone({ freq: 880, dur: 0.16, type: 'triangle', vol: 0.06 }); },
    tag: () => { tone({ freq: 300, to: 120, dur: 0.22, type: 'sawtooth', vol: 0.07 }); tone({ freq: 180, to: 90, dur: 0.3, type: 'sine', vol: 0.06 }); },
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 220, to: 140, dur: 0.2, type: 'sawtooth', vol: 0.05 }),
    go: () => { tone({ freq: 660, dur: 0.12, type: 'triangle', vol: 0.07 }); },
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const buzz = (ms) => { if (state.human >= 0 && state.settings.haptics && typeof env.haptic === 'function') env.haptic(ms); };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };

  // ---- effects --------------------------------------------------------------------------------------------------
  const MAX_PARTS = 120;
  const dust = (fx, x, z, n, big = 1) => {
    for (let i = 0; i < n && fx.parts.length < MAX_PARTS; i++) fx.parts.push({ kind: 'dust', x: x + (fxRng.next() - 0.5) * 0.3, y: 0.05 + fxRng.next() * 0.1, z: z + (fxRng.next() - 0.5) * 0.3, vx: (fxRng.next() - 0.5) * 0.9, vy: 0.2 + fxRng.next() * 0.4, vz: (fxRng.next() - 0.5) * 0.9, t: 0, max: 0.5 + fxRng.next() * 0.4, r0: 0.1 * big, r1: (0.28 + fxRng.next() * 0.2) * big });
  };
  const sparks = (fx, x, y, z, n) => {
    for (let i = 0; i < n && fx.parts.length < MAX_PARTS; i++) { const a = fxRng.next() * Math.PI * 2, s = 1.2 + fxRng.next() * 2.4; fx.parts.push({ kind: 'spark', x, y, z, vx: Math.cos(a) * s, vy: 0.8 + fxRng.next() * 2, vz: Math.sin(a) * s, t: 0, max: 0.3 + fxRng.next() * 0.3 }); }
  };
  const ring = (fx, x, z, r0, r1, col, a = 0.8, max = 0.6, lw = 3) => fx.rings.push({ x, z, r0, r1, col, a, max, t: 0, lw });
  const pop = (fx, x, z, text, col, size = 30) => { fx.pops.push({ x, z, text, col, size, t: 0, max: 1.3 }); if (fx.pops.length > 8) fx.pops.shift(); };
  const stepFx = (fx, w, dt) => {
    if (dt <= 0) return;
    for (const q of fx.parts) { q.t += dt; q.x += q.vx * dt; q.z += q.vz * dt; q.y += q.vy * dt; if (q.kind === 'spark') q.vy -= 9 * dt; q.vx *= 0.96; q.vz *= 0.96; }
    for (let i = fx.parts.length - 1; i >= 0; i--) if (fx.parts[i].t >= fx.parts[i].max) fx.parts.splice(i, 1);
    for (const r of fx.rings) r.t += dt;
    fx.rings = fx.rings.filter((r) => r.t < r.max);
    for (const p of fx.pops) p.t += dt;
    fx.pops = fx.pops.filter((p) => p.t < p.max);
    if (fx.ping > 0) fx.ping = Math.max(0, fx.ping - dt * 1.8);
    // footfall dust while running
    for (const a of w.agents) {
      const sp = Math.hypot(a.vx, a.vz);
      if (sp > 2.2) { const k = (state.runDust[a.id] ?? 0) - dt; if (k <= 0) { dust(fx, a.x, a.z, 1, 0.8); state.runDust[a.id] = 0.13; } else state.runDust[a.id] = k; }
    }
  };
  const nameOf = (id) => state.names[id] ?? 'Player';
  const colOf = (id) => (id === 0 ? '#ff8f7c' : id === 1 ? '#8ff0e4' : id === 3 ? '#cdb4ff' : '#ffe08a');
  function handleEvents(w, fx, ev, live) {
    for (const e of ev) {
      if (e.k === 'throw') { if (live) { sfx.whoosh(); if (e.id === state.human) buzz(10); } dust(fx, e.x, e.z, 2, 0.6); }
      else if (e.k === 'land') { dust(fx, e.x, e.z, 3, 0.9); ring(fx, e.x, e.z, 0.1, 0.5, 'rgba(255,240,210,A)', 0.5, 0.4, 2); if (live) sfx.thud(e.v); }
      else if (e.k === 'hit') {
        sparks(fx, e.x, 0.4, e.z, 10); ring(fx, e.x, e.z, 0.2, 1.4, 'rgba(255,255,255,A)', 0.9, 0.55, 3.5); fx.ping = 1;
        if (live) { buzz(e.id === state.human ? [30, 30, 30] : 20); sfx.ping(e.v); pop(fx, e.x, e.z, `+${POINTS.hit}`, colOf(e.id), 34); }
      } else if (e.k === 'tap') { fx.ping = 0.5; ring(fx, e.x, e.z, 0.2, 0.8, 'rgba(255,255,255,A)', 0.6, 0.4, 2.5); if (live) sfx.tap(); }
      else if (e.k === 'canBounce') { dust(fx, e.x, e.z, 2, 0.9); if (live) sfx.bounce(); }
      else if (e.k === 'canPick') { if (live) sfx.pick(); }
      else if (e.k === 'erect') { ring(fx, e.x, e.z, 0.3, CAN.circle + 0.35, 'rgba(157,255,176,A)', 0.9, 0.7, 4); fx.ping = 0.6; if (live) { buzz(18); sfx.erect(); pop(fx, e.x, e.z, 'Can up!', '#9dffb0', 28); } }
      else if (e.k === 'pick') { if (live) sfx.pick(); }
      else if (e.k === 'safe') { ring(fx, e.x, e.z, 0.3, 1.0, 'rgba(157,255,176,A)', 0.8, 0.6, 3); if (live) { buzz(14); sfx.safe(); pop(fx, e.x, e.z, `+${POINTS.safe} safe`, '#9dffb0', 26); } }
      else if (e.k === 'tag') { ring(fx, e.x, e.z, 0.2, 1.3, 'rgba(255,110,90,A)', 0.95, 0.7, 4); sparks(fx, e.x, 0.6, e.z, 8); if (live) { sfx.tag(); buzz(70); } }
      else if (e.k === 'canRest' || e.k === 'slipRest') { dust(fx, e.x, e.z, 1, 0.7); }
    }
  }

  // ---- the attract yard behind the menus ----------------------------------------------------------------------
  function startAttract() {
    const w = createWorld();
    const br = newBrains(w, 3, 3, fxRng); applyProfiles(w, br);
    state.att = { w, br, fx: newFx(), wait: 0 };
  }
  function updateAttract() {
    const a = state.att;
    if (!a) return;
    if (a.w.phase === 'over') { a.wait += DT; if (a.wait > 1.8) startAttract(); return; }
    const cmds = {};
    aiStep(a.w, a.br, fxRng, -1, DT, cmds);
    const ev = stepWorld(a.w, cmds);
    handleEvents(a.w, a.fx, ev, false);
    stepFx(a.fx, a.w, DT);
    state.stepped = true;
  }

  // ---- matches --------------------------------------------------------------------------------------------------
  const setNames = () => {
    const c = state.m.cfg, tl = c.mode === 'watch' ? c.tl : c.level;
    if (c.mode === 'lesson') state.names = { 0: c.role === 'taya' ? 'You' : 'Guard', 1: 'Pia', 2: c.role === 'thrower' ? 'You' : 'Rey', 3: 'Tina' };
    else state.names = { 0: c.role === 'taya' && c.mode !== 'watch' ? 'You' : TAYA_PROFILES[tl ?? 2].name, 1: 'Pia', 2: c.role === 'thrower' && c.mode !== 'watch' ? 'You' : 'Rey', 3: 'Tina' };
  };
  function newMatchState(cfg) {
    return { cfg, round: 1, pts: { you: 0 }, strikes: 0, tags: 0, escapes: 0, need: cfg.role === 'thrower' ? strikesAllowed(cfg.rounds) : tagsNeeded(cfg.rounds), log: [], over: null };
  }
  function startMatch(cfg) {
    if (state.demo && cfg.mode === 'ai' && state.record.demoRounds >= DEMO_ROUND_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.m = newMatchState(cfg); state.lesson = null;
    setNames();
    startRound(false);
  }
  function resumeMatch() {
    const sn = state.saved;
    if (!sn) return;
    if (state.demo && state.record.demoRounds >= DEMO_ROUND_CAP) { clearSaved(); state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const m = newMatchState({ mode: 'ai', role: sn.cfg.role, level: sn.cfg.level, rounds: sn.cfg.rounds });
    Object.assign(m, { round: sn.round, pts: { ...sn.pts }, strikes: sn.strikes, tags: sn.tags, escapes: sn.escapes, log: sn.log.map((r) => ({ ...r })) });
    state.m = m; state.lesson = null; setNames();
    startRound(true);
    openPause();    // always resumes paused: nothing moves, and no preview time is used, until the player presses Resume
  }
  function startRound(resumed) {
    const m = state.m, cfg = m.cfg;
    const lessonDef = state.lesson ? state.lesson.def : null;
    const w = createWorld({ limit: lessonDef ? 1e9 : ROUND_LIMIT });
    const watch = cfg.mode === 'watch';
    const thrLevel = watch ? cfg.hl : cfg.role === 'taya' ? cfg.level : 4;   // friends who play carefully, so the guard's level is what you feel
    const tayaLevel = watch ? cfg.tl : cfg.role === 'thrower' ? cfg.level : 2;
    const br = newBrains(w, thrLevel ?? 2, tayaLevel ?? 2, aiRng);
    applyProfiles(w, br);
    const human = watch ? -1 : cfg.role === 'taya' ? 0 : 2;
    if (human === 2) w.agents[2].speed = SPEED.thrower;
    if (human === 0) w.agents[0].speed = SPEED.taya;
    if (lessonDef) lessonDef.setup(w);
    state.w = w; state.br = br; state.human = human;
    state.fx = newFx(); state.runDust = {};
    state.aim = { x: 0, z: CAN.z, style: state.aim.style === 'skim' ? 'skim' : 'lob' };
    state.drag = null; state.auto = null; state.hint = null; state.hintT = 0; state.hl = null; state.think = null; state.thinkOk = null; state.card = null; state.idleT = 0;
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.reasonOpen = false; state.sheet = false; state.roundOver = false; state.roundRes = null; state.lessonRes = null; state.lessonT = 0; state.ui.scroll = 0;
    state.toast = ''; state.toastT = 0;
    if (!resumed && !lessonDef && cfg.mode === 'ai') persistMatch();
    if (resumed) toast('Match restored. Press Resume to carry on', 3.2);
    else if (lessonDef) toast(lessonDef.how, 7);
    else if (!watch) toast(cfg.role === 'thrower' ? `Round ${m.round}: throw at the can, then fetch your slipper` : `Round ${m.round}: guard the can and tag the runners`, 3.4);
  }
  function startWatch() {
    const lv = [1, 2, 3, 4];
    const tl = lv.splice(aiRng.int(lv.length), 1)[0], hl = lv[aiRng.int(lv.length)];
    state.m = newMatchState({ mode: 'watch', role: 'watch', level: 2, rounds: 1, tl, hl });
    state.lesson = null; setNames();
    startRound(false);
  }
  function startLesson(id) {
    const def = lessonById(id);
    if (!def) return;
    if (def.kind === 'quiz') { const world = quizWorld(def); state.quiz = { def, idx: lessonIndex(id), chosen: null, correct: def.options.indexOf(def.answer(world)), world }; state.scene = 'quiz'; state.ui.scroll = 0; return; }
    state.lesson = { def, tries: 0 };
    state.m = newMatchState({ mode: 'lesson', role: def.role, level: 2, rounds: 1 });
    setNames();
    startRound(false);
  }
  const nextLesson = () => {
    const cur = state.lesson ? state.lesson.def.id : state.quiz.def.id;
    const n = LESSONS[lessonIndex(cur) + 1];
    if (n) startLesson(n.id); else { state.scene = 'learn'; state.ui.scroll = 0; state.lesson = null; }
  };

  // ---- the end of a round -------------------------------------------------------------------------------------------
    function finishRound() {
    const m = state.m, w = state.w, cfg = m.cfg, o = w.over;
    if (cfg.mode === 'watch') {
      state.roundRes = { title: 'Round over', text: o.kind === 'tag' ? `${nameOf(o.who)} was tagged by the guard.` : 'The time ran out: the guard is tired and the throwers escape.', score: 'Back to the menu when you are ready.', good: true };
      state.roundOver = true; state.ui.scroll = 0; return;
    }
    let text = '', title = '', good = true, score = '';
    if (cfg.role === 'thrower') {
      const st = w.stats[2];
      let rp = st.hits * POINTS.hit + st.safes * POINTS.safe;
      if (o.kind === 'tag' && o.who === 2) rp += POINTS.tagged;
      if (o.kind === 'timeout') rp += POINTS.timeout;
      m.pts.you += rp;
      if (o.kind === 'tag') { title = o.who === 2 ? 'You were tagged' : `${nameOf(o.who)} was tagged`; good = o.who !== 2; if (o.who === 2) m.strikes++; } else { title = 'Time! The guard is tired'; good = true; }
      text = `${o.kind === 'tag' ? (o.who === 2 ? 'The guard caught you out in the yard. ' : 'The guard caught a friend out in the yard. ') : 'Nobody was tagged in 80 seconds. '}You hit the can ${st.hits} time${st.hits === 1 ? '' : 's'} and brought ${st.safes} slipper${st.safes === 1 ? '' : 's'} home safely.`;
      score = `This round: ${rp >= 0 ? '+' : ''}${rp} points. Total ${m.pts.you}. Tagged ${m.strikes} time${m.strikes === 1 ? '' : 's'} (up to ${m.need} allowed)`;
      m.log.push({ round: m.round, text: o.kind === 'tag' ? (o.who === 2 ? 'you were tagged' : `${nameOf(o.who)} tagged`) : 'time ran out' });
    } else {
      if (o.kind === 'tag') { m.tags++; title = `You tagged ${nameOf(o.who)}!`; text = 'The can was standing and the thrower was caught out in the yard.'; good = true; } else { m.escapes++; title = 'Time! You are tired'; text = 'Nobody was tagged in 80 seconds: the throwers escape this round.'; good = false; }
      score = `Tags so far: ${m.tags} of ${m.need} needed in ${m.cfg.rounds} rounds`;
      m.log.push({ round: m.round, text: o.kind === 'tag' ? 'tagged' : 'escaped' });
    }
    if (m.round >= cfg.rounds) {
      m.over = { win: cfg.role === 'thrower' ? m.strikes <= m.need : m.tags >= m.need };
      state.record.played++;
      const wins = state.record.wins[cfg.role];
      if (m.over.win) { wins[cfg.level]++; state.record.streak++; state.record.best = Math.max(state.record.best, state.record.streak); } else state.record.streak = 0;
      clearSaved();
    }
    state.record.demoRounds = (state.record.demoRounds | 0) + 1;
    save();
    state.roundRes = { title, text, score, good };
    state.roundOver = true; state.ui.scroll = 0;
  }
  function afterRoundModal() {
    const m = state.m;
    state.roundOver = false;
    if (m.cfg.mode === 'watch') { state.scene = 'title'; state.ui.scroll = 0; return; }
    if (m.over) { if (m.over.win) sfx.win(); state.scene = 'result'; state.ui.scroll = 0; return; }
    if (state.demo && state.record.demoRounds >= DEMO_ROUND_CAP) { clearSaved(); state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    m.round++;
    startRound(false);
  }

  // ---- the human's controls ---------------------------------------------------------------------------------------------
  const youAgent = () => (state.human >= 0 ? state.w.agents.find((a) => a.id === state.human) : null);
  const fieldPoint = (cam, x, y, lift = 0) => {
    const g = cam.groundAt(x, y - lift);
    return { x: clamp(g.x, FIELD.x0 + 0.3, FIELD.x1 - 0.3), z: clamp(g.z, FIELD.z0 + 0.25, FIELD.z1 - 0.3) };
  };
  const throwReady = (you) => !!you && you.role === 'thrower' && you.hasSlip && isHome(you) && canUp(state.w) && state.w.phase === 'play' && state.w.go <= 0 && !you.tagged;
  function humanThrow() {
    const you = youAgent(), w = state.w;
    if (!you || state.paused) return;
    if (!canThrow(w, you)) { toast(you.hasSlip ? (w.go > 0 ? 'Wait for Go!' : 'Get behind the toe line to throw') : 'You need your slipper: fetch it first', 2); sfx.no(); return; }
    if (!canUp(w)) { toast('The can is down: wait until the guard stands it up', 2.2); sfx.no(); return; }
    const style = state.aim.style;
    doThrow(w, you, state.aim.x, state.aim.z, style, scatter(humanRng, HUMAN_SIG, style));
    state.hint = null; state.hl = null;
    if (state.lesson) state.lesson.tries++;
  }
  function requestHint() {
    const w = state.w, you = youAgent();
    if (!you || w.phase !== 'play' || state.m.cfg.mode === 'watch') return;
    const adv = you.role === 'taya' ? adviseTaya(w) : adviseThrower(w, you, state.aim.style);
    state.hint = adv; state.hintT = 9;
    if (adv.kind === 'throw') { state.aim.x = adv.tx; state.aim.z = adv.tz; state.aim.style = adv.style; }
    sfx.tick();
  }
  function autoTarget(you, w) {
    const a = state.auto;
    if (!a) return null;
    if (a === 'fetch') {
      if (you.hasSlip) { state.auto = 'home'; return autoTarget(you, w); }
      const s = slipOf(w, you.id);
      if (s.mode === 'rest') return { x: s.x, z: s.z };
      if (s.mode === 'fly') return { x: you.x, z: you.z };
      return null;
    }
    if (a === 'home') { if (isHome(you)) { state.auto = null; return null; } return { x: clamp(you.x * 0.8, FIELD.x0 + 0.6, FIELD.x1 - 0.6), z: -0.7 }; }
    if (a === 'fix') {
      const c = w.can;
      if (c.mode === 'up') { state.auto = null; return null; }
      if (you.carry) return { x: 0, z: CAN.z };
      return { x: c.x + c.vx * 0.15, z: c.z + c.vz * 0.15 };
    }
    if (a === 'chase') {
      const tg = bestTarget(w);
      if (!tg || w.can.mode !== 'up') { state.auto = null; return null; }
      const r = tg.a, tl = Math.min(0.7, Math.hypot(r.x - you.x, r.z - you.z) / you.speed) * 0.6;
      let gx = r.x + r.vx * tl, gz = r.z + r.vz * tl;
      if (!r.hasSlip) { const sl = slipOf(w, r.id); if (sl.mode === 'rest' && Math.hypot(sl.x - you.x, sl.z - you.z) / you.speed + 0.1 < Math.hypot(sl.x - r.x, sl.z - r.z) / r.speed) { gx = sl.x; gz = sl.z; } }
      return { x: clamp(gx, FIELD.x0 + 0.3, FIELD.x1 - 0.3), z: Math.max(LINE_Z + 0.55, gz) };
    }
    return null;
  }
  function humanTick(dt, input, lay, cam, cmds) {
    const w = state.w, you = youAgent();
    if (!you || w.phase !== 'play') { state.drag = null; return; }
    const ptr = input.pointer, keys = input.keys;
    const bar = lay.bar.rects, hudPause = lay.hud.pause;
    const ids = textScale() >= 2 ? bigBarIds(state) : null;
    const onUi = (x, y) => inRect(hudPause, x, y) || Object.values(bar).some((r) => inRect(r, x, y)) || y < lay.regionTop || y > lay.regionBottom || (lay.mode === 'wide' && !inRect(lay.region, x, y));
    if (ptr.pressed) {
      if (!inRect(hudPause, ptr.x, ptr.y)) {
        for (const [rid, r] of Object.entries(bar)) {
          if (!inRect(r, ptr.x, ptr.y)) continue;
          const id = ids && ids[rid] ? ids[rid] : rid;
          sfx.tick();
          if (id === 'sheet') { openSheet(); break; }
          if (id === 'lob' || id === 'skim') state.aim.style = id;
          else if (id === 'think') requestHint();
          else if (id === 'throw') humanThrow();
          else if (id === 'fetch' && !you.hasSlip) { state.auto = state.auto === 'fetch' ? null : 'fetch'; you.mx = null; you.mz = null; }
          else if (id === 'home' && !isHome(you)) { state.auto = state.auto === 'home' ? null : 'home'; you.mx = null; you.mz = null; }
          else if (id === 'fix' && w.can.mode !== 'up') { state.auto = state.auto === 'fix' ? null : 'fix'; you.mx = null; you.mz = null; }
          else if (id === 'chase' && w.can.mode === 'up') { state.auto = state.auto === 'chase' ? null : 'chase'; you.mx = null; you.mz = null; }
        }
      }
      if (!onUi(ptr.x, ptr.y)) state.drag = { mode: you.role === 'thrower' && throwReady(you) ? 'aim' : 'move', lx: ptr.x, ly: ptr.y };
    }
    // steering by finger; a second finger landing elsewhere makes the single pointer jump: such a jump is ignored
    if (state.drag) {
      if (!ptr.down) state.drag = null;
      else if (Math.hypot(ptr.x - state.drag.lx, ptr.y - state.drag.ly) <= 320) {
        state.drag.lx = ptr.x; state.drag.ly = ptr.y;
        if (state.drag.mode === 'aim') {
          const p = fieldPoint(cam, ptr.x, ptr.y, 56);
          state.aim.x = clamp(p.x, -1.7, 1.7); state.aim.z = clamp(p.z, CAN.z - 1.5, CAN.z + 1.5);
          // a magnet: a finger that lands near the can puts the ring exactly on its middle
          if (Math.hypot(state.aim.x, state.aim.z - CAN.z) < 0.4) { state.aim.x = 0; state.aim.z = CAN.z; }
        } else {
          let p = fieldPoint(cam, ptr.x, ptr.y, 0);
          if (you.role === 'thrower' && !you.hasSlip) { const sl = slipOf(w, you.id); if (sl.mode === 'rest' && Math.hypot(sl.x - p.x, sl.z - p.z) < 0.55) p = { x: sl.x, z: sl.z }; }   // a touch near your slipper goes to it
          state.auto = null; cmds[you.id] = { mx: p.x, mz: you.role === 'taya' ? Math.max(LINE_Z + 0.55, p.z) : p.z };
        }
      }
    }
    if (you.role === 'thrower') {
      const k = 0.04;
      if (keys.down.has('ArrowLeft')) state.aim.x = clamp(state.aim.x - k, -1.7, 1.7);
      if (keys.down.has('ArrowRight')) state.aim.x = clamp(state.aim.x + k, -1.7, 1.7);
      if (keys.down.has('ArrowUp')) state.aim.z = clamp(state.aim.z + k, CAN.z - 1.5, CAN.z + 1.5);
      if (keys.down.has('ArrowDown')) state.aim.z = clamp(state.aim.z - k, CAN.z - 1.5, CAN.z + 1.5);
      if (keys.pressed.has('Space') || keys.pressed.has('Enter')) humanThrow();
      if (keys.pressed.has('KeyQ')) state.aim.style = state.aim.style === 'lob' ? 'skim' : 'lob';
      if (keys.pressed.has('KeyF') && !you.hasSlip) state.auto = 'fetch';
      if (keys.pressed.has('KeyR') && !isHome(you)) state.auto = 'home';
    } else {
      let dx = 0, dz = 0;
      if (keys.down.has('ArrowLeft')) dx -= 1;
      if (keys.down.has('ArrowRight')) dx += 1;
      if (keys.down.has('ArrowUp')) dz += 1;
      if (keys.down.has('ArrowDown')) dz -= 1;
      if (dx || dz) { state.auto = null; cmds[you.id] = { mx: clamp(you.x + dx * 1.2, FIELD.x0 + 0.3, FIELD.x1 - 0.3), mz: Math.max(LINE_Z + 0.55, you.z + dz * 1.2) }; }
      if (keys.pressed.has('KeyF') && w.can.mode !== 'up') state.auto = 'fix';
      if (keys.pressed.has('KeyC') && w.can.mode === 'up') state.auto = 'chase';
    }
    if (keys.pressed.has('KeyH')) requestHint();
    // assist: the guard fetches a fallen can when the player is not steering
    if (you.role === 'taya') {
      if (state.settings.assist && w.can.mode !== 'up' && !state.drag && !state.auto && w.go <= 0) { state.idleT += dt; if (state.idleT > 0.35) { state.auto = 'fix'; state.idleT = 0; } } else state.idleT = 0;
    }
    if (!cmds[you.id] && state.auto) { const t = autoTarget(you, w); if (t) cmds[you.id] = { mx: t.x, mz: t.z }; }
    state.humanTurnAim = throwReady(you);
  }

  // ---- Watch & Learn: think, reveal, act -----------------------------------------------------------------------------------
  function gate(kind, a, info) {
    const w = state.w, key = `${kind}:${a.id}`;
    if (state.thinkOk === key) { state.thinkOk = null; return true; }
    if (state.think) return false;
    let ex;
    if (kind === 'throw') ex = explainThrow(w, a, nameOf(a.id), info.style);
    else if (kind === 'dash') ex = explainDash(w, a, nameOf(a.id));
    else ex = explainTaya(w, nameOf(a.id), info.mode);
    state.think = { key, kind, id: a.id, t: 0, dur: THINK_STEPS[state.settings.thinkIdx], phase: 'think', ex };
    state.card = { title: ex.title, reveal: false };
    state.hint = null; state.hl = a.id;
    return false;
  }
  function updateThink(dt) {
    const th = state.think;
    th.t += dt;
    if (th.phase === 'think' && th.t >= th.dur) {
      th.phase = 'reveal'; th.t = 0; th.dur = 2;
      state.card = { title: th.ex.title, reveal: true };
      state.hint = { mark: th.ex.mark };
    } else if (th.phase === 'reveal' && th.t >= th.dur) {
      state.thinkOk = th.key; state.think = null; state.card = null; state.hint = null; state.hl = null;
    }
  }

  // ---- the play scene ------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const openSheet = () => { state.sheet = true; state.paused = true; state.drag = null; state.ui.scroll = 0; };
  const closeSheet = () => { state.sheet = false; state.paused = false; state.ui.scroll = 0; };
  function handleSheetTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'sty-lob') state.aim.style = 'lob';
    else if (id === 'sty-skim') state.aim.style = 'skim';
    else if (id === 'sh-done') closeSheet();
    else if (id === 'sh-think') { closeSheet(); requestHint(); }
    else if (id === 'sh-menu') { state.sheet = false; openPause(); }
  }
  const leaveMatch = () => {
    const wasLesson = !!state.lesson;
    state.scene = wasLesson ? 'learn' : 'title'; state.paused = false; state.pauseMenu = false; state.roundOver = false; state.ui.scroll = 0;
    state.think = null; state.drag = null; state.card = null; state.lesson = null; state.hint = null; state.auto = null; state.lessonRes = null; state.reasonOpen = false; state.sheet = false;
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
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.ui.scroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.ui.scroll = 0; }
    else if (id === 'p-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); save(); }
    else if (id === 'p-guide') { st.guide = (st.guide + 1) % 3; save(); }
    else if (id === 'p-txtdec') { st.textIdx = Math.max(0, st.textIdx - 1); save(); resetMenus(); }
    else if (id === 'p-txtinc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); save(); resetMenus(); }
    else if (id === 'quit') leaveMatch();
  }
  function lessonCheck() {
    const def = state.lesson.def, w = state.w, you = youAgent();
    if (state.lessonRes) { state.lessonT += DT; return; }
    const r = def.check(w, you);
    if (r) {
      state.lessonRes = r; state.lessonT = 0;
      if (r.ok) { state.learn.done[def.id] = true; save(); sfx.win(); } else sfx.no();
    }
  }

  function simStep(dt, input, lay, cam) {
    const w = state.w, m = state.m;
    const watch = m.cfg.mode === 'watch', lesson = m.cfg.mode === 'lesson';
    const cmds = {};
    if (w.phase === 'play') {
      if (!watch) humanTick(dt, input, lay, cam, cmds);
      const skip = new Set();
      if (state.human >= 0) skip.add(state.human);
      if (lesson) for (const a of w.agents) if (!state.lesson.def.active.includes(a.id)) skip.add(a.id);
      aiStep(w, state.br, aiRng, skip, dt, cmds, watch ? gate : null);
      if (watch) { state.thinkOk = null; if (state.think) { state.thinkFreeze = true; return; } }
    }
    const ev = stepWorld(w, cmds);
    state.stepped = true;
    handleEvents(w, state.fx, ev, true);
    for (const e of ev) {
      if (e.k === 'hit') {
        if (state.human === 0) toast('The can is down: fix it before you tag anyone', 2.6);
        else if (state.human >= 0) toast(e.id === state.human ? 'You hit it! Run for your slipper' : 'Can down: run for your slipper', 2.6);
      } else if (e.k === 'erect' && state.human === 2) toast('The can is standing again: only run if you can get home in time', 2.6);
      else if (e.k === 'tag' && state.human === 0) toast(`Tagged ${nameOf(e.id)}!`, 2.4);
    }
    if (w.phase === 'play' && w.go <= 0 && w.t > 0 && w.t < DT * 1.5) sfx.go();
  }

  function updatePlay(dt, input) {
    const m = state.m, ptr = input.pointer, keys = input.keys;
    const lay = layoutFor(state);
    const cam = camFor(state, lay);
    state.cam = { lay };
    if (config.dev && keys.pressed.has('KeyK') && state.w.phase === 'play') state.w.limit = 1;
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) {
      if (state.pauseMenu) closePause(); else if (state.sheet) closeSheet(); else if (state.reasonOpen) state.reasonOpen = false; else if (state.roundOver) { /* the summary is modal */ } else if (m.cfg.mode === 'watch') state.paused = !state.paused; else openPause();
    }
    if (state.pauseMenu) { modalInput(ptr, 'pause', handlePauseTap); return; }
    if (state.sheet) { modalInput(ptr, 'sheet', handleSheetTap); return; }
    if (state.reasonOpen) { modalInput(ptr, 'reason', (id) => { if (id === 'reason-close') { state.reasonOpen = false; sfx.tick(); } }); return; }
    if (state.roundOver) { modalInput(ptr, 'roundover', (id) => { if (id === 'round-next') { sfx.tick(); afterRoundModal(); } }); return; }
    if (state.lessonRes && state.lessonT > 0.8) { modalInput(ptr, 'lessonres', handleLessonTap); return; }
    if (ptr.pressed && state.cardRect && inRect(state.cardRect, ptr.x, ptr.y)) { state.reasonOpen = true; state.ui.scroll = 0; sfx.tick(); return; }
    if (ptr.pressed) {
      if (inRect(lay.hud.pause, ptr.x, ptr.y)) { if (m.cfg.mode === 'watch') state.paused = !state.paused; else openPause(); sfx.tick(); return; }
      if (m.cfg.mode === 'watch') {
        const b = lay.bar.rects;
        if (inRect(b.wpause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(b.wdec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(b.winc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(b.wexit, ptr.x, ptr.y)) { leaveMatch(); return; }
      }
    }
    if (state.paused) return;
    // everything below is the live round; nothing advances while paused (timers, AI, effects, in-flight objects)
    state.thinkFreeze = false;
    if (state.toastT > 0) state.toastT -= dt;
    if (state.hintT > 0) { state.hintT -= dt; if (state.hintT <= 0) state.hint = null; }
    if (m.cfg.mode === 'watch' && state.think) updateThink(dt);
    else simStep(dt, input, lay, cam);
    stepFx(state.fx, state.w, state.thinkFreeze || state.think ? 0 : dt);
    const w = state.w;
    if (state.lesson) lessonCheck();
    if (w.phase === 'over' && !state.lesson && !state.roundOver) {
      const delay = w.over.kind === 'tag' ? 1.5 : 0.9;
      if (w.overT > delay) finishRound();
    }
  }
  function handleLessonTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'les-next') nextLesson();
    else if (id === 'les-again') startLesson(state.lesson.def.id);
    else if (id === 'les-list') leaveMatch();
  }

  // ---- menus ----------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { pressLockup(); env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'resume') resumeMatch();
    else if (id === 'play') { state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'learn') { state.scene = 'learn'; state.ui.scroll = 0; }
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.ui.scroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('role-')) s.role = id.slice(5);
    else if (id.startsWith('lvl')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.level = i; state.setupMsg = ''; }
    else if (id.startsWith('rounds')) s.rounds = Number(id.slice(6));
    else if (id === 'lesson') startLesson(s.role === 'taya' ? 'fix' : 'throw');
    else if (id === 'start') startMatch({ mode: 'ai', role: s.role, level: s.level, rounds: s.rounds });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-guide') st.guide = (st.guide + 1) % 3;
    else if (id === 'set-haptics') { st.haptics = !st.haptics; buzz(25); }
    else if (id === 'set-assist') st.assist = !st.assist;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
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
    if (id === 'again') startMatch({ mode: 'ai', role: cfg.role, level: cfg.level, rounds: cfg.rounds });
    else if (id === 'new') { state.setup.role = cfg.role; state.setup.level = cfg.level; state.setup.rounds = cfg.rounds; state.scene = 'setup'; state.ui.scroll = 0; }
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
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); resetMenus(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); resetMenus(); }
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
  const updatePages = (input, list, header) => {
    const ptr = input.pointer, keys = input.keys;
    ensureReader(state, list, header);
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.ui.scroll = 0; state.ui.drag = null; };
    const setSize = (d) => { state.settings.textIdx = clamp(state.settings.textIdx + d, 0, TEXT_SCALES.length - 1); state.ui.scroll = 0; save(); };
    if (ptr.pressed) {
      if (inRect(REF_CLOSE, ptr.x, ptr.y)) { close(); return; }
      if (inRect(TEXT_DEC, ptr.x, ptr.y)) { setSize(-1); return; }
      if (inRect(TEXT_INC, ptr.x, ptr.y)) { setSize(1); return; }
      state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
    }
    const max = readerMax();
    if (state.ui.drag && ptr.down) { const d = state.ui.drag; d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
    if (!ptr.down) state.ui.drag = null;
    if (keys.down.has('ArrowDown')) state.ui.scroll += 16;
    if (keys.down.has('ArrowUp')) state.ui.scroll -= 16;
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) state.ui.scroll += 700;
    if (keys.pressed.has('PageUp')) state.ui.scroll -= 700;
    if (keys.pressed.has('Home')) state.ui.scroll = 0;
    if (keys.pressed.has('End')) state.ui.scroll = max;
    if (keys.pressed.has('Equal') || keys.pressed.has('NumpadAdd')) setSize(1);
    if (keys.pressed.has('Minus') || keys.pressed.has('NumpadSubtract')) setSize(-1);
    if (keys.pressed.has('Escape')) { close(); return; }
    state.ui.scroll = clamp(state.ui.scroll, 0, max);
  };

  // ---- showcase (store screenshots: ?shot=1 plays a scripted, real position instead of the random player) ------------
  const BLANK = () => ({ pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } });
  function setupShowcase(kind) {
    state.shotMode = { kind, tick: 0 };
    if (kind === 5) { startWatch(); state.settings.thinkIdx = 0; return; }
    startMatch({ mode: 'ai', role: kind === 4 ? 'taya' : 'thrower', level: 2, rounds: 3 });
    state.toastT = 0;
  }
  function showcaseStep() {
    const sm = state.shotMode, k = sm.kind, w = state.w;
    sm.tick++;
    if (!w || k === 5 || k === 4) return;
    const you = youAgent();
    if (k === 0) { if (sm.tick === 2) { state.aim.style = 'lob'; state.aim.x = 0.05; state.aim.z = CAN.z; state.hint = adviseThrower(w, you, 'lob'); state.hintT = 99; } return; }
    if (sm.tick === 90 && you.hasSlip) { state.aim.style = k === 1 ? 'lob' : 'skim'; doThrow(w, you, 0, CAN.z, state.aim.style, { dx: 0, dz: 0, dT: 0 }); }
    if (k === 3 && w.can.mode !== 'up' && you && !you.hasSlip && !state.auto) state.auto = 'fetch';
  }

  // The screen can change shape at any time (rotation, split screen). Everything is laid out from the live size; the match, the
  // round and every menu position are untouched, only a finger that was down is let go.
  let lastSize = '';
  const syncSize = () => {
    setSize(meta.width, meta.height);
    const k = sizeKey();
    if (k === lastSize) return;
    if (lastSize) { state.drag = null; state.ui.drag = null; resetMenus(); }
    lastSize = k;
  };
  syncSize();
  // wall-clock drawing helpers stay out of the enumerable state (hashes and saves never see them)
  for (const k of ['alpha', 'updAt', 'stepped', 'thinkFreeze', 'cardRect', 'cardFull']) Object.defineProperty(state, k, { value: undefined, writable: true, enumerable: false });
  startAttract();
  resetMenus();
  if (SHOT_MODE) {
    setupShowcase((Number(config.seed) | 0) % 6);
    const q = (kk) => { try { const mm = new RegExp(`[?&]${kk}=([a-z0-9]+)`).exec(globalThis.location.search); return mm ? mm[1] : null; } catch { return null; } };
    if (q('zoom')) state.settings.textIdx = clamp(Number(q('zoom')) | 0, 0, 4);
    const v = q('view');
    if (v) {
      state.shotMode = v === 'pause' || v === 'roundover' || v === 'sheet' ? state.shotMode : null;
      if (v === 'pause') openPause();
      else if (v === 'sheet') openSheet();
      else if (v === 'roundover') { state.m.round = 2; state.roundRes = { title: 'You were tagged', text: 'The guard caught you out in the yard. You hit the can 1 time and brought 0 slippers home safely.', score: 'This round: -2 points. Total 3. Tagged 1 time (up to 1 allowed)', good: false }; state.roundOver = true; state.shotMode = null; }
      else if (v === 'result') { state.m.over = { win: true }; state.m.pts = { you: 11 }; state.m.strikes = 1; state.m.log = [{ round: 1, text: 'Pia tagged' }, { round: 2, text: 'time ran out' }, { round: 3, text: 'You tagged' }]; state.scene = 'result'; }
      else if (v === 'quiz') startLesson('race');
      else if (v === 'lesson') startLesson('run');
      else if (v === 'rules' || v === 'about' || v === 'howto') { state.scene = v; state.back = 'title'; state.ui.scroll = Number(q('scroll')) | 0; }
      else if (v === 'watch') { startWatch(); state.shotMode = null; }
      else state.scene = v;
    }
    const adv = Number(q('ticks')) | 0;   // review aid: play this many fixed steps before the first frame
    if (adv > 0 && state.scene === 'play') {
      const blank = BLANK();
      for (let i = 0; i < adv; i++) { state.t += DT; if (state.shotMode) showcaseStep(); updatePlay(DT, blank); }
    }
  }

  return {
    // Watch & Learn, lessons and every menu are free; only real play counts against the free preview (a paused round does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode === 'ai' && !state.roundOver && state.w && state.w.phase === 'play' && state.w.go <= 0) || state.paused || state.reasonOpen || state.sheet,
    update(dt, input) {
      syncSize();
      state.stepped = false; state.updAt = nowMs();
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') updateAttract();
      if (state.shotMode) {
        showcaseStep();
        if (state.scene === 'play') updatePlay(dt, BLANK());
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
        case 'howto': updatePages(input, HOWTO, 'How to Play'); break;
        case 'about': updatePages(input, ABOUT, 'About'); break;
        case 'rules': updatePages(input, RULES, 'Rules'); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      syncSize();
      state.alpha = state.stepped && env.clock ? Math.max(0, Math.min(1, (nowMs() - state.updAt) / (DT * 1000))) : 1;
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
          if (state.m && state.w) renderPlay(ctx, state);
          if (state.pauseMenu) renderPause(ctx, state);
          else if (state.sheet) renderSheet(ctx, state);
          else if (state.reasonOpen) renderReason(ctx, state);
          else if (state.roundOver) renderRoundOver(ctx, state);
          else if (state.lessonRes && state.lessonT > 0.8) renderLessonResult(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    // Check scripts only: every tappable rectangle on the screen right now (ui: true) plus the big areas (ui: false).
    debugRects() {
      const out = [], add = (n, r, ui = true) => { if (r) out.push({ n, x: r.x, y: r.y, w: r.w, h: r.h, ui }); };
      const mt = flowMeta();
      const flow = () => { if (mt.lay) for (const it of mt.lay.items) if (it.w.t === 'btn') { const y = mt.top + it.y - state.ui.scroll; if (y >= mt.top - 1 && y + it.h <= mt.bottom + 1) add(`btn:${it.w.id}`, { x: it.x, y, w: it.wd, h: it.h }); } };
      if (state.scene === 'play' && state.m && state.w) {
        const lay = layoutFor(state);
        add('pause', lay.hud.pause); for (const [id, r] of Object.entries(lay.bar.rects)) add(`bar:${id}`, r);
        add('yard', lay.region, false); if (lay.cards) { add('leftCard', lay.cards.left, false); add('rightCard', lay.cards.right, false); }
        if (state.pauseMenu || state.sheet || state.reasonOpen || state.roundOver || (state.lessonRes && state.lessonT > 0.8)) { out.length = 0; flow(); }
      } else if (state.scene === 'howto' || state.scene === 'about' || state.scene === 'rules') {
        const g = readerGeo(); add('textDec', g.textDec); add('textInc', g.textInc); add('close', g.close); add('panel', g.panel, false);
      } else { flow(); if (state.scene === 'setup') { const p = setupPinsGeo(); add('start', p.start); add('back', p.back); } }
      return out;
    },
    debugHost: () => ({ ...host }),
    // mouse wheel / trackpad: scrolls whatever long screen is showing
    wheel(dy) {
      const reader = state.scene === 'howto' || state.scene === 'about' || state.scene === 'rules';
      const mt = flowMeta();
      const max = reader ? readerMax() : mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
      state.ui.scroll = clamp(state.ui.scroll + dy, 0, max);
    },
  };
}
