// Perch: the bird's-eye reverse of a slingshot game. See design/GDD.md.
import { newRun, step, stars, chooseTarget, threatened, perchPoint } from './rules.js';
import { drawScene, drawText, W, H, autoReveal } from './render.js';
import { T, SLOTS, AUTO_THINK_STEPS, AUTO_REVEAL_SECS } from './tuning.js';
import { RULES } from './content.js';
import { renderRules, rulesMetrics } from './rulesView.js';
import { layoutFor, inRect, TEXT_SCALES } from './layout.js';
import { drawHud, drawTitle, drawPause, drawResult, drawDemoLimit, renderAutoChrome } from './ui.js';

// `meta.width/height` are updated live by the kit on every resize (fluid viewport, short side 720); every position comes from
// layoutFor(meta.width, meta.height).
export const meta = { width: W, height: H, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };   // fed by main.js (the kit has no wheel event); scrolls the Rules reader
const LY = () => layoutFor(meta.width, meta.height);

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', level: 1, unlocked: 1, stars: {}, run: newRun(1), best: 0, bestTime: 0, feathers: 0, runs: 0, demoRuns: 0, lock: 0, clock: 0, page: 0, textScaleIdx: 0,
    land: LY().land, rulesScroll: 0,
    autoThinkIdx: 1, // index into AUTO_THINK_STEPS ([1,2,4,6]s); Auto Play's THINK pause, default 2s
    auto: null, // Auto Play ("Watch & Learn") run state while scene === 'auto'; see startAutoPlay()
  };
  const fx = [];
  const dev = config.dev === true;   // tester level picker: only while the app's Developer toggle is on (kit 1.6.0+)
  const fxRng = rng.fork();

  storage.get('best', 0).then((v) => { state.best = Math.max(state.best, v); });
  storage.get('bestTime', 0).then((v) => { state.bestTime = Math.max(state.bestTime, v); });
  storage.get('feathers', 0).then((v) => { state.feathers = Math.max(state.feathers, v); });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  // The Rules page text-size step: clamped on load so a stale index from a build with a
  // different-length TEXT_SCALES array can never produce a NaN/undefined font size.
  storage.get('textScaleIdx', 0).then((v) => { state.textScaleIdx = Math.min(Math.max(v ?? 0, 0), TEXT_SCALES.length - 1); });
  // Same clamp-on-load pattern: a stale index from a build with a different-length
  // AUTO_THINK_STEPS array can never produce a NaN/undefined think time.
  storage.get('autoThinkIdx', 1).then((v) => { state.autoThinkIdx = Math.min(Math.max(v ?? 1, 0), AUTO_THINK_STEPS.length - 1); });
  storage.get('progress', null).then((v) => {
    if (!v) return;
    state.unlocked = dev ? 99 : Math.max(state.unlocked, v.unlocked || 1);
    state.stars = { ...v.stars, ...state.stars };
    if (state.scene === 'title') { state.level = Math.min(state.unlocked, Math.max(state.level, v.level || 1)); state.run = newRun(state.level); }
  });
  if (dev) state.unlocked = 99;
  const saveProgress = () => storage.set('progress', { unlocked: state.unlocked, level: state.level, stars: state.stars });

  const startRun = () => {
    if (config.demo && state.demoRuns >= T.DEMO_RUNS) { state.scene = 'demo-limit'; return; }
    state.run = newRun(state.level); state.scene = 'play'; state.runs += 1; fx.length = 0;
    if (config.demo) { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    monetization.track('level_start', { level: state.level });
  };

  const burst = (x, y, n, gold = false) => {
    for (let i = 0; i < n; i++) fx.push({ x, y, vx: fxRng.range(-150, 150), vy: fxRng.range(-260, -40), rot: fxRng.range(0, 6), vr: fxRng.range(-6, 6), life: 1.1, max: 1.1, col: gold ? (fxRng.chance(0.5) ? '#ffd24a' : '#fff3b0') : fxRng.chance(0.5) ? '#f0a070' : '#ffe6c8' });
  };

  // Auto Play is silent by design, exactly like the menu's own attract-mode preview - a real,
  // painful bug elsewhere in this codebase came from an auto-playing demo making real sound, so
  // every audio.tone() call is routed through this local `tone()` gate instead of calling
  // audio.tone directly. Visual effects (bursts, the net ring) are NOT gated: Auto Play should
  // still look exactly like a real run, just make no sound during it.
  const sound = (events) => {
    const tone = (o) => { if (state.scene !== 'auto') audio.tone(o); };
    for (const e of events) {
      if (e.t === 'pull') tone({ freq: 160 + (e.slot % 4) * 20, to: 300, dur: 0.5, type: 'sawtooth', vol: 0.05 });
      else if (e.t === 'launch') tone({ freq: 700, to: 200, dur: 0.14, type: 'triangle', vol: 0.07 });
      else if (e.t === 'flit') tone({ freq: 500, to: 900, dur: 0.12, type: 'sine', vol: 0.08 });
      else if (e.t === 'dodge' && e.close) tone({ freq: 880, to: 1320, dur: 0.16, type: 'sine', vol: 0.09 });
      else if (e.t === 'thud') tone({ freq: 90, to: 60, dur: 0.1, type: 'sine', vol: 0.09 });
      else if (e.t === 'hit') { tone({ freq: 220, to: 90, dur: 0.3, type: 'square', vol: 0.06 }); burst(e.x, e.y, 14); }
      else if (e.t === 'won') { tone({ freq: 523, to: 784, dur: 0.4, type: 'triangle', vol: 0.09 }); }
      else if (e.t === 'seed') { tone({ freq: 880, to: 1760, dur: 0.18, type: 'sine', vol: 0.09 }); burst(e.x, e.y - 30, 10, true); }
      else if (e.t === 'seedAppears') tone({ freq: 1200, to: 1500, dur: 0.08, type: 'sine', vol: 0.04 });
      else if (e.t === 'heal') tone({ freq: 660, to: 990, dur: 0.3, type: 'triangle', vol: 0.09 });
      else if (e.t === 'net') { tone({ freq: 140, to: 70, dur: 0.25, type: 'sawtooth', vol: 0.07 }); fx.push({ net: true, x: e.x, y: e.y, r: e.r, life: 0.9, max: 0.9, vx: 0, vy: 0, rot: 0, vr: 0, col: '#fff' }); }
      else if (e.t === 'beater') tone({ freq: 300, to: 220, dur: 0.16, type: 'square', vol: 0.05 });
      else if (e.t === 'flush') tone({ freq: 400, to: 800, dur: 0.15, type: 'sawtooth', vol: 0.06 });
      else if (e.t === 'outsmart') tone({ freq: 760, to: 1100, dur: 0.12, type: 'sine', vol: 0.08 });
      else if (e.t === 'boss') tone({ freq: 90, to: 60, dur: 0.18, type: 'sine', vol: 0.09 });
      else if (e.t === 'ammo') tone({ freq: 700, to: 1000, dur: 0.1, type: 'triangle', vol: 0.07 });
      else if (e.t === 'throw') tone({ freq: 500, to: 300, dur: 0.12, type: 'triangle', vol: 0.07 });
      else if (e.t === 'knock') { const sl = SLOTS[e.slot]; tone({ freq: 240, to: 120, dur: 0.22, type: 'square', vol: 0.08 }); burst(sl.x, sl.y - 110 * sl.s, 14, true); }
    }
  };

  const endRun = () => {
    const r = state.run; state.lock = 0.7;
    state.scene = r.won ? 'won' : 'over';
    if (r.score > state.best) { state.best = r.score; storage.set('best', r.score); }
    if (r.t > state.bestTime) { state.bestTime = +r.t.toFixed(1); storage.set('bestTime', state.bestTime); }
    state.feathers += Math.floor(r.score / 10) + (r.won ? stars(r) : 0); storage.set('feathers', state.feathers);
    if (r.won) {
      const st = stars(r);
      state.stars[state.level] = Math.max(state.stars[state.level] || 0, st);
      state.unlocked = Math.max(state.unlocked, state.level + 1);
      saveProgress();
    }
    monetization.track('level_end', { level: state.level, won: r.won, score: r.score, seconds: Math.round(r.t) });
  };

  // ---------------------------------------------------------------- Auto Play ("Watch & Learn")
  // Teaches the whole game by demonstration: THINK (state sits still, viewer works out their own
  // guess) -> REVEAL (the perches the bird could reach are ringed, the one about to be chosen
  // marked distinctly) -> ACT (the flit actually happens, via the exact same step()/chooseTarget()
  // code real play uses) -> back to THINK for the next decision, for a whole level, to a real
  // end (survive to sunset or run out of feathers). Never touches best/bestTime/feathers/stars/
  // progress/demoRuns - state.auto is its own, separate, throwaway state.
  //
  // The decision point: a shot/obstacle-response, exactly as the shared brief's perch note asks
  // for. `threatened()` (rules.js) already tells us a stone or a hunter's pull-back is aimed near
  // the bird's own perch - the same signal that drives the existing levels 2-3 safe-ring hint - so
  // a THINK phase begins the instant the bird is free to act (not mid-flit/resting/stunned) and a
  // threat exists. Because THINK and REVEAL genuinely freeze the run (no step() calls happen during
  // them), none of that lead time is ever spent: whatever margin existed when the threat was first
  // noticed is still there, unchanged, when ACT finally commits - so the pause never causes a dodge
  // to arrive "late" relative to when a real player would have had to react.
  const startAutoPlay = () => {
    state.run = newRun(state.level); state.scene = 'auto'; fx.length = 0;
    state.auto = { sub: 'watch', timer: 0, target: -1, paused: false };
  };
  const exitAuto = () => { state.scene = 'title'; state.auto = null; fx.length = 0; state.run = newRun(state.level); };
  const updateAuto = (dt, tap) => {
    const A = state.auto, L = LY(), B = L.btn.auto, at = typeof tap === 'object' && tap ? tap : null;
    const hit = (r) => at && inRect(r, at.x, at.y);
    if (A.sub === 'end') {
      const won = state.run.won;
      if (hit(won ? L.btn.result.againW : L.btn.result.again)) startAutoPlay();
      else if (hit(won ? L.btn.result.menuW : L.btn.result.menu)) exitAuto();
      return; // frozen at the result screen either way
    }
    if (hit(B.exit)) { exitAuto(); return; }
    if (hit(B.pause)) { A.paused = !A.paused; return; }
    if (hit(B.dec)) { if (state.autoThinkIdx > 0) { state.autoThinkIdx--; storage.set('autoThinkIdx', state.autoThinkIdx); } return; }
    if (hit(B.inc)) { if (state.autoThinkIdx < AUTO_THINK_STEPS.length - 1) { state.autoThinkIdx++; storage.set('autoThinkIdx', state.autoThinkIdx); } return; }
    if (A.paused) return;                                  // a real pause: nothing advances, the run is frozen where it is
    if (hit(B.skip)) { if (A.sub === 'think' || A.sub === 'reveal') A.timer = 0; }

    const s = state.run;
    if (A.sub === 'think' || A.sub === 'reveal') {
      A.timer -= dt;
      if (A.timer > 0) return;
      if (A.sub === 'think') { A.sub = 'reveal'; A.timer = AUTO_REVEAL_SECS; return; }
      // REVEAL's time is up: commit, via the real tap-driven code path in step() - a tap placed
      // exactly on the chosen perch resolves to that perch on both level 1 (which ignores the tap
      // position and re-derives the same chooseTarget() destination) and level 2+ (which picks the
      // reachable perch nearest the tap - itself, at distance 0).
      const pt = perchPoint(s.perches, A.target);
      step(s, dt, { x: pt.x, y: pt.y }, rng);
      sound(s.events);
      A.sub = 'watch'; A.target = -1;
      if (s.over || s.won) A.sub = 'end';
      return;
    }
    // 'watch': let the real simulation run, exactly like normal play with nobody tapping, until
    // the next decision point.
    step(s, dt, null, rng);
    sound(s.events);
    if (s.over || s.won) { A.sub = 'end'; return; }
    const b = s.bird;
    if (b.flit < 0 && b.rest <= 0 && b.stun <= 0 && threatened(s)) {
      const dest = chooseTarget(s);
      if (dest >= 0 && dest !== b.perch) { A.sub = 'think'; A.timer = AUTO_THINK_STEPS[state.autoThinkIdx]; A.target = dest; }
    }
  };

  // ---------------------------------------------------------------- Rules reader (scrolling)
  let drag = null;
  const updateRules = (input, tap) => {
    const L = LY(), RL = L.rules, B = L.btn.rules, p = input.pointer, keys = input.keys.pressed;
    const max = () => rulesMetrics.max;
    const setScroll = (v) => { state.rulesScroll = Math.max(0, Math.min(v, max())); };
    if (wheelInput.dy) { setScroll(state.rulesScroll + wheelInput.dy); wheelInput.dy = 0; }
    if (keys.has('ArrowDown')) setScroll(state.rulesScroll + 70);
    if (keys.has('ArrowUp')) setScroll(state.rulesScroll - 70);
    if (keys.has('PageDown')) setScroll(state.rulesScroll + rulesMetrics.view * 0.9);
    if (keys.has('PageUp')) setScroll(state.rulesScroll - rulesMetrics.view * 0.9);
    if (keys.has('Home')) setScroll(0);
    if (keys.has('End')) setScroll(max());
    if (keys.has('Escape')) { state.scene = 'title'; return; }
    if (p.pressed) {
      if (inRect(RL.scrollbar, p.x, p.y)) drag = { bar: true };
      else if (inRect(RL.viewport, p.x, p.y)) drag = { y0: p.y, s0: state.rulesScroll };
    }
    if (drag) {
      if (!p.down) drag = null;
      else if (drag.bar) setScroll(((p.y - RL.scrollbar.y) / RL.scrollbar.h) * max());
      else setScroll(drag.s0 - (p.y - drag.y0));
    }
    state.rulesScroll = Math.max(0, Math.min(state.rulesScroll, max()));
    const at = typeof tap === 'object' && tap ? tap : null;
    const hit = (r) => at && inRect(r, at.x, at.y);
    if (hit(B.back)) { drag = null; state.scene = 'title'; }
    else if (hit(B.next)) {
      if (state.rulesScroll >= max() - 2) { drag = null; state.scene = 'title'; }   // at the end the label reads "Done"
      else setScroll(state.rulesScroll + rulesMetrics.view * 0.85);
    }
    else if (hit(B.dec) && state.textScaleIdx > 0) { state.textScaleIdx--; storage.set('textScaleIdx', state.textScaleIdx); }
    else if (hit(B.inc) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; storage.set('textScaleIdx', state.textScaleIdx); }
    else if (tap === true) setScroll(state.rulesScroll + rulesMetrics.view * 0.85);   // keyboard Space/Enter: next screenful
  };

  const toMenu = (nextLevel = false) => {
    if (nextLevel) state.level += 1;
    state.run = newRun(state.level); state.scene = 'title'; fx.length = 0;
  };

  return {
    update(dt, input) {
      state.clock += dt;
      const L = LY();
      // Rotating (or resizing across portrait/landscape) in the middle of a run pauses it: the player re-aims their thumb first.
      if (L.land !== state.land) { state.land = L.land; drag = null; if (state.scene === 'play') state.scene = 'pause'; }
      const key = input.keys.pressed.has('Space') || input.keys.pressed.has('Enter');
      const esc = input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyP');
      // a pointer press carries its position (levels 2 and up: the tapped perch, in WORLD units); a key press is just "go"
      const press = input.pointer.pressed ? { x: input.pointer.x, y: input.pointer.y } : key;
      const hit = (r) => press && typeof press === 'object' && inRect(r, press.x, press.y);
      for (const f of fx) { f.life -= dt; if (f.net) continue; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 520 * dt; f.rot += f.vr * dt; }
      while (fx.length && fx[0].life <= 0) fx.shift();
      if (state.scene === 'play') {
        if (esc || hit(L.btn.play.pause)) { state.scene = 'pause'; return; }
        const tap = press && typeof press === 'object' ? L.toWorld(press.x, press.y) : press;
        step(state.run, dt, tap, rng);
        sound(state.run.events);
        if (state.run.over || state.run.won) endRun();
      } else if (state.scene === 'pause') {
        if (esc || hit(L.btn.pause.resume)) state.scene = 'play';
        else if (hit(L.btn.pause.menu)) toMenu();
      } else if (state.scene === 'over' || state.scene === 'won') {
        state.lock -= dt;
        if (press && state.lock <= 0) {
          const won = state.scene === 'won';
          if (hit(won ? L.btn.result.menuW : L.btn.result.menu)) toMenu(won);
          else { if (won) state.level = state.level + 1; startRun(); }
        }
      } else if (state.scene === 'demo-limit') {
        if (hit(L.btn.demo.menu)) toMenu();
      } else if (state.scene === 'title') {
        if (press) {
          const B = L.btn.title;
          if (hit(L.title.lockupTap)) { state.lockFlash = state.clock + 0.25; env.openArcforgeHome?.(); }
          else if (hit(B.rules)) { state.scene = 'rules'; state.rulesScroll = 0; drag = null; }
          else if (hit(B.auto)) startAutoPlay();
          // tester level picker: only with the Developer toggle on, never in production
          else if (dev && hit(B.devPrev)) { state.level = state.level > 1 ? state.level - 1 : 12; state.run = newRun(state.level); }
          else if (dev && hit(B.devNext)) { state.level = state.level < 12 ? state.level + 1 : 1; state.run = newRun(state.level); }
          else { saveProgress(); startRun(); }
        }
      } else if (state.scene === 'rules') {
        updateRules(input, press);
      } else if (state.scene === 'auto') {
        updateAuto(dt, press);
      }
    },

    render(ctx) {
      const L = LY(), s = state.run, t = state.clock, sc = state.scene;
      drawScene(ctx, s, fx, t, sc === 'title' || sc === 'demo-limit' || sc === 'rules', L);
      if (sc === 'title') {
        drawTitle(ctx, L, { level: state.level, name: s.name, best: state.best, dev, lockDown: (state.lockFlash || 0) > t });
      } else if (sc === 'play' || sc === 'pause') {
        drawHud(ctx, s, L);
        if (sc === 'play' && s.t < 6 && !s.blurb) drawText(ctx, 'Tap to flit when a red ring appears on you', L.hud.cx, L.hud.hintY, 30, '#fff', 700);
        if (sc === 'pause') drawPause(ctx, L);
      } else if (sc === 'rules') {
        state.rulesScroll = renderRules(ctx, RULES, state.rulesScroll, state.textScaleIdx, t, L);
      } else if (sc === 'over' || sc === 'won') {
        drawResult(ctx, L, s, { won: sc === 'won', lock: state.lock, label: sc === 'won' ? 'Next level' : 'Try again', starsN: stars(s) });
      } else if (sc === 'demo-limit') {
        drawDemoLimit(ctx, L);
      } else if (sc === 'auto') {
        const A = state.auto;
        if (A.sub === 'end') {
          drawResult(ctx, L, s, { won: s.won, lock: 0, label: 'Play again', auto: true });
        } else {
          if (A.sub === 'reveal') { const V = L.V; ctx.save(); ctx.translate(V.ox, V.oy); ctx.scale(V.z, V.z); autoReveal(ctx, s, t, A.target); ctx.restore(); }
          drawHud(ctx, s, L, { auto: true });
          renderAutoChrome(ctx, L, s, A, state.autoThinkIdx, t);
        }
      }
    },

    getState: () => state,
    // Auto Play is meant to be free like the menu's own attract-mode preview, never gated behind
    // the paid unlock - it's a teaching/marketing tool, not real play. Checked by kit/preview.js
    // (createPreviewGate) once per frame; requires kit 1.6.1+.
    isPreviewExempt: () => state.scene !== 'play',
  };
}
