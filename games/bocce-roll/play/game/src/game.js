// Bocce Roll: state and flow. Physics lives in sim.js, rules in match.js, drawing in view.js and menus.js, the opponents in ai.js.
// This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, bracket, howto/about/rules, demolimit.
// Throwing: press on the lower court where you want to stand along the foul line and drag back like a slingshot; pull length =
// power, pull direction = aim; release throws. The type buttons (Roll / Lob / Hit) and the curve control choose how.
import { createRng } from '../kit/rng.js';
import {
  createWorld, makeSurface, newBall, launch, stepWorld, previewThrow, clamp, MAX_ANG, TYPES, spinName, thePallino, COURT, HALF,
} from './sim.js';
import { newMatch, beginFrame, judgePallino, placePallino, whoNext, scoreOf, applyFrame, slotOf, PALLINO_ID } from './match.js';
import { createPlanner, executePlan, planPallino } from './ai.js';
import { PROFILES, PARTNER, TOUR_NAMES } from './opponents.js';
import { inRect, PULL, TEXT_SCALES, THINK_STEPS, layoutFor } from './layout.js';
import { renderPlay } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderBracket, hitScreen, flowMeta, pageCount, REF, ensureLayout, flowRects, lockupZone } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';
import { setPalette, TEAM } from './art.js';

// `meta.width/height` are updated live by the kit on every resize (fluid mode: the short side is always 720 units).
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_FRAME_CAP = 3;
const COURT_IDS = ['shell', 'clay', 'lawn', 'sand', 'daily'];

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const lay = () => layoutFor(meta.width, meta.height);
  const fx = rng.fork();
  const aiRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, calm: false, textIdx: 0, thinkIdx: 1, palette: 'classic' },
    record: { wins: [0, 0, 0, 0, 0, 0], played: 0, streak: 0, best: 0, demoFrames: 0, thrown: 0, cups: 0 },
    setup: { mode: 'ai', opp: 0, court: 'shell', target: 12 }, setupMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0,
    att: null, w: null, m: null, labels: [{ name: 'You', sub: null }, { name: 'Rival', sub: null }], tour: null,
    sel: { type: 0, spin: 0 }, rel: 0, drag: null, guide: null, preview: null, hint: null, hintRest: null, hintBusy: false, alts: null,
    parts: [], toast: '', toastT: 0, humanTurn: false, ff: 1, restT: 0, kb: null, kbOn: false,
    think: null, aiDrag: null, shake: null, pop: null, loaded: false, coach: false, explain: null, zoom: { z: 1, ax: 360, ay: 640 },
  };
  let planner = null, hintPlanner = null, previewKey = '', rumble = 0;

  // ---- persistence -----------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    while (state.record.wins.length < PROFILES.length) state.record.wins.push(0);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    setPalette(state.settings.palette);
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound -----------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    whoosh: () => tone({ freq: 380, to: 140, dur: 0.22, type: 'sawtooth', vol: 0.04 }),
    thud: (v) => tone({ freq: 120, to: 55, dur: 0.12, type: 'sine', vol: Math.min(0.26, 0.05 + v / 40) }),
    clack: (v) => {
      const q = Math.min(1, v / 8);
      tone({ freq: 2300 + fx.next() * 500, to: 1500, dur: 0.05, type: 'square', vol: 0.02 + 0.06 * q });
      tone({ freq: 820 + fx.next() * 120, to: 520, dur: 0.12, type: 'triangle', vol: 0.05 + 0.11 * q });
    },
    knock: (v) => tone({ freq: 190 + fx.next() * 30, to: 110, dur: 0.1, type: 'triangle', vol: Math.min(0.16, 0.04 + v / 40) }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 220, to: 140, dur: 0.2, type: 'sawtooth', vol: 0.06 }),
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.12 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- particles ---------------------------------------------------------------------------------
  const MAX_PARTS = 120;
  const dust = (parts, x, y, n, size = 3, col) => {
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) parts.push({ kind: 0, x, y, z: 0.05, vx: (fx.next() - 0.5) * 1.2, vy: (fx.next() - 0.4) * 1.2, vz: 0.4 + fx.next() * 0.8, t: 0, max: 0.5 + fx.next() * 0.5, size, a: 1, col });
  };
  const sparks = (parts, x, y, z, n) => {
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) parts.push({ kind: 1, x, y, z: z + 0.1, vx: (fx.next() - 0.5) * 5, vy: (fx.next() - 0.5) * 5, vz: 1 + fx.next() * 3, t: 0, max: 0.2 + fx.next() * 0.2, size: 1, a: 1 });
  };
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= 6 * dt; q.vx *= 0.97; q.vy *= 0.97; if (q.z < 0) { q.z = 0; q.vz = 0; } }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };

  // ---- the attract world behind the menus --------------------------------------------------------
  const startAttract = () => {
    const w = createWorld(makeSurface('shell', fx.fork()));
    const p = newBall(PALLINO_ID, -1, true); p.x = 0.2; p.y = 12.6; p.z = p.r; w.balls.push(p);
    [[0, -0.5, 11.8], [1, 0.45, 13.3], [0, 0.6, 12.0]].forEach(([team, x, y], i) => { const b = newBall(1 + i, team); b.x = x; b.y = y; b.z = b.r; w.balls.push(b); });
    state.att = { w, parts: [], t: 0, n: 3, wait: 2.2 };
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    a.wait -= dt;
    if (a.wait <= 0 && a.w.settled) {
      a.wait = 4.2;
      if (a.w.balls.length > 6) a.w.balls = a.w.balls.filter((b, i) => b.k || i > 3);
      const b = newBall(10 + a.n, a.n % 2); a.n++;
      a.w.balls.push(b);
      const pal = thePallino(a.w), x0 = (fx.next() - 0.5) * 1.6;
      const d = Math.hypot(pal.x - x0, pal.y - COURT.startY) - 0.3;
      launch(a.w, b, { type: 0, power: clamp((Math.sqrt(d * 3) - 1.8) / 5.3, 0.1, 1), ang: Math.atan2(pal.x - x0, pal.y - COURT.startY) + (fx.next() - 0.5) * 0.04, spin: 0, x: x0 });
    }
    if (!a.w.settled) {
      const ev = stepWorld(a.w, dt, []);
      for (const e of ev) {
        if (e.t === 'land' && e.v > 1.5) dust(a.parts, e.x, e.y, 3);
        else if (e.t === 'hit') sparks(a.parts, e.x, e.y, 0.1, 4);
      }
      a.w.balls = a.w.balls.filter((b) => !((b.out || b.dead) && b.fade > 1.1));
    }
    stepParts(a.parts, dt);
  };

  // ---- match flow --------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const mateOf = (i) => (i === 0 ? { ...PROFILES[0], id: 'pino', name: 'Pino' } : PROFILES[i - 1]);
  // who throws? a profile (AI) or null (a person). In a team game each side's players alternate balls.
  const playerOf = (side, slot) => {
    const c = state.m.cfg;
    if (c.mode === 'watch') return side === 0 ? PROFILES[c.watchA] : PROFILES[c.opp];
    if (c.mode === 'two') return null;
    if (c.mode === 'ai' || c.mode === 'tour') return side === 0 ? null : PROFILES[c.profile ?? c.opp];
    if (c.mode === 'team') return side === 0 ? (slot === 0 ? null : PARTNER) : (slot === 0 ? PROFILES[c.opp] : mateOf(c.opp));
    return null;
  };
  const curSlot = (side) => (state.m.phase === 'pallino' ? 0 : slotOf(state.m, side));
  const isAI = (side) => playerOf(side, curSlot(side)) !== null;
  const profNow = (side) => playerOf(side, curSlot(side));
  const nameOf = (side) => {
    const c = state.m.cfg, pf = playerOf(side, curSlot(side));
    if (c.mode === 'two') return side === 0 ? 'Player 1' : 'Player 2';
    return pf ? pf.name : 'You';
  };
  const makeLabels = (c) => {
    if (c.mode === 'two') return [{ name: 'Player 1', sub: null }, { name: 'Player 2', sub: null }];
    if (c.mode === 'watch') return [{ name: PROFILES[c.watchA].name, sub: null }, { name: PROFILES[c.opp].name, sub: null }];
    if (c.mode === 'team') return [{ name: 'Your team', sub: `You & ${PARTNER.name}`, plural: true }, { name: 'Rivals', sub: `${PROFILES[c.opp].name} & ${mateOf(c.opp).name}`, plural: true }];
    const rn = c.mode === 'tour' && state.tour ? state.tour.names[state.tour.oppIndex[state.tour.round]] : PROFILES[c.opp].name;
    return [{ name: 'You', sub: null }, { name: rn, sub: null }];
  };

  const startPallinoPhase = () => {
    const m = state.m;
    state.humanTurn = !isAI(m.turn);
    state.guide = null; state.hint = null; state.hintRest = null; state.alts = null; state.think = null; planner = null; state.preview = null;
    state.sel.type = Math.min(state.sel.type, 1);
    if (state.humanTurn && (state.record.thrown | 0) < 3) toast('Press the court, drag back, let go: the pallino has to pass the centre line', 4.5);
  };
  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoFrames >= DEMO_FRAME_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const surf = makeSurface(cfg.court, cfg.court === 'daily' ? createRng((config.day | 0) * 7919 + 13) : fx.fork());
    state.w = createWorld(surf);
    state.m = newMatch({ target: 12, mode: 'ai', opp: 0, court: cfg.court, firstPallino: aiRng.int(2), watchA: 3, team2: cfg.mode === 'team', ...cfg });
    state.labels = makeLabels(state.m.cfg);
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.parts = []; state.hint = null; state.guide = null; state.drag = null; state.pop = null; state.rel = 0; state.explain = null; state.zoom = { z: 1, ax: meta.width / 2, ay: meta.height / 2 };
    beginFrame(state.m, state.w);
    startPallinoPhase();
  };
  const startWatch = () => {
    const picks = [2, 3, 4, 5];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, court: ['shell', 'clay', 'lawn', 'sand'][aiRng.int(4)], target: 7 });
  };

  const handleEvents = (ev) => {
    for (const e of ev) {
      if (e.t === 'land') {
        if (e.v > 1.2) dust(state.parts, e.x, e.y, 2 + Math.floor(e.v), 3 + e.v * 0.3);
        sfx.thud(e.v);
      } else if (e.t === 'hit') {
        sparks(state.parts, e.x, e.y, e.z ?? 0.1, Math.min(10, 2 + Math.floor(e.v * 1.2)));
        sfx.clack(e.v);
        state.parts.push({ kind: 2, x: e.x, y: e.y, z: 0, vx: 0, vy: 0, vz: 0, t: 0, max: 0.4, size: 1, a: 1 });
        if (e.v > 5) state.shake = { t: 0, dur: 0.28, amp: Math.min(8, 2 + e.v * 0.5) };
      } else if (e.t === 'rail') { sfx.knock(e.v); dust(state.parts, e.x, e.y, 1, 2, '200,160,110'); }
      else if (e.t === 'wall') { sfx.knock(e.v); if (e.v > 4) state.shake = { t: 0, dur: 0.2, amp: 3 }; }
      else if (e.t === 'dead') { dust(state.parts, e.x, e.y, 5, 4); toast('Dead ball: it hit the back wall first', 2.6); sfx.no(); }
      else if (e.t === 'out') { toast(e.k ? 'The pallino left the court!' : 'Out of the court: that ball is dead', 2.4); sfx.no(); }
    }
  };

  const throwBall = (side, p, isPallino) => {
    const { m, w } = state;
    const b = isPallino ? newBall(PALLINO_ID, -1, true) : newBall(m.nextId++, side, false);
    w.balls.push(b);
    launch(w, b, p);
    if (!isPallino) { m.hand[side]--; m.thrown[side]++; m.throws++; }
    if (!isAI(side)) state.record.thrown = (state.record.thrown | 0) + 1;
    m.last = side; state.explain = null;
    m.phase = isPallino ? 'pallino-fly' : 'fly';
    state.humanTurn = false; state.guide = null; state.preview = null; state.hint = null; state.hintRest = null; state.alts = null; state.drag = null; state.think = null; state.aiDrag = null; state.coach = false;
    planner = null; hintPlanner = null; state.hintBusy = false; state.restT = 0;
    sfx.whoosh();
  };

  const startAim = () => {
    const m = state.m;
    m.phase = 'aim';
    state.humanTurn = !isAI(m.turn);
    state.hint = null; state.hintRest = null; state.alts = null; state.think = null; planner = null;
    const nm = nameOf(m.turn);
    if (m.cfg.mode === 'two') toast(`${nm}: your throw`, 1.6);
    else if (state.humanTurn && (state.record.thrown | 0) < 3) toast('Your throw: press the court, drag back, let go', 4);
  };

  const finishFrame = (res) => {
    const m = state.m;
    m.phase = 'score';
    m.endInfo = { ...res, t: 0 };
    state.humanTurn = false; state.think = null; planner = null;
    if (res.pts > 0) { state.pop = { text: `+${res.pts}`, t: 0, team: res.team }; for (let i = 0; i < Math.min(res.pts, 4); i++) sfx.chime(i); } else sfx.no();
    toast(res.text || (res.pts ? `${state.labels[res.team].name} ${state.labels[res.team].plural ? 'score' : 'scores'} ${res.pts}` : 'No score this frame'), 3.5);
  };

  const onSettled = () => {
    const { m, w } = state;
    w.balls = w.balls.filter((b) => !((b.out || b.dead) && !b.k));
    if (m.phase === 'pallino-fly') {
      const r = judgePallino(m, w);
      if (r.placed) { placePallino(m, w); toast(r.msg, 3); startAim(); return; }
      if (!r.ok) { toast(r.msg, 3.2); startPallinoPhase(); return; }
      startAim();
      return;
    }
    if (!thePallino(w)) { finishFrame(scoreOf(m, w)); return; }
    const n = whoNext(m, w);
    if (n < 0) { finishFrame(scoreOf(m, w)); return; }
    m.turn = n;
    startAim();
  };

  const afterFrame = () => {
    const m = state.m;
    applyFrame(m, m.endInfo);
    if (m.cfg.mode !== 'watch') state.record.demoFrames++;
    if (m.over) {
      state.scene = 'result'; state.ui.scroll = 0;
      const win = m.over.win === 0;
      if (m.cfg.mode === 'ai' || m.cfg.mode === 'team') {
        state.record.played++;
        if (win) { state.record.wins[m.cfg.opp]++; state.record.streak++; state.record.best = Math.max(state.record.best, state.record.streak); } else state.record.streak = 0;
      }
      if (m.cfg.mode === 'tour') tourResult(win);
      if (win && m.cfg.mode !== 'watch' && m.cfg.mode !== 'two') sfx.win();
      save();
    } else if (state.demo && m.cfg.mode !== 'watch' && state.record.demoFrames >= DEMO_FRAME_CAP) { save(); state.scene = 'demolimit'; state.ui.scroll = 0; }
    else { save(); beginFrame(m, state.w); startPallinoPhase(); }
  };

  // ---- the cup ------------------------------------------------------------------------------------
  const newTour = () => {
    const names = ['You', ...aiRng.shuffle(TOUR_NAMES)];
    const pick = (a, b) => (aiRng.next() < 0.5 ? a : b);
    const w23 = pick(2, 3), w45 = pick(4, 5), w67 = pick(6, 7), f = pick(w45, w67);
    state.tour = {
      names, round: 0, done: false, won: false, oppIndex: [1, w23, f], oppProf: [pick(1, 2), pick(3, 4), 5],
      plan: [[0, w23, w45, w67], [0, f], [0]], winners: [[-1, -1, -1, -1], [-1, -1], [-1]], alive: [],
    };
  };
  const tourResult = (win) => {
    const t = state.tour;
    if (!t) return;
    const r = t.round;
    t.winners[r] = t.plan[r].slice();
    if (!win) { t.winners[r][0] = t.oppIndex[r]; t.done = true; t.won = false; return; }
    if (r >= 2) { t.done = true; t.won = true; state.record.cups = (state.record.cups | 0) + 1; return; }
    t.round = r + 1;
  };
  const startTourMatch = () => {
    const t = state.tour;
    startMatch({ mode: 'tour', opp: t.oppProf[t.round], profile: t.oppProf[t.round], court: state.setup.court, target: 7 });
  };

  // ---- aiming ------------------------------------------------------------------------------------
  // where along the foul line does a touch put the ball? the point whose screen position is nearest the finger (any camera)
  const relFromScreen = (sx, sy, L) => {
    const cam = L.cam, lo = -HALF + 0.35, hi = HALF - 0.35;
    let best = 0, bd = 1e18;
    for (let i = 0; i <= 40; i++) { const x = lo + ((hi - lo) * i) / 40, p = cam.project(x, COURT.startY, 0), d = (p.x - sx) ** 2 + (p.y - sy) ** 2; if (d < bd) { bd = d; best = x; } }
    return best;
  };
  // pull vector (screen) -> throw direction on the floor, radians from straight down the court (+ = to the right)
  const rawAng = (L, rel, vx, vy) => {
    const cam = L.cam, A = cam.project(rel, COURT.startY, 0), len = Math.hypot(vx, vy) || 1;
    const g0 = cam.ground(A.x, A.y), g1 = cam.ground(A.x - (vx / len) * 40, A.y - (vy / len) * 40);
    return Math.atan2(g1.x - g0.x, g1.y - g0.y);
  };
  const validPull = (L, d) => d.len >= PULL.min && Math.abs(rawAng(L, state.rel, d.vx, d.vy)) < (75 * Math.PI) / 180;
  const paramsFromDrag = (L, dr) => ({
    type: state.sel.type, power: clamp((dr.len - PULL.min) / (PULL.max - PULL.min), 0, 1), ang: clamp(rawAng(L, state.rel, dr.vx, dr.vy), -MAX_ANG, MAX_ANG), spin: state.sel.spin, x: state.rel,
  });
  const setGuide = (p) => {
    state.guide = p;
    if (state.settings.calm && p) {
      const key = `${p.type}|${Math.round(p.power * 300)}|${Math.round(p.ang * 600)}|${p.spin}|${Math.round(p.x * 100)}`;
      if (key !== previewKey) {
        previewKey = key;
        const pv = previewThrow(state.w.surf, p, { pallino: state.m.phase === 'pallino', every: 4 });
        state.preview = { path: pv.path, rest: pv.rest, land: pv.land };
      }
    } else state.preview = null;
  };
  const releaseThrow = (p) => {
    const m = state.m, pal = m.phase === 'pallino';
    if (pal && p.type === 2) p = { ...p, type: 1 };
    throwBall(m.turn, p, pal);
  };

  const describePlan = (plan) => `${TYPES[plan.params.type].name}${plan.params.spin ? ` with ${spinName(plan.params.spin).toLowerCase()}` : ''}: ${plan.kind === 'hit' ? 'knock a ball away' : 'place it near the pallino'}`;

  // ---- AI turn -----------------------------------------------------------------------------------
  const updateAI = (dt) => {
    const { m } = state;
    if (!(m.phase === 'aim' || m.phase === 'pallino') || !isAI(m.turn) || state.paused) return;
    const prof = profNow(m.turn), watch = mode() === 'watch';
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur, phase: 'think', plan: null, params: null };
      if (m.phase === 'pallino') state.think.params = planPallino(state.w.surf, aiRng, prof);
      else planner = createPlanner(state.w, m, m.turn, prof, aiRng, {});
    }
    const th = state.think;
    th.t += dt;
    if (planner && !planner.done) { planner.step(10); state.explain = { head: `${nameOf(m.turn)} is thinking…`, lines: [`Trying ${planner.sims} throws on a copy of the court`, 'Placing near the pallino, hitting rival balls, curving round'] }; if (planner.done) { th.plan = planner.result; planner = null; } }
    const ready = th.params || th.plan;
    if (th.phase === 'think' && th.t >= th.dur && ready) {
      if (watch && th.plan) {
        th.phase = 'reveal'; th.t = 0; th.dur = 2;
        state.hint = th.plan.params; state.hintRest = th.plan.rest; state.alts = th.plan.alts; state.rel = th.plan.params.x;
        state.sel.type = th.plan.params.type; state.sel.spin = th.plan.params.spin;
        toast(`${nameOf(m.turn)}: ${describePlan(th.plan)}`, 2.2);
        state.explain = { head: `${nameOf(m.turn)} chooses: ${describePlan(th.plan)}`, lines: th.plan.alts.map((a, i) => `${i + 1}. ${TYPES[a.params.type].name}${a.params.spin ? `, ${spinName(a.params.spin).toLowerCase()}` : ''}: ${a.kind === 'hit' ? 'knock a ball away' : 'place near the pallino'}  (${a.score >= 0 ? '+' : ''}${a.score.toFixed(1)})`) };
      } else beginPull(th);
    } else if (th.phase === 'reveal' && th.t >= th.dur) beginPull(th);
    else if (th.phase === 'pull') {
      const k = Math.min(1, th.t / th.dur), e = 1 - Math.pow(1 - k, 3);
      const len = PULL.min + th.p.power * (PULL.max - PULL.min);
      state.aiDrag = { vx: -Math.sin(th.p.ang) * len * e * 0.8, vy: Math.cos(th.p.ang) * len * e, len: len * e };
      if (th.t >= th.dur) { const p = th.p, pal = m.phase === 'pallino'; state.aiDrag = null; throwBall(m.turn, p, pal); }
    }
  };
  const beginPull = (th) => {
    const m = state.m, prof = profNow(m.turn);
    const p = th.params ? th.params : executePlan(th.plan, prof, aiRng);
    th.p = p; th.phase = 'pull'; th.t = 0; th.dur = 0.55; if (state.m.cfg.mode !== 'watch') state.explain = null; state.hint = null; state.hintRest = null; state.alts = null;
    state.sel.type = p.type; state.sel.spin = p.spin; state.rel = p.x;
  };

  // ---- the play scene ----------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };

  const requestHint = () => {
    const m = state.m;
    if (state.hintBusy || m.phase !== 'aim') return;
    state.hintBusy = true;
    hintPlanner = createPlanner(state.w, m, m.turn, PROFILES[PROFILES.length - 1], aiRng, { perfect: true });
  };
  const updateHint = () => {
    if (!hintPlanner) return;
    hintPlanner.step(12);
    if (hintPlanner.done) {
      const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.m.phase !== 'aim') return;
      state.hint = r.params; state.hintRest = r.rest; state.alts = null;
      state.sel.type = r.params.type; state.sel.spin = r.params.spin; state.rel = r.params.x;
      toast(`Hint: ${describePlan(r)}`, 3.2);
    }
  };

  const updatePlay = (dt, input) => {
    const { m } = state;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch', L = lay(), P = L.play;
    // a rotation / resize moves everything under the finger: an aim in progress is cleanly cancelled (the match is untouched)
    if (state.lk !== L.key) { if (state.lk && state.drag) { state.drag = null; state.guide = null; state.preview = null; } state.lk = L.key; }
    if (config.dev && keys.pressed.has('KeyK')) { m.scores[0] = m.cfg.target; m.over = { win: 0, shutout: m.scores[1] === 0 }; m.phase = 'over'; state.scene = 'result'; if (m.cfg.mode === 'tour') tourResult(true); return; }
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
        else if (inRect(P.demo.exit, ptr.x, ptr.y)) { leaveMatch(); return; }
      }
    } else if (ptr.pressed && inRect(P.menu, ptr.x, ptr.y)) { openPause(); return; }
    state.coach = state.humanTurn && !state.drag && (state.record.thrown | 0) < 2 && !state.paused;
    state.ff = (m.phase === 'fly' || m.phase === 'pallino-fly') && ptr.down && !state.paused ? 3 : 1;
    if (state.humanTurn && !state.paused) {
      const pal = m.phase === 'pallino';
      if (ptr.pressed) {
        let hit = false;
        P.types.forEach((r, i) => { if (inRect(r, ptr.x, ptr.y) && !(pal && i === 2)) { state.sel.type = i; hit = true; sfx.tick(); } });
        if (inRect(P.spinDec, ptr.x, ptr.y)) { state.sel.spin = Math.max(-2, state.sel.spin - 1); hit = true; sfx.tick(); }
        if (inRect(P.spinInc, ptr.x, ptr.y)) { state.sel.spin = Math.min(2, state.sel.spin + 1); hit = true; sfx.tick(); }
        if (inRect(P.spinLabel, ptr.x, ptr.y)) { state.sel.spin = 0; hit = true; sfx.tick(); }
        if (inRect(P.hint, ptr.x, ptr.y)) { hit = true; if (m.phase === 'aim') { requestHint(); sfx.tick(); } }
        if (!hit && state.zoom.z < 1.03 && inRect(P.zone, ptr.x, ptr.y)) { state.drag = { sx: ptr.x, sy: ptr.y, vx: 0, vy: 0, len: 0 }; state.rel = relFromScreen(ptr.x, ptr.y, L); state.hint = null; state.hintRest = null; }
      }
      if (state.drag) {
        if (ptr.down) {
          state.drag.vx = ptr.x - state.drag.sx; state.drag.vy = ptr.y - state.drag.sy; state.drag.len = Math.hypot(state.drag.vx, state.drag.vy);
          const valid = validPull(L, state.drag);
          setGuide(valid ? paramsFromDrag(L, state.drag) : null);
        }
        if (ptr.released) {
          const d = state.drag; state.drag = null;
          if (validPull(L, d)) releaseThrow(paramsFromDrag(L, d));
          else { setGuide(null); if (d.len > 8) toast('Pull back further, then let go', 1.6); }
        }
      }
      // keyboard
      const kb = state.kb ?? (state.kb = { ang: 0, power: 0.5 });
      let touched = false;
      if (keys.down.has('ArrowLeft')) { kb.ang = clamp(kb.ang - 0.01, -MAX_ANG, MAX_ANG); touched = true; }
      if (keys.down.has('ArrowRight')) { kb.ang = clamp(kb.ang + 0.01, -MAX_ANG, MAX_ANG); touched = true; }
      if (keys.down.has('ArrowUp')) { kb.power = clamp(kb.power + 0.012, 0, 1); touched = true; }
      if (keys.down.has('ArrowDown')) { kb.power = clamp(kb.power - 0.012, 0, 1); touched = true; }
      if (keys.down.has('KeyA')) { state.rel = clamp(state.rel - 0.02, -HALF + 0.35, HALF - 0.35); touched = true; }
      if (keys.down.has('KeyD')) { state.rel = clamp(state.rel + 0.02, -HALF + 0.35, HALF - 0.35); touched = true; }
      for (let i = 0; i < 3; i++) if (keys.pressed.has(`Digit${i + 1}`) && !(pal && i === 2)) { state.sel.type = i; touched = true; }
      if (keys.pressed.has('KeyZ')) { state.sel.spin = Math.max(-2, state.sel.spin - 1); touched = true; }
      if (keys.pressed.has('KeyX')) { state.sel.spin = Math.min(2, state.sel.spin + 1); touched = true; }
      if (keys.pressed.has('KeyH') && m.phase === 'aim') requestHint();
      if (touched || state.kbOn) { state.kbOn = true; if (!state.drag) setGuide({ type: state.sel.type, power: kb.power, ang: kb.ang, spin: state.sel.spin, x: state.rel }); }
      if (keys.pressed.has('Space') && state.guide && !state.drag) { releaseThrow(state.guide); state.kbOn = false; }
    } else if (state.drag && !state.humanTurn) { state.drag = null; state.guide = null; }
    if (state.paused) return;
    updateHint();
    updateAI(dt);
    // physics
    if (m.phase === 'fly' || m.phase === 'pallino-fly') {
      for (let i = 0; i < state.ff; i++) {
        const ev = stepWorld(state.w, dt, []);
        if (ev.length) handleEvents(ev);
        rumble -= dt;
        if (rumble <= 0) {
          let v = 0;
          for (const b of state.w.balls) if (!b.out && !b.dead && b.z <= b.r + 0.01) v = Math.max(v, Math.hypot(b.vx, b.vy));
          if (v > 1) { tone({ freq: 58 + v * 6, to: 48, dur: 0.14, type: 'sawtooth', vol: Math.min(0.03, 0.005 + v / 400) }); rumble = 0.11; } else rumble = 0.05;
        }
        state.w.balls = state.w.balls.filter((b) => !((b.out || b.dead) && b.fade > 1.1 && !b.k));
        if (state.w.settled) { state.restT += dt; if (state.restT > 0.45) { onSettled(); break; } } else state.restT = 0;
      }
    }
    {
      const fly = m.phase === 'fly' || m.phase === 'pallino-fly', Z = state.zoom;
      let tz = 1;
      if (fly) {
        let best = null, bv = 0.8;
        for (const b of state.w.balls) { if (b.out || b.dead) continue; const v = Math.hypot(b.vx, b.vy); if (v > bv) { bv = v; best = b; } }
        if (best) { const p = L.cam.project(best.x, best.y, best.z); tz = L.cam.side ? 1.2 : 1.16; Z.ax += (p.x - Z.ax) * Math.min(1, dt * 5); Z.ay += (p.y - Z.ay) * Math.min(1, dt * 5); }
      }
      Z.z += (tz - Z.z) * Math.min(1, dt * (tz > Z.z ? 2.4 : 5));
      if (Z.z < 1.002) Z.z = 1;
      if (!fly && Z.z === 1) { Z.ax = L.w / 2; Z.ay = L.h / 2; }
    }
    stepParts(state.parts, dt);
    if (state.shake) { state.shake.t += dt; if (state.shake.t >= state.shake.dur) state.shake = null; }
    if (state.toastT > 0) state.toastT -= dt;
    if (state.pop) { state.pop.t += dt; if (state.pop.t > 1.8) state.pop = null; }
    if (m.phase === 'score') {
      m.endInfo.t += dt;
      const auto = watch && m.endInfo.t > 4.5;
      if ((ptr.pressed && m.endInfo.t > 0.8) || auto) afterFrame();
    }
  };

  const leaveMatch = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.drag = null; state.aiDrag = null; };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'p-calm') { state.settings.calm = !state.settings.calm; previewKey = ''; save(); }
    else if (id === 'quit') leaveMatch();
  }

  // ---- menus ------------------------------------------------------------------------------------
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
    else if (id === 'team') openSetup('team');
    else if (id === 'two') openSetup('two');
    else if (id === 'cup') { if (state.demo) { state.scene = 'demolimit'; state.ui.scroll = 0; return; } newTour(); state.scene = 'bracket'; state.ui.scroll = 0; }
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
    else if (id.startsWith('crt')) { const c = id.slice(3); if (state.demo && c !== 'shell') { state.setupMsg = 'That court is in the full game.'; return; } s.court = c; state.setupMsg = ''; }
    else if (id === 'len12') s.target = 12;
    else if (id === 'len7') s.target = 7;
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, court: s.court, target: s.target });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleBracket = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'cup-go') startTourMatch();
    else if (id === 'cup-new') { newTour(); state.ui.scroll = 0; }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-calm') st.calm = !st.calm;
    else if (id === 'set-pal') { st.palette = st.palette === 'bold' ? 'classic' : 'bold'; setPalette(st.palette); }
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
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.m.cfg;
    if (id === 'again') { if (cfg.mode === 'tour') { newTour(); state.scene = 'bracket'; state.ui.scroll = 0; } else startMatch({ ...cfg, firstPallino: aiRng.int(2) }); }
    else if (id === 'next' || id === 'bracket') { state.scene = 'bracket'; state.ui.scroll = 0; }
    else if (id === 'new') { state.setup.mode = cfg.mode === 'watch' || cfg.mode === 'tour' ? 'ai' : cfg.mode; state.scene = 'setup'; state.ui.scroll = 0; }
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
    if (k.pressed.has('KeyC') && !state.demo) state.setup.court = COURT_IDS[(COURT_IDS.indexOf(state.setup.court) + 1) % COURT_IDS.length];
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

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused,
    update(dt, input) {
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'bracket': updateFlowScene(dt, input, handleBracket, 'bracket'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx, view) {
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height);
      switch (state.scene) {
        case 'title': renderTitle(ctx, state, L); break;
        case 'setup': renderSetup(ctx, state, L); break;
        case 'settings': renderSettings(ctx, state, L); break;
        case 'result': renderResult(ctx, state, L); break;
        case 'bracket': renderBracket(ctx, state, L); break;
        case 'demolimit': renderDemoLimit(ctx, state, L); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play', L); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About', L); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules', L); break;
        case 'play':
          if (state.m) {
            if (state.shake) { ctx.save(); const a = state.shake.amp * (1 - state.shake.t / state.shake.dur); ctx.translate(Math.sin(state.shake.t * 90) * a, Math.cos(state.shake.t * 77) * a * 0.6); renderPlay(ctx, state, L); ctx.restore(); }
            else renderPlay(ctx, state, L);
          }
          if (state.pauseMenu) renderPause(ctx, state, L);
          break;
        default: break;
      }
    },
    wheel(dy) { if (['about', 'howto', 'rules'].includes(state.scene)) { state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max); return; } if (['title', 'setup', 'settings', 'result', 'demolimit', 'bracket'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, flowMeta().max); },
    getState: () => state,
    debug: () => ({ lockup: lockupZone(), layout: lay(), flow: flowRects(state.ui.scroll), flowMax: flowMeta().max, pages: pageCount() }),
  };
}
