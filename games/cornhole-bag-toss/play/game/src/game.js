// Cornhole: state and flow. Rules live in engine.js, the physics in phys.js, the opponents and the Think hint in ai.js, the backyard scene in
// scene.js, the play screen in view.js, every other screen in menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, learn, quiz, play (also Watch & Learn and the lessons), result, howto / about / rules, demolimit.
// Play phases: intro, aim (a person plans the throw), think (a computer plans it), flight, result, roundEnd, sweep.
import { W, H, TEXT_SCALES, THINK_STEPS, REVEAL_SECS, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, SETUP_PINS, inRect, SCENE_Y0, PULL_ZONE_Y0 } from './layout.js';
import { DT, newSim, stepSim, snapSim, launchFor, throwWithError, runToEnd, AIM_Z0, AIM_Z1, AIM_X, BOARD_Z0, RELEASE, arcPoints, holeWorld } from './phys.js';
import { newMatch, applyThrow, turnOf, bagIndex, LENGTHS, roundText, BAGS_EACH } from './engine.js';
import { PROFILES, ASSIST, tableJob, chooseFromTable, verifyPlan, explainHint, gaussOf } from './ai.js';
import { fixedCam } from './scene.js';
import { renderPlay, computeLayout, sideName, statusText, whyTitle } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderLearn, renderQuiz, renderResult, renderPause, renderSheet, renderWhy, renderPages, renderDemoLimit, hitScreen, flowMeta, pageCount, ensureLayout, quizAnswers } from './menus.js';
import { ABOUT, HOWTO, RULES, LESSONS, QUIZ } from './content.js';
import { setPress } from './ui.js';

export const meta = { width: W, height: H };
const DEMO_GAME_CAP = 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_PARTS = 120;
const HZ = holeWorld();
const DEFAULT_PLAN = () => ({ style: 1, spin: 0, aimX: 0, aimZ: Math.round((HZ.z - 0.28) * 100) / 100 });
const HAND = { x: RELEASE.x, y: RELEASE.y, z: RELEASE.z };
const PULL_MIN = 34;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork(), hand = rng.fork(), aiR = rng.fork();
  const rn = () => aiR.next(), hn = () => hand.next();
  let shotMode = false;
  try { shotMode = /[?&]shot=/.test(globalThis.location.search); } catch { shotMode = false; }
  const shotSeed = config.seed | 0;
  // The kit has a single pointer: a second finger would make it jump and its lift would end the pull. So every touch that is not the
  // primary one is dropped in the capture phase, before the kit's canvas listeners ever see it.
  try {
    if (typeof globalThis.addEventListener === 'function' && !shotMode) {
      const dropStray = (e) => { if (e.pointerType === 'touch' && e.isPrimary === false) e.stopImmediatePropagation(); };
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) globalThis.addEventListener(type, dropStray, true);
    }
  } catch { /* no DOM (headless): nothing to guard */ }
  let aiJob = null, hintJob = null;      // the search jobs live outside `state` (they are big and not state)
  const ghostCache = { key: '', val: null };

  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, assist: 1, textIdx: 0, thinkIdx: 1, ghost: true },
    record: { played: 0, wins: [0, 0, 0, 0, 0], learn: 0, holes: 0, bestScore: 0, demoGames: 0, throws: 0 },
    setup: { mode: 'ai', opp: 0, len: 1 }, setupMsg: '', restoreMsg: '',
    ui: { scroll: 0, drag: null }, page: 0, resume: null, loaded: false,
    m: null, ph: 'intro', pt: 0, humanTurn: false, plan: DEFAULT_PLAN(), plans: [null, null], lessonCount: LESSONS.length,
    cam: fixedCam(), sim: null, handBag: null, handSide: 0, overlay: null, miniGuide: null, guide: '', parts: [], banner: null, toast: '', toastT: 0,
    why: null, hint: null, think: null, res: null, lastArc: null, drag: null, sheet: false, fast: false, thinkSecs: 5,
    acc: 0, alpha: 0, shot: false, showcase: false, thrownId: 0, att: { cam: null, sim: null, wait: 1, n: 0, parts: [], acc: 0, alpha: 0, bags: [] },
  };
  state.sim = newSim([], null, 0, 0);
  const record = state.record;

  // ---- persistence ---------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  // What is written so a killed app can Continue: the whole game, after every throw.
  const saveResume = () => {
    const m = state.m;
    if (!m || m.cfg.mode === 'watch' || m.cfg.mode === 'learn') return;
    if (m.over) { clearResume(); return; }
    state.resume = JSON.parse(JSON.stringify(m));
    storage.set('resume', state.resume);
  };
  const clearResume = () => { state.resume = null; storage.remove('resume'); };
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  const validBag = (b) => b && int(b.id, 1, 8) && (b.side === 0 || b.side === 1) && ['board', 'hole', 'ground'].includes(b.st) && [b.u, b.v, b.x, b.z, b.yaw].every(Number.isFinite);
  const validResume = (r) => !!r && !!r.cfg && (r.cfg.mode === 'ai' || r.cfg.mode === 'two') && int(r.cfg.len, 0, LENGTHS.length - 1) && (r.cfg.mode === 'two' || int(r.cfg.opp, 0, PROFILES.length - 1))
    && r.target === LENGTHS[r.cfg.len].pts && Array.isArray(r.score) && r.score.length === 2 && r.score.every((v) => int(v, 0, 40)) && (r.first === 0 || r.first === 1) && int(r.round, 1, 99)
    && Array.isArray(r.made) && r.made.length === 2 && r.made.every((v) => int(v, 0, BAGS_EACH)) && Math.abs(r.made[0] - r.made[1]) <= 1 && !r.over
    && Array.isArray(r.bags) && r.bags.length <= 8 && r.bags.every(validBag) && Array.isArray(r.stats) && r.stats.length === 2 && Array.isArray(r.rounds);
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('resume', null)]).then(([s, r, res]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const st = state.settings;
    st.textIdx = clamp(st.textIdx | 0, 0, TEXT_SCALES.length - 1);
    st.thinkIdx = clamp(st.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    st.assist = clamp(st.assist | 0, 0, ASSIST.length - 1);
    st.ghost = st.ghost !== false;
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 5) state.record.wins = [0, 0, 0, 0, 0];
    if (validResume(res) && !shotMode) state.resume = res;
    state.loaded = true;
    audio.setMuted?.(!st.sound);
  }).catch(() => { state.loaded = true; });

  // ---- sound ---------------------------------------------------------------------------------------
  let toneBudget = 0;
  const tone = (o) => { if (state.settings.sound && toneBudget < 6) { toneBudget++; audio.tone(o); } };
  const sfx = {
    whoosh: () => tone({ freq: 300, to: 160, dur: 0.34, type: 'sawtooth', vol: 0.025 }),
    thud: (s = 1) => { tone({ freq: 120, to: 55, dur: 0.14, type: 'sine', vol: 0.2 * Math.min(1.3, s) }); tone({ freq: 240, to: 120, dur: 0.05, type: 'triangle', vol: 0.05 * s }); },
    flop: () => tone({ freq: 90, to: 60, dur: 0.12, type: 'triangle', vol: 0.09 }),
    scuff: (s = 1) => tone({ freq: 260 + fx.next() * 80, to: 160, dur: 0.1 + 0.1 * s, type: 'sawtooth', vol: 0.015 }),
    bump: (s = 1) => tone({ freq: 160, to: 90, dur: 0.08, type: 'sine', vol: 0.11 * Math.min(1.2, s) }),
    plop: () => { tone({ freq: 220, to: 70, dur: 0.18, type: 'sine', vol: 0.22 }); tone({ freq: 880, to: 440, dur: 0.1, type: 'triangle', vol: 0.05 }); },
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.12 }),
    big: () => [0, 4, 7, 12, 16].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.22 + i * 0.04, type: 'triangle', vol: 0.1 })),
    miss: () => tone({ freq: 150, to: 90, dur: 0.3, type: 'sawtooth', vol: 0.04 }),
    win: () => [0, 2, 4, 7, 9, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.3 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.2) => { state.toast = text; state.toastT = secs; };
  void toast;
  const showBanner = (text, sub = '', kind = '', dur = 1.7, size = 76) => { state.banner = { text, sub, kind, t: 0, dur, size }; };

  // ---- particles: small localised dust puffs where a bag lands (nothing else on screen moves) ----------------------------------------
  const addPart = (list, p) => { if (list.length < MAX_PARTS) list.push({ t: 0, vx: 0, vy: 0, vz: 0, ...p }); };
  const dust = (list, x, y, z, n, big = 1) => { for (let i = 0; i < n; i++) addPart(list, { k: 'dust', x: x + (fx.next() - 0.5) * 0.12, y: y + 0.02, z: z + (fx.next() - 0.5) * 0.12, vx: (fx.next() - 0.5) * 0.6 * big, vy: 0.12 + fx.next() * 0.3, vz: (fx.next() - 0.5) * 0.6 * big, size: 0.03 + fx.next() * 0.03, max: 0.45 + fx.next() * 0.45, col: fx.next() < 0.5 ? '#f3e7c4' : '#cdbb8a' }); };
  const stepParts = (list, dt) => {
    for (const p of list) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 0.96; p.vz *= 0.96; p.vy *= 0.97; }
    return list.filter((p) => p.t < p.max);
  };

  // ---- who is who -------------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const isAI = (side) => mode() === 'watch' || (mode() === 'ai' && side === 1);
  const profOf = (side) => (mode() === 'watch' ? PROFILES[side === 0 ? state.m.cfg.watchA : state.m.cfg.opp] : PROFILES[state.m.cfg.opp]);
  const curSide = () => (mode() === 'learn' ? 0 : turnOf(state.m));
  const curBags = () => (mode() === 'learn' ? state.m.lesson.bags : state.m.bags);
  const human = () => ASSIST[state.settings.assist];

  // ---- the plan and what it shows ---------------------------------------------------------------------------------
  const planKey = (p) => `${p.style}|${p.spin}|${p.aimX}|${p.aimZ}|${curSide()}|${curBags().map((b) => `${b.id}${b.st[0]}${Math.round(b.u * 100)}${Math.round(b.v * 100)}`).join(',')}`;
  // What a perfect throw of the plan would do (the ghost and the guide text). One cheap simulation, cached while the plan stays the same.
  const perfect = (p) => {
    const key = planKey(p);
    if (ghostCache.key === key) return ghostCache.val;
    const s = runToEnd(newSim(curBags(), launchFor(p), 9, curSide())), b = s.bags.find((x) => x.id === 9);
    ghostCache.key = key; ghostCache.val = { ...b };
    return ghostCache.val;
  };
  const guideText = (p) => {
    const b = perfect(p);
    if (b.st === 'hole') return 'A perfect throw drops in the hole.';
    if (b.st === 'board') return b.flat === false ? 'It lands on an edge and may flop.' : 'A perfect throw stays on the board.';
    return b.landU == null ? 'This lands on the ground: no points.' : 'A perfect throw ends off the board.';
  };
  const setPlan = (patch) => {
    const p = { ...state.plan, ...patch };
    p.aimX = clamp(Math.round(p.aimX * 1000) / 1000, -AIM_X, AIM_X);
    p.aimZ = clamp(Math.round(p.aimZ * 1000) / 1000, AIM_Z0, AIM_Z1);
    p.style = clamp(p.style | 0, 0, 2); p.spin = clamp(p.spin | 0, -2, 2);
    const L = state.m && state.m.cfg.mode === 'learn' ? state.m.lesson : null;
    if (L && L.style != null) p.style = L.style;
    state.plan = p;
  };

  // ---- match flow ---------------------------------------------------------------------------------------------------
  const newBoardSim = () => { state.sim = newSim(curBags(), null, 0, 0); state.acc = 0; state.alpha = 0; };
  const setHand = (dx = 0, dz = 0) => {
    state.handBag = { id: 0, side: state.handSide, st: 'free', dead: false, x: HAND.x + dx, y: HAND.y + 0.02 * Math.sin(state.t * 2.4), z: HAND.z + dz, vx: 0, vy: 0, vz: 0, yaw: 0.25 * Math.sin(state.t * 1.2), pitch: -0.75, sq: 0 };
  };
  const beginTurn = (intro) => {
    const side = curSide();
    state.humanTurn = !isAI(side);
    state.plan = { ...(state.plans[side] ?? DEFAULT_PLAN()) }; setPlan({});
    state.handSide = side;
    newBoardSim();
    state.hint = null; hintJob = null; state.think = null; aiJob = null; state.sheet = false; state.why = null; state.drag = null;
    state.pt = 0; state.fast = false; state.res = null;
    setHand();
    state.ph = intro ? 'intro' : state.humanTurn ? 'aim' : 'think';
    if (state.ph === 'think') startThink();
  };
  const roundIntro = () => {
    const m = state.m;
    if (m.cfg.mode === 'learn') { showBanner(`Lesson ${m.lesson.idx + 1}`, m.lesson.title, '', 1.8, 64); return; }
    const first = sideName(state, m.first);
    showBanner(`Round ${m.round}`, `${first === 'You' ? 'You throw' : `${first} throws`} first. First to ${m.target}.`, '', 1.7, 84);
  };
  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch') {
      if (record.demoGames >= DEMO_GAME_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
      cfg = { ...cfg, len: 0 };
    }
    const first = cfg.first ?? aiR.int(2);
    state.m = newMatch({ mode: 'ai', opp: 0, len: 1, watchA: 1, ...cfg, first });
    if (state.demo && cfg.mode !== 'watch') { record.demoGames++; save(); }
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.plans = [null, null]; state.parts = []; state.banner = null; state.lastArc = null;
    roundIntro();
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
    state.scene = 'play'; state.ui.scroll = 0; state.plans = [null, null]; state.parts = []; state.banner = null; state.lastArc = null;
    beginTurn(false);
    state.paused = true; state.pauseMenu = true;   // a resumed game starts paused
  };
  const presetBags = (L) => L.setup.map((s, i) => ({ id: 1 + i, side: s.side, st: 'board', dead: false, x: s.u, y: 0, z: BOARD_Z0, u: s.u, v: s.v, vu: 0, vv: 0, vx: 0, vy: 0, vz: 0, yaw: 0.3 * i - 0.2, wyaw: 0, pitch: 0, wp: 0, roll: 0, spin: 0, sq: 0, hop: 0, fall: 0, T: 0 }));
  const startLesson = (idx) => {
    const L = LESSONS[idx];
    const m = newMatch({ mode: 'learn', len: 0, first: 0 });
    const bags = presetBags(L);
    m.lesson = { idx, title: L.title, tries: L.tries, goal: L.goal, goalShort: L.goalShort, goalSub: L.goalSub, style: L.style ?? null, used: 0, passed: false, text: L.text, bags, base: JSON.parse(JSON.stringify(bags)), q: 0, right: 0, feedback: '', lastOk: false, chosen: '' };
    state.m = m; state.scene = L.quiz ? 'quiz' : 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.plans = [null, null]; state.parts = []; state.lastArc = null;
    if (L.quiz) { state.banner = null; return; }
    showBanner(`Lesson ${idx + 1}`, L.title, '', 2.2, 64);
    beginTurn(true);
  };

  // ---- the throw ------------------------------------------------------------------------------------------------------
  const launch = (L) => {
    const side = curSide(), id = mode() === 'learn' ? 20 + state.m.lesson.used : bagIndex(state.m);
    state.thrownId = id;
    state.sim = newSim(curBags(), L, id, side);
    state.ph = 'flight'; state.pt = 0; state.hint = null; hintJob = null; state.sheet = false; state.fast = false; state.acc = 0; state.alpha = 0;
    state.handBag = null; state.plans[side] = { ...state.plan };
    state.lastArc = arcPoints(state.plan, 18);
    state.banner = null;
    sfx.whoosh();
    if (state.humanTurn && mode() !== 'watch') record.throws = (record.throws | 0) + 1;
  };
  const doThrow = (q) => {
    const a = human();
    launch(throwWithError(state.plan, a.lat * q, a.dep * q, gaussOf(hn), gaussOf(hn)));
  };
  const handleEvents = (sim, list) => {
    for (const e of sim.events) {
      if (e.k === 'land') { dust(list, e.x, e.y, e.z, 3 + Math.round(e.s * 3), 0.6 + e.s * 0.5); sfx.thud(0.5 + e.s); if (!e.flat) sfx.flop(); }
      else if (e.k === 'ground') { dust(list, e.x, 0, e.z, 4, 1); sfx.thud(0.4 + e.s * 0.6); }
      else if (e.k === 'bump') sfx.bump(e.s);
      else if (e.k === 'hole') { sfx.plop(); dust(list, HZ.x, HZ.y, HZ.z, 3, 0.5); }
      else if (e.k === 'off') sfx.scuff(1);
    }
    sim.events.length = 0;
  };
  const lessonCheck = (L, bag, bags) => {
    const res = bag ? (bag.st === 'hole' ? 'hole' : bag.st === 'board' ? 'board' : 'out') : 'out';
    switch (L.goal) {
      case 'board': return res === 'board' || res === 'hole';
      case 'hole': return res === 'hole';
      case 'slide': return res === 'hole' || (res === 'board' && bag.v >= 0.6);
      case 'push': return bags.some((b) => b.side === 1 && b.st === 'ground');
      default: return false;
    }
  };
  const finishThrow = () => {
    const m = state.m, sim = state.sim;
    const wasHuman = state.humanTurn && mode() !== 'watch';
    const bag = sim.bags.find((b) => b.id === state.thrownId);
    let res;
    if (mode() === 'learn') {
      const L = m.lesson; L.used++;
      res = bag ? (bag.st === 'hole' ? 'hole' : bag.st === 'board' ? 'board' : 'out') : 'out';
      L.passed = lessonCheck(L, bag, sim.bags);
      L.bags = L.goal === 'push' ? sim.bags.map((b) => ({ ...b, vu: 0, vv: 0, vx: 0, vz: 0, sq: 0 })) : JSON.parse(JSON.stringify(L.base));
      state.res = { res, side: 0, round: null };
    } else {
      const rec = applyThrow(m, sim.bags, state.thrownId);
      state.res = rec; res = rec.res;
      saveResume();
    }
    state.ph = 'result'; state.pt = 0; state.fast = false;
    if (wasHuman && res === 'hole') record.holes = (record.holes | 0) + 1;
    if (res === 'hole') { showBanner('CORNHOLE!', 'In the hole: 3 points', '', 1.5, 84); sfx.big(); }
    else if (res === 'board') { showBanner('On the board', '1 point', '', 1.3, 76); sfx.chime(0); }
    else { showBanner('Missed', 'Off the board: no points', 'bad', 1.3, 84); sfx.miss(); }
    save();
  };
  const finishMatch = () => {
    const m = state.m;
    state.scene = 'result'; state.ui.scroll = 0; state.page = 0; state.banner = null;
    clearResume();
    if (m.cfg.mode === 'ai') {
      record.played++;
      if (m.over.win === 0) record.wins[m.cfg.opp] = (record.wins[m.cfg.opp] | 0) + 1;
    }
    if (m.cfg.mode !== 'watch') record.bestScore = Math.max(record.bestScore | 0, m.score[0]);
    if (m.over.win === 0 || m.cfg.mode === 'two') sfx.win();
    save();
  };
  const nextAfterThrow = () => {
    const m = state.m;
    if (m.cfg.mode === 'learn') {
      const L = m.lesson;
      if (L.passed || L.used >= L.tries) {
        if (L.passed) record.learn = Math.max(record.learn, L.idx + 1);
        save(); state.scene = 'result'; state.ui.scroll = 0; state.banner = null; return;
      }
      beginTurn(false); return;
    }
    const rec = state.res;
    if (rec && rec.round) {
      const r = rec.round, nm = [sideName(state, 0), sideName(state, 1)];
      const head = r.scorer < 0 ? 'Nobody scores' : `${nm[r.scorer] === 'You' ? 'You score' : `${nm[r.scorer]} scores`} ${r.gain}`;
      showBanner(head, `${roundText(r, nm)}.`, r.scorer < 0 ? 'bad' : '', 3.4, 70);
      state.ph = 'roundEnd'; state.pt = 0;
      return;
    }
    saveResume();
    const handOver = m.cfg.mode === 'two';
    if (handOver) showBanner(sideName(state, turnOf(m)), 'Your throw', '', 1.1, 84);
    beginTurn(handOver);
  };
  const afterRound = () => {
    const m = state.m;
    if (m.over) { finishMatch(); return; }
    saveResume();
    roundIntro();
    beginTurn(true);
  };

  // ---- the Think hint -----------------------------------------------------------------------------------------------------
  const requestHint = () => {
    if (!state.humanTurn || state.ph !== 'aim') return;
    if (state.hint && !state.hint.busy) { state.hint = null; return; }
    if (state.hint) return;
    hintJob = tableJob(curBags(), curSide(), 9);
    state.hint = { busy: true, progress: 0, text: '', plan: null };
    sfx.tick();
  };
  const stepHint = () => {
    if (!hintJob || !state.hint || !state.hint.busy) return;
    if (hintJob.step(100)) {
      let best = hintJob.table[0];
      const L = mode() === 'learn' ? state.m.lesson : null;
      if (L && L.style != null) best = hintJob.table.find((c) => c.style === L.style) ?? best;
      const a = human(), v = verifyPlan(curBags(), curSide(), 9, best, a.lat, a.dep);
      state.hint = { busy: false, progress: 1, plan: { style: best.style, spin: best.spin, aimX: best.aimX, aimZ: best.aimZ }, text: explainHint(curBags(), curSide(), best, v) };
      hintJob = null;
    } else state.hint.progress = hintJob.progress;
  };
  const useHint = () => { if (!state.hint || state.hint.busy) return; setPlan(state.hint.plan); state.hint = null; sfx.tick(); };

  // ---- computer players -------------------------------------------------------------------------------------------
  function startThink() {
    const side = curSide(), prof = profOf(side), watch = mode() === 'watch';
    aiJob = prof.simple ? null : tableJob(curBags(), side, 9);
    const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiR.next() * (prof.think[1] - prof.think[0]);
    state.think = { t: 0, dur, phase: 'think', text: '', plan: null, from: { ...state.plan }, progress: 0 };
    state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
  }
  const updateThink = (dt) => {
    const side = curSide(), prof = profOf(side), watch = mode() === 'watch', th = state.think;
    if (!th) { startThink(); return; }
    if (th.phase === 'think') {
      let table = null;
      if (aiJob) { if (aiJob.step(100)) table = aiJob.table; else th.progress = aiJob.progress; }
      th.t += dt;
      if ((table || prof.simple) && !th.plan) {
        const pick = chooseFromTable(table, prof, rn);
        th.plan = { style: pick.style, spin: pick.spin, aimX: pick.aimX, aimZ: pick.aimZ };
        if (watch) { const v = verifyPlan(curBags(), side, 9, pick, prof.lat, prof.dep); th.text = explainHint(curBags(), side, pick, v); }
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
      state.plan = { style: th.plan.style, spin: th.plan.spin, aimX: th.from.aimX + (th.plan.aimX - th.from.aimX) * e, aimZ: th.from.aimZ + (th.plan.aimZ - th.from.aimZ) * e };
      setHand(0, -0.4 * Math.sin(k * Math.PI * 0.9));   // the arm swings back, then the bag is let go
      if (th.t >= th.dur) { state.plan = { ...th.plan }; launch(throwWithError(th.plan, prof.lat, prof.dep, gaussOf(rn), gaussOf(rn))); }
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
  const setOverlay = () => {
    const ph = state.ph, th = state.think;
    state.overlay = null; state.miniGuide = null; state.guide = '';
    if (ph === 'aim' && state.humanTurn) {
      const p = state.plan, v = perfect(p), ghostOn = state.settings.ghost;
      const ov = { plan: { pts: arcPoints(p, 24), aimX: p.aimX, aimZ: p.aimZ, label: '' }, last: state.lastArc, hint: null, ghost: null };
      if (state.hint && !state.hint.busy) ov.hint = { pts: arcPoints(state.hint.plan, 24), aimX: state.hint.plan.aimX, aimZ: state.hint.plan.aimZ };
      const inBoard = v.st === 'board' || v.st === 'hole';
      if (ghostOn && inBoard) ov.ghost = { ...v, st: 'board', u: v.st === 'hole' ? 0 : v.u, v: v.st === 'hole' ? 0.99 : v.v, sq: 0, id: 99 };
      state.overlay = ov;
      state.guide = guideText(p);
      state.miniGuide = { col: '#ffe08a', land: v.landU != null ? { u: v.landU, v: v.landV } : null, ghost: ghostOn && inBoard ? { u: v.st === 'hole' ? 0 : v.u, v: v.st === 'hole' ? 0.99 : v.v, yaw: v.yaw } : null };
    } else if (ph === 'think' && th && (th.phase === 'reveal' || th.phase === 'act') && th.plan) {
      const p = th.phase === 'act' ? state.plan : th.plan;
      state.overlay = { plan: { pts: arcPoints(p, 24), aimX: p.aimX, aimZ: p.aimZ, label: th.phase === 'reveal' ? 'Plan' : '', col: '#bfe8ff' }, last: null, hint: null, ghost: null };
    }
  };
  const stepVisuals = (dt) => {
    state.parts = stepParts(state.parts, dt);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.dur) state.banner = null; }
  };

  const pressRect = (R, ptr) => { for (const id of Object.keys(R)) if (inRect(R[id], ptr.x, ptr.y)) return id; return null; };
  const handleTrayId = (id) => {
    if (!id) return false;
    if (id.startsWith('sty')) { setPlan({ style: Number(id.slice(3)) }); sfx.tick(); return true; }
    if (id.startsWith('spin')) { setPlan({ spin: Number(id.slice(4)) - 2 }); sfx.tick(); return true; }
    switch (id) {
      case 'think': requestHint(); return true;
      case 'use': useHint(); return true;
      case 'more': openWhy(); return true;
      case 'left': setPlan({ aimX: state.plan.aimX - 0.03 }); sfx.tick(); return true;
      case 'right': setPlan({ aimX: state.plan.aimX + 0.03 }); sfx.tick(); return true;
      case 'throw': if (state.ph === 'aim') doThrow(1); return true;
      case 'menu': openPause(); return true;
      case 'setup': state.sheet = true; state.ui.scroll = 0; return true;
      case 'next': if (state.ph === 'result') nextAfterThrow(); return true;
      case 'skip': state.fast = true; return true;
      default: return false;
    }
  };

  // The gesture: press on the lawn, pull back (down) and to a side, let go. The distance sets how far the bag flies; the sideways pull aims it
  // the other way (like a catapult). A pull shorter than PULL_MIN cancels. A smooth, straight pull is a little more accurate than a wobbly one.
  const pullPlan = (d, lay) => {
    const dx = (d.x - d.sx) / lay.s, dy = (d.y - d.sy) / lay.s;
    const p = clamp((dy - 26) / 330, 0, 1);
    return { aimZ: AIM_Z0 + p * (AIM_Z1 - AIM_Z0), aimX: clamp(-dx * 0.0021, -AIM_X, AIM_X), dy };
  };
  const updateAimInput = (dt, input, lay) => {
    const ptr = input.pointer, keys = input.keys, R = lay.rects;
    if (ptr.pressed) {
      const id = pressRect(R, ptr);
      if (id && handleTrayId(id)) return;
      const sy = (ptr.y - lay.vy) / lay.s + SCENE_Y0;
      const inView = lay.clip ? inRect(lay.clip, ptr.x, ptr.y) : ptr.y < lay.trayTop - 4 && ptr.y > lay.hud.h - 20;
      if (inView && sy >= PULL_ZONE_Y0) state.drag = { kind: 'pull', x: ptr.x, y: ptr.y, sx: ptr.x, sy: ptr.y, path: [[ptr.x, ptr.y]], active: false };
    }
    const d = state.drag;
    if (d && ptr.down) {
      if (Math.hypot(ptr.x - d.x, ptr.y - d.y) < 220) { d.x = ptr.x; d.y = ptr.y; if (d.path.length < 200) d.path.push([ptr.x, ptr.y]); }   // a second finger can make the pointer jump: ignore big jumps
      const pp = pullPlan(d, lay);
      d.active = pp.dy >= PULL_MIN;
      if (d.active) setPlan({ aimX: pp.aimX, aimZ: pp.aimZ });
      setHand(((d.x - d.sx) / lay.s) * 0.0006, -0.5 * clamp(pp.dy / 330, 0, 1));
    }
    if (d && ptr.released) {
      state.drag = null;
      const pp = pullPlan(d, lay);
      if (d.active && pp.dy >= PULL_MIN) {
        // smoothness: how far the path strays from the straight line start -> end, relative to its length
        const [ex, ey] = d.path[d.path.length - 1], len = Math.hypot(ex - d.sx, ey - d.sy) || 1;
        let dev = 0; for (const [px, py] of d.path) dev = Math.max(dev, Math.abs((ex - d.sx) * (d.sy - py) - (d.sx - px) * (ey - d.sy)) / len);
        setPlan({ aimX: pp.aimX, aimZ: pp.aimZ });
        doThrow(clamp(0.8 + (dev / len) * 2.4, 0.8, 1.5));
        return;
      }
      setHand();
    }
    if (!ptr.down && state.drag) { state.drag = null; setHand(); }
    const sp = 0.4 * dt;
    if (keys.down.has('ArrowLeft')) setPlan({ aimX: state.plan.aimX - sp });
    if (keys.down.has('ArrowRight')) setPlan({ aimX: state.plan.aimX + sp });
    if (keys.down.has('ArrowUp')) setPlan({ aimZ: state.plan.aimZ + sp * 2 });
    if (keys.down.has('ArrowDown')) setPlan({ aimZ: state.plan.aimZ - sp * 2 });
    if (keys.pressed.has('Digit1')) setPlan({ style: 0 });
    if (keys.pressed.has('Digit2')) setPlan({ style: 1 });
    if (keys.pressed.has('Digit3')) setPlan({ style: 2 });
    if (keys.pressed.has('KeyZ')) setPlan({ spin: state.plan.spin - 1 });
    if (keys.pressed.has('KeyX')) setPlan({ spin: state.plan.spin + 1 });
    if (keys.pressed.has('KeyH')) requestHint();
    if (keys.pressed.has('Space') || keys.pressed.has('Enter')) doThrow(1);
  };
  const handleSheet = (id) => {
    if (!id) return;
    sfx.tick();
    const p = state.plan;
    if (id === 'sty-') setPlan({ style: p.style - 1 }); else if (id === 'sty+') setPlan({ style: p.style + 1 });
    else if (id === 'spin-') setPlan({ spin: p.spin - 1 }); else if (id === 'spin+') setPlan({ spin: p.spin + 1 });
    else if (id === 'aim-') setPlan({ aimX: p.aimX - 0.03 }); else if (id === 'aim+') setPlan({ aimX: p.aimX + 0.03 });
    else if (id === 'dep-') setPlan({ aimZ: p.aimZ - 0.07 }); else if (id === 'dep+') setPlan({ aimZ: p.aimZ + 0.07 });
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
    // Everything below is frozen while paused: timers, the computer's thinking, the bag in the air, the pushes, the banners.
    if (state.paused) return;
    toneBudget = 0;
    stepVisuals(dt);
    state.pt += dt;
    const ph = state.ph;
    if (!watch && ptr.pressed && (ph === 'think' || ph === 'intro' || ph === 'roundEnd') && pressRect(lay.rects, ptr) === 'menu') { openPause(); return; }
    if (ph === 'intro') {
      setHand();
      const wait = m.cfg.mode === 'learn' ? 1e9 : 1.5;
      if (state.pt >= wait || (ptr.pressed && state.pt > 0.4)) { state.banner = null; state.ph = state.humanTurn ? 'aim' : 'think'; state.pt = 0; if (state.ph === 'think') startThink(); }
    } else if (ph === 'aim') {
      stepHint();
      if (!state.drag) setHand();
      if (state.humanTurn) updateAimInput(dt, input, lay);
    } else if (ph === 'think') { if (state.think && state.think.phase !== 'act') setHand(); updateThink(dt); }
    else if (ph === 'flight') {
      if (!watch && ptr.pressed) { const id = pressRect(lay.rects, ptr); if (id) handleTrayId(id); }
      const sim = state.sim;
      let acc = dt * (state.fast ? 6 : 1) + state.acc, n = 0;
      while (acc >= DT && !sim.done && n < 120) { snapSim(sim); stepSim(sim); acc -= DT; n++; }
      state.acc = acc; state.alpha = acc / DT;
      handleEvents(sim, state.parts);
      if (sim.done) finishThrow();
    } else if (ph === 'result') {
      if (!watch && ptr.pressed) { const id = pressRect(lay.rects, ptr); if (id) { handleTrayId(id); return; } }
      if (state.pt >= 1.5 || (!watch && ptr.pressed && state.pt > 0.45)) nextAfterThrow();
    } else if (ph === 'roundEnd') {
      state.alpha = 0;
      if (state.pt >= 3.4 || (!watch && ptr.pressed && state.pt > 0.8)) { state.banner = null; state.ph = 'sweep'; state.pt = 0; }
    } else if (ph === 'sweep') {
      if (state.pt >= 0.5) afterRound();
    }
    setOverlay();
  };

  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; }
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
    sfx.tick();
    if (id === 'play') { state.setup.mode = 'ai'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'two') { state.setup.mode = 'two'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'learn') { state.scene = 'learn'; state.ui.scroll = 0; }
    else if (id === 'continue') resumeMatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; }
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
    else if (id === 'set-ghost') st.ghost = !st.ghost;
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
  const handleQuiz = (id) => {
    if (!id) return;
    const L = state.m.lesson, A = quizAnswers(QUIZ[L.q]);
    sfx.tick();
    if (id === 'qquit') { state.scene = 'learn'; state.ui.scroll = 0; return; }
    if (id === 'qnext') {
      if (L.q + 1 >= QUIZ.length) { L.passed = true; record.learn = Math.max(record.learn, L.idx + 1); save(); state.scene = 'result'; state.ui.scroll = 0; return; }
      L.q++; L.feedback = ''; L.lastOk = false; L.chosen = ''; state.ui.scroll = 0; return;
    }
    if (id.startsWith('ans') && !(L.feedback && L.lastOk)) {
      const choice = A.options[Number(id.slice(3))];
      L.chosen = choice;
      if (choice === A.right) { L.lastOk = true; L.right++; L.feedback = `Right: ${A.pa} minus ${A.pb}. ${A.right}.`; sfx.chime(2); }
      else { L.lastOk = false; L.feedback = 'Not quite. Take the smaller total away from the bigger; only the side that is ahead scores.'; sfx.miss(); }
    }
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
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
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
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys, n = pageCount();
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

  // ---- the live backyard behind the title and the menus ---------------------------------------------------------------------
  // A scripted run of friendly throws at the board: [style, aim across, depth from the hole (m)].
  const ATTRACT = [[1, 0.04, -0.26], [0, -0.05, -0.55], [2, 0.1, -0.2], [1, -0.12, -0.12], [0, 0.0, -0.42], [2, -0.02, -0.02]];
  const startAttract = () => {
    const a = state.att;
    if (a.n % ATTRACT.length === 0) a.bags = [];
    const [style, x, dz] = ATTRACT[a.n % ATTRACT.length];
    a.n++;
    a.sim = newSim(a.bags, launchFor({ style, spin: 0, aimX: x, aimZ: HZ.z + dz }), a.n, a.n % 2);
    a.wait = 0; a.acc = 0;
  };
  let warm = null;
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a.cam) { a.cam = fixedCam(); startAttract(); }
    if (!shotMode) { if (!warm) warm = tableJob([], 0, 1); else if (!warm.table) warm.step(60); }   // the first computer throw is warmed up before the first game
    a.parts = stepParts(a.parts, dt);
    const s = a.sim;
    if (!s.done) {
      a.acc += dt * 0.8;
      let n = 0;
      while (a.acc >= DT && !s.done && n < 60) { snapSim(s); stepSim(s); a.acc -= DT; n++; }
      a.alpha = a.acc / DT;
      for (const e of s.events) if (e.k === 'land') dust(a.parts, e.x, e.y, e.z, 4, 1);
      s.events.length = 0;
      if (s.done) a.bags = s.bags.filter((b) => b.st !== 'ground' && b.st !== 'free');
    } else { a.wait += dt; if (a.wait > 1.4) startAttract(); }
  };

  // ---- shot presets (store screenshots): ?shot=1&seed=N picks a fixed, deterministic screen ----------------------------
  const throwAll = (list) => {   // plays the throws one after the other to build a board: [style, aimX, aimZ offset from the hole, spin]
    let bags = []; let id = 1;
    list.forEach(([style, x, dz, spin], i) => { const s = runToEnd(newSim(bags, launchFor({ style, spin: spin ?? 0, aimX: x, aimZ: HZ.z + dz }), id, i % 2)); bags = s.bags.filter((b) => b.st !== 'free'); id++; });
    return bags;
  };
  const SHOT_BOARD = [[1, 0.02, -0.3], [1, -0.1, -0.22], [2, 0.12, -0.05], [0, 0.0, -0.45], [1, 0.06, -0.1]];
  const shotMatch = (cfg, bagsList, score = [8, 6]) => {
    startMatch({ first: 0, ...cfg });
    const m = state.m;
    m.score = score.slice(); m.round = 3;
    const bags = throwAll(bagsList);
    m.bags = bags; m.made = [Math.ceil(bags.length / 2), Math.floor(bags.length / 2)];
    m.stats[0].holes = 2; m.stats[1].holes = 1;
    state.banner = null; state.ph = 'aim'; state.humanTurn = true; state.handSide = turnOf(m);
    state.plan = { ...DEFAULT_PLAN(), aimZ: Math.round((HZ.z - 0.1) * 100) / 100 };
    newBoardSim(); setHand(); setOverlay();
  };
  const shotFlight = (steps, bagsList, plan) => {
    shotMatch({ mode: 'ai', opp: 2, len: 1 }, bagsList);
    state.plan = { ...plan };
    const id = bagIndex(state.m);
    state.thrownId = id; state.sim = newSim(curBags(), launchFor(plan), id, curSide());
    const s = state.sim; let n = 0; while (n++ < steps && !s.done) { snapSim(s); stepSim(s); }
    state.ph = 'flight'; state.handBag = null; handleEvents(s, state.parts); state.parts = stepParts(state.parts, 0.05); state.banner = null; state.acc = 0; state.alpha = 0.5;
    state.lastArc = null; state.overlay = null; state.miniGuide = null;
  };
  const NOINPUT = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const applyPreset = () => {
    const n = ((shotSeed % 100) + 100) % 100;
    if (shotSeed >= 1000) { shotFlight((shotSeed - 1000) * 6, SHOT_BOARD.slice(0, 3), { style: 1, spin: 0, aimX: 0.03, aimZ: HZ.z - 0.15 }); return; }
    if (n === 60) {   // showcase: two computer players play for real while the shot runs its ticks (input ignored)
      state.showcase = true; state.settings.thinkIdx = 0; state.thinkSecs = 2;
      startMatch({ mode: 'watch', watchA: 3, opp: 4, len: 0, first: 0 }); return;
    }
    state.shot = true;
    updateAttract(0);
    if (n === 1) { const a = state.att; a.n = 3; a.bags = []; startAttract(); let k = 0; const s = a.sim; while (k++ < 900 && !s.done) stepSim(s); s.events.length = 0; a.bags = s.bags.slice(); state.scene = 'title'; return; }
    if (n === 2) { shotMatch({ mode: 'ai', opp: 2, len: 1 }, SHOT_BOARD.slice(0, 4)); return; }
    if (n === 3) { shotFlight(12, SHOT_BOARD.slice(0, 3), { style: 1, spin: 0, aimX: 0.03, aimZ: HZ.z - 0.15 }); return; }
    if (n === 4) { shotFlight(80, SHOT_BOARD.slice(0, 3), { style: 2, spin: 0, aimX: 0.0, aimZ: HZ.z - 0.1 }); return; }
    if (n === 5) {
      shotMatch({ mode: 'ai', opp: 3, len: 1 }, SHOT_BOARD.slice(0, 5), [14, 12]);
      state.hint = { busy: false, plan: { style: 2, spin: 0, aimX: 0.04, aimZ: HZ.z - 0.08 }, text: 'Flip throw right at the hole. Twelve test throws: 5 in the hole, 5 on the board, 2 missed. That is +1.9 points on average for this round (-1 to +3). It moves or knocks off an opponent bag in 4 of 12.' };
      setOverlay(); return;
    }
    if (n === 6) {
      startMatch({ mode: 'ai', opp: 2, len: 1, first: 0 }); const m = state.m;
      m.score = [21, 17]; m.over = { win: 0, a: 21, b: 17 }; m.rounds = [1, 2, 3, 4, 5, 6, 7]; m.stats[0] = { holes: 5, boards: 11, outs: 6 }; m.stats[1] = { holes: 3, boards: 12, outs: 7 }; state.scene = 'result'; return;
    }
    if (n === 7) { state.back = 'title'; state.scene = 'rules'; state.page = 0; return; }
    if (n === 8) { state.back = 'title'; state.scene = 'howto'; state.page = 1; return; }
    if (n === 9) { state.scene = 'setup'; return; }
    if (n === 10) { state.scene = 'settings'; return; }
    if (n === 11) { state.back = 'title'; state.scene = 'about'; return; }
    if (n === 12) { shotFlight(240, SHOT_BOARD.slice(0, 4), { style: 0, spin: 1, aimX: 0.0, aimZ: HZ.z - 0.5 }); return; }
    if (n === 13) {
      startWatch(); state.m.cfg.watchA = 3; state.m.cfg.opp = 2; state.plan = { style: 1, spin: 0, aimX: 0.02, aimZ: HZ.z - 0.2 };
      state.think = { t: 0.8, dur: 2, phase: 'reveal', plan: { ...state.plan }, text: 'Arc throw just in front of the hole. Twelve test throws: 4 in the hole, 6 on the board, 2 missed. That is +2.1 points on average for this round (0 to +3).', from: { ...state.plan }, progress: 1 };
      state.ph = 'think'; state.banner = null; newBoardSim(); setOverlay(); return;
    }
    if (n === 14) { state.scene = 'learn'; return; }
    if (n === 15) { startLesson(3); state.banner = null; state.ph = 'aim'; state.humanTurn = true; state.plan = { style: 1, spin: 0, aimX: 0.04, aimZ: HZ.z - 0.4 }; newBoardSim(); setHand(); setOverlay(); return; }
    if (n === 16) {
      shotMatch({ mode: 'ai', opp: 2, len: 1 }, SHOT_BOARD.slice(0, 3));
      const s = runToEnd(newSim(curBags(), launchFor({ style: 1, spin: 0, aimX: 0.0, aimZ: HZ.z - 0.1 }), bagIndex(state.m), 0));
      state.sim = s; state.ph = 'result'; state.handBag = null; state.overlay = null; state.miniGuide = null; showBanner('CORNHOLE!', 'In the hole: 3 points', '', 99, 84); state.banner.t = 0.5; return;
    }
    if (n === 17) { startLesson(4); state.scene = 'quiz'; return; }
    if (n >= 20 && n <= 29) {
      state.settings.textIdx = 4;
      if (n === 20) { state.back = 'title'; state.scene = 'rules'; state.page = 2; }
      else if (n === 21) state.scene = 'title';
      else if (n === 22) { shotMatch({ mode: 'ai', opp: 2, len: 1 }, SHOT_BOARD.slice(0, 2)); }
      else if (n === 23) state.scene = 'settings';
      else if (n === 24) state.scene = 'setup';
      else if (n === 25) { shotMatch({ mode: 'ai', opp: 2, len: 1 }, SHOT_BOARD.slice(0, 2)); state.sheet = true; }
      else if (n === 26) { startMatch({ mode: 'ai', opp: 2, len: 1, first: 0 }); const m = state.m; m.over = { win: 0, a: 21, b: 17 }; m.score = [21, 17]; m.rounds = [1, 2, 3, 4, 5]; state.scene = 'result'; }
      else if (n === 27) { state.back = 'title'; state.scene = 'about'; }
      else if (n === 28) { shotMatch({ mode: 'ai', opp: 2, len: 1 }, SHOT_BOARD.slice(0, 3)); state.ph = 'result'; showBanner('CORNHOLE!', 'In the hole: 3 points', '', 99, 84); state.banner.t = 0.5; }
      else if (n === 29) { state.back = 'title'; state.scene = 'howto'; state.page = 1; }
      return;
    }
    if (n === 61 || n === 62) { if (n === 62) state.settings.textIdx = 4; shotMatch({ mode: 'ai', opp: 2, len: 1 }, SHOT_BOARD.slice(0, 3)); return; }   // preview used up: the kit's unlock screen over a game in progress
    if (n >= 40 && n <= 59) { state.back = 'title'; state.scene = 'rules'; state.page = n - 40; }
  };

  // ---- the object the kit and the shell see --------------------------------------------------------------------------------
  const game = {
    // Watch & Learn, the lessons and every menu are free; only real play counts against the free preview (a paused game does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch' && state.m.cfg.mode !== 'learn') || state.paused,
    update(dt, input) {
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
        case 'quiz': updateFlowScene(dt, input, handleQuiz, 'quiz'); break;
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
        case 'learn': renderLearn(ctx, state); break;
        case 'quiz': renderQuiz(ctx, state); break;
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
  };
  updateAttract(0);
  if (shotMode) applyPreset();
  return game;
}
