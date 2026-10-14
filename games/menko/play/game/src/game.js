// Menko: state and flow. The engine is sim.js, the match rules match.js, the rivals ai.js, drawing view.js and menus.js.
// This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, collection, play (also Watch & Learn), result, howto/about/rules, demolimit.
// A turn: choose a disc in the tray, tap the floor to aim (drag to nudge), set the strength, press SLAM (or Lay disc when
// no rival disc is on the floor). The disc lands at aim + scatter; the gust rolls against every rival disc in reach.
import {
  R, DESIGNS, clamp, clampPos, previewSlam, layPoint, layBlocked, RUG, makeFloor, addCard,
} from './sim.js';
import { newMatch, turnKind, playLay, playSlam, endTurn } from './match.js';
import { PROFILES, createPlanner, executePlan } from './ai.js';
import { inRect, TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, chipRect, toWorld } from './layout.js';
import { renderPlay, layoutOf, nameOf } from './view.js';
import {
  renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderCollection,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, setupPinRects, lockupZone, collectionMeta,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';
import { v3 } from './v3.js';

export { meta };
const DEMO_MATCH_CAP = 2;
const FLY_T = 0.4;
const MAX_PARTS = 140;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, textIdx: 0, thinkIdx: 1, power: 0.6 },
    record: { wins: [0, 0, 0, 0], played: 0, streak: 0, best: 0, demoMatches: 0, seen: new Array(24).fill(0), flips: 0, slams: 0, topScore: 0 },
    setup: { mode: 'ai', opp: 0, hand: 5 }, setupMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0, colScroll: 0,
    att: null, m: null,
    aim: { hi: 0, x: 320, y: 480, power: 0.6 }, kind: 'slam', preview: null, hint: null, hintBusy: false, layBad: false,
    parts: [], pops: [], toast: '', toastT: 0, humanTurn: false, pass: null, act: null, pulse: null, think: null, restoreMsg: '', restoreBusy: false, owned: false, endT: -1,
    drag: null, slideDrag: false,
  };
  let planner = null, hintPlanner = null, previewKey = '';

  // ---- persistence ---------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    state.settings.power = clamp(+state.settings.power || 0.6, 0.2, 1);
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 4) state.record.wins = [0, 0, 0, 0];
    if (!Array.isArray(state.record.seen) || state.record.seen.length < 24) state.record.seen = new Array(24).fill(0);
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ---------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    whoosh: () => tone({ freq: 700, to: 150, dur: 0.28, type: 'sawtooth', vol: 0.04 }),
    slap: (p) => { tone({ freq: 190 + 60 * p, to: 70, dur: 0.16, type: 'square', vol: 0.09 + 0.1 * p }); tone({ freq: 1400, to: 500, dur: 0.05, type: 'triangle', vol: 0.05 }); },
    gust: (p) => tone({ freq: 300 + 300 * p, to: 80, dur: 0.5, type: 'sawtooth', vol: 0.04 + 0.04 * p }),
    flip: (i = 0) => { tone({ freq: 620 * Math.pow(1.19, i), to: 940 * Math.pow(1.19, i), dur: 0.2, type: 'sine', vol: 0.1 }); tone({ freq: 1320, dur: 0.12, type: 'triangle', vol: 0.05 }); },
    cover: () => { tone({ freq: 160, to: 90, dur: 0.3, type: 'sawtooth', vol: 0.09 }); tone({ freq: 120, dur: 0.2, type: 'square', vol: 0.05 }); },
    miss: () => tone({ freq: 340, to: 220, dur: 0.18, type: 'triangle', vol: 0.06 }),
    place: () => tone({ freq: 520, to: 380, dur: 0.1, type: 'triangle', vol: 0.07 }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    win: () => [0, 2, 4, 7, 9].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- effects (world units) ------------------------------------------------------------------
  const addPart = (parts, q) => { if (parts.length < MAX_PARTS) parts.push(q); };
  const gustFx = (parts, x, y, power, count = 12) => {
    addPart(parts, { kind: 1, x, y, vx: 0, vy: 0, t: 0, max: 0.7, size: 70 + 190 * power, col: '#fff7da' });
    addPart(parts, { kind: 1, x, y, vx: 0, vy: 0, t: 0, max: 0.95, size: 50 + 120 * power, col: '#bfe3ff' });
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + fx.next() * 0.3, s = 160 + 220 * power * (0.6 + fx.next() * 0.6);
      addPart(parts, { kind: 2, x: x + Math.cos(a) * 40, y: y + Math.sin(a) * 40, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.4 + fx.next() * 0.2, col: 'rgba(255,255,255,0.9)' });
    }
    for (let i = 0; i < 6; i++) {
      const a = fx.next() * Math.PI * 2, s = 30 + fx.next() * 90;
      addPart(parts, { kind: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.5 + fx.next() * 0.4, size: 3 + fx.next() * 3, col: 'rgba(245,225,185,0.8)' });
    }
  };
  const sparkle = (parts, x, y, n, col = '#ffd35a') => {
    for (let i = 0; i < n; i++) {
      const a = fx.next() * Math.PI * 2, s = 70 + fx.next() * 180;
      addPart(parts, { kind: 3, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.6 + fx.next() * 0.4, size: 7 + fx.next() * 7, col });
    }
  };
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };
  const pop = (x, y, text, col, size = 34) => { state.pops.push({ x, y, text, col, size, t: 0, max: 1.2 }); if (state.pops.length > 10) state.pops.shift(); };

  // ---- the attract floor behind the menus ---------------------------------------------------------
  const startAttract = () => {
    const floor = makeFloor();
    for (const [d, side, x, y] of [[0, 0, 150, 190], [3, 1, 410, 140], [10, 0, 270, 330], [7, 1, 500, 360], [14, 0, 130, 470], [17, 1, 330, 520], [21, 0, 560, 540]]) addCard(floor, d, side, x, y, (x + y) * 0.013);
    state.att = { floor, parts: [], wait: 1.2, n: 0, act: null };
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    a.wait -= dt;
    if (a.wait <= 0 && !a.act) {
      a.wait = 3.6;
      const c = a.floor.cards[a.n++ % a.floor.cards.length];
      gustFx(a.parts, c.x - 70, c.y + 20, 0.7, 10);
      a.act = { t: 0, c };
      c.pop = 0.3;
    }
    if (a.act) { a.act.t += dt; a.act.c.pop = Math.max(0, 0.3 - a.act.t * 0.6); if (a.act.t > 0.7) a.act = null; }
    stepParts(a.parts, dt);
  };

  // ---- match flow ------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const isAI = (side) => mode() === 'watch' || (mode() === 'ai' && side === 1);
  const profOf = (side) => (mode() === 'watch' ? PROFILES[side === 0 ? state.m.cfg.watchA : state.m.cfg.opp] : PROFILES[state.m.cfg.opp]);
  const dName = (d) => DESIGNS[d].name;

  const markSeen = (d) => { state.record.seen[d] = 1; };
  const setDefaultAim = () => {
    const m = state.m, side = m.turn, a = state.aim;
    a.hi = clamp(a.hi | 0, 0, Math.max(0, m.hands[side].length - 1));
    a.power = clamp(state.settings.power, 0.2, 1);
    if (state.kind === 'slam') {
      // start beside the most valuable rival disc, on the side facing the middle of the floor
      let best = null;
      for (const c of m.floor.cards) if (c.side !== side && (!best || DESIGNS[c.d].stars > DESIGNS[best.d].stars)) best = c;
      if (best) {
        const dx = RUG.x - best.x, dy = RUG.y - best.y, d = Math.hypot(dx, dy) || 1;
        a.x = clampPos(best.x + (dx / d) * R * 2.3); a.y = clampPos(best.y + (dy / d) * R * 2.3);
      }
    } else {
      const p = layPoint(m.floor, RUG.x, RUG.y);
      a.x = p.x; a.y = p.y;
    }
    previewKey = '';
  };
  const beginTurn = () => {
    const m = state.m, side = m.turn;
    state.kind = turnKind(m);
    state.humanTurn = !isAI(side);
    state.hint = null; state.think = null; state.preview = null; planner = null; hintPlanner = null; state.hintBusy = false; state.drag = null; state.slideDrag = false;
    state.pass = state.humanTurn && m.cfg.mode === 'two' && m.turns > 0 ? { t: 0 } : null;
    state.aim.hi = 0;
    setDefaultAim();
    if (state.humanTurn) {
      toast(m.cfg.mode === 'two' ? `${nameOf(state, side)}: ${state.kind === 'lay' ? 'lay a disc' : 'your slam'}` : state.kind === 'lay' ? 'Lay a disc: no rival disc is on the floor' : 'Your slam: aim beside a rival disc', 2.6);
      updatePreview();
    } else if (m.cfg.mode !== 'watch') toast(`${nameOf(state, side)} is thinking…`, 1.8);
  };
  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoMatches >= DEMO_MATCH_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const m = newMatch({ mode: 'ai', opp: 0, hand: 5, first: aiRng.int(2), watchA: 3, ...cfg }, rng);
    state.m = m;
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.parts = []; state.pops = []; state.act = null; state.pulse = null; state.endT = -1; state.pass = null;
    if (cfg.mode !== 'watch') {
      for (const d of m.hands[0]) markSeen(d);
      if (state.demo) state.record.demoMatches++;
      save();
    }
    beginTurn();
  };
  const startWatch = () => {
    const picks = [0, 1, 2, 3];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, hand: 5 });
  };

  // ---- aiming ----------------------------------------------------------------------------------
  function updatePreview() {
    const m = state.m, a = state.aim, side = m.turn, d = m.hands[side][a.hi];
    if (d === undefined) { state.preview = null; return; }
    const key = `${side}|${state.kind}|${a.hi}|${a.x.toFixed(1)}|${a.y.toFixed(1)}|${a.power.toFixed(3)}|${m.floor.cards.length}`;
    if (key === previewKey) return;
    previewKey = key;
    if (state.kind === 'slam') state.preview = previewSlam(m.floor, side, d, a.x, a.y, a.power);
    else { state.preview = null; state.layBad = layBlocked(m.floor, a.x, a.y); }
  }
  const setAim = (x, y) => { state.aim.x = clampPos(x); state.aim.y = clampPos(y); state.hint = null; updatePreview(); };
  const setPower = (p) => { state.aim.power = clamp(p, 0.2, 1); state.settings.power = state.aim.power; state.hint = null; updatePreview(); };
  const selectDisc = (i) => {
    const m = state.m;
    if (i < 0 || i >= m.hands[m.turn].length) return;
    state.aim.hi = i; state.hint = null; previewKey = ''; updatePreview(); sfx.tick();
  };

  // ---- the act of a turn -----------------------------------------------------------------------
  const startAct = (side, kind, hi, x, y, power) => {
    const m = state.m, d = m.hands[side][hi];
    if (d === undefined) return;
    state.act = { side, kind, hi, d, to: { x, y }, power, spin: fx.next() * 6.283, phase: 'fly', t: 0, flyDur: kind === 'lay' ? 0.28 : FLY_T, out: null, impactAt: 0, total: 99, noted: 0 };
    state.humanTurn = false; state.hint = null; state.preview = null; state.think = null; state.drag = null; state.slideDrag = false; planner = null; hintPlanner = null; state.hintBusy = false;
    state.pass = null; state.toastT = Math.min(state.toastT, 0.2);
    if (kind === 'slam') sfx.whoosh();
  };
  const impact = () => {
    const m = state.m, a = state.act;
    if (a.kind === 'lay') {
      const o = playLay(m, a.hi, a.to.x, a.to.y, rng);
      o.card.pop = 0.3; a.out = o; a.impactAt = a.t; a.total = a.t + 0.5;
      a.phase = 'rest';
      sfx.place();
      addPart(state.parts, { kind: 1, x: o.card.x, y: o.card.y, vx: 0, vy: 0, t: 0, max: 0.45, size: 80, col: '#fff7da' });
      if (a.side === 0 && mode() === 'ai') markSeen(a.d);
      return;
    }
    const o = playSlam(m, a.hi, a.to.x, a.to.y, a.power, rng);
    a.out = o; a.impactAt = a.t; a.phase = 'gust';
    if (a.side === 0 && mode() === 'ai') state.record.slams++;
    sfx.slap(a.power);
    gustFx(state.parts, o.land.x, o.land.y, a.power, 14);
    if (o.cover) {
      a.total = a.t + 1.6; sfx.cover();
      pop(o.land.x, o.land.y - 40, 'Cover!', '#ff8a6a', 40);
      toast(`${nameOf(state, a.side)}'s disc landed on top of a rival disc and is lost`, 2.6);
      sparkle(state.parts, o.land.x, o.land.y, 5, '#ff8a6a');
    } else {
      o.card.pop = 0.3;
      if (o.flips.length) {
        o.flips.forEach((f, i) => { f.delay = 0.12 + i * 0.16; });
        a.total = a.t + 0.12 + o.flips.length * 0.16 + 1.7;
        sfx.gust(a.power);
        if (a.side === 0 && mode() === 'ai') state.record.flips += o.flips.length;
        if (a.side === 0 && mode() === 'ai') for (const f of o.flips) markSeen(f.card.d);
      } else {
        a.total = a.t + 0.9; sfx.miss();
        toast(o.tried.length ? 'The gust was not enough' : 'No rival disc was close enough', 1.8);
        pop(o.land.x, o.land.y - 40, 'No flip', '#ffe9bf', 28);
      }
    }
    a.noted = 0;
  };
  const updateAct = (dt) => {
    const a = state.act, m = state.m;
    a.t += dt;
    if (!a.out && a.t >= a.flyDur) impact();
    if (a.out && a.out.flips) {
      for (const f of a.out.flips) {
        if (!f.fx && a.t - a.impactAt >= f.delay + 0.3) {
          f.fx = true;
          const st = DESIGNS[f.card.d].stars, i = a.noted++;
          sfx.flip(i); sparkle(state.parts, f.card.x, f.card.y, 6 + st * 3);
          pop(f.card.x, f.card.y - 30, `+${st} ★`, '#ffe08a', 38);
          if (i === 0) toast(`${nameOf(state, a.side)} flips ${dName(f.card.d)}${a.out.flips.length > 1 ? ` and ${a.out.flips.length - 1} more` : ''}`, 2.6);
        }
      }
    }
    if (a.out && a.t >= a.total) {
      state.act = null;
      const over = endTurn(m);
      if (over) finishMatch(); else beginTurn();
    }
  };
  const finishMatch = () => {
    const m = state.m, o = m.over;
    state.endT = 0; state.humanTurn = false;
    if (m.cfg.mode === 'watch') return;
    if (m.cfg.mode === 'ai') {
      state.record.played++;
      if (o.win === 0) { state.record.wins[m.cfg.opp]++; state.record.streak++; state.record.best = Math.max(state.record.best, state.record.streak); sfx.win(); } else state.record.streak = 0;
      state.record.topScore = Math.max(state.record.topScore | 0, m.score[0]);
      for (const d of m.piles[0]) markSeen(d);
    }
    save();
  };

  // ---- AI turn ---------------------------------------------------------------------------------
  const describePlan = (plan) => {
    const d = state.m.hands[state.m.turn][plan.hi];
    if (plan.kind === 'lay') return `lay ${dName(d)} ${Math.hypot(plan.x - RUG.x, plan.y - RUG.y) <= RUG.r ? 'on the rug' : 'on the floor'}`;
    return `slam ${dName(d)} at ${Math.round(plan.power * 100)}% strength${plan.pCover > 0.12 ? ' (some risk of covering)' : ''}`;
  };
  const showPlan = (plan) => {
    state.aim.hi = plan.hi; state.aim.x = plan.x; state.aim.y = plan.y; if (plan.kind === 'slam') state.aim.power = plan.power;
    previewKey = ''; updatePreview();
  };
  const updateAI = (dt) => {
    const m = state.m;
    if (state.act || m.over || !isAI(m.turn) || state.paused || state.pass) return;
    const prof = profOf(m.turn), watch = mode() === 'watch', side = m.turn;
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur, phase: 'think', plan: null, p: null };
      planner = createPlanner(m.floor, side, m.hands[side], prof, aiRng, {});
      if (watch) toast(`${nameOf(state, side)} is thinking…`, dur);
    }
    const th = state.think;
    th.t += dt;
    if (planner) { if (!planner.done) planner.step(30); if (planner.done) { th.plan = planner.result; planner = null; } }
    if (th.phase === 'think' && th.t >= th.dur && th.plan) {
      th.p = executePlan(th.plan, prof, aiRng);
      if (watch) {
        th.phase = 'reveal'; th.t = 0; th.dur = 2;
        state.hint = th.plan; showPlan(th.plan);
        toast(`${nameOf(state, side)}: ${describePlan(th.plan)}`, 2.1);
      } else { th.phase = 'aim'; th.t = 0; th.dur = 0.7; showPlan({ ...th.p, kind: th.plan.kind }); }
    } else if ((th.phase === 'reveal' || th.phase === 'aim') && th.t >= th.dur) {
      const p = th.p;
      startAct(side, th.plan.kind, p.hi, p.x, p.y, p.power);
    }
  };

  // ---- hint ------------------------------------------------------------------------------------
  const requestHint = () => {
    const m = state.m;
    if (state.hintBusy || state.act || !state.humanTurn) return;
    state.hintBusy = true;
    hintPlanner = createPlanner(m.floor, m.turn, m.hands[m.turn], PROFILES[4], aiRng, { perfect: true });
  };
  const updateHint = () => {
    if (!hintPlanner) return;
    if (!hintPlanner.done) hintPlanner.step(40);
    if (hintPlanner.done) {
      const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.act || !state.humanTurn) return;
      showPlan(r);
      if (r.kind === 'slam') state.settings.power = r.power;
      state.hint = r;
      toast(`Hint: ${describePlan(r)}`, 4);
    }
  };

  // ---- the play scene --------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const commit = () => {
    const m = state.m, a = state.aim, side = m.turn;
    if (!state.humanTurn || state.act || state.pass || state.paused || m.hands[side][a.hi] === undefined) return;
    if (state.kind === 'lay') {
      const p = layPoint(m.floor, a.x, a.y);
      startAct(side, 'lay', a.hi, p.x, p.y, 0);
    } else startAct(side, 'slam', a.hi, a.x, a.y, a.power);
  };

  const updatePlay = (dt, input) => {
    const { m } = state;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch';
    const L = layoutOf(state);
    if (config.dev && keys.pressed.has('KeyK')) { m.score[0] = 9; m.score[1] = 4; m.hands = [[], []]; m.over = { win: 0, a: 9, b: 4 }; state.act = null; finishMatch(); state.scene = 'result'; state.ui.scroll = 0; return; }
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
    if (m.over && state.endT >= 0 && !state.act) {
      state.endT += dt;
      if (state.endT > 1.4 || (ptr.pressed && state.endT > 0.5)) { state.scene = 'result'; state.ui.scroll = 0; state.endT = -1; return; }
    }
    if (watch) {
      if (ptr.pressed) {
        const D = L.demo;
        if (inRect(D.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(D.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(D.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(D.exit, ptr.x, ptr.y)) { leaveMatch(); return; }
      }
    } else if (ptr.pressed && L.btns && inRect(L.btns.menu, ptr.x, ptr.y) && !state.pass) { openPause(); return; }
    if (state.pass) {
      state.pass.t += dt;
      if (ptr.pressed && state.pass.t > 0.35) { state.pass = null; sfx.tick(); }
    } else if (state.humanTurn && !state.paused && !state.act && !m.over) {
      const side = m.turn, hand = m.hands[side];
      if (ptr.pressed) {
        let used = false;
        for (let i = 0; i < hand.length && !used; i++) if (inRect(chipRect(L, i), ptr.x, ptr.y)) { selectDisc(i); used = true; }
        if (!used && state.kind === 'slam' && inRect(L.slider, ptr.x, ptr.y)) { state.slideDrag = true; used = true; }
        if (!used && inRect(L.btns.hint, ptr.x, ptr.y)) { requestHint(); sfx.tick(); used = true; }
        if (!used && inRect(L.btns.main, ptr.x, ptr.y)) { commit(); used = true; }
        if (!used) {
          // 3D build: the floor is seen in perspective, so a touch is turned into a floor point by the presenter's camera
          const f0 = v3.on && v3.toFloor ? v3.toFloor(ptr.x, ptr.y) : null;
          const inFloor = v3.on && v3.toFloor ? !!f0 && f0.x > -60 && f0.x < 700 && f0.y > -60 && f0.y < 700
            : ptr.x >= L.floor.x && ptr.x <= L.floor.x + L.floor.size && ptr.y >= L.floor.y && ptr.y <= L.floor.y + L.floor.size;
          if (inFloor) state.drag = { x0: ptr.x, y0: ptr.y, ax: state.aim.x, ay: state.aim.y, moved: 0, w0: f0 };
        }
      }
      if (state.slideDrag && !state.act) {
        if (ptr.down) { const tr = L.track; setPower(0.2 + 0.8 * clamp((ptr.x - tr.x0) / (tr.x1 - tr.x0), 0, 1)); }
        if (ptr.released || !ptr.down) state.slideDrag = false;
      }
      if (state.drag) {
        const d = state.drag;
        if (ptr.down) {
          d.moved = Math.max(d.moved, Math.hypot(ptr.x - d.x0, ptr.y - d.y0));
          if (d.moved >= 8) {
            const wp = d.w0 && v3.toFloor ? v3.toFloor(ptr.x, ptr.y) : null;
            if (wp) setAim(d.ax + (wp.x - d.w0.x), d.ay + (wp.y - d.w0.y));
            else if (!d.w0) setAim(d.ax + (ptr.x - d.x0) / L.floor.s, d.ay + (ptr.y - d.y0) / L.floor.s);
          }
        }
        if (ptr.released) {
          if (d.moved < 8) { const p = d.w0 || toWorld(L, d.x0, d.y0); setAim(p.x, p.y); }
          state.drag = null;
        }
      }
      // keyboard
      const k = keys.down, st = 4;
      if (k.has('ArrowLeft')) setAim(state.aim.x - st, state.aim.y);
      if (k.has('ArrowRight')) setAim(state.aim.x + st, state.aim.y);
      if (k.has('ArrowUp')) setAim(state.aim.x, state.aim.y - st);
      if (k.has('ArrowDown')) setAim(state.aim.x, state.aim.y + st);
      if (k.has('KeyW')) setPower(state.aim.power + 0.012);
      if (k.has('KeyS')) setPower(state.aim.power - 0.012);
      if (hand.length) {
        if (keys.pressed.has('KeyQ')) selectDisc((state.aim.hi + hand.length - 1) % hand.length);
        if (keys.pressed.has('KeyE')) selectDisc((state.aim.hi + 1) % hand.length);
      }
      if (keys.pressed.has('KeyH')) requestHint();
      if (keys.pressed.has('Space') || keys.pressed.has('Enter')) commit();
    } else if (state.drag && !state.humanTurn) state.drag = null;
    if (state.paused) return;
    updateHint();
    updateAI(dt);
    if (state.act) updateAct(dt);
    for (const c of m.floor.cards) if (c.pop > 0) c.pop = Math.max(0, c.pop - dt);
    stepParts(state.parts, dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
  };

  const leaveMatch = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.drag = null; state.act = null; state.pass = null; };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'quit') leaveMatch();
  }

  // ---- menus -----------------------------------------------------------------------------------
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
    else if (id === 'collection') { state.scene = 'collection'; state.colScroll = 0; }
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id === 'len5') s.hand = 5;
    else if (id === 'len8') s.hand = 8;
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, hand: s.hand });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      if (state.restoreBusy) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.())
        .then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; })
        .catch(() => { state.restoreMsg = 'The store is not available right now.'; })
        .finally(() => { state.restoreBusy = false; });
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
    if (k.pressed.has('KeyO') && state.setup.mode === 'ai') state.setup.opp = (state.setup.opp + 1) % (state.demo ? 2 : 4);
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
  let colDrag = null;
  const updateCollection = (input) => {
    const ptr = input.pointer, keys = input.keys, RL = refLayout(), cm = collectionMeta();
    const set = (v) => { state.colScroll = clamp(v, 0, cm.max); };
    if (ptr.pressed) {
      if (inRect(RL.next, ptr.x, ptr.y) || inRect(RL.back, ptr.x, ptr.y)) { state.scene = 'title'; state.colScroll = 0; return; }
      else if (inRect(RL.panel, ptr.x, ptr.y)) colDrag = { y0: ptr.y, s0: state.colScroll };
    }
    if (colDrag) { if (ptr.down) set(colDrag.s0 - (ptr.y - colDrag.y0)); else colDrag = null; }
    if (keys.pressed.has('ArrowDown')) set(state.colScroll + 70);
    if (keys.pressed.has('ArrowUp')) set(state.colScroll - 70);
    if (keys.pressed.has('Escape')) { state.scene = 'title'; state.colScroll = 0; }
  };

  startAttract();
  resetMenus();

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused || !!state.pass,
    update(dt, input) {
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (state.scene === 'collection') state.colScroll = clamp(state.colScroll + dy, 0, collectionMeta().max);
          else if (['title', 'setup', 'settings', 'result', 'demolimit'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, Math.max(0, flowMeta().h ?? 0));
        });
      }
      syncSize();
      state.owned = !!monetization.owns?.('unlock_game');
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'collection': updateCollection(input); break;
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
        case 'collection': renderCollection(ctx, state); break;
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
    lockupZone: () => lockupZone(),
  };
}
