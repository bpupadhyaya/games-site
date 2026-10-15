// Lagori: state and flow. Drawing is view.js; engine.js is the rule book and simulation; pages.js the text.
// Controls (taught on the How to play page): PRESS and DRAG on the court to place the aim ring, RELEASE to throw; TAP a stone to
// fetch it; DODGE button (or a sideways flick, or D) to sidestep a throw.
import { inRect, layoutFor, TEXT_SCALES, AUTO_THINK_STEPS, AUTO_REVEAL_SECS } from './layout.js';
import {
  newInning, stepInning, throwAtTower, throwAtRunner, queueStone, dodge, activeRunner, planOrder, predictRunner, holderPos, aiStrikeAim, hintFor,
  newMatch, bookInning, strikerOf, LEVELS, TOWER, THROWER, STONES, INNINGS, fielderReady, FIELDER_SPEED,
} from './engine.js';
import { render, reader } from './view.js';

// `meta.width/height` are updated live by the kit on every resize; every position comes from layoutFor(meta.width, meta.height).
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
// Mouse-wheel travel (virtual units) collected by main.js and consumed by the reader pages; empty in headless runs.
export const wheelInput = { dy: 0 };
const DEMO_MATCHES = 2, HINTS = 3, AIM_LIFT = 60, AUTO_INNINGS = 2;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, level: 1, sound: true, calm: false, textScaleIdx: 0, left: false, guide: true,
    stage: 'intro', stageT: 0, inn: null, match: null, aim: null, drag: null, fx: [], msg: null, menu: false, hintsLeft: HINTS, hintStone: -1, hintT: 0,
    shake: { x: 0, y: 0, a: 0 }, stats: { played: 0, wins: 0, towers: 0 }, scroll: 0, page: 0, back: 'title', cpuWait: 0, endWait: 0,
    demoMode: config.demo === true, dev: config.dev === true, demoMatches: 0, autoThinkIdx: 1, auto: null, lkDown: false, autoQueue: null,
    demo: { inn: null, wait: 0.6 },
    evlog: [], evId: 0, trail: [], trailAcc: 0,
  };
  let gl = null;   // the 3D presenter's projection hand-off (view.gl), set each frame by web/view3d/presenter.js; null = the 2D art
  const lay = () => layoutFor(meta.width, meta.height, state.left);
  let sounds = 0, swipe = null;

  const CLAMP = (v) => Math.min(Math.max(v, 0), TEXT_SCALES.length - 1);
  storage.get('prefs', null).then((v) => { if (v) { for (const k of ['level', 'sound', 'calm', 'left', 'guide']) if (v[k] !== undefined) state[k] = v[k]; state.level = clamp(state.level | 0, 0, LEVELS.length - 1); if (v.textScaleIdx !== undefined) state.textScaleIdx = CLAMP(v.textScaleIdx); if (v.autoThinkIdx !== undefined) state.autoThinkIdx = clamp(v.autoThinkIdx, 0, AUTO_THINK_STEPS.length - 1); audio.setMuted?.(!state.sound); } });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v }; });
  storage.get('demoMatches', 0).then((v) => { state.demoMatches = Math.max(state.demoMatches, v); });
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, textScaleIdx: state.textScaleIdx, left: state.left, guide: state.guide, autoThinkIdx: state.autoThinkIdx });
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.played, wins: state.stats.wins }); };

  const say = (text, hold = 4) => { state.msg = { text, t: 0, hold }; };
  // Auto Play is silent by design regardless of the player's own Sound setting; every sound funnels through this one helper.
  const tone = (o) => { if (state.sound && sounds < 4 && state.scene !== 'title') { sounds++; audio.tone(o); } };
  const dur = (d) => (state.calm ? d * 0.6 : d);
  const names = () => (state.scene === 'auto' ? { H: 'Saffron', C: 'Teal' } : { H: 'You', C: 'The computer' });

  // ---------------------------------------------------------------- starting things
  function setupInning(strikerIsHuman) {
    const inn = newInning(rng, { level: state.level, strikerIsHuman });
    if (state.scene === 'auto') { inn.aiField = false; inn.aiBuild = true; inn.autoPlan = true; inn.auto = true; }
    state.inn = inn; state.aim = null; state.drag = null; state.fx = []; state.msg = null; state.menu = false; state.hintStone = -1; state.cpuWait = 0; state.endWait = 0;
    state.stage = 'intro'; state.stageT = 0; swipe = null; state.autoQueue = null;
    if (state.auto) { state.auto.sub = 'idle'; state.auto.timer = 0; state.auto.dec = null; }
  }
  function beginInning() { setupInning(strikerOf(state.match.n) === 'H'); }
  function startMatch() {
    if (config.demo && state.demoMatches >= DEMO_MATCHES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoMatches += 1; storage.set('demoMatches', state.demoMatches); }
    state.scene = 'play'; state.match = newMatch(); state.hintsLeft = HINTS; state.auto = null; state.fx = [];
    beginInning(); monetization.track('match_start', { level: state.level });
  }
  const autoThinkSecs = () => AUTO_THINK_STEPS[state.autoThinkIdx];
  function startAuto() {
    state.scene = 'auto'; state.match = newMatch(); state.auto = { sub: 'idle', timer: 0, paused: false, dec: null, what: '' }; state.fx = [];
    beginInning();
  }
  function leaveToTitle() { state.scene = 'title'; state.auto = null; state.menu = false; state.stage = 'intro'; state.inn = null; state.fx = []; state.msg = null; state.aim = null; state.autoQueue = null; }

  // ---------------------------------------------------------------- effects and sound from the engine's event log
  function consume(inn) {
    for (const e of inn.ev) {
      // a presenter-facing copy of every engine event (the 3D layer reads this; nothing flows back)
      state.evId += 1; state.evlog.push({ ...e, id: state.evId, at: state.t }); if (state.evlog.length > 80) state.evlog.shift();
      if (e.t === 'throw') tone({ freq: 220, to: 520, dur: 0.12, type: 'triangle', vol: 0.06 });
      else if (e.t === 'bounce') { tone({ freq: 150, to: 80, dur: 0.07, type: 'sine', vol: 0.05 + Math.min(0.06, e.v / 4000) }); state.fx.push({ type: 'dust', x: e.x, y: e.y, vx: 20, vy: -10, t: 0, dur: dur(0.45) }); }
      else if (e.t === 'knock') {
        for (let i = 0; i < 4; i++) tone({ freq: 320 + i * 110, to: 120 + i * 40, dur: 0.1, type: 'square', vol: 0.05 });
        state.fx.push({ type: 'ring', x: e.x, y: e.y, t: 0, dur: dur(0.5), s: 1.5 });
        state.fx.push({ type: 'burst', x: e.x, y: e.y, z: 0.7, t: 0, dur: dur(0.55), s: 0.2, color: '#ffe27a' });
        for (let i = 0; i < 10; i++) state.fx.push({ type: 'dust', x: e.x, y: e.y + 6, vx: (rng.next() - 0.5) * 200, vy: (rng.next() - 0.5) * 80, t: 0, dur: dur(0.7) });
        state.fx.push({ type: 'pop', text: 'Down!', color: '#ffd45e', x: e.x, y: e.y, t: 0, dur: dur(1.1) });
        if (!state.calm) state.shake.a = Math.min(16, 4 + e.speed / 70);
        if (state.scene === 'play') say(inn.strikerIsHuman ? 'The tower is down. Tap a stone to rebuild it!' : 'The tower is down. Aim at the runner!', 4);
      } else if (e.t === 'place') {
        tone({ freq: 380 + e.n * 70, to: 520 + e.n * 70, dur: 0.1, type: 'triangle', vol: 0.09 });
        state.fx.push({ type: 'ring', x: e.x, y: e.y, t: 0, dur: dur(0.4), s: 0.8 });
        if (e.n === STONES) state.fx.push({ type: 'pop', text: 'LAGORI!', color: '#ffd45e', x: e.x, y: e.y - 100, t: 0, dur: dur(1.4) });
      } else if (e.t === 'out') {
        tone({ freq: 360, to: 110, dur: 0.3, type: 'sawtooth', vol: 0.08 });
        state.fx.push({ type: 'pop', text: 'Out!', color: '#ff8a70', x: e.x, y: e.y, t: 0, dur: dur(1) }); state.fx.push({ type: 'flash', t: 0, dur: dur(0.5) });
        state.fx.push({ type: 'burst', x: e.x, y: e.y, z: 1.0, t: 0, dur: dur(0.5), s: 0.1, color: '#ff6a50' });
        if (!state.calm) state.shake.a = 7;
      } else if (e.t === 'dodge') { tone({ freq: 700, to: 1100, dur: 0.1, type: 'sine', vol: 0.06 }); state.fx.push({ type: 'ring', x: e.x, y: e.y, t: 0, dur: dur(0.35), s: 0.7 }); }
      else if (e.t === 'miss') { if (inn.strikerIsHuman === (state.scene !== 'auto')) state.fx.push({ type: 'pop', text: 'Missed', color: '#cfe8ff', x: e.x, y: e.y, t: 0, dur: dur(0.7) }); }
      else if (e.t === 'catch') tone({ freq: 240, to: 200, dur: 0.05, type: 'sine', vol: 0.04 });
      else if (e.t === 'fthrow') tone({ freq: 300, to: 700, dur: 0.1, type: 'triangle', vol: 0.06 });
    }
    inn.ev.length = 0;
  }
  // The ball's recent path (sim positions): the 3D layer draws a streak from it, the 2D art a dotted tail.
  function trailStep(inn, dt) {
    const b = inn.ball, tr = state.trail;
    if (b.mode === 'flight') {
      state.trailAcc += dt;
      if (!tr.length || state.trailAcc >= 0.018) { state.trailAcc = 0; tr.push({ x: b.x, y: b.y, z: b.z, hit: !!b.hit, t: state.t }); }
    }
    while (tr.length && (state.t - tr[0].t > 0.5 || tr.length > 28)) tr.shift();
  }
  function updateFx(dt) {
    for (const f of state.fx) f.t += dt;
    state.fx = state.fx.filter((f) => f.t < f.dur);
    if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
    const s = state.shake; s.a *= Math.pow(0.02, dt); if (s.a < 0.2) s.a = 0; s.x = Math.sin(state.t * 83) * s.a; s.y = Math.cos(state.t * 71) * s.a * 0.6;
  }

  // ---------------------------------------------------------------- the human's input
  const courtPoint = (P, p) => (gl && gl.on && gl.unproject ? gl.unproject(p.x, p.y) : lay().toCourt(P, p.x, p.y));
  function humanCanAim(inn) {
    if (state.stage !== 'live' || state.menu || inn.result) return false;
    if (inn.strikerIsHuman) return inn.phase === 'throw' && inn.ball.mode === 'held';
    return inn.phase === 'rebuild' && inn.ball.mode === 'held' && inn.fcool <= 0;
  }
  const clampAim = (inn, c) => ({ x: clamp(c.x, 70, 650), y: inn.strikerIsHuman ? clamp(c.y, 140, THROWER.y - 120) : clamp(c.y, 130, 880) });
  function fireAim() {
    const inn = state.inn, a = state.aim;
    if (!a || !humanCanAim(inn)) return false;
    if (inn.strikerIsHuman) { if (!throwAtTower(inn, rng, a.x, a.y, 1)) return false; }
    else { const h = holderPos(inn); const noise = 6 + dist(h.x, h.y, a.x, a.y) * 0.02; if (!throwAtRunner(inn, rng, a.x, a.y, noise)) return false; }
    state.msg = null; state.aim = null; state.drag = null; state.hintT = 0; return true;
  }
  function updateHumanPlay(dt, input, tap) {
    const inn = state.inn, P = lay().play(state.scene), p = input.pointer, keys = input.keys;
    // buttons
    if (tap) {
      if (inRect(P.btn.menu, tap.x, tap.y)) { state.menu = true; state.drag = null; return; }
      if (inRect(P.btn.hint, tap.x, tap.y)) { askHint(); return; }
      if (inRect(P.btn.act, tap.x, tap.y)) {
        if (inn.strikerIsHuman && inn.phase === 'rebuild') { if (!dodge(inn, activeRunner(inn))) say('Dodge is recharging.', 1.5); }
        else if (state.aim) fireAim(); else say('Aim first: press and drag on the court, then release.', 3);
        return;
      }
    }
    if (keys.pressed.has('KeyH')) askHint();
    if (inn.strikerIsHuman && inn.phase === 'rebuild') {
      for (let i = 0; i < STONES; i++) if (keys.pressed.has('Digit' + (i + 1))) queueStone(inn, i);
      if (keys.pressed.has('KeyD') || keys.pressed.has('Space')) dodge(inn, activeRunner(inn));
      if (p.pressed && inRect(P.area, p.x, p.y)) {
        const c = courtPoint(P, p); let bi = -1, bd = 52;
        for (const s of inn.stones) if (s.state === 'ground') { const d = dist(c.x, c.y, s.x, s.y); if (d < bd) { bd = d; bi = s.i; } }
        if (bi >= 0) { if (queueStone(inn, bi)) tone({ freq: 520, to: 640, dur: 0.05, type: 'triangle', vol: 0.05 }); state.hintStone = -1; swipe = null; }
        else swipe = { x: p.x, y: p.y, t: state.t };
      }
      if (swipe && p.released) { const dx = p.x - swipe.x, dy = p.y - swipe.y; if (Math.hypot(dx, dy) > 60 && state.t - swipe.t < 0.6) dodge(inn, activeRunner(inn), dx, dy * 0.5); swipe = null; }
      if (!p.down && !p.released) swipe = null;
      return;
    }
    // aiming: strike (tower) or field (runner)
    if (!humanCanAim(inn)) { state.drag = null; if (!(state.stage === 'live' && state.aim && inn.ball.mode === 'held')) state.aim = null; return; }
    const AK = 360 * dt;
    if (keys.down.has('ArrowLeft') || keys.down.has('ArrowRight') || keys.down.has('ArrowUp') || keys.down.has('ArrowDown')) {
      const base = state.aim ?? (inn.strikerIsHuman ? { x: TOWER.x, y: TOWER.y + 30 } : { x: activeRunner(inn)?.x ?? 360, y: activeRunner(inn)?.y ?? 500 });
      state.aim = clampAim(inn, { x: base.x + ((keys.down.has('ArrowRight') ? 1 : 0) - (keys.down.has('ArrowLeft') ? 1 : 0)) * AK, y: base.y + ((keys.down.has('ArrowDown') ? 1 : 0) - (keys.down.has('ArrowUp') ? 1 : 0)) * AK });
    }
    if (keys.pressed.has('Space') || keys.pressed.has('Enter')) { if (state.aim) fireAim(); else say('Aim first: arrow keys move the ring, then Space.', 3); return; }
    if (p.pressed && inRect(P.area, p.x, p.y) && !state.menu) state.drag = { x0: p.x, y0: p.y, moved: false };
    const d = state.drag;
    if (d && p.down) {
      if (Math.hypot(p.x - d.x0, p.y - d.y0) > 10) d.moved = true;
      state.aim = clampAim(inn, courtPoint(P, { x: p.x, y: p.y - AIM_LIFT })); state.hintT = 0;
    }
    if (d && p.released) {
      const onUi = inRect(P.btn.menu, p.x, p.y) || inRect(P.btn.hint, p.x, p.y) || inRect(P.btn.act, p.x, p.y);
      if (state.aim && !onUi) { if (d.moved) fireAim(); else say('Ring placed. Drag to adjust, release to throw, or press Throw.', 3); }
      state.drag = null;
    }
    if (d && !p.down && !p.released) state.drag = null;
  }
  function askHint() {
    const inn = state.inn;
    if (state.stage !== 'live' || inn.result) return;
    if (state.hintsLeft <= 0) { say('No hints left in this match.'); return; }
    const h = hintFor(inn, rng);
    if (h.kind === 'throw') { state.aim = { x: h.x, y: h.y }; say('A throw is lined up at the tower. Press Throw, or drag to change it.', 5); }
    else if (h.kind === 'field') { state.aim = clampAim(inn, h); say('Aimed a little ahead of the runner. Press Throw, or drag to change it.', 5); }
    else if (h.kind === 'stone' && h.i >= 0) { state.hintStone = h.i; say('Fetch the glowing stone. When a red ring locks on your runner, DODGE.', 5); }
    else { say('Wait for the recharge, then fetch the next stone.', 3); return; }
    state.hintsLeft -= 1;
  }

  // ---------------------------------------------------------------- the computer's tower throw
  function updateCpuStrike(dt) {
    const inn = state.inn;
    if (inn.strikerIsHuman || inn.phase !== 'throw' || inn.ball.mode !== 'held') { state.cpuWait = 0; return; }
    if (state.cpuWait === 0) say('The computer takes aim at the tower.', 2.5);
    state.cpuWait += dt;
    if (state.cpuWait > dur(1.1)) { const a = aiStrikeAim(inn, rng); throwAtTower(inn, rng, a.x, a.y, LEVELS[state.level].strikeErr); state.cpuWait = 0; }
  }

  // ---------------------------------------------------------------- Auto Play ("Watch & Learn")
  // Both teams are the computer. Every decision runs THINK (the configurable pause, the world held still) -> REVEAL (the choice is
  // shown: the throw ring, the numbered stones, the lead on the runner) -> ACT (played through the same engine calls a human's own
  // input makes). Decisions: a throw at the tower, the order to fetch stones in, a fielder's throw. Pause freezes everything.
  function autoDecide(inn) {
    const A = state.auto, nm = names();
    if (inn.phase === 'throw' && inn.ball.mode === 'held') {
      const a = aiStrikeAim(inn, rng); A.dec = { kind: 'throw', x: a.x, y: a.y }; A.what = `${inn.strikerIsHuman ? nm.H : nm.C} throws`;
    } else if (inn.phase === 'rebuild' && fielderReady(inn)) {
      const r = activeRunner(inn), h = holderPos(inn), p = predictRunner(inn, r, dist(h.x, h.y, r.x, r.y) / FIELDER_SPEED);
      A.dec = { kind: 'field', x: p.x, y: p.y }; A.what = `${inn.strikerIsHuman ? nm.C : nm.H} aims`;
    } else {
      const r = activeRunner(inn);
      if (inn.phase === 'rebuild' && r && r.state === 'run' && r.carry < 0 && r.queue.length === 0 && r.dodge <= 0) {
        const order = planOrder(inn, r.x, r.y).slice(0, 4);
        if (order.length) { A.dec = { kind: 'plan', order }; A.what = `${inn.strikerIsHuman ? nm.H : nm.C} plans`; } else return false;
      } else return false;
    }
    A.sub = 'think'; A.timer = 0; return true;
  }
  function autoAct(inn) {
    const A = state.auto, d = A.dec; A.dec = null; A.sub = 'idle'; A.timer = 0; state.aim = null; state.hintStone = -1; state.autoQueue = null;
    if (!d) return;
    if (d.kind === 'throw') throwAtTower(inn, rng, d.x, d.y, 1);
    else if (d.kind === 'field') throwAtRunner(inn, rng, d.x, d.y, LEVELS[state.level].noise);
    else if (d.kind === 'plan') for (const i of d.order) queueStone(inn, i);
  }
  function updateAuto(dt, tap, input) {
    const A = state.auto, P = lay().play('auto');
    if (!A) return;
    updateFx(A.paused ? 0 : dt);
    const inn = state.inn;
    if (tap) {
      if (inRect(P.auto.dec, tap.x, tap.y)) { if (state.autoThinkIdx > 0) { state.autoThinkIdx -= 1; savePrefs(); } return; }
      if (inRect(P.auto.inc, tap.x, tap.y)) { if (state.autoThinkIdx < AUTO_THINK_STEPS.length - 1) { state.autoThinkIdx += 1; savePrefs(); } return; }
      if (state.menu) { menuTap(tap); return; }
      if (state.stage === 'result' || state.stage === 'over') { resultTap(tap); return; }
      if (inRect(P.btn.menu, tap.x, tap.y)) { leaveToTitle(); return; }
      if (inRect(P.btn.hint, tap.x, tap.y)) { A.paused = !A.paused; return; }
      if (inRect(P.btn.act, tap.x, tap.y)) { if (A.sub === 'think' || A.sub === 'reveal') A.timer = 999; return; }
      return;
    }
    if (input.keys.pressed.has('KeyP')) A.paused = !A.paused;
    if (A.paused || state.menu) return;
    if (state.stage === 'intro') { state.stageT += dt; if (state.stageT > dur(1.7)) state.stage = 'live'; return; }
    if (state.stage !== 'live') return;
    if (A.sub === 'think') {
      A.timer += dt;
      if (A.timer >= autoThinkSecs()) {
        A.sub = 'reveal'; A.timer = 0;
        if (A.dec.kind === 'throw' || A.dec.kind === 'field') state.aim = { x: A.dec.x, y: A.dec.y };
        if (A.dec.kind === 'plan') state.autoQueue = A.dec.order;
      }
      return;
    }
    if (A.sub === 'reveal') { A.timer += dt; if (A.timer >= AUTO_REVEAL_SECS) autoAct(inn); return; }
    if (!inn.result && autoDecide(inn)) return;
    runInning(dt);
  }

  // ---------------------------------------------------------------- the inning clock (shared)
  function runInning(dt) {
    const inn = state.inn;
    stepInning(inn, rng, dt); consume(inn); trailStep(inn, dt);
    if (inn.result) {
      state.endWait += dt;
      if (state.endWait > dur(0.9) || inn.result.kind === 'standing') { state.stage = 'result'; finishInning(); }
    }
    if (state.hintStone >= 0 && inn.stones[state.hintStone].state !== 'ground') state.hintStone = -1;
  }
  function finishInning() {
    const m = state.match, inn = state.inn;
    bookInning(m, inn);
    if (state.scene === 'auto' && m.n >= AUTO_INNINGS && !m.over) m.over = { winner: m.score.H > m.score.C ? 'H' : m.score.C > m.score.H ? 'C' : 'draw' };
    if (state.scene === 'play') {
      if (inn.result.kind === 'lagori' && inn.strikerIsHuman) state.stats.towers += 1;
      if (m.over) { state.stats.played += 1; if (m.over.winner === 'H') state.stats.wins += 1; saveStats(); monetization.track('match_end', { winner: m.over.winner, h: m.score.H, c: m.score.C, level: state.level }); }
      tone({ freq: inn.result.kind === 'lagori' ? 520 : 300, to: inn.result.kind === 'lagori' ? 900 : 220, dur: 0.45, type: 'triangle', vol: 0.1 });
    }
  }
  function resultTap(tap) {
    const D = lay().dialog(state.stage === 'over' ? 'over' : 'inning');
    if (inRect(D.btns[0], tap.x, tap.y)) {
      if (state.stage === 'over') { if (state.scene === 'auto') startAuto(); else startMatch(); }
      else if (state.match.over) state.stage = 'over';
      else beginInning();
    } else if (inRect(D.btns[1], tap.x, tap.y)) leaveToTitle();
  }
  function menuTap(tap) {
    const MENU = lay().menu;
    if (inRect(MENU.resume, tap.x, tap.y)) state.menu = false;
    else if (inRect(MENU.restart, tap.x, tap.y)) { state.menu = false; if (state.scene === 'auto') startAuto(); else startMatch(); }
    else if (inRect(MENU.settings, tap.x, tap.y)) { state.back = state.scene; state.menu = false; state.scene = 'settings'; }
    else if (inRect(MENU.quit, tap.x, tap.y)) { state.menu = false; leaveToTitle(); }
  }
  function updatePlay(dt, input, tap) {
    updateFx(dt);
    const inn = state.inn;
    if (state.menu) { if (tap) menuTap(tap); return; }
    if (state.stage === 'intro') {
      state.stageT += dt;
      if (state.stageT > dur(1.7) || (tap && state.stageT > 0.4)) { state.stage = 'live'; state.stageT = 0; if (inn.strikerIsHuman) say('Press and drag on the court, release to throw at the tower.', 5); }
      return;
    }
    if (state.stage === 'result' || state.stage === 'over') { if (tap) resultTap(tap); return; }
    updateCpuStrike(dt);
    updateHumanPlay(dt, input, tap);
    if (state.menu) return;
    runInning(dt);
  }

  // ---------------------------------------------------------------- title attract mode: a real inning, played by the computer
  function updateDemo(dt) {
    const d = state.demo;
    updateFx(dt);
    if (!d.inn) { d.inn = newInning(rng, { level: 1, strikerIsHuman: false }); d.inn.aiField = true; d.inn.aiBuild = true; d.wait = 0.9; return; }
    const inn = d.inn;
    if (inn.result) { d.wait -= dt; if (d.wait < -2.2) d.inn = null; return; }
    if (inn.phase === 'throw' && inn.ball.mode === 'held') { d.wait -= dt; if (d.wait <= 0) { const a = aiStrikeAim(inn, rng); throwAtTower(inn, rng, a.x, a.y, 0.6); d.wait = 0.9; } }
    stepInning(inn, rng, dt); consume(inn); trailStep(inn, dt);
    if (inn.result) d.wait = 0;
  }
  function updateTitle(dt, tap, input0) {
    updateDemo(dt);
    const LT = lay().title(false).lockTap; state.lkDown = !!(input0 && input0.pointer.down && inRect(LT, input0.pointer.x, input0.pointer.y));
    if (tap && inRect(LT, tap.x, tap.y)) { env.openArcforgeHome?.(); return; }
    if (!tap) return;
    const B = lay().title(false).rows, hit = (r) => r && inRect(r, tap.x, tap.y);
    if (hit(B.play)) startMatch();
    else if (hit(B.level)) { state.level = (state.level + 1) % LEVELS.length; savePrefs(); tone({ freq: 500, to: 300, dur: 0.06, type: 'triangle', vol: 0.06 }); }
    else if (hit(B.howto)) { state.scene = 'howto'; state.page = 0; state.scroll = 0; } else if (hit(B.about)) { state.scene = 'about'; state.page = 0; state.scroll = 0; }
    else if (hit(B.rules)) { state.scene = 'rules'; state.page = 0; state.scroll = 0; } else if (hit(B.settings)) { state.back = 'title'; state.scene = 'settings'; }
    else if (hit(B.auto)) startAuto();
  }

  // ---------------------------------------------------------------- reader pages and settings
  function stepText(tap) {
    const RD = lay().reader;
    if (inRect(RD.dec, tap.x, tap.y)) { state.scroll = 0; if (state.textScaleIdx > 0) { state.textScaleIdx--; savePrefs(); tone({ freq: 460, to: 360, dur: 0.05, type: 'triangle', vol: 0.06 }); } return true; }
    if (inRect(RD.inc, tap.x, tap.y)) { state.scroll = 0; if (state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; savePrefs(); tone({ freq: 460, to: 560, dur: 0.05, type: 'triangle', vol: 0.06 }); } return true; }
    return false;
  }
  let rdrag = null;
  function updateReader(input, tap) {
    const RD = lay().reader, p = input.pointer, maxS = () => Math.max(0, reader.max || 0), setS = (v) => { state.scroll = Math.min(Math.max(0, v), maxS()); };
    if (wheelInput.dy) { setS(state.scroll + wheelInput.dy); wheelInput.dy = 0; }
    if (input.keys.down.has('ArrowDown')) setS(state.scroll + 12); if (input.keys.down.has('ArrowUp')) setS(state.scroll - 12);
    const kp = input.keys.pressed;
    if (kp.has('PageDown') || kp.has('Space')) setS(state.scroll + RD.viewport.h * 0.85); if (kp.has('PageUp')) setS(state.scroll - RD.viewport.h * 0.85);
    if (kp.has('Home')) setS(0); if (kp.has('End')) setS(1e9);
    if (kp.has('Escape')) { state.scene = 'title'; return; }
    if (p.pressed && inRect(RD.viewport, p.x, p.y)) rdrag = { y0: p.y, s0: state.scroll, moved: false };
    if (rdrag && p.down) { if (Math.abs(p.y - rdrag.y0) > 6) rdrag.moved = true; if (rdrag.moved) setS(rdrag.s0 - (p.y - rdrag.y0)); }
    if (!p.down) rdrag = null;
    if (!tap) return;
    if (inRect(RD.nav.back, tap.x, tap.y)) state.scene = 'title';
    else if (inRect(RD.nav.next, tap.x, tap.y)) setS(state.scroll + RD.viewport.h * 0.85);
    else if (inRect(RD.nav.prev, tap.x, tap.y)) setS(0);
    else stepText(tap);
  }
  // Settings > Restore purchase: busy / found / not found / failed, all shown on the row itself (hidden in the web demo).
  function doRestore() {
    if (state.restoreMsg === 'Checking...' || !monetization.restore) return;
    if (monetization.owns('unlock_game')) { state.restoreMsg = 'Unlocked'; return; }
    state.restoreMsg = 'Checking...';
    Promise.resolve(monetization.restore()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Unlocked' : 'None found'; })
      .catch(() => { state.restoreMsg = 'Failed'; });
  }
  function updateSettings(tap) {
    if (!tap) return;
    const SET = lay().settings;
    if (inRect(SET.done, tap.x, tap.y)) { const b = state.back; state.scene = b === 'title' ? 'title' : b; if (state.scene !== 'title') state.menu = true; savePrefs(); return; }
    const i = SET.rows.findIndex((r) => inRect(r, tap.x, tap.y)); if (i < 0) return;
    if (i === 0) { state.sound = !state.sound; audio.setMuted?.(!state.sound); } else if (i === 1) state.calm = !state.calm; else if (i === 2) state.textScaleIdx = (state.textScaleIdx + 1) % TEXT_SCALES.length; else if (i === 3) state.left = !state.left;
    else if (i === 4) state.guide = !state.guide; else if (i === 5 && !state.demoMode) doRestore();
    savePrefs(); tone({ freq: 520, to: 380, dur: 0.05, type: 'triangle', vol: 0.06 });
  }

  // Store screenshots and dev: jump straight to a staged moment, played through the real engine (?shot=1&scene=strike|flight|rebuild|field|dodge|watch).
  function shotScene(name) {
    // The last 1.2 s of a staged moment are recorded (inning snapshots every 1/30 s) so the 3D layer can play them out and the figures are
    // mid-stride in the frozen frame; the live game never uses this.
    const STEP = 1 / 60; let rec = false;
    const run = (inn, secs) => {
      const n = Math.round(secs / STEP);
      for (let i = 0; i < n; i++) {
        if (!rec && n - i <= 72) { rec = true; state.shotTrack = []; state.shotEv0 = state.evId; }
        state.t += STEP; stepInning(inn, rng, STEP); consume(inn); trailStep(inn, STEP); updateFx(STEP);
        if (rec && i % 2 === 0) state.shotTrack.push(structuredClone(inn));
      }
    };
    const begin = (strikerIsHuman) => { state.scene = 'play'; state.match = newMatch(); state.match.n = strikerIsHuman ? 0 : 1; state.hintsLeft = HINTS; state.auto = null; state.fx = []; setupInning(strikerIsHuman); state.stage = 'live'; return state.inn; };
    if (name === 'about' || name === 'howto' || name === 'rules' || name === 'settings') { state.scene = name; state.page = 0; state.scroll = 0; state.back = 'title'; return; }
    if (name === 'title') { state.scene = 'title'; for (let i = 0; i < 60 * 9; i++) updateDemo(STEP); return; }
    if (name === 'strike') { const inn = begin(true); state.aim = { x: TOWER.x + 18, y: TOWER.y + 30 }; run(inn, 0.1); return; }
    if (name === 'flight') { const inn = begin(true); throwAtTower(inn, rng, TOWER.x + 4, TOWER.y + 26, 0); run(inn, 0.46); return; }
    if (name === 'rebuild' || name === 'dodge' || name === 'watch') {
      const inn = begin(true); throwAtTower(inn, rng, TOWER.x, TOWER.y + 10, 0);
      for (let i = 0; i < 200 && inn.phase === 'throw'; i++) run(inn, 0.05);
      run(inn, name === 'rebuild' ? 1.6 : 4.2);
      const r = activeRunner(inn); if (r && r.state === 'run') for (const i of planOrder(inn, r.x, r.y).slice(0, 4)) queueStone(inn, i);
      if (name === 'dodge') { for (let i = 0; i < 300 && !(inn.wind && inn.wind.locked); i++) run(inn, 0.05); }
      else run(inn, name === 'rebuild' ? 1.2 : 3.0);
      state.stage = 'live'; return;
    }
    if (name === 'field') {
      const inn = begin(false); const a = aiStrikeAim(inn, rng); throwAtTower(inn, rng, a.x, a.y, 0.4);
      for (let i = 0; i < 200 && inn.phase === 'throw'; i++) run(inn, 0.05);
      run(inn, 2.6); const r = activeRunner(inn), h = holderPos(inn);
      if (r) { const p = predictRunner(inn, r, dist(h.x, h.y, r.x, r.y) / FIELDER_SPEED); state.aim = clampAim(inn, p); }
      state.stage = 'live'; return;
    }
  }

  return {
    shotScene,
    update(dt, input) {
      state.t += dt; sounds = 0;
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'title') updateTitle(dt, tap, input);
      else if (sc === 'play') updatePlay(dt, input, tap);
      else if (sc === 'settings') updateSettings(tap);
      else if (sc === 'howto' || sc === 'rules' || sc === 'about') updateReader(input, tap);
      else if (sc === 'demo-limit') { if (tap && inRect(lay().demo.back, tap.x, tap.y)) state.scene = 'title'; }
      else if (sc === 'auto') updateAuto(dt, tap, input);
    },
    render(ctx, view) { gl = view?.gl ?? null; state.owned = monetization.owns('unlock_game'); render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height, state.left), gl); },
    getState: () => state,
    // The preview clock counts real play only: a live inning of a real match. Menu, Rules / How to Play / About, Settings, the pause
    // menu, Auto Play (a free teaching demo), banners and result cards are all free time.
    isPreviewExempt: () => state.menu || !(state.scene === 'play' && state.stage === 'live'),
  };
}
export { INNINGS };
