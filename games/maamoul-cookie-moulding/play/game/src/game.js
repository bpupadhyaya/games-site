// Maamoul Cookie Moulding: state and flow. Engine = engine.js, geometry = layout.js, drawing = view.js + art.js.
import { playLayout, titleLayout, docLayout, settingsLayout, listLayout, shiftRects, bookRects, overLayout, pauseLayout, inRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import {
  K, TYPES, makeSpec, makeSim, step, choose, dropFill, sealMove, sealTap, knockTap, place, placeableSlots, loadOven, pull, plan, applyPlan,
  readyTray, canChoose, TOTAL_SHIFTS, SHIFTS_PER_BAKERY, sealSegScore, grade,
} from './engine.js';
import { render, metrics, settingsRows, traysShown, totalStars } from './view.js';
import { trayGeo, PATTERNS, UNLOCK } from './art.js';
import { DOCS } from './content.js';
import { v3 } from './v3.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_SHIFTS = 3;
const SLOW = 0.12;           // world speed while Watch and Learn thinks and explains
const DEFAULT_PREFS = { sound: true, assist: false, guide: true, calm: false, textIdx: 0, thinkIdx: 1, pat: { date: 0, walnut: 0, pistachio: 0 } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FACT_COUNT = 6;
const BINS = 36;
const TAU = Math.PI * 2;

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS, pat: { ...DEFAULT_PREFS.pat } },
    sim: null, kind: 'journey', g: 0, kbd: false, cursor: 0, finished: false,
    paused: false, hint: null, auto: { on: false, phase: null, timer: 0, paused: false, n: 0, done: false },
    fx: { parts: [], floats: [] }, endT: 0, knockShake: 0,
    trace: { active: false, x: 0, y: 0, last: null, dir: 0, bins: Array(BINS).fill(-1) },
    msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0, fact: 0 }, back: 'title', result: null,
    progress: {}, stats: { rush: 0, runs: 0, days: [], bestStreak: 0 }, open: 0,
    daily: { day: config.day ?? 0 }, streak: 0, dailyDone: false, demo: config.demo === true, demoCount: 0, dev: config.dev === true, sfx: [],
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
  const fixPats = () => { for (const ty of Object.keys(UNLOCK)) S.prefs.pat[ty] = clamp(S.prefs.pat[ty] | 0, 0, 2); };
  storage.get('prefs', null).then((v) => {
    if (v) {
      S.prefs = { ...DEFAULT_PREFS, ...v, pat: { ...DEFAULT_PREFS.pat, ...(v.pat ?? {}) } };
      S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); fixPats();
    }
    applyPrefs();
  });
  storage.get('progress', null).then((v) => { if (v) { S.progress = { ...v, ...S.progress }; refreshOpen(); } });
  storage.get('stats', null).then((v) => { if (v) { S.stats = { ...S.stats, ...v, days: v.days ?? [] }; refreshDaily(); } });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  applyPrefs(); refreshOpen(); refreshDaily();

  // ---- sound -------------------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound) audio.tone(o); };
  const later = (t, o) => S.sfx.push({ t, o });
  const note = (k) => 262 * 2 ** (([0, 2, 4, 7, 9][((k % 5) + 5) % 5] + 12 * Math.floor(k / 5)) / 12);
  const sfx = {
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.06 }),
    pick: () => tone({ freq: 330, to: 300, dur: 0.06, type: 'triangle', vol: 0.08 }),
    fill: (q) => { tone({ freq: 220, to: 160, dur: 0.1, type: 'sine', vol: 0.1 }); later(0.05, { freq: 600 + 300 * q, to: 700 + 300 * q, dur: 0.1, type: 'triangle', vol: 0.07 }); },
    seal: (q) => tone({ freq: 380 + 160 * q, to: 460 + 160 * q, dur: 0.14, type: 'triangle', vol: 0.1 }),
    crimp: () => tone({ freq: 900, to: 800, dur: 0.02, type: 'square', vol: 0.012 }),
    knock: (q) => { tone({ freq: 150, to: 70, dur: 0.12, type: 'sine', vol: 0.2 }); tone({ freq: 420 + 220 * q, to: 300, dur: 0.06, type: 'triangle', vol: 0.06 }); },
    miss: () => tone({ freq: 180, to: 120, dur: 0.12, type: 'sawtooth', vol: 0.05 }),
    stray: () => tone({ freq: 260, to: 240, dur: 0.04, type: 'triangle', vol: 0.03 }),
    release: (q) => [0, 4, 7].forEach((st, i) => later(i * 0.07, { freq: 523 * 2 ** (st / 12) * (q > 0.85 ? 1.25 : 1), to: 523 * 2 ** (st / 12), dur: 0.2, type: 'triangle', vol: 0.09 })),
    place: (k) => tone({ freq: note(k + 5), to: note(k + 5), dur: 0.14, type: 'triangle', vol: 0.1 }),
    wrong: () => tone({ freq: 200, to: 150, dur: 0.12, type: 'square', vol: 0.05 }),
    door: () => { tone({ freq: 200, to: 110, dur: 0.25, type: 'sawtooth', vol: 0.07 }); },
    ding: () => { tone({ freq: 1319, to: 1319, dur: 0.5, type: 'sine', vol: 0.1 }); later(0.1, { freq: 1760, to: 1760, dur: 0.6, type: 'sine', vol: 0.07 }); },
    late: () => tone({ freq: 520, to: 420, dur: 0.2, type: 'square', vol: 0.05 }),
    pull: (m) => { tone({ freq: 300, to: 520, dur: 0.14, type: 'triangle', vol: 0.1 }); later(0.1, { freq: m > 0.85 ? 1047 : 440, to: 880, dur: 0.3, type: 'sine', vol: 0.09 }); },
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => later(i * 0.11, { freq: f, to: f, dur: 0.4, type: 'triangle', vol: 0.1 })),
    lose: () => [392, 330, 262].forEach((f, i) => later(i * 0.18, { freq: f, to: f * 0.9, dur: 0.4, type: 'triangle', vol: 0.09 })),
  };

  // ---- helpers ---------------------------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.4) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  S.demo = config.demo === true; S.owned = !!monetization.owns?.('unlock_game'); S.restoreBusy = false; S.restoreMsg = '';
  monetization.onChange?.(() => { S.owned = !!monetization.owns('unlock_game'); });
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; scrollG = null; wheelInput.dy = 0; S.msg = null; }
  const L = () => { const sp = S.sim.spec; return playLayout(meta.width, meta.height, { cols: sp.cols, rows: sp.rows, types: sp.types, auto: S.auto.on }); };
  const trayView = (l) => { const sim = S.sim, tr = sim.trays[traysShown(sim)]; return { tr, geo: trayGeo({ x: l.tray.x + 10, y: l.tray.y + 10, w: l.tray.w - 20, h: l.tray.h - 20 }, tr.cols, tr.rows) }; };
  function spark(x, y, n, color, speed = 240) {
    for (let i = 0; i < n; i++) { const a = rng.next() * TAU, v = 60 + rng.next() * speed; S.fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90, t: 0, life: 0.5 + rng.next() * 0.5, r: 3 + rng.next() * 4, c: color }); }
    if (S.fx.parts.length > 140) S.fx.parts.splice(0, S.fx.parts.length - 140);
  }
  function floatText(x, y, text, color, size = 34) { S.fx.floats.push({ x, y, text, color, size, t: 0, life: 1.1 }); if (S.fx.floats.length > 10) S.fx.floats.shift(); }
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_SHIFTS) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }
  function demoUncount() { if (config.demo && S.demoCount > 0) { S.demoCount -= 1; storage.set('demoCount', S.demoCount); } }
  const resetTrace = () => { S.trace = { active: false, x: 0, y: 0, last: null, dir: 0, bins: Array(BINS).fill(-1) }; };

  // ---- shifts ---------------------------------------------------------------------------------------------------------------------------------
  function newShift(kind, g, { auto = false, seed = 1 } = {}) {
    const spec = makeSpec(kind, g, seed);
    if (S.prefs.calm && !auto) { const old = spec.bake; spec.bake = old * 1.25; if (!spec.endless) spec.limit += Math.round(spec.trays * old * 0.12); }
    S.sim = makeSim(spec);
    S.kind = kind; S.g = g; S.hint = null; S.paused = false; S.finished = false; S.endT = 0; S.result = null; S.cursor = 0; S.knockShake = 0;
    S.fx = { parts: [], floats: [] }; S.msg = null; S.sfx = []; resetTrace();
    S.auto = { on: auto, phase: null, timer: 0, paused: false, n: 0, done: false };
    go('play');
    if (kind === 'journey' && g === 0 && !S.progress[0]) say('Pick a mould, then tap the bench when the filling reaches the dashed ring.', 5);
  }
  function startJourney(g) {
    if (g > S.open) { say('Finish the previous shift first.', 2); return; }
    if (demoBlocked()) return;
    newShift('journey', g, { seed: 1 });
  }
  function startRush() { if (demoBlocked()) return; newShift('rush', 0, { seed: rng.int(1 << 20) + 1 }); }
  function startDaily() { if (demoBlocked()) return; newShift('daily', 0, { seed: (S.daily.day | 0) + 11 }); }
  function startAuto() { newShift('demo', 0, { auto: true, seed: 3 }); say('Watch the game bake a small shift and explain each move.', 3); }
  function restartShift() {
    const { kind, g } = S;
    demoUncount();
    if (kind === 'journey') startJourney(g); else if (kind === 'rush') startRush(); else if (kind === 'daily') startDaily(); else startAuto();
  }

  function unlockedNow(stars) { const out = []; for (const ty of Object.keys(UNLOCK)) UNLOCK[ty].forEach((n, i) => { if (stars >= n) out.push(`${ty}:${i}`); }); return out; }
  function finishShift() {
    const sim = S.sim, o = sim.outcome;
    if (S.auto.on) { S.auto.done = true; S.auto.phase = null; S.hint = null; say('Shift complete. That is how a bench runs.', 6); return; }
    const done = sim.trays.filter((t) => t.st === 'done');
    const R0 = { kind: S.kind, g: S.g, score: sim.score, stars: o.stars, why: o.why, quality: o.quality, made: sim.made, perfect: sim.perfect, bestStreak: sim.bestStreak, timeLeft: o.timeLeft, trays: sim.traysDone, tray: done[done.length - 1] ?? null, fact: (S.stats.runs + sim.made) % FACT_COUNT, best0: S.stats.rush, next: null, newPattern: null };
    const before = totalStars(S);
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
    const after = totalStars(S);
    if (after > before) {
      const was = new Set(unlockedNow(before)), now = unlockedNow(after).filter((k) => !was.has(k));
      if (now.length) { const [ty, i] = now[0].split(':'); R0.newPattern = `${PATTERNS[ty][Number(i)].name} (${TYPES[ty].name.toLowerCase()})`; }
    }
    saveStats();
    monetization.track('shift_end', { kind: S.kind, g: S.g, score: sim.score, stars: o.stars, why: o.why });
    S.result = R0;
  }

  // ---- events -> sound and sparkle ------------------------------------------------------------------------------------------------------
  function handleEvents() {
    const sim = S.sim;
    if (!sim.ev.length) return;
    if (v3.ev.length > 40) v3.ev.length = 0;
    const l = L(), { geo } = trayView(l), d = l.dough;
    for (const e of sim.ev) {
      switch (e.type) {
        case 'choose': sfx.pick(); resetTrace(); break;
        case 'fill': v3.ev.push({ type: 'fill', x: d.cx, y: d.cy, q: e.q }); sfx.fill(e.q); floatText(d.cx, d.cy - d.R * 0.9, grade(e.q), e.q >= K.PERFECT ? '#ffd45a' : '#ffffff', 32); spark(d.cx, d.cy, 5, '#ffe6a8', 120); break;
        case 'seal': v3.ev.push({ type: 'seal', x: d.cx, y: d.cy, q: e.q }); sfx.seal(e.q); floatText(d.cx, d.cy - d.R * 0.9, `Sealed ${Math.round(e.q * 100)}%`, e.q >= K.PERFECT ? '#ffd45a' : '#ffffff', 30); break;
        case 'knock': v3.ev.push({ type: 'knock', x: d.cx, y: d.cy, q: e.q }); sfx.knock(e.q); S.knockShake = 1; spark(d.cx, d.cy + d.R * 0.9, 4, '#fff3d0', 100); break;
        case 'knockmiss': sfx.miss(); floatText(d.cx, d.cy - d.R * 1.2, 'Missed beat', '#ff7a63', 26); break;
        case 'stray': sfx.stray(); break;
        case 'released': v3.ev.push({ type: 'released', x: d.cx, y: d.cy, q: e.q }); sfx.release(e.q); spark(d.cx, d.cy, e.q >= K.PERFECT ? 14 : 6, e.q >= K.PERFECT ? '#ffd45a' : '#fff3d0', 200); break;
        case 'place': {
          const c = geo.cell(e.slot);
          v3.ev.push({ type: 'place', x: c.cx, y: c.cy, q: e.q, r: c.r });
          sfx.place(sim.streak); spark(c.cx, c.cy, e.perfect ? 10 : 4, e.perfect ? '#ffd45a' : '#ffffff', 140);
          floatText(c.cx, c.cy - c.r * 0.7, e.bonus ? `${grade(e.q)} +${e.bonus}` : grade(e.q), e.perfect ? '#ffd45a' : '#ffffff', 28);
          break;
        }
        case 'wrong': sfx.wrong(); say('That slot is for another type of cookie.', 1.6); break;
        case 'trayfull': say('Tray full! Load the oven.', 2.4); break;
        case 'load': v3.ev.push({ type: 'load', x: l.oven.x + l.oven.w / 2, y: l.oven.y + l.oven.h / 2 }); sfx.door(); break;
        case 'window': { sfx.ding(); const o = l.oven; spark(o.x + o.w / 2, o.y + o.h / 2, 8, '#8fe0a0', 140); break; }
        case 'late': sfx.late(); break;
        case 'pull': {
          sfx.pull(e.mul); const o = l.oven;
          v3.ev.push({ type: 'pull', x: o.x + o.w / 2, y: o.y + o.h / 2, q: e.mul });
          spark(o.x + o.w / 2, o.y + o.h / 2, e.mul > 0.85 ? 18 : 8, e.mul > 0.85 ? '#fff6d0' : '#a07040', 220);
          floatText(o.x + o.w / 2, o.y, `${e.name} +${e.pts}`, e.mul > 0.85 ? '#8fe0a0' : '#ff9d6a', 30);
          break;
        }
        case 'end': if (e.why === 'closed') sfx.lose(); else sfx.win(); break;
        default: break;
      }
    }
    sim.ev.length = 0;
  }

  // ---- hints and Watch and Learn --------------------------------------------------------------------------------------------------------------
  const stateKey = () => { const sim = S.sim, h = sim.hand; return `${h ? h.st + h.type : '-'}|${sim.oven.tray}|${sim.made}|${sim.traysDone}`; };
  function makeHint() {
    const a = plan(S.sim);
    return a.kind === 'wait' ? null : { action: a, text: a.text, why: a.why, t: 0, key: stateKey() };
  }
  function askHint() {
    const h = makeHint();
    if (!h) { say('Nothing needs doing yet. Watch the oven.', 2.2); return; }
    S.hint = h; sfx.pick();
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
      return;
    }
    if (a.phase === 'reveal') {
      a.timer -= dt;
      if (a.timer > 0) return;
      const act = S.hint.action, now = plan(S.sim);
      if (now.kind === act.kind) { applyPlan(S.sim, now); a.n += 1; }
      else if (now.kind !== 'wait') { applyPlan(S.sim, now); a.n += 1; }
      S.hint = null; a.phase = 'idle'; a.timer = 0.15;
      return;
    }
    const h = makeHint();
    if (!h) { S.hint = null; a.phase = 'idle'; a.timer = 0.4; return; }
    S.hint = h; a.phase = 'think'; a.timer = THINK_STEPS[S.prefs.thinkIdx];
  }
  const worldSpeed = () => (S.auto.on && (S.auto.phase === 'think' || S.auto.phase === 'reveal') ? SLOW : 1);

  // ---- play input -------------------------------------------------------------------------------------------------------------------------------
  function ovenAction() {
    const sim = S.sim;
    if (sim.oven.tray >= 0) { pull(sim); return true; }
    if (readyTray(sim) >= 0) { loadOven(sim); return true; }
    say('Fill a tray first.', 1.6);
    return false;
  }
  function benchTap() {
    const sim = S.sim, h = sim.hand;
    if (!h) return;
    if (h.st === 'fill') dropFill(sim);
    else if (h.st === 'seal' && S.prefs.assist) sealTap(sim);
    else if (h.st === 'knock') knockTap(sim);
    else if (h.st === 'place') { const sl = placeableSlots(sim); if (sl.length) place(sim, sl[0]); }
  }
  function traceUpdate(p, l) {
    const sim = S.sim, h = sim.hand, d = l.dough, tr = S.trace;
    if (!h || h.st !== 'seal' || S.prefs.assist || h.auto) return;
    const dx = p.x - d.cx, dy = p.y - d.cy, dist = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    tr.active = true; tr.x = p.x; tr.y = p.y;
    if (dist < d.R * 0.3 || dist > d.R * 2.4) { tr.last = null; return; }
    if (tr.last !== null) {
      let da = ang - tr.last;
      while (da > Math.PI) da -= TAU;
      while (da < -Math.PI) da += TAU;
      // a jump of more than ~57 degrees in one frame is a layout change (rotation) or a lifted-and-replaced finger: no credit
      if (Math.abs(da) > 1.0) { tr.last = ang; return; }
      if (tr.dir === 0 && Math.abs(da) > 0.02) tr.dir = Math.sign(da);
      if (Math.abs(da) > 1e-4 && (tr.dir === 0 || Math.sign(da) === tr.dir)) {
        const err = Math.abs(dist - d.R * 1.0) / (d.R * 0.35);
        const before = h.seal.prog;
        sealMove(sim, Math.abs(da), err);
        const idx = Math.floor((((ang + Math.PI / 2) % TAU) + TAU) % TAU / (TAU / BINS)) % BINS;
        tr.bins[idx] = sealSegScore(err);
        if (Math.floor(h.seal.prog * 24) !== Math.floor(before * 24)) sfx.crimp();
      }
    }
    tr.last = ang;
  }
  function keyboardPlay(k) {
    const sim = S.sim, types = sim.spec.types;
    ['Digit1', 'Digit2', 'Digit3'].forEach((code, i) => { if (k.has(code) && types[i]) { S.kbd = true; if (canChoose(sim, types[i])) choose(sim, types[i]); } });
    const tr = sim.trays[traysShown(sim)], n = tr.slots.length;
    if (k.has('ArrowLeft')) { S.kbd = true; S.cursor = (S.cursor + n - 1) % n; }
    if (k.has('ArrowRight')) { S.kbd = true; S.cursor = (S.cursor + 1) % n; }
    if (k.has('ArrowUp')) { S.kbd = true; S.cursor = (S.cursor + n - tr.cols) % n; }
    if (k.has('ArrowDown')) { S.kbd = true; S.cursor = (S.cursor + tr.cols) % n; }
    if (k.has('KeyH')) { S.kbd = true; if (S.hint) S.hint = null; else askHint(); }
    if (k.has('KeyO')) { S.kbd = true; ovenAction(); }
    if (k.has('Space')) {
      S.kbd = true;
      const h = sim.hand;
      if (h && h.st === 'seal' && !S.prefs.assist) sealTap(sim);   // keyboard has no rim to trace: Space seals at the assisted quality
      else benchTap();
    }
    if (k.has('Enter')) {
      S.kbd = true;
      const h = sim.hand;
      if (h && h.st === 'place') place(sim, S.cursor);
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
    const sim = S.sim, l = L(), p = input.pointer, k = input.keys.pressed;
    if (k.has('KeyP') || k.has('Escape')) { if (S.auto.on) S.auto.paused = !S.auto.paused; else if (!sim.done) S.paused = !S.paused; }
    const frozen = S.paused || (S.auto.on && S.auto.paused);
    if (!frozen) {
      if (!sim.done) {
        step(sim, dt * worldSpeed());
        if (S.auto.on) autoTick(dt);
        if (S.hint && !S.auto.on) { S.hint.t += dt; if (S.hint.t > 8 || S.hint.key !== stateKey()) S.hint = null; }
      }
      if (sim.done) {   // the shift can also end from a player action (the last pull), so finishing is checked every tick
        if (!S.finished) { S.finished = true; S.endT = 0; S.hint = null; finishShift(); }
        else S.endT += dt;
        if (S.endT > 2.2 && S.result && !S.auto.on) { go('over'); return; }
      }
      handleEvents();
      if (S.knockShake > 0) S.knockShake = Math.max(0, S.knockShake - dt * 4);
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
    const h = sim.hand;
    if (p.pressed) {
      S.kbd = false;
      const tap = { x: p.x, y: p.y };
      if (inRect(l.pause, tap.x, tap.y)) { flash('pause'); S.paused = true; return; }
      for (const id of l.ids) {
        if (!inRect(l.rack[id], tap.x, tap.y)) continue;
        flash('rack:' + id);
        if (id === 'hint') { if (S.hint) S.hint = null; else askHint(); }
        else if (canChoose(sim, id)) choose(sim, id);
        else say(h && h.st !== 'fill' ? 'Finish this cookie first.' : 'The tray has no empty slot for that one.', 1.6);
        return;
      }
      if (inRect(l.ovenBtn, tap.x, tap.y) || inRect(l.oven, tap.x, tap.y)) { flash('oven'); ovenAction(); return; }
      if (h && h.st === 'place') {
        const { geo } = trayView(l), idx = geo.at(tap.x, tap.y);
        if (idx >= 0 && inRect(l.tray, tap.x, tap.y)) { place(sim, idx); return; }
      }
      if (inRect(l.bench, tap.x, tap.y)) {
        if (h && h.st === 'seal' && !S.prefs.assist) { S.trace.last = null; traceUpdate(p, l); }
        else benchTap();
      }
    } else if (p.down && h && h.st === 'seal' && !S.prefs.assist) {
      traceUpdate(p, l);
    }
    if (!p.down && S.trace.active) { S.trace.active = false; S.trace.last = null; }
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
  // Restore purchase: busy -> owned / not found / could not reach the store. Never blocks play.
  function doRestore() {
    if (S.restoreBusy || S.owned || config.demo) return;
    S.restoreBusy = true; S.restoreMsg = 'Checking with the store...';
    Promise.resolve().then(() => monetization.restore()).then(() => {
      S.owned = !!monetization.owns?.('unlock_game');
      S.restoreMsg = S.owned ? 'Full game unlocked. Thank you!' : 'No earlier purchase was found for this store account.';
    }).catch(() => { S.restoreMsg = 'Could not reach the store. Please try again later.'; }).finally(() => { S.restoreBusy = false; });
  }
  function textScale(dir) { const n = clamp(S.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (n !== S.prefs.textIdx) { S.prefs.textIdx = n; S.scrollY = 0; savePrefs(); } }
  function changeSetting(i, kx) {
    const id = settingsRows(S)[i].id, p = S.prefs;
    switch (id) {
      case 'sound': p.sound = kx === 0; audio.setMuted?.(!p.sound); break;
      case 'assist': p.assist = kx === 1; break;
      case 'guide': p.guide = kx === 0; break;
      case 'calm': p.calm = kx === 1; break;
      case 'think': p.thinkIdx = clamp(kx, 0, THINK_STEPS.length - 1); break;
      case 'restore': doRestore(); return;
      default: break;
    }
    savePrefs(); sfx.tap();
  }

  function updateScene(dt, input) {
    if (S.scene === 'play' && S.sim) return updatePlay(dt, input);
    const p = input.pointer, scrolling = ['shifts', 'doc', 'settings', 'over', 'book'].includes(S.scene);
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
        else if (id === 'book') go('book');
        else if (id === 'share') env.share('Maamoul Cookie Moulding: fill, seal and knock out carved cookies, then catch the oven at pale gold.');
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
      const ty = tap.y + S.scrollY, J = shiftRects(LL.body, TEXT_SCALES[S.prefs.textIdx]);
      J.items.forEach((it) => it.lv.forEach((r, i) => { if (inRect(r, tap.x, ty)) { sfx.tap(); startJourney(it.ci * SHIFTS_PER_BAKERY + i); } }));
      return;
    }
    if (sc === 'book') {
      const LL = listLayout(w, h);
      if (esc) { go('title'); return; }
      if (!tap) return;
      if (hit('back', LL.back)) { go('title'); return; }
      if (hit('tdec', LL.textDec)) return textScale(-1);
      if (hit('tinc', LL.textInc)) return textScale(1);
      if (!inRect(LL.body, tap.x, tap.y)) return;
      const ty = tap.y + S.scrollY, Bk = bookRects(LL.body, TEXT_SCALES[S.prefs.textIdx]), types = ['date', 'walnut', 'pistachio'], stars = totalStars(S);
      Bk.items.forEach((it) => it.tiles.forEach((r, i) => {
        if (!inRect(r, tap.x, ty)) return;
        const ty0 = types[it.ti];
        if (stars >= UNLOCK[ty0][i]) { S.prefs.pat[ty0] = i; savePrefs(); sfx.tap(); }
        else say(`Collect ${UNLOCK[ty0][i]} stars to unlock this pattern.`, 2);
      }));
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
      const SL = settingsLayout(w, h, TEXT_SCALES[S.prefs.textIdx], settingsRows(S).length);
      const leave = () => { if (S.back === 'play' && S.sim) { S.scene = 'play'; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
      if (esc) { leave(); return; }
      if (!tap) return;
      if (hit('back', SL.back)) return leave();
      if (hit('tdec', SL.textDec)) return textScale(-1);
      if (hit('tinc', SL.textInc)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) {
        const ty = tap.y + S.scrollY;
        settingsRows(S).forEach((row, i) => {
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
        env.share(`Maamoul Cookie Moulding, ${nm}: ${R0.score} points, ${R0.perfect} perfect cookies${R0.kind === 'journey' ? `, ${R0.stars} star${R0.stars === 1 ? '' : 's'}` : ''}.`);
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
        for (const q of S.sfx) q.t -= dt;
        const due = S.sfx.filter((q) => q.t <= 0);
        if (due.length) { S.sfx = S.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
      }
      // the kit's preview pill sits top centre; it moves beside the pause button so it never covers the tray
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
      // run the planner at `delay` seconds per action for `seconds` of shift time; stopAt: stop BEFORE doing a step of that kind
      play: (seconds, delay = 0.6, stopAt = null) => {
        const sim = S.sim; let acc = 0, t = 0;
        while (!sim.done && t < seconds) {
          step(sim, 1 / 60); t += 1 / 60; acc += 1 / 60;
          if (acc >= delay) {
            const a = plan(sim);
            if (a.kind !== 'wait') { if (stopAt && a.kind === stopAt) break; applyPlan(sim, a); acc = 0; } else acc = delay;
          }
        }
        sim.ev.length = 0;
      },
      finish: () => {
        const sim = S.sim; let guard = 0, acc = 0;
        while (!sim.done && guard++ < 60 * 900) { step(sim, 1 / 60); acc += 1 / 60; if (acc >= 0.4) { const a = plan(sim); if (a.kind !== 'wait') { applyPlan(sim, a); acc = 0; } } }
        sim.ev.length = 0; S.endT = 0; S.finished = true; finishShift(); go('over');
      },
      hint: () => askHint(),
      state: () => { const h = S.sim && S.sim.hand; return { scene: S.scene, st: h ? h.st : null, ph: h ? h.ph : null, target: h ? h.target : null, done: !!(S.sim && S.sim.done), made: S.sim ? S.sim.n : 0, paused: S.paused, size: [meta.width, meta.height] }; },
      layout: () => {
        const l = L(), { geo } = trayView(l), tr = S.sim.trays[traysShown(S.sim)];
        return { mode: l.mode, tray: l.tray, bench: l.bench, rack: l.rack, oven: l.oven, ovenBtn: l.ovenBtn, banner: l.banner, pause: l.pause, rail: l.rail, dough: l.dough, cells: tr.slots.map((_, i) => geo.cell(i)), w: meta.width, h: meta.height };
      },
      setPrefs: (o) => { Object.assign(S.prefs, o); applyPrefs(); },
      unlockAll: () => { S.dev = true; refreshOpen(); },
      progress: (o) => { Object.assign(S.progress, o); refreshOpen(); },
    },
  };
}
