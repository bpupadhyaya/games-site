// Horseshoe Pitching: state and flow. Physics lives in sim.js, rules in match.js, rivals in ai.js, drawing in view.js / menus.js.
// This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto / about / rules, demolimit.
// A pitch: drag the target on the pit board to where the shoe should come to rest, pick a flip (three-quarter or one and a quarter),
// then hold PITCH and let go while the swinging arm is in the green. The release decides how well the shoe lands and turns.
import {
  PITS, PIT_IDS, FLIPS, LANE, FLIGHT_T, flightPos, TARGET_LIMITS, SWING, armAngle, releaseError, resolveThrow, dailyPit, clamp, windowDeg,
} from './sim.js';
import { newMatch, turnOf, shoeThrown, endInning, advance } from './match.js';
import { createPlanner, executePlan, PROFILES, PARTNER } from './ai.js';
import { makeAnim, stepAnim, animDone } from './anim.js';
import { inRect, TEXT_SCALES, THINK_STEPS, layoutFor } from './layout.js';
import { drawLane, drawBoard, drawGauge, drawCard, drawPopup, drawToast, boardView, TEAM, CAM_REST, CAM_CLOSE, glWindow, woodBackdrop } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, hitScreen, flowMeta, REF, ensureLayout, flowRects, lockupZone } from './menus.js';
import { drawButton, setPress, FONT, DISPLAY } from './ui.js';
import { ABOUT, HOWTO, RULES } from './content.js';

// `meta.width/height` are updated live by the kit on every resize (fluid mode: the short side is always 720 units).
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_INNING_CAP = 3;
const ease = (k) => k * k * (3 - 2 * k);
const lerp = (a, b, k) => a + (b - a) * k;
const CAM_KEYS = ['x', 'y', 'z', 'lx', 'ly', 'lz', 'fov'];

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const lay = () => layoutFor(meta.width, meta.height);
  const fx = rng.fork();
  const aiRng = rng.fork();
  const throwRnd = () => fx.next();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, calm: false, textIdx: 0, thinkIdx: 1, slow: false },
    record: { wins: [0, 0, 0, 0, 0], played: 0, streak: 0, best: 0, demoInnings: 0, thrown: 0, perfect: 0, ringers: 0 },
    setup: { mode: 'ai', opp: 0, pit: 'clay', target: 21 }, setupMsg: '', restoreMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0,
    m: null, pit: 'clay', shoes: [], fly: null, anim: null, cam: { ...CAM_REST },
    labels: [{ name: 'You' }, { name: 'Rival' }],
    flip: 0, target: { tx: 0, tv: -0.04 }, arm: null, lastRel: null, aimDrag: false, swingHold: null,
    parts: [], toast: '', toastT: 0, humanTurn: false, think: null, explain: null, hintBusy: false, thinkSecs: 5,
    att: null, loaded: false, evq: [], useGL: false, gl: null,
  };
  let planner = null, hintPlanner = null, aiPlan = null, pitObj = PITS.clay;
  const dailyObj = () => dailyPit(config.day | 0);

  // ---- persistence ---------------------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    while (state.record.wins.length < PROFILES.length) state.record.wins.push(0);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ---------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    whoosh: () => tone({ freq: 380, to: 140, dur: 0.5, type: 'sawtooth', vol: 0.03 }),
    thud: (v = 1) => tone({ freq: 110, to: 52, dur: 0.14, type: 'sine', vol: Math.min(0.22, 0.08 * v + 0.05) }),
    clank: () => { tone({ freq: 1250 + fx.next() * 150, to: 980, dur: 0.22, type: 'square', vol: 0.045 }); tone({ freq: 640, to: 540, dur: 0.3, type: 'triangle', vol: 0.09 }); },
    ring: () => { [1320, 1760, 2210].forEach((f, i) => tone({ freq: f, to: f * 0.985, dur: 0.55 - i * 0.1, type: 'triangle', vol: 0.09 })); tone({ freq: 700, to: 600, dur: 0.35, type: 'square', vol: 0.035 }); },
    tink: () => tone({ freq: 1500, to: 1300, dur: 0.1, type: 'triangle', vol: 0.05 }),
    clack: () => { tone({ freq: 480, to: 330, dur: 0.12, type: 'triangle', vol: 0.1 }); tone({ freq: 1400, to: 900, dur: 0.05, type: 'square', vol: 0.03 }); },
    scuff: () => tone({ freq: 240, to: 150, dur: 0.18, type: 'sawtooth', vol: 0.02 }),
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 210, to: 130, dur: 0.22, type: 'sawtooth', vol: 0.06 }),
    good: () => tone({ freq: 660, to: 990, dur: 0.16, type: 'triangle', vol: 0.09 }),
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.12 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- particles (world coordinates: x across, y up, z along the lane) ----------------------------------------------------------
  const MAX_PARTS = 70;
  const dust = (parts, x, v, n, size = 1) => {
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) parts.push({ kind: 0, x, y: 0.04, z: LANE + v, vx: (fx.next() - 0.5) * 0.9, vy: 0.3 + fx.next() * 0.7, vz: (fx.next() - 0.5) * 0.9, t: 0, max: 0.5 + fx.next() * 0.5, size });
  };
  const sparks = (parts, x, v, n) => {
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) parts.push({ kind: 1, x, y: 0.1, z: LANE + v, vx: (fx.next() - 0.5) * 2.6, vy: 0.8 + fx.next() * 1.6, vz: (fx.next() - 0.5) * 2.6, t: 0, max: 0.22 + fx.next() * 0.25 });
  };
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vy -= 4 * dt; q.vx *= 0.97; q.vz *= 0.97; if (q.y < 0.01) { q.y = 0.01; q.vy = 0; } }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };

  // what a plan event looks like and sounds like (`near` = where the shoe is, for events that carry no position)
  let evSeq = 0;
  const playEvents = (evs, parts, loud, near, queue) => {
    for (const e of evs) {
      const x = e.x ?? near.x, v = e.v ?? near.v;
      if (queue) { queue.push({ id: ++evSeq, type: e.t, x, v }); if (queue.length > 24) queue.shift(); }
      if (e.t === 'land') { dust(parts, x, v, 6, 1.2); if (loud) sfx.thud(1); }
      else if (e.t === 'hop') { dust(parts, x, v, 3); if (loud) { sfx.thud(0.6); sfx.scuff(); } }
      else if (e.t === 'tink') { sparks(parts, x, v, 2); if (loud) sfx.tink(); }
      else if (e.t === 'clank') { sparks(parts, x, v, 8); if (loud) sfx.clank(); }
      else if (e.t === 'ring') { sparks(parts, 0, 0, 12); if (loud) sfx.ring(); }
      else if (e.t === 'clack') { dust(parts, x, v, 3); if (loud) sfx.clack(); }
      else if (e.t === 'knock') { sparks(parts, x, v, 6); dust(parts, x, v, 4); if (loud) sfx.clack(); }
    }
  };
  const nearOf = (world, anim) => { const s = world.shoes.find((q) => q.id === anim.id); return s ? { x: s.x, v: s.v } : { x: 0, v: 0 }; };

  // ---- the attract lane behind the menus ----------------------------------------------------------------------------------------
  const startAttract = () => {
    state.att = { shoes: [], fly: null, parts: [], cam: { ...CAM_CLOSE }, anim: null, wait: 1.0, n: 0, t: 0, id: 1, evq: [] };
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    a.t += dt;
    const sway = Math.sin(a.t * 0.25);
    a.cam.x = 0.55 + sway * 0.18; a.cam.y = 0.95; a.cam.z = LANE - 2.6 + Math.sin(a.t * 0.17) * 0.25; a.cam.lx = 0; a.cam.ly = 0.1; a.cam.lz = LANE;
    if (!a.anim) {
      a.wait -= dt;
      if (a.wait <= 0) {
        if (a.shoes.length >= 4) a.shoes = [];
        const side = a.n % 2;
        const aim = [[0, -0.03], [0.15, -0.08], [-0.12, 0.05], [0.03, -0.02]][a.n % 4];
        const p = { tx: aim[0], tv: aim[1], flip: a.n % 3 === 1 ? 0 : 1, e: ((a.n % 5) - 2) * 0.12, kLat: 1.2, kDep: 1.2, kAng: 1 };
        const plan = resolveThrow('clay', a.shoes, { ...p, side, id: a.id++ }, throwRnd);
        a.anim = makeAnim(plan, p, side, a.shoes, side); a.n++;
      }
    } else {
      const evs = stepAnim(a.anim, dt, a);
      playEvents(evs, a.parts, false, nearOf(a, a.anim), a.evq);
      if (animDone(a.anim)) { a.anim = null; a.wait = 1.25; }
    }
    stepParts(a.parts, dt);
  };

  // ---- match flow ----------------------------------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  // who pitches this shoe: a profile (computer) or null (a person)
  const playerOf = (side) => {
    const c = state.m.cfg, odd = state.m.inning % 2 === 1;
    if (c.mode === 'watch') return side === 0 ? PROFILES[c.watchA] : PROFILES[c.opp];
    if (c.mode === 'two') return null;
    if (c.mode === 'doubles') return side === 0 ? (odd ? null : PARTNER) : (odd ? PROFILES[c.opp] : PROFILES[(c.opp + 1) % PROFILES.length]);
    return side === 0 ? null : PROFILES[c.opp];
  };
  const isAI = (side) => playerOf(side) !== null;
  const makeLabels = (c) => {
    if (c.mode === 'two') return [{ name: 'Player 1' }, { name: 'Player 2' }];
    if (c.mode === 'watch') return [{ name: PROFILES[c.watchA].name }, { name: PROFILES[c.opp].name }];
    if (c.mode === 'doubles') return [{ name: 'You & Sunny' }, { name: `${PROFILES[c.opp].name} & ${PROFILES[(c.opp + 1) % PROFILES.length].name}` }];
    return [{ name: 'You' }, { name: PROFILES[c.opp].name }];
  };
  const whoName = (side) => {
    const c = state.m.cfg;
    if (c.mode === 'doubles') { const p = playerOf(side); return p === null ? 'You' : p.name; }
    return state.labels[side].name;
  };
  const resetTurnState = () => { state.arm = null; state.think = null; planner = null; aiPlan = null; state.explain = null; state.swingHold = null; state.aimDrag = false; };
  const defaultTarget = () => { state.target = { tx: 0, tv: -0.04 }; };

  const startAim = () => {
    const m = state.m;
    m.phase = 'aim';
    resetTurnState();
    const side = turnOf(m);
    state.humanTurn = !isAI(side);
    if (state.humanTurn) {
      defaultTarget();
      if (m.cfg.mode === 'two') toast(`${state.labels[side].name}: your shoe`, 1.6);
      else if (state.toastT > 0) { /* a result toast (RINGER!) is still showing: keep it */ }
      else if ((state.record.thrown | 0) < 3) toast('Drag the target on the pit board, pick a flip, hold PITCH and let go in the green', 4.6);
      else if (m.idx === 0 && m.inning > 1) toast(`Inning ${m.inning}: you pitch first`, 1.6);
    }
  };
  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoInnings >= DEMO_INNING_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    pitObj = cfg.pit === 'daily' ? dailyObj() : PITS[cfg.pit] || PITS.clay;
    state.pit = cfg.pit;
    state.m = newMatch({ target: 21, mode: 'ai', opp: 0, pit: cfg.pit, first: aiRng.int(2), watchA: 2, ...cfg });
    state.labels = makeLabels(state.m.cfg);
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.shoes = []; state.fly = null; state.anim = null; state.parts = []; state.lastRel = null; state.hintBusy = false; hintPlanner = null;
    state.cam = { ...CAM_REST };
    state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
    state.flip = 0;
    startAim();
  };
  const startWatch = () => {
    const picks = [1, 2, 3, 4];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, pit: PIT_IDS[aiRng.int(3)], target: 11 });
  };

  const currentParams = () => ({ tx: state.target.tx, tv: state.target.tv, flip: state.flip });
  const throwShoe = (side, p) => {
    const m = state.m;
    const full = { ...p, side, id: m.nextId++ };
    const plan = resolveThrow(pitObj, state.shoes, full, throwRnd);
    state.anim = makeAnim(plan, p, side, state.shoes, side);
    state.fly = null;
    shoeThrown(m);
    m.phase = 'fly';
    if (!isAI(side)) state.record.thrown = (state.record.thrown | 0) + 1;
    state.humanTurn = false; state.think = null; state.explain = null; planner = null; hintPlanner = null; state.hintBusy = false; aiPlan = null;
    state.arm = null; state.swingHold = null;
    sfx.whoosh();
  };

  const afterAnim = () => {
    const m = state.m;
    state.anim = null; state.fly = null;
    const me = state.shoes.find((s) => s.id === m.nextId - 1);
    if (me && me.ringer) { toast('RINGER!', 1.8); sfx.chime(2); state.record.ringers = (state.record.ringers | 0) + 1; }
    else if (me && me.dead) { toast('Out of the pit: that shoe is dead', 2.2); sfx.no(); }
    if (m.idx >= 4) {
      const rec = endInning(m, state.shoes);
      m.phase = 'score'; m.endInfo = { rec, t: 0 };
      if (rec.pts > 0) for (let i = 0; i < Math.min(rec.pts, 4); i++) sfx.chime(i); else sfx.no();
      return;
    }
    startAim();
  };

  const inningText = (rec) => {
    const lab = (s) => state.labels[s].name;
    const R = rec.ringers, g = rec.gross;
    const parts = (s) => {
      const a = [];
      if (R[s]) a.push(`${R[s]} ringer${R[s] > 1 ? 's' : ''} (${R[s] * 3})`);
      if (rec.close[s]) a.push(`${rec.close[s]} close shoe${rec.close[s] > 1 ? 's' : ''} (${rec.close[s]})`);
      return a.length ? a.join(' + ') : 'nothing in the ring';
    };
    const lines = [`${lab(0)}: ${parts(0)} = ${g[0]}`, `${lab(1)}: ${parts(1)} = ${g[1]}`];
    if (rec.side < 0) lines.push(g[0] === 0 ? 'No score this inning.' : 'Even: they cancel out.');
    else lines.push(`${lab(rec.side)} scores ${rec.pts} (the lower total is taken away).`);
    return { head: rec.side < 0 ? 'No score' : `+${rec.pts}  ${lab(rec.side)}`, lines };
  };

  const afterInning = () => {
    const m = state.m, rec = m.endInfo.rec;
    if (m.cfg.mode !== 'watch') state.record.demoInnings++;
    const over = advance(m, rec);
    state.shoes = [];
    if (over) {
      state.scene = 'result'; state.ui.scroll = 0;
      const win = m.over.win === 0;
      if (m.cfg.mode === 'ai' || m.cfg.mode === 'doubles') {
        state.record.played++;
        if (win) { state.record.wins[m.cfg.opp]++; state.record.streak++; state.record.best = Math.max(state.record.best, state.record.streak); } else state.record.streak = 0;
      }
      if (win && m.cfg.mode !== 'watch' && m.cfg.mode !== 'two') sfx.win();
      save();
    } else if (state.demo && m.cfg.mode !== 'watch' && state.record.demoInnings >= DEMO_INNING_CAP) { save(); state.scene = 'demolimit'; state.ui.scroll = 0; }
    else { save(); startAim(); }
  };

  // ---- aiming and the arm ------------------------------------------------------------------------------------------------------
  // where a touch on the pit board lands on the clay: through the 3D board camera when it is drawing, else the flat 2D mapping
  const boardPoint = (rect, px, py) => {
    if (state.useGL && state.gl && state.gl.boardInv) { const q = state.gl.boardInv(px, py - 26); if (q) return q; }
    return boardView(rect).inv(px, py - 26);
  };
  const setTarget = (x, v) => { state.target = { tx: clamp(x, -TARGET_LIMITS.x, TARGET_LIMITS.x), tv: clamp(v, TARGET_LIMITS.v0, TARGET_LIMITS.v1) }; };
  const armSpeed = () => (state.settings.slow ? 0.68 : 1);
  const beginSwing = () => { state.arm = { t: 0, live: true, ...armAngle(0) }; sfx.tick(); state.toastT = 0; };
  const releaseSwing = () => {
    const a = state.arm, m = state.m;
    if (!a) return;
    const ang = armAngle(a.t, armSpeed());
    const e = releaseError(ang, state.flip, state.settings.calm);
    const ae = Math.abs(e);
    const word = ang.phase === 'back' ? 'Dropped: you let go during the wind-up' : ae <= 0.35 ? 'Perfect release!' : ae <= 1 ? 'Good release' : e < 0 ? 'Too early: it will land short' : 'Too late: it will carry long';
    state.lastRel = { label: word, e, t: 0 };
    if (ae <= 0.35 && ang.phase === 'fwd') { state.record.perfect = (state.record.perfect | 0) + 1; sfx.good(); }
    toast(word, 1.6);
    throwShoe(turnOf(m), { ...currentParams(), e, kLat: 1, kDep: 1, kAng: 1 });
  };

  const describePlan = (plan) => {
    const f = FLIPS[plan.params.flip].short;
    const what = plan.kind === 'knock' ? 'knock a shoe off' : plan.kind === 'ringer' ? 'go for the ringer' : plan.kind === 'safe' ? 'stay out of trouble' : 'land beside the stake';
    return `${f}: ${what}`;
  };

  // ---- computer turn --------------------------------------------------------------------------------------------------------
  const beginAISwing = (th, prof) => {
    const p = executePlan(aiPlan, prof, aiRng.next);
    th.p = p; th.phase = 'swing'; th.t = 0; th.dur = 0.75;
    state.flip = p.flip; state.target = { tx: aiPlan.params.tx, tv: aiPlan.params.tv };
    state.arm = { t: 0, live: true, deg: -SWING.A, phase: 'back' };
    if (mode() !== 'watch') state.explain = null;
  };
  const updateAI = (dt) => {
    const m = state.m;
    if (m.phase !== 'aim' || !isAI(turnOf(m)) || state.paused) return;
    const side = turnOf(m), prof = playerOf(side), watch = mode() === 'watch';
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur, phase: 'think' };
      planner = createPlanner(pitObj, state.shoes, side, prof, aiRng.next, {});
    }
    const th = state.think;
    th.t += dt;
    if (planner && !planner.done) {
      planner.step(6);
      state.explain = { head: `${whoName(side)} is thinking…`, lines: [`Tried ${planner.sims} pitches on a copy of the pit`, 'Ringer, close shoe, or knock a shoe off the stake?'] };
      if (planner.done) { aiPlan = planner.result; planner = null; }
    }
    if (th.phase === 'think' && th.t >= th.dur && aiPlan) {
      if (watch) {
        th.phase = 'reveal'; th.t = 0; th.dur = 2;
        const q = aiPlan.params;
        state.flip = q.flip; state.target = { tx: q.tx, tv: q.tv };
        toast(`${whoName(side)}: ${describePlan(aiPlan)}`, 2.2);
        state.explain = {
          head: `${whoName(side)} chooses: ${describePlan(aiPlan)}`,
          lines: aiPlan.alts.map((a, i) => `${i + 1}. ${FLIPS[a.params.flip].short}, ${a.kind === 'knock' ? 'knock off' : a.kind === 'ringer' ? 'ringer try' : a.kind === 'safe' ? 'safe' : 'close'}  (${a.score >= 0 ? '+' : ''}${a.score.toFixed(2)})`),
        };
      } else beginAISwing(th, prof);
    } else if (th.phase === 'reveal' && th.t >= th.dur) beginAISwing(th, prof);
    else if (th.phase === 'swing') {
      const k = clamp(th.t / th.dur, 0, 1), target = SWING.mark + th.p.e * windowDeg(th.p.flip, false);
      state.arm = { t: th.t, live: true, deg: lerp(-SWING.A, target, ease(k)), phase: 'fwd' };
      if (th.t >= th.dur) throwShoe(side, th.p);
    }
  };

  // ---- hint ---------------------------------------------------------------------------------------------------------------------
  const requestHint = () => {
    const m = state.m;
    if (state.hintBusy || m.phase !== 'aim' || !state.humanTurn) return;
    state.hintBusy = true;
    hintPlanner = createPlanner(pitObj, state.shoes, turnOf(m), PROFILES[PROFILES.length - 1], aiRng.next, { perfect: true });
    toast('Looking for a good pitch…', 1.2);
  };
  const updateHint = () => {
    if (!hintPlanner) return;
    hintPlanner.step(10);
    if (hintPlanner.done) {
      const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.m.phase !== 'aim' || !state.humanTurn) return;
      state.flip = r.params.flip; state.target = { tx: r.params.tx, tv: r.params.tv };
      toast(`Hint: ${describePlan(r)}`, 3.4);
    }
  };

  // ---- the camera ---------------------------------------------------------------------------------------------------------------
  const camTarget = () => {
    const a = state.anim;
    if (!a) return CAM_REST;
    if (a.t < FLIGHT_T) {
      // Chase view of the whole arc: the camera stays behind the pitcher, widens just enough to keep the shoe and the pit in frame
      // (the lane window can be wide and short on a phone), and looks at a point that follows the shoe toward the landing.
      const k = a.t / FLIGHT_T, sp = flightPos(a.plan.land, k), r = lay().play.lane;
      const half = Math.tan((11.5 * Math.PI) / 180), fov = clamp((2 * Math.atan(half * (r.w / Math.max(1, r.h))) * 180) / Math.PI, 30, 62);
      const w = ease(Math.min(1, k * 2.2));
      const tz = lerp(LANE * 0.5, LANE + a.plan.land.v, k);
      return { x: 0.3, y: 1.55, z: -2.2, lx: sp.x * 0.5, ly: lerp(CAM_REST.ly, 1.5 + (sp.y - 1.4) * 0.35, w), lz: lerp(LANE, tz + (sp.z - tz) * 0.15, w), fov: lerp(CAM_REST.fov, fov, Math.min(1, k * 4)) };
    }
    const L = a.plan.land;
    return { ...CAM_CLOSE, lx: L.x * 0.4, lz: LANE + L.v * 0.4 };
  };
  const stepCam = (dt) => {
    const tg = camTarget(), flying = state.anim && state.anim.t < FLIGHT_T;
    const r = 1 - Math.exp(-dt * (flying ? 14 : state.anim ? 4.5 : 3));
    for (const k of CAM_KEYS) state.cam[k] += (tg[k] - state.cam[k]) * r;
  };

  // ---- the play scene -------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leaveMatch = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; resetTurnState(); hintPlanner = null; state.hintBusy = false; state.anim = null; state.fly = null; };

  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.cols.length) state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, mt.max);
  }
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

  const updatePlay = (dt, input) => {
    const m = state.m;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch', L = lay(), P = L.play;
    meta.previewBadge = { x: P.lane.x + P.lane.w - 12, y: P.lane.y + 10, align: 'right' };
    if (config.dev && keys.pressed.has('KeyK')) { m.scores[0] = m.cfg.target; m.over = { win: 0, shutout: m.scores[1] === 0, innings: m.inning }; m.phase = 'over'; state.scene = 'result'; return; }
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
        else if (inRect(P.demo.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); }
        else if (inRect(P.demo.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); }
        else if (inRect(P.demo.exit, ptr.x, ptr.y)) { leaveMatch(); return; }
      }
    } else if (ptr.pressed && inRect(P.menu, ptr.x, ptr.y)) { openPause(); return; }

    if (state.humanTurn && !state.paused && m.phase === 'aim') {
      const swinging = !!(state.arm && state.arm.live);
      if (ptr.pressed && !swinging) {
        let hit = false;
        P.flips.forEach((r, i) => { if (inRect(r, ptr.x, ptr.y)) { hit = true; state.flip = i; sfx.tick(); } });
        if (inRect(P.hint, ptr.x, ptr.y)) { hit = true; requestHint(); sfx.tick(); }
        if (inRect(P.pitch, ptr.x, ptr.y)) { hit = true; beginSwing(); state.swingHold = 'ptr'; }
        if (!hit && inRect(P.board, ptr.x, ptr.y)) {
          const q = boardPoint(P.board, ptr.x, ptr.y);
          setTarget(q.x, q.v); state.aimDrag = true;
        }
      }
      if (state.aimDrag && ptr.down && !swinging) { const q = boardPoint(P.board, ptr.x, ptr.y); setTarget(q.x, q.v); }
      if (!ptr.down) state.aimDrag = false;
      if (!swinging) {
        const t = state.target;
        if (keys.down.has('ArrowLeft')) setTarget(t.tx - 0.004, t.tv);
        if (keys.down.has('ArrowRight')) setTarget(t.tx + 0.004, t.tv);
        if (keys.down.has('ArrowUp')) setTarget(t.tx, t.tv + 0.006);
        if (keys.down.has('ArrowDown')) setTarget(t.tx, t.tv - 0.006);
        if (keys.pressed.has('Digit1')) state.flip = 0;
        if (keys.pressed.has('Digit2')) state.flip = 1;
        if (keys.pressed.has('KeyH')) requestHint();
        if (keys.pressed.has('Space')) { beginSwing(); state.swingHold = 'key'; }
      }
      if (state.arm && state.arm.live && state.humanTurn) {
        state.arm.t += dt;
        Object.assign(state.arm, armAngle(state.arm.t, armSpeed()));
        const held = state.swingHold === 'key' ? keys.down.has('Space') : ptr.down;
        if (!held) { state.swingHold = null; releaseSwing(); }
      }
    } else if (!state.humanTurn) state.aimDrag = false;
    if (state.paused) return;
    updateHint();
    updateAI(dt);
    stepCam(dt);
    if (m.phase === 'fly' && state.anim) {
      const evs = stepAnim(state.anim, dt, state);
      if (evs.length) playEvents(evs, state.parts, true, nearOf(state, state.anim), state.evq);
      if (animDone(state.anim)) afterAnim();
    }
    stepParts(state.parts, dt);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.lastRel) state.lastRel.t += dt;
    if (m.phase === 'score') {
      m.endInfo.t += dt;
      const auto = watch && m.endInfo.t > 4.5;
      if ((ptr.pressed && m.endInfo.t > 0.9) || auto || (keys.pressed.has('Space') && m.endInfo.t > 0.9)) afterInning();
    }
  };

  // ---- menus ----------------------------------------------------------------------------------------------------------------
  const openSetup = (md) => { state.setup.mode = md; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; };
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'play') openSetup('ai');
    else if (id === 'doubles') openSetup('doubles');
    else if (id === 'two') openSetup('two');
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
    else if (id.startsWith('pit')) { const c = id.slice(3); if (state.demo && c !== 'clay') { state.setupMsg = 'That pit is in the full game.'; return; } s.pit = c; state.setupMsg = ''; }
    else if (id === 'len21') s.target = 21;
    else if (id === 'len11') s.target = 11;
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, pit: s.pit, target: s.target });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-calm') st.calm = !st.calm;
    else if (id === 'set-slow') st.slow = !st.slow;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') { st.thinkIdx = Math.max(0, st.thinkIdx - 1); state.thinkSecs = THINK_STEPS[st.thinkIdx]; }
    else if (id === 'think-inc') { st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1); state.thinkSecs = THINK_STEPS[st.thinkIdx]; }
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
    if (id === 'again') startMatch({ ...cfg, first: aiRng.int(2) });
    else if (id === 'new') { state.setup.mode = cfg.mode === 'watch' ? 'ai' : cfg.mode; state.scene = 'setup'; state.ui.scroll = 0; }
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
    if (k.pressed.has('KeyC') && !state.demo) { const ids = [...PIT_IDS, 'daily']; state.setup.pit = ids[(ids.indexOf(state.setup.pit) + 1) % ids.length]; }
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    const pins = lay().pins;
    if (ptr.pressed && (inRect(pins.start, ptr.x, ptr.y) || inRect(pins.back, ptr.x, ptr.y))) { handleSetup(inRect(pins.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
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

  // ---- drawing the play scene ------------------------------------------------------------------------------------------------
  const claySet = () => (state.pit === 'sand' ? ['#c79a62', '#b58a55', '#d6ad76'] : state.pit === 'hard' ? ['#a9724a', '#96603a', '#b9825a'] : state.pit === 'daily' ? ['#b88a5a', '#a37a4c', '#c79a68'] : ['#b2693b', '#a35f35', '#c27a47']);
  const renderPlay = (ctx, L) => {
    const m = state.m, P = L.play, watch = m.cfg.mode === 'watch';
    if (state.useGL) woodBackdrop(ctx, L.w, L.h);
    else { const bg = ctx.createLinearGradient(0, 0, 0, L.h); bg.addColorStop(0, '#16324c'); bg.addColorStop(1, '#0c1b2b'); ctx.fillStyle = bg; ctx.fillRect(0, 0, L.w, L.h); }
    const side = turnOf(m), active = m.phase === 'score' || m.phase === 'over' ? -1 : side;
    const clay = claySet();
    [0, 1].forEach((s) => drawCard(ctx, P.cards[s], s, state.labels[s].name, m.scores[s], m.left[s], active === s));
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#eaf3fb';
    ctx.font = `700 26px ${DISPLAY}`; ctx.fillText(`Inning ${m.inning}`, P.info.x, P.info.y, P.info.w || 160);
    ctx.font = `400 20px ${FONT}`; ctx.fillStyle = 'rgba(234,243,251,0.8)';
    ctx.fillText(`first to ${m.cfg.target}`, P.info.x, P.info.y2, P.info.w || 160);
    const live = !!(state.arm && state.arm.live);
    if (state.useGL) { glWindow(ctx, P.lane); glWindow(ctx, P.board); }
    else {
      drawLane(ctx, P.lane, { cam: state.cam, shoes: state.shoes, fly: state.fly, parts: state.parts, t: state.t, pitClay: clay[0] });
      const showTarget = (state.humanTurn || (watch && state.think && state.think.phase !== 'think') || (state.think && state.think.phase === 'swing')) && m.phase === 'aim';
      drawBoard(ctx, P.board, { shoes: state.shoes, target: showTarget ? { ...state.target, team: side, k: 1 } : null, t: state.t, clay0: clay[1], clay1: clay[2] });
    }
    if (state.explain && (watch || !state.humanTurn) && m.phase === 'aim') {
      const r = P.lane, x = r.x + 10, w = r.w - 20;
      const lines = [state.explain.head, ...state.explain.lines.slice(0, watch ? 4 : 0)];
      const h = lines.length * 28 + 16;
      ctx.save();
      ctx.fillStyle = 'rgba(8,20,32,0.72)'; ctx.beginPath(); ctx.roundRect(x, r.y + r.h - h - 10, w, h, 14); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      lines.forEach((l, i) => { ctx.font = `${i ? 400 : 700} ${i ? 20 : 22}px ${FONT}`; ctx.fillText(l, x + 14, r.y + r.h - h - 10 + 22 + i * 28, w - 28); });
      ctx.restore();
    }
    const explained = !!(state.explain && (watch || !state.humanTurn) && m.phase === 'aim');
    if (state.toastT > 0 && state.toast && !(watch && explained) && m.phase !== 'score') drawToast(ctx, P.toast, state.toast, state.toastT);
    if (watch) {
      drawButton(ctx, P.demo.dec, 'Think −', { size: 26, sub: `${THINK_STEPS[state.settings.thinkIdx]} s`, disabled: state.settings.thinkIdx === 0 });
      drawButton(ctx, P.demo.inc, 'Think +', { size: 26, disabled: state.settings.thinkIdx === THINK_STEPS.length - 1 });
      drawButton(ctx, P.demo.pause, state.paused ? 'Resume' : 'Pause', { primary: !state.paused, active: state.paused, size: 34 });
      drawButton(ctx, P.demo.exit, 'Leave', { dark: true, size: 28 });
    } else {
      P.flips.forEach((r, i) => drawButton(ctx, r, FLIPS[i].short, { active: state.flip === i, size: 30, sub: i === 0 ? 'wide window' : 'narrow window', disabled: !state.humanTurn }));
      drawGauge(ctx, P.gauge, { flip: state.flip, calm: state.settings.calm, arm: state.arm, live, team: side });
      const can = state.humanTurn && m.phase === 'aim';
      drawButton(ctx, P.hint, 'Hint', { size: 26, disabled: !can || live });
      drawButton(ctx, P.pitch, live ? 'LET GO!' : 'PITCH', { primary: true, size: 40, disabled: !can, sub: live ? undefined : 'hold, then let go' });
      drawButton(ctx, P.menu, 'Menu', { dark: true, size: 26 });
    }
    if (m.phase === 'score' && m.endInfo) {
      const t = inningText(m.endInfo.rec);
      drawPopup(ctx, P.score, { head: t.head, lines: t.lines, zoom: TEXT_SCALES[state.settings.textIdx] });
    }
    if (state.paused && !state.pauseMenu) {
      ctx.fillStyle = 'rgba(8,20,32,0.45)'; ctx.fillRect(P.lane.x, P.lane.y, P.lane.w, P.lane.h);
      ctx.fillStyle = '#fff'; ctx.font = `700 40px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Paused', P.lane.x + P.lane.w / 2, P.lane.y + P.lane.h / 2);
    }
  };

  startAttract();

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused,
    update(dt, input) {
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play') meta.previewBadge = null;
      if (state.att && state.scene !== 'play') updateAttract(dt);
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
    render(ctx, view) {
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height);
      state.useGL = !!(view && view.gl);
      switch (state.scene) {
        case 'title': renderTitle(ctx, state, L); break;
        case 'setup': renderSetup(ctx, state, L); break;
        case 'settings': renderSettings(ctx, state, L); break;
        case 'result': renderResult(ctx, state, L); break;
        case 'demolimit': renderDemoLimit(ctx, state, L); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play', L); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About', L); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules', L); break;
        case 'play':
          if (state.m) renderPlay(ctx, L);
          if (state.pauseMenu) renderPause(ctx, state, L);
          break;
        default: break;
      }
    },
    wheel(dy) {
      if (['about', 'howto', 'rules'].includes(state.scene)) { state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max); return; }
      if (['title', 'setup', 'settings', 'result', 'demolimit'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, flowMeta().max);
    },
    getState: () => state,
    debug: () => ({ lockup: lockupZone(), layout: lay(), flow: flowRects(state.ui.scroll), flowMax: flowMeta().max, TEAM }),
  };
}
