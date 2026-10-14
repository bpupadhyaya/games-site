// Thanjavur Dancing Doll: state and flow. Drawing is in view.js / playview.js / docview.js; the physics, levels and performer are in sim.js.
//
// Time model: the performance clock is the sum of the dt values handed to update() (deterministic, pausable). Think/Reveal in Watch
// and Learn and the Practice hint stop the clock; Pause freezes everything.
import {
  PHYS, PHASES, createWorld, stepWorld, resultOf, botCommand, levelFor, targetBallast, omegaOf, ghostAt, DEMO_LEVELS, DEMO_RUNS, REVEAL_SECONDS,
  LEVEL_COUNT, DAILY, clamp,
} from './sim.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects, dollSlots } from './layout.js';
import { burst, stepParticles } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { rulesPages, THINK_CHOICES } from './content.js';
import { newView } from './playview.js';
import { pressLockup } from './brand.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };

const CONF = ['#d9402a', '#eaa91c', '#1f8a5b', '#2757a8', '#e0568a', '#14958c'];
// start of each part with its own Think/Reveal: build (at the start), hold, settle
const SECTIONS = [0, PHASES.RAMP, PHASES.RAMP + PHASES.HOLD];

export function createGame(env) {
  const { rng, storage, config } = env;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title', day: config.day ?? 0,
    prefs: { sound: true, thinkIdx: 1, calm: false, textIdx: 0 },
    best: {}, demoRuns: 0, pl: null, result: null, menu: null, menuIdx: 0,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true,
    owned: false, restoreMsg: '', restoreBusy: false,
  };
  const mon = env.monetization;
  state.owned = !!mon?.owns?.('unlock_game');
  mon?.onChange?.(() => { state.owned = !!mon.owns('unlock_game'); });
  let lastScene = state.scene, drag = null, touch = null;
  const fxRng = rng.fork();

  storage.get('prefs', null).then((v) => {
    if (!v) return;
    Object.assign(state.prefs, v);
    state.prefs.textIdx = clamp(state.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.prefs.thinkIdx = clamp(state.prefs.thinkIdx | 0, 0, THINK_CHOICES.length - 1);
    applyPrefs();
  });
  storage.get('best', null).then((v) => { if (v) state.best = v; });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();
  const lay = () => layoutFor(meta.width, meta.height);
  const go = (scene) => { state.scene = scene; if (scene !== 'play' && scene !== 'result') state.pl = null; touch = null; };
  const tone = (o) => { if (state.prefs.sound) env.audio.tone?.(o); };
  const bestKey = (idx) => (idx === DAILY ? 'daily' : idx);

  // ---- effects: what the world's events do to the picture and the sound ------------------------------------------------------------
  function applyEvents(V, W, audible, stage) {
    const D = stage ? dollSlots(stage, W.L.n) : null;
    for (const e of W.events) {
      if (e.type === 'tap') {
        V.tapFx[e.i] = 1;
        if (V.sp?.[e.i]) { V.sp[e.i].hv += -e.dir * (1.2 + e.mag * 2.2); V.sp[e.i].qv += e.dir * 0.4; }
        if (audible) tone({ freq: 190 + e.mag * 120, to: 100, dur: 0.08, type: 'triangle', vol: 0.15 });
        if (D) burst(V.parts, fxRng, D.slots[e.i].cx + e.dir * D.R * 1.2, D.gy - D.R * 1.5, state.prefs.calm ? 1 : 3, ['#ffd868', '#fff7e4'], 0.35, { kind: 'dot', size: 0.8, g: 200, lift: 20 });
      } else if (e.type === 'tick') {
        if (audible) tone({ freq: e.side > 0 ? 1040 : 880, dur: 0.035, type: 'square', vol: 0.02 });
      } else if (e.type === 'bump') {
        if (audible) tone({ freq: 140, to: 80, dur: 0.1, type: 'sine', vol: 0.12 });
        V.shake = state.prefs.calm ? 0 : 0.4;
      } else if (e.type === 'phase') {
        if (e.name === 'hold') { V.banner = { text: 'HOLD THE SWAY', kind: 'good', t: 0 }; if (audible) { tone({ freq: 523, dur: 0.14, type: 'triangle', vol: 0.12 }); tone({ freq: 784, dur: 0.2, type: 'triangle', vol: 0.1 }); } }
        else if (e.name === 'settle') { V.banner = { text: 'EASE DOWN', kind: 'good', t: 0 }; if (audible) tone({ freq: 392, to: 330, dur: 0.3, type: 'sine', vol: 0.12 }); }
        else if (e.name === 'rest') { V.banner = { text: 'REST', kind: 'good', t: 0 }; }
      } else if (e.type === 'end') {
        if (audible) { tone({ freq: 523, dur: 0.22, type: 'triangle', vol: 0.14 }); tone({ freq: 659, dur: 0.26, type: 'triangle', vol: 0.12 }); tone({ freq: 784, dur: 0.36, type: 'triangle', vol: 0.12 }); }
        if (D && !state.prefs.calm) D.slots.forEach((s) => burst(V.parts, fxRng, s.cx, D.gy - D.R * 4, 8, CONF, 1, { kind: 'conf' }));
      }
    }
  }
  // Secondary motion (view only): the nodding head and the torso are underdamped springs hung on the clay base, driven by the
  // base's angular acceleration, so a push makes the head wobble past and settle, and the body sways a little behind the roll.
  function springDoll(V, i, th, dt) {
    V.sp = V.sp || [];
    const s = V.sp[i] || (V.sp[i] = { th, om: 0, h: 0, hv: 0, q: 0, qv: 0 });
    if (dt <= 0) return;
    const step = Math.min(dt, 0.05), n = Math.max(1, Math.ceil(step / 0.008)), h = step / n;
    const om = (th - s.th) / step; let acc = (om - s.om) / step; s.om = om; s.th = th;
    acc = clamp(acc, -40, 40);
    for (let k = 0; k < n; k++) {
      s.hv += (-92 * s.h - 4.2 * s.hv - 0.055 * acc) * h; s.h += s.hv * h;
      s.qv += (-60 * s.q - 5.5 * s.qv - 0.03 * acc) * h; s.q += s.qv * h;
    }
    s.h = clamp(s.h, -0.6, 0.6); s.q = clamp(s.q, -0.2, 0.2);
  }
  function stepView(V, dt, W) {
    V.t += dt;
    for (let i = 0; i < W.dolls.length; i++) {
      const o = W.dolls[i];
      V.lag[i] += (o.th - V.lag[i]) * Math.min(1, 8 * dt);
      springDoll(V, i, o.th, dt);
      const run = W.phase === 'run' && o.inBand;
      V.glow[i] += ((run ? 1 : 0) - V.glow[i]) * Math.min(1, 5 * dt);
      V.tapFx[i] = Math.max(0, V.tapFx[i] - dt * 4);
    }
    V.lamp = W.dolls.reduce((a, _, i) => a + V.glow[i], 0) / Math.max(1, W.dolls.length);
    V.shake = Math.max(0, V.shake - dt * 3);
    for (const p of V.pops) p.age += dt;
    V.pops = V.pops.filter((p) => p.age < 0.9);
    if (V.banner) { V.banner.t += dt; if (V.banner.t > 1.6) V.banner = null; }
    stepParticles(V.parts, dt);
    // the in-time history of the hold part, in half-second cells
    if (W.phase === 'run' && W.t >= PHASES.RAMP && W.t < PHASES.RAMP + PHASES.HOLD) {
      const k = Math.min(V.hist.length - 1, Math.floor((W.t - PHASES.RAMP) / 0.5));
      const inb = W.dolls.reduce((a, o) => a + (o.inBand ? 1 : 0), 0) / W.dolls.length;
      V.hn = V.hn ?? new Array(V.hist.length).fill(0); V.hs = V.hs ?? new Array(V.hist.length).fill(0);
      V.hn[k] += 1; V.hs[k] += inb; V.hist[k] = V.hs[k] / V.hn[k];
    }
  }
  // where a finger should tap (for the red arrows in Practice and Reveal)
  function updateGuides(V, W) {
    V.guide.length = 0;
    if (W.phase !== 'run') return;
    W.dolls.forEach((o, i) => {
      const g = ghostAt(W.L, i, W.t + PHYS.REACT), w = omegaOf(o.b);
      const u = (g.om - o.om) + 0.7 * w * (g.th - o.th);
      const dead = PHYS.TAP * PHYS.TAP_MIN * 0.8;
      V.guide[i] = Math.abs(u) > dead ? { dir: Math.sign(u), mag: clamp(Math.abs(u) / PHYS.TAP, 0, 1) } : null;
    });
  }

  // ---- the live menu backdrop (two dolls swaying behind the menus) ----------------------------------------------------------------
  function newMenu() {
    const idx = [4, 5, 7, 9][state.menuIdx % 4];
    state.menuIdx += 1;
    const W = createWorld(levelFor(idx));
    targetBallast(W.L).forEach((b, i) => { W.dolls[i].b = b; });
    stepWorld(W, 1 / 60, { start: true });
    state.menu = { W, V: newView(), idx };
    for (let i = 0; i < 60 * 7; i++) stepWorld(W, 1 / 60, botCommand(W, 0.9));
    W.events.length = 0;
  }
  function stepMenu(dt) {
    const m = state.menu;
    if (!m || m.W.over) { newMenu(); return; }
    stepWorld(m.W, dt, botCommand(m.W, 0.9));
    m.W.events.length = 0;
    stepView(m.V, dt, m.W);
    if (m.W.t > 16) newMenu();
  }
  newMenu();

  // ---- a performance --------------------------------------------------------------------------------------------------------------
  const sectionText = (L, sec) => {
    if (sec === 0) return ['Tune the dolls', `Slide each bead until its swing time matches the tag: ${L.dolls.map((d) => d.T.toFixed(1) + ' s').join(', ')}.`];
    if (sec === 1) return ['Build the swing', 'Tap each doll on the side it is leaving. Near the rim pushes hard, near the middle gently.'];
    if (sec === 2) return ['Hold the sway', 'Stay inside the ghost. A small tap now and then keeps the swing going.'];
    return ['Settle', 'Ease down with the ghost. Rest a finger on a doll to steady it.'];
  };
  function newPlay(idx, mode) {
    const L = levelFor(idx, state.day);
    const W = createWorld(L, { mode, b0: 0.5 });
    const paint = L.dolls.map(() => 3);
    return {
      W, mode, idx, V: newView(), paused: false, over: false, auto: null, reveal: null, hintT: 0, hintCard: null,
      selDoll: 0, secIdx: 0, tuneHold: 0, paint, ...(mode === 'auto' ? { auto: thinkState(L, 0) } : {}),
    };
  }
  function thinkState(L, sec) {
    const [title, tip] = sectionText(L, sec);
    const total = THINK_CHOICES[state.prefs.thinkIdx];
    return { phase: 'think', timer: total, total, title, tip, sec };
  }
  function beginThink(pl, sec) { pl.auto = thinkState(pl.W.L, sec); pl.reveal = null; }
  function startPlay(mode, idx = state.sel) {
    const limited = config.demo && mode !== 'auto';
    if (limited && (idx >= DEMO_LEVELS || state.demoRuns >= DEMO_RUNS)) { go('demo-limit'); return; }
    if (limited) { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    state.sel = idx;
    state.pl = newPlay(idx, mode); state.result = null;
    state.scene = 'play'; state.sceneT = 0; touch = null;
    env.monetization.track?.('perf_start', { level: idx, mode });
  }
  const pausePlay = () => { const pl = state.pl; if (pl && !pl.paused && !pl.over) { pl.paused = true; pl.pauseIdx = 0; } };
  const resumePlay = () => { const pl = state.pl; if (pl) pl.paused = false; };

  function showHint(pl) {
    if (pl.mode !== 'practice' || pl.hintT > 0 || pl.over) return;
    pl.hintT = REVEAL_SECONDS + 0.5;
    const W = pl.W;
    pl.hintCard = W.phase === 'tune'
      ? { title: 'Tune each doll', tip: `Slide the beads to the gold marks: ${W.L.dolls.map((d) => d.T.toFixed(1) + ' s').join(', ')}.` }
      : { title: 'Where to tap', tip: 'The red arrows point the way to push. Tap on the opposite side of the doll, near the rim for a firm push.' };
  }

  const railX = (r, x) => { const pad = r.h * 0.5; return clamp((x - (r.x + pad)) / (r.w - pad * 2), 0, 1); };

  function updatePlay(dt, tap, input) {
    const pl = state.pl, P = lay().play, W = pl.W, V = pl.V;
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    const p = input.pointer, keys = input.keys.pressed, kd = input.keys.down;
    const D = dollSlots(P.stage, W.L.n);
    const auto = pl.mode === 'auto';
    let startNow = false;
    const cmd = { start: false, ballast: [], taps: [], hold: [] };
    if (tap) {
      if (inRect(P.pause, tap.x, tap.y)) { pausePlay(); return; }
      if (pl.mode === 'practice' && inRect(P.hint, tap.x, tap.y)) showHint(pl);
      else if (!auto && W.phase === 'tune' && inRect(P.start, tap.x, tap.y)) startNow = true;
      else if (!auto) {
        touch = null;
        for (let i = 0; i < D.slots.length; i++) {
          const s = D.slots[i], rr = { x: s.rail.x - 18, y: s.rail.y - 20, w: s.rail.w + 36, h: s.rail.h + 40 };
          if (inRect(rr, tap.x, tap.y)) { touch = { kind: 'rail', i, held: 0, x: tap.x }; V.drag = i; break; }
        }
        if (!touch) {
          for (let i = 0; i < D.slots.length; i++) {
            if (inRect(D.slots[i].col, tap.x, tap.y)) {
              touch = { kind: 'doll', i, held: 0, x: tap.x, cx: D.slots[i].cx, fired: false }; pl.selDoll = i;
              // Build and Hold: the push lands the moment the finger does (no wait for the lift); in Settle it waits for the lift so a resting finger steadies
              if (W.phase === 'tune' || W.t < PHASES.RAMP + PHASES.HOLD) {
                const dx = tap.x - touch.cx;
                cmd.taps.push({ i, dir: dx > 0 ? -1 : 1, mag: clamp(Math.abs(dx) / (D.R * 1.05), 0, 1) }); touch.fired = true;
              }
              break;
            }
          }
        }
      }
    }
    if (keys.has('Escape') || keys.has('KeyP')) { pausePlay(); return; }
    if (keys.has('KeyH')) showHint(pl);
    if (!auto) {
      if ((keys.has('Space') || keys.has('Enter')) && W.phase === 'tune') startNow = true;
      for (let d = 0; d < W.L.n; d++) if (keys.has('Digit' + (d + 1))) pl.selDoll = d;
      const sd = clamp(pl.selDoll, 0, W.L.n - 1);
      if (keys.has('ArrowLeft') || keys.has('KeyA')) cmd.taps.push({ i: sd, dir: -1, mag: 1 });
      if (keys.has('ArrowRight') || keys.has('KeyD')) cmd.taps.push({ i: sd, dir: 1, mag: 1 });
      const up = (kd.has('ArrowUp') ? 1 : 0) - (kd.has('ArrowDown') ? 1 : 0);
      if (up) cmd.ballast[sd] = clamp(W.dolls[sd].b + up * 0.5 * dt, 0, 1);
      // pointer: drag a bead, push or steady a doll
      if (touch) {
        if (p.down || p.pressed || p.released) { touch.x = p.x; if (!tap) touch.held += dt; }
        if (touch.kind === 'rail' && (p.down || p.released)) {
          const nb = railX(D.slots[touch.i].rail, p.x);
          const old = W.dolls[touch.i].b;
          cmd.ballast[touch.i] = nb;
          if (Math.floor(nb * 25) !== Math.floor(old * 25)) tone({ freq: 300 + nb * 700, dur: 0.05, type: 'triangle', vol: 0.06 });
        }
        if (touch.kind === 'doll' && p.down && touch.held > PHYS.HOLD_AFTER) cmd.hold[touch.i] = true;
        if (p.released) {
          if (touch.kind === 'doll' && !touch.fired && touch.held <= PHYS.HOLD_AFTER) {
            const dx = touch.x - touch.cx, mag = clamp(Math.abs(dx) / (D.R * 1.05), 0, 1);
            cmd.taps.push({ i: touch.i, dir: dx > 0 ? -1 : 1, mag });
          }
          V.drag = -1; touch = null;
        } else if (!p.down && !tap) { V.drag = -1; touch = null; }
      }
    }
    if (startNow) cmd.start = true;
    updateGuides(V, W);
    stepView(V, dt, W);
    // the practice hint: the clock stands still while the tuning marks and the arrows are lit
    if (pl.hintT > 0) {
      pl.hintT -= dt;
      if (pl.hintT <= 0) pl.hintCard = null;
      return;
    }
    // Watch and Learn: Think then Reveal before each part, with the clock stopped
    if (auto && pl.auto && pl.auto.phase !== 'act') {
      const a = pl.auto; a.timer -= dt;
      if (a.timer <= 0) {
        if (a.phase === 'think') { a.phase = 'reveal'; a.timer = REVEAL_SECONDS; a.total = REVEAL_SECONDS; pl.reveal = { sec: a.sec }; }
        else { a.phase = 'act'; pl.reveal = null; }
      }
      return;
    }
    if (auto && pl.auto) {
      if (W.phase === 'tune') {
        // the performer slides every bead to its mark, then starts
        const tb = targetBallast(W.L); let done = true;
        W.dolls.forEach((o, i) => {
          const d = tb[i] - o.b, step = clamp(d, -0.7 * dt, 0.7 * dt);
          if (Math.abs(d) > 0.002) done = false;
          cmd.ballast[i] = o.b + step;
        });
        pl.tuneHold = done ? pl.tuneHold + dt : 0;
        if (pl.tuneHold > 0.6) cmd.start = true;
      } else {
        const nx = SECTIONS[pl.secIdx + 1];
        if (nx !== undefined && W.t + dt >= nx && !W.over) { pl.secIdx += 1; beginThink(pl, pl.secIdx + 1); return; }
        const b = botCommand(W, 0.95);
        cmd.taps = b.taps; cmd.hold = b.hold;
      }
    }
    stepWorld(W, dt, cmd);
    if (auto && W.events.some((e) => e.type === 'start')) { pl.secIdx = 0; beginThink(pl, 1); }
    applyEvents(V, W, true, P.stage);
    if (W.over) finishRun();
  }

  function finishRun() {
    const pl = state.pl, W = pl.W;
    const res = resultOf(W);
    const key = bestKey(pl.idx), old = state.best[key] ?? {};
    res.mode = pl.mode;
    if (pl.mode !== 'play') res.stars = 0;
    res.newBest = false;
    if (pl.mode === 'play') {
      res.newBest = !old.score || res.score > old.score;
      state.best[key] = { score: Math.max(old.score || 0, res.score), stars: Math.max(old.stars || 0, res.stars) };
      storage.set('best', state.best);
    }
    env.monetization.track?.('perf_end', { level: pl.idx, mode: pl.mode, stars: res.stars });
    pl.over = true; state.result = res; state.scene = 'result'; state.sceneT = 0;
  }

  const pauseItems = () => ['resume', 'restart', 'quit'];
  function updatePauseMenu(tap, input) {
    const pl = state.pl, items = pauseItems(), M = menuRects(lay(), items.length, 96);
    const k = input.keys.pressed;
    if ((k.has('Escape') || k.has('KeyP')) && !pl.over) { resumePlay(); return; }
    const choose = (it) => {
      if (it === 'resume') resumePlay();
      else if (it === 'restart') startPlay(pl.mode, pl.idx);
      else go('levels');
    };
    // keyboard: Up/Down move the highlight, Enter or Space picks it
    pl.pauseIdx = pl.pauseIdx ?? 0;
    if (k.has('ArrowDown') || k.has('KeyS')) pl.pauseIdx = (pl.pauseIdx + 1) % items.length;
    if (k.has('ArrowUp') || k.has('KeyW')) pl.pauseIdx = (pl.pauseIdx + items.length - 1) % items.length;
    if (k.has('Enter') || k.has('Space')) { choose(items[pl.pauseIdx]); return; }
    if (!tap) return;
    items.forEach((it, i) => { if (inRect(M.btns[i], tap.x, tap.y)) choose(it); });
  }

  // ---- menus and documents -------------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs, cyc = (v, n) => (v + 1) % n;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'think') p.thinkIdx = cyc(p.thinkIdx, THINK_CHOICES.length);
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') {
      if (state.restoreBusy || state.owned || state.demo || !mon?.restore) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
      Promise.resolve(mon.restore()).then(() => {
        state.owned = !!mon.owns('unlock_game');
        state.restoreMsg = state.owned ? 'Restored. Thank you.' : 'No earlier purchase found.';
      }).catch(() => { state.restoreMsg = 'Could not reach the store.'; }).finally(() => { state.restoreBusy = false; });
      return;
    }
    savePrefs();
  }
  function updateDoc(input) {
    const p = input.pointer, max = docMetrics.max, view = ui.view;
    const setScroll = (v) => { state.docScroll = Math.max(0, Math.min(v, max)); };
    const wy = input.wheel?.dy || 0;
    if (wy) setScroll(state.docScroll + wy);
    const k = input.keys.pressed;
    if (k.has('ArrowDown')) setScroll(state.docScroll + 70);
    if (k.has('ArrowUp')) setScroll(state.docScroll - 70);
    if (k.has('PageDown')) setScroll(state.docScroll + docMetrics.view * 0.9);
    if (k.has('PageUp')) setScroll(state.docScroll - docMetrics.view * 0.9);
    if (k.has('Escape')) { go(state.backTo); return; }
    if (p.pressed) drag = { x0: p.x, y0: p.y, s0: state.docScroll, moved: false, inView: inRect(view, p.x, p.y) };
    if (drag && p.down) {
      if (Math.abs(p.y - drag.y0) > 14) drag.moved = true;
      if (drag.moved && drag.inView) setScroll(drag.s0 - (p.y - drag.y0));
    }
    if (drag && p.released) {
      const d = drag; drag = null;
      if (d.moved) return;
      for (const h of ui.hits) {
        if (!inRect(h.r, d.x0, d.y0)) continue;
        if (h.clip && !inRect(h.clip, d.x0, d.y0)) continue;
        docAction(h.id); return;
      }
    }
  }
  function docAction(id) {
    if (id === 'back') { go(state.backTo); return; }
    if (id === 'textDec' || id === 'textInc') {
      const n = state.prefs.textIdx + (id === 'textInc' ? 1 : -1);
      if (n < 0 || n >= TEXT_SCALES.length) return;
      state.docFrac = docMetrics.max > 0 ? state.docScroll / docMetrics.max : 0; state.docRescale = true;
      state.prefs.textIdx = n; savePrefs(); return;
    }
    const pages = rulesPages().length;
    if (id === 'prev') { if (state.rulesPage > 0) { state.rulesPage -= 1; state.docScroll = 0; } return; }
    if (id === 'next') { if (state.rulesPage < pages - 1) { state.rulesPage += 1; state.docScroll = 0; } else go(state.backTo); return; }
    if (id.startsWith('set:')) settingsAction(id.slice(4));
  }

  function updateTitle(tap) {
    if (!tap) return;
    const T = lay().title, hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(T.play)) go('levels');
    else if (hit(T.auto)) { state.sel = 0; startPlay('auto', 0); }
    else if (hit(T.how)) openDoc('howto', 'title');
    else if (hit(T.rules)) openDoc('rules', 'title');
    else if (hit(T.about)) openDoc('about', 'title');
    else if (hit(T.settings)) openDoc('settings', 'title');
    else if (inRect(T.lock, tap.x, tap.y)) { pressLockup(); env.openArcforgeHome?.(); }
  }
  function updateLevels(tap) {
    if (!tap) return;
    const G = lay().levels;
    if (inRect(G.back, tap.x, tap.y)) { go('title'); return; }
    if (inRect(G.daily, tap.x, tap.y)) { state.sel = DAILY; go('detail'); return; }
    G.cells.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) { state.sel = i; go('detail'); } });
  }
  function updateDetail(tap) {
    if (!tap) return;
    const D = lay().detail;
    if (inRect(D.back, tap.x, tap.y)) go('levels');
    else if (inRect(D.learn, tap.x, tap.y)) startPlay('practice');
    else if (inRect(D.race, tap.x, tap.y)) startPlay('play');
    else if (inRect(D.watch, tap.x, tap.y)) startPlay('auto');
  }
  function updateResult(tap) {
    if (!tap) return;
    const Rr = lay().result, r = state.result;
    if (inRect(Rr.again, tap.x, tap.y)) startPlay(r.mode, r.level);
    else if (inRect(Rr.next, tap.x, tap.y) && r.level < LEVEL_COUNT - 1) { state.sel = r.level + 1; go('detail'); }
    else if (inRect(Rr.levels, tap.x, tap.y)) go('levels');
    else if (inRect(Rr.menu, tap.x, tap.y)) go('title');
    else if (tap.y > Rr.more.y - 30 && tap.y < Rr.more.y + 14) env.openArcforgeHome?.();
  }

  // ---- the object the kit and main.js see ------------------------------------------------------------------------------------------
  const idle = () => ({ pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } });
  const asPerformer = (pl) => {
    pl.mode = 'auto'; pl.auto = { phase: 'act', timer: 0, total: 1, title: '', tip: '', sec: 0 };
    const tb = targetBallast(pl.W.L); pl.W.dolls.forEach((o, i) => { o.b = tb[i]; });
    stepWorld(pl.W, 1 / 60, { start: true }); pl.secIdx = 0;
  };
  const api = {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc !== 'play') stepMenu(dt);
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'levels') updateLevels(tap);
      else if (sc === 'detail') updateDetail(tap);
      else if (sc === 'play') updatePlay(dt, tap, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems); },
    getState: () => state,
    // Called by main.js when the app goes to the background.
    autoPause() { if (state.scene === 'play') pausePlay(); },
    // Everything except real play is free: menus, Rules, Watch and Learn, results, pause.
    isPreviewExempt() {
      const pl = state.pl;
      return !(state.scene === 'play' && pl && pl.mode !== 'auto' && !pl.paused && !pl.over);
    },
    // Tester tools (?dev=1 and ?shot=1): jump to a screen and fast-forward.
    dev: {
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.level !== undefined) state.sel = o.level;
        const sc = o.scene ?? 'title';
        if (sc === 'play') {
          state.demo = false;
          startPlay(o.mode ?? 'play', state.sel);
          if (o.play && state.pl) asPerformer(state.pl);
          else if (o.tuned && state.pl) { const tb = targetBallast(state.pl.W.L); state.pl.W.dolls.forEach((d, i) => { d.b = tb[i]; }); }
        } else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          state.demo = false;
          startPlay('play', state.sel); asPerformer(state.pl); state.pl.mode = 'play';
          for (let i = 0; i < 60 * 60 && state.scene === 'play'; i++) {
            const pl = state.pl, b = botCommand(pl.W, 0.9);
            stepWorld(pl.W, 1 / 60, b); stepView(pl.V, 1 / 60, pl.W); if (pl.W.over) finishRun();
          }
          if (state.result) { state.result.newBest = true; state.result.mode = 'play'; }
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.pause && state.pl) pausePlay();
        if (o.advance) for (let i = 0; i < o.advance * 60; i++) api.update(1 / 60, idle());
      },
    },
  };
  return api;
}
