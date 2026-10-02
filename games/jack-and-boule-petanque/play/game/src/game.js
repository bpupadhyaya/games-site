// Jack and Boule: state and flow. Physics lives in sim.js, rules in match.js, drawing in view.js and
// menus.js, the opponent in ai.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto/about/rules, demolimit.
// Throwing: press in the play area and drag back like a slingshot; pull length = distance, pull
// angle = direction; release throws. The loft and spin buttons choose how.
import { W, H } from './cam.js';
import { createRng } from '../kit/rng.js';
import {
  createWorld, makeTerrain, newBall, launch, stepWorld, previewThrow, clamp, MAX_ANG, SPINS, LOFTS, powerFor, theJack,
} from './sim.js';
import { newMatch, beginEnd, judgeJack, placeJack, whoNext, scoreOf, applyEnd, JACK_ID } from './match.js';
import { createPlanner, executePlan, planJack } from './ai.js';
import { PROFILES } from './opponents.js';
import { inRect, PLAY_ZONE, LOFT_BTN, SPIN_BTN, HINT_BTN, MENU_BTN, PULL, DEMO_BAR, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, TEXT_SCALES, THINK_STEPS, SETUP_PINS } from './layout.js';
import { renderPlay, warmPitches } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, hitScreen, flowMeta, pageCount, ensureLayout } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export const meta = { width: W, height: H };
const DEMO_END_CAP = 3;
const PAGE_SCENES = { howto: HOWTO, about: ABOUT, rules: RULES };

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, calm: false, textIdx: 0, thinkIdx: 1 },
    record: { wins: [0, 0, 0, 0, 0], played: 0, streak: 0, best: 0, demoEnds: 0, thrown: 0 },
    setup: { mode: 'ai', opp: 0, pitch: 'village', target: 13 }, setupMsg: '',
    ui: { scroll: 0, drag: null }, page: 0,
    att: null, w: null, m: null,
    sel: { loft: 1, spin: 0 }, drag: null, guide: null, preview: null, hint: null, hintBusy: false, alts: null,
    parts: [], toast: '', toastT: 0, humanTurn: false, showSling: false, mark: null, ff: 1, restT: 0, kb: null, kbOn: false,
    think: null, aiDrag: null, snap: null, shake: null, pop: null, scorePulse: 0, loaded: false,
  };
  let planner = null, hintPlanner = null, previewKey = '', rumble = 0;

  // ---- persistence -----------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound -----------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    whoosh: () => tone({ freq: 520, to: 160, dur: 0.24, type: 'sawtooth', vol: 0.05 }),
    thud: (v, soft) => tone({ freq: soft > 0.5 ? 110 : 150, to: 60, dur: 0.13, type: 'sine', vol: Math.min(0.28, 0.06 + v / 1800) }),
    clack: (v) => {
      const q = Math.min(1, v / 380);
      tone({ freq: 1900 + fx.next() * 500, to: 1150, dur: 0.06, type: 'square', vol: 0.03 + 0.07 * q });
      tone({ freq: 620 + fx.next() * 90, to: 380, dur: 0.1, type: 'triangle', vol: 0.05 + 0.1 * q });
    },
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 220, to: 140, dur: 0.2, type: 'sawtooth', vol: 0.06 }),
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.12 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- the attract world behind the menus --------------------------------------------------------
  const startAttract = () => {
    const T = makeTerrain('village', fx.fork());
    const w = createWorld(T);
    const j = newBall(0, 1, -1, 6, 392); w.balls.push(j);
    const b1 = newBall(1, 0, 0, -22, 384); b1.n = [0.5, 0.3, 0.8]; w.balls.push(b1);
    const b2 = newBall(2, 0, 1, 24, 410); b2.n = [0.2, 0.6, 0.7]; w.balls.push(b2);
    state.att = { w, parts: [], t: 0, n: 3, wait: 2.2 };
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    a.wait -= dt;
    if (a.wait <= 0 && a.w.settled) {
      a.wait = 4.2;
      if (a.w.balls.length > 5) a.w.balls = a.w.balls.filter((b, i) => b.k || i > 2);
      const team = a.n % 2;
      const b = newBall(10 + a.n, 0, team, 0, 0); a.n++;
      const loft = fx.next() < 0.5 ? 1 : 2, jx = theJack(a.w)?.x ?? 0, jy = theJack(a.w)?.y ?? 390;
      const d = Math.hypot(jx + (fx.next() - 0.5) * 24, jy + (fx.next() - 0.5) * 30);
      a.w.balls.push(b);
      launch(a.w, b, { loft, power: powerFor(loft, d - (loft === 1 ? 30 : 6)), ang: Math.atan2(jx, jy) + (fx.next() - 0.5) * 0.05, spin: loft === 2 ? 1 : 0 });
    }
    if (!a.w.settled) {
      const ev = stepWorld(a.w, dt);
      for (const e of ev) {
        if (e.t === 'land' && e.v > 40) burst(a.parts, e.x, e.y, 0, 2 + Math.floor(e.v / 120), 3.4, 0.5, 40);
        else if (e.t === 'hit') { sparks(a.parts, e.x, e.y, 5); burst(a.parts, e.x, e.y, 3, 2, 3, 0.35, 60); }
      }
      a.w.balls = a.w.balls.filter((b) => !(b.out && b.fade > 1.1));
    }
    stepParts(a.parts, dt);
  };

  // ---- particles ---------------------------------------------------------------------------------
  const MAX_PARTS = 140;   // hard cap: a pile-up of hits can never make the frame cost grow without bound
  const burst = (parts, x, y, z, n, size, a, spread = 40) => {
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) parts.push({ kind: 0, x, y, z: z + 2, vx: (fx.next() - 0.5) * spread, vy: (fx.next() - 0.4) * spread, vz: 10 + fx.next() * 30, t: 0, max: 0.55 + fx.next() * 0.5, size, a });
  };
  const sparks = (parts, x, y, n) => {
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) parts.push({ kind: 1, x, y, z: 8, vx: (fx.next() - 0.5) * 260, vy: (fx.next() - 0.5) * 260, vz: 40 + fx.next() * 120, t: 0, max: 0.22 + fx.next() * 0.2, size: 1, a: 1 });
  };
  const stepParts = (parts, dt) => {
    for (const q of parts) {
      q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= 60 * dt; q.vx *= 0.97; q.vy *= 0.97;
      if (q.z < 0) { q.z = 0; q.vz = 0; }
    }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };

  // ---- match flow --------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const isAI = (side) => mode() === 'watch' || (mode() === 'ai' && side === 1);
  const profOf = (side) => (mode() === 'watch' ? PROFILES[side === 0 ? state.m.cfg.watchA : state.m.cfg.opp] : PROFILES[state.m.cfg.opp]);
  const sideLabel = (side) => {
    const m = state.m;
    if (m.cfg.mode === 'two') return side === 0 ? 'Player 1' : 'Player 2';
    if (m.cfg.mode === 'watch') return profOf(side).name;
    return side === 0 ? 'You' : profOf(1).name;
  };

  const startJackPhase = () => {
    const m = state.m;
    state.humanTurn = !isAI(m.turn);
    state.showSling = true; state.guide = null; state.hint = null; state.alts = null; state.think = null; planner = null;
    state.sel.loft = 1; state.sel.spin = 0;
    toast(state.humanTurn ? 'Throw the jack into the lit zone' : `${sideLabel(m.turn)} throws the jack`);
  };
  // Pitches are generated ahead of time (while the title / setup / result screens are up) so the renderer can bake
  // them in idle slices; starting a match then takes the ready pitch instead of making the player wait.
  const prep = {};
  const prepFor = (id) => {
    if (!prep[id]) prep[id] = makeTerrain(id, id === 'daily' ? createRng((config.day | 0) * 7919 + 13) : fx.fork());
    return prep[id];
  };
  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoEnds >= DEMO_END_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const T = prepFor(cfg.pitch);
    if (cfg.pitch !== 'daily') delete prep[cfg.pitch];
    state.w = createWorld(T);
    state.m = newMatch({ target: 13, mode: 'ai', opp: 0, pitch: cfg.pitch, firstJack: aiRng.int(2), watchA: 3, ...cfg });
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.parts = []; state.hint = null; state.guide = null; state.drag = null; state.pop = null;
    beginEnd(state.m, state.w);
    startJackPhase();
  };
  const startWatch = () => {
    const picks = [1, 2, 3, 4];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, pitch: state.setup.pitch === 'daily' ? 'village' : ['village', 'port', 'oliviers', 'colline'][aiRng.int(4)], target: 7 });
  };

  const addScar = (e) => {
    const sc = state.w.scars;
    sc.push({ x: e.x, y: e.y, r: 4 + Math.min(5, e.v / 90), a: 1 });
    if (sc.length > 60) sc.shift();
  };
  const handleEvents = (ev) => {
    for (const e of ev) {
      if (e.t === 'land') {
        if (e.v > 40) { burst(state.parts, e.x, e.y, 0, 2 + Math.floor(e.v / 110), 3.2 + e.soft * 3, 0.5 + e.soft * 0.4, 30 + e.v * 0.1); addScar(e); }
        sfx.thud(e.v, e.soft);
      } else if (e.t === 'hit') {
        sparks(state.parts, e.x, e.y, Math.min(10, 2 + Math.floor(e.v / 70)));
        burst(state.parts, e.x, e.y, 3, 2 + Math.floor(e.v / 150), 3, 0.35, 60);
        sfx.clack(e.v);
        state.parts.push({ kind: 2, x: e.x, y: e.y, z: 6, vx: 0, vy: 0, vz: 0, t: 0, max: 0.35, size: 1, a: 1 });
        if (e.v > 420) burst(state.parts, e.x, e.y, 0, Math.min(10, 4 + Math.floor(e.v / 150)), 4.2, 0.6, 70);
      } else if (e.t === 'stone') sfx.tick();
      else if (e.t === 'out') { burst(state.parts, e.x, e.y, 0, 3, 3, 0.4, 50); toast(e.id === JACK_ID ? 'The jack is out of the lane!' : 'Out of the lane: that boule is dead', 2.4); sfx.no(); }
    }
  };

  const throwBall = (side, p, isJack) => {
    const { m, w } = state;
    const b = isJack ? newBall(JACK_ID, 1, -1, 0, 0) : newBall(m.nextId++, 0, side, 0, 0);
    w.balls.push(b);
    launch(w, b, p);
    const pd = state.drag ?? state.aiDrag;
    state.snap = pd ? { vx: pd.vx, vy: pd.vy, len: pd.len, t: 0, team: side, jack: isJack } : null;
    if (!isJack) { m.hand[side]--; m.throws++; }
    if (!isAI(side)) state.record.thrown = (state.record.thrown | 0) + 1;
    m.last = side;
    m.phase = isJack ? 'jack-fly' : 'fly';
    state.humanTurn = false; state.showSling = false; state.guide = null; state.preview = null; state.hint = null; state.alts = null; state.drag = null; state.think = null; state.aiDrag = null;
    planner = null; hintPlanner = null; state.hintBusy = false;
    state.restT = 0;
    sfx.whoosh();
  };

  const startAim = () => {
    const m = state.m;
    m.phase = 'aim';
    state.humanTurn = !isAI(m.turn);
    state.showSling = true; state.hint = null; state.alts = null; state.think = null; planner = null;
    toast(state.humanTurn ? (m.cfg.mode === 'two' ? `Player ${m.turn + 1}: your throw` : 'Your throw: point or shoot?') : `${sideLabel(m.turn)} is thinking…`, 2.4);
  };

  const finishEnd = (res) => {
    const m = state.m;
    m.phase = 'score';
    m.endInfo = { ...res, t: 0 };
    state.humanTurn = false; state.showSling = false; state.think = null; planner = null;
    const who = res.team === 0 ? (mode() === 'ai' ? 'You score' : `${sideLabel(0)} scores`) : `${sideLabel(1)} scores`;
    toast(res.text || (res.pts ? `${who} ${res.pts}` : 'No score this end'), 3.5);
    if (res.pts > 0) { state.pop = { text: `+${res.pts}`, t: 0, team: res.team }; for (let i = 0; i < Math.min(res.pts, 4); i++) sfx.chime(i); } else sfx.no();
  };

  const onSettled = () => {
    const { m, w } = state;
    w.balls = w.balls.filter((b) => !(b.out && !b.k));
    if (m.phase === 'jack-fly') {
      const r = judgeJack(m, w);
      if (r.placed) { placeJack(m, w, newBall); toast(r.msg, 3); startAim(); return; }
      if (!r.ok) { toast(r.msg, 3.2); startJackPhase(); return; }
      startAim();
      return;
    }
    if (!theJack(w)) { finishEnd(scoreOf(m, w)); return; }
    const n = whoNext(m, w);
    if (n < 0) { finishEnd(scoreOf(m, w)); return; }
    m.turn = n;
    startAim();
  };

  const afterEnd = () => {
    const m = state.m;
    applyEnd(m, m.endInfo);
    if (m.cfg.mode !== 'watch') state.record.demoEnds++;
    if (m.over) {
      state.scene = 'result'; state.ui.scroll = 0;
      if (m.cfg.mode === 'ai') {
        state.record.played++;
        if (m.over.win === 0) { state.record.wins[m.cfg.opp]++; state.record.streak++; state.record.best = Math.max(state.record.best, state.record.streak); sfx.win(); } else state.record.streak = 0;
      }
      save();
    } else if (state.demo && m.cfg.mode !== 'watch' && state.record.demoEnds >= DEMO_END_CAP) { save(); state.scene = 'demolimit'; state.ui.scroll = 0; }
    else { save(); beginEnd(m, state.w); startJackPhase(); }
  };

  // ---- aiming ------------------------------------------------------------------------------------
  const paramsFromDrag = (dr) => {
    const ang = clamp(Math.atan2(-dr.vx, dr.vy), -MAX_ANG, MAX_ANG);
    const power = clamp((dr.len - PULL.min) / (PULL.max - PULL.min), 0, 1);
    return { loft: state.sel.loft, power, ang, spin: state.sel.spin };
  };
  const setGuide = (p) => {
    state.guide = p;
    if (state.settings.calm && p) {
      const key = `${p.loft}|${Math.round(p.power * 300)}|${Math.round(p.ang * 600)}|${p.spin}`;
      if (key !== previewKey) {
        previewKey = key;
        const pv = previewThrow(state.w, p, { jack: state.m.phase === 'jack', team: state.m.turn, every: 4 });
        state.preview = { path: pv.path, rest: pv.rest, land: pv.land };
      }
    } else state.preview = null;
  };
  const releaseThrow = (p) => {
    const m = state.m, jack = m.phase === 'jack';
    if (jack && p.loft === 3) p = { ...p, loft: 1 };
    throwBall(m.turn, p, jack);
  };

  const describePlan = (plan) => {
    const L = LOFTS[plan.params.loft], S = SPINS[plan.params.spin];
    return `${L.name}${plan.params.spin ? ` with ${S.name.toLowerCase()} spin` : ''}: ${plan.kind === 'shoot' ? 'shoot at a rival' : 'point'}`;
  };

  // ---- AI turn -----------------------------------------------------------------------------------
  const updateAI = (dt) => {
    const { m } = state;
    if (!(m.phase === 'aim' || m.phase === 'jack') || !isAI(m.turn) || state.paused) return;
    const prof = profOf(m.turn), watch = mode() === 'watch';
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur, phase: 'think', plan: null, params: null };
      if (m.phase === 'jack') state.think.params = planJack(aiRng, prof);
      else planner = createPlanner(state.w, m, m.turn, prof, aiRng, {});
    }
    const th = state.think;
    th.t += dt;
    if (planner && !planner.done) { planner.step(10); if (planner.done) { th.plan = planner.result; planner = null; } }
    const ready = th.params || th.plan;
    if (th.phase === 'think' && th.t >= th.dur && ready) {
      if (watch && th.plan) {
        th.phase = 'reveal'; th.t = 0; th.dur = 2;
        state.hint = th.plan.params; state.alts = th.plan.alts;
        toast(`${sideLabel(m.turn)}: ${describePlan(th.plan)}`, 2.2);
      } else beginPull(th);
    } else if (th.phase === 'reveal' && th.t >= th.dur) beginPull(th);
    else if (th.phase === 'pull') {
      const k = Math.min(1, th.t / th.dur), e = 1 - Math.pow(1 - k, 3);
      const len = PULL.min + th.p.power * (PULL.max - PULL.min);
      state.aiDrag = { vx: -Math.sin(th.p.ang) * len * e, vy: Math.cos(th.p.ang) * len * e, len: len * e };
      if (th.t >= th.dur) { const p = th.p, jack = m.phase === 'jack'; state.aiDrag = null; throwBall(m.turn, p, jack); }
    }
  };
  const beginPull = (th) => {
    const m = state.m, prof = profOf(m.turn);
    const p = th.params ?? executePlan(th.plan, prof, aiRng);
    th.p = p; th.phase = 'pull'; th.t = 0; th.dur = 0.55; state.hint = null; state.alts = null;
    state.sel.loft = p.loft; state.sel.spin = p.spin;
  };

  // ---- the play scene ----------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };

  const requestHint = () => {
    const m = state.m;
    if (state.hintBusy || m.phase !== 'aim') return;
    state.hintBusy = true;
    hintPlanner = createPlanner(state.w, m, m.turn, PROFILES[4], aiRng, { perfect: true });
  };
  const updateHint = () => {
    if (!hintPlanner) return;
    hintPlanner.step(12);
    if (hintPlanner.done) {
      const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.m.phase !== 'aim') return;
      state.hint = r.params; state.alts = null;
      state.sel.loft = r.params.loft; state.sel.spin = r.params.spin;
      toast(`Hint: ${describePlan(r)}`, 3.2);
    }
  };

  const updatePlay = (dt, input) => {
    const { m } = state;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch';
    // tester tool (browser ?dev=1 only): finish the match now so the result screen can be checked
    if (config.dev && keys.pressed.has('KeyK')) { m.scores[0] = m.cfg.target; m.over = { win: 0, fanny: m.scores[1] === 0 }; m.phase = 'over'; state.scene = 'result'; return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else state.paused = !state.paused; }
    // overlays
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) { state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 }; }
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) {
        const d = state.ui.drag; state.ui.drag = null;
        if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      }
      return;
    }
    if (watch) {
      if (ptr.pressed) {
        if (inRect(DEMO_BAR.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(DEMO_BAR.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); }
        else if (inRect(DEMO_BAR.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); }
        else if (inRect(DEMO_BAR.exit, ptr.x, ptr.y)) { leaveMatch(); return; }
      }
    } else if (ptr.pressed && inRect(MENU_BTN, ptr.x, ptr.y)) { openPause(); return; }
    state.ff = (m.phase === 'fly' || m.phase === 'jack-fly') && ptr.down && !state.paused ? 3 : 1;
    if (state.humanTurn && !state.paused) {
      if (ptr.pressed) {
        let hit = false;
        LOFT_BTN.forEach((r, i) => { if (inRect(r, ptr.x, ptr.y) && !(m.phase === 'jack' && i === 3)) { state.sel.loft = i; hit = true; sfx.tick(); } });
        if (inRect(SPIN_BTN, ptr.x, ptr.y)) { state.sel.spin = (state.sel.spin + 1) % SPINS.length; hit = true; sfx.tick(); }
        if (inRect(HINT_BTN, ptr.x, ptr.y)) { hit = true; if (m.phase === 'aim') { requestHint(); sfx.tick(); } }
        if (!hit && inRect(PLAY_ZONE, ptr.x, ptr.y)) { state.drag = { sx: ptr.x, sy: ptr.y, vx: 0, vy: 0, len: 0 }; state.hint = null; }
      }
      if (state.drag) {
        if (ptr.down) {
          state.drag.vx = ptr.x - state.drag.sx; state.drag.vy = ptr.y - state.drag.sy; state.drag.len = Math.hypot(state.drag.vx, state.drag.vy);
          const valid = state.drag.vy > 0 && state.drag.len >= PULL.min;
          setGuide(valid ? paramsFromDrag(state.drag) : null);
        }
        if (ptr.released) {
          const d = state.drag; state.drag = null;
          if (d.vy > 0 && d.len >= PULL.min) releaseThrow(paramsFromDrag(d));
          else { setGuide(null); if (d.len > 8) toast('Pull back further, then let go', 1.6); }
        }
      }
      // keyboard
      const kb = state.kb ?? (state.kb = { ang: 0, power: 0.5 });
      let touched = false;
      if (keys.down.has('ArrowLeft')) { kb.ang = clamp(kb.ang - 0.012, -MAX_ANG, MAX_ANG); touched = true; }
      if (keys.down.has('ArrowRight')) { kb.ang = clamp(kb.ang + 0.012, -MAX_ANG, MAX_ANG); touched = true; }
      if (keys.down.has('ArrowUp')) { kb.power = clamp(kb.power + 0.012, 0, 1); touched = true; }
      if (keys.down.has('ArrowDown')) { kb.power = clamp(kb.power - 0.012, 0, 1); touched = true; }
      for (let i = 0; i < 4; i++) if (keys.pressed.has(`Digit${i + 1}`) && !(m.phase === 'jack' && i === 3)) { state.sel.loft = i; touched = true; }
      if (keys.pressed.has('KeyS')) { state.sel.spin = (state.sel.spin + 1) % SPINS.length; touched = true; }
      if (keys.pressed.has('KeyH') && m.phase === 'aim') requestHint();
      if (touched || state.kbOn) { state.kbOn = true; if (!state.drag) setGuide({ loft: state.sel.loft, power: kb.power, ang: kb.ang, spin: state.sel.spin }); }
      if (keys.pressed.has('Space') && state.guide && !state.drag) { releaseThrow(state.guide); state.kbOn = false; }
    } else if (state.drag && !state.humanTurn) { state.drag = null; state.guide = null; }
    if (state.paused) return;
    updateHint();
    updateAI(dt);
    // physics
    if (m.phase === 'fly' || m.phase === 'jack-fly') {
      for (let i = 0; i < state.ff; i++) {
        const ev = stepWorld(state.w, dt);
        if (ev.length) handleEvents(ev);
        rumble -= dt;
        if (rumble <= 0) {
          let v = 0;
          for (const b of state.w.balls) if (!b.air && !b.out) v = Math.max(v, Math.hypot(b.vx, b.vy));
          if (v > 110) { tone({ freq: 62 + v * 0.06, to: 48, dur: 0.14, type: 'sawtooth', vol: Math.min(0.03, 0.006 + v / 20000) }); rumble = 0.11; } else rumble = 0.05;
        }
        state.w.balls = state.w.balls.filter((b) => !(b.out && b.fade > 1.1 && !b.k));
        if (state.w.settled) { state.restT += dt; if (state.restT > 0.45) { onSettled(); break; } } else state.restT = 0;
      }
    }
    stepParts(state.parts, dt);
    if (state.shake) { state.shake.t += dt; if (state.shake.t >= state.shake.dur) state.shake = null; }
    if (state.snap) { state.snap.t += dt; if (state.snap.t > 0.7) state.snap = null; }
    if (state.toastT > 0) state.toastT -= dt;
    if (state.pop) { state.pop.t += dt; if (state.pop.t > 1.8) state.pop = null; }
    if (m.phase === 'score') {
      m.endInfo.t += dt;
      const auto = watch && m.endInfo.t > 4.5;
      if ((ptr.pressed && m.endInfo.t > 0.8) || auto) afterEnd();
    }
  };

  const leaveMatch = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'p-calm') { state.settings.calm = !state.settings.calm; previewKey = ''; save(); }
    else if (id === 'quit') leaveMatch();
  }

  // ---- menus ------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag;
    const meta = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && meta.lay) {
      const max = Math.max(0, meta.lay.contentH - (meta.bottom - meta.top));
      state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max);
    }
  }
  const goBack = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.ui.scroll = 0; if (state.back !== 'play') state.back = 'title'; };

  const handleTitle = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'play') { state.setup.mode = 'ai'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'two') { state.setup.mode = 'two'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id.startsWith('pit')) { const p = id.slice(3); if (state.demo && p !== 'village') { state.setupMsg = 'That pitch is in the full game.'; return; } s.pitch = p; state.setupMsg = ''; }
    else if (id === 'len13') s.target = 13;
    else if (id === 'len7') s.target = 7;
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, pitch: s.pitch, target: s.target });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-calm') st.calm = !st.calm;
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
    if (id === 'again') startMatch({ ...cfg, firstJack: aiRng.int(2) });
    else if (id === 'new') { state.setup.mode = cfg.mode === 'watch' ? 'ai' : cfg.mode; state.scene = 'setup'; state.ui.scroll = 0; }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };

  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    // only act on a layout that belongs to this scene (the first frame after a scene change still holds the old one)
    if (key) ensureLayout(state, key);
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta();
      const scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      // a sloppy tap on a list that cannot scroll still counts, at the spot where the finger went down
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const meta = flowMeta();
    const max = meta.lay ? Math.max(0, meta.lay.contentH - (meta.bottom - meta.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };

  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('KeyO') && state.setup.mode === 'ai') state.setup.opp = (state.setup.opp + 1) % (state.demo ? 2 : PROFILES.length);
    if (k.pressed.has('KeyP') && !state.demo) { const ids = ['village', 'port', 'oliviers', 'colline', 'daily']; state.setup.pitch = ids[(ids.indexOf(state.setup.pitch) + 1) % ids.length]; }
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) {
      handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back');
      return;
    }
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

  startAttract();

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused,
    update(dt, input) {
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && (state.scene !== 'play')) updateAttract(dt);
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
      if (state.scene === 'title' || state.scene === 'setup') prepFor(state.setup.pitch);
      else if (state.scene === 'result' && state.m) prepFor(state.m.cfg.pitch);
    },
    render(ctx) {
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
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
      if (state.scene !== 'play') warmPitches(ctx, [state.att && state.att.w.terrain, ...Object.values(prep)]);
    },
    getState: () => state,
  };
}
