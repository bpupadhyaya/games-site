// Mas Wrestling: state and flow. The physics lives in sim.js, the computer athletes and the coach in ai.js, drawing in view.js,
// hud.js and menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto / about / rules, demolimit.
// A bout: 3-2-1, then each athlete pulls one vector with a thumb (drag left = back, up = lift, down = sink). First to win two bouts.
import { newBout, stepBout } from './sim.js';
import { PROFILES, createDriver, bestIntent, explain, peakVector, INTENTS } from './ai.js';
import { inRect, setSize, W, TEXT_DEC, TEXT_INC, TEXT_SCALES, THINK_STEPS, SETUP_PINS } from './layout.js';
import { drawStage, newPose, stepPose, HALLS, WORLD } from './view.js';
import { layoutFor, drawHud, drawMeters, drawButtons, drawPad, drawFingers, drawOverlays, drawCard, drawToast, cardRectFor, nextRect } from './hud.js';
import {
  renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderReason, renderPages, renderDemoLimit,
  hitScreen, flowMeta, READER, refCloseRect, ensureLayout, resetMenus, lockupZone, stepAttract, newAttract,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

// Fluid viewport: the short side is always 720 units; meta.width / meta.height follow the real screen.
export const wheelInput = { dy: 0 };
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_BOUT_CAP = 3;       // bouts of real play in the free web demo
const WATCH_TIME = 30;         // seconds of a Watch & Learn bout
const SHOT_MODE = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();
const PULL_R = 110;            // virtual units of thumb travel for a full pull
const DEAD = 0.09;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BLANK = () => ({ pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } });

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();

  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, reasonOpen: false, demo: !!config.demo,
    settings: { sound: true, textIdx: 0, thinkIdx: 1, compass: true },
    record: { matches: 0, wins: [0, 0, 0, 0, 0], lifts: 0, demoBouts: 0, fastestLift: 0, longest: 0 },
    setup: { mode: 'ai', opp: 1, hall: 'meadow' }, setupMsg: '',
    ui: { scroll: 0, drag: null }, page: 0,
    m: null, B: newBout(), pose: newPose(), looks: [0, 1], drivers: [null, null], phase: 'ready', ready: 3, endT: 0, hall: 'meadow',
    parts: [], pops: [], toast: '', toastT: 0, card: null, hint: null, hintT: 0, think: null, w: null, ff: false,
    fingers: [{ on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 }, { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 }],
    cheer: 0, shotMode: null, att: null, loaded: false, restoreMsg: '', wlabel: '',
  };
  Object.defineProperty(state, 'lay', { value: null, writable: true, enumerable: false });

  // ---- persistence -------------------------------------------------------------------------------------------
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

  // ---- sound -------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    count: (go) => tone({ freq: go ? 660 : 440, to: go ? 880 : 440, dur: go ? 0.28 : 0.1, type: 'triangle', vol: 0.12 }),
    snap: (v) => { tone({ freq: 150 + 60 * v, to: 70, dur: 0.12, type: 'triangle', vol: 0.1 }); tone({ freq: 1100, to: 500, dur: 0.04, type: 'square', vol: 0.02 }); },
    creak: (v) => tone({ freq: 240 + fx.next() * 60, to: 180, dur: 0.18, type: 'sawtooth', vol: 0.012 + 0.02 * v }),
    thud: () => tone({ freq: 110, to: 60, dur: 0.18, type: 'sine', vol: 0.16 }),
    spent: () => tone({ freq: 300, to: 160, dur: 0.25, type: 'triangle', vol: 0.07 }),
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.28 + i * 0.05, type: 'triangle', vol: 0.1 })),
    lose: () => [0, -3, -7].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.08 })),
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };

  // ---- particles -----------------------------------------------------------------------------------------------
  const MAX_PARTS = 120;
  const add = (q) => { if (state.parts.length < MAX_PARTS) state.parts.push(q); };
  const dust = (x, y, n, col = '#e7dcc0') => { for (let i = 0; i < n; i++) { const a = -Math.PI * (0.1 + fx.next() * 0.8), s = 30 + fx.next() * 90; add({ kind: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.4 + fx.next() * 0.4, size: 3 + fx.next() * 4, col }); } };
  const ring = (x, y, size, col) => add({ kind: 2, x, y, vx: 0, vy: 0, t: 0, max: 0.55, size, col });
  const confetti = (x, y, n) => { const cols = ['#ffd24a', '#d8582a', '#2f8f88', '#f4efe0', '#8be0d6']; for (let i = 0; i < n; i++) { const a = -Math.PI * fx.next(), s = 80 + fx.next() * 260; add({ kind: 3, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 1.2 + fx.next() * 0.8, size: 1, col: cols[fx.int(cols.length)], spin: 6 + fx.next() * 10 }); } };
  const stepParts = (dt) => {
    for (const q of state.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.97; q.vy = q.vy * 0.97 + (q.kind === 3 ? 260 : 120) * dt; }
    for (let i = state.parts.length - 1; i >= 0; i--) if (state.parts[i].t >= state.parts[i].max) state.parts.splice(i, 1);
  };
  const pop = (x, y, text, col, size = 38) => { state.pops.push({ x, y, text, col, size, t: 0, max: 1.3 }); if (state.pops.length > 5) state.pops.shift(); };

  // ---- the match ---------------------------------------------------------------------------------------------------
  const isAI = (i) => state.m.players[i].ai >= 0;
  function newMatch(cfg) {
    const mode = cfg.mode;
    let players;
    if (mode === 'watch') players = [{ name: PROFILES[cfg.a].name, ai: cfg.a, look: 1 + cfg.a }, { name: PROFILES[cfg.b].name, ai: cfg.b, look: 1 + cfg.b }];
    else if (mode === 'two') players = [{ name: 'Player 1', ai: -1, look: 0 }, { name: 'Player 2', ai: -1, look: 2 }];
    else players = [{ name: 'You', ai: -1, look: 0 }, { name: PROFILES[cfg.opp].name, ai: cfg.opp, look: 1 + cfg.opp }];
    return { cfg: { mode: 'ai', opp: 1, hall: 'meadow', ...cfg }, players, idx: 0, wins: [0, 0], results: [], over: null };
  }
  let lastCount = 4;
  function startBout() {
    const m = state.m;
    state.B = newBout(m.cfg.mode === 'watch' ? { limit: WATCH_TIME } : {});
    state.looks = m.players.map((p) => p.look);
    state.hall = m.cfg.hall;
    state.drivers = m.players.map((p) => (p.ai >= 0 ? createDriver(PROFILES[p.ai], aiRng.fork()) : null));
    state.phase = 'ready'; state.ready = 3; state.endT = 0; state.card = null; state.hint = null; state.hintT = 0; state.think = null;
    state.parts = []; state.pops = []; state.pose = newPose(); state.paused = false; state.pauseMenu = false; state.reasonOpen = false;
    state.w = m.cfg.mode === 'watch' ? { since: 0, last: [null, null], phase: 'run', side: 0, intent: 'gain', timer: 0 } : null;
    state.fingers.forEach((f) => { f.on = false; f.id = null; });
    state.wlabel = '';
    lastCount = 4;
    if (m.cfg.mode === 'watch') toast(`${m.players[0].name} against ${m.players[1].name}`, 2.2);
  }
  function startMatch(cfg) {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoBouts >= DEMO_BOUT_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.m = newMatch(cfg);
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.reasonOpen = false; state.ui.scroll = 0;
    startBout();
  }
  function startWatch() {
    const picks = [1, 2, 3, 4];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', a, b, hall: HALLS[aiRng.int(3)].id });
  }

  function endBout() {
    const m = state.m, B = state.B, o = B.over;
    state.phase = 'end'; state.endT = 0;
    m.wins[o.win]++; m.results.push({ win: o.win, how: o.how, t: o.t });
    const human = m.cfg.mode === 'ai' ? 0 : -1;
    const hx = WORLD.cx + (o.win === 0 ? 120 : -120);
    confetti(WORLD.cx, 250, o.win === human || m.cfg.mode !== 'ai' ? 46 : 14);
    if (o.how === 'lift') { dust(hx, WORLD.floorY - 40, 10); ring(hx, 290, 90, '#ffd24a'); }
    if (human === 0 && o.win !== 0) sfx.lose(); else sfx.win();
    if (m.cfg.mode !== 'watch') {
      state.record.demoBouts = (state.record.demoBouts | 0) + 1;
      if (o.win === human && o.how === 'lift') { state.record.lifts++; if (!state.record.fastestLift || o.t < state.record.fastestLift) state.record.fastestLift = Math.round(o.t * 10) / 10; }
      state.record.longest = Math.max(state.record.longest || 0, Math.round(o.t));
      save();
    }
    if (m.wins[o.win] >= 2) {
      m.over = { win: o.win, record: null };
      if (m.cfg.mode !== 'watch') {
        state.record.matches++;
        if (m.cfg.mode === 'ai' && o.win === 0) {
          const k = Math.min(4, m.cfg.opp);
          state.record.wins[k]++;
          m.over.record = `${PROFILES[m.cfg.opp].name} beaten ${state.record.wins[k]} time${state.record.wins[k] === 1 ? '' : 's'} in all.`;
        }
        save();
      }
    }
  }
  function afterBout() {
    const m = state.m;
    if (m.over) { state.scene = 'result'; state.ui.scroll = 0; return; }
    if (state.demo && m.cfg.mode !== 'watch' && state.record.demoBouts >= DEMO_BOUT_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    m.idx++; startBout();
  }

  // ---- the fingers -------------------------------------------------------------------------------------------------
  // Each finger has a floating origin: a drag farther than PULL_R drags the origin along, so the thumb never runs out of room.
  function readFingers(input) {
    const lay = state.lay, two = state.m.cfg.mode === 'two';
    const list = env.multi ? env.multi.list() : (input.pointer.down ? [{ id: 0, x: input.pointer.x, y: input.pointer.y }] : []);
    const used = new Set();
    const onButton = (x, y) => Object.values(lay.btn).some((r) => inRect(r, x, y)) || (state.card && inRect(cardRectFor(lay), x, y));
    for (const tch of list) {
      const id = tch.id === undefined ? 0 : tch.id;
      let f = state.fingers.find((q) => q.on && q.id === id);
      if (!f) {
        if (onButton(tch.x, tch.y)) continue;
        const side = !two ? 0 : tch.x < W / 2 ? 0 : 1;
        const slot = state.fingers[side];
        if (slot.on) continue;
        Object.assign(slot, { on: true, id, side, ox: tch.x, oy: tch.y, x: tch.x, y: tch.y });
        f = slot;
      }
      used.add(f);
      f.x = tch.x; f.y = tch.y;
      const dx = f.x - f.ox, dy = f.y - f.oy, d = Math.hypot(dx, dy);
      if (d > PULL_R) { f.ox = f.x - (dx / d) * PULL_R; f.oy = f.y - (dy / d) * PULL_R; }
    }
    for (const f of state.fingers) if (f.on && !used.has(f)) { f.on = false; f.id = null; }
  }
  function humanCmd(i, keys) {
    let b = 0, u = 0;
    const two = state.m.cfg.mode === 'two';
    const f = state.fingers[two ? i : 0];
    if (f.on) {
      let dx = (f.x - f.ox) / PULL_R, dy = (f.y - f.oy) / PULL_R;
      const mag = Math.hypot(dx, dy);
      if (mag > 1) { dx /= mag; dy /= mag; }
      if (Math.hypot(dx, dy) > DEAD) { b = Math.max(0, i === 0 ? -dx : dx); u = -dy; }
    }
    const kk = keys.down;
    const kb = i === 0 ? 'ArrowLeft' : 'KeyJ', ku = i === 0 ? 'ArrowUp' : 'KeyI', kd = i === 0 ? 'ArrowDown' : 'KeyK';
    if (kk.has(kb)) b = 1;
    if (kk.has(ku)) u = 1;
    if (kk.has(kd)) u = -1;
    if (i === 0 && kk.has('Space')) b = Math.max(b, 0.9);
    return { b: clamp(b, 0, 1), u: clamp(u, -1, 1) };
  }

  // ---- the bout in motion --------------------------------------------------------------------------------------------
  function events(B) {
    for (const e of B.ev) {
      if (e.k === 'snap') {
        const x = WORLD.cx + (e.side === 0 ? -70 : 70);
        dust(x, WORLD.floorY - 18, 4); sfx.snap(e.v);
        if (e.v > 0.7 && (state.m.cfg.mode === 'ai' ? e.side === 0 : true)) pop(x, 270, 'Snap!', '#ffe27a', 34);
        state.cheer = Math.min(1, state.cheer + 0.2);
      } else if (e.k === 'spent') {
        pop(WORLD.cx + (e.side === 0 ? -200 : 200), 230, 'Spent!', '#ff8a70', 32); sfx.spent();
      } else if (e.k === 'extra') { toast('Level! Ten seconds of extra time', 2.6); sfx.thud(); }
    }
  }
  function stepFight(dt, input) {
    const B = state.B;
    const cmds = [null, null];
    for (let i = 0; i < 2; i++) cmds[i] = isAI(i) ? state.drivers[i].cmd(B, i, dt) : humanCmd(i, input.keys);
    stepBout(B, dt, cmds);
    B.clock += dt;
    if (((B.clock * 60) | 0) % 24 === 0 && Math.max(B.side[0].m, B.side[1].m) > 0.7) sfx.creak(Math.max(B.side[0].m, B.side[1].m));
    events(B);
    if (B.over) endBout();
  }

  // ---- Think (the coach) and Watch & Learn --------------------------------------------------------------------------
  function openThink() {
    if (state.phase !== 'fight' || state.m.cfg.mode !== 'ai' || state.paused) return;
    const B = state.B, { intent } = bestIntent(B, 0);
    const ex = explain(B, 0, intent);
    const hint = INTENTS[intent].hint;
    state.card = { title: `Think: ${ex.title}`, text: `${ex.reason} (${hint.charAt(0).toUpperCase()}${hint.slice(1)}.)`, sticky: true };
    state.hint = { side: 0, ...peakVector(intent) };
    state.paused = true; state.think = { coach: true };
    sfx.tick();
  }
  function closeThink() {
    state.card = null; state.paused = false; state.think = null; state.hintT = 2.6; sfx.tick();
  }
  // Returns true while the bout is held for an athlete to think.
  function updateWatch(dt) {
    const w = state.w, B = state.B;
    if (w.phase === 'think' || w.phase === 'reveal') {
      w.timer -= dt * (state.ff ? 3 : 1);
      if (w.phase === 'think' && w.timer <= 0) {
        w.phase = 'reveal'; w.timer = 2;
        const ex = explain(B, w.side, w.intent);
        const name = state.m.players[w.side].name;
        state.card = { title: `${name}: ${ex.title}`, text: ex.reason, sticky: true };
        state.hint = { side: w.side, ...peakVector(w.intent) };
        state.wlabel = `${name} will: ${ex.title}`;
      } else if (w.phase === 'reveal' && w.timer <= 0) {
        w.phase = 'run'; w.since = 0; w.last[w.side] = w.intent;
        const d = state.drivers[w.side]; d.intent = w.intent; d.hold = 2.6;
        state.card = null; state.hint = null; state.wlabel = '';
      }
      return true;
    }
    w.since += dt;
    if (w.since > 4.5 && B.t > 2) {
      const s = (Math.floor(B.t / 4.5)) % 2;
      const { intent } = bestIntent(B, s);
      if (intent !== w.last[s] && intent !== state.drivers[s].intent) {
        w.phase = 'think'; w.side = s; w.intent = intent; w.timer = THINK_STEPS[state.settings.thinkIdx];
        state.wlabel = `${state.m.players[s].name} is thinking…`;
        return true;
      }
      w.since = 3.2;
    }
    return false;
  }

  // ---- the play scene ------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.reasonOpen = false; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leaveMatch = () => {
    state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.reasonOpen = false; state.ui.scroll = 0;
    state.think = null; state.card = null; state.hint = null; state.fingers.forEach((f) => { f.on = false; });
  };
  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  }
  function modalInput(ptr, key, handler) {
    ensureLayout(state, key);
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      if (d.moved < 10 && flowMeta().key === key) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
    }
  }
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    const st = state.settings;
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'p-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); save(); }
    else if (id === 'p-compass') { st.compass = !st.compass; save(); }
    else if (id === 'p-txtdec') { st.textIdx = Math.max(0, st.textIdx - 1); save(); }
    else if (id === 'p-txtinc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); save(); }
    else if (id === 'quit') leaveMatch();
  }

  function updatePlay(dt, input) {
    const m = state.m, ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch';
    const lay = layoutFor(state);
    state.lay = lay;
    // the free-preview pill sits in the top-left corner of the bout picture, clear of the scoreboard
    meta.previewBadge = { x: lay.stage.x + 10, y: lay.stage.y + 8, align: 'left' };
    if (config.dev && keys.pressed.has('KeyL') && state.phase === 'fight') state.B.h = 0.995;
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) {
      if (state.pauseMenu) closePause();
      else if (state.reasonOpen) state.reasonOpen = false;
      else if (state.think && state.think.coach) closeThink();
      else if (watch) state.paused = !state.paused;
      else openPause();
    }
    if (state.pauseMenu) { modalInput(ptr, 'pause', handlePauseTap); return; }
    if (state.reasonOpen) { modalInput(ptr, 'reason', (id) => { if (id === 'reason-close') state.reasonOpen = false; }); return; }

    const b = lay.btn;
    if (ptr.pressed) {
      const hit = (id) => b[id] && inRect(b[id], ptr.x, ptr.y);
      if (state.card && inRect(cardRectFor(lay), ptr.x, ptr.y)) {
        if (state.think && state.think.coach) closeThink(); else { state.reasonOpen = true; state.ui.scroll = 0; }
        return;
      }
      if (hit('menu')) { if (state.phase !== 'end') openPause(); sfx.tick(); return; }
      else if (hit('think')) { if (state.think && state.think.coach) closeThink(); else openThink(); return; }
      else if (hit('pause')) { state.paused = !state.paused; sfx.tick(); return; }
      else if (hit('fast')) { state.ff = !state.ff; sfx.tick(); return; }
      else if (hit('dec')) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); return; }
      else if (hit('inc')) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); return; }
      else if (hit('exit')) { leaveMatch(); return; }
      else if (state.phase === 'end' && state.endT > 0.7 && !watch && inRect(nextRect(lay), ptr.x, ptr.y)) { sfx.tick(); afterBout(); return; }
    }
    if (keys.pressed.has('KeyT') && !watch) { if (state.think && state.think.coach) closeThink(); else openThink(); }
    if (state.phase === 'end' && !watch && state.endT > 0.7 && (keys.pressed.has('Enter') || keys.pressed.has('Space'))) { afterBout(); return; }

    if (!watch && !state.paused) readFingers(input);
    if (state.paused) return;
    state.cheer = Math.max(0, state.cheer - dt * 0.6);
    stepParts(dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.hintT > 0) { state.hintT -= dt; if (state.hintT <= 0) state.hint = null; }
    const ticks = state.ff ? 3 : 1;
    for (let k = 0; k < ticks; k++) {
      if (state.phase === 'ready') {
        state.ready -= dt;
        const n = Math.ceil(state.ready);
        if (n < lastCount && n > 0) { lastCount = n; sfx.count(false); }
        if (state.ready <= 0) { state.phase = 'fight'; sfx.count(true); pop(WORLD.cx, 220, 'Pull!', '#ffe27a', 54); }
      } else if (state.phase === 'fight') {
        if (watch && updateWatch(dt)) break;
        stepFight(dt, input);
        if (state.phase === 'end') break;
      } else if (state.phase === 'end') {
        state.endT += dt;
        if (watch && state.endT > 3.6) { afterBout(); break; }
      }
    }
    if (state.scene === 'play') stepPose(state.pose, state.B, dt, state.B.over);
  }

  // ---- rendering ---------------------------------------------------------------------------------------------------------
  function renderPlay(ctx) {
    const lay = layoutFor(state);
    state.lay = lay;
    drawStage(ctx, lay.stage, {
      hall: state.hall, t: state.t, B: state.B, pose: state.pose, looks: state.looks.map((i) => i), parts: state.parts, pops: state.pops,
      hint: state.hint, cheer: state.cheer,
    });
    drawHud(ctx, state, lay);
    drawMeters(ctx, state, lay);
    drawPad(ctx, state, lay);
    drawButtons(ctx, state, lay);
    drawOverlays(ctx, state, lay);
    drawCard(ctx, state, lay);
    drawToast(ctx, state, lay);
    if (state.m.cfg.mode === 'watch' && state.wlabel && !state.card) {
      const s = lay.stage; ctx.save(); ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(14, Math.round(lay.fs * 0.8))}px system-ui, sans-serif`;
      const w = Math.min(s.w - 20, ctx.measureText(state.wlabel).width + 30);
      ctx.fillStyle = 'rgba(4,22,26,0.8)'; ctx.fillRect(s.x + s.w / 2 - w / 2, s.y + s.h - 56, w, 36);
      ctx.fillStyle = '#ffd24a'; ctx.fillText(state.wlabel, s.x + s.w / 2, s.y + s.h - 31); ctx.restore();
    }
    if (state.paused && !state.pauseMenu && !state.think && state.phase !== 'ready') {
      const s = lay.stage; ctx.save(); ctx.fillStyle = 'rgba(2,14,16,0.45)'; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.textAlign = 'center'; ctx.fillStyle = '#f3f8f2'; ctx.font = `800 ${Math.round(lay.fs * 1.6)}px system-ui, sans-serif`; ctx.fillText('Paused', s.x + s.w / 2, s.y + s.h / 2); ctx.restore();
    }
    if (state.shotMode && state.fingers[0]?.on && lay.pad.h > 60) {   // store shots: the thumb rests inside the pad at every size
      const f = state.fingers[0], pd = lay.pad;
      f.ox = pd.x + pd.w * 0.6; f.oy = pd.y + pd.h * 0.62; f.x = f.ox - Math.min(70, pd.w * 0.12); f.y = f.oy - Math.min(40, pd.h * 0.12);
    }
    drawFingers(ctx, state);
  }

  // ---- menus ---------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'play') { state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('mode-')) { s.mode = id.slice(5); state.setupMsg = ''; }
    else if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id.startsWith('hall-')) { const v = id.slice(5); if (state.demo && v !== 'meadow') { state.setupMsg = 'That hall is in the full game.'; return; } s.hall = v; state.setupMsg = ''; }
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, hall: s.hall });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-compass') st.compass = !st.compass;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.m.cfg;
    if (id === 'again') { if (cfg.mode === 'watch') startWatch(); else startMatch({ ...cfg }); }
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
      const lay = flowMeta(), scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (wheelInput.dy) { state.ui.scroll = clamp(state.ui.scroll + wheelInput.dy, 0, max); wheelInput.dy = 0; }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
    void dt;
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) { handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.page = 0; state.ui.scroll = 0; state.ui.drag = null; };
    const setScroll = (v) => { state.ui.scroll = clamp(v, 0, READER.max); };
    if (ptr.pressed) {
      if (inRect(refCloseRect(), ptr.x, ptr.y)) { close(); return; }
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
      else if (ptr.y >= READER.y0 && ptr.y <= READER.y1) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll };
    }
    if (state.ui.drag && ptr.down) setScroll(state.ui.drag.s0 - (ptr.y - state.ui.drag.y0));
    if (ptr.released) state.ui.drag = null;
    if (wheelInput.dy) { setScroll(state.ui.scroll + wheelInput.dy); wheelInput.dy = 0; }
    const step = 70, pgs = Math.max(100, READER.view - 80);
    if (keys.pressed.has('ArrowDown')) setScroll(state.ui.scroll + step);
    if (keys.pressed.has('ArrowUp')) setScroll(state.ui.scroll - step);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) setScroll(state.ui.scroll + pgs);
    if (keys.pressed.has('PageUp')) setScroll(state.ui.scroll - pgs);
    if (keys.pressed.has('Home')) setScroll(0);
    if (keys.pressed.has('End')) setScroll(READER.max);
    if (keys.pressed.has('Escape') || keys.pressed.has('Enter')) close();
  };

  // ---- showcase (store screenshots: ?shot=1 renders a scripted, real position instead of the random player) ---------------
  const SHOWCASE = [
    { hall: 'meadow', opp: 1, x: 0.28, h: 0.15, st: [0.74, 0.55], gr: [0.8, 0.62], vec: [[0.8, 0.2], [0.5, 0]], t: 21, fing: true },
    { hall: 'winter', opp: 3, x: 0.42, h: 0.78, st: [0.58, 0.31], gr: [0.7, 0.4], vec: [[0.4, 0.95], [0.1, -0.7]], t: 24, think: true },
    { hall: 'arena', opp: 4, x: -0.2, h: -0.35, st: [0.46, 0.8], gr: [0.52, 0.85], vec: [[0.9, 0], [0.9, 0.3]], t: 30, fing: true },
    { hall: 'meadow', opp: 2, x: 0.05, h: 0.1, st: [0.12, 0.42], gr: [0.4, 0.66], vec: [[0.1, -0.5], [0.9, 0.2]], t: 33 },
    { hall: 'winter', opp: 0, x: 0.6, h: 0.5, st: [0.6, 0.6], gr: [0.7, 0.2], vec: [[0.5, 0.8], [0.2, -0.9]], t: 12 },
    { hall: 'arena', opp: 2, x: 0.5, h: 1, st: [0.4, 0.7], gr: [0.4, 0.6], vec: [[0.3, 1], [0.2, 0]], t: 28, end: true },
  ];
  function setupShowcase(kind) {
    const sc = SHOWCASE[kind % SHOWCASE.length];
    state.m = newMatch({ mode: 'ai', opp: sc.opp, hall: sc.hall });
    state.scene = 'play';
    startBout();
    const B = state.B;
    state.phase = 'fight'; state.ready = 0;
    B.t = sc.t; B.x = sc.x; B.h = sc.h;
    for (let i = 0; i < 2; i++) {
      const s = B.side[i];
      s.st = sc.st[i]; s.gr = sc.gr[i]; s.vec = { b: sc.vec[i][0], u: sc.vec[i][1] }; s.cmd = { ...s.vec };
      s.m = Math.hypot(sc.vec[i][0], Math.max(0, sc.vec[i][1])); s.mSlow = 0.3; s.snap = 0.3;
    }
    for (let i = 0; i < 60; i++) stepPose(state.pose, B, 1 / 30, null);
    state.m.wins = [kind % 2, kind % 3 === 0 ? 1 : 0];
    if (sc.think) { const ex = explain(B, 0, 'lift'); state.card = { title: `Think: ${ex.title}`, text: ex.reason, sticky: true }; state.hint = { side: 0, ...peakVector('lift') }; }
    if (sc.end) {
      B.over = { win: 0, how: 'lift', t: B.t, x: B.x, h: B.h };
      state.m.wins[0] = 1; state.m.results.push({ win: 0, how: 'lift', t: B.t });
      state.phase = 'end'; state.endT = 2;
      for (let i = 0; i < 60; i++) stepPose(state.pose, B, 1 / 30, B.over);
      confetti(WORLD.cx, 240, 40); for (const p of state.parts) p.t += 0.25;
    } else {
      dust(WORLD.cx - 70, WORLD.floorY - 18, 6); pop(WORLD.cx - 70, 290, 'Snap!', '#ffe27a', 34);
      state.pops[0].t = 0.25; for (const p of state.parts) p.t += 0.15;
    }
    if (sc.fing) state.fingers[0] = { on: true, id: 0, ox: 200, oy: 1010, x: 120, y: 960 };
    state.shotMode = { kind };
  }
  function finishDemoResult() {
    state.m = newMatch({ mode: 'ai', opp: 2, hall: 'winter' });
    state.m.wins = [2, 1]; state.m.results = [{ win: 0, how: 'lift', t: 18 }, { win: 1, how: 'grip', t: 31 }, { win: 0, how: 'points', t: 45 }];
    state.m.over = { win: 0, record: 'Eder beaten 1 time in all.' };
    state.scene = 'result';
  }
  state.att = newAttract(rng.fork());
  resetMenus();
  if (SHOT_MODE) {
    setupShowcase((Number(config.seed) | 0) % SHOWCASE.length);
    const q = (k) => { try { const mm = new RegExp(`[?&]${k}=([a-z0-9]+)`).exec(globalThis.location.search); return mm ? mm[1] : null; } catch { return null; } };
    if (q('zoom')) state.settings.textIdx = clamp(Number(q('zoom')) | 0, 0, 4);
    const v = q('view');
    if (v) {
      state.shotMode = v === 'pause' ? state.shotMode : null;
      if (v === 'pause') openPause();
      else if (v === 'result') finishDemoResult();
      else if (v === 'rules' || v === 'about' || v === 'howto') { state.scene = v; state.back = 'title'; state.page = 0; state.ui.scroll = (Number(q('page')) | 0) * 900; }
      else if (v === 'watch') { startWatch(); state.shotMode = null; }
      else if (v === 'two') {
        state.shotMode = null; startMatch({ mode: 'two', hall: 'arena' }); state.phase = 'fight'; state.ready = 0; state.B.x = 0.2; state.B.h = -0.2;
        for (let i = 0; i < 2; i++) { state.B.side[i].vec = { b: 0.6, u: i ? 0.5 : 0.1 }; }
        for (let i = 0; i < 60; i++) stepPose(state.pose, state.B, 1 / 30, null);
      } else state.scene = v;
    }
    const adv = Number(q('ticks')) | 0;
    if (adv > 0 && state.scene === 'play') for (let i = 0; i < adv; i++) { state.t += 1 / 60; updatePlay(1 / 60, BLANK()); }
  }

  return {
    // Watch & Learn and every menu are free; only real bouts count against the free preview (a paused bout or a countdown does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch' && state.phase === 'fight') || state.paused,
    update(dt, input) {
      if (SHOT_MODE) input = BLANK();
      setSize(meta.width, meta.height);
      config.textScale = TEXT_SCALES[state.settings.textIdx];
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') stepAttract(state.att, dt);
      if (state.shotMode) return;
      switch (state.scene) {
        case 'title': if (input.keys.pressed.has('Enter')) { handleTitle('play'); break; } updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
      wheelInput.dy = 0;
    },
    render(ctx, view) {
      setSize(view?.width ?? meta.width, view?.height ?? meta.height);
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
          if (state.m) renderPlay(ctx);
          if (state.pauseMenu) renderPause(ctx, state);
          else if (state.reasonOpen) renderReason(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    // Licence credits of the optional 3D library (fetched by main.js): appended once as the last About page.
    setCredits(text) {
      if (ABOUT.some((s) => s.title === 'Credits')) return;
      const clean = (l) => l.replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/`/g, '').replace(/^\*\s+/, '').trim();
      const paras = String(text).split(/\n\s*\n/).map((b) => b.split('\n').map(clean).filter(Boolean).join(' ')).filter((b) => b && !/^Games that ship/.test(b));
      ABOUT.push({ title: 'Credits', p: paras });
    },
    lockupZone: () => lockupZone(),
  };
}
