// Ken and Ball: state and flow. Physics lives in phys.js, tricks and scoring in tricks.js, the playing hand (Watch & Learn
// and Think) in ai.js, drawing in art.js / hud.js / menus.js. This is the only file that mutates `state`.
//
// Scenes: title, ladder, play (modes: trick, run, practice, watch), result, settings, howto/about/rules, demolimit.
// Hand: press in the play area and drag; the ken follows the finger relative to where it was. Pop (hold to charge, release)
// is the same pull the planner uses. Flip turns the ken over. Think asks the planner for the catch you need.
import { W, H, TEXT_SCALES, THINK_STEPS, PLAY_ZONE, POP_BTN, FLIP_BTN, HINT_BTN, MENU_BTN, WATCH_BAR, REF_BACK, REF_NEXT, TEXT_DEC, TEXT_INC, HUD, inRect } from './layout.js';
import {
  createWorld, cloneWorld, settleHanging, stepWorld, setHand, toggleFlip, KEN_BOX, anchorOf, R, EVENT_STRIDE, isFlipped,
} from './phys.js';
import {
  TRICKS, TRICK_BY_ID, newTracker, stepTracker, starsFor, totalStars, trickOpen, TIERS, newRun, dealOffers, offerValue, RUN_STRIKES, resetTry,
} from './tricks.js';
import {
  newCtl, stepCtl, createPlanner, throwPos, POP_T, popSpeed, chargeOf,
} from './ai.js';
import { newRope, stepRope } from './art.js';
import { renderPlay, tgtName } from './hud.js';
import { renderTitle, renderLadder, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, hitScreen, flowMeta, pageCount, ensureLayout, resetMenus } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export const meta = { width: W, height: H };
const DEMO_RUNS = 2;
const POP_WOBBLE = 0.26;     // a hand is never perfectly straight: the pop leaves up to 0.13 rad off vertical
const ATT_SEQ = ['big', 'small', 'spike', 'big', 'base', 'big', 'small', 'spike'];
const WATCH_SET = ['big', 'small', 'spike', 'base', 'big-small', 'small-big', 'spike-big', 'big-spike', 'base-big', 'trio'];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const SHOT = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  resetMenus();
  const fx = rng.fork();
  const aiRng = rng.fork();
  const runRng = rng.fork();
  const popRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, mode: 'trick',
    settings: { sound: true, assist: 1, textIdx: 0, thinkIdx: 1 },
    record: { stars: {}, drops: {}, runBest: 0, runs: 0, catches: 0, starTotal: 0, demoRuns: 0, practiceBest: 0 },
    ui: { scroll: 0, drag: null, focusId: null }, page: 0, ladderMsg: '', restoreMsg: '',
    w: createWorld(), tr: newTracker([{ t: 'big' }]), trickId: 'big', trickName: 'Big Cup', run: newRun(), pr: { target: 'big', catches: 0, streak: 0, best: 0 },
    drag: null, pop: { holding: false, charge: 0, active: false, t: 0, V: 0, ang: 0, p0: null, key: false }, hint: null, watch: null, res: null, resT: 0,
    parts: [], pops: [], toast: '', toastT: 0, flash: 0, att: null, thinkSecs: 5, thinkMax: THINK_STEPS.length - 1, loaded: false, shotAuto: false,
  };
  settleHanging(state.w);
  let rope = newRope(), planner = null, hintPlanner = null, ctl = null, autoSeq = 0;
  const petals = [];

  // ---- persistence -----------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (SHOT) { state.loaded = true; return; }
    if (s) Object.assign(state.settings, s);
    if (r) { Object.assign(state.record, r); state.record.stars = { ...(r.stars ?? {}) }; state.record.drops = { ...(r.drops ?? {}) }; }
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    state.settings.assist = clamp(state.settings.assist | 0, 0, 2);
    state.record.starTotal = totalStars(state.record);
    state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
    state.w.assist = state.settings.assist;
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    tok: (v) => { const q = clamp(v / 1400, 0, 1); tone({ freq: 640 + fx.next() * 120, to: 380, dur: 0.07, type: 'triangle', vol: 0.05 + 0.1 * q }); tone({ freq: 190 + fx.next() * 30, to: 110, dur: 0.1, type: 'sine', vol: 0.04 + 0.1 * q }); },
    ping: () => { tone({ freq: 1560, to: 1500, dur: 0.35, type: 'sine', vol: 0.09 }); tone({ freq: 760, to: 700, dur: 0.12, type: 'triangle', vol: 0.08 }); },
    snap: (v) => tone({ freq: 240 + clamp(v / 8, 0, 200), to: 110, dur: 0.06, type: 'square', vol: 0.025 + clamp(v / 40000, 0, 0.05) }),
    wall: () => tone({ freq: 150, to: 80, dur: 0.1, type: 'sine', vol: 0.06 }),
    pop: (c) => tone({ freq: 260 + c * 120, to: 620 + c * 380, dur: 0.16, type: 'sawtooth', vol: 0.035 }),
    flip: () => { tone({ freq: 420, to: 760, dur: 0.12, type: 'triangle', vol: 0.05 }); tone({ freq: 760, to: 420, dur: 0.14, type: 'triangle', vol: 0.04 }); },
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    drop: () => tone({ freq: 330, to: 150, dur: 0.28, type: 'sawtooth', vol: 0.05 }),
    chime: (i = 0) => { tone({ freq: 523 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.12 }); tone({ freq: 1046 * Math.pow(1.26, i), dur: 0.22, type: 'sine', vol: 0.05 }); },
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.28 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };
  const say = (text, x, y, o = {}) => { state.pops.push({ text, x, y, t: 0, max: o.max ?? 1.3, size: o.size, col: o.col }); if (state.pops.length > 6) state.pops.shift(); };

  // ---- particles --------------------------------------------------------------------------------
  const MAX_PARTS = 120;
  const PETAL_COL = ['#ffc4d4', '#ffb3c8', '#ffd9e2', '#ffa9bf'];
  const burstAt = (parts, x, y, n, col) => {
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) {
      const a = fx.next() * Math.PI * 2, sp = 80 + fx.next() * 260;
      parts.push({ kind: i % 3 === 0 ? 1 : 0, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, rot: fx.next() * 6, vr: (fx.next() - 0.5) * 8, t: 0, max: 0.8 + fx.next() * 0.7, size: i % 3 === 0 ? 10 + fx.next() * 6 : 9 + fx.next() * 6, col: i % 3 === 0 ? col ?? '#ffe08a' : PETAL_COL[i % 4] });
    }
  };
  const ringAt = (parts, x, y, col, size = 70) => { if (parts.length < MAX_PARTS) parts.push({ kind: 2, x, y, vx: 0, vy: 0, rot: 0, vr: 0, t: 0, max: 0.55, size, col }); };
  const dustAt = (parts, x, y, n) => { for (let i = 0; i < n && parts.length < MAX_PARTS; i++) parts.push({ kind: 3, x: x + (fx.next() - 0.5) * 20, y, vx: (fx.next() - 0.5) * 120, vy: -30 - fx.next() * 60, rot: 0, vr: 0, t: 0, max: 0.4 + fx.next() * 0.3, size: 6 + fx.next() * 6, col: '#f1e3c4' }); };
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.kind === 0 || q.kind === 1 ? 420 : 0) * dt; q.vx *= 0.985; q.rot += q.vr * dt; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };
  // ambient petals drifting down behind everything
  for (let i = 0; i < 9; i++) petals.push({ kind: 0, x: fx.next() * W, y: fx.next() * 1000, vx: 14 + fx.next() * 22, vy: 22 + fx.next() * 24, rot: fx.next() * 6, vr: (fx.next() - 0.5) * 1.6, t: 0, max: 1e9, size: 7 + fx.next() * 5, col: PETAL_COL[i % 4] });
  const stepPetals = (dt) => {
    for (const q of petals) {
      q.x += (q.vx + Math.sin(q.t * 1.3 + q.rot) * 14) * dt; q.y += q.vy * dt; q.rot += q.vr * dt; q.t += dt;
      if (q.y > 1090 || q.x > W + 20) { q.y = -20; q.x = fx.next() * W - 60; }
    }
  };

  // ---- the title screen plays by itself ---------------------------------------------------------
  const resetAttract = () => {
    const w = createWorld(); settleHanging(w);
    state.att = { w, rope: newRope(), parts: [], idx: 0, wait: 1.2, planner: null, ctl: null, step: null };
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (a.ctl) {
      const r = stepCtl(a.w, a.ctl);
      stepWorld(a.w);
      if (r !== 0) {
        if (r > 0) { const b = a.w.ball; burstAt(a.parts, b.x, b.y, 12); ringAt(a.parts, b.x, b.y, '#ffe08a'); a.wait = 1.1; a.idx++; } else { settleHanging(a.w); a.w.ken.flipT = 0; a.wait = 0.4; }
        a.ctl = null;
      }
    } else if (a.planner) {
      stepWorld(a.w);
      a.planner.step(1);
      if (a.planner.done) {
        const p = a.planner.result;
        if (p) a.ctl = newCtl(a.w, a.step, p.params); else { settleHanging(a.w); a.w.ken.flipT = 0; a.wait = 0.3; }
        a.planner = null;
      }
    } else {
      stepWorld(a.w);
      a.wait -= dt;
      if (a.wait <= 0) {
        a.step = { t: ATT_SEQ[a.idx % ATT_SEQ.length] };
        a.planner = createPlanner(a.w, a.step, fx, { want: 1, maxTries: 160 });
      }
    }
    const an = anchorOf(a.w.ken, {}), b = a.w.ball, hm = { x: b.x + Math.cos(b.a) * R, y: b.y + Math.sin(b.a) * R };
    stepRope(a.rope, an.x, an.y, hm.x, hm.y);
    stepParts(a.parts, dt);
  };

  // ---- starting a game --------------------------------------------------------------------------
  const freshWorld = () => {
    const w = createWorld(); w.assist = state.settings.assist; settleHanging(w);
    state.w = w; rope = newRope(); state.drag = null; state.parts = []; state.pops = []; state.hint = null; hintPlanner = null; ctl = null;
    state.pop = { holding: false, charge: 0, active: false, t: 0, V: 0, ang: 0, p0: null, key: false };
    state.toastT = 0; state.flash = 0; state.res = null; state.resT = 0; state.watch = null; planner = null; autoSeq = 0;
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
  };
  const openTrick = (id) => {
    const tr = TRICK_BY_ID[id];
    if (state.demo && tr.tier > 0) { state.ladderMsg = 'That trick is in the full game.'; return; }
    freshWorld();
    state.mode = 'trick'; state.trickId = id; state.trickName = tr.name; state.tr = newTracker(tr.steps);
    toast(tr.tip, 4.2);
  };
  const startRun = () => {
    if (state.demo && state.record.demoRuns >= DEMO_RUNS) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    freshWorld();
    state.mode = 'run'; state.run = newRun(); dealOffers(state.run, runRng, null);
    state.tr = newTracker([{ t: 'any' }]); state.trickName = 'Combo Run';
    if (state.demo) state.record.demoRuns++;
    toast('Land any offered catch. Bank to keep your points.', 3.6);
  };
  const startPractice = () => {
    freshWorld();
    state.mode = 'practice'; state.pr = { target: state.pr.target ?? 'big', catches: 0, streak: 0, best: 0 };
    state.tr = newTracker([{ t: 'any' }]); state.trickName = 'Free practice';
    toast('No goal here. Aim for the lit target; tap the chip to change it.', 3.6);
  };
  const leavePlay = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.hint = null; state.watch = null; planner = null; hintPlanner = null; ctl = null; state.res = null; if (!state.att) resetAttract(); };

  // ---- the plan, in words -----------------------------------------------------------------------
  const describePlan = (plan, step) => {
    const pct = Math.round(chargeOf(plan.params.V) * 100);
    const a = plan.params.ang;
    const dir = Math.abs(a) < 0.1 ? 'straight up' : `up and ${Math.abs(a) < 0.35 ? 'a little ' : ''}${a > 0 ? 'right' : 'left'}`;
    const goal = step.t === 'spike' ? 'put the spike under the ball' : `slide the ${tgtName(step.t).toLowerCase()} under the ball`;
    return `${step.t === 'base' ? 'Flip the ken first. ' : ''}Pop ${pct}% ${dir}, then ${goal} and move down with it.`;
  };
  const currentStep = () => {
    if (state.mode === 'run') return { t: state.run.offers[autoSeq % 3] };
    if (state.mode === 'practice') return { t: state.pr.target };
    return state.tr.steps[Math.min(state.tr.i, state.tr.steps.length - 1)];
  };

  // ---- Think (hint) -----------------------------------------------------------------------------
  const calm = () => { const b = state.w.ball; return b.mode === 1 ? b.sp >= 1 : b.on > 0 ? b.onT > 0.3 : b.still > 0.4; };
  const requestHint = () => {
    if (state.mode === 'run') return;
    if (state.hint && state.hint.phase === 'show') { state.hint = null; return; }
    if (hintPlanner) return;
    const step = currentStep();
    if (!step || step.t === 'lift' || step.t === 'circle') {
      const txt = !step ? '' : step.t === 'lift' ? 'Hold Pop to full charge and let go: the ball must rise clearly above the ken.' : 'Rock the ken left and right in time with the swing. Each push should follow the ball.';
      state.hint = { phase: 'show', t: 0, arcs: [], plan: null, text: txt }; return;
    }
    if (!calm()) { toast('Let the ball settle, then ask again.', 2.2); return; }
    let w0 = state.w;
    const needFlip = (step.t === 'base') !== isFlipped(w0.ken);
    if (needFlip) {
      if (state.w.ball.on > 0 || state.w.ball.mode === 1) { toast('Flip the ken first, then ask again.', 2.4); return; }
      w0 = cloneWorld(state.w);                                  // plan as if it were already turned over
      w0.ken.flipT = w0.ken.flip = step.t === 'base' ? Math.PI : 0; w0.ken.th = w0.ken.flip; w0.ken.fv = 0;
      settleHanging(w0);
    }
    hintPlanner = createPlanner(w0, step, aiRng.fork(), { want: 3, maxTries: 220, straight: true, skipReady: true });
    state.hint = { phase: 'run', t: 0, arcs: [], plan: null, text: '', step, needFlip };
  };
  const updateHint = (dt) => {
    const h = state.hint;
    if (!h) return;
    h.t += dt;
    if (h.phase === 'run' && hintPlanner) {
      hintPlanner.step(1);
      h.arcs = hintPlanner.state.arcs;
      if (hintPlanner.done || h.t > 4) {
        if (!hintPlanner.done) hintPlanner.finish();
        const r = hintPlanner.result; hintPlanner = null;
        if (r) { h.phase = 'show'; h.t = 0; h.plan = r; h.text = (h.needFlip && h.step.t !== 'base' ? 'Flip the ken back first. ' : '') + describePlan(r, h.step); }
        else { state.hint = null; toast('No clean pop from here. Try moving the ken first.', 2.6); }
      }
    } else if (h.phase === 'show' && h.t > 9) state.hint = null;
  };

  // ---- Watch & Learn ----------------------------------------------------------------------------
  const startWatch = () => {
    freshWorld();
    state.mode = 'watch'; state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
    beginWatchTrick(null);
  };
  const beginWatchTrick = (last) => {
    const pool = WATCH_SET.filter((id) => id !== last);
    const id = aiRng.pick(pool);
    const tr = TRICK_BY_ID[id];
    const w = createWorld(); w.assist = state.settings.assist; settleHanging(w);
    state.w = w; rope = newRope(); state.parts = []; state.pops = [];
    state.trickId = id; state.trickName = tr.name; state.tr = newTracker(tr.steps);
    state.watch = { phase: 'think', t: 0, dur: state.thinkSecs, step: null, plan: null, arcs: [], note: '', tries: 0, lastId: id, iAt: 0 };
    beginThink();
  };
  const beginThink = () => {
    const wt = state.watch, tr = state.tr;
    wt.step = tr.steps[tr.i]; wt.iAt = tr.i;
    wt.phase = 'think'; wt.t = 0; wt.dur = state.thinkSecs; wt.plan = null; wt.arcs = [];
    wt.note = `Which pop lands the ${tgtName(wt.step.t).toLowerCase()}? Trying many arcs.`;
    planner = createPlanner(state.w, wt.step, aiRng.fork(), { want: 3, maxTries: 260 });
    ctl = null;
  };
  const updateWatch = (dt) => {
    const wt = state.watch;
    if (wt.phase === 'think') {
      wt.t += dt;
      if (planner && !planner.done) planner.step(1);
      if (planner) wt.arcs = planner.state.arcs;
      if (wt.t >= wt.dur) {
        if (planner && !planner.done && wt.t > wt.dur + 0.4) planner.finish();
        if (planner && planner.done) {
          const r = planner.result; planner = null;
          if (r) { wt.plan = r; wt.phase = 'reveal'; wt.t = 0; wt.dur = 2; wt.note = describePlan(r, wt.step); sfx.chime(2); }
          else if (++wt.tries >= 3) beginWatchTrick(wt.lastId);
          else { beginThink(); wt.note = 'No clean plan yet. Looking again.'; }
        }
      }
    } else if (wt.phase === 'reveal') {
      wt.t += dt;
      if (wt.t >= wt.dur) { wt.phase = 'act'; wt.t = 0; ctl = newCtl(state.w, wt.step, wt.plan.params); wt.note = 'Performing the plan.'; }
    } else if (wt.phase === 'act') {
      wt.t += dt;
      const r = stepCtl(state.w, ctl);
      simulateWorld(dt);
      if (state.tr.done) { wt.phase = 'celebrate'; wt.t = 0; wt.dur = 2.4; wt.note = `${state.trickName} landed. Another trick soon.`; sfx.win(); }
      else if (state.tr.i !== wt.iAt) beginThink();
      else if (r < 0) { toast('That one slipped. Thinking again.', 2); resetTry(state.tr); beginThink(); }
    } else if (wt.phase === 'celebrate') {
      simulateWorld(dt);
      wt.t += dt;
      if (wt.t >= wt.dur) beginWatchTrick(wt.lastId);
    }
  };

  // ---- the simulation tick (all modes) ----------------------------------------------------------
  const fireCatch = (id) => {
    const b = state.w.ball;
    const key = { 1: 'big', 2: 'small', 3: 'base', 4: 'spike' }[id];
    const col = { big: '#3f78e0', small: '#2fb592', spike: '#f0bd3c', base: '#9a67d8' }[key] ?? '#ffe08a';
    burstAt(state.parts, b.x, b.y, 18, col); ringAt(state.parts, b.x, b.y, col);
    return key;
  };
  const onTrackerEvent = (ev) => {
    const b = state.w.ball;
    if (ev.e === 'step') { sfx.chime(state.tr.i); fireCatch(b.on); say('Nice', b.x, b.y - 30); }
    else if (ev.e === 'lift') { sfx.chime(ev.n); say(`Lift ${ev.n}`, b.x, b.y - 30); ringAt(state.parts, b.x, b.y, '#ffe08a', 50); }
    else if (ev.e === 'drop') {
      sfx.drop(); say('Drop', b.x, b.y - 30, { col: '#ff9a88' });
      if (state.mode === 'run') onRunDrop();
      else if (state.mode === 'practice') state.pr.streak = 0;
    } else if (ev.e === 'done') {
      const key = fireCatch(b.on);
      if (state.mode === 'trick') finishTrick();
      else if (state.mode === 'watch') { burstAt(state.parts, b.x, b.y, 28); state.flash = 0.5; }
      else if (state.mode === 'run') onRunCatch(key);
      else if (state.mode === 'practice') onPracticeCatch(key);
    }
  };
  const finishTrick = () => {
    const tr = TRICK_BY_ID[state.trickId], drops = state.tr.drops, stars = starsFor(drops);
    const rec = state.record;
    const prev = rec.stars[state.trickId] | 0;
    if (stars > prev) rec.stars[state.trickId] = stars;
    rec.drops[state.trickId] = Math.min(rec.drops[state.trickId] ?? 99, drops);
    rec.starTotal = totalStars(rec);
    save();
    const i = TRICKS.findIndex((t) => t.id === state.trickId);
    const nx = TRICKS[i + 1];
    state.res = { kind: 'trick', id: state.trickId, name: tr.name, stars, drops, best: rec.stars[state.trickId], next: nx && trickOpen(nx, rec) && !(state.demo && nx.tier > 0) ? { id: nx.id, name: nx.name } : null };
    state.resT = 1.4; state.flash = 0.7; sfx.win();
    const b = state.w.ball; burstAt(state.parts, b.x, b.y, 40); say('Trick landed!', 360, 400, { size: 60, max: 1.8 });
  };
  const onRunCatch = (key) => {
    const run = state.run, b = state.w.ball;
    const i = run.offers.indexOf(key);
    state.tr = newTracker([{ t: 'any' }]); state.tr.lastStepOn = b.on; state.tr.leftT = 0;
    if (i < 0) { toast('That one was not on the menu: no points.', 2); return; }
    const pts = offerValue(run, i);
    run.pts += pts; run.chain++; run.catches++;
    say(`+${pts}`, b.x, b.y - 30, { size: 56 });
    dealOffers(run, runRng, key);
  };
  const onRunDrop = () => {
    const run = state.run;
    run.strikes++; const lost = run.pts; run.pts = 0; run.chain = 0;
    toast(lost ? `Dropped: ${lost} unbanked points lost.` : 'Dropped.', 2.2);
    state.tr = newTracker([{ t: 'any' }]);
    if (run.strikes >= RUN_STRIKES) endRun();
  };
  const bankRun = () => {
    const run = state.run;
    if (!run.pts) return;
    run.bank += run.pts; say(`Banked ${run.pts}`, 360, 300, { size: 48, col: '#9be8b4' }); run.pts = 0; run.chain = 0; sfx.chime(3);
    ringAt(state.parts, 360, 300, '#9be8b4', 90);
  };
  const endRun = () => {
    const run = state.run, rec = state.record;
    run.bank += run.pts; run.pts = 0; run.over = true;
    const newBest = run.bank > rec.runBest;
    if (newBest) rec.runBest = run.bank;
    rec.runs++; rec.catches += run.catches;
    save();
    state.res = { kind: 'run', bank: run.bank, best: rec.runBest, newBest, catches: run.catches };
    state.resT = 1.1; sfx.win();
  };
  const onPracticeCatch = () => {
    const pr = state.pr, b = state.w.ball;
    pr.catches++; pr.streak++; pr.best = Math.max(pr.best, pr.streak);
    state.record.catches++; state.record.practiceBest = Math.max(state.record.practiceBest | 0, pr.best);
    state.tr = newTracker([{ t: 'any' }]); state.tr.lastStepOn = b.on; state.tr.leftT = 0;
    say(`${pr.streak}`, b.x, b.y - 30);
  };

  const handleEvents = (ev) => {
    const w = state.w;
    for (let i = 0; i < ev.length; i += EVENT_STRIDE) {
      const t = ev[i], v = ev[i + 1];
      if (t === 1) { sfx.tok(v); if (v > 500) dustAt(state.parts, w.ball.x, w.ball.y + R * 0.6, 3); if (v > 900) { dustAt(state.parts, w.ball.x, w.ball.y + R * 0.6, 4); state.flash = Math.max(state.flash, 0.12); } }
      else if (t === 3) sfx.snap(v);
      else if (t === 4) sfx.wall();
      else if (t === 5) { sfx.ping(); burstAt(state.parts, w.ball.x, w.ball.y, 8, '#f0bd3c'); }
      else if (t === 2) sfx.tok(600);
    }
  };

  // advance the world one tick and judge it
  function simulateWorld(dt) {
    const w = state.w;
    const ev = stepWorld(w, dt);
    if (ev.length) handleEvents(ev);
    const an = anchorOf(w.ken, {}), b = w.ball, hm = { x: b.x + Math.cos(b.a) * R, y: b.y + Math.sin(b.a) * R };
    stepRope(rope, an.x, an.y, hm.x, hm.y);
    const e = stepTracker(state.tr, w, dt);
    if (e) onTrackerEvent(e);
  }

  // ---- the human hand ---------------------------------------------------------------------------
  const firePop = (charge, ang) => {
    const w = state.w, p = state.pop;
    p.active = true; p.t = 0; p.V = popSpeed(charge); p.ang = ang; p.p0 = { x: w.ken.x, y: w.ken.y }; p.holding = false;
    state.hint = null; hintPlanner = null;
    sfx.pop(charge);
    state.drag = null;
  };
  const updatePop = (dt) => {
    const p = state.pop;
    if (!p.active) return;
    p.t += dt;
    const q = throwPos(p.p0, { ang: p.ang, V: p.V, T: POP_T }, p.t);
    setHand(state.w, q.x, q.y);
    if (p.t >= POP_T + 0.12) p.active = false;
  };

  const updateHuman = (dt, input) => {
    const ptr = input.pointer, keys = input.keys, w = state.w, p = state.pop;
    const kx = (keys.down.has('ArrowRight') ? 1 : 0) - (keys.down.has('ArrowLeft') ? 1 : 0);
    const ky = (keys.down.has('ArrowDown') ? 1 : 0) - (keys.down.has('ArrowUp') ? 1 : 0);
    if (!p.active && (kx || ky) && !state.drag && !p.holding) setHand(w, w.ken.tx + kx * 14, w.ken.ty + ky * 14);
    if (keys.pressed.has('Space') && !p.active && !p.holding) { p.holding = true; p.charge = 0; p.key = true; }
    if (keys.pressed.has('KeyF')) { toggleFlip(w); sfx.flip(); state.hint = null; }
    if (keys.pressed.has('KeyH')) requestHint();
    if (keys.pressed.has('KeyB') && state.mode === 'run') bankRun();
    if (ptr.pressed) {
      if (inRect(POP_BTN, ptr.x, ptr.y)) { if (!p.active && !p.holding) { p.holding = true; p.charge = 0; p.key = false; } }
      else if (inRect(FLIP_BTN, ptr.x, ptr.y)) { toggleFlip(w); sfx.flip(); state.hint = null; }
      else if (inRect(HINT_BTN, ptr.x, ptr.y)) { if (state.mode === 'run') bankRun(); else requestHint(); sfx.tick(); }
      else if (inRect(MENU_BTN, ptr.x, ptr.y)) { openPause(); return; }
      else if (state.mode === 'practice' && inRect({ x: HUD.x + 24, y: HUD.y + 82, w: 250, h: 40 }, ptr.x, ptr.y)) {
        const order = ['big', 'small', 'spike', 'base']; state.pr.target = order[(order.indexOf(state.pr.target) + 1) % 4]; sfx.tick();
      } else if (inRect(PLAY_ZONE, ptr.x, ptr.y) && !p.active && !p.holding) {
        state.drag = { ox: w.ken.tx - ptr.x, oy: w.ken.ty - ptr.y, px: ptr.x, py: ptr.y };
      }
    }
    if (p.holding) {
      p.charge = clamp(p.charge + dt / 0.7, 0, 1);
      const released = p.key ? !keys.down.has('Space') : !ptr.down;
      if (released) { const lean = (keys.down.has('ArrowRight') ? 1 : 0) - (keys.down.has('ArrowLeft') ? 1 : 0); firePop(p.charge, lean * 0.3 + (popRng.next() - 0.5) * POP_WOBBLE); }
    }
    if (state.drag) {
      if (ptr.down && !p.active) {
        const d = state.drag;
        const tx = ptr.x + d.ox, ty = ptr.y + d.oy;
        const cx = clamp(tx, KEN_BOX.x0, KEN_BOX.x1), cy = clamp(ty, KEN_BOX.y0, KEN_BOX.y1);
        d.ox += cx - tx; d.oy += cy - ty;      // sticking at the edge: the finger and the ken stay together when it moves back
        d.px = ptr.x; d.py = ptr.y;
        setHand(w, cx, cy);
      }
      if (ptr.released || !ptr.down) state.drag = null;
    }
    updatePop(dt);
    if (state.hint && state.hint.phase === 'show' && state.drag) state.hint = null;
  };

  // ---- play ------------------------------------------------------------------------------------
  function openPause() { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.pop.holding = false; state.pop.charge = 0; state.drag = null; }
  function closePause() { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; }

  const updatePlay = (dt, input) => {
    const ptr = input.pointer, keys = input.keys;
    if (config.dev && keys.pressed.has('KeyK') && state.mode === 'trick' && !state.res) { state.tr.done = true; finishTrick(); }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (state.mode === 'watch') state.paused = !state.paused; else openPause(); }
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
    if (state.mode === 'watch') {
      if (ptr.pressed) {
        if (inRect(WATCH_BAR.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(WATCH_BAR.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); }
        else if (inRect(WATCH_BAR.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); }
        else if (inRect(WATCH_BAR.exit, ptr.x, ptr.y)) { leavePlay(); return; }
      }
      if (keys.pressed.has('Space')) state.paused = !state.paused;
      if (state.paused) return;            // pause freezes everything: planner, controller, physics, particles, timers
      tickCommon(dt);
      updateWatch(dt);
      return;
    }
    if (state.res) {
      state.resT -= dt;
      tickCommon(dt);
      simulateWorld(dt);
      if (state.resT <= 0) { state.scene = 'result'; state.ui.scroll = 0; }
      return;
    }
    if (state.paused) return;
    updateHuman(dt, input);
    updateHint(dt);
    tickCommon(dt);
    simulateWorld(dt);
  };
  // timers and effects that advance whenever the scene is running (never while paused)
  const tickCommon = (dt) => {
    stepParts(state.parts, dt); stepPetals(dt);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.flash > 0) state.flash -= dt;
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
  };

  // ---- menus -----------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag;
    const m = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && m.lay) {
      const max = Math.max(0, m.lay.contentH - (m.bottom - m.top));
      state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max);
    }
  }
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'p-assist') { state.settings.assist = (state.settings.assist + 1) % 3; state.w.assist = state.settings.assist; save(); }
    else if (id === 'p-restart') openTrick(state.trickId);
    else if (id === 'p-endrun') { closePause(); endRun(); }
    else if (id === 'quit') leavePlay();
  }
  const handleTitle = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'ladder') {
      state.scene = 'ladder'; state.ui.scroll = 0; state.ladderMsg = '';
      const nx = TRICKS.find((t) => trickOpen(t, state.record) && !(state.record.stars[t.id] | 0));
      state.ui.focusId = nx ? `t:${nx.id}` : null;
    } else if (id === 'run') startRun();
    else if (id === 'practice') startPractice();
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleLadder = (id) => {
    if (!id) return;
    sfx.tick();
    if (id.startsWith('t:')) {
      const tr = TRICK_BY_ID[id.slice(2)];
      if (!trickOpen(tr, state.record)) { const need = TIERS[tr.tier].need - totalStars(state.record); state.ladderMsg = `Earn ${need} more star${need === 1 ? '' : 's'} to open this row.`; return; }
      openTrick(tr.id);
    }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'as-dec') st.assist = Math.max(0, st.assist - 1);
    else if (id === 'as-inc') st.assist = Math.min(2, st.assist + 1);
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') { st.thinkIdx = Math.max(0, st.thinkIdx - 1); state.thinkSecs = THINK_STEPS[st.thinkIdx]; }
    else if (id === 'think-inc') { st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1); state.thinkSecs = THINK_STEPS[st.thinkIdx]; }
    else if (id === 'restore') {
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    state.w.assist = st.assist;
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const r = state.res;
    if (id === 'again') { if (r.kind === 'run') startRun(); else openTrick(r.id); }
    else if (id === 'next') openTrick(r.next.id);
    else if (id === 'ladder') { state.scene = 'ladder'; state.ui.scroll = 0; state.ladderMsg = ''; state.ui.focusId = `t:${r.id}`; }
    else if (id === 'menu') leavePlay();
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
    const m = flowMeta();
    const max = m.lay ? Math.max(0, m.lay.contentH - (m.bottom - m.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };
  const updateLadder = (dt, input) => {
    const ptr = input.pointer;
    if (input.keys.pressed.has('Escape')) { state.scene = 'title'; state.ui.scroll = 0; return; }
    if (ptr.pressed && inRect({ x: 20, y: 1164, w: 680, h: 100 }, ptr.x, ptr.y)) { state.scene = 'title'; state.ui.scroll = 0; return; }
    updateFlowScene(dt, input, handleLadder, 'ladder');
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

  resetAttract();

  // ---- screenshot mode (?shot=1): a scripted showcase chosen by the seed, no input ------------------
  const shotSetup = () => {
    if (config.seed >= 9 && config.seed <= 16) {               // review scenes at 300% text
      state.settings.textIdx = 4;
      const k = config.seed - 9;
      if (k === 0) return;
      if (k === 1) { state.scene = 'ladder'; state.record.stars = { big: 3, small: 2 }; return; }
      if (k === 2) { state.scene = 'settings'; return; }
      if (k === 3) { state.scene = 'rules'; state.page = 5; return; }
      if (k === 4) { openTrick('big'); state.tr.done = true; finishTrick(); state.resT = 0; state.scene = 'result'; return; }
      if (k === 5) { openTrick('big'); openPause(); return; }
      freshWorld(); state.res = { kind: 'run', bank: 128, best: 128, newBest: true, catches: 7 }; state.scene = 'result'; return;
    }
    const s = config.seed % 8;
    if (s === 1) return;                                   // title
    if (s === 2) { state.scene = 'ladder'; state.record.stars = { big: 3, small: 3, spike: 2, base: 2, lift3: 1 }; state.record.starTotal = totalStars(state.record); state.ui.focusId = 't:whirl'; return; }
    if (s === 3) { openTrick('big-small'); state.shotAuto = true; return; }
    if (s === 4) { startRun(); state.shotAuto = true; return; }
    if (s === 5) { startWatch(); return; }
    if (s === 6) { state.scene = 'rules'; state.page = 3; return; }
    if (s === 7) { openTrick('big-spike'); state.shotAuto = true; return; }
    startPractice(); state.shotAuto = true;
  };
  const shotAutoDrive = (dt) => {
    // plan synchronously and then perform, in the real mode (no think/reveal)
    if (!ctl) {
      const step = currentStep();
      const pl = createPlanner(state.w, step, aiRng.fork(), { want: 1, maxTries: 200 });
      while (!pl.done) pl.step(4);
      if (!pl.result) { autoSeq++; return; }
      ctl = newCtl(state.w, step, pl.result.params);
    }
    const r = stepCtl(state.w, ctl);
    simulateWorld(dt);
    if (r !== 0) { ctl = null; autoSeq++; }
  };
  if (SHOT) shotSetup();

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused game does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.mode !== 'watch') || state.paused,
    update(dt, input) {
      setPress(input.pointer);
      if (SHOT) {
        state.t += dt;
        if (state.scene === 'title') updateAttract(dt);
        if (state.scene === 'play') {
          tickCommon(dt);
          if (state.mode === 'watch') updateWatch(dt);
          else if (state.shotAuto && !state.res) shotAutoDrive(dt);
        }
        return;
      }
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene === 'title' && state.att) updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'ladder': updateLadder(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
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
        case 'ladder': renderLadder(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'result': renderResult(ctx, state, rope); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          renderPlay(ctx, state, rope, petals);
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
  };
}
