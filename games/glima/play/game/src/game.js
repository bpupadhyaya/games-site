// Glima: state and flow. The physics lives in sim.js, the computer athletes and the coach in ai.js, drawing in view.js,
// hud.js and menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto / about / rules, demolimit.
// A round: 3-2-1, then each athlete steers its weight with a thumb (drag left or right) and taps to hook. First to win two rounds.
import { newRound, stepRound, ROUND_TIME } from './sim.js';
import { PROFILES, createDriver, bestIntent, explain, peakSteer, INTENTS } from './ai.js';
import { inRect, setSize, W, TEXT_DEC, TEXT_INC, TEXT_SCALES, THINK_STEPS, SETUP_PINS } from './layout.js';
import { drawStage, drawStage3D, newPose, stepPose, RINGS, WORLD, footBase } from './view.js';
import { layoutFor, drawHud, drawMeters, drawButtons, drawPad, drawFingers, drawOverlays, drawCard, drawToast, cardRectFor, nextRect, hookRects } from './hud.js';
import {
  renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderReason, renderPages, renderDemoLimit,
  hitScreen, flowMeta, READER, refCloseRect, ensureLayout, resetMenus, lockupZone, stepAttract, newAttract,
} from './menus.js';
import { ABOUT, HOWTO, RULES, creditSections } from './content.js';
import { setPress } from './ui.js';

// Fluid viewport: the short side is always 720 units; meta.width / meta.height follow the real screen.
export const wheelInput = { dy: 0 };
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_BOUT_CAP = 3;       // rounds of real play in the free web demo
const WATCH_TIME = 30;         // seconds of a Watch & Learn round
const SHOT_MODE = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();
const AUTOWATCH = (() => { try { return /[?&]autowatch=1/.test(globalThis.location.search); } catch { return false; } })();   // dev: open straight into Watch & Learn
const PULL_R = 100;            // virtual units of thumb travel for a full steer
const DEAD = 0.1;
const TAP_TRAVEL = 26, TAP_TIME = 0.32, HOOK_BUFFER = 0.18;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BLANK = () => ({ pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } });

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const gl = env.gl || null;
  const credits = env.credits || { text: '' };   // licence text of the 3D layer (filled by main.js)
  let aboutList = ABOUT, aboutFor = '';   // the 3D presenter's read-only channel (gl.on, gl.p3); null when there is no 3D layer
  const fx = rng.fork();
  const aiRng = rng.fork();

  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, reasonOpen: false, demo: !!config.demo,
    settings: { sound: true, textIdx: 0, thinkIdx: 1, cues: true },
    record: { matches: 0, wins: [0, 0, 0, 0, 0], falls: 0, demoBouts: 0, fastestFall: 0, longest: 0 },
    setup: { mode: 'ai', opp: 1, ring: 'turf' }, setupMsg: '',
    ui: { scroll: 0, drag: null }, page: 0,
    m: null, B: newRound(), pose: newPose(), looks: [0, 1], drivers: [null, null], phase: 'ready', ready: 3, endT: 0, ring: 'turf', hookBuf: null,
    parts: [], pops: [], toast: '', toastT: 0, card: null, hint: null, hintT: 0, think: null, w: null, ff: false,
    fingers: [0, 1, 2].map(() => ({ on: false, id: null, steer: false, ox: 0, oy: 0, x: 0, y: 0, t0: 0, travel: 0 })),
    cheer: 0, shotMode: null, att: null, loaded: false, restoreMsg: '', wlabel: '',
  };
  Object.defineProperty(state, 'lay', { value: null, writable: true, enumerable: false });
  Object.defineProperty(state, 'g3', { value: null, writable: true, enumerable: false });

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
    whoosh: () => { tone({ freq: 700, to: 220, dur: 0.18, type: 'sawtooth', vol: 0.025 }); },
    thud: () => { tone({ freq: 120, to: 55, dur: 0.2, type: 'sine', vol: 0.17 }); tone({ freq: 900, to: 400, dur: 0.05, type: 'square', vol: 0.02 }); },
    foot: () => tone({ freq: 95 + fx.next() * 20, to: 70, dur: 0.06, type: 'sine', vol: 0.03 }),
    miss: () => tone({ freq: 330, to: 170, dur: 0.22, type: 'triangle', vol: 0.07 }),
    clash: () => { tone({ freq: 200, to: 140, dur: 0.12, type: 'square', vol: 0.05 }); },
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.28 + i * 0.05, type: 'triangle', vol: 0.1 })),
    lose: () => [0, -3, -7].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.08 })),
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };

  // ---- particles -----------------------------------------------------------------------------------------------
  const MAX_PARTS = 120;
  const add = (q) => { if (state.parts.length < MAX_PARTS) state.parts.push(q); };
  const dust = (x, y, n, col = '#f0ead6') => { for (let i = 0; i < n; i++) { const a = -Math.PI * (0.1 + fx.next() * 0.8), s = 30 + fx.next() * 90; add({ kind: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.4 + fx.next() * 0.4, size: 3 + fx.next() * 4, col }); } };
  const ring = (x, y, size, col) => add({ kind: 2, x, y, vx: 0, vy: 0, t: 0, max: 0.55, size, col });
  const confetti = (x, y, n) => { const cols = ['#ffd24a', '#d9583a', '#5aa0e0', '#f4efe0', '#9fe7ff']; for (let i = 0; i < n; i++) { const a = -Math.PI * fx.next(), s = 80 + fx.next() * 260; add({ kind: 3, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 1.2 + fx.next() * 0.8, size: 1, col: cols[fx.int(cols.length)], spin: 6 + fx.next() * 10 }); } };
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
    else players = [{ name: 'You', ai: -1, look: 0 }, { name: PROFILES[cfg.opp].name, ai: cfg.opp, look: 1 + cfg.opp }];
    return { cfg: { mode: 'ai', opp: 1, ring: 'turf', ...cfg }, players, idx: 0, wins: [0, 0], results: [], over: null };
  }
  let lastCount = 4;
  function startBout() {
    const m = state.m;
    const sw = () => ({ f: 0.55 + aiRng.next() * 0.3, ph: aiRng.next() * 6.28 });
    state.B = newRound({ sway: [sw(), sw()], ...(m.cfg.mode === 'watch' ? { limit: WATCH_TIME } : {}) });
    state.looks = m.players.map((p) => p.look);
    state.ring = m.cfg.ring;
    state.hookBuf = null;
    state.drivers = m.players.map((p) => (p.ai >= 0 ? createDriver(PROFILES[p.ai], aiRng.fork()) : null));
    state.phase = 'ready'; state.ready = 3; state.endT = 0; state.card = null; state.hint = null; state.hintT = 0; state.think = null;
    state.parts = []; state.pops = []; state.pose = newPose(); state.paused = false; state.pauseMenu = false; state.reasonOpen = false;
    state.w = m.cfg.mode === 'watch' ? { since: 0, last: [null, null], phase: 'run', side: 0, intent: null, timer: 0 } : null;
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
    startMatch({ mode: 'watch', a, b, ring: RINGS[aiRng.int(3)].id });
  }

  function endBout() {
    const m = state.m, B = state.B, o = B.over;
    state.phase = 'end'; state.endT = 0;
    m.wins[o.win]++; m.results.push({ win: o.win, how: o.how, t: o.t });
    const human = m.cfg.mode === 'ai' ? 0 : -1;
    confetti(WORLD.cx, WORLD.cy - 80, o.win === human || m.cfg.mode !== 'ai' ? 46 : 14);
    if (o.how === 'fall') { const f = footBase(o.loser, 1, B); dust(f.x, f.y, 12); ring(f.x, f.y, 90, '#ffd24a'); }
    if (human === 0 && o.win !== 0) sfx.lose(); else sfx.win();
    if (m.cfg.mode !== 'watch') {
      state.record.demoBouts = (state.record.demoBouts | 0) + 1;
      if (o.win === human && o.how === 'fall') { state.record.falls++; if (!state.record.fastestFall || o.t < state.record.fastestFall) state.record.fastestFall = Math.round(o.t * 10) / 10; }
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
  // The steering finger has a floating origin: a drag farther than PULL_R drags the origin along, so the thumb never runs out of room.
  // A touch that lifts quickly without travelling is a TAP: it hooks with the foot on that side of the picture. Touching a hook pad
  // hooks at once.
  const queueHook = (sgn) => { state.hookBuf = { s: sgn, t: HOOK_BUFFER }; };
  function readFingers(input) {
    const lay = state.lay, hr = hookRects(lay);
    const list = env.multi ? env.multi.list() : (input.pointer.down ? [{ id: 0, x: input.pointer.x, y: input.pointer.y }] : []);
    const ids = new Set(list.map((q) => (q.id === undefined ? 0 : q.id)));
    const onButton = (x, y) => Object.values(lay.btn).some((r) => inRect(r, x, y)) || (state.card && inRect(cardRectFor(lay), x, y));
    for (const f of state.fingers) {
      if (f.on && !ids.has(f.id)) {
        if (f.steer && f.travel < TAP_TRAVEL && state.t - f.t0 < TAP_TIME && state.phase === 'fight') queueHook(f.x < lay.stage.x + lay.stage.w / 2 ? -1 : 1);
        f.on = false; f.id = null; f.steer = false;
      }
    }
    for (const tch of list) {
      const id = tch.id === undefined ? 0 : tch.id;
      let f = state.fingers.find((q) => q.on && q.id === id);
      if (!f) {
        if (onButton(tch.x, tch.y)) continue;
        const slot = state.fingers.find((q) => !q.on);
        if (!slot) continue;
        const pad = inRect(hr.L, tch.x, tch.y) ? -1 : inRect(hr.R, tch.x, tch.y) ? 1 : 0;
        Object.assign(slot, { on: true, id, steer: !pad, ox: tch.x, oy: tch.y, x: tch.x, y: tch.y, t0: state.t, travel: 0 });
        if (pad && state.phase === 'fight') { queueHook(pad); sfx.tick(); }
        f = slot;
      }
      f.x = tch.x; f.y = tch.y;
      if (!f.steer) continue;
      const dx = f.x - f.ox;
      f.travel = Math.max(f.travel, Math.hypot(f.x - f.ox, f.y - f.oy));
      if (Math.abs(dx) > PULL_R) f.ox = f.x - Math.sign(dx) * PULL_R;
    }
  }
  function humanCmd(keys) {
    let steer = 0, hook = 0;
    const f = state.fingers.find((q) => q.on && q.steer);
    if (f) { const d = (f.x - f.ox) / PULL_R; if (Math.abs(d) > DEAD) steer = clamp(d, -1, 1); }
    const kk = keys.down, kp = keys.pressed;
    if (kk.has('ArrowLeft')) steer = -1;
    if (kk.has('ArrowRight')) steer = 1;
    if (kp.has('KeyZ') || kp.has('KeyA')) queueHook(-1);
    if (kp.has('KeyX') || kp.has('KeyD')) queueHook(1);
    if (state.hookBuf) hook = state.hookBuf.s;
    return { steer, hook };
  }

  // ---- the round in motion --------------------------------------------------------------------------------------------
  function events(B) {
    for (const e of B.ev) {
      if (e.k === 'hook') { sfx.whoosh(); }
      else if (e.k === 'land') {
        const d = 1 - e.side, f = footBase(d, e.s, B);
        dust(f.x, f.y, 6); ring(f.x, f.y, 60, e.side === 0 ? '#9fe7ff' : '#ffd37a'); sfx.thud();
        pop(f.x, f.y - 30, e.clean ? 'Down!' : e.light > 0.6 ? 'Clean hook!' : 'Hooked!', '#ffe27a', 34);
        state.cheer = Math.min(1, state.cheer + 0.3);
      } else if (e.k === 'over') {
        const f = footBase(e.side, e.s, B); pop(f.x, f.y + (e.side === 0 ? 70 : -60), 'Stepped over!', '#a8e8ff', 28); sfx.miss();
      } else if (e.k === 'stumble') {
        const f = footBase(e.side, e.s, B); pop(f.x, f.y + (e.side === 0 ? 70 : -60), 'Off balance', '#ffb892', 28); sfx.miss();
      } else if (e.k === 'clash') { pop(WORLD.cx, WORLD.cy, 'Clash!', '#fff3b0', 34); sfx.clash(); }
      else if (e.k === 'foot') { if (e.side === 0 && state.m.cfg.mode !== 'watch') sfx.foot(); }
      else if (e.k === 'extra') { toast('Level! Fifteen seconds of extra time', 2.6); sfx.thud(); }
    }
  }
  function stepFight(dt, input) {
    const B = state.B;
    const cmds = [null, null];
    for (let i = 0; i < 2; i++) cmds[i] = isAI(i) ? state.drivers[i].cmd(B, i, dt) : humanCmd(input.keys);
    stepRound(B, dt, cmds);
    B.clock += dt;
    if (state.hookBuf) { state.hookBuf.t -= dt; if (state.hookBuf.t <= 0 || B.side[0].hook) state.hookBuf = null; }
    events(B);
    if (B.over) endBout();
  }

  // ---- Think (the coach) and Watch & Learn --------------------------------------------------------------------------
  function openThink() {
    if (state.phase !== 'fight' || state.m.cfg.mode !== 'ai' || state.paused) return;
    const B = state.B, p = bestIntent(B, 0);
    const ex = explain(B, 0, p);
    const hint = INTENTS[p.intent].hint;
    state.card = { title: `Think: ${ex.title}`, text: `${ex.reason} (${hint.charAt(0).toUpperCase()}${hint.slice(1)}.)`, sticky: true };
    state.hint = { who: 0, intent: p.intent, side: p.side, steer: peakSteer(p) };
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
        state.hint = { who: w.side, intent: w.intent.intent, side: w.intent.side, steer: peakSteer(w.intent) };
        state.wlabel = `${name} will: ${ex.title}`;
      } else if (w.phase === 'reveal' && w.timer <= 0) {
        w.phase = 'run'; w.since = 0; w.last[w.side] = w.intent.intent;
        const d = state.drivers[w.side]; d.p = w.intent; d.hold = 2.6;
        state.card = null; state.hint = null; state.wlabel = '';
      }
      return true;
    }
    w.since += dt;
    if (w.since > 4.5 && B.t > 2) {
      const s = (Math.floor(B.t / 4.5)) % 2;
      const pl = bestIntent(B, s);
      if (pl.intent !== w.last[s] && pl.intent !== state.drivers[s].p.intent) {
        w.phase = 'think'; w.side = s; w.intent = pl; w.timer = THINK_STEPS[state.settings.thinkIdx];
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
    else if (id === 'p-cues') { st.cues = !st.cues; save(); }
    else if (id === 'p-txtdec') { st.textIdx = Math.max(0, st.textIdx - 1); save(); }
    else if (id === 'p-txtinc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); save(); }
    else if (id === 'quit') leaveMatch();
  }

  function updatePlay(dt, input) {
    const m = state.m, ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch';
    const lay = layoutFor(state);
    state.lay = lay;
    if (config.dev && keys.pressed.has('KeyL') && state.phase === 'fight') { state.B.side[1].st = 0.05; }
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
        if (state.ready <= 0) { state.phase = 'fight'; sfx.count(true); pop(WORLD.cx, 250, 'Step!', '#ffe27a', 54); }
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
    // The kit's preview pill sits in the empty strip of the thumb pad (between the reminder line and the hook pads), never on the HUD.
    {
      const hr = hookRects(lay), top = lay.pad.y + hr.lp * 2.2, bot = state.m.cfg.mode === 'watch' ? lay.pad.y + lay.pad.h * 0.6 : hr.L.y - 8;
      if (bot - top > 44) meta.previewBadge = { x: lay.pad.x + lay.pad.w / 2, y: top + (bot - top) / 2 - 17, align: 'center' };
      else meta.previewBadge = { x: lay.pad.x + lay.pad.w - 8, y: lay.pad.y + lay.pad.h * 0.5, align: 'right' };
    }
    state.lay = lay;
    if (state.shotMode && state.fingers[0]?.on) {   // showcase thumb: always in the empty middle of the pad, clear of Pause and the caption
      const hr = hookRects(lay), f = state.fingers[0], cy = (lay.pad.y + hr.lp * 2.6 + hr.L.y) / 2, cx = lay.pad.x + lay.pad.w / 2;
      f.ox = cx; f.oy = cy; f.x = cx + 90 * (state.B.side[0].steer || 0); f.y = cy;
    }
    const S = {
      ring: state.ring, cues: state.settings.cues !== false, t: state.t, B: state.B, pose: state.pose, looks: state.looks.map((i) => i), parts: state.parts, pops: state.pops,
      hint: state.hint, cheer: state.cheer,
    };
    if (state.g3) { ctx.clearRect(lay.stage.x, lay.stage.y, lay.stage.w, lay.stage.h); drawStage3D(ctx, lay.stage, { ...S, map: state.g3.map }); }
    else drawStage(ctx, lay.stage, S);
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
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id.startsWith('ring-')) { const v = id.slice(5); if (state.demo && v !== 'turf') { state.setupMsg = 'That ring is in the full game.'; return; } s.ring = v; state.setupMsg = ''; }
    else if (id === 'start') startMatch({ mode: 'ai', opp: s.opp, ring: s.ring });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-cues') st.cues = !st.cues;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      if (state.restoreBusy) return;
      state.restoreMsg = 'Checking with the store…'; state.restoreBusy = true;
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreBusy = false; state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreBusy = false; state.restoreMsg = 'The store could not be reached. Try again later.'; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.m.cfg;
    if (id === 'again') { if (cfg.mode === 'watch') startWatch(); else startMatch({ ...cfg }); }
    else if (id === 'new') { state.setup.mode = 'ai'; state.scene = 'setup'; state.ui.scroll = 0; }
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
    { ring: 'turf', opp: 1, w: [0.6, 0.55], st: [0.8, 0.62], steer: [0.8, 0.2], t: 21, fing: true },
    { ring: 'hall', opp: 3, w: [0.7, 0.5], st: [0.58, 0.45], steer: [0.9, 0.1], t: 24, think: true, hook: [0, -1] },
    { ring: 'snow', opp: 4, w: [-0.2, 0.4], st: [0.46, 0.8], steer: [-0.3, 0.6], t: 30, fing: true },
    { ring: 'turf', opp: 2, w: [0.1, -0.5], st: [0.3, 0.52], steer: [0.1, -0.7], t: 33, hook: [1, 1] },
    { ring: 'hall', opp: 0, w: [-0.55, -0.5], st: [0.6, 0.2], steer: [-0.8, -0.5], t: 12 },
    { ring: 'snow', opp: 2, w: [0.3, 0.9], st: [0.4, 0], steer: [0.6, 0.2], t: 28, end: true },
  ];
  function setupShowcase(kind) {
    const sc = SHOWCASE[kind % SHOWCASE.length];
    state.m = newMatch({ mode: 'ai', opp: sc.opp, ring: sc.ring });
    state.scene = 'play';
    startBout();
    const B = state.B;
    state.phase = 'fight'; state.ready = 0;
    B.t = sc.t; B.ang = sc.t * 0.42;
    for (let i = 0; i < 2; i++) { const s = B.side[i]; s.w = sc.w[i]; s.st = sc.st[i]; s.steer = sc.steer[i]; s.cmd = s.steer; s.tgt = s.w; }
    if (sc.hook) B.side[sc.hook[0]].hook = { s: sc.hook[1], t: 0.16 };
    for (let i = 0; i < 60; i++) stepPose(state.pose, B, 1 / 30, null);
    state.m.wins = [kind % 2, kind % 3 === 0 ? 1 : 0];
    if (sc.think) { const p = bestIntent(B, 0); const ex = explain(B, 0, p); state.card = { title: `Think: ${ex.title}`, text: ex.reason, sticky: true }; state.hint = { who: 0, intent: p.intent, side: p.side, steer: peakSteer(p) }; }
    if (sc.end) {
      B.side[1].st = 0; B.over = { win: 0, how: 'fall', t: B.t, loser: 1 };
      state.m.wins[0] = 1; state.m.results.push({ win: 0, how: 'fall', t: B.t });
      state.phase = 'end'; state.endT = 2;
      for (let i = 0; i < 60; i++) stepPose(state.pose, B, 1 / 30, B.over);
      confetti(WORLD.cx, 240, 40); for (const p of state.parts) p.t += 0.25;
    } else {
      const f = footBase(1, -1, B); dust(f.x, f.y, 6); pop(f.x, f.y - 30, 'Hooked!', '#ffe27a', 34);
      state.pops[0].t = 0.25; for (const p of state.parts) p.t += 0.15;
    }
    if (sc.fing) state.fingers[0] = { on: true, id: 0, steer: true, ox: 200, oy: 1010, x: 120 + 120 * sc.steer[0], y: 1010, t0: 0, travel: 40 };
    state.shotMode = { kind };
  }
  function finishDemoResult() {
    state.m = newMatch({ mode: 'ai', opp: 2, ring: 'hall' });
    state.m.wins = [2, 1]; state.m.results = [{ win: 0, how: 'fall', t: 18 }, { win: 1, how: 'stance', t: 31 }, { win: 0, how: 'points', t: 60 }];
    state.m.over = { win: 0, record: 'Eirik beaten 1 time in all.' };
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
      else state.scene = v;
    }
    const adv = Number(q('ticks')) | 0;
    if (adv > 0 && state.scene === 'play') for (let i = 0; i < adv; i++) { state.t += 1 / 60; updatePlay(1 / 60, BLANK()); }
  }

  if (AUTOWATCH && !SHOT_MODE) startWatch();

  return {
    // Watch & Learn and every menu are free; only real rounds count against the free preview (a paused bout or a countdown does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch' && state.phase === 'fight') || state.paused,
    update(dt, input) {
      if (SHOT_MODE) input = BLANK();
      setSize(meta.width, meta.height);
      config.textScale = TEXT_SCALES[state.settings.textIdx];
      setPress(input.pointer);
      state.owned = !!monetization?.owns?.('unlock_game');
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
      meta.previewBadge = null;
      // the kit canvas is transparent so the 3D scene shows through where the game punches a hole; everything else is painted here
      ctx.clearRect(0, 0, meta.width, meta.height); ctx.fillStyle = '#0a1424'; ctx.fillRect(0, 0, meta.width, meta.height);
      state.g3 = gl && gl.on && gl.p3 ? gl.p3 : null;
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': if (aboutFor !== credits.text) { aboutFor = credits.text; aboutList = ABOUT.concat(creditSections(credits.text)); } renderPages(ctx, state, aboutList, 'About'); break;
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
    ...(config.dev ? { dev: { startMatch, startWatch, openPause, leaveMatch } } : {}),
    lockupZone: () => lockupZone(),
  };
}
