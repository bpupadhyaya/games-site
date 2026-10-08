// Marbles, Ring and Shoot: state and flow. Physics lives in sim.js, rules in match.js, drawing in view.js and menus.js, the
// opponent in ai.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto/about/rules, demolimit.
// Shooting: press anywhere on the dirt and drag back like a slingshot; pull length = power, pull direction = aim; release shoots.
// A shooter that is "in hand" is placed by tapping the shooting line first.
import {
  createWorld, launch, stepWorld, resolveShot, previewShot, shooterOf, targets, spotBlocked, onLine, cloneWorld, clamp, R_S, RT, valueOf,
} from './sim.js';
import { newMatch, beginRound, afterShot, scoreRound, applyRound } from './match.js';
import { createPlanner, executePlan } from './ai.js';
import { PROFILES } from './opponents.js';
import { W, inRect, PULL, TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout } from './layout.js';
import { renderPlay, layoutOf } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, hitScreen, flowMeta, REF, ensureLayout, resetMenus, setupPinRects, lockupZone } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export { meta };
const DEMO_ROUND_CAP = 2;
// Stray-touch guard (the kit has one pointer): a second finger shows up as the pointer jumping across the screen in a
// single tick. During a pull such a jump is ignored, and a release that lands that far from the last accepted pull
// position is a second finger lifting, so it cancels the pull instead of shooting from the wrong spot.
export const STRAY_JUMP = 220;
const TAU = Math.PI * 2;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, calm: false, textIdx: 0, thinkIdx: 1 },
    record: { wins: [0, 0, 0, 0, 0], played: 0, streak: 0, best: 0, demoRounds: 0, shots: 0, bestRound: 0 },
    setup: { mode: 'ai', opp: 0, rounds: 1 }, setupMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0,
    att: null, w: null, m: null, res: null,
    aim: { ang: -Math.PI / 2, power: 0.5, active: false }, preview: null, hintShot: null, hintPreview: null, hintBusy: false,
    parts: [], pops: [], flies: [], toast: '', toastT: 0, humanTurn: false,
    shake: 0, sx: 0, sy: 0,
    think: null, aiDrag: null, kbOn: false, drag: null, restT: 0, flyT: 0, clearT: 0, loaded: false, restoreMsg: '', ff: 1,
  };
  let planner = null, hintPlanner = null, previewKey = '';

  // ---- persistence -----------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 5) state.record.wins = [0, 0, 0, 0, 0];
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound -----------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    flick: (p = 0.5) => { tone({ freq: 300 + p * 300, to: 110, dur: 0.14, type: 'triangle', vol: 0.07 }); tone({ freq: 1800, to: 900, dur: 0.04, type: 'square', vol: 0.03 }); },
    clack: (v) => {
      const q = Math.min(1, v / 700);
      tone({ freq: 2100 + fx.next() * 700, to: 1500, dur: 0.05, type: 'square', vol: 0.02 + 0.05 * q });
      tone({ freq: 880 + fx.next() * 260, to: 520, dur: 0.12, type: 'sine', vol: 0.05 + 0.1 * q });
    },
    out: (i = 0) => tone({ freq: 620 * Math.pow(1.122, i), dur: 0.2, type: 'sine', vol: 0.09 }),
    capture: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.2 + i * 0.04, type: 'triangle', vol: 0.09 })),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 220, to: 140, dur: 0.2, type: 'sawtooth', vol: 0.05 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- particles -------------------------------------------------------------------------------
  const MAX_PARTS = 150;   // hard cap: a pile-up of hits can never make the frame cost grow without bound
  const addPart = (parts, q) => { if (parts.length < MAX_PARTS) parts.push(q); };
  const dust = (parts, x, y, n) => { for (let i = 0; i < n; i++) { const a = fx.next() * TAU, s = 12 + fx.next() * 40; addPart(parts, { kind: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.5 + fx.next() * 0.4, size: 7 + fx.next() * 7, col: 'rgba(232,206,150,1)' }); } };
  const sparks = (parts, x, y, n) => { for (let i = 0; i < n; i++) { const a = fx.next() * TAU, s = 120 + fx.next() * 260; addPart(parts, { kind: 1, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.16 + fx.next() * 0.14 }); } };
  const glints = (parts, x, y, n, col) => { for (let i = 0; i < n; i++) { const a = fx.next() * TAU, s = 60 + fx.next() * 180; addPart(parts, { kind: 3, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.5 + fx.next() * 0.4, size: 6 + fx.next() * 6, col }); } };
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.95; q.vy *= 0.95; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };
  const pop = (x, y, text, col, size) => { state.pops.push({ x, y, text, col, size, t: 0, max: 1.3 }); if (state.pops.length > 12) state.pops.shift(); };

  const worldEvents = (parts, ev, live) => {
    for (const e of ev) {
      if (e.t === 'hit') {
        sparks(parts, e.x, e.y, Math.min(8, 2 + Math.floor(e.v / 100)));
        if (e.v > 60) dust(parts, e.x, e.y, 1 + Math.floor(e.v / 260));
        addPart(parts, { kind: 2, x: e.x, y: e.y, vx: 0, vy: 0, t: 0, max: 0.3, size: 26, col: '#fff6d8' });
        if (live) { sfx.clack(e.v); if (e.v > 380) state.shake = Math.max(state.shake, Math.min(1, e.v / 1100)); }
      } else if (e.t === 'gone') { dust(parts, e.x, e.y, 4); if (live) sfx.out(0); }
    }
  };

  // ---- the attract table behind the menus ---------------------------------------------------------------
  const startAttract = () => { state.att = { w: createWorld(), parts: [], wait: 1.2, n: 0 }; };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    a.wait -= dt;
    for (const b of a.w.balls) if (b.heat > 0) b.heat = Math.max(0, b.heat - dt * 2.2);
    if (a.wait <= 0 && a.w.settled) {
      a.wait = 3.2;
      if (a.w.shot) { resolveShot(a.w); }
      if (targets(a.w).length < 5) { a.w = createWorld(); a.n = 0; }
      const side = a.n++ % 2, sh = shooterOf(a.w, side), tg = targets(a.w), t = tg[Math.floor(fx.next() * tg.length)];
      const ang0 = fx.next() * TAU, p = onLine(ang0); sh.x = p.x; sh.y = p.y;
      launch(a.w, side, Math.atan2(t.y - p.y, t.x - p.x) + (fx.next() - 0.5) * 0.08, 0.5 + fx.next() * 0.45);
    }
    if (!a.w.settled) { const ev = stepWorld(a.w, dt); worldEvents(a.parts, ev, false); }
    stepParts(a.parts, dt);
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
  const aimAtCentre = (sh) => Math.atan2(-sh.y, -sh.x);

  const beginTurn = () => {
    const m = state.m, side = m.turn, sh = shooterOf(state.w, side);
    m.phase = 'aim';
    state.humanTurn = !isAI(side);
    state.hintShot = null; state.hintPreview = null; state.think = null; state.preview = null; planner = null; hintPlanner = null; state.hintBusy = false; state.drag = null; state.kbOn = false; state.aiDrag = null;
    state.aim = { ang: aimAtCentre(sh), power: 0.5, active: false };
    if (state.humanTurn) {
      const who = m.cfg.mode === 'two' ? `${sideLabel(side)}: ` : '';
      toast(m.bonus ? `${who}Bonus shot!` : sh.hand ? `${who}Tap the dotted line to place your shooter` : `${who}Pull back and let go`, 2.8);
    } else if (m.cfg.mode !== 'watch') toast(`${sideLabel(side)} is thinking…`, 2.0);
  };
  const startRound = () => { beginRound(state.m, state.w); state.parts = []; state.pops = []; state.flies = []; beginTurn(); toast(`Round ${state.m.round}: ${sideLabel(state.m.turn)} shoots first`, 2.6); };

  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoRounds >= DEMO_ROUND_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.w = createWorld();
    state.m = newMatch({ mode: 'ai', opp: 0, rounds: 1, first: aiRng.int(2), watchA: 3, ...cfg });
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.parts = []; state.pops = []; state.flies = [];
    beginRound(state.m, state.w);
    beginTurn();
  };
  const startWatch = () => {
    const picks = [1, 2, 3, 4];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, rounds: 1 });
  };

  const shoot = (side, p) => {
    const { m, w } = state;
    const sh = shooterOf(w, side);
    if (p.pos) { sh.x = p.pos.x; sh.y = p.pos.y; }
    sh.hand = false;
    launch(w, side, p.ang, p.power);
    m.phase = 'fly';
    if (!isAI(side)) state.record.shots = (state.record.shots | 0) + 1;
    state.humanTurn = false; state.preview = null; state.hintShot = null; state.hintPreview = null; state.drag = null; state.think = null; state.aiDrag = null; state.kbOn = false;
    state.aim.active = false; planner = null; hintPlanner = null; state.hintBusy = false;
    state.restT = 0; state.flyT = 0;
    sfx.flick(p.power);
  };

  const onSettled = () => {
    const { m, w } = state;
    const res = resolveShot(w);
    state.res = res;
    res.got.forEach((g, i) => {
      state.flies.push({ x: g.x, y: g.y, kind: g.kind, variant: g.variant, side: m.turn, t: -i * 0.12, max: 0.7 });
      pop(g.x, g.y, `+${g.value}`, g.kind === 'king' ? '#ffd35a' : '#fff8e0', 34);
      glints(state.parts, g.x, g.y, 6, g.kind === 'clay' ? '#ffe9bf' : '#bff3ff');
      sfx.out(i);
    });
    if (res.captured) {
      const o = shooterOf(w, 1 - m.turn);
      pop(o.x, o.y, 'Captured! +2', '#7ee8a8', 36); glints(state.parts, o.x, o.y, 10, '#ffe9a0'); sfx.capture();
      toast(`${sideLabel(m.turn)} ${mode() === 'ai' && m.turn === 0 ? 'capture' : 'captures'} the rival shooter: +2`, 3);
    } else if (res.got.length >= 2 && !res.shooterLost) toast(`${res.got.length} marbles out: bonus shot!`, 2.6);
    else if (res.shooterLost) { toast('The shooter rolled off the dirt: back to the line', 2.6); sfx.no(); }
    else if (res.got.length === 1) toast(`${sideLabel(m.turn)}: +${res.pts}`, 1.8);
    else toast(m.turn === 0 && mode() !== 'watch' ? 'No marble out. Their turn' : 'No marble out', 1.8);
    m.phase = 'clear'; state.clearT = 0;
  };
  const finishClear = () => {
    const { m, w } = state;
    const over = afterShot(m, w, state.res);
    if (over) {
      scoreRound(m);
      sfx.out(2); sfx.out(4);
      toast(m.rp[0] === m.rp[1] ? 'Round tied' : `${sideLabel(m.rp[0] > m.rp[1] ? 0 : 1)} ${mode() === 'ai' && m.rp[0] > m.rp[1] ? 'take' : 'takes'} the round`, 3.2);
    } else beginTurn();
  };
  const afterRound = () => {
    const m = state.m;
    applyRound(m, m.roundInfo);
    if (m.cfg.mode !== 'watch') state.record.demoRounds++;
    state.record.bestRound = Math.max(state.record.bestRound | 0, m.roundInfo.pts[0]);
    if (m.over) {
      state.scene = 'result'; state.ui.scroll = 0;
      if (m.cfg.mode === 'ai') {
        state.record.played++;
        if (m.over.win === 0) { state.record.wins[m.cfg.opp]++; state.record.streak++; state.record.best = Math.max(state.record.best, state.record.streak); sfx.win(); } else state.record.streak = 0;
      }
      save();
    } else if (state.demo && m.cfg.mode !== 'watch' && state.record.demoRounds >= DEMO_ROUND_CAP) { save(); state.scene = 'demolimit'; state.ui.scroll = 0; }
    else { save(); startRound(); }
  };

  // ---- aiming ------------------------------------------------------------------------------------
  const updatePreview = () => {
    const { m, w, aim } = state;
    const key = `${m.turn}|${aim.ang.toFixed(3)}|${aim.power.toFixed(3)}|${state.settings.calm ? 1 : 0}|${shooterOf(w, m.turn).x.toFixed(0)}`;
    if (key === previewKey && state.preview) return;
    previewKey = key;
    state.preview = previewShot(w, m.turn, aim.ang, aim.power, state.settings.calm);
  };
  const dragAim = (dr, ptr) => {
    const vx = dr.sx - ptr.x, vy = dr.sy - ptr.y, len = Math.hypot(vx, vy);
    dr.len = len; dr.valid = len >= PULL.min;
    if (len > 4) state.aim.ang = Math.atan2(vy, vx);
    state.aim.power = clamp((len - PULL.min) / (PULL.max - PULL.min), 0, 1);
    state.aim.active = len >= PULL.min;
    if (dr.valid) updatePreview(); else state.preview = null;
  };
  const placeShooter = (side, ang) => {
    const sh = shooterOf(state.w, side), p = onLine(ang);
    if (spotBlocked(state.w, p.x, p.y, sh.id)) { toast('A marble is in the way: tap another spot on the line', 2.2); sfx.no(); return false; }
    sh.x = p.x; sh.y = p.y; state.aim.ang = aimAtCentre(sh); state.preview = null; state.hintShot = null; state.hintPreview = null; sfx.tick();
    return true;
  };

  // ---- AI turn -----------------------------------------------------------------------------------
  const describePlan = (plan) => `${plan.kind === 'break' ? 'break into the middle' : 'pick a marble off the edge'} (power about ${Math.round(plan.power * 100)}%)`;
  const beginPull = (th) => {
    const prof = profOf(state.m.turn), sh = shooterOf(state.w, state.m.turn);
    th.p = executePlan(th.plan, prof, aiRng);
    if (th.p.pos) { sh.x = th.p.pos.x; sh.y = th.p.pos.y; }
    th.phase = 'pull'; th.t = 0; th.dur = 0.6; state.hintShot = null; state.preview = null;
  };
  const updateAI = (dt) => {
    const { m } = state;
    if (m.phase !== 'aim' || !isAI(m.turn) || state.paused) return;
    const prof = profOf(m.turn), watch = mode() === 'watch', side = m.turn;
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur, phase: 'think', plan: null, p: null };
      planner = createPlanner(state.w, side, prof, aiRng, {});
      if (watch) toast(`${sideLabel(side)} is thinking…`, dur);
    }
    const th = state.think;
    th.t += dt;
    if (planner && !planner.done) { planner.step(10); if (planner.done) { th.plan = planner.result; planner = null; } }
    if (th.phase === 'think' && th.t >= th.dur && th.plan) {
      if (watch) {
        th.phase = 'reveal'; th.t = 0; th.dur = 2;
        state.hintShot = th.plan;
        state.aim = { ang: th.plan.ang, power: th.plan.power, active: false };
        state.hintPreview = previewShot(state.w, side, th.plan.ang, th.plan.power, false, th.plan.pos);
        state.preview = null;
        toast(`${sideLabel(side)}: ${describePlan(th.plan)}`, 2.1);
      } else beginPull(th);
    } else if (th.phase === 'reveal' && th.t >= th.dur) beginPull(th);
    else if (th.phase === 'pull') {
      const k = Math.min(1, th.t / th.dur), e = 1 - Math.pow(1 - k, 3);
      state.aim = { ang: th.p.ang, power: th.p.power * e, active: true };
      state.aiDrag = true;
      if (th.t >= th.dur) { state.aiDrag = null; shoot(side, th.p); }
    }
  };

  // ---- hint --------------------------------------------------------------------------------------
  const requestHint = () => {
    const m = state.m;
    if (state.hintBusy || m.phase !== 'aim' || !state.humanTurn) return;
    state.hintBusy = true;
    hintPlanner = createPlanner(state.w, m.turn, PROFILES[4], aiRng, { perfect: true });
  };
  const updateHint = () => {
    if (!hintPlanner) return;
    hintPlanner.step(14);
    if (hintPlanner.done) {
      const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.m.phase !== 'aim' || !state.humanTurn) return;
      state.hintShot = r;
      state.hintPreview = previewShot(state.w, state.m.turn, r.ang, r.power, false, r.pos);
      state.aim = { ang: r.ang, power: r.power, active: false }; state.preview = null;
      toast(`Hint: ${r.pos ? 'place the shooter on the glowing spot, then ' : ''}${describePlan(r)}`, 4);
    }
  };

  // ---- the play scene ----------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };

  const updatePlay = (dt, input) => {
    const { m } = state;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch';
    const L = layoutOf(state), barHidden = m.phase === 'score';
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
    } else if (ptr.pressed && !barHidden && inRect(L.menu, ptr.x, ptr.y)) { openPause(); return; }
    state.ff = m.phase === 'fly' && ptr.down && !state.paused ? 2 : 1;

    if (state.humanTurn && !state.paused && m.phase === 'aim') {
      const side = m.turn, sh = shooterOf(state.w, side);
      if (ptr.pressed) {
        if (inRect(L.hint, ptr.x, ptr.y)) { requestHint(); sfx.tick(); }
        else if (inRect(L.zone, ptr.x, ptr.y)) { state.drag = { sx: ptr.x, sy: ptr.y, lx: ptr.x, ly: ptr.y, len: 0, valid: false, moved: 0 }; state.hintShot = null; state.hintPreview = null; state.kbOn = false; }
      }
      if (state.drag) {
        const d0 = state.drag;
        const stray = Math.hypot(ptr.x - d0.lx, ptr.y - d0.ly) > STRAY_JUMP;
        if (ptr.down && !stray) { d0.lx = ptr.x; d0.ly = ptr.y; d0.moved = Math.max(d0.moved, Math.hypot(ptr.x - d0.sx, ptr.y - d0.sy)); dragAim(d0, ptr); }
        if (ptr.released && stray) {
          state.drag = null; state.aim.active = false; state.preview = null; toast('Second touch ignored: pull again', 1.8);
        } else if (ptr.released) {
          const d = state.drag; state.drag = null; state.aim.active = false;
          if (d.valid) shoot(side, { pos: null, ang: state.aim.ang, power: state.aim.power });
          else {
            state.preview = null;
            if (d.moved < 14 && sh.hand) {      // a tap with the shooter in hand: place it on the line, towards the tap
              const b = L.board, wx = (ptr.x - b.cx) / b.s, wy = (ptr.y - b.cy) / b.s;
              placeShooter(side, Math.atan2(wy, wx));
            } else if (d.len > 8) toast('Pull back further, then let go', 1.8);
            else if (d.moved < 14) toast(sh.hand ? 'Tap the dotted line to place the shooter' : 'Press, drag back and let go to shoot', 1.8);
          }
        }
      }
      // keyboard
      let touched = false;
      if (keys.down.has('ArrowLeft')) { state.aim.ang -= 0.008; touched = true; }
      if (keys.down.has('ArrowRight')) { state.aim.ang += 0.008; touched = true; }
      if (keys.down.has('ArrowUp')) { state.aim.power = clamp(state.aim.power + 0.01, 0.02, 1); touched = true; }
      if (keys.down.has('ArrowDown')) { state.aim.power = clamp(state.aim.power - 0.01, 0.02, 1); touched = true; }
      if (sh.hand && (keys.down.has('KeyA') || keys.down.has('KeyD'))) {
        const cur = Math.atan2(sh.y, sh.x), na = cur + (keys.down.has('KeyD') ? 0.012 : -0.012), p = onLine(na);
        if (!spotBlocked(state.w, p.x, p.y, sh.id)) { sh.x = p.x; sh.y = p.y; state.aim.ang = aimAtCentre(sh); touched = true; }
      }
      if (keys.pressed.has('KeyH')) requestHint();
      if (touched) { state.kbOn = true; state.aim.active = true; state.hintShot = null; state.hintPreview = null; updatePreview(); }
      if (keys.pressed.has('Space') && state.kbOn && !state.drag) shoot(side, { pos: null, ang: state.aim.ang, power: state.aim.power });
    } else if (state.drag && !state.humanTurn) { state.drag = null; state.aim.active = false; }
    if (state.paused) return;
    updateHint();
    updateAI(dt);
    // physics
    if (m.phase === 'fly' || m.phase === 'clear') {
      for (let i = 0; i < state.ff; i++) {
        const ev = stepWorld(state.w, dt);
        if (ev.length) worldEvents(state.parts, ev, true);
        if (m.phase === 'fly') {
          state.flyT += dt;
          if (state.flyT > 14) for (const b of state.w.balls) { b.vx = 0; b.vy = 0; }   // safety: nothing may roll forever
          if (state.w.settled) { state.restT += dt; if (state.restT > 0.35) { onSettled(); break; } } else state.restT = 0;
        }
      }
      if (m.phase === 'clear') { state.clearT += dt; if (state.clearT > 0.8) finishClear(); }
    }
    for (const b of state.w.balls) if (b.heat > 0) b.heat = Math.max(0, b.heat - dt * 2.2);
    state.shake = state.shake > 0.02 ? state.shake * Math.pow(0.02, dt) : 0;
    state.sx = state.shake > 0 ? (fx.next() - 0.5) * 9 * state.shake : 0; state.sy = state.shake > 0 ? (fx.next() - 0.5) * 9 * state.shake : 0;
    stepParts(state.parts, dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    for (const f of state.flies) f.t += dt;
    state.flies = state.flies.filter((f) => f.t < f.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (m.phase === 'score') {
      m.roundInfo.t += dt;
      const auto = (watch && m.roundInfo.t > 4.8) || m.roundInfo.t > 9;
      if ((ptr.pressed && m.roundInfo.t > 0.9) || auto) afterRound();
    }
  };

  const leaveMatch = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.drag = null; };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'p-calm') { state.settings.calm = !state.settings.calm; state.preview = null; save(); }
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
    if (id === 'again') startMatch({ ...cfg, first: aiRng.int(2) });
    else if (id === 'new') { state.setup.mode = cfg.mode === 'watch' ? 'ai' : cfg.mode; state.scene = 'setup'; state.ui.scroll = 0; }
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

  let refDrag = null, wheelHooked = false;
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
          else if (['title', 'setup', 'settings', 'result', 'demolimit'].includes(state.scene) || state.pauseMenu) { const mt = flowMeta(); state.ui.scroll = clamp(state.ui.scroll + dy, 0, mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0); }
        });
      }
      syncSize();
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
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
    render(ctx) {
      syncSize();
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
    },
    getState: () => state,
    // Dev only (?dev=1): jump to a screen for layout checks and screenshots (see main.js). Never present in production.
    dev: config.dev ? {
      board: () => ({ ...layoutOf(state).board, W: meta.width, H: meta.height, hint: layoutOf(state).hint, menu: layoutOf(state).menu }),
      go(q) {
        if (q.text) state.settings.textIdx = clamp(+q.text, 0, TEXT_SCALES.length - 1);
        if (q.calm) state.settings.calm = q.calm === '1';
        const sc = q.scene || 'title';
        if (sc === 'play' || sc === 'pause' || sc === 'result' || sc === 'score') {
          startMatch({ mode: q.mode || 'ai', opp: +(q.opp || 2), rounds: +(q.rounds || 1), first: q.first ? +q.first : 0, watchA: 3 });
          if (q.skip) { for (let i = 0; i < +q.skip; i++) { const sh = shooterOf(state.w, state.m.turn); void sh; } }
          if (sc === 'pause') openPause();
          if (sc === 'result') { state.m.scores = [31, 19]; state.m.roundLog = [{ round: 1, pts: [31, 19] }]; state.m.over = { win: 0, extra: false }; state.scene = 'result'; }
          if (sc === 'score') { state.m.rp = [11, 8]; scoreRound(state.m); state.m.roundInfo.t = 3; }
          if (q.aim) { const [a, pw] = q.aim.split(',').map(Number); state.aim = { ang: a, power: pw, active: true }; state.kbOn = true; updatePreview(); }
        } else if (sc === 'rules' || sc === 'howto' || sc === 'about') { state.back = 'title'; state.scene = sc; state.refScroll = +(q.scroll || 0); }
        else state.scene = sc;
      },
    } : undefined,
    lockupZone: () => lockupZone(),
  };
  void W; void R_S; void RT; void cloneWorld; void valueOf;
}
