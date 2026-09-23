// Perch: the bird's-eye reverse of a slingshot game. See design/GDD.md.
import { newRun, step, stars } from './rules.js';
import { drawScene, drawText, W, H } from './render.js';
import { T, SLOTS } from './tuning.js';
import { RULES } from './content.js';
import { renderRulesPage, RULES_ENTRY_BOX, RULES_BACK_BOX, RULES_NEXT_BOX, TEXT_DEC_BOX, TEXT_INC_BOX, TEXT_SCALES } from './rulesView.js';

export const meta = { width: W, height: H };

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = { scene: 'title', level: 1, unlocked: 1, stars: {}, run: newRun(1), best: 0, bestTime: 0, feathers: 0, runs: 0, demoRuns: 0, lock: 0, clock: 0, page: 0, textScaleIdx: 0 };
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

  const sound = (events) => {
    for (const e of events) {
      if (e.t === 'pull') audio.tone({ freq: 160 + (e.slot % 4) * 20, to: 300, dur: 0.5, type: 'sawtooth', vol: 0.05 });
      else if (e.t === 'launch') audio.tone({ freq: 700, to: 200, dur: 0.14, type: 'triangle', vol: 0.07 });
      else if (e.t === 'flit') audio.tone({ freq: 500, to: 900, dur: 0.12, type: 'sine', vol: 0.08 });
      else if (e.t === 'dodge' && e.close) audio.tone({ freq: 880, to: 1320, dur: 0.16, type: 'sine', vol: 0.09 });
      else if (e.t === 'thud') audio.tone({ freq: 90, to: 60, dur: 0.1, type: 'sine', vol: 0.09 });
      else if (e.t === 'hit') { audio.tone({ freq: 220, to: 90, dur: 0.3, type: 'square', vol: 0.06 }); burst(e.x, e.y, 14); }
      else if (e.t === 'won') { audio.tone({ freq: 523, to: 784, dur: 0.4, type: 'triangle', vol: 0.09 }); }
      else if (e.t === 'seed') { audio.tone({ freq: 880, to: 1760, dur: 0.18, type: 'sine', vol: 0.09 }); burst(e.x, e.y - 30, 10, true); }
      else if (e.t === 'seedAppears') audio.tone({ freq: 1200, to: 1500, dur: 0.08, type: 'sine', vol: 0.04 });
      else if (e.t === 'heal') audio.tone({ freq: 660, to: 990, dur: 0.3, type: 'triangle', vol: 0.09 });
      else if (e.t === 'net') { audio.tone({ freq: 140, to: 70, dur: 0.25, type: 'sawtooth', vol: 0.07 }); fx.push({ net: true, x: e.x, y: e.y, r: e.r, life: 0.9, max: 0.9, vx: 0, vy: 0, rot: 0, vr: 0, col: '#fff' }); }
      else if (e.t === 'beater') audio.tone({ freq: 300, to: 220, dur: 0.16, type: 'square', vol: 0.05 });
      else if (e.t === 'flush') audio.tone({ freq: 400, to: 800, dur: 0.15, type: 'sawtooth', vol: 0.06 });
      else if (e.t === 'outsmart') audio.tone({ freq: 760, to: 1100, dur: 0.12, type: 'sine', vol: 0.08 });
      else if (e.t === 'boss') audio.tone({ freq: 90, to: 60, dur: 0.18, type: 'sine', vol: 0.09 });
      else if (e.t === 'ammo') audio.tone({ freq: 700, to: 1000, dur: 0.1, type: 'triangle', vol: 0.07 });
      else if (e.t === 'throw') audio.tone({ freq: 500, to: 300, dur: 0.12, type: 'triangle', vol: 0.07 });
      else if (e.t === 'knock') { const sl = SLOTS[e.slot]; audio.tone({ freq: 240, to: 120, dur: 0.22, type: 'square', vol: 0.08 }); burst(sl.x, sl.y - 110 * sl.s, 14, true); }
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
          // tester level picker: only with the Developer toggle on, never in production
          else if (dev && inBox(20, 1090, 200, 1270)) { state.level = state.level > 1 ? state.level - 1 : 12; state.run = newRun(state.level); }
          else if (dev && inBox(520, 1090, 700, 1270)) { state.level = state.level < 12 ? state.level + 1 : 1; state.run = newRun(state.level); }
          else { saveProgress(); startRun(); }
        }
      } else if (state.scene === 'rules') {
        if (tap) {
          const at = typeof tap === 'object' ? tap : null;
          const inBox = (b) => at && at.x >= b.x0 && at.x <= b.x1 && at.y >= b.y0 && at.y <= b.y1;
          if (inBox(RULES_BACK_BOX)) { state.scene = 'title'; state.page = 0; }
          else if (inBox(RULES_NEXT_BOX)) { state.page = (state.page + 1) % RULES.length; }
          else if (inBox(TEXT_DEC_BOX) && state.textScaleIdx > 0) { state.textScaleIdx--; storage.set('textScaleIdx', state.textScaleIdx); }
          else if (inBox(TEXT_INC_BOX) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; storage.set('textScaleIdx', state.textScaleIdx); }
          else if (!at) { state.page = (state.page + 1) % RULES.length; } // keyboard Space/Enter: next page
        }
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
      }
      if (state.scene === 'play' && state.run.t < 6 && !state.run.blurb) drawText(ctx, 'Tap to flit when a red ring appears on you', W / 2, 1190, 30, '#fff', 700);
    },

    getState: () => state,
  };
}
