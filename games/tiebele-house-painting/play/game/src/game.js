// GAME CONTRACT (docs/GAME-CONTRACT.md): export meta + createGame(env) -> { update, render, getState }.
// Tiebele House Painting: complete the symmetric half of a painted wall panel from limited pigments, shield it from the rain, repair it.
// State machine: title / walls / settings / howto / about / rules / play / result / demolimit. Play phases:
//   paint -> [rain -> repair] -> verdict -> result.   Watch & Learn runs the same phases with an AI hand: think -> reveal -> act.
import {
  LEVELS, WATCH_LEVELS, dailyLevel, buildWall, paletteOf, paintCell, planStroke, explainStroke, makeRain, judge, scoreWall, levelUnlocked,
} from './sim.js';
import { FR, host, setFrame, setGrid, TEXT_SCALES, THINK_STEPS, REVEAL_SECS, playLayout, readerLayout, inRect } from './layout.js';
import { emit, stepFx } from './art.js';
import { setPress } from './ui.js';
import { renderTitle, renderFlow, renderModal, renderReader, hitFlow, flowMax, readerState, flowRects } from './menus.js';
import { renderPlay } from './view.js';
import { pressLockup } from './brand.js';
import { v3 } from './v3.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const NOINPUT = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() }, wheel: { dx: 0, dy: 0 } };
const DEMO_WALLS = 2;
const STROKE_STEP = 0.25;   // brush sampling, in cells

export function createGame(env) {
  const { rng, storage, monetization, audio, config } = env;
  let shotMode = false;
  try { shotMode = /[?&]shot=/.test(globalThis.location.search); } catch { shotMode = false; }

  const day = Number(config.day) || 20000;
  const state = {
    scene: 'title', t: 0, shot: false, demo: !!config.demo, dev: !!config.dev, layKey: '', day,
    settings: { textIdx: 0, thinkIdx: 1, sound: true, guide: false },
    record: { stars: LEVELS.map(() => 0), best: LEVELS.map(() => 0), walls: 0, shields: 0, daily: { day: 0, stars: 0, best: 0 }, demoWalls: 0 },
    ui: { scroll: 0, drag: null, page: 0, back: 'title' },
    run: null, result: null, pointer: null, watchK: 0,
    fx: [], floats: [], paused: false, pauseMenu: false,
  };
  const frand = () => rng.next();
  state.owned = !!monetization.owns?.('unlock_game');
  state.restoreMsg = ''; state.restoreBusy = false;
  monetization.onChange?.(() => { state.owned = !!monetization.owns('unlock_game'); });

  // ---- saving ------------------------------------------------------------------------------------------------------------------
  const saveSettings = () => storage.set('settings', state.settings);
  const saveRecord = () => storage.set('record', state.record);
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r && !shotMode) {
      const rec = state.record;
      if (Array.isArray(r.stars)) r.stars.forEach((v, i) => { if (i < rec.stars.length) rec.stars[i] = v; });
      if (Array.isArray(r.best)) r.best.forEach((v, i) => { if (i < rec.best.length) rec.best[i] = v; });
      for (const k of ['walls', 'shields', 'demoWalls']) if (typeof r[k] === 'number') rec[k] = r[k];
      if (r.daily) rec.daily = { ...rec.daily, ...r.daily };
    }
    audio.setMuted(!state.settings.sound);
  });

  // ---- sound ---------------------------------------------------------------------------------------------------------------------
  let budget = 0;
  const tone = (o) => { if (budget < 5) { budget++; audio.tone(o); } };
  const sfx = {
    brush: () => tone({ freq: 140 + frand() * 50, to: 80, dur: 0.06, type: 'sawtooth', vol: 0.03 }),
    wipe: () => tone({ freq: 300, to: 220, dur: 0.08, type: 'triangle', vol: 0.03 }),
    pot: () => tone({ freq: 360, to: 300, dur: 0.07, type: 'sine', vol: 0.06 }),
    dry: () => tone({ freq: 150, to: 110, dur: 0.12, type: 'square', vol: 0.04 }),
    warn: () => tone({ freq: 1250, to: 900, dur: 0.05, type: 'sine', vol: 0.05 }),
    shield: () => { tone({ freq: 880, to: 1320, dur: 0.18, type: 'triangle', vol: 0.09 }); tone({ freq: 1760, dur: 0.12, type: 'sine', vol: 0.05 }); },
    wash: () => { tone({ freq: 160, to: 60, dur: 0.3, type: 'sine', vol: 0.14 }); tone({ freq: 500, to: 200, dur: 0.12, type: 'triangle', vol: 0.05 }); },
    rain: () => tone({ freq: 700 + frand() * 400, to: 400, dur: 0.03, type: 'sine', vol: 0.012 }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'square', vol: 0.04 }),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.26 + i * 0.04, type: 'triangle', vol: 0.09 })),
    fail: () => [330, 262].forEach((f) => tone({ freq: f, dur: 0.3, type: 'sine', vol: 0.08 })),
  };

  // ---- starting a wall ---------------------------------------------------------------------------------------------------------
  const newRun = (cfg, o = {}) => {
    const wall = buildWall(cfg);
    const pal = paletteOf(wall);
    return {
      cfg, wall, kind: o.kind || 'campaign', level: o.level ?? -1, watch: !!o.watch, ph: 'paint', pt: 0,
      cells: wall.init.slice(), pig: wall.cap.slice(), sel: pal[0] || 2, stroke: null, hist: [],
      paintStrokes: 0, repairStrokes: 0, shields: 0, washed: 0, glaze: new Array(wall.N).fill(false), rain: null, drips: [],
      hint: null, caption: null, doneArm: 0, banner: null, cursor: { x: 0, y: 0 }, bad: null, vt: 0, wrong: [],
      ai: o.watch ? { ph: 'think', pt: 0, plan: null, thinkDur: 0, k: 0, anim: 0, chg: null } : null,
    };
  };
  const banner = (text, sub, col, life = 1.6) => { if (state.run) state.run.banner = { text, sub, col, t: 0, life }; };
  const floatAt = (x, y, text, col, size = 38, life = 1.2) => state.floats.push({ x, y, text, col, t: 0, life, size });
  const startRun = (cfg, o = {}) => {
    if (state.demo && !o.watch && !o.noCount && state.record.demoWalls >= DEMO_WALLS) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.run = newRun(cfg, o);
    setGrid(state.run.wall.W, state.run.wall.H);
    state.scene = 'play'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false; state.fx = []; state.floats = []; state.result = null;
    if (!o.watch && !o.noCount && state.demo) { state.record.demoWalls++; saveRecord(); }
    if (!o.watch) monetization.track('wall_start', { kind: cfg.kind, level: o.level ?? -1 });
    if (o.watch) state.run.caption = 'Watch how the wall is painted. Pause at any time.';
  };
  const startCampaign = (i) => startRun(LEVELS[i], { kind: 'campaign', level: i });
  const startDaily = () => startRun(dailyLevel(day), { kind: 'daily', level: -1 });
  const startWatch = () => startRun(WATCH_LEVELS[state.watchK % WATCH_LEVELS.length], { watch: true, kind: 'watch' });

  // ---- cells and strokes ---------------------------------------------------------------------------------------------------------
  const cellAt = (L, x, y) => {
    const { cs, ox, oy } = L.wall, run = state.run, gx = Math.floor((x - ox) / cs), gy = Math.floor((y - oy) / cs);
    if (gx < 0 || gy < 0 || gx >= run.wall.W || gy >= run.wall.H) return -1;
    return gy * run.wall.W + gx;
  };
  const centreOf = (L, i) => ({ x: L.wall.ox + ((i % state.run.wall.W) + 0.5) * L.wall.cs, y: L.wall.oy + (Math.floor(i / state.run.wall.W) + 0.5) * L.wall.cs });
  const applyCell = (L, i) => {
    const run = state.run, s = run.stroke, col = s.col;
    const old = run.cells[i], r = paintCell(run.cells, run.pig, i, col);
    if (r === 'ok') {
      s.ch.push({ i, old, nw: col });
      const c = centreOf(L, i);
      if (col === 0) { sfx.wipe(); emit(state.fx, 'dust', c.x, c.y, 2, frand, { speed: 40, size: 3, life: 0.4, cols: ['#e8c9a0'], g: 40 }); }
      else sfx.brush();
    } else if (r === 'dry') { run.bad = { c: col, t: 0.6 }; sfx.dry(); }
  };
  const beginStroke = (L, x, y) => {
    const run = state.run;
    run.hint = null; run.doneArm = 0;
    run.stroke = { col: run.sel, ch: [], px: x, py: y, last: -1 };
    const i = cellAt(L, x, y);
    if (i >= 0) { run.stroke.last = i; applyCell(L, i); }
  };
  const moveStroke = (L, x, y) => {
    const run = state.run, s = run.stroke, step = L.wall.cs * STROKE_STEP;
    const dx = x - s.px, dy = y - s.py, d = Math.hypot(dx, dy), n = Math.max(1, Math.min(400, Math.ceil(d / step)));
    for (let k = 1; k <= n; k++) {
      const sx = s.px + (dx * k) / n, sy = s.py + (dy * k) / n, i = cellAt(L, sx, sy);
      if (i < 0 || i === s.last) continue;
      // a neighbouring cell only takes paint once the brush is inside its middle, so a drift across a corner never paints by accident
      const c = centreOf(L, i), lim = L.wall.cs * 0.4;
      if (Math.abs(sx - c.x) > lim || Math.abs(sy - c.y) > lim) continue;
      s.last = i; applyCell(L, i);
    }
    s.px = x; s.py = y;
  };
  const endStroke = () => {
    const run = state.run;
    if (!run) return;
    const s = run.stroke;
    run.stroke = null;
    if (!s || !s.ch.length) return;
    run.hist.push(s.ch);
    if (run.ph === 'repair') run.repairStrokes++; else run.paintStrokes++;
  };
  const undo = () => {
    const run = state.run;
    if (!run.hist.length || run.stroke) return;
    const ch = run.hist.pop();
    for (let k = ch.length - 1; k >= 0; k--) { const c = ch[k]; run.cells[c.i] = c.old; if (c.nw > 0) run.pig[c.nw]++; }
    run.hint = null; sfx.pot();
  };
  const think = () => {
    const run = state.run;
    if (run.hint) { run.hint = null; return; }
    const s = planStroke(run.wall, run.cells, run.pig);
    if (s) run.hint = { idx: s.idx, color: s.color, plan: s, text: explainStroke(run.wall, run.cells, s) };
    else {
      const j = judge(run.wall, run.cells);
      run.hint = { idx: [], color: 0, plan: null, text: j.wrong.length ? 'The pots are too low for what is left. Wipe a wrong cell or finish the wall as it is.' : 'Every cell matches the pattern. Tap Done when you are ready.' };
    }
  };
  const usePlan = () => {
    const run = state.run, h = run.hint;
    if (!h || !h.plan) { run.hint = null; return; }
    const ch = [];
    for (const i of h.plan.idx) { const old = run.cells[i]; if (paintCell(run.cells, run.pig, i, h.plan.color) === 'ok') ch.push({ i, old, nw: h.plan.color }); }
    run.hint = null;
    if (ch.length) { run.hist.push(ch); if (run.ph === 'repair') run.repairStrokes++; else run.paintStrokes++; sfx.brush(); }
  };

  // ---- phases ---------------------------------------------------------------------------------------------------------------------
  const startRain = () => {
    const run = state.run;
    run.rain = makeRain(run.wall, run.cells, rng);
    run.ph = 'rain'; run.pt = 0; run.hist = []; run.hint = null; run.stroke = null; run.doneArm = 0;
    banner('RAIN!', 'Tap each ring before the drop lands', '#bfe0ff', 2.0);
    if (run.ai) { run.ai.ph = 'think'; run.ai.plan = null; run.caption = 'The rain is coming. I will glaze the cells where the rings appear.'; }
  };
  const startVerdict = () => {
    const run = state.run;
    run.ph = 'verdict'; run.pt = 0; run.vt = 0; run.hint = null; run.stroke = null; run.doneArm = 0;
    run.wrong = judge(run.wall, run.cells).wrong;
    banner(run.wrong.length ? `${run.wrong.length} cell${run.wrong.length === 1 ? '' : 's'} off` : 'Every cell right!', '', run.wrong.length ? '#ffb199' : '#cfeaa0', 2.0);
    if (!run.wrong.length) sfx.win(); else sfx.fail();
  };
  const finishPaint = () => {
    const run = state.run;
    if (run.ph === 'paint' && run.cfg.rain) startRain(); else startVerdict();
  };
  const finishRun = () => {
    const run = state.run, wall = run.wall;
    const sc = scoreWall(wall, run.cells, run);
    const rec = state.record;
    let isBest = false, best = 0, next = -1;
    if (run.kind === 'campaign') {
      isBest = sc.score > rec.best[run.level];
      if (isBest) rec.best[run.level] = sc.score;
      rec.stars[run.level] = Math.max(rec.stars[run.level], sc.stars);
      if (sc.stars >= 1 && run.level + 1 < LEVELS.length) next = run.level + 1;
      best = rec.best[run.level];
    } else if (run.kind === 'daily') {
      if (rec.daily.day !== day) rec.daily = { day, stars: 0, best: 0 };
      isBest = sc.score > rec.daily.best; rec.daily.best = Math.max(rec.daily.best, sc.score); rec.daily.stars = Math.max(rec.daily.stars, sc.stars); best = rec.daily.best;
    }
    if (run.kind !== 'watch') { rec.walls++; rec.shields += run.shields; saveRecord(); monetization.track('wall_end', { level: run.level, stars: sc.stars, score: sc.score }); }
    state.result = {
      stars: sc.stars, right: sc.right, total: wall.N, wrong: sc.wrong, cells: run.cells.slice(), wall, paintStrokes: run.paintStrokes, repairStrokes: run.repairStrokes, par: wall.par,
      shields: run.shields, washed: run.washed, rain: !!run.cfg.rain, score: sc.score, best, isBest, next, kind: run.kind, level: run.level, cfg: run.cfg,
    };
    state.scene = 'result'; state.ui.scroll = 0; state.paused = false;
  };

  // ---- rain ----------------------------------------------------------------------------------------------------------------------
  const shieldDrop = (L, d) => {
    const run = state.run;
    d.st = 'shield'; run.glaze[d.i] = true; run.shields++;
    const c = centreOf(L, d.i);
    sfx.shield();
    emit(state.fx, 'spark', c.x, c.y, 9, frand, { speed: 150, size: 9, life: 0.6, cols: ['#fff3b0', '#ffd24a'], g: 80 });
    floatAt(c.x, c.y - 10, '+5', '#ffe58a', 34, 0.9);
  };
  const landDrop = (L, d) => {
    const run = state.run, W = run.wall.W, N = run.wall.N;
    const wash = (i) => {
      if (run.glaze[i] || run.cells[i] === 0) return false;
      const col = run.cells[i];
      run.cells[i] = 0; run.washed++; run.drips.push({ i, t: 0 });
      const c = centreOf(L, i);
      emit(state.fx, 'splash', c.x, c.y, 8, frand, { speed: 130, size: 6, life: 0.6, cols: ['#cfe6ff', '#ffffff'], up: 120 });
      emit(state.fx, 'dust', c.x, c.y, 8, frand, { speed: 80, size: 5, life: 0.9, cols: [col === 1 ? '#f1e5c8' : col === 2 ? '#3a2d26' : '#b5452b'], g: 140 });
      return true;
    };
    let did = wash(d.i);
    if (d.streak && d.i + W < N) did = wash(d.i + W) || did;
    d.st = did ? 'washed' : 'done';
    if (did) { sfx.wash(); const c = centreOf(L, d.i); floatAt(c.x, c.y, 'Washed', '#ffb199', 30, 0.9); }
  };
  const updateRain = (L, dt, input, hit) => {
    const run = state.run, rain = run.rain;
    rain.t += dt;
    if (frand() < dt * 18) sfx.rain();
    for (const d of rain.drops) {
      if (d.st === 'wait' && rain.t >= d.t0) {
        d.st = 'warn'; sfx.warn();
        d.aiAt = rain.t + 0.3 + frand() * 0.32; d.aiMiss = frand() < 0.1;
      }
      if (d.st === 'warn' && run.watch && !d.aiMiss && rain.t >= d.aiAt) shieldDrop(L, d);
      if (d.st === 'warn' && rain.t >= d.t0 + d.warn) landDrop(L, d);
    }
    // a tap near a ring glazes that cell
    const ptr = input.pointer;
    let tapAt = null;
    if (!run.watch && !hit && ptr.pressed) tapAt = { x: ptr.x, y: ptr.y };
    if (!run.watch && input.keys.pressed.has('Enter')) tapAt = centreOf(L, run.cursor.y * run.wall.W + run.cursor.x);
    if (tapAt) {
      let best = null, bd = Math.max(L.wall.cs * 1.5, 84);
      for (const d of rain.drops) {
        if (d.st !== 'warn') continue;
        const c = centreOf(L, d.i), dd = Math.hypot(c.x - tapAt.x, c.y - tapAt.y);
        if (dd < bd) { bd = dd; best = d; }
      }
      if (best) shieldDrop(L, best);
    }
    if (rain.t >= rain.dur && rain.drops.every((d) => d.st !== 'wait' && d.st !== 'warn')) {
      run.ph = 'repair'; run.pt = 0; run.glaze = run.glaze.map(() => false);
      banner(run.washed ? 'The rain has passed' : 'The wall stayed dry', run.washed ? 'Repaint what was washed' : '', '#ffe3a0', 1.8);
      if (run.ai) { run.ai.ph = 'think'; run.ai.plan = null; run.ai.pt = 0; }
    }
  };

  // ---- Watch & Learn: the game's own hand ------------------------------------------------------------------------------------------
  const updateAI = (L, dt) => {
    const run = state.run, ai = run.ai, wall = run.wall;
    if (run.ph === 'rain') return;      // reactions are handled in updateRain
    if (run.ph === 'verdict') {
      run.vt += dt;
      if (run.vt >= 3.2) { state.watchK = (state.watchK + 1) % WATCH_LEVELS.length; startWatch(); }
      return;
    }
    ai.pt += dt;
    if (ai.ph === 'think') {
      if (!ai.plan) {
        const s = planStroke(wall, run.cells, run.pig);
        ai.plan = s || { done: true, idx: [], color: 0 };
        ai.thinkDur = THINK_STEPS[state.settings.thinkIdx];
        run.caption = ai.plan.done ? 'Every cell now matches the pattern, so this is the moment to finish.' : 'Thinking: which straight run of cells is still wrong, and which pigment does it need? The longest run saves strokes.';
      }
      if (ai.pt >= ai.thinkDur) {
        if (ai.plan.done) { finishPaint(); return; }
        ai.ph = 'reveal'; ai.pt = 0; run.caption = explainStroke(wall, run.cells, ai.plan); sfx.tick();
      }
    } else if (ai.ph === 'reveal') {
      if (ai.pt >= REVEAL_SECS) { ai.ph = 'act'; ai.pt = 0; ai.k = 0; ai.anim = 0; ai.chg = []; run.sel = ai.plan.color; }
    } else if (ai.ph === 'act') {
      ai.anim += dt * 9;
      while (ai.k < ai.plan.idx.length && ai.k < Math.floor(ai.anim) + 1) {
        const i = ai.plan.idx[ai.k], old = run.cells[i];
        if (paintCell(run.cells, run.pig, i, ai.plan.color) === 'ok') {
          ai.chg.push({ i, old, nw: ai.plan.color });
          if (ai.plan.color) sfx.brush(); else sfx.wipe();
          const c = centreOf(L, i); emit(state.fx, 'dust', c.x, c.y, 1, frand, { speed: 30, size: 3, life: 0.4, cols: ['#fff2d0'], g: 20 });
        }
        ai.k++;
      }
      if (ai.k >= ai.plan.idx.length) {
        if (ai.chg.length) { run.hist.push(ai.chg); if (run.ph === 'repair') run.repairStrokes++; else run.paintStrokes++; }
        ai.chg = null; ai.plan = null; ai.ph = 'think'; ai.pt = 0;
      }
    }
  };

  // ---- input helpers ---------------------------------------------------------------------------------------------------------------
  const openPause = () => { if (state.scene !== 'play' || !state.run || state.run.ph === 'verdict') return; state.paused = true; if (!state.run.watch) { state.pauseMenu = true; state.ui.scroll = 0; endStroke(); } };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const toTitle = () => { state.scene = 'title'; state.run = null; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const openReader = (scene, back) => { state.scene = scene; state.ui.back = back; state.ui.page = 0; state.ui.scroll = 0; state.ui.drag = null; };

  const scrollPointer = (ptr, input, max, hit) => {
    const ui = state.ui;
    if (input.wheel && input.wheel.dy) ui.scroll = clamp(ui.scroll + input.wheel.dy, 0, max);
    if (ptr.pressed) ui.drag = { y0: ptr.y, s0: ui.scroll, x0: ptr.x, moved: false };
    if (ui.drag && ptr.down) {
      if (Math.abs(ptr.y - ui.drag.y0) > 10) ui.drag.moved = true;
      if (ui.drag.moved) ui.scroll = clamp(ui.drag.s0 - (ptr.y - ui.drag.y0), 0, max);
    }
    if (ptr.released && ui.drag) {
      const d = ui.drag; ui.drag = null;
      if (!d.moved) return hit(d.x0, d.y0);
    }
    return null;
  };

  const nextCampaign = () => { for (let i = 0; i < LEVELS.length; i++) if (levelUnlocked(state.record, i) && !(state.record.stars[i] > 0)) return i; return LEVELS.length - 1; };
  const onTitle = (id) => {
    if (id === 'play') startCampaign(nextCampaign());
    else if (id === 'walls') { state.scene = 'walls'; state.ui.scroll = 0; }
    else if (id === 'daily') startDaily();
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') openReader(id, 'title');
    else if (id === 'settings') { state.scene = 'settings'; state.ui.back = 'title'; state.ui.scroll = 0; }
    else if (id === 'arcforge') { pressLockup(); env.openArcforgeHome?.(); }
  };
  const onWalls = (id) => {
    if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; return; }
    const m = /^w(\d+)$/.exec(id);
    if (m) { const i = Number(m[1]); if (levelUnlocked(state.record, i) || state.dev) startCampaign(i); }
  };
  const onSettings = (id) => {
    const st = state.settings;
    if (id === 'dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'sound') { st.sound = !st.sound; audio.setMuted(!st.sound); }
    else if (id === 'guide') st.guide = !st.guide;
    else if (id === 'think') st.thinkIdx = (st.thinkIdx + 1) % THINK_STEPS.length;
    else if (id === 'restore' && !state.restoreBusy) {
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
      Promise.resolve(monetization.restore()).then(() => {
        state.owned = !!monetization.owns('unlock_game');
        state.restoreMsg = state.owned ? 'Purchase restored' : 'No earlier purchase found';
      }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
    }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
    saveSettings();
  };
  const onResult = (id) => {
    const r = state.result;
    if (id === 'next' && r.next >= 0) startCampaign(r.next);
    else if (id === 'again') { if (r.kind === 'daily') startRun(r.cfg, { kind: 'daily', noCount: true }); else startRun(r.cfg, { kind: 'campaign', level: r.level, noCount: true }); }
    else if (id === 'menu') { state.scene = 'title'; state.run = null; state.ui.scroll = 0; }
    else if (id === 'walls') { state.scene = 'walls'; state.run = null; state.ui.scroll = 0; }
    else if (id === 'arcforge') { pressLockup(); env.openArcforgeHome?.(); }
  };
  const onPause = (id) => {
    if (id === 'resume') closePause();
    else if (id === 'rules') { state.pauseMenu = false; openReader('rules', 'play'); }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted(!state.settings.sound); saveSettings(); }
    else if (id === 'quit') toTitle();
  };
  const updateFlow = (scene, input, handler) => {
    const id = scrollPointer(input.pointer, input, flowMax(state, scene), (x, y) => hitFlow(state, scene, x, y, state.ui.scroll));
    if (id) handler(id);
    if (input.keys.pressed.has('Escape') && (scene === 'walls' || scene === 'settings')) { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const updateReader = (input) => {
    const ptr = input.pointer, scene = state.scene, rs = readerState(state, scene), L = rs.L;
    const id = scrollPointer(ptr, input, rs.max, (x, y) => {
      if (inRect(L.dec, x, y)) return 'dec'; if (inRect(L.inc, x, y)) return 'inc'; if (inRect(L.back, x, y)) return 'back'; if (inRect(L.next, x, y)) return 'next';
      return null;
    });
    const n = rs.doc.list.length;
    const goBack = () => { if (state.ui.back === 'play') { state.scene = 'play'; state.pauseMenu = true; } else state.scene = 'title'; state.ui.scroll = 0; };
    if (id === 'dec' || id === 'inc') { state.settings.textIdx = clamp(state.settings.textIdx + (id === 'inc' ? 1 : -1), 0, TEXT_SCALES.length - 1); state.ui.scroll = 0; saveSettings(); }
    else if (id === 'back') { if (state.ui.page === 0) goBack(); else { state.ui.page--; state.ui.scroll = 0; } }
    else if (id === 'next') { if (state.ui.page >= n - 1) goBack(); else { state.ui.page++; state.ui.scroll = 0; } }
    if (input.keys.pressed.has('Escape')) goBack();
    if (input.keys.pressed.has('ArrowRight')) { state.ui.page = Math.min(n - 1, state.ui.page + 1); state.ui.scroll = 0; }
    if (input.keys.pressed.has('ArrowLeft')) { state.ui.page = Math.max(0, state.ui.page - 1); state.ui.scroll = 0; }
  };

  // ---- play ------------------------------------------------------------------------------------------------------------------------
  const updateAmbient = (dt) => {
    stepFx(state.fx, dt);
    for (const f of state.floats) f.t += dt;
    state.floats = state.floats.filter((f) => f.t < f.life);
    const run = state.run;
    if (run.banner) { run.banner.t += dt; if (run.banner.t > run.banner.life) run.banner = null; }
    if (run.bad) { run.bad.t -= dt; if (run.bad.t <= 0) run.bad = null; }
    for (const d of run.drips) d.t += dt;
    run.drips = run.drips.filter((d) => d.t < 1.5);
  };

  const updatePlay = (dt, input) => {
    const run = state.run, ptr = input.pointer, pal = paletteOf(run.wall), L = playLayout(pal.length);
    state.pointer = ptr.down ? { x: ptr.x, y: ptr.y } : null;
    // the kit's "Preview m:ss" pill sits in the lower right corner of the header card, clear of the title and the stats
    const pillH = Math.max(16, 11.5 / (host.px || 1)) * 1.7;
    meta.previewBadge = { x: L.hud.x + L.hud.w - 10, y: L.hud.y + L.hud.h - pillH - 8, align: 'right' };
    if (input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyP')) {
      if (state.paused) { if (run.watch) state.paused = false; else closePause(); } else openPause();
    }
    if (state.pauseMenu) {
      const id = scrollPointer(ptr, input, flowMax(state, 'pause'), (x, y) => hitFlow(state, 'pause', x, y, state.ui.scroll));
      if (id) onPause(id);
      return;
    }
    // buttons
    let hit = null;
    if (ptr.pressed) {
      if (inRect(L.think, ptr.x, ptr.y)) hit = 'think';
      else if (inRect(L.pause, ptr.x, ptr.y)) hit = 'pause';
      else if (inRect(L.done, ptr.x, ptr.y)) hit = 'done';
      else if (inRect(L.cloth, ptr.x, ptr.y)) hit = 'cloth';
      else if (inRect(L.undo, ptr.x, ptr.y)) hit = 'undo';
      else pal.forEach((c, k) => { if (inRect(L.pots[k], ptr.x, ptr.y)) hit = `pot${c}`; });
    }
    const keys = input.keys.pressed;
    if (!hit) {
      if (keys.has('KeyT')) hit = 'think'; else if (keys.has('Space')) hit = 'done'; else if (keys.has('KeyW')) hit = 'cloth'; else if (keys.has('KeyZ')) hit = 'undo';
      else ['Digit1', 'Digit2', 'Digit3'].forEach((code, k) => { if (keys.has(code) && pal[k]) hit = `pot${pal[k]}`; });
    }
    if (run.watch) {
      if (hit === 'think') { state.paused = !state.paused; hit = null; }
      else if (hit === 'pause') { toTitle(); return; }
    } else if (hit) {
      const live = run.ph === 'paint' || run.ph === 'repair';
      if (hit === 'pause') { openPause(); return; }
      if (hit === 'think' && live) { if (run.hint && run.hint.plan) usePlan(); else think(); }
      else if (hit === 'done' && live) { endStroke(); if (run.doneArm > 0) finishPaint(); else run.doneArm = 3; }
      else if (hit === 'cloth' && live) { endStroke(); run.sel = 0; sfx.pot(); run.hint = null; }
      else if (hit === 'undo' && live) undo();
      else if (hit.startsWith('pot') && live) { endStroke(); run.sel = Number(hit.slice(3)); sfx.pot(); }
    }
    if (state.paused) return;

    updateAmbient(dt);
    run.pt += dt;
    if (run.doneArm > 0) run.doneArm = Math.max(0, run.doneArm - dt);
    if (run.watch) {
      updateAI(L, dt);
      if (run.ph === 'rain') updateRain(L, dt, input, true);
      return;
    }
    if (run.ph === 'paint' || run.ph === 'repair') {
      if (ptr.pressed && !hit && cellAt(L, ptr.x, ptr.y) >= 0) beginStroke(L, ptr.x, ptr.y);
      else if (ptr.pressed && !hit && run.hint) run.hint = null;
      else if (run.stroke && !run.stroke.kb && ptr.down) moveStroke(L, ptr.x, ptr.y);
      if (run.stroke && !run.stroke.kb && (ptr.released || !ptr.down)) { endStroke(); }
      // keyboard cursor: arrows move, Enter starts or ends a stroke (moving while a stroke is open paints)
      const W = run.wall.W, H = run.wall.H, c = run.cursor;
      let moved = false;
      if (keys.has('ArrowLeft')) { c.x = Math.max(0, c.x - 1); moved = true; }
      if (keys.has('ArrowRight')) { c.x = Math.min(W - 1, c.x + 1); moved = true; }
      if (keys.has('ArrowUp')) { c.y = Math.max(0, c.y - 1); moved = true; }
      if (keys.has('ArrowDown')) { c.y = Math.min(H - 1, c.y + 1); moved = true; }
      if (keys.has('Enter')) {
        if (run.stroke && run.stroke.kb) endStroke();
        else { endStroke(); run.hint = null; run.stroke = { col: run.sel, ch: [], px: 0, py: 0, last: c.y * W + c.x, kb: true }; applyCell(L, c.y * W + c.x); }
      } else if (moved && run.stroke && run.stroke.kb) { run.stroke.last = c.y * W + c.x; applyCell(L, c.y * W + c.x); }
    } else if (run.ph === 'rain') {
      const W = run.wall.W, H = run.wall.H, c = run.cursor;
      if (keys.has('ArrowLeft')) c.x = Math.max(0, c.x - 1);
      if (keys.has('ArrowRight')) c.x = Math.min(W - 1, c.x + 1);
      if (keys.has('ArrowUp')) c.y = Math.max(0, c.y - 1);
      if (keys.has('ArrowDown')) c.y = Math.min(H - 1, c.y + 1);
      updateRain(L, dt, input, hit);
    } else if (run.ph === 'verdict') {
      run.vt += dt;
      if (run.vt >= 2.4 || (ptr.pressed && run.vt > 0.6)) finishRun();
    }
  };

  // ---- store screenshots: ?shot=1&seed=N picks a fixed screen ------------------------------------------------------------------
  const completeSome = (run, frac) => {
    const w = run.wall;
    const idx = [];
    for (let i = 0; i < w.N; i++) if (!w.elder[i] && w.target[i] > 0) idx.push(i);
    const upto = Math.floor(idx.length * frac);
    for (let k = 0; k < upto; k++) { const i = idx[k]; if (run.pig[w.target[i]] > 0) { run.cells[i] = w.target[i]; run.pig[w.target[i]]--; } }
  };
  const applyPreset = () => {
    const n = Number(config.seed) || 1;
    state.shot = true;
    const play = (levelIdx, frac = 0, o = {}) => {
      startRun(o.cfg || LEVELS[levelIdx], { kind: o.kind || 'campaign', level: levelIdx, noCount: true, watch: !!o.watch });
      const run = state.run; completeSome(run, frac);
      run.paintStrokes = Math.round(run.wall.par * Math.max(0.3, frac));
      state.paused = false; return run;
    };
    if (n === 1) { state.scene = 'title'; return; }
    if (n === 2) { const r = play(5, 0.55); r.sel = 1; return; }
    if (n === 3) {
      const r = play(5, 1);
      startRain(); r.banner = null; r.rain.t = 2.4;
      const ds = r.rain.drops; ds.slice(0, 3).forEach((d, k) => { d.st = 'warn'; d.t0 = 2.4 - 0.25 - k * 0.2; });
      if (ds[3]) { ds[3].st = 'shield'; r.glaze[ds[3].i] = true; r.shields = 1; }
      return;
    }
    if (n === 4) {
      const r = play(5, 1); r.ph = 'repair'; r.washed = 5; r.shields = 3;
      for (const i of [9, 10, 17, 26, 27, 34, 41]) if (!r.wall.elder[i]) r.cells[i] = 0; else r.cells[i] = 0;
      r.banner = { text: 'The rain has passed', sub: 'Repaint what was washed', col: '#ffe3a0', t: 0.3, life: 5 };
      return;
    }
    if (n === 5) { const r = play(8, 0.4); r.sel = 3; const s = planStroke(r.wall, r.cells, r.pig); r.hint = { idx: s.idx, color: s.color, plan: s, text: explainStroke(r.wall, r.cells, s) }; return; }
    if (n === 6) {
      const r = play(8, 1);
      for (const i of [20, 21, 40]) r.cells[i] = 0;
      r.paintStrokes = r.wall.par + 2; r.shields = 6; r.washed = 3;
      finishRun(); return;
    }
    if (n >= 7 && n <= 9) { state.scene = ['rules', 'howto', 'about'][n - 7]; state.ui.page = n === 7 ? 3 : 0; state.ui.back = 'title'; return; }
    if (n === 10) {
      const r = play(0, 0, { watch: true, kind: 'watch', cfg: WATCH_LEVELS[2] });
      const s = planStroke(r.wall, r.cells, r.pig);
      r.ai.plan = s; r.ai.ph = 'reveal'; r.caption = explainStroke(r.wall, r.cells, s); return;
    }
    if (n === 11) { state.scene = 'walls'; state.record.stars = LEVELS.map((_, i) => (i < 7 ? 3 - (i % 3) : 0)); return; }
    if (n === 12) { state.scene = 'settings'; return; }
    if (n === 13) { state.settings.textIdx = 4; state.scene = 'rules'; state.ui.page = 3; return; }
    if (n === 14) { play(3, 0.5); state.pauseMenu = true; state.paused = true; return; }
    if (n === 15) { play(11, 0.3, { cfg: dailyLevel(day), kind: 'daily' }); return; }
    play(2, 0.5);
  };

  // ---- the object the kit and the shell see ----------------------------------------------------------------------------------------
  const game = {
    // Only live painting uses up the free preview: a brush on the wall, or the rain. Menus, rules, settings, hints, Watch & Learn, pause
    // and results are free. A tester build (config.dev) never uses it up.
    isPreviewExempt: () => {
      if (config.dev) return true;
      const run = state.run;
      if (state.scene !== 'play' || !run || run.watch) return true;
      if (state.paused || state.pauseMenu || run.hint) return true;
      if (run.ph === 'rain') return false;
      if (run.ph === 'paint' || run.ph === 'repair') return !run.stroke;
      return true;
    },
    update(dt, input) {
      if (state.shot) input = NOINPUT;
      setFrame(meta.width, meta.height);
      if (state.run) setGrid(state.run.wall.W, state.run.wall.H);
      config.textScale = TEXT_SCALES[state.settings.textIdx];
      if (state.layKey !== FR.key) {
        if (state.layKey && state.run) { endStroke(); state.ui.drag = null; }
        state.layKey = FR.key;
      }
      budget = 0;
      setPress(input.pointer);
      if (state.shot) { state.t += dt; return; }
      if (!(state.paused && state.scene === 'play')) state.t += dt;
      switch (state.scene) {
        case 'title': updateFlow('title', input, onTitle); break;
        case 'walls': updateFlow('walls', input, onWalls); break;
        case 'settings': updateFlow('settings', input, onSettings); break;
        case 'result': updateFlow('result', input, onResult); break;
        case 'demolimit': updateFlow('demolimit', input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }); break;
        case 'howto': case 'about': case 'rules': updateReader(input); break;
        case 'play': if (state.run) updatePlay(dt, input); else state.scene = 'title'; break;
        default: break;
      }
    },
    render(ctx) {
      setFrame(meta.width, meta.height);
      v3.scene = state.scene;
      if (v3.on) ctx.clearRect(0, 0, meta.width, meta.height);
      if (state.run) setGrid(state.run.wall.W, state.run.wall.H);
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'walls': renderFlow(ctx, state, 'walls'); break;
        case 'settings': renderFlow(ctx, state, 'settings'); break;
        case 'result': renderFlow(ctx, state, 'result', 0.62); break;
        case 'demolimit': renderFlow(ctx, state, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': renderReader(ctx, state, state.scene); break;
        case 'play':
          if (state.run) { renderPlay(ctx, state, { bare: state.pauseMenu }); if (state.pauseMenu) renderModal(ctx, state, 'pause'); }
          break;
        default: break;
      }
    },
    getState: () => state,
    // Every tappable rectangle of the current screen (layout checks and tests). No gameplay use.
    getRects() {
      const out = [], sc = state.scene;
      let grid = null;
      if (sc === 'play' && state.run) {
        const pal = paletteOf(state.run.wall), L = playLayout(pal.length);
        grid = { ox: L.wall.ox, oy: L.wall.oy, cs: L.wall.cs, W: state.run.wall.W, H: state.run.wall.H };
        if (state.pauseMenu) out.push(...flowRects(state, 'pause', state.ui.scroll));
        else {
          out.push({ id: 'think', ...L.think }, { id: 'pause', ...L.pause }, { id: 'done', ...L.done }, { id: 'cloth', ...L.cloth }, { id: 'undo', ...L.undo });
          pal.forEach((c, k) => out.push({ id: `pot${c}`, ...L.pots[k] }));
        }
      } else if (sc === 'howto' || sc === 'about' || sc === 'rules') {
        const L = readerLayout(); out.push({ id: 'dec', ...L.dec }, { id: 'inc', ...L.inc }, { id: 'back', ...L.back }, { id: 'next', ...L.next });
      } else out.push(...flowRects(state, sc, state.ui.scroll));
      return { frame: { w: FR.w, h: FR.h, land: FR.land, ins: { t: FR.t, r: FR.r, b: FR.b, l: FR.l } }, rects: out, scene: sc, ph: state.run ? state.run.ph : null, grid };
    },
  };
  if (shotMode) applyPreset();
  return game;
}
