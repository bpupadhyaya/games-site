// Perch: the bird's-eye reverse of a slingshot game. See design/GDD.md.
import { newRun, step, stars, chooseTarget, threatened, perchPoint } from './rules.js';
import { drawScene, drawText, W, H } from './render.js';
import { T, SLOTS, AUTO_THINK_STEPS, AUTO_REVEAL_SECS } from './tuning.js';
import { RULES } from './content.js';
import { renderRulesPage, RULES_ENTRY_BOX, RULES_BACK_BOX, RULES_NEXT_BOX, TEXT_DEC_BOX, TEXT_INC_BOX, TEXT_SCALES } from './rulesView.js';
import { renderAutoChrome, AUTO_EXIT_BOX, AUTO_SKIP_BOX, AUTO_DEC_BOX, AUTO_INC_BOX, AUTO_AGAIN_BOX, AUTO_EXIT2_BOX } from './autoView.js';

// Auto Play ("Watch & Learn"): title-screen entry box, top-left, mirroring RULES_ENTRY_BOX's
// top-right position and size exactly (this game's own established button style).
const AUTO_ENTRY_BOX = { x0: 16, y0: 26, x1: 176, y1: 96 };

export const meta = { width: W, height: H };

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', level: 1, unlocked: 1, stars: {}, run: newRun(1), best: 0, bestTime: 0, feathers: 0, runs: 0, demoRuns: 0, lock: 0, clock: 0, page: 0, textScaleIdx: 0,
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
    state.auto = { sub: 'watch', timer: 0, target: -1 };
  };
  const exitAuto = () => { state.scene = 'title'; state.auto = null; fx.length = 0; };
  const updateAuto = (dt, tap) => {
    const A = state.auto, at = typeof tap === 'object' && tap ? tap : null;
    const inBox = (b) => at && at.x >= b.x0 && at.x <= b.x1 && at.y >= b.y0 && at.y <= b.y1;
    if (inBox(AUTO_EXIT_BOX)) { exitAuto(); return; }
    if (A.sub === 'end') {
      if (inBox(AUTO_AGAIN_BOX)) startAutoPlay();
      else if (inBox(AUTO_EXIT2_BOX)) exitAuto();
      return; // frozen at the result screen either way
    }
    if (inBox(AUTO_SKIP_BOX)) { if (A.sub === 'think' || A.sub === 'reveal') A.timer = 0; }
    if (inBox(AUTO_DEC_BOX)) { if (state.autoThinkIdx > 0) { state.autoThinkIdx--; storage.set('autoThinkIdx', state.autoThinkIdx); } return; }
    if (inBox(AUTO_INC_BOX)) { if (state.autoThinkIdx < AUTO_THINK_STEPS.length - 1) { state.autoThinkIdx++; storage.set('autoThinkIdx', state.autoThinkIdx); } return; }

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

  return {
    update(dt, input) {
      state.clock += dt;
      const key = input.keys.pressed.has('Space') || input.keys.pressed.has('Enter');
      // a pointer press carries its position (levels 2 and up: the tapped perch); a key press is just "go"
      const tap = input.pointer.pressed ? { x: input.pointer.x, y: input.pointer.y } : key;
      for (const f of fx) { f.life -= dt; if (f.net) continue; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 520 * dt; f.rot += f.vr * dt; }
      while (fx.length && fx[0].life <= 0) fx.shift();
      if (state.scene === 'play') {
        step(state.run, dt, tap, rng);
        sound(state.run.events);
        if (state.run.over || state.run.won) endRun();
      } else if (state.scene === 'over' || state.scene === 'won') {
        state.lock -= dt;
        if (tap && state.lock <= 0) {
          if (state.scene === 'won') state.level = state.level + 1;
          startRun();
        }
      } else if (state.scene === 'title') {
        if (tap) {
          const at = typeof tap === 'object' ? tap : null;
          const inBox = (x0, y0, x1, y1) => at && at.x >= x0 && at.x <= x1 && at.y >= y0 && at.y <= y1;
          if (inBox(RULES_ENTRY_BOX.x0, RULES_ENTRY_BOX.y0, RULES_ENTRY_BOX.x1, RULES_ENTRY_BOX.y1)) { state.scene = 'rules'; state.page = 0; }
          else if (inBox(AUTO_ENTRY_BOX.x0, AUTO_ENTRY_BOX.y0, AUTO_ENTRY_BOX.x1, AUTO_ENTRY_BOX.y1)) { startAutoPlay(); }
          // tester level picker: only with the Developer toggle on, never in production
          else if (dev && inBox(20, 1090, 200, 1270)) { state.level = state.level > 1 ? state.level - 1 : 12; state.run = newRun(state.level); }
          else if (dev && inBox(520, 1090, 700, 1270)) { state.level = state.level < 12 ? state.level + 1 : 1; state.run = newRun(state.level); }
          else { saveProgress(); startRun(); }
        }
      } else if (state.scene === 'rules') {
        if (tap) {
          const at = typeof tap === 'object' ? tap : null;
          const inBox = (b) => at && at.x >= b.x0 && at.x <= b.x1 && at.y >= b.y0 && at.y <= b.y1;
          // Steps back one page first (never discards where the player was mid-list); only exits
          // to the title once already on page one.
          if (inBox(RULES_BACK_BOX)) { if (state.page > 0) state.page--; else state.scene = 'title'; }
          // On the last page the label reads "Done" (rulesView.js) and exits to the title instead
          // of silently wrapping back to page one, so it's never a dead-end tap.
          else if (inBox(RULES_NEXT_BOX)) { if (state.page === RULES.length - 1) { state.scene = 'title'; state.page = 0; } else state.page++; }
          else if (inBox(TEXT_DEC_BOX) && state.textScaleIdx > 0) { state.textScaleIdx--; storage.set('textScaleIdx', state.textScaleIdx); }
          else if (inBox(TEXT_INC_BOX) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; storage.set('textScaleIdx', state.textScaleIdx); }
          else if (!at) { if (state.page === RULES.length - 1) { state.scene = 'title'; state.page = 0; } else state.page++; } // keyboard Space/Enter: next page
        }
      } else if (state.scene === 'auto') {
        updateAuto(dt, tap);
      }
    },

    render(ctx) {
      const s = state.run, t = state.clock;
      drawScene(ctx, s, fx, t, state.scene === 'title' || state.scene === 'demo-limit');
      const starRow = (n, y) => { for (let i = 0; i < 3; i++) drawText(ctx, '★', W / 2 + (i - 1) * 96, y, 84, i < n ? '#ffe27a' : 'rgba(255,255,255,0.3)'); };
      if (state.scene === 'title') {
        drawText(ctx, 'Perch', W / 2, 250, 120);
        drawText(ctx, 'Read the stone. Choose your moment.', W / 2, 320, 30, '#fff8e0', 700);
        drawText(ctx, 'Rules', W - 96, 66, 30, '#fff8e0', 800);
        drawText(ctx, 'Auto Play', 96, 66, 26, '#fff8e0', 800);
        drawText(ctx, state.level > 1 || dev ? 'Level ' + state.level + ' · ' + s.name : 'Tap to play', W / 2, 1150, 40, '#ffe27a');
        if (state.level > 1 || dev) drawText(ctx, 'Tap to play', W / 2, 1200, 30, '#fff', 700);
        if (dev) { drawText(ctx, '‹', 110, 1175, 110, '#fff8e0'); drawText(ctx, '›', 610, 1175, 110, '#fff8e0'); drawText(ctx, 'TEST BUILD', W / 2, 1250, 22, '#9fe8ff', 700); }
        if (state.best > 0) drawText(ctx, 'Best ' + state.best, W / 2, 1232, 30, '#fff', 700);
      } else if (state.scene === 'rules') {
        ctx.fillStyle = 'rgba(8,12,24,0.86)'; ctx.fillRect(0, 0, W, H);
        renderRulesPage(ctx, RULES, state.page, t, state.textScaleIdx);
      } else if (state.scene === 'over') {
        ctx.fillStyle = 'rgba(15,25,45,0.55)'; ctx.fillRect(0, 0, W, H);
        drawText(ctx, 'Ruffled!', W / 2, 400, 96);
        drawText(ctx, 'Level ' + s.level + ' · ' + Math.round(s.t) + ' of ' + s.duration + ' s', W / 2, 500, 36, '#fff', 700);
        drawText(ctx, String(s.score), W / 2, 660, 150, '#ffe27a');
        drawText(ctx, `${s.dodges} dodges · ${s.closeCalls} close calls`, W / 2, 730, 30, '#fff', 700);
        if (state.lock <= 0) drawText(ctx, 'Tap to try again', W / 2, 920, 48, '#ffe27a');
      } else if (state.scene === 'won') {
        ctx.fillStyle = 'rgba(30,20,50,0.5)'; ctx.fillRect(0, 0, W, H);
        drawText(ctx, 'Sunset!', W / 2, 380, 100, '#ffd27a');
        drawText(ctx, 'Level ' + s.level + ' cleared', W / 2, 460, 42);
        starRow(stars(s), 610);
        drawText(ctx, String(s.score), W / 2, 780, 120, '#ffe27a');
        drawText(ctx, `${s.hits === 0 ? 'Not a feather ruffled' : s.hits + ' hit' + (s.hits > 1 ? 's' : '')} · ${s.closeCalls} close calls`, W / 2, 850, 30, '#fff', 700);
        if (state.lock <= 0) drawText(ctx, 'Tap for level ' + (s.level + 1), W / 2, 1000, 48, '#ffe27a');
      } else if (state.scene === 'demo-limit') {
        ctx.fillStyle = 'rgba(15,25,45,0.7)'; ctx.fillRect(0, 0, W, H);
        drawText(ctx, 'That was the taste.', W / 2, 520, 64);
        drawText(ctx, 'Get Perch on iPhone and Android', W / 2, 610, 34, '#fff8e0', 700);
        drawText(ctx, 'for every level.', W / 2, 656, 34, '#fff8e0', 700);
      } else if (state.scene === 'auto') {
        const A = state.auto;
        if (A.sub === 'end') {
          ctx.fillStyle = s.won ? 'rgba(30,20,50,0.5)' : 'rgba(15,25,45,0.55)'; ctx.fillRect(0, 0, W, H);
          drawText(ctx, s.won ? 'Sunset!' : 'Ruffled!', W / 2, 380, 90, s.won ? '#ffd27a' : '#fff');
          drawText(ctx, 'Auto Play · Level ' + s.level + ' · ' + s.name, W / 2, 460, 28, '#fff8e0', 700);
          drawText(ctx, String(s.score), W / 2, 620, 110, '#ffe27a');
          drawText(ctx, `${s.dodges} dodges · ${s.closeCalls} close calls`, W / 2, 690, 28, '#fff', 700);
          drawText(ctx, 'Play again', 205, 1006, 34, '#ffe27a', 800);
          drawText(ctx, 'Exit', 515, 1006, 34, '#fff', 800);
        } else {
          renderAutoChrome(ctx, s, A, state.autoThinkIdx, t);
        }
      }
      if (state.scene === 'play' && state.run.t < 6 && !state.run.blurb) drawText(ctx, 'Tap to flit when a red ring appears on you', W / 2, 1190, 30, '#fff', 700);
    },

    getState: () => state,
    // Auto Play is meant to be free like the menu's own attract-mode preview, never gated behind
    // the paid unlock - it's a teaching/marketing tool, not real play. Checked by kit/preview.js
    // (createPreviewGate) once per frame; requires kit 1.6.1+.
    isPreviewExempt: () => state.scene === 'auto',
  };
}
