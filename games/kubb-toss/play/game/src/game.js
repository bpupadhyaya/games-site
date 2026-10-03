// Kubb: state and flow. The rules live in engine.js, the rigid-body physics in phys.js (bridged by sim.js), the opponents and the Think hint in ai.js,
// the lawn scene in scene.js, the play screen in view.js, every other screen in menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, learn, play (also Watch & Learn and the lessons), result, howto / about / rules, demolimit.
// Play phases: intro, toss (a person throws a kubb in), think (a computer plans a baton or a kubb), tossfly, place, aim (a person plans a baton),
// flight (a baton and everything it moves), result.
import { W, H, TEXT_SCALES, THINK_STEPS, REVEAL_SECS, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, SETUP_PINS, inRect, SCENE_Y0 } from './layout.js';
import { FIELD, KUBB, DT, SUB, savePrev, stepWorld, addBody, kubbsAtRest, pathOf, launchOf, batonFrom, qAxis, MAX_REACH, LOFTS, SPINS } from './phys.js';
import { newMatch, startTurn, endTurn, applyThrow, turnOver, targets, throwLine, tossCheck, placeCheck, standField, tossFail, freeSpot, fieldOf, baseOf, dirOf, baselineY, KING_RING, SIZES, kingPos } from './engine.js';
import { worldFromMatch, finalsOf, maskOf, errFor, launchFor, scatterAt } from './sim.js';
import { PROFILES, ASSIST, batonJob, describeShot, tossSpots, tossError, tossAdvice, placeSpot, lcg } from './ai.js';
import * as SC from './scene.js';
import { renderPlay, computeLayout, sideName, statusText, whyTitle, setMeasureCtx } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderLearn, renderResult, renderPause, renderSheet, renderWhy, renderPages, renderDemoLimit, hitScreen, flowMeta, pageCount, ensureLayout } from './menus.js';
import { ABOUT, HOWTO, RULES, LESSONS } from './content.js';
import { setPress } from './ui.js';

export const meta = { width: W, height: H };
const DEMO_MATCH_CAP = 2;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_PARTS = 140;
const STAND_MAX = 1.5;
const PULL_MIN = 36;           // px: a shorter pull cancels the throw
const KY = 0.0225, KX = 0.0125;   // metres per pixel of pull
const REACH_MIN = 0.9;
export const GESTURE = { KX, KY, REACH_MIN, PULL_MIN };

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork(), hand = rng.fork(), aiR = rng.fork();
  const rn = () => aiR.next(), hn = () => hand.next();
  const nowMs = () => (env.clock ? env.clock() : 0);   // display clock from the shell (drawing only); absent in headless runs
  let shotMode = false;
  try { shotMode = /[?&]shot=/.test(globalThis.location.search); } catch { shotMode = false; }
  const shotSeed = config.seed | 0;
  // The kit has a single pointer: a second finger would make it jump and its lift would end the aim. So every touch that is not the primary one
  // is dropped in the capture phase, before the kit's canvas listeners ever see it.
  try {
    if (typeof globalThis.addEventListener === 'function' && !shotMode) {
      const dropStray = (e) => { if (e.pointerType === 'touch' && e.isPrimary === false) e.stopImmediatePropagation(); };
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) globalThis.addEventListener(type, dropStray, true);
    }
  } catch { /* no DOM (headless): nothing to guard */ }

  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, assist: 1, textIdx: 0, thinkIdx: 1 },
    record: { played: 0, wins: [0, 0, 0, 0, 0], learn: 0, demoMatches: 0, throws: 0, knockedDown: 0 },
    setup: { mode: 'ai', opp: 0, size: config.demo ? 0 : 1, opening: true }, setupMsg: '', restoreMsg: '',
    ui: { scroll: 0, drag: null }, page: 0, resume: null, loaded: false,
    m: null, ph: 'intro', pt: 0, humanTurn: false, plan: { sx: 0, ax: 0, ay: 4, loft: 0, spin: 2 }, pref: [{ loft: 0, spin: 2 }, { loft: 0, spin: 2 }],
    line: { y: 0, adv: false }, overlay: null, parts: [], fades: [], marks: [], paddles: [], showPaddles: true, tossAnim: null, toss: null, drag: null, swing: 0,
    banner: null, toast: '', toastT: 0, resultLine: '', hint: null, think: null, why: null, sheet: false, thinkSecs: 5, fast: false,
    flight: null, mask: null, tossN: 0, placing: false, shot: false, showcase: false,
  };
  // Not part of the saved / hashed state: the physics world, the baked backdrop, jobs, the display clock.
  const hidden = (k, v) => Object.defineProperty(state, k, { value: v, writable: true, enumerable: false });
  hidden('world', null); hidden('baked', null); hidden('alpha', 1); hidden('att', { scene: null, world: null, wait: 1, n: 0, t: 0, done: false, m: null });
  let aiJob = null, hintJob = null, bake = null, stepped = false, updAt = 0;
  // Search jobs run a few simulated throws per frame. With a display clock the work is capped at about 5 ms a frame so a slow phone never stutters;
  // without one (headless) a fixed batch is used. The result never depends on the speed of the device, only on how many frames it takes.
  const stepJob = (job) => {
    if (!env.clock) return job.step(8);
    const t0 = nowMs();
    let done = false;
    do { done = job.step(1); } while (!done && nowMs() - t0 < 5);
    return done;
  };
  const record = state.record;

  // ---- persistence -----------------------------------------------------------------------------------------------------------
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
  const num = (v) => Number.isFinite(v);
  const validResume = (r) => !!r && !!r.cfg && (r.cfg.mode === 'ai' || r.cfg.mode === 'two') && (r.size === 3 || r.size === 5) && (r.cfg.mode === 'two' || int(r.cfg.opp, 0, PROFILES.length - 1))
    && (r.turn === 0 || r.turn === 1) && !r.over && int(r.turnNo, 0, 200) && int(r.baton, 0, 6) && int(r.batons, 1, 6) && Array.isArray(r.queue) && r.queue.every((q) => int(q, 0, 9))
    && (r.phase === 'throwin' || r.phase === 'batons') && int(r.tossTry, 0, 2) && Array.isArray(r.blocks) && r.blocks.length === 11
    && r.blocks.every((b, i) => b && b.id === i && num(b.x) && num(b.y) && num(b.z) && Math.abs(b.x) < 6 && b.y > -6 && b.y < 12 && ['base', 'field', 'fallen', 'cleared', 'king'].includes(b.role) && (!b.q || (Array.isArray(b.q) && b.q.length === 4 && b.q.every(num))))
    && Array.isArray(r.knocked) && Array.isArray(r.cleared);
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('resume', null)]).then(([s, r, res]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const st = state.settings;
    st.textIdx = clamp(st.textIdx | 0, 0, TEXT_SCALES.length - 1);
    st.thinkIdx = clamp(st.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    st.assist = clamp(st.assist | 0, 0, ASSIST.length - 1);
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 5) state.record.wins = [0, 0, 0, 0, 0];
    if (validResume(res) && !shotMode) state.resume = res;
    state.loaded = true;
    audio.setMuted?.(!st.sound);
  }).catch(() => { state.loaded = true; });

  // ---- sound ------------------------------------------------------------------------------------------------------------------
  let toneBudget = 0;
  const tone = (o) => { if (state.settings.sound && toneBudget < 6) { toneBudget++; audio.tone(o); } };
  const sfx = {
    whoosh: () => tone({ freq: 420, to: 140, dur: 0.32, type: 'sawtooth', vol: 0.028 }),
    crack: (s = 1) => { tone({ freq: 900 + fx.next() * 300, to: 240, dur: 0.07, type: 'square', vol: 0.06 * Math.min(1.4, s) }); tone({ freq: 150, to: 60, dur: 0.16, type: 'sine', vol: 0.22 * Math.min(1.4, s) }); },
    clack: (s = 1) => tone({ freq: 520 + fx.next() * 600, to: 280, dur: 0.05, type: 'square', vol: 0.04 * Math.min(1.5, s) }),
    thud: (s = 1) => tone({ freq: 120, to: 60, dur: 0.1, type: 'sine', vol: 0.12 * Math.min(1.4, s) }),
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.12 }),
    plop: () => tone({ freq: 200, to: 100, dur: 0.08, type: 'sine', vol: 0.1 }),
    bad: () => tone({ freq: 160, to: 90, dur: 0.4, type: 'sawtooth', vol: 0.05 }),
    win: () => [0, 2, 4, 7, 9, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.3 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.2) => { state.toast = text; state.toastT = secs; };
  const toastOnce = (t) => { if (state.toast !== t || state.toastT <= 0) toast(t); };
  const showBanner = (text, sub = '', kind = '', dur = 1.5, size = 72) => { state.banner = { text, sub, kind, t: 0, dur, size }; };

  // ---- particles (world metres): localized dust and chips, never a board shake ---------------------------------------------------------
  const addPart = (list, p) => { if (list.length < MAX_PARTS) list.push({ t: 0, vx: 0, vy: 0, vz: 0, rot: 0, spin: 0, ...p }); };
  const dust = (list, x, y, z, n, big = 1) => { for (let i = 0; i < n; i++) addPart(list, { k: 'dust', x: x + (fx.next() - 0.5) * 0.12, y: y + (fx.next() - 0.5) * 0.12, z: z + 0.04, vx: (fx.next() - 0.5) * 0.7 * big, vy: (fx.next() - 0.5) * 0.7 * big, vz: 0.2 + fx.next() * 0.4, size: 0.07 + fx.next() * 0.05, max: 0.5 + fx.next() * 0.5, col: fx.next() < 0.5 ? '#d6caa0' : '#a89a68' }); };
  const chips = (list, x, y, z, n) => { for (let i = 0; i < n; i++) addPart(list, { k: 'chip', x, y, z: z + 0.05, vx: (fx.next() - 0.5) * 2.2, vy: (fx.next() - 0.5) * 2.2, vz: 1 + fx.next() * 1.8, size: 0.02 + fx.next() * 0.02, max: 0.7 + fx.next() * 0.5, rot: fx.next() * TAU, spin: (fx.next() - 0.5) * 14, col: fx.next() < 0.5 ? '#efd9a0' : '#c58a4a' }); };
  const stepParts = (list, dt) => {
    for (const p of list) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.k === 'chip') { p.vz -= 9 * dt; if (p.z < 0.02) { p.z = 0.02; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; } } else { p.vx *= 0.97; p.vy *= 0.97; p.vz *= 0.98; } }
    return list.filter((p) => p.t < p.max);
  };

  // ---- who is who -----------------------------------------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const isAI = (side) => mode() === 'watch' || (mode() === 'ai' && side === 1);
  const profOf = (side) => (mode() === 'watch' ? PROFILES[side === 0 ? state.m.cfg.watchA : state.m.cfg.opp] : PROFILES[state.m.cfg.opp]);
  const humanNoise = () => ASSIST[state.settings.assist].noise;

  // ---- the world ----------------------------------------------------------------------------------------------------------------------
  const syncWorld = (hideId = -1) => {
    const keep = state.world ? state.world.bodies.filter((b) => b.kind === 'baton') : [];
    const w = worldFromMatch(state.m, hideId);
    for (const b of keep) w.bodies.push(b);
    state.world = w;
  };
  const clearBatons = () => { if (state.world) state.world.bodies = state.world.bodies.filter((b) => b.kind !== 'baton'); };

  // ---- match flow ------------------------------------------------------------------------------------------------------------------
  const lyingQ = qAxis(1, 0, 0, Math.PI / 2);
  const lessonMatch = (idx) => {
    const L = LESSONS[idx];
    const m = newMatch({ mode: 'learn', size: 3, first: 0, opening: false });
    if (L.base === 0) for (let i = 5; i < 8; i++) m.blocks[i].role = 'cleared';
    if (L.fallen0) {
      const spots = [[-0.55, 1.5], [0.6, 2.0]];
      for (let i = 0; i < L.fallen0; i++) Object.assign(m.blocks[i], { role: 'fallen', down: true, q: lyingQ.slice(), x: spots[i][0], y: spots[i][1], z: KUBB.w / 2 });
    }
    startTurn(m);
    m.batons = L.batons;
    m.lesson = { idx, title: L.title, text: L.text, goalText: L.goalText, goalShort: L.goalShort, pass: L.pass, batons: L.batons, used: 0, passed: false, failMsg: '' };
    return m;
  };
  const showTurnBanner = () => {
    const m = state.m;
    if (m.cfg.mode === 'learn') return;
    const who = sideName(state, m.turn);
    showBanner(who === 'You' ? 'Your turn' : `${who}${who.endsWith('s') ? "'" : "'s"} turn`, `${m.batons} ${m.batons === 1 ? 'baton' : 'batons'}${m.queue.length ? ` and ${m.queue.length} ${m.queue.length === 1 ? 'kubb' : 'kubbs'} to throw in` : ''}`, `team${m.turn}`, 1.6, 64);
  };
  const resetTurnState = () => {
    state.hint = null; hintJob = null; state.think = null; aiJob = null; state.sheet = false; state.why = null; state.drag = null; state.toss = null; state.tossAnim = null; state.flight = null;
    state.pt = 0; state.fast = false; state.placing = false;
  };
  const beginTurn = (intro) => {
    const m = state.m;
    resetTurnState();
    state.humanTurn = !isAI(m.turn);
    if (intro) showTurnBanner();
    state.ph = 'intro'; state.pt = 0;
    syncWorld();
    if (!intro) afterIntro();
  };
  const afterIntro = () => {
    const m = state.m;
    state.banner = null;
    if (m.phase === 'throwin' && m.queue.length) { state.tossN = Math.max(state.tossN, m.queue.length); startToss(); } else startBatons();
  };
  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch') {
      if (record.demoMatches >= DEMO_MATCH_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
      cfg = { ...cfg, size: 3 };
    }
    const first = cfg.first ?? aiR.int(2);
    const m = newMatch({ mode: 'ai', opp: 0, size: 5, watchA: 1, ...cfg, first });
    state.m = m;
    if (state.demo && cfg.mode !== 'watch') { record.demoMatches++; save(); }
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.parts = []; state.fades = []; state.marks = []; state.banner = null; state.world = null; state.tossN = m.queue.length; state.resultLine = '';
    state.pref = [{ loft: 0, spin: 2 }, { loft: 0, spin: 2 }];
    beginTurn(true);
  };
  const startWatch = () => {
    const picks = [1, 2, 3, 4];
    const a = picks.splice(aiR.int(picks.length), 1)[0], b = picks[aiR.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, size: 3, first: aiR.int(2) });
  };
  const resumeMatch = () => {
    const r = state.resume;
    if (!r) return;
    state.m = JSON.parse(JSON.stringify(r));
    state.scene = 'play'; state.ui.scroll = 0; state.parts = []; state.fades = []; state.banner = null; state.world = null; state.tossAnim = null;
    state.tossN = state.m.queue.length;
    state.pref = [{ loft: 0, spin: 2 }, { loft: 0, spin: 2 }];
    beginTurn(false);
    state.paused = true; state.pauseMenu = true;   // a resumed match starts paused
  };
  const startLesson = (idx) => {
    state.m = lessonMatch(idx);
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.parts = []; state.fades = []; state.world = null; state.tossN = state.m.queue.length;
    state.pref = [{ loft: 0, spin: 2 }, { loft: 0, spin: 2 }];
    showBanner(`Lesson ${idx + 1}`, LESSONS[idx].title, '', 1.8, 64);
    resetTurnState(); state.humanTurn = true; syncWorld();
    state.ph = 'intro'; state.pt = 0;
  };

  // ---- throwing kubbs in -------------------------------------------------------------------------------------------------------------------
  const tossZone = (team) => (team === 0 ? { y0: FIELD.MID, y1: FIELD.L } : { y0: 0, y1: FIELD.MID });
  const defaultToss = (team) => { const n = Math.max(1, state.tossN), k = Math.max(0, n - state.m.queue.length); return tossSpots(state.m, team, n)[Math.min(k, n - 1)]; };
  const clampToss = (team, x, y) => {
    const z = tossZone(team), dir = dirOf(team);
    const px = clamp(x, -FIELD.W / 2 + 0.2, FIELD.W / 2 - 0.2);
    let py = clamp(y, z.y0 + 0.1, z.y1 - 0.1);
    const kp = kingPos(state.m);
    if (Math.hypot(px - kp.x, py - kp.y) < KING_RING + 0.05) py = kp.y + dir * Math.sqrt(Math.max(0, (KING_RING + 0.05) ** 2 - (px - kp.x) ** 2));
    return { x: px, y: py };
  };
  function startToss() {
    const m = state.m, team = m.turn;
    if (!m.queue.length) { m.phase = 'batons'; startBatons(); return; }
    const id = m.queue[0], d = defaultToss(team);
    state.toss = { id, target: clampToss(team, d.x, d.y) };
    state.hint = null; hintJob = null; state.think = null; state.drag = null;
    if (state.humanTurn) { state.ph = 'toss'; state.pt = 0; }
    else {
      const prof = profOf(team);
      state.ph = 'think'; state.pt = 0;
      const dur = mode() === 'watch' ? Math.max(1, THINK_STEPS[state.settings.thinkIdx] * 0.6) : prof.think[0] + aiR.next() * (prof.think[1] - prof.think[0]);
      state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
      let plan = { ...state.toss.target }, text = `Throw the fallen kubb into the ${team === 0 ? 'top' : 'bottom'} half, a little past the king's circle and away from the side lines, so it is easy to knock down again.`;
      if (prof.stars === 1) {   // the weakest player throws wherever
        const z = tossZone(team);
        plan = clampToss(team, (aiR.next() - 0.5) * 2.6, z.y0 + 0.3 + aiR.next() * (z.y1 - z.y0 - 0.6));
        text = 'A beginner throws the kubb in wherever it feels right, even close to the far baseline where it is hard to reach.';
      }
      state.think = { phase: 'think', t: 0, dur, tossing: true, text, plan };
    }
  }
  const doToss = (tx, ty, noise, rnd) => {
    const m = state.m, team = m.turn, id = state.toss.id, dir = dirOf(team);
    const from = { x: 0, y: baselineY(team) - dir * 0.45, z: 0.55 };
    const dist = Math.abs(ty - baselineY(team)), e = tossError(noise, dist, rnd);
    const x = tx + e.dx, y = ty + e.dy, chk = tossCheck(m, team, x, y);
    const blk = m.blocks[id], lie = blk.q ? { p: [blk.x, blk.y, blk.z], q: blk.q.slice() } : { p: [blk.x, blk.y, KUBB.h / 2], q: [1, 0, 0, 0] };
    state.tossAnim = { id, team, from, to: { x, y }, t: 0, pick: 0.4, lie, dur: 0.55 + dist * 0.09, apex: 1.0 + dist * 0.16, rev: 1 + Math.floor(dist / 2.5), chk, fault: !chk.ok, fadeOut: 0, landed: false };
    syncWorld(id);
    state.ph = 'tossfly'; state.pt = 0; state.hint = null; hintJob = null; state.drag = null; state.swing = 0.6;
    sfx.whoosh();
    if (state.humanTurn && mode() !== 'watch') record.throws = (record.throws | 0) + 1;
  };
  const finishToss = () => {
    const m = state.m, a = state.tossAnim, team = m.turn;
    state.tossAnim = null;
    if (a.chk.ok) {
      const b = standField(m, a.id, a.to.x, a.to.y);
      dust(state.parts, b.x, b.y, 0, 4); sfx.thud(0.6);
      syncWorld();
    } else {
      toast(`Fault: ${a.chk.reason.replace(/\.$/, '').replace(/^It /, 'it ')}`, 2.4); sfx.bad();
      const second = tossFail(m);
      syncWorld();
      if (second) {
        if (!isAI(1 - team)) { state.placing = true; state.humanTurn = true; state.ph = 'place'; state.pt = 0; state.toss = { id: a.id, target: { x: 0, y: 0 } }; return; }
        const s = placeSpot(m, team, state.tossN - m.queue.length), f = freeSpot(m, a.id, s.x, s.y);
        standField(m, a.id, f.x, f.y); syncWorld(); toast(`${sideName(state, 1 - team)} places the kubb`, 2); sfx.plop();
      }
    }
    saveResume();
    startToss();
  };
  const placeKubb = (x, y) => {
    const m = state.m, team = m.turn, chk = placeCheck(m, team, x, y);
    if (!chk.ok) { toastOnce(chk.reason); return; }
    const f = freeSpot(m, state.toss.id, x, y);
    standField(m, state.toss.id, f.x, f.y); state.placing = false; state.humanTurn = !isAI(team); syncWorld(); sfx.plop();
    saveResume();
    startToss();
  };

  // ---- batons -----------------------------------------------------------------------------------------------------------------------------
  function startBatons() {
    const m = state.m, T = targets(m), team = m.turn;
    state.line = throwLine(m, T.king);
    const pref = state.pref[team];
    const best = T.ids.map((i) => m.blocks[i]).sort((a, b) => Math.abs(a.y - state.line.y) - Math.abs(b.y - state.line.y) || Math.abs(a.x) - Math.abs(b.x))[0];
    state.plan = { sx: clamp(best.x * 0.7, -STAND_MAX, STAND_MAX), ax: best.x, ay: best.y, loft: pref.loft, spin: pref.spin };
    state.hint = null; hintJob = null; state.think = null; aiJob = null; state.flight = null; state.drag = null; state.swing = 0;
    if (state.humanTurn) { state.ph = 'aim'; state.pt = 0; } else startThinkBaton();
  }
  function startThinkBaton() {
    const m = state.m, team = m.turn, prof = profOf(team), watch = mode() === 'watch';
    aiJob = batonJob(m, prof, { salt: team });
    const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiR.next() * (prof.think[1] - prof.think[0]);
    state.think = { phase: 'think', t: 0, dur, text: '', plan: null, id: -1, progress: 0 };
    state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
    state.ph = 'think'; state.pt = 0;
  }
  const doThrow = (plan, noise, rnd) => {
    const m = state.m, team = m.turn, dir = dirOf(team), T = targets(m);
    state.mask = maskOf(m);
    const line = throwLine(m, T.king);
    state.line = line;
    const err = errFor(plan.loft, noise, rnd);
    const L = launchFor(plan, line.y, dir, err);
    const b = batonFrom(L, 100 + m.baton + 10 * m.turnNo);
    b.team = team;
    addBody(state.world, b);
    state.pref[team] = { loft: plan.loft, spin: plan.spin };
    state.flight = { L, t: 0, quiet: 0, hit: false, id: b.id };
    state.ph = 'flight'; state.pt = 0; state.hint = null; hintJob = null; state.sheet = false; state.drag = null; state.swing = 0.6; state.fast = false;
    state.banner = null;
    sfx.whoosh();
    if (state.humanTurn && mode() !== 'watch') record.throws = (record.throws | 0) + 1;
  };
  const handleEvents = (list) => {
    const w = state.world;
    for (const e of w.events) {
      if (e.k === 'hit') {
        if (e.a.kind === 'baton' || (e.b && e.b.kind === 'baton')) { sfx.crack(e.s / 6); chips(list, e.x, e.y, e.z, 2 + Math.min(5, Math.round(e.s / 4))); dust(list, e.x, e.y, 0.05, 2, 1.2); if (state.flight) state.flight.hit = true; }
        else sfx.clack(e.s / 4);
      } else if (e.k === 'ground' && e.s > 2.2) {
        sfx.thud(e.s / 6); dust(list, e.x, e.y, 0.02, e.s > 8 ? 3 : 1, 0.8);
        if (e.a.kind === 'baton' && state.flight && !state.flight.landed) { state.flight.landed = true; state.marks.push({ x: e.x, y: e.y, t: 0, team: e.a.team }); }
      }
    }
    w.events.length = 0;
  };
  const resolveThrow = () => {
    const m = state.m, w = state.world, mask = state.mask;
    // everything that is still moving is put to rest where it is, so the picture and the rules agree
    for (const b of w.bodies) { b.asleep = true; b.v = [0, 0, 0]; b.w = [0, 0, 0]; }
    const pre = new Map(w.bodies.filter((b) => b.kind !== 'baton').map((b) => [b.id, { p: b.p.slice(), q: b.q.slice() }]));
    const res = applyThrow(m, finalsOf(w), mask);
    for (const id of res.cleared) { const o = pre.get(id); if (o) state.fades.push({ p: o.p, q: o.q, team: m.blocks[id].team, t: 0 }); }
    syncWorld();
    for (const id of res.restored) { const b = m.blocks[id]; dust(state.parts, b.x, b.y, 0.2, 3); }
    const t = m.turn, other = 1 - t, team = sideName(state, t);
    let head = '', sub = '', kind = `team${t}`;
    if (res.win >= 0) {
      if (res.win === t) { head = 'The king falls!'; sub = `${team} ${team === 'You' ? 'win' : 'wins'}`; sfx.win(); }
      else { head = 'King down too early'; sub = `${sideName(state, res.win)} ${sideName(state, res.win) === 'You' ? 'win' : 'wins'}`; kind = 'bad'; sfx.bad(); }
    } else if (res.knocked.length) { head = res.knocked.length === 1 ? 'Kubb down!' : `${res.knocked.length} kubbs down!`; sub = `${sideName(state, other)} will throw ${res.knocked.length === 1 ? 'it' : 'them'} back in`; sfx.chime(Math.min(3, res.knocked.length)); }
    else if (res.cleared.length) { head = res.cleared.length === 1 ? 'Field kubb cleared' : `${res.cleared.length} field kubbs cleared`; sfx.chime(1); }
    else if (res.restored.length) { head = 'Not yet'; sub = mask.kind === 'field' ? 'Field kubbs come first: it stands up again' : 'That kubb stands up again'; kind = 'bad'; sfx.bad(); }
    else { head = 'No kubb down'; kind = ''; }
    state.resultLine = sub ? `${head} ${sub}.` : `${head}.`;
    showBanner(head, sub, kind, res.win >= 0 ? 2.4 : 1.35, 60);
    state.ph = 'result'; state.pt = 0; state.flight = null; state.fast = false;
    if (m.cfg.mode === 'learn') evalLesson(); else saveResume();
    if (state.humanTurn && mode() !== 'watch') record.knockedDown = (record.knockedDown | 0) + res.knocked.length + res.cleared.length;
  };
  const evalLesson = () => {
    const m = state.m, L = m.lesson; L.used++;
    const p = L.pass;
    if (p === 'knock') L.passed = L.passed || m.knocked[0] > 0;
    else if (p === 'field') L.passed = fieldOf(m, 0).length === 0 && m.queue.length === 0;
    else if (p === 'base3') L.passed = baseOf(m, 1).length === 0;
    else if (p === 'king') L.passed = !!m.over && m.over.win === 0;
    if (m.over && m.over.win === 1 && !L.passed) L.failMsg = 'the king fell too early';
  };
  const afterResult = () => {
    const m = state.m;
    state.banner = null;
    if (m.cfg.mode === 'learn') {
      const L = m.lesson;
      if (L.passed || m.over || turnOver(m)) {
        if (L.passed) record.learn = Math.max(record.learn, L.idx + 1); else if (!L.failMsg) L.failMsg = 'the batons ran out';
        save(); state.scene = 'result'; state.ui.scroll = 0; return;
      }
      startBatons(); return;
    }
    if (m.over) { finishMatch(); return; }
    if (turnOver(m)) {
      clearBatons(); endTurn(m);
      if (m.over) { finishMatch(); return; }
      saveResume();
      state.tossN = m.queue.length;
      beginTurn(true);
      return;
    }
    saveResume();
    startBatons();
  };
  const finishMatch = () => {
    const m = state.m;
    state.scene = 'result'; state.ui.scroll = 0; state.page = 0; state.banner = null;
    clearResume();
    if (m.cfg.mode === 'ai') {
      record.played++;
      if (m.over.win === 0) record.wins[m.cfg.opp] = (record.wins[m.cfg.opp] | 0) + 1;
    }
    if (m.over.win === 0 || m.cfg.mode === 'two') sfx.win();
    save();
  };

  // ---- the Think hint ---------------------------------------------------------------------------------------------------------------------------
  const humanProfile = () => ({ scan: 999, verify: 3, samples: 12, rand: 0, noise: humanNoise() });
  const requestHint = () => {
    if (!state.humanTurn || (state.ph !== 'aim' && state.ph !== 'toss')) return;
    if (state.hint && !state.hint.busy) { state.hint = null; return; }
    if (state.hint) return;
    if (state.ph === 'toss') {
      const adv = tossAdvice(state.m, state.m.turn, humanNoise(), lcg(900 + state.m.turnNo * 7 + state.m.queue.length));
      state.hint = { busy: false, progress: 1, plan: { x: adv.x, y: adv.y }, text: adv.text, toss: true };
      sfx.tick(); return;
    }
    hintJob = batonJob(state.m, humanProfile(), { salt: 99 });
    state.hint = { busy: true, progress: 0, text: '', plan: null };
    sfx.tick();
  };
  const stepHint = () => {
    if (!hintJob || !state.hint || !state.hint.busy) return;
    if (stepJob(hintJob)) {
      const r = hintJob.result;
      state.hint = { busy: false, progress: 1, plan: r.plan, id: r.id, text: describeShot(state.m, r, ASSIST[state.settings.assist].name.toLowerCase()) };
      hintJob = null;
    } else state.hint.progress = hintJob.progress;
  };
  const useHint = () => {
    if (!state.hint || state.hint.busy) return;
    if (state.hint.toss) { state.toss.target = clampToss(state.m.turn, state.hint.plan.x, state.hint.plan.y); state.hint = null; sfx.tick(); return; }
    setPlan({ ...state.hint.plan }); state.hint = null; sfx.tick();
  };

  // ---- the plan: what a person controls -------------------------------------------------------------------------------------------------------------
  const setPlan = (patch) => {
    const p = { ...state.plan, ...patch };
    p.sx = clamp(Math.round(p.sx * 1000) / 1000, -STAND_MAX, STAND_MAX);
    p.ax = clamp(Math.round(p.ax * 1000) / 1000, -FIELD.W / 2 - 0.4, FIELD.W / 2 + 0.4);
    p.ay = clamp(Math.round(p.ay * 1000) / 1000, -0.4, FIELD.L + 0.4);
    p.loft = clamp(p.loft | 0, 0, 2); p.spin = clamp(p.spin | 0, 0, 2);
    state.plan = p;
  };
  const planFromPull = (dxPx, dyPx) => {
    const dir = dirOf(state.m.turn), forward = dir > 0 ? dyPx : -dyPx;
    const dist = clamp(REACH_MIN + Math.max(0, forward) * KY, REACH_MIN, MAX_REACH - 0.6);
    return { ax: state.plan.sx - dxPx * KX, ay: state.line.y + dir * dist };
  };

  // ---- computer players ---------------------------------------------------------------------------------------------------------------------------------
  const updateThink = (dt) => {
    const m = state.m, team = m.turn, prof = profOf(team), watch = mode() === 'watch', th = state.think;
    if (!th) { if (m.phase === 'throwin' && m.queue.length) startToss(); else startThinkBaton(); return; }
    const revealDur = REVEAL_SECS * (1 + (TEXT_SCALES[state.settings.textIdx] - 1));
    if (th.tossing) {   // a computer throws a kubb in
      th.t += dt;
      if (th.phase === 'think' && th.t >= th.dur) { th.t = 0; if (watch) { th.phase = 'reveal'; th.dur = revealDur; sfx.tick(); } else { th.phase = 'act'; th.dur = 0.5; } }
      else if (th.phase === 'reveal' && th.t >= th.dur) { th.phase = 'act'; th.t = 0; th.dur = 0.5; }
      else if (th.phase === 'act' && th.t >= th.dur) { state.toss.target = { ...th.plan }; doToss(th.plan.x, th.plan.y, prof.noise * 0.9, rn); }
      return;
    }
    if (th.phase === 'think') {
      if (aiJob) {
        if (stepJob(aiJob)) { const r = aiJob.result; th.plan = r.plan; th.id = r.id; th.line = r.line; if (watch) th.text = describeShot(m, r, `${prof.name}'s`); aiJob = null; th.progress = 1; } else th.progress = aiJob.progress;
      }
      th.t += dt;
      if (th.plan && th.t >= th.dur) {
        th.t = 0;
        if (watch) { th.phase = 'reveal'; th.dur = revealDur; sfx.tick(); } else { th.phase = 'act'; th.dur = 0.7; }
        state.line = th.line;
        setPlan({ ...th.plan });
      }
    } else if (th.phase === 'reveal') {
      th.t += dt;
      if (th.t >= th.dur) { th.phase = 'act'; th.t = 0; th.dur = 0.7; }
    } else if (th.phase === 'act') {
      th.t += dt;
      if (th.t >= th.dur) { setPlan({ ...th.plan }); doThrow(state.plan, prof.noise, rn); }
    }
  };

  // ---- pause / why -----------------------------------------------------------------------------------------------------------------------------------------
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
    state.tossAnim = null; state.flight = null; state.overlay = null;
  };

  // ---- overlays and paddles for the renderer -------------------------------------------------------------------------------------------------------
  const arcPts = (from, to, apex, n = 22) => {
    const out = [];
    for (let i = 0; i <= n; i++) { const k = i / n; out.push({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z * (1 - k) + 0.17 * k + Math.sin(Math.PI * k) * apex }); }
    return out;
  };
  const setOverlay = () => {
    const m = state.m, ph = state.ph, th = state.think, team = m.turn, dir = dirOf(team);
    const T = targets(m);
    let ov = null;
    if (ph === 'aim' && state.humanTurn) {
      const L = launchFor(state.plan, state.line.y, dir, {});
      const dist = Math.hypot(state.plan.ax - L.r.x, state.plan.ay - L.r.y), sc = scatterAt(state.plan.loft, dist, humanNoise());
      const pts = pathOf(L, 40), kp = kingPos(m);
      // a low flight over the king (the king may only fall last) gets a warning
      const lowOverKing = !T.king && pts.some((q) => Math.hypot(q.x - kp.x, q.y - kp.y) < 0.4 && q.z < 1.1);
      ov = { line: state.line.adv ? state.line : null, legal: T.ids, rings: [{ x: state.plan.ax, y: state.plan.ay, col: '#ffe08a', scatter: sc }], paths: [{ pts, col: 'rgba(255,240,170,0.95)' }], labels: [{ x: state.plan.ax, y: state.plan.ay, z: 0, text: `${dist.toFixed(1)} m`, col: '#ffe9a0', below: dir > 0 }] };
      if (lowOverKing) { ov.warn = { x: kp.x, y: kp.y }; ov.labels.push({ x: kp.x, y: kp.y, z: 1.15, text: 'Too low: may hit the king', col: '#ffb4a0' }); }
      if (state.hint && !state.hint.busy && state.hint.plan && !state.hint.toss) {
        const hp = state.hint.plan, HL = launchFor(hp, state.line.y, dir, {});
        ov.rings.push({ x: hp.ax, y: hp.ay, col: '#7de8ff', r: 0.14 }); ov.paths.push({ pts: pathOf(HL, 26), col: 'rgba(125,232,255,0.9)' }); ov.chosen = state.hint.id;
      }
    } else if (ph === 'think' && th && !th.tossing && th.plan && (th.phase === 'reveal' || th.phase === 'act')) {
      const p = state.plan, ln = th.line ?? state.line, L = launchFor(p, ln.y, dir, {}), dist = Math.hypot(p.ax - L.r.x, p.ay - L.r.y);
      ov = { line: ln.adv ? ln : null, legal: th.phase === 'reveal' ? T.ids : null, chosen: th.id, rings: [{ x: p.ax, y: p.ay, col: '#bfe8ff', r: 0.16, scatter: scatterAt(p.loft, dist, profOf(team).noise) }], paths: [{ pts: pathOf(L, 26), col: 'rgba(191,232,255,0.95)' }], labels: th.phase === 'reveal' ? [{ x: p.ax, y: p.ay, z: 0, below: dir > 0, text: `${LOFTS[p.loft].name} loft · ${SPINS[p.spin].name} spin`, col: '#bfe8ff' }] : [] };
    } else if (ph === 'toss' && state.humanTurn && state.toss) {
      const tg = state.toss.target, base = baselineY(team), dist = Math.abs(tg.y - base), k = 0.6 + 0.4 * dist / FIELD.L, nz = humanNoise();
      ov = { zone: tossZone(team), legal: [state.toss.id], rings: [{ x: tg.x, y: tg.y, col: '#ffe08a', scatter: { across: 0.1 * nz * k, along: 0.15 * nz * k } }], paths: [{ pts: arcPts({ x: 0, y: base - dir * 0.45, z: 0.55 }, tg, 1.0 + dist * 0.16), col: 'rgba(255,240,170,0.9)' }] };
      if (state.hint && !state.hint.busy && state.hint.plan && state.hint.toss) ov.rings.push({ x: state.hint.plan.x, y: state.hint.plan.y, col: '#7de8ff', r: 0.14 });
    } else if (ph === 'think' && th && th.tossing && (th.phase === 'reveal' || th.phase === 'act')) {
      ov = { zone: tossZone(team), rings: [{ x: th.plan.x, y: th.plan.y, col: '#bfe8ff', r: 0.16 }], paths: [{ pts: arcPts({ x: 0, y: baselineY(team) - dir * 0.45, z: 0.55 }, th.plan, 1.2), col: 'rgba(191,232,255,0.95)' }] };
    } else if (ph === 'place' && state.humanTurn) ov = { zone: tossZone(team) };
    else if ((ph === 'flight' || ph === 'result') && state.line && state.line.adv) ov = { line: state.line };
    state.overlay = ov;
    // the paddles: each team's stand marker behind its baseline; the one that is about to throw leans with the pull
    const pad = [];
    for (const tm of [0, 1]) {
      const d = dirOf(tm), active = tm === team && !m.over;
      let x = 0, y = baselineY(tm) - d * 0.45, lean = 0, held = true;
      if (active) {
        const toss = ph === 'toss' || ph === 'tossfly' || ph === 'place' || (ph === 'think' && th && th.tossing);
        if (!toss) { x = state.plan.sx; y = state.line.y - d * 0.45; }
        if (ph === 'aim' && state.drag && state.drag.kind === 'pull') lean = -clamp(state.drag.len / 260, 0, 1);
        else if (ph === 'think' && th && th.phase === 'act') lean = -clamp(th.t / th.dur, 0, 1) * 0.8;
        if (state.swing > 0) { const k = state.swing / 0.6; lean = k > 0.75 ? -0.4 + (1 - k) * 8 * 0.9 : 0.5 * Math.max(0, k / 0.75); held = k > 0.8; }
        if (ph === 'flight' || ph === 'result') held = false;
      }
      lean += 0.035 * Math.sin(state.t * 1.6 + tm * 2.1);
      pad.push({ x, y, dir: d, team: tm, lean, held, scale: tm === 0 ? 1 : 0.92 });
    }
    state.paddles = pad;
  };
  const stepVisuals = (dt) => {
    state.parts = stepParts(state.parts, dt);
    for (const f of state.fades) f.t += dt;
    for (const mk of state.marks) mk.t += dt;
    state.marks = state.marks.filter((mk) => mk.t < 2.6);
    state.fades = state.fades.filter((f) => f.t < 0.6);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.dur) state.banner = null; }
    if (state.swing > 0) state.swing = Math.max(0, state.swing - dt);
  };

  // ---- input: the play screen ------------------------------------------------------------------------------------------------------------------------------
  const pressRect = (R, ptr) => { for (const id of Object.keys(R)) if (inRect(R[id], ptr.x, ptr.y)) return id; return null; };
  const stand = (d) => { if (state.ph !== 'aim') return; const px = state.plan.sx; setPlan({ sx: px + d }); setPlan({ ax: state.plan.ax + (state.plan.sx - px) }); };
  const handleTrayId = (id) => {
    if (!id) return false;
    switch (id) {
      case 'loft0': case 'loft1': case 'loft2': setPlan({ loft: Number(id.slice(4)) }); sfx.tick(); return true;
      case 'spin0': case 'spin1': case 'spin2': setPlan({ spin: Number(id.slice(4)) }); sfx.tick(); return true;
      case 'think': requestHint(); return true;
      case 'use': useHint(); return true;
      case 'more': openWhy(); return true;
      case 'left': stand(-0.12); sfx.tick(); return true;
      case 'right': stand(0.12); sfx.tick(); return true;
      case 'menu': openPause(); return true;
      case 'setup': state.sheet = true; state.ui.scroll = 0; return true;
      case 'skip': if (state.ph === 'flight') state.fast = true; else if (state.ph === 'result') afterResult(); return true;
      default: return false;
    }
  };
  const inFieldArea = (lay, ptr) => (lay.clip ? inRect(lay.clip, ptr.x, ptr.y) : ptr.y > lay.hud.h - 10 && ptr.y < lay.trayTop - 4);
  const sceneGround = (lay, ptr) => SC.unproj((ptr.x - lay.vx) / lay.s, (ptr.y - lay.vy) / lay.s + SCENE_Y0);
  const updateAimInput = (dt, input, lay) => {
    const ptr = input.pointer, keys = input.keys, R = lay.rects;
    if (ptr.pressed) {
      const id = pressRect(R, ptr);
      if (id && handleTrayId(id)) return;
      if (inFieldArea(lay, ptr)) state.drag = { kind: 'pull', x0: ptr.x, y0: ptr.y, x: ptr.x, y: ptr.y, len: 0 };
    }
    const d = state.drag;
    if (d && ptr.down) {
      d.x = ptr.x; d.y = ptr.y;
      const dx = (ptr.x - d.x0) / lay.s, dy = (ptr.y - d.y0) / lay.s;
      d.len = Math.hypot(dx, dy);
      if (d.len >= PULL_MIN * 0.5) setPlan(planFromPull(dx, dy));
    }
    if (d && ptr.released) {
      state.drag = null;
      const dx = (ptr.x - d.x0) / lay.s, dy = (ptr.y - d.y0) / lay.s, back = dirOf(state.m.turn) > 0 ? dy : -dy;
      if (d.len >= PULL_MIN && back >= PULL_MIN * 0.6) { setPlan(planFromPull(dx, dy)); doThrow(state.plan, humanNoise(), hn); return; }
      if (d.len >= PULL_MIN) toast('Pull back towards you, then let go', 1.8);
    }
    if (!ptr.down && state.drag) state.drag = null;
    const sp = 0.6 * dt;
    if (keys.down.has('ArrowLeft')) setPlan({ ax: state.plan.ax - sp });
    if (keys.down.has('ArrowRight')) setPlan({ ax: state.plan.ax + sp });
    if (keys.down.has('ArrowUp')) setPlan({ ay: state.plan.ay + dirOf(state.m.turn) * sp });
    if (keys.down.has('ArrowDown')) setPlan({ ay: state.plan.ay - dirOf(state.m.turn) * sp });
    if (keys.down.has('KeyA')) stand(-sp * 0.5);
    if (keys.down.has('KeyD')) stand(sp * 0.5);
    if (keys.pressed.has('Digit1')) setPlan({ loft: 0 });
    if (keys.pressed.has('Digit2')) setPlan({ loft: 1 });
    if (keys.pressed.has('Digit3')) setPlan({ loft: 2 });
    if (keys.pressed.has('KeyZ')) setPlan({ spin: Math.max(0, state.plan.spin - 1) });
    if (keys.pressed.has('KeyX')) setPlan({ spin: Math.min(2, state.plan.spin + 1) });
    if (keys.pressed.has('KeyH')) requestHint();
    if (keys.pressed.has('Space') || keys.pressed.has('Enter')) doThrow(state.plan, humanNoise(), hn);
  };
  const updateTossInput = (dt, input, lay) => {
    const ptr = input.pointer, keys = input.keys, R = lay.rects, team = state.m.turn;
    if (ptr.pressed) {
      const id = pressRect(R, ptr);
      if (id && handleTrayId(id)) return;
      if (inFieldArea(lay, ptr)) { state.drag = { kind: 'toss', x0: ptr.x, y0: ptr.y, len: 0 }; const g = sceneGround(lay, ptr); state.toss.target = clampToss(team, g.x, g.y); }
    }
    const d = state.drag;
    if (d && ptr.down) { const g = sceneGround(lay, ptr); state.toss.target = clampToss(team, g.x, g.y); d.len = Math.hypot(ptr.x - d.x0, ptr.y - d.y0); }
    if (d && ptr.released) { state.drag = null; const tg = state.toss.target; doToss(tg.x, tg.y, humanNoise(), hn); return; }
    if (!ptr.down && state.drag) state.drag = null;
    const sp = 0.8 * dt, tg = state.toss.target;
    if (keys.down.has('ArrowLeft')) state.toss.target = clampToss(team, tg.x - sp, tg.y);
    if (keys.down.has('ArrowRight')) state.toss.target = clampToss(team, tg.x + sp, tg.y);
    if (keys.down.has('ArrowUp')) state.toss.target = clampToss(team, tg.x, tg.y + sp);
    if (keys.down.has('ArrowDown')) state.toss.target = clampToss(team, tg.x, tg.y - sp);
    if (keys.pressed.has('KeyH')) requestHint();
    if (keys.pressed.has('Space') || keys.pressed.has('Enter')) doToss(state.toss.target.x, state.toss.target.y, humanNoise(), hn);
  };
  const updatePlaceInput = (dt, input, lay) => {
    const ptr = input.pointer;
    if (!ptr.pressed) return;
    const id = pressRect(lay.rects, ptr);
    if (id && handleTrayId(id)) return;
    if (inFieldArea(lay, ptr)) { const g = sceneGround(lay, ptr); placeKubb(g.x, g.y); }
  };
  const handleSheet = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'loft-') setPlan({ loft: state.plan.loft - 1 }); else if (id === 'loft+') setPlan({ loft: state.plan.loft + 1 });
    else if (id === 'spin-') setPlan({ spin: state.plan.spin - 1 }); else if (id === 'spin+') setPlan({ spin: state.plan.spin + 1 });
    else if (id === 'st-') stand(-0.12); else if (id === 'st+') stand(0.12);
    else if (id === 'think') requestHint(); else if (id === 'use') useHint();
    else if (id === 'close') state.sheet = false;
    else if (id === 'smenu') { state.sheet = false; openPause(); }
  };
  const flightTick = () => {
    const w = state.world, f = state.flight;
    if (!f) return;
    savePrev(w);
    const n = state.fast ? SUB * 6 : SUB;
    for (let i = 0; i < n; i++) { stepWorld(w); f.t += DT; }
    handleEvents(state.parts);
    stepped = true;
    const baton = w.bodies.find((b) => b.kind === 'baton' && b.id === f.id);
    const settled = baton ? (!baton.flight && kubbsAtRest(w)) : kubbsAtRest(w);
    if (settled && f.t > 0.6) f.quiet++; else f.quiet = 0;
    if (f.quiet >= 14 || f.t > 9) resolveThrow();
  };
  const startBatonsOrToss = () => { const m = state.m; state.banner = null; if (m.phase === 'throwin' && m.queue.length) { state.tossN = m.queue.length; startToss(); } else startBatons(); };
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
    if (state.sheet && state.ph === 'aim') { updateFlowScene(dt, input, handleSheet, 'sheet'); stepHint(); return; }
    if (watch && ptr.pressed) {
      const id = pressRect(lay.rects, ptr);
      if (id === 'wpause') { state.paused = !state.paused; sfx.tick(); }
      else if (id === 'wdec') { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); }
      else if (id === 'winc') { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); }
      else if (id === 'more') openWhy();
      else if (id === 'wexit') { leaveMatch(); return; }
    }
    // Everything below is frozen while paused: timers, the computer's search, the baton, the blocks, the particles.
    if (state.paused) return;
    toneBudget = 0;
    stepVisuals(dt);
    state.pt += dt;
    const ph = state.ph;
    if (!watch && ptr.pressed && (ph === 'think' || ph === 'intro' || ph === 'tossfly') && pressRect(lay.rects, ptr) === 'menu') { openPause(); return; }
    if (ph === 'intro') {
      const learn = m.cfg.mode === 'learn';
      if (state.pt >= (learn ? 1e9 : 1.4) || (ptr.pressed && state.pt > 0.35)) { if (learn) startBatonsOrToss(); else afterIntro(); }
    } else if (ph === 'aim') { stepHint(); if (state.humanTurn) updateAimInput(dt, input, lay); }
    else if (ph === 'toss') { if (state.humanTurn) updateTossInput(dt, input, lay); }
    else if (ph === 'place') updatePlaceInput(dt, input, lay);
    else if (ph === 'think') updateThink(dt);
    else if (ph === 'tossfly') {
      const a = state.tossAnim;
      a.t += dt * (state.fast ? 3 : 1);
      if (a.fault && a.t > a.pick + a.dur) a.fadeOut = clamp((a.t - a.pick - a.dur - 0.5) / 0.5, 0, 1);
      if (!watch && ptr.pressed) { const id = pressRect(lay.rects, ptr); if (id) handleTrayId(id); }
      if (a.t >= a.pick + a.dur && !a.landed) { a.landed = true; dust(state.parts, a.to.x, a.to.y, 0, 3, 0.8); sfx.thud(0.7); }
      if (a.t >= a.pick + a.dur + (a.fault ? 1.0 : 0.5)) finishToss();
    } else if (ph === 'flight') {
      if (!watch && ptr.pressed) { const id = pressRect(lay.rects, ptr); if (id) handleTrayId(id); }
      flightTick();
    } else if (ph === 'result') {
      if (!watch && ptr.pressed) { const id = pressRect(lay.rects, ptr); if (id) { handleTrayId(id); return; } }
      if (state.pt >= (state.m.over ? 2.4 : state.humanTurn ? 1.3 : 1.0) || (!watch && ptr.pressed && state.pt > 0.45)) afterResult();
    }
    if (state.scene === 'play') setOverlay();
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

  // ---- menus ----------------------------------------------------------------------------------------------------------------------------------------------------
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
    else if (id.startsWith('size')) { const i = Number(id.slice(4)); if (state.demo && i > 0) { state.setupMsg = 'That size is in the full game.'; return; } s.size = i; state.setupMsg = ''; }
    else if (id === 'open1') s.opening = true; else if (id === 'open0') s.opening = false;
    else if (id.startsWith('as')) { state.settings.assist = Number(id.slice(2)); save(); }
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, size: state.demo ? 3 : SIZES[s.size].kubbs, opening: s.opening !== false });
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
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) { handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
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

  // ---- the live lawn behind the title and the menus: a baton knocks kubbs over now and then ------------------------------------------------------------------------
  const ATTRACT = [[-0.64, 5.95, 0, 1, -0.2], [0.64, 5.95, 0, 2, 0.3], [0.0, 5.95, 1, 1, 0], [-1.28, 5.9, 0, 0, -0.5], [1.28, 5.9, 0, 1, 0.6]];   // aim x, aim y, loft, spin, start x
  const startAttract = () => {
    const a = state.att, pick = ATTRACT[a.n++ % ATTRACT.length];
    a.m = newMatch({ mode: 'ai', size: 5, first: 0 }); a.world = worldFromMatch(a.m);
    addBody(a.world, batonFrom(launchOf(pick[4], 0, 1, pick[0], pick[1], pick[2], pick[3], {}), 100));
    a.wait = 0; a.done = false; a.t = 0;
    const sc = a.scene;
    sc.world = a.world; sc.parts = []; sc.paddles = [{ x: pick[4], y: -0.45, dir: 1, team: 0, lean: 0, held: false, scale: 1 }, { x: 0.2, y: FIELD.L + 0.45, dir: -1, team: 1, lean: 0, held: true, scale: 0.92 }];
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a.scene) {
      a.scene = { world: null, overlay: null, fades: [], parts: [], paddles: [], showPaddles: true, tossAnim: null, t: 0, alpha: 1, m: null, settings: state.settings };
      Object.defineProperty(a.scene, 'baked', { get: () => state.baked }); a.n = 0; startAttract();
    }
    a.scene.t = state.t; a.scene.m = a.m;
    a.scene.parts = stepParts(a.scene.parts, dt);
    const w = a.world;
    if (!a.done) {
      savePrev(w);
      for (let i = 0; i < SUB; i++) stepWorld(w);
      a.t += dt;
      for (const e of w.events) { if (e.k === 'hit' && e.s > 3) { chips(a.scene.parts, e.x, e.y, e.z, 2); dust(a.scene.parts, e.x, e.y, 0.05, 2); } else if (e.k === 'ground' && e.s > 3) dust(a.scene.parts, e.x, e.y, 0.02, 1); }
      w.events.length = 0;
      const baton = w.bodies.find((b) => b.kind === 'baton');
      if (a.t > 0.8 && baton && !baton.flight && kubbsAtRest(w)) a.done = true;
      if (a.t > 7) a.done = true;
      stepped = true;
    } else { a.wait += dt; if (a.wait > 1.4) startAttract(); }
  };
  const advanceBake = () => {
    if (state.baked || (bake && bake.failed)) return;
    if (!bake) bake = SC.startBake();
    if (bake.failed) return;
    const cv = bake.step(shotMode);
    if (cv) state.baked = cv;
  };

  // ---- shot presets (store screenshots): ?shot=1&seed=N picks a fixed, deterministic screen ------------------------------------------------------------------------------
  const NOINPUT = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const lieQ = (ang) => { const qa = qAxis(0, 0, 1, ang), qb = lyingQ; return [qa[0] * qb[0] - qa[3] * qb[3], qa[0] * qb[1] - qa[3] * qb[2], qa[0] * qb[2] + qa[3] * qb[1], qa[0] * qb[3] + qa[3] * qb[0]]; };
  // a mid-game board for the human: Orange has lost some kubbs, the turn is Blue's, the game is at turn 3
  const shotTurn = (setup) => {
    startMatch({ mode: 'ai', opp: 2, size: 5, first: 0 });
    const m = state.m;
    m.turnNo = 3; m.turn = 0; m.batons = 6; m.baton = 1; m.queue = []; m.phase = 'batons';
    setup(m);
    state.humanTurn = true; state.banner = null; syncWorld(); startBatons();
  };
  const applyPreset = () => {
    const n = ((shotSeed % 100) + 100) % 100;
    state.shot = true; record.throws = 10;
    advanceBake();
    if (n === 60) { state.showcase = true; state.settings.thinkIdx = 0; state.thinkSecs = 2; startMatch({ mode: 'watch', watchA: 3, opp: 4, size: 3, first: 0 }); state.shot = false; return; }
    if (n === 1) { state.scene = 'title'; for (let i = 0; i < 70; i++) updateAttract(1 / 60); return; }
    if (n === 2) {   // aiming at a baseline kubb
      shotTurn((m) => { Object.assign(m.blocks[5], { role: 'fallen', down: true, x: 0.2, y: 6.1, z: KUBB.w / 2, q: lieQ(0.4) }); m.blocks[6].role = 'cleared'; });
      setPlan({ sx: -0.3, ax: 0.64, ay: 6.1, loft: 0, spin: 2 }); setOverlay(); return;
    }
    if (n === 3 || n === 4 || n === 5 || n === 12) {   // a baton in the air / the crash / the result
      shotTurn((m) => { m.blocks[5].role = 'cleared'; });
      setPlan({ sx: -0.2, ax: -0.64, ay: 6.4, loft: 0, spin: 2 });
      doThrow(state.plan, 0, hn);
      const steps = n === 3 ? 110 : n === 4 ? 262 : n === 5 ? 240 : 140;
      for (let i = 0; i < steps; i++) { stepWorld(state.world); state.flight.t += DT; handleEvents(state.parts); }
      state.parts = stepParts(state.parts, 0.06);
      for (const b of state.world.bodies) { b.pp = b.p.slice(); b.pq = b.q.slice(); }
      if (n === 5) { for (let i = 0; i < 700; i++) stepWorld(state.world); state.world.events.length = 0; state.parts = []; resolveThrow(); state.banner.t = 0.5; }
      setOverlay(); return;
    }
    if (n === 6) {   // throwing kubbs in
      shotTurn((m) => { for (const i of [0, 1]) m.blocks[i].role = 'fallen'; Object.assign(m.blocks[0], { down: true, x: -0.7, y: 1.5, z: KUBB.w / 2, q: lieQ(0.3) }); Object.assign(m.blocks[1], { down: true, x: 0.6, y: 2.0, z: KUBB.w / 2, q: lieQ(-0.5) }); startTurn(m); m.batons = 6; });
      state.tossN = 2; startToss(); state.banner = null; setOverlay(); return;
    }
    if (n === 7) { state.back = 'title'; state.scene = 'rules'; state.page = 0; return; }
    if (n === 8) { state.back = 'title'; state.scene = 'howto'; state.page = 0; return; }
    if (n === 9) { state.scene = 'setup'; return; }
    if (n === 10) { state.scene = 'settings'; return; }
    if (n === 11) { state.back = 'title'; state.scene = 'about'; return; }
    if (n === 13) {   // Watch & Learn: the reveal
      startWatch(); state.m.cfg.watchA = 3; state.m.cfg.opp = 2;
      state.banner = null; state.m.phase = 'batons'; state.m.queue = []; state.humanTurn = false; syncWorld(); startBatons();
      const job = batonJob(state.m, PROFILES[3], { salt: 0 }); while (!job.step(50));
      const r = job.result; state.think = { phase: 'reveal', t: 0.8, dur: 2, plan: r.plan, id: r.id, line: r.line, text: describeShot(state.m, r, "Anders's"), progress: 1 };
      state.ph = 'think'; setPlan(r.plan); state.line = r.line; setOverlay(); return;
    }
    if (n === 17) {   // the advantage line: an Orange kubb was left standing in Blue's half
      shotTurn((m) => { Object.assign(m.blocks[5], { role: 'field', x: 0.5, y: 1.6, z: KUBB.h / 2 }); Object.assign(m.blocks[6], { role: 'fallen', down: true, x: -0.9, y: 5.4, z: KUBB.w / 2, q: lieQ(0.4) }); m.blocks[8].role = 'cleared'; });
      state.humanTurn = true; startBatons(); setPlan({ sx: -0.3, ax: -0.64, ay: 6.4, loft: 0, spin: 2 }); setOverlay(); return;
    }
    if (n === 18) {   // the king is next
      shotTurn((m) => { for (const i of [5, 6, 7, 8, 9]) m.blocks[i].role = 'cleared'; });
      startBatons(); setPlan({ sx: 0.2, ax: 0, ay: 3.2, loft: 1, spin: 1 }); setOverlay(); return;
    }
    if (n === 19) {   // the Think hint
      shotTurn((m) => { Object.assign(m.blocks[5], { role: 'fallen', down: true, x: 0.2, y: 6.1, z: KUBB.w / 2, q: lieQ(0.4) }); m.blocks[6].role = 'cleared'; });
      requestHint(); while (hintJob && !hintJob.step(50)); stepHint(); setOverlay(); return;
    }
    if (n === 31) {   // Two Players: Orange throws from the top
      startMatch({ mode: 'two', size: 5, first: 1 });
      const m = state.m; m.turnNo = 3; m.baton = 1; m.batons = 6; m.queue = []; m.phase = 'batons'; m.blocks[0].role = 'cleared';
      state.humanTurn = true; state.banner = null; syncWorld(); startBatons(); setOverlay(); return;
    }
    if (n === 32 || n === 33) {   // a kubb in the air on its way into the other half
      shotTurn((m) => { for (const i of [0, 1]) m.blocks[i].role = 'fallen'; Object.assign(m.blocks[0], { down: true, x: -0.7, y: 1.5, z: KUBB.w / 2, q: lieQ(0.3) }); Object.assign(m.blocks[1], { down: true, x: 0.6, y: 2.0, z: KUBB.w / 2, q: lieQ(-0.5) }); startTurn(m); m.batons = 6; });
      state.tossN = 2; startToss(); state.banner = null;
      doToss(-0.6, 4.4, 0, hn); state.tossAnim.t = n === 32 ? 0.2 : 0.4 + 0.5; setOverlay(); return;
    }
    if (n === 34) { shotTurn((m) => { m.blocks[5].role = 'cleared'; }); state.paused = true; state.pauseMenu = true; return; }
    if (n === 14) { state.scene = 'learn'; return; }
    if (n === 15) { startLesson(1); state.banner = null; state.tossN = 2; startToss(); setOverlay(); return; }
    if (n === 16) {   // the result screen
      startMatch({ mode: 'ai', opp: 2, size: 5, first: 0 });
      const m = state.m; m.over = { win: 0, why: 'The king fell after the last kubb.' }; m.turnNo = 7; m.knocked = [5, 3]; m.cleared = [4, 3];
      for (const b of m.blocks) if (b.team === 1) b.role = 'cleared';
      state.scene = 'result'; return;
    }
    if (n >= 20 && n <= 29) {
      state.settings.textIdx = 4;
      if (n === 20) { state.back = 'title'; state.scene = 'rules'; state.page = 2; }
      else if (n === 21) state.scene = 'title';
      else if (n === 22) { shotTurn((m) => { m.blocks[5].role = 'cleared'; }); setOverlay(); }
      else if (n === 23) state.scene = 'settings';
      else if (n === 24) state.scene = 'setup';
      else if (n === 25) { shotTurn((m) => { m.blocks[5].role = 'cleared'; }); state.sheet = true; }
      else if (n === 26) { startMatch({ mode: 'ai', opp: 2, size: 5, first: 0 }); state.m.over = { win: 1, why: 'The king fell too early.' }; state.scene = 'result'; }
      else if (n === 27) { state.back = 'title'; state.scene = 'about'; }
      else if (n === 28) { shotTurn((m) => { m.blocks[5].role = 'cleared'; }); state.ph = 'result'; showBanner('Kubb down!', 'Orange will throw it back in', 'team0', 99, 60); state.banner.t = 0.5; }
      else if (n === 29) { state.back = 'title'; state.scene = 'howto'; state.page = 1; }
      return;
    }
    if (n >= 40 && n <= 59) { state.back = 'title'; state.scene = 'rules'; state.page = n - 40; }
  };

  // ---- the object the kit and the shell see ----------------------------------------------------------------------------------------------------------------------------------
  const game = {
    // Watch & Learn, the lessons and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch' && state.m.cfg.mode !== 'learn') || state.paused,
    update(dt, input) {
      if (state.showcase) input = NOINPUT;
      setPress(input.pointer);
      stepped = false;
      if (state.shot) { state.t += dt; return; }
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      toneBudget = 0;
      advanceBake();
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
      updAt = nowMs();
    },
    render(ctx) {
      SC.setHost(ctx); setMeasureCtx(ctx);
      const alpha = stepped && env.clock ? clamp((nowMs() - updAt) / (DT * SUB * 1000), 0, 1) : 1;
      state.alpha = alpha; if (state.att.scene) state.att.scene.alpha = alpha;
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
            if (state.shot) setOverlay();
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
