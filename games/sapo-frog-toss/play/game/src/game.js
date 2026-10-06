// Sapo: state and flow. Rules live in engine.js, the physics in phys.js, the opponents and the Think hint in ai.js, the table scene in
// scene.js, the play screen in view.js, every other screen in menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, learn, play (also Watch & Learn and the lessons), result, howto / about / rules, demolimit.
// Play phases: intro, aim (a person plans the throw), think (a computer plans it), fly (the disc is in the air and on the table),
// settle (the throw is scored), roundend (the Closest bonus), clear.
import { W, H, TEXT_SCALES, THINK_STEPS, REVEAL_SECS, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, SETUP_PINS, PULL, inRect, SCENE_Y0, frameFor, setStage, host, screen } from './layout.js';
import { DT, newSim, stepSim, snapSim, launchDisc, runThrow, resting, closestDisc, newDisc, MOUTH, HOLES, planPath, TD, HW } from './phys.js';
import { newMatch, applyThrow, tableDiscs, turnSide, leftFor, DISCS, LENGTHS, CLOSEST_BONUS } from './engine.js';
import { PROFILES, ASSIST, makeJob, choose, wobble, explain, holeName, pname } from './ai.js';
import { onTablePlane, TAU } from './scene.js';
import { renderPlay, computeLayout, playFrame, sideName, statusText, whyTitle, phaseLine } from './view.js';
import { pressLockup } from './brand.js';
import { renderTitle, renderSetup, renderSettings, renderLearn, renderResult, renderPause, renderSheet, renderWhy, renderPages, renderDemoLimit, hitScreen, flowMeta, refMeta, ensureLayout, invalidateLayout } from './menus.js';
import { ABOUT, HOWTO, RULES, LESSONS } from './content.js';
import { setPress } from './ui.js';
import { tr, pick, setLang, getLang } from './i18n.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_MATCH_CAP = 2;
const STEP = 1 / 60;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_PARTS = 160;
const AX_MAX = 0.42, AZ_MIN = 0.05, AZ_MAX = 0.87;
const DEFAULT_PLAN = () => ({ ax: 0, az: 0.5, spin: 0, style: 0 });
const ATTRACT = [{ ax: 0.0, az: 0.5, spin: 0, style: 0 }, { ax: -0.3, az: 0.42, spin: 0, style: 0 }, { ax: 0.28, az: 0.12, spin: 0, style: 0 }, { ax: 0.1, az: 0.6, spin: 1, style: 1 }, { ax: 0.0, az: 0.29, spin: 0, style: 0 }, { ax: -0.2, az: 0.36, spin: -1, style: 1 }];

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork(), hand = rng.fork(), aiR = rng.fork();
  const rn = () => aiR.next(), hn = () => hand.next();
  const nowMs = () => (env.clock ? env.clock() : 0);   // display clock from the shell (drawing only); absent in headless runs (alpha stays 1)
  let shotMode = false;
  try { shotMode = /[?&]shot=/.test(globalThis.location.search); } catch { shotMode = false; }
  const query = (k) => { try { const m = new RegExp(`[?&]${k}=([a-z0-9]+)`).exec(globalThis.location.search); return m ? m[1] : null; } catch { return null; } };
  const shotSeed = config.seed | 0;
  // The kit has a single pointer: a second finger would make it jump and its lift would end the pull. So every touch that is not the
  // primary one is dropped in the capture phase, before the kit's canvas listeners ever see it.
  try {
    if (typeof globalThis.addEventListener === 'function' && !shotMode) {
      const dropStray = (e) => { if (e.pointerType === 'touch' && e.isPrimary === false) e.stopImmediatePropagation(); };
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) globalThis.addEventListener(type, dropStray, true);
    }
  } catch { /* no DOM (headless): nothing to guard */ }
  let hintJob = null, aiJob = null;

  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, assist: 1, textIdx: 0, thinkIdx: 1, lang: 'en' },
    record: { played: 0, wins: [0, 0, 0, 0, 0], learn: 0, mouths: 0, bestTotal: 0, demoMatches: 0, throws: 0 },
    setup: { mode: 'ai', opp: 0, len: 0 }, setupMsg: '', restoreMsg: '',
    ui: { scroll: 0, drag: null }, page: 0, resume: null, loaded: false,
    m: null, ph: 'intro', pt: 0, humanTurn: false, plan: DEFAULT_PLAN(), plans: [DEFAULT_PLAN(), DEFAULT_PLAN()],
    sim: newSim([], null), show: [], simT: 0, overlay: null, parts: [], banner: null, toast: '', toastT: 0, holeFlash: {}, hl: null, closestLine: null, fade: 0,
    why: null, hint: null, think: null, drag: null, sheet: false, fast: false, thinkSecs: 5, acc: 0, pullHintT: 6, lastThrow: null,
    shot: false, showcase: false, sfxQ: [],
    att: { sim: null, parts: [], flash: {}, wait: 0, n: 0, table: [], acc: 0, id: 500 },
  };
  for (const k of ['alpha', 'updAt', 'stepped']) Object.defineProperty(state, k, { value: k === 'alpha' ? 1 : k === 'stepped' ? false : 0, writable: true, enumerable: false });
  state.show = state.sim.discs;
  const record = state.record;

  // ---- persistence ---------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  const saveResume = () => {
    const m = state.m;
    if (!m || m.cfg.mode === 'watch' || m.cfg.mode === 'learn') return;
    if (m.over) { clearResume(); return; }
    state.resume = JSON.parse(JSON.stringify(m));
    storage.set('resume', state.resume);
  };
  const clearResume = () => { state.resume = null; storage.remove('resume'); };
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  const num = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
  const validResume = (r) => !!r && !!r.cfg && (r.cfg.mode === 'ai' || r.cfg.mode === 'two') && int(r.cfg.len, 0, 2) && (r.cfg.mode === 'two' || int(r.cfg.opp, 0, PROFILES.length - 1))
    && int(r.rounds, 1, 6) && r.rounds === LENGTHS[r.cfg.len].rounds && int(r.round, 0, r.rounds - 1) && int(r.idx, 0, 2 * DISCS - 1) && (r.starter === 0 || r.starter === 1) && !r.over
    && Array.isArray(r.scores) && r.scores.length === 2 && r.scores.every((v) => Number.isFinite(v) && v >= 0 && v < 100000)
    && Array.isArray(r.discs) && r.discs.length <= 2 * DISCS && r.discs.every((d) => d && int(d.id, 1, 100000) && (d.owner === 0 || d.owner === 1) && num(d.x, -HW, HW) && num(d.z, 0, TD))
    && int(r.nextId, 1, 100000) && Array.isArray(r.stats) && r.stats.length === 2 && Array.isArray(r.log) && r.log.length <= 100 && Array.isArray(r.bonus);
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('resume', null)]).then(([s, r, res]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const st = state.settings;
    st.textIdx = clamp(st.textIdx | 0, 0, TEXT_SCALES.length - 1);
    st.thinkIdx = clamp(st.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    st.assist = clamp(st.assist | 0, 0, ASSIST.length - 1);
    st.lang = st.lang === 'es' ? 'es' : 'en';
    if (!langForced) setLang(st.lang);
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 5) state.record.wins = [0, 0, 0, 0, 0];
    if (validResume(res) && !shotMode) state.resume = res;
    state.loaded = true; invalidateLayout();
    audio.setMuted?.(!st.sound);
  }).catch(() => { state.loaded = true; });
  const langForced = shotMode;
  if (shotMode && query('lang')) setLang(query('lang'));
  const chooseLang = (l) => { state.settings.lang = l; setLang(l); invalidateLayout(); save(); };

  // ---- sound ---------------------------------------------------------------------------------------
  let toneBudget = 0;
  const tone = (o) => { if (state.settings.sound && toneBudget < 8) { toneBudget++; audio.tone(o); } };
  const queue = (delay, fn) => { state.sfxQ.push({ t: delay, fn }); };
  const sfx = {
    whoosh: () => tone({ freq: 520, to: 140, dur: 0.32, type: 'sawtooth', vol: 0.025 }),
    clink: (s = 1) => { const f = 2300 + fx.next() * 900; tone({ freq: f, to: f * 0.93, dur: 0.11, type: 'triangle', vol: 0.05 * Math.min(1.4, s) }); tone({ freq: f * 1.51, to: f * 1.4, dur: 0.07, type: 'sine', vol: 0.03 * Math.min(1.4, s) }); },
    thud: (s = 1) => tone({ freq: 150, to: 70, dur: 0.1, type: 'sine', vol: 0.12 * Math.min(1.3, 0.4 + s * 0.3) }),
    clank: (s = 1) => { tone({ freq: 880, to: 500, dur: 0.14, type: 'square', vol: 0.035 * Math.min(1.4, s) }); tone({ freq: 190, to: 110, dur: 0.14, type: 'sine', vol: 0.16 }); },
    rattle: (n = 3, s = 1) => { for (let i = 0; i < n; i++) queue(0.045 * (i + 1), () => tone({ freq: 2000 + fx.next() * 1200, to: 1500, dur: 0.04, type: 'triangle', vol: 0.035 * s * (1 - i / (n + 1)) })); },
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    drop: () => { tone({ freq: 900, to: 260, dur: 0.18, type: 'sine', vol: 0.11 }); queue(0.16, () => tone({ freq: 240, to: 130, dur: 0.16, type: 'triangle', vol: 0.1 })); },
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.12 }),
    floor: () => { tone({ freq: 220, to: 120, dur: 0.12, type: 'triangle', vol: 0.08 }); sfx.rattle(4, 0.8); },
    big: () => [0, 4, 7, 12, 16].forEach((n, i) => queue(i * 0.07, () => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.26, type: 'triangle', vol: 0.11 }))),
    win: () => [0, 2, 4, 7, 9, 12].forEach((n, i) => queue(i * 0.09, () => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.3, type: 'triangle', vol: 0.1 }))),
  };
  const toast = (text, secs = 2.2) => { state.toast = text; state.toastT = secs; };
  const showBanner = (text, sub = '', kind = '', dur = 1.7, size = 76) => { state.banner = { text, sub, kind, t: 0, dur, size }; };

  // ---- particles (localised sparks, rings and floating scores: the table itself never moves) ------------------------
  const addPart = (list, p) => { if (list.length < MAX_PARTS) list.push({ t: 0, vx: 0, vy: 0, vz: 0, ...p }); };
  const sparks = (list, x, z, n, power = 1, y = 0.03) => { for (let i = 0; i < n; i++) { const a = fx.next() * TAU; addPart(list, { k: 'spark', x, y, z, vx: Math.cos(a) * (0.25 + fx.next() * 0.8) * power, vy: 0.5 + fx.next() * 1.4 * power, vz: Math.sin(a) * (0.25 + fx.next() * 0.8) * power, size: 0.006 + fx.next() * 0.004, max: 0.28 + fx.next() * 0.3 }); } };
  const dust = (list, x, z, n) => { for (let i = 0; i < n; i++) addPart(list, { k: 'dust', x: x + (fx.next() - 0.5) * 0.04, y: 0.015, z: z + (fx.next() - 0.5) * 0.04, vx: (fx.next() - 0.5) * 0.3, vy: 0.15 + fx.next() * 0.2, vz: (fx.next() - 0.5) * 0.3, size: 0.012 + fx.next() * 0.01, max: 0.4 + fx.next() * 0.3, col: '#e6c89a' }); };
  const stepParts = (list, dt) => {
    for (const p of list) {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.k === 'spark') { p.vy -= 6 * dt; if (p.y < 0.004) { p.y = 0.004; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; } } else if (p.k === 'dust') { p.vx *= 0.95; p.vz *= 0.95; }
    }
    return list.filter((p) => p.t < p.max);
  };
  const stepFlash = (fl, dt) => { for (const k of Object.keys(fl)) { fl[k] -= dt * 1.6; if (fl[k] <= 0) delete fl[k]; } };

  // ---- who is who -------------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const isAI = (side) => mode() === 'watch' || (mode() === 'ai' && side === 1);
  const profOf = (side) => (mode() === 'watch' ? PROFILES[side === 0 ? state.m.cfg.watchA : state.m.cfg.opp] : PROFILES[state.m.cfg.opp]);
  const humanSigma = () => ASSIST[state.settings.assist].sigma;

  // ---- match flow ---------------------------------------------------------------------------------------------------
  const lessonTable = (L) => L.table.map((d, i) => ({ id: 100 + i, owner: d.owner, x: d.x, z: d.z, ang: 0 }));
  const setTable = () => { state.sim = newSim(tableDiscs(state.m), null); state.show = state.sim.discs; state.simT = 0; };
  const beginTurn = (intro) => {
    const m = state.m, side = turnSide(m);
    state.humanTurn = !isAI(side);
    state.plan = { ...(state.plans[side] ?? DEFAULT_PLAN()) };
    if (mode() === 'learn') m.discs = lessonTable(m.lesson);
    setTable();
    state.hl = null; state.closestLine = null; state.fade = 0;
    state.hint = null; hintJob = null; state.think = null; aiJob = null; state.sheet = false; state.why = null; state.drag = null;
    state.pt = 0; state.fast = false; state.parts = [];
    state.ph = intro ? 'intro' : state.humanTurn ? 'aim' : 'think';
    if (state.ph === 'think') startThink();
  };
  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch') {
      if (record.demoMatches >= DEMO_MATCH_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
      cfg = { ...cfg, len: 0 };
    }
    const first = cfg.first ?? aiR.int(2);
    state.m = newMatch({ mode: 'ai', opp: 0, len: 0, watchA: 1, ...cfg, first });
    if (state.demo && cfg.mode !== 'watch') { record.demoMatches++; save(); }
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.plans = [DEFAULT_PLAN(), DEFAULT_PLAN()]; state.parts = []; state.pullHintT = 6;
    showBanner(tr('Round 1', 'Ronda 1'), `${tr('Each side throws', 'Cada lado lanza')} ${DISCS}`, '', 1.5, 84);
    beginTurn(true);
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
    state.scene = 'play'; state.ui.scroll = 0; state.plans = [DEFAULT_PLAN(), DEFAULT_PLAN()]; state.parts = []; state.banner = null;
    beginTurn(false);
    state.paused = true; state.pauseMenu = true;   // a resumed match starts paused
  };
  const startLesson = (idx) => {
    const L = LESSONS[idx];
    const m = newMatch({ mode: 'learn', len: 0, first: 0 });
    m.lesson = { idx, title: pick(L.title), text: pick(L.text), tries: L.tries, used: 0, got: 0, passed: false, goal: L.goal, table: L.table };
    state.m = m; state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.plans = [DEFAULT_PLAN(), DEFAULT_PLAN()]; state.parts = []; state.banner = null;
    beginTurn(true);
  };

  // ---- the throw ------------------------------------------------------------------------------------------------------
  const launch = (plan, sigma, rnd) => {
    const m = state.m, side = turnSide(m);
    const real = wobble(plan, sigma, rnd);
    real.ax = clamp(real.ax, -HW + 0.02, HW - 0.02); real.az = clamp(real.az, 0.02, TD - 0.02);
    const id = m.nextId++;
    state.thrownId = id;
    state.lastThrow = { plan: { ...plan }, id };
    state.sim = newSim(tableDiscs(m), launchDisc(id, side, real)); state.show = state.sim.discs; state.simT = 0;
    state.ph = 'fly'; state.pt = 0; state.hint = null; hintJob = null; state.sheet = false; state.fast = false; state.acc = 0;
    state.plans[side] = { ...plan };
    state.overlay = null; state.hl = null; state.banner = null; state.think = null;
    sfx.whoosh();
    if (state.humanTurn && mode() !== 'watch') record.throws = (record.throws | 0) + 1;
  };
  const doThrow = () => { if (state.ph === 'aim' && state.humanTurn) launch(state.plan, humanSigma(), hn); };
  const handleEvents = (sim, list) => {
    for (const e of sim.events) {
      if (e.k === 'land') { dust(list, e.x, e.z, 2); sparks(list, e.x, e.z, e.s > 1.5 ? 3 : 1, 0.6); if (e.s > 0.9) { sfx.thud(e.s); sfx.clink(0.6); } else sfx.rattle(2, 0.7); }
      else if (e.k === 'clink') { sparks(list, e.x, e.z, 7, 1); sfx.clink(1 + e.s * 0.3); sfx.rattle(3, 0.8); }
      else if (e.k === 'board') { sparks(list, e.x, e.z, 5, 1, 0.1); sfx.clank(1); }
      else if (e.k === 'frog') { sparks(list, e.x, e.z, 5, 0.9, 0.08); sfx.clank(0.8 + e.s * 0.2); }
      else if (e.k === 'floor') sfx.floor();
      else if (e.k === 'in') {
        const h = HOLES.find((q) => q.id === e.hole);
        state.holeFlash[h.id] = 1;
        addPart(list, { k: 'ring', x: h.x, y: 0.003, z: h.z, size: h.R + 0.02, max: 0.7, g: h.id === 'mouth' ? 190 : 225 });
        addPart(list, { k: 'text', x: h.x, y: 0.14, z: h.z, text: `+${e.v}`, size: h.id === 'mouth' ? 66 : 46, max: 1.5, col: h.id === 'mouth' ? '#ffd36a' : '#fff0b8', vy: 0 });
        sparks(list, h.x, h.z, h.id === 'mouth' ? 22 : h.v >= 250 ? 12 : 7, h.id === 'mouth' ? 1.6 : 1, 0.05);
        sfx.drop(); if (h.id === 'mouth') sfx.big(); else sfx.chime(h.v >= 250 ? 3 : h.v >= 150 ? 2 : 0);
      }
    }
    sim.events.length = 0;
  };
  const finishThrow = () => {
    const m = state.m, sim = state.sim, side = turnSide(m);
    const scored = sim.events.length ? [] : [];
    void scored;
    const ins = [];
    for (const d of sim.discs) if (d.st === 'in') ins.push({ hole: d.hole, v: HOLES.find((h) => h.id === d.hole).v, owner: d.owner, id: d.id });
    const res = { discs: sim.discs, scored: ins };
    const wasHuman = state.humanTurn && mode() !== 'watch';
    const thrown = sim.discs.find((d) => d.id === state.thrownId);
    if (mode() === 'learn') {
      const L = m.lesson; L.used++;
      const g = L.goal, plan = state.lastThrow.plan, mine = ins.find((s) => s.id === state.thrownId);
      let ok = false;
      if (g.kind === 'rest') ok = thrown && thrown.st === 'rest';
      else if (g.kind === 'hole') ok = !!mine && (!g.ids || g.ids.includes(mine.hole)) && (g.style === undefined || plan.style === g.style) && (!g.spin || plan.spin !== 0);
      else if (g.kind === 'knock') { const t0 = sim.discs.find((d) => d.id === 100); ok = !!t0 && t0.st !== 'rest'; }
      if (ok) L.got++;
      L.passed = L.got >= (g.kind === 'rest' ? g.n : 1);
      state.ph = 'settle'; state.pt = 0;
      if (mine) showBanner(`+${mine.v}`, holeName(mine.hole), '', 1.3, 100);
      else if (thrown && thrown.st === 'out') showBanner(tr('Off the table', 'Fuera de la mesa'), '', 'bad', 1.2, 64);
      return;
    }
    const rec = applyThrow(m, side, res);
    saveResume();
    state.ph = 'settle'; state.pt = 0; state.fast = false; state.lastRec = rec;
    if (wasHuman) { record.mouths = (record.mouths | 0) + res.scored.filter((s) => s.owner === side && s.hole === 'mouth').length; }
    const mine = ins.find((s) => s.id === state.thrownId);
    if (mine && mine.hole === 'mouth') showBanner(tr('FROG!', '¡SAPO!'), tr(`${sideName(state, side)}: the mouth, ${mine.v} points`, `${sideName(state, side)}: la boca, ${mine.v} puntos`), '', 1.8, 96);
    else if (mine) showBanner(`+${mine.v}`, holeName(mine.hole), '', 1.2, 100);
    else if (rec.out) showBanner(tr('Off the table', 'Fuera de la mesa'), '', 'bad', 1.2, 64);
    else if (rec.knockedOff) toast(tr(`Knocked ${rec.knockedOff === 1 ? 'a disc' : rec.knockedOff + ' discs'} off the table`, `Sacó ${rec.knockedOff === 1 ? 'una ficha' : rec.knockedOff + ' fichas'} de la mesa`), 1.8);
    if (rec.roundEnd) {
      const c = rec.closest;
      state.hl = c ? new Set([c.id]) : null;
      const d = c ? sim.discs.find((q) => q.id === c.id) : null;
      state.closestLine = d ? { x: d.x, z: d.z } : null;
      state.round = { owner: c ? c.owner : -1, dist: c ? c.d : 0 };
    }
    save();
  };
  const nextAfterThrow = () => {
    const m = state.m;
    if (mode() === 'learn') {
      const L = m.lesson;
      if (L.passed || L.used >= L.tries) {
        if (L.passed) record.learn = Math.max(record.learn, L.idx + 1);
        save(); state.scene = 'result'; state.ui.scroll = 0; state.banner = null; return;
      }
      beginTurn(false); return;
    }
    if (state.lastRec && state.lastRec.roundEnd) {
      const r = state.round;
      if (r.owner >= 0) showBanner(tr('Closest disc', 'Ficha más cercana'), tr(`${sideName(state, r.owner)} +${CLOSEST_BONUS}`, `${sideName(state, r.owner)} +${CLOSEST_BONUS}`), '', 2.4, 76);
      else showBanner(tr('No disc left', 'Ninguna ficha'), tr('Nobody gets the bonus', 'Nadie recibe la bonificación'), '', 2, 64);
      state.ph = 'roundend'; state.pt = 0; return;
    }
    beginTurn(false);
    if (mode() === 'two') { showBanner(sideName(state, turnSide(m)), tr('Your turn', 'Tu turno'), '', 1.0, 84); state.ph = 'intro'; state.pt = 0; }
  };
  const afterRound = () => {
    const m = state.m;
    state.lastRec = null;
    if (m.over) { finishMatch(); return; }
    saveResume();
    showBanner(tr(`Round ${m.round + 1}`, `Ronda ${m.round + 1}`), tr(`${sideName(state, turnSide(m))} throws first`, `${sideName(state, turnSide(m))} lanza primero`), '', 1.5, 84);
    beginTurn(true);
  };
  const finishMatch = () => {
    const m = state.m;
    state.scene = 'result'; state.ui.scroll = 0; state.page = 0; state.banner = null;
    clearResume();
    if (m.cfg.mode === 'ai') {
      record.played++;
      if (m.over.win === 0) record.wins[m.cfg.opp] = (record.wins[m.cfg.opp] | 0) + 1;
    }
    if (m.cfg.mode !== 'watch') record.bestTotal = Math.max(record.bestTotal | 0, m.scores[0]);
    if (m.over.win === 0 || m.cfg.mode === 'two') sfx.win();
    save();
  };

  // ---- the plan: what a person controls -----------------------------------------------------------------------
  const setPlan = (patch) => {
    const p = { ...state.plan, ...patch };
    p.ax = clamp(Math.round(p.ax * 1000) / 1000, -AX_MAX, AX_MAX);
    p.az = clamp(Math.round(p.az * 1000) / 1000, AZ_MIN, AZ_MAX);
    p.spin = clamp(p.spin | 0, -2, 2); p.style = p.style ? 1 : 0;
    state.plan = p;
  };
  const requestHint = () => {
    if (!state.humanTurn || state.ph !== 'aim') return;
    if (state.hint && !state.hint.busy) { state.hint = null; return; }
    if (state.hint) return;
    hintJob = makeJob(state.m, turnSide(state.m), humanSigma(), 4);
    state.hint = { busy: true, progress: 0, text: '', plan: null };
    sfx.tick();
  };
  const stepHint = () => {
    if (!hintJob || !state.hint || !state.hint.busy) return;
    if (hintJob.step(60)) {
      const best = hintJob.best;
      state.hint = { busy: false, progress: 1, plan: { ...best.p }, text: explain(hintJob, best, 'you') };
      hintJob = null;
    } else state.hint.progress = hintJob.progress;
  };
  const useHint = () => { if (!state.hint || state.hint.busy) return; setPlan(state.hint.plan); state.hint = null; sfx.tick(); };

  // ---- computer players -------------------------------------------------------------------------------------------
  function startThink() {
    const m = state.m, side = turnSide(m), prof = profOf(side), watch = mode() === 'watch';
    aiJob = makeJob(m, side, prof.sigma, prof.strat);
    const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiR.next() * (prof.think[1] - prof.think[0]);
    state.think = { t: 0, dur, phase: 'think', text: '', plan: null, from: { ...state.plan }, progress: 0 };
    state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
  }
  const updateThink = (dt) => {
    const m = state.m, side = turnSide(m), prof = profOf(side), watch = mode() === 'watch', th = state.think;
    if (!th) { startThink(); return; }
    if (th.phase === 'think') {
      if (aiJob) { if (aiJob.step(60)) { const c = choose(aiJob, prof, rn); th.plan = { ...c.p }; if (watch) th.text = explain(aiJob, c, 'ai'); aiJob = null; th.progress = 1; } else th.progress = aiJob.progress; }
      th.t += dt;
      if (th.plan && th.t >= th.dur) {
        th.t = 0;
        if (watch) { th.phase = 'reveal'; th.dur = REVEAL_SECS * TEXT_SCALES[state.settings.textIdx]; sfx.tick(); } else { th.phase = 'act'; th.dur = 0.8; }
      }
    } else if (th.phase === 'reveal') {
      th.t += dt;
      if (th.t >= th.dur) { th.phase = 'act'; th.t = 0; th.dur = 0.8; }
    } else if (th.phase === 'act') {
      th.t += dt;
      const k = clamp(th.t / th.dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
      state.plan = { ax: th.from.ax + (th.plan.ax - th.from.ax) * e, az: th.from.az + (th.plan.az - th.from.az) * e, spin: th.plan.spin, style: th.plan.style };
      if (th.t >= th.dur) { state.plan = { ...th.plan }; launch(th.plan, prof.sigma, rn); }
    }
  };

  // ---- the play scene --------------------------------------------------------------------------------------------------
  const openPause = () => { if (state.scene !== 'play' || mode() === 'watch') return; state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.drag = null; };
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
  const restPoint = (plan) => {
    // where a disc thrown without wobble would stop on an empty table (the small cross on the aim line)
    const r = runThrow([], launchDisc(900, 0, plan)); const d = r.discs[0];
    return d && (d.st === 'rest' || d.st === 'in') ? { x: d.x, z: d.z } : null;
  };
  let restCache = { key: '', v: null };
  const restFor = (p) => { const key = `${p.ax},${p.az},${p.spin},${p.style}`; if (restCache.key !== key) restCache = { key, v: restPoint(p) }; return restCache.v; };
  const setOverlay = () => {
    const ph = state.ph, th = state.think;
    if (ph === 'aim' && state.humanTurn) {
      const h = state.hint && !state.hint.busy ? { plan: state.hint.plan } : null;
      state.overlay = { plan: { plan: state.plan, label: '' }, rest: restFor(state.plan), hint: h };
    } else if (ph === 'think' && th && (th.phase === 'reveal' || th.phase === 'act') && th.plan) {
      const p = th.phase === 'act' ? state.plan : th.plan;
      state.overlay = { plan: { plan: p, label: '', col: '#bfe8ff' }, rest: null, hint: null };
    } else state.overlay = null;
  };
  const stepVisuals = (dt) => {
    state.parts = stepParts(state.parts, dt);
    stepFlash(state.holeFlash, dt);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.dur) state.banner = null; }
    if (state.pullHintT > 0) state.pullHintT -= dt;
    for (const q of state.sfxQ) q.t -= dt;
    const due = state.sfxQ.filter((q) => q.t <= 0); state.sfxQ = state.sfxQ.filter((q) => q.t > 0);
    due.forEach((q) => q.fn());
  };
  const pressRect = (R, ptr) => { for (const id of Object.keys(R)) if (inRect(R[id], ptr.x, ptr.y)) return id; return null; };
  const handleTrayId = (id) => {
    if (!id) return false;
    if (id.startsWith('spin')) { setPlan({ spin: Number(id.slice(4)) - 2 }); sfx.tick(); return true; }
    if (id.startsWith('style')) { setPlan({ style: Number(id.slice(5)) }); sfx.tick(); return true; }
    switch (id) {
      case 'think': requestHint(); return true;
      case 'use': useHint(); return true;
      case 'more': openWhy(); return true;
      case 'throw': doThrow(); return true;
      case 'menu': openPause(); return true;
      case 'setup': state.sheet = true; state.ui.scroll = 0; return true;
      case 'skip': state.fast = true; return true;
      default: return false;
    }
  };
  // Touch: put a finger down in the lower part of the table view and drag DOWN (pull the disc back). The ring on the table follows the
  // pull (further = longer, sideways = aim, inverted like a sling). Release to throw; release near the start to cancel.
  const updateAimInput = (dt, input, lay) => {
    const ptr = input.pointer, keys = input.keys, R = lay.rects;
    const toScene = (x, y) => ({ x: (x - lay.vx) / lay.s, y: (y - lay.vy) / lay.s + SCENE_Y0 });
    if (ptr.pressed) {
      const id = pressRect(R, ptr);
      if (id && handleTrayId(id)) return;
      const p = toScene(ptr.x, ptr.y);
      const inView = lay.clip ? inRect(lay.clip, ptr.x, ptr.y) && p.y >= (lay.wide ? PULL.y0 : SCENE_Y0 + 380) : p.y >= PULL.y0 && ptr.y < lay.trayTop + 4;
      if (inView) state.drag = { ax: p.x, ay: p.y, cx: p.x, cy: p.y, pull: false, plan0: { ...state.plan }, lx: ptr.x, ly: ptr.y };
    }
    const d = state.drag;
    if (d && ptr.down) {
      if (Math.hypot(ptr.x - d.lx, ptr.y - d.ly) <= 200) {   // a second finger can make the pointer jump: ignore big jumps
        const p = toScene(ptr.x, ptr.y); d.cx = p.x; d.cy = p.y; d.lx = ptr.x; d.ly = ptr.y;
        const gain = lay.gain || 1, py = (d.cy - d.ay) * gain, px = (d.cx - d.ax) * gain;   // gain: landscape has less room under the table, so the pull is amplified
        if (py >= PULL.min) {
          d.pull = true;
          setPlan({ az: AZ_MIN + clamp(py / PULL.max, 0, 1) * (AZ_MAX - AZ_MIN), ax: -px * 0.0026 });
          if (state.hint) state.hint = state.hint.busy ? state.hint : null;
        } else if (d.pull) { d.pull = false; state.plan = { ...d.plan0 }; }
      }
    }
    if (d && ptr.released) {
      state.drag = null;
      if (d.pull && (d.cy - d.ay) * (lay.gain || 1) >= PULL.min) { doThrow(); return; }
      state.plan = { ...d.plan0 };
    }
    if (!ptr.down && state.drag) { state.drag = null; }
    const sp = 0.3 * dt;
    if (keys.down.has('ArrowLeft')) setPlan({ ax: state.plan.ax - sp });
    if (keys.down.has('ArrowRight')) setPlan({ ax: state.plan.ax + sp });
    if (keys.down.has('ArrowUp')) setPlan({ az: state.plan.az + sp });
    if (keys.down.has('ArrowDown')) setPlan({ az: state.plan.az - sp });
    if (keys.pressed.has('KeyA')) setPlan({ spin: state.plan.spin - 1 });
    if (keys.pressed.has('KeyD')) setPlan({ spin: state.plan.spin + 1 });
    if (keys.pressed.has('KeyS')) setPlan({ style: 1 - state.plan.style });
    if (keys.pressed.has('KeyH')) requestHint();
    if (keys.pressed.has('Space') || keys.pressed.has('Enter')) doThrow();
  };
  const handleSheet = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'spin-') setPlan({ spin: state.plan.spin - 1 }); else if (id === 'spin+') setPlan({ spin: state.plan.spin + 1 });
    else if (id === 'style0') setPlan({ style: 0 }); else if (id === 'style1') setPlan({ style: 1 });
    else if (id === 'aim-') setPlan({ ax: state.plan.ax - 0.02 }); else if (id === 'aim+') setPlan({ ax: state.plan.ax + 0.02 });
    else if (id === 'dist-') setPlan({ az: state.plan.az - 0.03 }); else if (id === 'dist+') setPlan({ az: state.plan.az + 0.03 });
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
      { const mt = flowMeta(); if (mt.lay) { const ch = Math.min(mt.lay.contentH + 20, mt.bottom - mt.top + 20); state.ui.scroll = scrollInput(input, Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)), ch, state.ui.scroll); } }
      if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
      return;
    }
    if (state.sheet && state.ph === 'aim') { updateFlowScene(dt, input, handleSheet, 'sheet'); stepHint(); return; }
    if (watch && ptr.pressed) {
      const id = pressRect(lay.rects, ptr);
      if (id === 'wpause') { state.paused = !state.paused; sfx.tick(); }
      else if (id === 'wdec') { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); }
      else if (id === 'winc') { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); }
      else if (id === 'more') openWhy();
      else if (id === 'wexit') { leaveMatch(); return; }
    }
    // Everything below is frozen while paused: timers, the computer's thinking, the disc, the table.
    if (state.paused) return;
    toneBudget = 0;
    stepVisuals(dt);
    state.pt += dt;
    const ph = state.ph;
    if (!watch && ptr.pressed && (ph === 'think' || ph === 'intro' || ph === 'settle' || ph === 'roundend') && pressRect(lay.rects, ptr) === 'menu') { openPause(); return; }
    if (ph === 'intro') {
      const wait = m.cfg.mode === 'learn' ? 1e9 : 1.4;
      if (state.pt >= wait || (ptr.pressed && state.pt > 0.4 && !pressRect(lay.rects, ptr))) { state.banner = null; state.ph = state.humanTurn ? 'aim' : 'think'; state.pt = 0; if (state.ph === 'think') startThink(); }
    } else if (ph === 'aim') {
      stepHint();
      if (state.humanTurn) updateAimInput(dt, input, lay);
    } else if (ph === 'think') updateThink(dt);
    else if (ph === 'fly') {
      if (!watch && ptr.pressed) { const id = pressRect(lay.rects, ptr); if (id) handleTrayId(id); }
      const sim = state.sim;
      const steps = state.fast ? 6 : 1;
      let acc = dt * steps / DT + state.acc, n = 0;   // substeps of the fixed 1/120 s physics per 1/60 s update (two at normal speed)
      snapSim(sim);
      while (acc >= 1 && !sim.done && n < 60) { stepSim(sim); acc -= 1; n++; if (n % 2 === 0 && n < 60) snapSim(sim); }
      state.acc = acc; state.simT = sim.t;
      handleEvents(sim, state.parts);
      state.stepped = true; state.updAt = nowMs();
      if (sim.done) finishThrow();
    } else if (ph === 'settle') {
      state.simT = state.sim.t + state.pt;
      if (!watch && ptr.pressed) { const id = pressRect(lay.rects, ptr); if (id) { handleTrayId(id); return; } }
      const need = state.lastRec && state.lastRec.roundEnd ? 1.3 : mode() === 'learn' ? 1.5 : 1.15;
      if (state.pt >= need || (!watch && ptr.pressed && state.pt > 0.5)) nextAfterThrow();
    } else if (ph === 'roundend') {
      state.simT = state.sim.t + state.pt;
      if (state.pt >= 3 || (!watch && ptr.pressed && state.pt > 0.8)) { state.ph = 'clear'; state.pt = 0; state.banner = null; }
    } else if (ph === 'clear') {
      state.fade = clamp(state.pt / 0.6, 0, 1);
      if (state.pt >= 0.65) afterRound();
    }
    if (ph !== 'fly') { state.stepped = false; state.alpha = 1; }
    setOverlay();
  };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.ui.scroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.ui.scroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'quit') leaveMatch();
  }

  // ---- menus --------------------------------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) {
      const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top));
      state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max);
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
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.ui.scroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'lang-en') chooseLang('en'); else if (id === 'lang-es') chooseLang('es');
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = tr('That opponent is in the full game.', 'Ese rival está en el juego completo.'); return; } s.opp = i; state.setupMsg = ''; }
    else if (id.startsWith('len')) { const i = Number(id.slice(3)); if (state.demo && i > 0) { state.setupMsg = tr('That length is in the full game.', 'Esa duración está en el juego completo.'); return; } s.len = i; state.setupMsg = ''; }
    else if (id.startsWith('as')) { state.settings.assist = Number(id.slice(2)); save(); }
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, len: state.demo ? 0 : s.len });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id.startsWith('as')) st.assist = Number(id.slice(2));
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'lang-en') { chooseLang('en'); return; } else if (id === 'lang-es') { chooseLang('es'); return; }
    else if (id === 'restore') {
      state.restoreMsg = tr('Checking with the store...', 'Consultando con la tienda...');
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? tr('Purchase restored. Thank you!', '¡Compra restaurada! Gracias.') : tr('No previous purchase found.', 'No se encontró ninguna compra anterior.'); }).catch(() => { state.restoreMsg = tr('The store is not available right now.', 'La tienda no está disponible ahora.'); });
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
      const scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta();
    const max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    state.ui.scroll = scrollInput(input, max, mt.lay ? mt.bottom - mt.top : 600, state.ui.scroll);
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('KeyO') && state.setup.mode === 'ai') state.setup.opp = (state.setup.opp + 1) % (state.demo ? 2 : PROFILES.length);
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) {
      handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back');
      return;
    }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };
  // Shared by every scrolling text screen: the mouse wheel and the scroll keys (arrows, Page Up/Down, Space, Home, End).
  const scrollInput = (input, max, vh, scroll) => {
    let v = scroll; const k = input.keys;
    if (env.wheel && env.wheel.dy) { v += env.wheel.dy; env.wheel.dy = 0; }
    if (k.down.has('ArrowDown')) v += 14;
    if (k.down.has('ArrowUp')) v -= 14;
    if (k.pressed.has('PageDown') || k.pressed.has('Space')) v += vh * 0.85;
    if (k.pressed.has('PageUp')) v -= vh * 0.85;
    if (k.pressed.has('Home')) v = 0;
    if (k.pressed.has('End')) v = max;
    return clamp(v, 0, max > 0 ? max : 1e9);   // (before the first drawing the size of the text is not known yet)
  };
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys, ref = refMeta();
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.ui.scroll = 0; state.ui.drag = null; };
    if (ptr.pressed) {
      if (inRect(REF_NEXT, ptr.x, ptr.y)) { if (state.ui.scroll >= ref.max - 4) close(); else state.ui.scroll = clamp(state.ui.scroll + ref.vh * 0.85, 0, ref.max); }
      else if (inRect(REF_BACK, ptr.x, ptr.y)) close();
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
      else state.ui.drag = { y0: ptr.y, s0: state.ui.scroll };
    }
    if (state.ui.drag && ptr.down) state.ui.scroll = Math.max(0, state.ui.drag.s0 - (ptr.y - state.ui.drag.y0));
    if (ptr.released) state.ui.drag = null;
    state.ui.scroll = scrollInput(input, ref.max, ref.vh, state.ui.scroll);
    if (keys.pressed.has('Equal') || keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (keys.pressed.has('Minus') || keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (keys.pressed.has('Escape') || keys.pressed.has('Enter')) close();
  };

  // ---- the live table behind the title and the menus ---------------------------------------------------------------------
  const startAttract = () => {
    const a = state.att, plan = ATTRACT[a.n % ATTRACT.length], owner = a.n % 2;
    if (a.table.length >= 4 || a.n % ATTRACT.length === 0) a.table = [];
    a.n++; a.id++;
    a.sim = newSim(a.table.map((d) => newDisc(d.id, d.owner, d.x, d.z)), launchDisc(a.id, owner, plan));
    a.wait = 0; a.acc = 0;
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a.sim) startAttract();
    a.parts = stepParts(a.parts, dt); stepFlash(a.flash, dt);
    const s = a.sim;
    if (!s.done) {
      snapSim(s);
      a.acc += dt / DT * 0.8;
      let n = 0;
      while (a.acc >= 1 && !s.done && n < 8) { stepSim(s); a.acc -= 1; n++; }
      for (const e of s.events) {
        if (e.k === 'land') dust(a.parts, e.x, e.z, 1);
        if (e.k === 'clink') sparks(a.parts, e.x, e.z, 5, 1);
        if (e.k === 'in') { a.flash[e.hole] = 1; sparks(a.parts, e.x, e.z, 8, 1.1, 0.05); }
      }
      s.events.length = 0;
      state.att.stepped = true; state.att.updAt = nowMs();
      if (s.done) a.table = resting(s.discs).map((d) => ({ id: d.id, owner: d.owner, x: d.x, z: d.z }));
    } else { a.wait += dt; if (a.wait > 1.6) startAttract(); }
  };
  state.att.alpha = 1;
  Object.defineProperty(state.att, 'alpha', { value: 1, writable: true, enumerable: false });
  Object.defineProperty(state.att, 'stepped', { value: false, writable: true, enumerable: false });
  Object.defineProperty(state.att, 'updAt', { value: 0, writable: true, enumerable: false });

  // ---- shot presets (store screenshots): ?shot=1&seed=N picks a fixed, deterministic screen ----------------------------
  const THROWN = (side, sx, sz) => ({ id: 0, owner: side, x: sx, z: sz });
  const shotMatch = (cfg, discs, scores = [0, 0]) => {
    startMatch({ first: 0, ...cfg });
    const m = state.m;
    m.discs = discs.map((d, i) => ({ id: m.nextId + i, owner: d.owner, x: d.x, z: d.z, ang: i })); m.nextId += discs.length; m.idx = discs.length;
    m.scores = scores.slice(); state.banner = null; state.ph = 'aim'; state.humanTurn = true;
    setTable();
  };
  const SHOT_DISCS = [{ owner: 1, x: -0.26, z: 0.4 }, { owner: 0, x: 0.17, z: 0.47 }, { owner: 1, x: 0.04, z: 0.29 }, { owner: 0, x: -0.08, z: 0.66 }];
  const shotFlight = (steps, plan, discs = SHOT_DISCS) => {
    shotMatch({ mode: 'ai', opp: 2, len: 1 }, discs, [650, 400]);
    state.plan = { ...plan };
    launch(plan, 0, hn);
    const s = state.sim; let n = 0; while (n++ < steps && !s.done) { if (n === steps) snapSim(s); stepSim(s); }
    state.simT = s.t; handleEvents(s, state.parts); state.parts = stepParts(state.parts, 0.05);
    state.stepped = false; state.alpha = 1;
  };
  const NOINPUT = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const applyPreset = () => {
    const z = query('zoom'); if (z) state.settings.textIdx = clamp(Number(z) | 0, 0, TEXT_SCALES.length - 1);
    if (shotSeed >= 1000) { shotFlight((shotSeed - 1000) * 8, shotSeed >= 2000 ? { ax: 0.12, az: 0.8, spin: 0, style: 1 } : { ax: 0.12, az: 0.52, spin: 1, style: 0 }); return; }   // filmstrip: seed 1000 + k = k * 8 physics steps into the throw (2000+: a drive)
    const n = ((shotSeed % 100) + 100) % 100;
    if (n === 60) { state.showcase = true; state.settings.thinkIdx = 0; state.thinkSecs = 2; startMatch({ mode: 'watch', watchA: 3, opp: 4, len: 0, first: 0 }); return; }
    state.shot = true;
    updateAttract(0);
    if (n === 30) { shotMatch({ mode: 'ai', opp: 2, len: 1 }, SHOT_DISCS, [650, 400]); state.plan = { ax: -0.1, az: 0.62, spin: 0, style: 0 }; state.drag = { ax: 360, ay: 700, cx: 390, cy: 880, pull: true, plan0: state.plan }; setOverlay(); state.pullHintT = 0; return; }
    if (n === 1) { const a = state.att; a.n = 1; startAttract(); const s = a.sim; let k = 0; while (k++ < 460 && !s.done) stepSim(s); s.events.length = 0; state.scene = 'title'; return; }
    if (n === 2) { shotMatch({ mode: 'ai', opp: 2, len: 1 }, SHOT_DISCS, [650, 400]); state.plan = { ax: 0.04, az: 0.5, spin: 1, style: 0 }; setOverlay(); state.pullHintT = 99; return; }
    if (n === 3) { shotFlight(95, { ax: 0.0, az: 0.5, spin: 0, style: 0 }); return; }
    if (n === 4) { shotFlight(200, { ax: 0.0, az: 0.44, spin: 0, style: 1 }); state.ph = 'settle'; return; }
    if (n === 5) {
      shotMatch({ mode: 'ai', opp: 3, len: 1 }, SHOT_DISCS, [650, 400]); state.plan = { ax: -0.1, az: 0.4, spin: 0, style: 1 };
      state.hint = { busy: false, plan: { ax: 0.0, az: 0.5, spin: 0, style: 0 }, text: tr('Land it on the centre line and 50 cm from the front edge, a high lob, no spin, to drop into the frog\'s mouth (400 points). 8 test throws with your usual hand averaged 210 points, the mouth 2 of 8 times.', 'Cae en la línea central y a 50 cm del borde delantero, un tiro alto, sin efecto, para caer en la boca del sapo (400 puntos). 8 tiros de prueba con tu pulso normal dieron 210 puntos de media, la boca 2 de 8 veces.') };
      setOverlay(); return;
    }
    if (n === 6) {
      startMatch({ mode: 'ai', opp: 2, len: 1, first: 0 }); const m = state.m;
      m.scores = [1275, 1050]; m.round = m.rounds; m.stats = [{ in: 9, mouth: 1, mill: 2, best: 400, closest: 2 }, { in: 8, mouth: 0, mill: 1, best: 200, closest: 2 }]; m.over = { win: 0 }; state.scene = 'result'; return;
    }
    if (n === 7) { state.back = 'title'; state.scene = 'rules'; state.ui.scroll = 0; return; }
    if (n === 8) { state.back = 'title'; state.scene = 'howto'; state.ui.scroll = 0; return; }
    if (n === 9) { state.scene = 'setup'; return; }
    if (n === 10) { state.scene = 'settings'; return; }
    if (n === 11) { state.back = 'title'; state.scene = 'about'; state.ui.scroll = 0; return; }
    if (n === 12) {
      startWatch(); state.m.cfg.watchA = 3; state.m.cfg.opp = 2; state.plan = { ax: 0.0, az: 0.5, spin: 0, style: 0 };
      state.think = { t: 0.8, dur: 2, phase: 'reveal', plan: { ...state.plan }, text: tr('Land it on the centre line and 50 cm from the front edge, a high lob, no spin, to drop into the frog\'s mouth (400 points). 12 test throws with a steady hand averaged 140 points.', 'Cae en la línea central y a 50 cm del borde delantero, un tiro alto, sin efecto, para caer en la boca del sapo (400 puntos). 12 tiros de prueba con pulso firme dieron 140 puntos de media.'), from: { ...state.plan }, progress: 1 };
      state.ph = 'think'; state.banner = null; setOverlay(); return;
    }
    if (n === 13) { state.scene = 'learn'; return; }
    if (n === 14) { startLesson(1); state.pt = 0; return; }
    if (n === 15) { shotFlight(60, { ax: 0.0, az: 0.5, spin: 0, style: 0 }, [{ owner: 0, x: 0.06, z: 0.5 }, { owner: 1, x: -0.22, z: 0.6 }, { owner: 0, x: -0.1, z: 0.25 }]); state.ph = 'roundend'; state.hl = new Set([state.m.discs[0].id]); state.closestLine = { x: 0.06, z: 0.5 }; showBanner(tr('Closest disc', 'Ficha más cercana'), tr('You +25', 'Tú +25'), '', 99, 76); state.banner.t = 0.5; return; }
    if (n === 16) { state.settings.lang = 'es'; setLang('es'); state.scene = 'title'; return; }
    if (n === 17) { setLang('es'); shotMatch({ mode: 'ai', opp: 2, len: 1 }, SHOT_DISCS, [650, 400]); state.plan = { ax: 0.04, az: 0.5, spin: 1, style: 0 }; setOverlay(); state.pullHintT = 99; return; }
    if (n === 18) { setLang('es'); state.back = 'title'; state.scene = 'rules'; state.ui.scroll = 700; return; }
    if (n === 19) { shotFlight(150, { ax: 0.0, az: 0.54, spin: 0, style: 1 }); state.ph = 'settle'; return; }
    if (n >= 20 && n <= 29) {
      state.settings.textIdx = 4;
      if (n === 20) { state.back = 'title'; state.scene = 'rules'; state.ui.scroll = 1400; }
      else if (n === 21) state.scene = 'title';
      else if (n === 22) { shotMatch({ mode: 'ai', opp: 2, len: 1 }, SHOT_DISCS, [650, 400]); setOverlay(); }
      else if (n === 23) state.scene = 'settings';
      else if (n === 24) state.scene = 'setup';
      else if (n === 25) { shotMatch({ mode: 'ai', opp: 2, len: 1 }, SHOT_DISCS, [650, 400]); state.sheet = true; }
      else if (n === 26) { startMatch({ mode: 'ai', opp: 2, len: 1, first: 0 }); const m = state.m; m.scores = [1275, 1050]; m.stats = [{ in: 9, mouth: 1, mill: 2, best: 400, closest: 2 }, { in: 8, mouth: 0, mill: 1, best: 200, closest: 2 }]; m.over = { win: 0 }; state.scene = 'result'; }
      else if (n === 27) { state.back = 'title'; state.scene = 'about'; }
      else if (n === 28) { shotFlight(200, { ax: 0.0, az: 0.44, spin: 0, style: 1 }); state.ph = 'settle'; }
      else if (n === 29) { state.back = 'title'; state.scene = 'howto'; state.ui.scroll = 700; }
      return;
    }
    if (n === 31) { shotMatch({ mode: 'ai', opp: 2, len: 1 }, SHOT_DISCS, [650, 400]); openPause(); return; }
    if (n === 32) { startWatch(); state.m.cfg.watchA = 3; state.m.cfg.opp = 2; state.plan = { ax: 0.0, az: 0.5, spin: 0, style: 0 }; state.think = { t: 0.8, dur: 2, phase: 'reveal', plan: { ...state.plan }, text: tr('Land it on the centre line and 50 cm from the front edge, a high lob, no spin, to drop into the frog\'s mouth (400 points). 12 test throws with a steady hand averaged 140 points, and a lot more words so that the note runs long enough to need the read-it-all button on a small panel.', 'Cae en la línea central.'), from: { ...state.plan }, progress: 1 }; state.ph = 'think'; state.banner = null; setOverlay(); state.why = { text: state.think.text, title: tr('Why this throw?', '¿Por qué este tiro?'), wasPaused: false }; return; }
    if (n === 33) { state.scene = 'demolimit'; return; }
    if (n === 34) { shotMatch({ mode: 'ai', opp: 2, len: 1 }, SHOT_DISCS, [650, 400]); state.plan = { ax: 0.0, az: 0.5, spin: 0, style: 0 }; state.hint = { busy: true }; setOverlay(); return; }
    if (n === 35) { shotMatch({ mode: 'ai', opp: 2, len: 1 }, SHOT_DISCS, [650, 400]); state.settings.textIdx = 4; state.hint = { busy: false, plan: { ax: 0.0, az: 0.5, spin: 0, style: 0 }, text: tr('Land it on the centre line.', 'Cae en la línea central.') }; setOverlay(); return; }
    if (n >= 40 && n <= 59) { state.back = 'title'; state.scene = 'rules'; state.ui.scroll = (n - 40) * 700; }
  };

  // ---- the screen frame: which part of the live screen the current scene is laid out in ----------------------------------------
  // 'play' = the table screen (phone stage, scaled phone stage, or the landscape three-part layout); 'col' = a 720-wide text column
  // (menus, results, pause, Rules ...), centred in landscape. Returns the transform from screen units to the scene's own units.
  let lastSize = '';
  const colKind = () => !(state.scene === 'play' && state.m) || state.pauseMenu || !!state.why || (state.sheet && state.ph === 'aim');
  const applyFrame = (kind) => {
    const w = Math.round(meta.width), h = Math.round(meta.height), land = w > h;
    const pf = frameFor(w, h);
    Object.assign(playFrame, pf);
    const U0 = host.l, U1 = w - host.r;
    let T;
    if (kind === 'play') { T = { ox: pf.ox, oy: pf.oy, k: pf.k }; setStage(pf.mode === 'short' ? 1280 : h); screen.sceneCx = w / 2; }
    else {
      let ox = 0;
      if (land) {
        ox = Math.round((U0 + U1 - 720) / 2); screen.sceneCx = w / 2;
        if (state.scene === 'title' && w >= 1250) { ox = Math.round(U1 - 720 - 28); screen.sceneCx = ox / 2; }
      } else screen.sceneCx = w / 2;
      T = { ox, oy: 0, k: 1 }; setStage(h);
    }
    Object.assign(screen, { w, h, ox: T.ox, oy: T.oy, k: T.k, land });
    return T;
  };
  const localInput = (input, T) => {
    if (T.ox === 0 && T.oy === 0 && T.k === 1) return input;
    const p = input.pointer;
    return { ...input, pointer: { ...p, x: (p.x - T.ox) / T.k, y: (p.y - T.oy) / T.k } };
  };
  // A new size (rotation, split screen): a pull in progress is dropped (its coordinates belong to the old layout); everything else
  // is a pure function of the size and of the state, so the match, the pause, the hint and the scroll position carry over.
  const noteSize = () => {
    const key = `${Math.round(meta.width)}x${Math.round(meta.height)}`;
    if (key === lastSize) return;
    lastSize = key; state.drag = null; state.ui.drag = null; invalidateLayout();
  };

  // ---- the object the kit and the shell see --------------------------------------------------------------------------------
  const game = {
    // Watch & Learn, the lessons and every menu are free; only real play counts against the free preview (a paused match does not).
    // Only live action uses up the free preview: a disc in the air or sliding on the table, or a pull in progress. Menus, setup, Rules,
    // lessons, Watch & Learn, Think, pause, the computer's thinking, the aim-ready wait and the result screens cost nothing.
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch' && state.m.cfg.mode !== 'learn')
      || state.paused || state.pauseMenu || !!state.why || !!state.sheet || !(state.ph === 'fly' || state.ph === 'settle' || !!(state.drag && state.drag.pull)),
    update(dt, input) {
      if (state.showcase) input = NOINPUT;
      noteSize();
      input = localInput(input, applyFrame(colKind() ? 'col' : 'play'));
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
    },
    render(ctx) {
      noteSize();
      const a = state.att;
      a.alpha = a.stepped && env.clock ? Math.max(0, Math.min(1, (nowMs() - a.updAt) / (STEP * 1000))) : 1;
      state.alpha = state.stepped && env.clock ? Math.max(0, Math.min(1, (nowMs() - state.updAt) / (STEP * 1000))) : 1;
      const inFrame = (kind, fn) => {
        const T = applyFrame(kind);
        ctx.save();
        if (kind === 'play' && playFrame.mode === 'short') { ctx.fillStyle = '#0b0705'; ctx.fillRect(0, 0, screen.w, screen.h); }
        ctx.translate(T.ox, T.oy); ctx.scale(T.k, T.k);
        try { fn(); } finally { ctx.restore(); }
      };
      switch (state.scene) {
        case 'title': inFrame('col', () => renderTitle(ctx, state)); break;
        case 'setup': inFrame('col', () => renderSetup(ctx, state)); break;
        case 'settings': inFrame('col', () => renderSettings(ctx, state)); break;
        case 'learn': inFrame('col', () => renderLearn(ctx, state)); break;
        case 'result': inFrame('col', () => renderResult(ctx, state)); break;
        case 'demolimit': inFrame('col', () => renderDemoLimit(ctx, state)); break;
        case 'howto': inFrame('col', () => renderPages(ctx, state, HOWTO, tr('How to Play', 'Cómo jugar'), 'howto')); break;
        case 'about': inFrame('col', () => renderPages(ctx, state, ABOUT, tr('About', 'Acerca de'), 'about')); break;
        case 'rules': inFrame('col', () => renderPages(ctx, state, RULES, tr('Rules', 'Reglas'), 'rules')); break;
        case 'play':
          if (state.m) {
            setOverlay();
            inFrame('play', () => renderPlay(ctx, state));
            if (state.sheet && state.ph === 'aim') inFrame('col', () => renderSheet(ctx, state));
            if (state.why) inFrame('col', () => renderWhy(ctx, state));
            if (state.pauseMenu) inFrame('col', () => renderPause(ctx, state));
          }
          break;
        default: break;
      }
    },
    getState: () => state,
    // Dev / test hooks (read-only views of the current geometry; used by the layout checks)
    getLayout: () => { applyFrame(colKind() ? 'col' : 'play'); return computeLayout(state, null); },
    getFlow: () => flowMeta(),
    getFrame: () => ({ ...screen, mode: playFrame.mode, stageH: H, pins: { TEXT_DEC: { ...TEXT_DEC }, TEXT_INC: { ...TEXT_INC }, REF_BACK: { ...REF_BACK }, REF_NEXT: { ...REF_NEXT }, start: { ...SETUP_PINS.start }, back: { ...SETUP_PINS.back } }, ref: refMeta() }),
  };
  updateAttract(0);
  if (shotMode) applyPreset();
  return game;
}
