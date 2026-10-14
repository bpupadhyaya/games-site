// Kurash: state and flow. The physics lives in sim.js, the computer wrestlers and the coach in ai.js, drawing in view.js,
// hud.js and menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto / about / rules, demolimit.
// A bout: 3-2-1, then each wrestler tugs with one thumb (drag = pull the rival that way) and throws by lifting the thumb. First to two bouts.
import { newBout, stepBout, TUNE, len } from './sim.js';
import { PROFILES, createDriver, bestIntent, explain, planArrow } from './ai.js';
import { inRect, setSize, W, TEXT_DEC, TEXT_INC, TEXT_SCALES, THINK_STEPS, SETUP_PINS } from './layout.js';
import { drawStage, newPose, stepPose, VENUES, WORLD, R3 } from './view.js';
import { layoutFor, drawHud, drawMeters, drawButtons, drawPad, drawFingers, drawOverlays, drawCard, drawToast, cardRectFor, nextRect } from './hud.js';
import {
  renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderReason, renderPages, renderDemoLimit,
  hitScreen, flowMeta, READER, refCloseRect, ensureLayout, resetMenus, lockupZone, stepAttract, newAttract,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

// Fluid viewport: the short side is always 720 units; meta.width / meta.height follow the real screen.
export const wheelInput = { dy: 0 };
// The kit's preview pill sits at the top centre by default; during a bout that is the scoreboard, so it moves to the upper-left corner of
// the bout picture (a corner of the venue backdrop, clear of the mat). `badge` is refreshed by update().
let badge = null;
export const meta = { width: 720, height: 1280, fluid: { short: 720 }, get previewBadge() { return badge; } };
const DEMO_BOUT_CAP = 3;       // bouts of real play in the free web demo
const WATCH_TIME = 30;         // seconds of a Watch & Learn bout (then a golden throw if level)
const SHOT_MODE = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();
const PULL_R = 110;            // virtual units of thumb travel for a full tug
const DEAD = 0.09;
const CHASE = 0.3;             // seconds for the thumb's origin to catch up with a resting thumb
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BLANK = () => ({ pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } });

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();

  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, reasonOpen: false, demo: !!config.demo,
    settings: { sound: true, textIdx: 0, thinkIdx: 1, compass: true },
    record: { matches: 0, wins: [0, 0, 0, 0, 0], halals: 0, demoBouts: 0, points: 0, longest: 0 },
    setup: { mode: 'ai', opp: 1, venue: 'courtyard' }, setupMsg: '',
    ui: { scroll: 0, drag: null }, page: 0,
    m: null, B: newBout(), pose: newPose(), looks: [0, 1], drivers: [null, null], phase: 'ready', ready: 3, endT: 0, venue: 'courtyard',
    parts: [], pops: [], toast: '', toastT: 0, card: null, hint: null, hintT: 0, think: null, w: null, ff: false,
    fingers: [{ on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 }, { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 }],
    thumbs: [{ x: 0, y: 0, lx: 0, ly: 0, rel: false, kx: 0, ky: 0 }, { x: 0, y: 0, lx: 0, ly: 0, rel: false, kx: 0, ky: 0 }],
    cheer: 0, shotMode: null, att: null, loaded: false, restoreMsg: '', restoreBusy: false, owned: false, wlabel: '',
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
    tug: (v) => tone({ freq: 180 + 80 * v, to: 120, dur: 0.07, type: 'triangle', vol: 0.035 }),
    whoosh: () => tone({ freq: 500, to: 160, dur: 0.22, type: 'sawtooth', vol: 0.05 }),
    thud: () => { tone({ freq: 120, to: 55, dur: 0.22, type: 'sine', vol: 0.2 }); tone({ freq: 900, to: 300, dur: 0.06, type: 'square', vol: 0.03 }); },
    stumble: () => tone({ freq: 260, to: 150, dur: 0.22, type: 'triangle', vol: 0.08 }),
    warn: () => { tone({ freq: 520, dur: 0.1, type: 'square', vol: 0.05 }); tone({ freq: 390, dur: 0.16, type: 'square', vol: 0.05 }); },
    score: (n) => [0, 4, 7].slice(0, n + 1).forEach((k, i) => tone({ freq: 523 * Math.pow(2, k / 12), dur: 0.18 + i * 0.05, type: 'triangle', vol: 0.1 })),
    halal: () => [0, 4, 7, 12, 16].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.11 })),
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.28 + i * 0.05, type: 'triangle', vol: 0.1 })),
    lose: () => [0, -3, -7].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.08 })),
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };

  // ---- particles -----------------------------------------------------------------------------------------------
  const MAX_PARTS = 120;
  const add = (q) => { if (state.parts.length < MAX_PARTS) state.parts.push(q); };
  const dust = (x, y, n, col = '#f2e6c0') => { for (let i = 0; i < n; i++) { const a = -Math.PI * (0.1 + fx.next() * 0.8), s = 30 + fx.next() * 90; add({ kind: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.4 + fx.next() * 0.4, size: 3 + fx.next() * 4, col }); } };
  const ring = (x, y, size, col) => add({ kind: 2, x, y, vx: 0, vy: 0, t: 0, max: 0.55, size, col });
  const confetti = (x, y, n) => { const cols = ['#ffd24a', '#2b63c9', '#1f9a62', '#f6f1e2', '#8fd0ff']; for (let i = 0; i < n; i++) { const a = -Math.PI * fx.next(), s = 80 + fx.next() * 260; add({ kind: 3, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 1.2 + fx.next() * 0.8, size: 1, col: cols[fx.int(cols.length)], spin: 6 + fx.next() * 10 }); } };
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
    return { cfg: { mode: 'ai', opp: 1, venue: 'courtyard', ...cfg }, players, idx: 0, wins: [0, 0], results: [], over: null };
  }
  let lastCount = 4;
  function startBout() {
    const m = state.m;
    state.B = newBout(m.cfg.mode === 'watch' ? { limit: WATCH_TIME } : {});
    state.looks = m.players.map((p) => p.look);
    state.venue = m.cfg.venue;
    state.drivers = m.players.map((p) => (p.ai >= 0 ? createDriver(PROFILES[p.ai], aiRng.fork()) : null));
    state.phase = 'ready'; state.ready = 3; state.endT = 0; state.card = null; state.hint = null; state.hintT = 0; state.think = null;
    state.parts = []; state.pops = []; state.pose = newPose(); state.paused = false; state.pauseMenu = false; state.reasonOpen = false;
    state.w = m.cfg.mode === 'watch' ? { since: 0, last: [null, null], phase: 'run', side: 0, intent: 'gain', timer: 0 } : null;
    state.fingers.forEach((f) => { f.on = false; f.id = null; });
    state.thumbs.forEach((t) => { t.rel = false; t.x = 0; t.y = 0; t.lx = 0; t.ly = 0; t.kx = 0; t.ky = 0; });
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
    startMatch({ mode: 'watch', a, b, venue: VENUES[aiRng.int(3)].id });
  }

  function endBout() {
    const m = state.m, B = state.B, o = B.over;
    state.phase = 'end'; state.endT = 0;
    m.wins[o.win]++; m.results.push({ win: o.win, how: o.how, t: o.t });
    const human = m.cfg.mode === 'ai' ? 0 : -1;
    confetti(WORLD.cx, 500, o.win === human || m.cfg.mode !== 'ai' ? 46 : 14);
    if (o.how === 'halal') ring(WORLD.cx, WORLD.cy, 260, '#ffd24a');
    if (human === 0 && o.win !== 0) sfx.lose(); else sfx.win();
    if (m.cfg.mode !== 'watch') {
      state.record.demoBouts = (state.record.demoBouts | 0) + 1;
      if (o.win === human && o.how === 'halal') state.record.halals = (state.record.halals | 0) + 1;
      if (human === 0) state.record.points = (state.record.points | 0) + B.side[0].pts;
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
  // Each finger has a floating origin that follows the thumb (a drag farther than PULL_R drags it along at once, and a resting thumb
  // lets it catch up in about 0.3 s). The tug is the thumb's recent motion: keep it moving to pull, hold it still to root.
  // Lifting a finger that was moving at least minThrow of the full length is a throw in that direction.
  function readFingers(input, dt) {
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
      const k = 1 - Math.exp(-dt / CHASE);
      f.ox += (f.x - f.ox) * k; f.oy += (f.y - f.oy) * k;
    }
    for (let k = 0; k < 2; k++) {
      const f = state.fingers[k];
      if (f.on && !used.has(f)) {
        f.on = false; f.id = null;
        const t = state.thumbs[k];
        if (Math.hypot(t.x, t.y) >= TUNE.minThrow) t.rel = true;     // a lifted thumb that was dragging: throw
      }
    }
  }
  // The command of human side i for this tick: the drag vector, and a throw when the thumb was just lifted.
  function humanCmd(i, keys) {
    const two = state.m.cfg.mode === 'two';
    const k = two ? i : 0;
    const f = state.fingers[k], t = state.thumbs[k];
    let x = 0, y = 0;
    if (f.on) {
      x = (f.x - f.ox) / PULL_R; y = (f.y - f.oy) / PULL_R;
      const mag = Math.hypot(x, y);
      if (mag > 1) { x /= mag; y /= mag; }
      if (Math.hypot(x, y) < DEAD) { x = 0; y = 0; }
    }
    const kk = keys.down;
    const names = i === 0 ? ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'] : ['KeyJ', 'KeyL', 'KeyI', 'KeyK', 'KeyU'];
    let kx = (kk.has(names[1]) ? 1 : 0) - (kk.has(names[0]) ? 1 : 0), ky = (kk.has(names[3]) ? 1 : 0) - (kk.has(names[2]) ? 1 : 0);
    const kl = Math.hypot(kx, ky);
    if (kl > 0) { kx /= kl; ky /= kl; x = kx; y = ky; t.kx = kx; t.ky = ky; }
    t.x = x; t.y = y;
    const fire = t.rel || (keys.pressed.has(names[4]) && (t.kx || t.ky));
    if (fire) {
      const rx = t.rel ? t.lx : t.kx, ry = t.rel ? t.ly : t.ky;
      t.rel = false;
      return { x: rx, y: ry, release: true };
    }
    t.lx = x; t.ly = y;
    return { x, y, release: false };
  }

  // ---- the bout in motion --------------------------------------------------------------------------------------------
  const posOf = (side) => ({ x: WORLD.cx + (side === 0 ? -WORLD.home : WORLD.home) + state.B.side[side].b.x * WORLD.disp, y: WORLD.cy + state.B.side[side].b.y * WORLD.disp });
  function events(B) {
    for (const e of B.ev) {
      const human = state.m.cfg.mode === 'ai' ? e.side === 0 : true;
      if (e.k === 'throw') { sfx.whoosh(); }
      else if (e.k === 'score') {
        const loser = posOf(1 - e.side), win = posOf(e.side);
        const n = e.kind === 'halal' ? 2 : e.kind === 'yonbosh' ? 1 : 0;
        if (e.how === 'passive') { sfx.warn(); }
        else {
          dust(loser.x + e.dx * 70, loser.y + e.dy * 70, 8 + n * 6); sfx.thud();
          if (e.kind === 'halal') { sfx.halal(); ring(loser.x, loser.y, 220, '#ffd24a'); confetti(WORLD.cx, 300, 30); }
          else { sfx.score(n); ring(loser.x, loser.y, 140 + 50 * n, '#fff3b0'); }
        }
        state.cheer = Math.min(1, state.cheer + 0.5);
      } else if (e.k === 'whiff') {
        const p = posOf(e.side); sfx.stumble(); dust(p.x, p.y + 40, 5);
        if (human) pop(p.x, p.y - 90, e.countered ? 'Countered!' : 'Missed!', '#ff9c7a', 34);
      } else if (e.k === 'stumble') { sfx.stumble(); const p = posOf(e.side); if (human) pop(p.x, p.y - 90, 'Not quite', '#ffe0a0', 30); }
      else if (e.k === 'warn') { sfx.warn(); toast(`${state.m.players[e.side].name}: passivity warning ${e.n}. Tug or throw!`, 2.4); }
      else if (e.k === 'golden') { toast('Level! A golden throw: the next score wins', 3); sfx.thud(); }
    }
  }
  function stepFight(dt, input) {
    const B = state.B;
    const cmds = [null, null];
    for (let i = 0; i < 2; i++) cmds[i] = isAI(i) ? state.drivers[i].cmd(B, i, dt) : humanCmd(i, input.keys);
    stepBout(B, dt, cmds);
    B.clock += dt;
    // a quiet creak of the mat while someone is tugging hard
    if (((B.clock * 60) | 0) % 22 === 0) { const m = Math.max(B.side[0].mag, B.side[1].mag); if (m > 0.6) sfx.tug(m); }
    events(B);
    if (B.over) endBout();
  }

  // ---- Think (the coach) and Watch & Learn --------------------------------------------------------------------------
  function openThink() {
    if (state.phase !== 'fight' || state.m.cfg.mode !== 'ai' || state.paused || state.B.pause > 0) return;
    const B = state.B, plan = bestIntent(B, 0);
    const ex = explain(B, 0, plan);
    state.card = { title: `Think: ${ex.title}`, text: ex.reason, sticky: true };
    const dir = planArrow(plan);
    state.hint = dir ? { side: 0, dir, throw: plan.intent === 'throw' } : null;
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
        const ex = explain(B, w.side, w.plan);
        const name = state.m.players[w.side].name;
        state.card = { title: `${name}: ${ex.title}`, text: ex.reason, sticky: true };
        const dir = planArrow(w.plan);
        state.hint = dir ? { side: w.side, dir, throw: w.intent === 'throw' } : null;
        state.wlabel = `${name} will: ${ex.title}`;
      } else if (w.phase === 'reveal' && w.timer <= 0) {
        w.phase = 'run'; w.since = 0; w.last[w.side] = w.intent;
        const d = state.drivers[w.side]; d.intent = w.intent; d.hold = 2.2;
        state.card = null; state.hint = null; state.wlabel = '';
      }
      return true;
    }
    w.since += dt;
    if (w.since > 4.5 && B.t > 2) {
      const s = (Math.floor(B.t / 4.5)) % 2;
      const plan = bestIntent(B, s);
      const intent = plan.intent;
      if (B.pause <= 0 && plan.why !== 'recovering' && intent !== w.last[s] && intent !== state.drivers[s].intent) {
        w.phase = 'think'; w.side = s; w.intent = intent; w.plan = plan; w.timer = THINK_STEPS[state.settings.thinkIdx];
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
    if (config.dev && keys.pressed.has('KeyH') && state.phase === 'fight') { state.B.side[1].b.x = 0.95; state.B.side[1].b.y = 0; state.B.side[1].v.x = 0; }
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

    if (!watch && !state.paused) readFingers(input, dt);
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
        if (state.ready <= 0) { state.phase = 'fight'; sfx.count(true); pop(WORLD.cx, 250, 'Kurash!', '#ffe27a', 54); }
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
      venue: state.venue, t: state.t, B: state.B, pose: state.pose, looks: state.looks.map((i) => i), parts: state.parts, pops: state.pops,
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
    else if (id.startsWith('venue-')) { const v = id.slice(6); if (state.demo && v !== 'courtyard') { state.setupMsg = 'That venue is in the full game.'; return; } s.venue = v; state.setupMsg = ''; }
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, venue: s.venue });
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
      if (state.restoreBusy || state.owned) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store…';
      let p; try { p = Promise.resolve(monetization.restore?.()); } catch (e) { p = Promise.reject(e); }
      p.then(() => { state.restoreBusy = false; state.owned = !!monetization.owns('unlock_game'); state.restoreMsg = state.owned ? 'Purchase restored. Thank you!' : 'No previous purchase was found for this store account.'; })
        .catch(() => { state.restoreBusy = false; state.restoreMsg = 'The store could not be reached. Please try again in a moment.'; });
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
    { venue: 'courtyard', opp: 1, b: [[-0.25, 0.1], [0.5, 0.2]], v: [[-0.5, 0], [2.2, 0.4]], g: [0.8, 0.6], pts: [1, 0], t: 18, fing: true },
    { venue: 'hall', opp: 3, b: [[-0.1, 0.05], [0.78, -0.2]], v: [[0, 0], [1.4, -0.2]], g: [0.55, 0.4], pts: [0, 1], t: 31, think: true },
    { venue: 'arena', opp: 4, b: [[0.15, -0.1], [0.62, 0.12]], v: [[0.5, 0], [1.1, 0.1]], g: [0.7, 0.5], pts: [2, 2], t: 40, wind: true },
    { venue: 'courtyard', opp: 2, b: [[0.1, 0], [0.9, 0.1]], v: [[0, 0], [0, 0]], g: [0.6, 0.6], pts: [2, 1], t: 25, score: 'yonbosh' },
    { venue: 'hall', opp: 0, b: [[-0.4, 0.3], [0.2, -0.3]], v: [[-1, 0.5], [0.8, 0.2]], g: [0.9, 0.9], pts: [0, 0], t: 9, fing: true },
    { venue: 'arena', opp: 2, b: [[0.1, 0], [0.95, 0]], v: [[0, 0], [0, 0]], g: [0.5, 0.5], pts: [1, 0], t: 36, end: true },
  ];
  function setupShowcase(kind) {
    const sc = SHOWCASE[kind % SHOWCASE.length];
    state.m = newMatch({ mode: 'ai', opp: sc.opp, venue: sc.venue });
    state.scene = 'play';
    startBout();
    const B = state.B;
    state.phase = 'fight'; state.ready = 0;
    B.t = sc.t;
    for (let i = 0; i < 2; i++) {
      const s = B.side[i];
      s.b = { x: sc.b[i][0], y: sc.b[i][1] }; s.v = { x: sc.v[i][0], y: sc.v[i][1] }; s.grip = sc.g[i]; s.pts = sc.pts[i];
    }
    state.m.wins = [kind % 2, kind % 3 === 0 ? 1 : 0];
    if (sc.wind) { B.side[0].wind = { t: 0.12, dx: 1, dy: -0.1 }; }
    if (sc.score) {
      B.last = { side: 0, kind: sc.score, q: 0.7, how: 'throw', dx: 1, dy: 0.1, t: sc.t - 0.2 }; B.pause = 1.1;
      for (const s of B.side) { s.b = { x: 0, y: 0 }; s.v = { x: 0, y: 0 }; }
      B.side[1].b = { x: 0.4, y: 0.1 };
    }
    if (sc.end) {
      B.over = { win: 0, how: 'halal', t: B.t, kind: 'halal' }; B.last = { side: 0, kind: 'halal', q: 0.95, how: 'throw', dx: 1, dy: 0, t: sc.t - 2 };
      state.m.wins[0] = 1; state.m.results.push({ win: 0, how: 'halal', t: B.t });
      state.phase = 'end'; state.endT = 2;
    }
    for (let i = 0; i < (sc.score ? 5 : 90); i++) stepPose(state.pose, B, 1 / 30, B.over);
    if (sc.think) { const plan = bestIntent(B, 0), ex = explain(B, 0, plan); state.card = { title: `Think: ${ex.title}`, text: ex.reason, sticky: true }; state.hint = { side: 0, dir: planArrow(plan) || { x: 1, y: 0 }, throw: plan.intent === 'throw' }; }
    if (sc.score) { dust(WORLD.cx + 170, WORLD.cy + 20, 14); ring(WORLD.cx + 130, WORLD.cy, 160, '#fff3b0'); for (const p of state.parts) p.t += 0.12; }
    if (sc.end) { pop(WORLD.cx, 700, 'HALAL!', '#ffe27a', 62); state.pops[0].t = 0.3; confetti(WORLD.cx, 300, 40); for (const p of state.parts) p.t += 0.25; }
    if (sc.fing) { const pd = layoutFor(state).pad; const cx = pd.x + pd.w / 2, cy = pd.y + pd.h / 2 + 20; state.fingers[0] = { on: true, id: 0, ox: cx - 40, oy: cy + 30, x: cx + 30, y: cy - 20 }; }
    state.shotMode = { kind };
  }
  function finishDemoResult() {
    state.m = newMatch({ mode: 'ai', opp: 2, venue: 'hall' });
    state.m.wins = [2, 1]; state.m.results = [{ win: 0, how: 'points', t: 38 }, { win: 1, how: 'halal', t: 31 }, { win: 0, how: 'halal', t: 45 }];
    state.m.over = { win: 0, record: 'Rustam beaten 1 time in all.' };
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
        state.shotMode = null; startMatch({ mode: 'two', venue: 'arena' }); state.phase = 'fight'; state.ready = 0;
        state.B.side[0].b = { x: -0.2, y: 0.2 }; state.B.side[1].b = { x: 0.5, y: -0.1 };
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
      badge = state.scene === 'play' && state.lay && state.lay.stage ? (state.lay.land ? { x: state.lay.stage.x + state.lay.stage.w - 10, y: state.lay.stage.y + 8, align: 'right' } : { x: state.lay.stage.x + 10, y: state.lay.stage.y + 8, align: 'left' }) : null;
      state.owned = !!(monetization && monetization.owns && monetization.owns('unlock_game'));
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
      // the 3D presenter (if any) draws behind this canvas: start from a clear canvas and paint only the HUD and overlays
      ctx.clearRect(0, 0, meta.width, meta.height);
      R3.p3 = view && view.p3 ? view.p3 : null;
      if (R3.p3 && state.scene === 'play' && state.lay && state.lay.stage) {
        // the 3D picture shows through the stage rectangle only; everything around it is the solid navy of the controls
        const r = state.lay.stage;
        ctx.fillStyle = '#071231'; ctx.fillRect(0, 0, meta.width, meta.height); ctx.clearRect(r.x, r.y, r.w, r.h);
      }
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
    ...(config.dev ? { dev: { startMatch, startWatch, openPause, leaveMatch } } : {}),
    lockupZone: () => lockupZone(),
  };
}
