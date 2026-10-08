// Pick-up Sticks: state and flow. Physics lives in sim.js, rules in match.js, drawing in view.js and menus.js, the rivals and the
// hint in ai.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, ladder, settings, play (also Watch & Learn), result, howto/about/rules, demolimit.
// Lifting: press a stick and drag it slowly out of the heap; the stick follows your finger (Fine touch moves it less than your
// finger does). Let go early and the turn is over; move any other stick too far and it is a fault.
import {
  byId, startPull, startTool, setTarget, stepPull, endPull, hitStick, coveredSet, freeSticks, createWorld, planStart, clamp, valueOf, TABLE,
} from './sim.js';
import { newMatch, beginRound, afterPull, scoreRound, applyRound, newHeap, LEVELS } from './match.js';
import { createPlanner, describePlan, handNoise } from './ai.js';
import { PROFILES } from './opponents.js';
import { inRect, TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, host } from './layout.js';
import { renderPlay, layoutOf } from './view.js';
import { renderTitle, renderSetup, renderLadder, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, hitScreen, flowMeta, REF, ensureLayout, resetMenus, setupPinRects, lockupZone } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export { meta };
const DEMO_ROUND_CAP = 2;
// Stray-touch guard (the kit has one pointer): a second finger shows up as the pointer jumping across the screen in a single
// tick. Such a jump is ignored while lifting, and a release that lands that far away is not a release of the lifting finger.
export const STRAY_JUMP = 220;
export const FINE_GAIN = 0.6;
const TAU = Math.PI * 2;
const SHOTS = {
  1: { scene: 'title' },
  2: { scene: 'play', mode: 'ai', opp: 2, seed: 5 },
  3: { scene: 'pull', mode: 'ai', opp: 2, seed: 5, take: 2, lift: 45 },
  4: { scene: 'play', mode: 'ai', opp: 3, seed: 9, hintNow: 1, calm: 1, take: 1 },
  5: { scene: 'rules', scroll: 1900 },
  6: { scene: 'ladder' },
  7: { scene: 'play', mode: 'watch', seed: 4 },
  8: { scene: 'result' },
  9: { scene: 'play', mode: 'solo', level: 4, seed: 7, take: 3 },
};
const KIND_WORD = { gold: 'golden master', red: 'red lacquer', jade: 'jade', indigo: 'indigo', bamboo: 'bamboo' };

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, calm: false, fine: true, textIdx: 0, thinkIdx: 1 },
    record: { wins: [0, 0, 0, 0, 0], played: 0, streak: 0, best: 0, demoRounds: 0, lifts: 0, bestRound: 0, ladder: { reached: 1, stars: [] }, daily: { day: -1, best: 0, bestAll: 0, plays: 0 } },
    setup: { mode: 'ai', opp: 0, rounds: 1 }, setupMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0,
    att: null, w: null, m: null, res: null,
    hintShot: null, hintBusy: false, freeIds: null, overFlag: false,
    parts: [], pops: [], flies: [], toast: '', toastT: 0, humanTurn: false,
    shake: 0, sx: 0, sy: 0, faultFlash: 0, faultId: 0, freeFlash: 0, flashStick: 0,
    think: null, grab: null, finger: null, toolArmed: false, clearT: 0, loaded: false, restoreMsg: '',
  };
  let planner = null, hintPlanner = null, wheelHooked = false, hitCool = 0;

  // ---- persistence -----------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 5) state.record.wins = [0, 0, 0, 0, 0];
    if (!state.record.ladder || !Array.isArray(state.record.ladder.stars)) state.record.ladder = { reached: 1, stars: [] };
    if (!state.record.daily) state.record.daily = { day: -1, best: 0, bestAll: 0, plays: 0 };
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound -----------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    grab: () => tone({ freq: 340, to: 240, dur: 0.07, type: 'triangle', vol: 0.06 }),
    tok: (v) => { const q = Math.min(1, v / 300); tone({ freq: 260 + fx.next() * 90, to: 150, dur: 0.07, type: 'triangle', vol: 0.025 + 0.05 * q }); tone({ freq: 1500 + fx.next() * 500, to: 900, dur: 0.03, type: 'square', vol: 0.012 + 0.02 * q }); },
    lift: (val) => { const n = val >= 20 ? [0, 4, 7, 12, 16] : val >= 10 ? [0, 4, 7, 12] : val >= 5 ? [0, 4, 7] : val >= 3 ? [0, 5] : [0]; n.forEach((s, i) => tone({ freq: 523 * Math.pow(2, s / 12), dur: 0.22 + i * 0.04, type: 'triangle', vol: 0.085 })); },
    fault: () => { tone({ freq: 200, to: 90, dur: 0.3, type: 'sawtooth', vol: 0.07 }); tone({ freq: 150, to: 70, dur: 0.34, type: 'square', vol: 0.04 }); },
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 220, to: 140, dur: 0.18, type: 'sawtooth', vol: 0.05 }),
    drop: () => tone({ freq: 180, to: 120, dur: 0.14, type: 'triangle', vol: 0.06 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  // Haptics: web/main.js installs globalThis.__haptic(kind) (a native shell may replace it). Human turns only.
  const haptic = (kind) => { if (state.settings.sound && state.m && !isAI(state.m.turn) && globalThis.__haptic) globalThis.__haptic(kind); };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- particles -------------------------------------------------------------------------------
  const MAX_PARTS = 140;
  const addPart = (parts, q) => { if (parts.length < MAX_PARTS) parts.push(q); };
  const dust = (parts, x, y, n) => { for (let i = 0; i < n; i++) { const a = fx.next() * TAU, s = 8 + fx.next() * 28; addPart(parts, { kind: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.5 + fx.next() * 0.4, size: 6 + fx.next() * 6, col: 'rgba(214,204,186,1)' }); } };
  const sparks = (parts, x, y, n, col) => { for (let i = 0; i < n; i++) { const a = fx.next() * TAU, s = 80 + fx.next() * 200; addPart(parts, { kind: 1, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.16 + fx.next() * 0.14, col }); } };
  const glints = (parts, x, y, n, col) => { for (let i = 0; i < n; i++) { const a = fx.next() * TAU, s = 50 + fx.next() * 160; addPart(parts, { kind: 3, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.5 + fx.next() * 0.4, size: 6 + fx.next() * 6, col }); } };
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.95; q.vy *= 0.95; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };
  const pop = (x, y, text, col, size) => { state.pops.push({ x, y, text, col, size, t: 0, max: 1.3 }); if (state.pops.length > 12) state.pops.shift(); };

  const pullEvents = (parts, ev, live) => {
    for (const e of ev) {
      if (e.t === 'hit') {
        sparks(parts, e.x, e.y, 2, '#fff2c8');
        if (live && hitCool <= 0) { sfx.tok(e.v); haptic('tok'); hitCool = 0.09; }
      } else if (e.t === 'fault' && live) { sfx.fault(); haptic('fault'); state.shake = 1; state.faultFlash = 1.2; state.faultId = e.id; }
    }
  };

  // ---- the attract heap behind the menus ---------------------------------------------------------------
  const freshAttract = () => ({ w: createWorld(rng.int(1000000) + 1, { n: 22, tol: 8 }), parts: [], wait: 1.4, planner: null, plan: null, t: 0 });
  const startAttract = () => { state.att = freshAttract(); };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    a.wait -= dt;
    if (a.w.pull) {
      const p = a.w.pull, plan = a.plan;
      a.t += dt;
      const L = Math.min(plan.dist, plan.speed * a.t);
      setTarget(a.w, p.g0x + Math.cos(plan.ang) * L, p.g0y + Math.sin(plan.ang) * L);
      const ev = stepPull(a.w, dt); pullEvents(a.parts, ev, false);
      if (p.done || a.t > 9) { const r = endPull(a.w); if (r && r.outcome === 'lifted') glints(a.parts, r.stick.x, r.stick.y, 6, '#ffe9a0'); a.wait = 2.6; a.plan = null; if (a.w.sticks.length < 9) state.att = freshAttract(); }
    } else if (a.planner) {
      a.planner.step(3);
      if (a.planner.done) { const r = a.planner.result; a.planner = null; if (r && planStart(a.w, r)) { a.plan = r; a.t = 0; } else a.wait = 1; }
    } else if (a.wait <= 0) a.planner = createPlanner(a.w, { ...PROFILES[3], sample: 90, refine: 2, trials: 0, speeds: [55, 75] }, fx, {});
    stepParts(a.parts, dt);
  };

  // ---- match flow --------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const solo = () => mode() === 'solo' || mode() === 'daily';
  const isAI = (side) => mode() === 'watch' || (mode() === 'ai' && side === 1);
  const profOf = (side) => (mode() === 'watch' ? PROFILES[side === 0 ? state.m.cfg.watchA : state.m.cfg.opp] : PROFILES[state.m.cfg.opp]);
  const sideLabel = (side) => {
    const m = state.m;
    if (m.cfg.mode === 'two') return side === 0 ? 'Player 1' : 'Player 2';
    if (m.cfg.mode === 'watch') return profOf(side).name;
    if (solo()) return 'You';
    return side === 0 ? 'You' : profOf(1).name;
  };
  const refreshFree = () => { state.freeIds = new Set(freeSticks(state.w).map((s) => s.id)); };

  const beginTurn = () => {
    const m = state.m, side = m.turn;
    m.phase = 'aim';
    state.humanTurn = !isAI(side);
    state.hintShot = null; state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.grab = null; state.finger = null; state.toolArmed = false; state.devHold = false;
    refreshFree();
    if (state.humanTurn) {
      const who = m.cfg.mode === 'two' ? `${sideLabel(side)}: ` : '';
      toast(`${who}Press a free stick and slide it slowly out`, 3);
    } else if (m.cfg.mode !== 'watch') toast(`${sideLabel(side)} is thinking…`, 2.0);
  };
  const heapSeed = (m) => (m.cfg.mode === 'daily' ? (config.day * 7919 + 101) >>> 0 : (m.seed + (m.round - 1) * 104729) >>> 0);
  const startRound = () => { state.w = newHeap(state.m.cfg, heapSeed(state.m)); beginRound(state.m, state.w); state.parts = []; state.pops = []; state.flies = []; beginTurn(); toast(solo() ? 'Lift the sticks one at a time' : `Round ${state.m.round}: ${sideLabel(state.m.turn)} lifts first`, 2.6); };

  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoRounds >= DEMO_ROUND_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.m = newMatch({ mode: 'ai', opp: 0, rounds: 1, first: aiRng.int(2), watchA: 3, ...cfg });
    state.m.seed = cfg.seed ?? (aiRng.int(1000000) + 1);
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.parts = []; state.pops = []; state.flies = []; state.res = null; state.overFlag = false;
    state.w = newHeap(state.m.cfg, heapSeed(state.m));
    beginRound(state.m, state.w);
    beginTurn();
  };
  const startWatch = () => {
    const picks = [1, 2, 3, 4];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, rounds: 1 });
  };

  // A pull ended (lifted, fault, dropped, or the lever let go): score it and move the match on.
  const closePull = (cancelTiny) => {
    const { m, w } = state, p = w.pull;
    if (!p) return;
    const wasTool = p.tool, tiny = p.dist < 10;
    const res = endPull(w);
    state.grab = null; state.finger = null;
    if (!res) return;
    if (cancelTiny && res.outcome === 'dropped' && tiny) { m.phase = 'aim'; state.humanTurn = !isAI(m.turn); refreshFree(); toast('Press a stick, then slide it away and let go', 2.2); return; }
    if (wasTool) {
      state.toolArmed = false; m.phase = 'aim'; refreshFree();
      afterPull(m, w, res);
      if (isAI(m.turn)) { state.think = null; toast(`${sideLabel(m.turn)} swept the heap with the lever`, 2.2); } else toast('Lever put away. Now lift a stick', 2.2);
      sfx.drop();
      return;
    }
    state.res = res;
    const side = m.turn;
    if (res.outcome === 'lifted') {
      const s = res.stick, v = valueOf(s);
      state.flies.push({ x: s.x, y: s.y, kind: s.kind, a: s.a, side: solo() ? 0 : side, t: 0, max: 0.8 });
      pop(s.x, s.y, `+${v}`, s.kind === 'gold' ? '#ffd35a' : '#fff8e0', 36);
      glints(state.parts, s.x, s.y, 8, s.kind === 'bamboo' ? '#fff2c8' : '#ffffff');
      sfx.lift(v); haptic('lift');
      if (!isAI(side)) state.record.lifts = (state.record.lifts | 0) + 1;
      toast(s.kind === 'gold' ? `${sideLabel(side)} ${sideLabel(side) === 'You' ? 'take' : 'takes'} the golden master: the lever is ${sideLabel(side) === 'You' ? 'yours' : 'theirs'}` : `${sideLabel(side)}: +${v}`, 2);
    } else if (res.outcome === 'fault') {
      const c = byId(w, res.culprit);
      if (c) { sparks(state.parts, c.x, c.y, 10, '#ff8a6a'); dust(state.parts, c.x, c.y, 4); }
      toast(`${c ? `The ${KIND_WORD[c.kind]} stick moved` : 'Another stick moved'}${solo() ? '. A slip' : '. Turn over'}`, 2.8);
    } else {
      sfx.drop();
      toast(solo() ? 'Let go too soon: the stick stays in the heap' : 'Let go too soon: turn over', 2.4);
    }
    const over = afterPull(m, w, res);
    state.overFlag = over === 'over';
    m.phase = 'clear'; state.clearT = 0;
  };
  const finishClear = () => {
    const { m } = state;
    if (state.overFlag) { state.overFlag = false; scoreRound(m); sfx.lift(10); toast(m.cfg.mode === 'solo' ? 'Heap finished' : 'The heap is clear', 3); }
    else beginTurn();
  };
  const afterRound = () => {
    const m = state.m;
    applyRound(m, m.roundInfo);
    if (m.cfg.mode !== 'watch') state.record.demoRounds++;
    state.record.bestRound = Math.max(state.record.bestRound | 0, m.roundInfo.pts[0]);
    const finishSolo = () => {
      state.scene = 'result'; state.ui.scroll = 0;
      if (m.cfg.mode === 'solo') {
        const cleared = m.scores[0] >= m.goal, L = state.record.ladder;
        if (cleared) {
          const stars = m.strikes === 0 ? 3 : m.strikes === 1 ? 2 : 1;
          L.stars[m.cfg.level - 1] = Math.max(L.stars[m.cfg.level - 1] | 0, stars);
          L.reached = Math.max(L.reached | 0, Math.min(LEVELS, m.cfg.level + 1));
          m.result = { cleared: true, stars }; sfx.win();
        } else m.result = { cleared: false, stars: 0 };
      } else {
        const d = state.record.daily, today = config.day;
        if (d.day !== today) { d.day = today; d.best = 0; }
        d.best = Math.max(d.best | 0, m.scores[0]); d.bestAll = Math.max(d.bestAll | 0, m.scores[0]); d.plays = (d.plays | 0) + 1;
        m.result = { cleared: true, stars: 0 }; if (m.scores[0] > 0 && m.scores[0] >= d.best) sfx.win();
      }
      save();
    };
    if (m.over) {
      if (solo()) { finishSolo(); return; }
      state.scene = 'result'; state.ui.scroll = 0;
      if (m.cfg.mode === 'ai') {
        state.record.played++;
        if (m.over.win === 0) { state.record.wins[m.cfg.opp]++; state.record.streak++; state.record.best = Math.max(state.record.best, state.record.streak); sfx.win(); } else state.record.streak = 0;
      }
      save();
    } else if (state.demo && m.cfg.mode !== 'watch' && state.record.demoRounds >= DEMO_ROUND_CAP) { save(); state.scene = 'demolimit'; state.ui.scroll = 0; }
    else { save(); startRound(); }
  };

  // ---- the AI hand ---------------------------------------------------------------------------------
  const endTurnNoPull = () => { const m = state.m; m.phase = 'clear'; state.clearT = 0; state.overFlag = false; if (!solo()) m.turn = 1 - m.turn; state.think = null; };
  const beginAIPull = (th) => {
    const { w } = state;
    if (!planStart(w, th.plan)) { endTurnNoPull(); return; }
    state.m.phase = 'pull';
    th.phase = 'pull'; th.t = 0; th.jx = 0; th.jy = 0; th.noise = handNoise(profOf(state.m.turn), aiRng);
    state.hintShot = null; sfx.grab();
  };
  // A rival that holds the lever sweeps the heap once when its best pull is risky or there is none (never in Watch & Learn's first look).
  const beginAITool = (th) => {
    const { w } = state, a = aiRng.next() * TAU, r = TABLE * 0.82;
    if (!startTool(w, Math.cos(a) * r, Math.sin(a) * r)) return false;
    state.m.phase = 'pull'; th.phase = 'tool'; th.t = 0; th.ta = a; th.tr = r; state.hintShot = null; sfx.grab();
    return true;
  };
  const updateAI = (dt) => {
    const { m, w } = state;
    if (m.phase !== 'aim' || !isAI(m.turn) || state.paused) return;
    const prof = profOf(m.turn), watch = mode() === 'watch', side = m.turn;
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur, phase: 'think', plan: null, none: false };
      planner = createPlanner(w, prof, aiRng, {});
      if (watch) toast(`${sideLabel(side)} is thinking…`, dur);
    }
    const th = state.think;
    th.t += dt;
    if (planner && !planner.done) { planner.step(6); if (planner.done) { th.plan = planner.result; th.none = !planner.result; planner = null; } }
    if (th.phase === 'think' && th.t >= th.dur && (th.plan || th.none)) {
      const m2 = state.m;
      if (m2.tool[side] && m2.toolUses[side] < 2 && w.sticks.length > 5 && (th.none || (th.plan && th.plan.note === 'risky')) && beginAITool(th)) return;
      if (th.none) { endTurnNoPull(); return; }
      if (watch) {
        th.phase = 'reveal'; th.t = 0; th.dur = 2;
        state.hintShot = th.plan;
        toast(`${sideLabel(side)}: ${describePlan(th.plan)}`, 2.1);
      } else beginAIPull(th);
    } else if (th.phase === 'reveal' && th.t >= th.dur) beginAIPull(th);
  };
  const stepAIPull = (dt) => {
    const { w } = state, th = state.think, p = w.pull;
    if (th && th.phase === 'tool' && p) {
      th.t += dt;
      const L = Math.min(th.tr * 0.7, 85 * th.t);
      setTarget(w, p.g0x - Math.cos(th.ta) * L, p.g0y - Math.sin(th.ta) * L);
      pullEvents(state.parts, stepPull(w, dt), true);
      if (p.done || th.t > 14 || L >= th.tr * 0.7) closePull(false);
      return;
    }
    if (!th || th.phase !== 'pull' || !p) return;
    th.t += dt;
    const plan = th.plan, L = Math.min(plan.dist, plan.speed * th.t);
    th.jx = th.jx * 0.9 + th.noise() * 0.45; th.jy = th.jy * 0.9 + th.noise() * 0.45;
    setTarget(w, p.g0x + Math.cos(plan.ang) * L + th.jx, p.g0y + Math.sin(plan.ang) * L + th.jy);
    const ev = stepPull(w, dt); pullEvents(state.parts, ev, true);
    if (p.done || th.t > 14 || (L >= plan.dist && Math.hypot(p.tx - p.gx, p.ty - p.gy) < 1.5)) closePull(false);
  };

  // ---- hint --------------------------------------------------------------------------------------
  const requestHint = () => {
    const m = state.m;
    if (state.hintBusy || m.phase !== 'aim' || !state.humanTurn || state.w.pull) return;
    state.hintBusy = true;
    hintPlanner = createPlanner(state.w, PROFILES[4], aiRng, { perfect: true });
  };
  const updateHint = () => {
    if (!hintPlanner) return;
    hintPlanner.step(10);
    if (hintPlanner.done) {
      const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.m.phase !== 'aim' || !state.humanTurn) return;
      if (!r) { toast('Hint: no stick is free yet', 3); return; }
      state.hintShot = r;
      toast(`Hint: ${describePlan(r)}`, 4.5);
    }
  };

  // ---- the play scene ----------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const worldOf = (L, ptr) => ({ x: (ptr.x - L.board.cx) / L.board.s, y: (ptr.y - L.board.cy) / L.board.s });
  const padWorld = (L) => Math.max(18, host.px > 0 ? 17 / (host.px * L.board.s) : 26);

  const tryPick = (L, ptr) => {
    const { w, m } = state, pt = worldOf(L, ptr);
    if (state.toolArmed) {
      if (Math.abs(pt.x) > TABLE || Math.abs(pt.y) > TABLE) return;
      if (!startTool(w, pt.x, pt.y)) return;
      m.phase = 'pull'; state.grab = { px: ptr.x, py: ptr.y, lx: ptr.x, ly: ptr.y, g0x: pt.x, g0y: pt.y }; state.hintShot = null; sfx.grab();
      return;
    }
    const s = hitStick(w, pt.x, pt.y, padWorld(L));
    if (!s) return;
    if (coveredSet(w).has(s.id)) { toast('Another stick lies across it: lift that one first', 2.4); sfx.no(); state.flashStick = s.id; state.freeFlash = 1.2; return; }
    if (!startPull(w, s.id, pt.x, pt.y)) return;
    const p = w.pull;
    m.phase = 'pull'; state.hintShot = null;
    state.grab = { px: ptr.x, py: ptr.y, lx: ptr.x, ly: ptr.y, g0x: p.g0x, g0y: p.g0y };
    sfx.grab(); haptic('grab');
  };

  const updatePlay = (dt, input) => {
    const { m } = state;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch';
    const L = layoutOf(state), barHidden = m.phase === 'score';
    hitCool -= dt;
    if (config.dev && keys.pressed.has('KeyK')) { m.scores[0] = 40; m.scores[1] = 21; m.over = { win: 0, extra: false }; m.phase = 'over'; state.scene = 'result'; state.ui.scroll = 0; return; }
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
      if (ptr.pressed && !barHidden) {
        const D = L.demo;
        if (inRect(D.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(D.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(D.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(D.exit, ptr.x, ptr.y)) { leaveMatch(); return; }
      }
    } else if (ptr.pressed && !barHidden && inRect(L.menu, ptr.x, ptr.y) && !state.w.pull) { openPause(); return; }

    if (state.humanTurn && !state.paused && (m.phase === 'aim' || m.phase === 'pull')) {
      const side = m.turn, p = state.w.pull;
      if (m.phase === 'aim') {
        if (ptr.pressed) {
          if (inRect(L.hint, ptr.x, ptr.y)) { requestHint(); sfx.tick(); }
          else if (inRect(L.tool, ptr.x, ptr.y)) {
            if (state.toolArmed) { state.toolArmed = false; sfx.tick(); toast('Lever put away', 1.6); }
            else if (m.tool[side] && m.toolUses[side] < 2) { state.toolArmed = true; state.hintShot = null; sfx.tick(); toast('Lever ready: press and drag on the table to sweep sticks aside', 3.2); }
            else if (!m.tool[side]) { toast('Lift the golden master stick to win the lever', 2.6); sfx.no(); }
            else { toast('The lever has been used twice this round', 2.4); sfx.no(); }
          } else if (inRect(L.zone, ptr.x, ptr.y)) tryPick(L, ptr);
        }
      } else if (p && state.grab) {
        const g = state.grab, stray = Math.hypot(ptr.x - g.lx, ptr.y - g.ly) > STRAY_JUMP;
        if (ptr.down && !stray) {
          g.lx = ptr.x; g.ly = ptr.y;
          const gain = p.tool ? 1 : state.settings.fine ? FINE_GAIN : 1;
          setTarget(state.w, g.g0x + ((ptr.x - g.px) / L.board.s) * gain, g.g0y + ((ptr.y - g.py) / L.board.s) * gain);
          state.finger = worldOf(L, ptr);
        }
        if (ptr.released && !stray) closePull(true);
        else if (ptr.released && stray) toast('Second touch ignored', 1.4);
        else if (!ptr.down && !ptr.pressed && state.grab && !state.devHold) closePull(true);   // the single pointer was lost: let go
      }
      if (keys.pressed.has('KeyH')) requestHint();
    }
    if (state.paused) return;
    updateHint();
    updateAI(dt);
    // physics
    const w = state.w;
    if (m.phase === 'pull' && w.pull) {
      if (state.humanTurn) {
        if (!w.pull.done) { const ev = stepPull(w, dt); pullEvents(state.parts, ev, true); }
        if (w.pull && w.pull.done) closePull(false);
      } else stepAIPull(dt);
    }
    if (m.phase === 'clear') { state.clearT += dt; if (state.clearT > (state.res && state.res.outcome === 'fault' ? 1.1 : 0.8)) finishClear(); }
    state.shake = state.shake > 0.02 ? state.shake * Math.pow(0.02, dt) : 0;
    state.sx = state.shake > 0 ? (fx.next() - 0.5) * 9 * state.shake : 0; state.sy = state.shake > 0 ? (fx.next() - 0.5) * 9 * state.shake : 0;
    if (state.faultFlash > 0) state.faultFlash -= dt;
    if (state.freeFlash > 0) state.freeFlash -= dt;
    stepParts(state.parts, dt);
    for (const q of state.pops) q.t += dt;
    state.pops = state.pops.filter((q) => q.t < q.max);
    for (const f of state.flies) f.t += dt;
    state.flies = state.flies.filter((f) => f.t < f.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (m.phase === 'score') {
      m.roundInfo.t += dt;
      const auto = (watch && m.roundInfo.t > 4.8) || m.roundInfo.t > 9;
      if ((ptr.pressed && m.roundInfo.t > 0.9) || auto) afterRound();
    }
  };

  const leaveMatch = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.grab = null; if (state.w) state.w.pull = null; };
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

  // ---- menus ------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag;
    const mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) {
      const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top));
      state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max);
    }
  }
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'play') { state.setup.mode = 'ai'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'two') { state.setup.mode = 'two'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'solo') { state.scene = 'ladder'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'daily') startMatch({ mode: 'daily', seed: (config.day * 7919 + 101) >>> 0 });
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
    else if (id === 'len1') s.rounds = 1;
    else if (id === 'len3') s.rounds = 3;
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, rounds: s.rounds });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleLadder = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
    else if (id.startsWith('lv')) {
      const n = Number(id.slice(2));
      if (n > Math.max(1, state.record.ladder.reached | 0)) { state.setupMsg = 'Clear the level before it first.'; return; }
      if (state.demo && n > 2) { state.setupMsg = 'That level is in the full game.'; return; }
      startMatch({ mode: 'solo', level: n });
    }
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
    if (id === 'again') startMatch({ ...cfg, first: aiRng.int(2), seed: cfg.mode === 'daily' ? cfg.seed : undefined });
    else if (id === 'next') startMatch({ mode: 'solo', level: Math.min(LEVELS, cfg.level + 1) });
    else if (id === 'new') { state.setup.mode = cfg.mode === 'watch' ? 'ai' : cfg.mode; state.scene = cfg.mode === 'solo' ? 'ladder' : 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };

  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key);
    { const m0 = flowMeta(); state.ui.scroll = clamp(state.ui.scroll, 0, m0.lay ? Math.max(0, m0.lay.contentH - (m0.bottom - m0.top)) : 0); }
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
    ensureLayout(state, 'setup');
    const pins = setupPinRects(state);
    if (ptr.pressed && (inRect(pins.start, ptr.x, ptr.y) || inRect(pins.back, ptr.x, ptr.y))) {
      handleSetup(inRect(pins.start, ptr.x, ptr.y) ? 'start' : 'back');
      return;
    }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  let refDrag = null;
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const RL = refLayout(), set = (v) => { state.refScroll = clamp(v, 0, REF.max); };
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.refScroll = 0; };
    if (ptr.pressed) {
      if (inRect(RL.next, ptr.x, ptr.y) || inRect(RL.back, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(RL.dec, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.refScroll = 0; save(); }
      else if (inRect(RL.inc, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.refScroll = 0; save(); }
      else if (inRect(RL.panel, ptr.x, ptr.y)) refDrag = { y0: ptr.y, s0: state.refScroll };
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

  const go = (q) => {
        if (q.text) state.settings.textIdx = clamp(+q.text, 0, TEXT_SCALES.length - 1);
        if (q.calm) state.settings.calm = q.calm === '1';
        const sc = q.scene || 'title';
        if (sc === 'play' || sc === 'pause' || sc === 'result' || sc === 'score' || sc === 'pull') {
          startMatch({ mode: q.mode || 'ai', opp: +(q.opp || 2), rounds: +(q.rounds || 1), first: q.first ? +q.first : 0, watchA: 3, level: +(q.level || 1), seed: q.seed ? +q.seed : undefined });
          if (q.take) { const n = +q.take; for (let i = 0; i < n && state.w.sticks.length > 6; i++) { const fr = freeSticks(state.w); const s = fr[fr.length - 1]; state.m.rp[0] += valueOf(s); state.m.got[0].push(s.kind); state.w.sticks = state.w.sticks.filter((t) => t !== s); } refreshFree(); }
          if (sc === 'pause') openPause();
          if (sc === 'pull') {
            // A clean lift part-way, planned on the real physics (the hint's plan), so the screenshot shows a stick coming out of the heap.
            const pl = createPlanner(state.w, PROFILES[4], aiRng, { perfect: true }); while (!pl.done) pl.step(2000);
            const r = pl.result, s = r && byId(state.w, r.id);
            if (s && startPull(state.w, s.id, s.x + Math.cos(s.a) * s.lh * r.k, s.y + Math.sin(s.a) * s.lh * r.k)) {
              state.m.phase = 'pull'; state.humanTurn = true; const p = state.w.pull; state.grab = { px: 0, py: 0, lx: 0, ly: 0, g0x: p.g0x, g0y: p.g0y };
              for (let i = 0, t = 0; i < 400 && !p.done && p.dist < +(q.lift || 70); i++, t += 1 / 60) { const L = Math.min(r.dist, r.speed * t); setTarget(state.w, p.g0x + Math.cos(r.ang) * L, p.g0y + Math.sin(r.ang) * L); stepPull(state.w, 1 / 60); }
              state.finger = { x: p.gx + 24, y: p.gy + 20 }; state.devHold = true;   // dev/shot scenes only: no finger is down, keep the lift on screen
            }
          }
          if (sc === 'result') { state.m.scores = [31, 19]; state.m.roundLog = [{ round: 1, pts: [31, 19] }]; state.m.over = { win: 0, extra: false }; state.m.result = { cleared: true, stars: 2 }; state.scene = 'result'; }
          if (sc === 'score') { state.m.rp = [11, 8]; scoreRound(state.m); state.m.roundInfo.t = 3; }
          if (q.hint) requestHint();
          if (q.hintNow) { const pl = createPlanner(state.w, PROFILES[4], aiRng, { perfect: true }); while (!pl.done) pl.step(2000); state.hintShot = pl.result; }
        } else if (sc === 'ladder') { state.record.ladder = { reached: 5, stars: [3, 2, 3, 1] }; state.scene = 'ladder'; }
        else if (sc === 'rules' || sc === 'howto' || sc === 'about') { state.back = 'title'; state.scene = sc; state.refScroll = +(q.scroll || 0); }
        else state.scene = sc;
      };

  startAttract();
  resetMenus();

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused,
    update(dt, input) {
      if (!wheelHooked && input.onWheel) {   // kit 1.8.0: mouse wheel / trackpad scrolls the readers and the menu lists
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'setup', 'ladder', 'settings', 'result', 'demolimit'].includes(state.scene) || state.pauseMenu) { const mt = flowMeta(); state.ui.scroll = clamp(state.ui.scroll + dy, 0, mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0); }
        });
      }
      syncSize();
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'ladder': updateFlowScene(dt, input, handleLadder, 'ladder'); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      syncSize();
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'ladder': renderLadder(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.m) renderPlay(ctx, state);
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    // Dev only (?dev=1): jump to a screen for layout checks and screenshots (see main.js). Never present in production.
    dev: config.dev ? { board: () => ({ ...layoutOf(state).board, W: meta.width, H: meta.height, hint: layoutOf(state).hint, menu: layoutOf(state).menu }), go } : undefined,
    // Store screenshots (?shot=1&seed=N, see main.js): shows a fixed scene, nothing else. The preview gate still wraps the game.
    shotScene: (n) => { const q = SHOTS[n]; if (q) go(q); },
    lockupZone: () => lockupZone(),
  };
}
