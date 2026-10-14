// Takoyaki Flip Stall: state and flow. Engine = engine.js, geometry = layout.js, drawing = view.js + art.js.
import { playLayout, titleLayout, docLayout, settingsLayout, listLayout, shiftRects, overLayout, pauseLayout, plateGeo, inRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { K, FLAMES, FILLINGS, makeSpec, makeSim, step, pour, topping, pick, setFlame, canPour, plan, applyPlan, isReady, TOTAL_SHIFTS, SHIFTS_PER_STALL, STALLS, grade } from './engine.js';
import { render, metrics, settingsRows, toolIds } from './view.js';
import { DOCS } from './content.js';
import { shiftHeads } from './ui.js';
import { emit3 } from './v3.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_SHIFTS = 3;
const SLOW = 0.12;           // world speed while Watch and Learn thinks and explains
const DEFAULT_PREFS = { sound: true, ring: true, calm: false, textIdx: 0, thinkIdx: 1 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FACT_COUNT = 6;

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS },
    sim: null, kind: 'journey', g: 0, tool: 'ladle', kbd: false, cursor: 0,
    paused: false, hint: null, auto: { on: false, phase: null, timer: 0, paused: false, n: 0, done: false },
    fx: { parts: [], floats: [] }, pourFx: null, pourSnd: 0, stroke: null, endT: 0,
    msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0, fact: 0 }, back: 'title', result: null,
    progress: {}, stats: { rush: 0, runs: 0, days: [], bestStreak: 0 }, open: 0,
    daily: { day: config.day ?? 0 }, streak: 0, dailyDone: false, demo: config.demo === true, demoCount: 0, dev: config.dev === true, sfx: [],
    owned: false, restoreMsg: '', restoreBusy: false,
  };
  let scrollG = null;
  metrics.rect = null; metrics.max = 0; metrics.view = 0; wheelInput.dy = 0;   // module-level scroll state starts clean for every game instance

  // ---- persistence ---------------------------------------------------------------------------------------------------------------------------
  const applyPrefs = () => { audio.setMuted?.(!S.prefs.sound); };
  const savePrefs = () => storage.set('prefs', S.prefs);
  const saveProgress = () => storage.set('progress', S.progress);
  const saveStats = () => storage.set('stats', S.stats);
  function refreshOpen() {
    let o = 0;
    while (o < TOTAL_SHIFTS - 1 && S.progress[o] && S.progress[o].stars >= 1) o += 1;
    S.open = S.dev || config.demo ? TOTAL_SHIFTS : o;
  }
  function refreshDaily() {
    const day = S.daily.day, set = new Set(S.stats.days);
    let streak = 0, d = set.has(day) ? day : day - 1;
    while (set.has(d)) { streak += 1; d -= 1; }
    S.streak = streak; S.dailyDone = set.has(day);
  }
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); } applyPrefs(); });
  storage.get('progress', null).then((v) => { if (v) { S.progress = { ...v, ...S.progress }; refreshOpen(); } });
  storage.get('stats', null).then((v) => { if (v) { S.stats = { ...S.stats, ...v, days: v.days ?? [] }; refreshDaily(); } });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  applyPrefs(); refreshOpen(); refreshDaily();
  S.owned = !!monetization.owns?.('unlock_game');
  monetization.onChange?.(() => { S.owned = !!monetization.owns('unlock_game'); });

  // ---- sound -------------------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound) audio.tone(o); };
  const later = (t, o) => S.sfx.push({ t, o });
  const note = (k) => 262 * 2 ** (([0, 2, 4, 7, 9][((k % 5) + 5) % 5] + 12 * Math.floor(k / 5)) / 12);
  const sfx = {
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.06 }),
    glug: () => tone({ freq: 190 + 70 * Math.sin(S.t * 40), to: 150, dur: 0.07, type: 'sine', vol: 0.07 }),
    full: () => tone({ freq: 880, to: 1175, dur: 0.1, type: 'sine', vol: 0.07 }),
    top: () => tone({ freq: 520, to: 780, dur: 0.07, type: 'triangle', vol: 0.09 }),
    flip: (q) => tone({ freq: 420 + 220 * clamp(q, 0, 1.2), to: 760, dur: 0.09, type: 'triangle', vol: 0.12 }),
    spill: () => tone({ freq: 210, to: 120, dur: 0.2, type: 'sawtooth', vol: 0.07 }),
    ready: () => { tone({ freq: 784, to: 784, dur: 0.12, type: 'sine', vol: 0.07 }); later(0.09, { freq: 1047, to: 1047, dur: 0.18, type: 'sine', vol: 0.07 }); },
    burnt: () => tone({ freq: 130, to: 70, dur: 0.35, type: 'sawtooth', vol: 0.1 }),
    serve: (k) => tone({ freq: note(k + 7), to: note(k + 7), dur: 0.18, type: 'triangle', vol: 0.12 }),
    bell: () => { tone({ freq: 1319, to: 1319, dur: 0.5, type: 'sine', vol: 0.1 }); later(0.1, { freq: 1760, to: 1760, dur: 0.6, type: 'sine', vol: 0.07 }); },
    leave: () => { tone({ freq: 330, to: 220, dur: 0.3, type: 'triangle', vol: 0.1 }); },
    scrape: () => tone({ freq: 300, to: 180, dur: 0.1, type: 'square', vol: 0.04 }),
    sizzle: () => tone({ freq: 3300 + 700 * Math.sin(S.t * 9), to: 2600, dur: 0.035, type: 'square', vol: 0.012 }),
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => later(i * 0.11, { freq: f, to: f, dur: 0.4, type: 'triangle', vol: 0.1 })),
    lose: () => [392, 330, 262].forEach((f, i) => later(i * 0.18, { freq: f, to: f * 0.9, dur: 0.4, type: 'triangle', vol: 0.09 })),
  };

  // ---- helpers ---------------------------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.4) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; scrollG = null; wheelInput.dy = 0; S.msg = null; }
  const toolFor = (a) => (a.kind === 'pour' ? 'ladle' : a.kind === 'topping' ? 'f:' + a.fil : 'picks');
  const ids = () => toolIds(S.sim.spec);
  const L = () => playLayout(meta.width, meta.height, { ids: ids(), auto: S.auto.on });
  const geoOf = (l) => plateGeo(l.area, S.sim.cols, S.sim.rows, true);
  function spark(x, y, n, color, speed = 240) {
    for (let i = 0; i < n; i++) { const a = rng.next() * Math.PI * 2, v = 60 + rng.next() * speed; S.fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90, t: 0, life: 0.5 + rng.next() * 0.5, r: 3 + rng.next() * 4, c: color }); }
    if (S.fx.parts.length > 140) S.fx.parts.splice(0, S.fx.parts.length - 140);
  }
  function floatText(x, y, text, color, size = 34) { S.fx.floats.push({ x, y, text, color, size, t: 0, life: 1.1 }); if (S.fx.floats.length > 10) S.fx.floats.shift(); }
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_SHIFTS) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }
  function demoUncount() { if (config.demo && S.demoCount > 0) { S.demoCount -= 1; storage.set('demoCount', S.demoCount); } }

  // ---- shifts ---------------------------------------------------------------------------------------------------------------------------------
  function newShift(kind, g, { auto = false, seed = 1 } = {}) {
    const spec = makeSpec(kind, g, seed);
    S.sim = makeSim(spec);
    S.kind = kind; S.g = g; S.tool = 'ladle'; S.hint = null; S.paused = false; S.pourFx = null; S.stroke = null; S.endT = 0; S.result = null; S.cursor = 0;
    S.fx = { parts: [], floats: [] }; S.msg = null; S.sfx = [];
    S.auto = { on: auto, phase: null, timer: 0, paused: false, n: 0, done: false };
    go('play');
    if (kind === 'journey' && g === 0 && !S.progress[0]) say('Pour batter with the ladle, then flip each ball with the picks when the ring is green.', 5);
  }
  function startJourney(g) {
    if (g > S.open) { say('Finish the previous shift first.', 2); return; }
    if (demoBlocked()) return;
    newShift('journey', g, { seed: 1 });
  }
  function startRush() { if (demoBlocked()) return; newShift('rush', 0, { seed: rng.int(1 << 20) + 1 }); }
  function startDaily() { if (demoBlocked()) return; newShift('daily', 0, { seed: (S.daily.day | 0) + 11 }); }
  function startAuto() { newShift('demo', 0, { auto: true, seed: 3 }); say('Watch the game cook a shift and explain each move.', 3); }
  function restartShift() {
    const { kind, g } = S;
    demoUncount();
    if (kind === 'journey') startJourney(g); else if (kind === 'rush') startRush(); else if (kind === 'daily') startDaily(); else startAuto();
  }

  function finishShift() {
    const sim = S.sim, spec = sim.spec, o = sim.outcome;
    if (S.auto.on) { S.auto.done = true; S.auto.phase = null; S.hint = null; say('Shift complete. That is how a stall runs.', 6); return; }
    const R0 = { kind: S.kind, g: S.g, score: sim.score, par: spec.par, stars: o.stars, why: o.why, balls: sim.balls, perfect: sim.perfect, bestStreak: sim.bestStreak, hearts: sim.hearts, left: sim.left, fact: (S.stats.runs + sim.balls) % FACT_COUNT, best0: S.stats.rush, next: null };
    S.stats.runs += 1;
    if (S.kind === 'journey') {
      const old = S.progress[S.g];
      S.progress[S.g] = { stars: Math.max(old?.stars ?? 0, o.stars), best: Math.max(old?.best ?? 0, sim.score) };
      saveProgress(); refreshOpen();
      if (S.g + 1 < TOTAL_SHIFTS && o.stars >= 1) R0.next = S.g + 1;
    } else if (S.kind === 'rush') { if (sim.score > S.stats.rush) S.stats.rush = sim.score; }
    else if (S.kind === 'daily' && o.why === 'cleared') {
      const day = S.daily.day;
      if (!S.stats.days.includes(day)) { S.stats.days.push(day); S.stats.days = S.stats.days.slice(-200); refreshDaily(); S.stats.bestStreak = Math.max(S.stats.bestStreak, S.streak); }
    }
    saveStats();
    monetization.track('shift_end', { kind: S.kind, g: S.g, score: sim.score, stars: o.stars, why: o.why });
    S.result = R0;
  }

  // ---- events -> sound and sparkle ------------------------------------------------------------------------------------------------------
  function handleEvents() {
    const sim = S.sim;
    if (!sim.ev.length) return;
    const l = L(), geo = geoOf(l);
    for (const e of sim.ev) {
      emit3(e);
      const c = e.i !== undefined && e.i >= 0 ? geo.cell(e.i) : null;
      const tk = e.cust !== undefined ? sim.customers.find((x) => x.id === e.cust) : null;
      const tr = tk && tk.slot >= 0 ? l.tickets[tk.slot] : null;
      switch (e.type) {
        case 'full': sfx.full(); if (c) spark(c.cx, c.cy, 6, '#f7ecc9', 120); break;
        case 'overflow': sfx.spill(); if (c) { floatText(c.cx, c.cy - c.r, 'Overflow', '#ff9d6a', 28); spark(c.cx, c.cy, 10, '#f7ecc9', 160); } break;
        case 'topping': sfx.top(); if (c) spark(c.cx, c.cy, 7, FILLINGS[e.fil].hue, 140); break;
        case 'flip': sfx.flip(e.q); if (c) { spark(c.cx, c.cy, e.golden ? 12 : 5, e.golden ? '#ffd45a' : '#ffffff', 170); if (e.golden) floatText(c.cx, c.cy - c.r * 0.9, 'Golden', '#ffd45a', 28); } break;
        case 'spill': sfx.spill(); if (c) { floatText(c.cx, c.cy - c.r * 0.9, 'Spilled!', '#ff6a55', 30); spark(c.cx, c.cy, 8, '#f7ecc9', 160); } break;
        case 'ready': sfx.ready(); if (c) spark(c.cx, c.cy - c.r * 0.5, 10, '#fff3b0', 150); break;
        case 'burnt': sfx.burnt(); if (c) { floatText(c.cx, c.cy - c.r, 'Burnt', '#ff6a55', 30); spark(c.cx, c.cy, 10, '#554030', 140); } break;
        case 'scrape': sfx.scrape(); break;
        case 'serve': {
          sfx.serve(sim.streak);
          const sx = e.from >= 0 ? geo.cell(e.from) : null, label = e.perfect ? `Perfect +${e.pts}` : `${grade(e.q)} +${e.pts}`;
          if (sx) floatText(sx.cx, sx.cy - sx.r, label, e.perfect ? '#ffd45a' : '#ffffff', 30);
          if (tr) spark(tr.x + tr.w / 2, tr.y + tr.h / 2, 8, '#ffd45a', 160);
          break;
        }
        case 'tray': sfx.tap(); if (c) floatText(c.cx, c.cy - c.r, 'Tray', '#ffffff', 26); break;
        case 'trayfull': say('The warm tray is full. Serve or scrape something.', 2); break;
        case 'ticket': sfx.bell(); if (tr) { floatText(tr.x + tr.w / 2, tr.y + tr.h * 0.7, `Thanks! +${e.tip}`, '#8be08a', 32); spark(tr.x + tr.w / 2, tr.y + tr.h / 2, 18, '#8be08a', 240); } break;
        case 'leave': sfx.leave(); if (tr) floatText(tr.x + tr.w / 2, tr.y + tr.h * 0.7, 'Left!', '#ff6a55', 32); break;
        case 'flame': sfx.tap(); break;
        case 'end': if (e.why === 'closed') sfx.lose(); else sfx.win(); break;
        default: break;
      }
    }
    sim.ev.length = 0;
  }

  // ---- hints and Watch and Learn --------------------------------------------------------------------------------------------------------------
  function makeHint() {
    const a = plan(S.sim);
    return a.kind === 'wait' ? null : { action: a, text: a.text, why: a.why, tool: toolFor(a), t: 0 };
  }
  function askHint() {
    const h = makeHint();
    if (!h) { say('Nothing needs doing yet. Watch the rings.', 2.2); return; }
    S.hint = h; sfx.top();
  }
  const words = (t) => t.split(' ').length;
  function autoTick(dt) {
    const a = S.auto;
    if (a.paused || a.done || S.paused || S.sim.done) return;
    if (a.phase === 'idle') { a.timer -= dt; if (a.timer <= 0) a.phase = null; return; }
    if (a.phase === 'think') {
      a.timer -= dt;
      if (a.timer > 0) return;
      a.phase = 'reveal'; a.timer = clamp(2 + words(S.hint.why) * 0.04, 2, 3);
      S.tool = S.hint.tool;
      return;
    }
    if (a.phase === 'reveal') {
      a.timer -= dt;
      if (a.timer > 0) return;
      applyPlan(S.sim, S.hint.action); S.tool = S.hint.tool; S.hint = null; a.phase = 'idle'; a.timer = 0.15; a.n += 1;
      return;
    }
    const h = makeHint();
    if (!h) { S.hint = null; a.phase = 'idle'; a.timer = 0.5; return; }
    S.hint = h; a.phase = 'think'; a.timer = THINK_STEPS[S.prefs.thinkIdx];
  }
  const worldSpeed = () => (S.auto.on && (S.auto.phase === 'think' || S.auto.phase === 'reveal') ? SLOW : 1) * (S.prefs.calm ? 0.8 : 1);

  // ---- play input -------------------------------------------------------------------------------------------------------------------------------
  // What a tool does when it meets a mould that is not "its" job: the picks take over (flip, pack, scrape).
  function actOn(idx, tool, first) {
    const sim = S.sim, m = sim.plate[idx];
    if (!m || !first) return;
    if (tool === 'picks') { const r = pick(sim, idx); if (r && r.act === 'flip') sfx.tap(); return; }
    if (tool === 'ladle') { pick(sim, idx); return; }
    if (tool.startsWith('f:')) {
      if (m.st === 'ball' && m.flips === 0 && !m.fil && m.fill >= 0.35) topping(sim, idx, tool.slice(2));
      else if (m.st === 'burnt' || m.flips > 0 || isReady(m)) pick(sim, idx);
    }
  }
  function selectTool(id) {
    if (id === 'flame') { setFlame(S.sim, (S.sim.flame + 1) % FLAMES.length); say(`Flame: ${FLAMES[S.sim.flame].name}`, 1.2); return; }
    if (id === 'hint') { if (S.hint) S.hint = null; else askHint(); return; }
    S.tool = id; sfx.tap();
  }
  function keyboardPlay(k) {
    const sim = S.sim, cols = sim.cols, rows = sim.rows;
    const mv = (dc, dr) => { S.kbd = true; const c = S.cursor % cols, r = Math.floor(S.cursor / cols); S.cursor = clamp(r + dr, 0, rows - 1) * cols + clamp(c + dc, 0, cols - 1); };
    if (k.has('ArrowLeft')) mv(-1, 0);
    if (k.has('ArrowRight')) mv(1, 0);
    if (k.has('ArrowUp')) mv(0, -1);
    if (k.has('ArrowDown')) mv(0, 1);
    const fills = sim.spec.fills.map((f) => 'f:' + f);
    const map = { Digit1: 'ladle', Digit2: fills[0], Digit3: fills[1], Digit4: fills[2], Digit5: 'picks' };
    for (const code of Object.keys(map)) if (k.has(code) && map[code]) { S.tool = map[code]; S.kbd = true; sfx.tap(); }
    if (k.has('KeyF')) selectTool('flame');
    if (k.has('KeyH')) selectTool('hint');
    if (k.has('Space') || k.has('Enter')) {
      S.kbd = true;
      const i = S.cursor, m = sim.plate[i];
      if (S.tool === 'ladle') { if (canPour(m)) { pour(sim, i, K.DOLLOP); sfx.glug(); S.pourFx = { i, age: 0 }; } else pick(sim, i); }
      else actOn(i, S.tool, true);
    }
  }

  function pauseOverlayTap(tap, l) {
    const pl = pauseLayout(meta.width, meta.height, { x: l.U.x0, y: l.U.y0, w: l.U.w, h: l.U.h });
    const hit = (id, r) => { if (r && inRect(r, tap.x, tap.y)) { flash(id); return true; } return false; };
    if (hit('resume', pl.resume)) S.paused = false;
    else if (hit('restart', pl.restart)) { S.paused = false; restartShift(); }
    else if (hit('psettings', pl.settings)) { S.back = 'play'; go('settings'); S.sceneT = 1; }
    else if (hit('pmenu', pl.menu)) { S.paused = false; S.sim = null; go(S.kind === 'journey' ? 'shifts' : 'title'); }
  }

  function updatePlay(dt, input) {
    const sim = S.sim, l = L(), geo = geoOf(l), p = input.pointer, k = input.keys.pressed;
    if (k.has('KeyP') || k.has('Escape')) { if (S.auto.on) S.auto.paused = !S.auto.paused; else if (!sim.done) S.paused = !S.paused; }
    const frozen = S.paused || (S.auto.on && S.auto.paused);
    if (!frozen) {
      if (sim.done) {
        S.endT += dt;
        if (S.endT > 2.2 && S.result && !S.auto.on) { go('over'); return; }
      } else {
        step(sim, dt * worldSpeed());
        if (S.auto.on) autoTick(dt);
        S.pourSnd -= dt;
        if (S.pourSnd < 0) { S.pourSnd = 0.22; if (sim.plate.some((m) => m.st === 'ball')) sfx.sizzle(); }
        if (S.hint && !S.auto.on) { S.hint.t += dt; if (S.hint.t > 7) S.hint = null; }
        if (sim.done) { S.endT = 0; S.hint = null; finishShift(); }
      }
      handleEvents();
    }
    if (S.paused) { if (p.pressed) pauseOverlayTap({ x: p.x, y: p.y }, l); return; }
    if (S.auto.on) {
      if (!p.pressed) return;
      const tap = { x: p.x, y: p.y }, hit = (id, r) => { if (inRect(r, tap.x, tap.y)) { flash(id); return true; } return false; };
      if (hit('aexit', l.rail.exit)) { S.auto.on = false; S.hint = null; S.sim = null; go('title'); }
      else if (hit('apause', l.rail.pause)) S.auto.paused = !S.auto.paused;
      else if (hit('adec', l.rail.dec)) { if (S.prefs.thinkIdx > 0) { S.prefs.thinkIdx -= 1; savePrefs(); } }
      else if (hit('ainc', l.rail.inc)) { if (S.prefs.thinkIdx < THINK_STEPS.length - 1) { S.prefs.thinkIdx += 1; savePrefs(); } }
      return;
    }
    if (sim.done) return;
    keyboardPlay(k);
    if (p.pressed) {
      S.kbd = false;
      const tap = { x: p.x, y: p.y };
      if (inRect(l.pause, tap.x, tap.y)) { flash('pause'); S.paused = true; S.stroke = null; return; }
      for (const id of l.ids) if (inRect(l.tools[id], tap.x, tap.y)) { flash('tool:' + id); selectTool(id); S.stroke = null; return; }
      S.stroke = { tool: S.tool, touched: new Set() };
    }
    const st = S.stroke;
    if (st && p.down) {
      const idx = geo.at(p.x, p.y);
      if (idx >= 0) {
        const m = sim.plate[idx], first = !st.touched.has(idx);
        st.touched.add(idx);
        if (st.tool === 'ladle' && canPour(m)) {
          if (pour(sim, idx, K.POUR_RATE * dt * (m.fill >= K.FULL ? K.BRIM_SLOW : 1))) { S.pourFx = { i: idx, age: 0 }; if (first || Math.floor(S.t * 10) % 3 === 0) sfx.glug(); }
        } else if (st.tool !== 'picks' || p.pressed) actOn(idx, st.tool, first);
      }
    }
    if (p.released || (!p.down && st)) S.stroke = null;
  }

  function getTap(p, rect) {
    if (!rect) { scrollG = null; return p.pressed ? { x: p.x, y: p.y } : null; }
    if (p.pressed) scrollG = { x0: p.x, y0: p.y, s0: S.scrollY, moved: false, inBody: inRect(rect, p.x, p.y) };
    let tap = null;
    if (scrollG) {
      if (p.down && scrollG.inBody) { const dy = p.y - scrollG.y0; if (Math.abs(dy) > 12) scrollG.moved = true; if (scrollG.moved) S.scrollY = clamp(scrollG.s0 - dy, 0, metrics.max); }
      if (p.released || !p.down) { if (!scrollG.moved) tap = { x: scrollG.x0, y: scrollG.y0 }; scrollG = null; }
    }
    return tap;
  }
  function textScale(dir) { const n = clamp(S.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (n !== S.prefs.textIdx) { S.prefs.textIdx = n; S.scrollY = 0; savePrefs(); } }
  function changeSetting(i, kx) {
    const id = settingsRows(S)[i].id, p = S.prefs;
    switch (id) {
      case 'sound': p.sound = kx === 0; audio.setMuted?.(!p.sound); break;
      case 'ring': p.ring = kx === 0; break;
      case 'calm': p.calm = kx === 1; break;
      case 'think': p.thinkIdx = clamp(kx, 0, THINK_STEPS.length - 1); break;
      case 'restore': {
        if (S.restoreBusy || S.owned) return;
        S.restoreBusy = true; S.restoreMsg = 'Checking with the store...';
        Promise.resolve().then(() => monetization.restore()).then(() => {
          S.owned = monetization.owns('unlock_game');
          S.restoreMsg = S.owned ? 'Purchase restored. Thank you!' : 'No earlier purchase found for this account.';
        }).catch(() => { S.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { S.restoreBusy = false; });
        return;
      }
      default: break;
    }
    savePrefs(); sfx.tap();
  }

  function updateScene(dt, input) {
    if (S.scene === 'play' && S.sim) return updatePlay(dt, input);
    const p = input.pointer, scrolling = ['shifts', 'doc', 'settings', 'over'].includes(S.scene);
    const tap = getTap(p, scrolling ? metrics.rect : null);
    if (scrolling) {
      if (wheelInput.dy) { S.scrollY = clamp(S.scrollY + wheelInput.dy, 0, metrics.max); wheelInput.dy = 0; }
      const k = input.keys.pressed;
      if (k.has('ArrowDown') && S.scene !== 'doc') S.scrollY = clamp(S.scrollY + 80, 0, metrics.max);
      if (k.has('ArrowUp') && S.scene !== 'doc') S.scrollY = clamp(S.scrollY - 80, 0, metrics.max);
      S.scrollY = clamp(S.scrollY, 0, metrics.max);
    }
    const sc = S.scene, w = meta.width, h = meta.height, esc = input.keys.pressed.has('Escape');
    const hit = (id, r) => { if (r && tap && inRect(r, tap.x, tap.y)) { flash(id); return true; } return false; };
    if (sc === 'title') {
      if (!tap) { if (input.keys.pressed.has('Enter') || input.keys.pressed.has('Space')) go('shifts'); return; }
      const T0 = titleLayout(w, h), B = T0.buttons;
      for (const id of Object.keys(B)) if (hit(id, B[id])) {
        sfx.tap();
        if (id === 'journey') go('shifts');
        else if (id === 'rush') startRush();
        else if (id === 'daily') startDaily();
        else if (id === 'learn') startAuto();
        else if (id === 'howto' || id === 'rules' || id === 'about') { S.doc = { kind: id, page: 0, fact: S.stats.runs % FACT_COUNT }; go('doc'); }
        else if (id === 'settings') { S.back = 'title'; go('settings'); }
        return;
      }
      if (Math.abs(tap.x - T0.brand.x) < 260 && Math.abs(tap.y - T0.brand.y) < 26) env.openArcforgeHome?.();
      return;
    }
    if (sc === 'shifts') {
      const LL = listLayout(w, h);
      if (esc) { go('title'); return; }
      if (!tap) return;
      if (hit('back', LL.back)) { go('title'); return; }
      if (hit('tdec', LL.textDec)) return textScale(-1);
      if (hit('tinc', LL.textInc)) return textScale(1);
      if (!inRect(LL.body, tap.x, tap.y)) return;
      const ty = tap.y + S.scrollY, J = shiftRects(LL.body, TEXT_SCALES[S.prefs.textIdx], shiftHeads(STALLS, LL.body.w, TEXT_SCALES[S.prefs.textIdx]));
      J.items.forEach((it) => it.lv.forEach((r, i) => { if (inRect(r, tap.x, ty)) { sfx.tap(); startJourney(it.ci * SHIFTS_PER_STALL + i); } }));
      return;
    }
    if (sc === 'doc') {
      const DL = docLayout(w, h), n = DOCS[S.doc.kind].pages.length;
      if (esc) { go('title'); return; }
      if (input.keys.pressed.has('ArrowRight') && S.doc.page < n - 1) { S.doc.page += 1; S.scrollY = 0; }
      if (input.keys.pressed.has('ArrowLeft') && S.doc.page > 0) { S.doc.page -= 1; S.scrollY = 0; }
      if (!tap) return;
      if (hit('back', DL.menu)) go('title');
      else if (hit('prev', DL.prev) && S.doc.page > 0) { S.doc.page -= 1; S.scrollY = 0; }
      else if (hit('next', DL.next) && S.doc.page < n - 1) { S.doc.page += 1; S.scrollY = 0; }
      else if (hit('tdec', DL.textDec)) textScale(-1);
      else if (hit('tinc', DL.textInc)) textScale(1);
      return;
    }
    if (sc === 'settings') {
      const ROWS = settingsRows(S), SL = settingsLayout(w, h, TEXT_SCALES[S.prefs.textIdx], ROWS.length);
      const leave = () => { if (S.back === 'play' && S.sim) { S.scene = 'play'; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
      if (esc) { leave(); return; }
      if (!tap) return;
      if (hit('back', SL.back)) return leave();
      if (hit('tdec', SL.textDec)) return textScale(-1);
      if (hit('tinc', SL.textInc)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) {
        const ty = tap.y + S.scrollY;
        ROWS.forEach((row, i) => {
          const g = SL.rows[i], n = row.opts.length, cw = (g.ctrl.w - 8 * (n - 1)) / n;
          for (let kx = 0; kx < n; kx++) { const r = { x: g.ctrl.x + kx * (cw + 8), y: g.ctrl.y, w: cw, h: g.ctrl.h }; if (inRect(r, tap.x, ty)) { flash('set' + i + '.' + kx); changeSetting(i, kx); } }
        });
      }
      return;
    }
    if (sc === 'over') {
      const R0 = S.result, O = overLayout(w, h);
      if (!tap || !R0) return;
      if (hit('next', O.btns.next)) {
        if (R0.kind === 'rush') { demoUncount(); startRush(); }
        else if (R0.kind === 'daily') go('title');
        else if (R0.why === 'closed') { demoUncount(); startJourney(R0.g); }
        else if (R0.next != null) startJourney(R0.next);
        else go('shifts');
      } else if (hit('menu', O.btns.menu)) go(R0.kind === 'journey' ? 'shifts' : 'title');
      else if (hit('share', O.btns.share)) {
        const nm = R0.kind === 'rush' ? 'Rush Hour' : R0.kind === 'daily' ? 'the Daily Shift' : `shift ${R0.g + 1}`;
        env.share(`Takoyaki Flip Stall, ${nm}: ${R0.score} points, ${R0.perfect} perfect balls${R0.kind === 'journey' ? `, ${R0.stars} star${R0.stars === 1 ? '' : 's'}` : ''}.`);
      }
      return;
    }
    if (sc === 'demo-limit' && tap) go('title');
  }

  return {
    update(dt, input) {
      S.t += dt; S.sceneT += dt;
      if (S.flash) { S.flash.t += dt; if (S.flash.t > 0.25) S.flash = null; }
      if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold) S.msg = null; }
      const frozen = S.paused || (S.auto.on && S.auto.paused);
      if (!frozen) {
        for (const sp of S.fx.parts) { sp.t += dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 620 * dt; }
        S.fx.parts = S.fx.parts.filter((sp) => sp.t < sp.life);
        for (const f of S.fx.floats) f.t += dt;
        S.fx.floats = S.fx.floats.filter((f) => f.t < f.life);
        if (S.pourFx) { S.pourFx.age += dt; if (S.pourFx.age > 0.25) S.pourFx = null; }
        for (const q of S.sfx) q.t -= dt;
        const due = S.sfx.filter((q) => q.t <= 0);
        if (due.length) { S.sfx = S.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
      }
      // the kit's preview pill sits top centre; it moves beside the pause button so it never covers the plate
      if (S.scene === 'play' && S.sim) meta.previewBadge = L().badge; else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { render(ctx, S, view ?? meta); },
    getState: () => S,
    // Counts real play only: a live shift (not paused, not Watch and Learn). Menus, Rules, settings, Watch and Learn, results are free.
    isPreviewExempt() {
      if (S.paused || S.auto.on) return true;
      if (S.scene === 'play') return !(S.sim && !S.sim.done);
      return true;
    },
    // Tester / screenshot hooks (only wired up in dev: see main.js).
    dev: {
      go: (scene, extra) => { Object.assign(S, extra ?? {}); go(scene); },
      shift: (g, seed = 1) => { S.dev = true; refreshOpen(); newShift('journey', g, { seed }); },
      rush: () => startRush(), daily: () => startDaily(), auto: () => startAuto(),
      doc: (kind, page = 0) => { S.doc = { kind, page, fact: 1 }; go('doc'); },
      // run the planner at `delay` seconds per action for `seconds` of shift time (fast, headless-safe)
      play: (seconds, delay = 0.6) => {
        const sim = S.sim; let acc = 0, t = 0;
        while (!sim.done && t < seconds) { step(sim, 1 / 60); t += 1 / 60; acc += 1 / 60; if (acc >= delay) { const a = plan(sim); if (a.kind !== 'wait') { applyPlan(sim, a); acc = 0; } else acc = delay; } }
        sim.ev.length = 0;
      },
      finish: () => {
        const sim = S.sim; let guard = 0, acc = 0;
        while (!sim.done && guard++ < 60 * 900) { step(sim, 1 / 60); acc += 1 / 60; if (acc >= 0.5) { const a = plan(sim); if (a.kind !== 'wait') { applyPlan(sim, a); acc = 0; } } }
        sim.ev.length = 0; S.endT = 0; finishShift(); go('over');
      },
      hint: () => askHint(), tool: (id) => { S.tool = id; },
      layout: () => { const l = L(), g = geoOf(l); return { mode: l.mode, area: l.area, tools: l.tools, tickets: l.tickets, tray: l.tray, banner: l.banner, pause: l.pause, rail: l.rail, cells: Array.from({ length: S.sim.plate.length }, (_, i) => g.cell(i)), w: meta.width, h: meta.height }; },
      setPrefs: (o) => { Object.assign(S.prefs, o); applyPrefs(); },
      unlockAll: () => { S.dev = true; refreshOpen(); },
      progress: (o) => { Object.assign(S.progress, o); refreshOpen(); },
    },
  };
}
