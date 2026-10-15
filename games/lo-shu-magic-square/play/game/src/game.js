// Lo Shu Magic Square: state and flow. Engine = engine.js, session = play.js, drawing = view.js, geometry = layout.js.
import { playLayout, titleLayout, docLayout, settingsLayout, listLayout, journeyRects, freeRects, overLayout, pauseLayout, inRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { LIBRARY } from './library.js';
import { VARIANTS, fromEntry, transformPuzzle, findHint, linesFor, lineStats } from './engine.js';
import { newSession, place, lift, undoMove, redoMove, resetStones, solvedNow, wrongNow, starsFor, fmtTime, PAR_SECONDS, isGiven } from './play.js';
import { render, metrics, settingRows, cellAt } from './view.js';
import { DOCS, CHAPTERS, TIERS, TECH_NAME } from './content.js';
import { setLook, LOOK_IDS } from './ui.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_PUZZLES = 3;
const DAILY = ['five', 'loshu', 'four', 'shift3', 'pan4', 'four', 'pan5'];   // by weekday, 0 = Sunday
const VIDS = Object.keys(VARIANTS);
const DEFAULT_PREFS = { look: 'jade', numerals: 'digits', check: 'sums', hilite: true, timer: true, sound: true, calm: false, lefty: false, textIdx: 0, thinkIdx: 1, autoVariant: 'loshu' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (a, b = 0) => { let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; return h >>> 0; };
const vhash = (id) => [...id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
const KEY_DIGIT = (code) => { const m = /^(?:Digit|Numpad)([0-9])$/.exec(code); return m ? Number(m[1]) : -1; };
export const levelKey = (ci, i) => `${ci}:${i}`;
export const totalLevels = () => CHAPTERS.reduce((a, c) => a + c.count, 0);

export function puzzleFor(vid, idx, seed) {
  const lib = LIBRARY[vid], e = lib[clamp(idx, 0, lib.length - 1)], P = fromEntry(e), h = hash(seed, vhash(vid));
  return transformPuzzle(P, h & 7, (h >> 3) & 1, (h >> 4) % P.n, (h >> 8) % P.n);
}
const tierIndex = (vid, tier, pick) => { const n = LIBRARY[vid].length, a = Math.floor((n * tier) / 3), b = Math.max(a + 1, Math.floor((n * (tier + 1)) / 3)); return a + (pick % (b - a)); };
const levelIndex = (vid, i, count) => Math.round((i / Math.max(1, count - 1)) * (LIBRARY[vid].length - 1));

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS },
    P: null, sel: -1, held: 0, drag: null, hint: null, paused: false, lineFocus: -1, lineFocusT: 0,
    auto: { on: false, phase: null, timer: 0, paused: false, n: 0, done: false },
    fx: { pop: {}, shake: {}, pulse: {} }, sparks: [], winT: 0, winDelay: 0, sfx: [],
    msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0 }, back: 'title', result: null,
    progress: {}, stats: { solved: {}, best: {}, days: [], bestStreak: 0 }, saved: null,
    daily: { day: config.day ?? 0 }, streak: 0, dailyDone: false, dailyVariant: 'loshu', demoCount: 0, saveAcc: 0, dev: config.dev === true,
    demo: config.demo === true, owned: false, restore: { busy: false, msg: '', t: 0 },
  };
  const syncOwned = () => { S.owned = monetization.owns('unlock_game'); };
  syncOwned(); monetization.onChange?.(syncOwned);
  let saveRaw = null, gesture = null, scrollG = null;

  // ---- persistence ---------------------------------------------------------------------------------------------------------
  const applyPrefs = () => { setLook(S.prefs.look); audio.setMuted?.(!S.prefs.sound); };
  const savePrefs = () => storage.set('prefs', S.prefs);
  const saveProgress = () => storage.set('progress', S.progress);
  const saveStats = () => storage.set('stats', S.stats);
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); if (!LOOK_IDS.includes(S.prefs.look)) S.prefs.look = 'jade'; } applyPrefs(); });
  storage.get('progress', null).then((v) => { if (v) S.progress = { ...v, ...S.progress }; });
  storage.get('stats', null).then((v) => { if (v) S.stats = { ...S.stats, ...v, days: v.days ?? [], solved: v.solved ?? {}, best: v.best ?? {} }; refreshDaily(); });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  storage.get('save', null).then((v) => { if (v && v.puz && S.scene === 'title' && !S.P) { saveRaw = v; S.saved = { variant: v.variant, kind: v.kind, t: v.t, level: v.level }; } });
  applyPrefs();

  function refreshDaily() {
    const day = S.daily.day, set = new Set(S.stats.days);
    let streak = 0, d = set.has(day) ? day : day - 1;
    while (set.has(d)) { streak += 1; d -= 1; }
    S.streak = streak; S.dailyDone = set.has(day); S.dailyVariant = DAILY[(((day + 4) % 7) + 7) % 7];
  }
  refreshDaily();
  function persistSession() {
    const P = S.P;
    if (!P || P.done || S.auto.on) return;
    saveRaw = { puz: P.puz, grid: P.grid.slice(), variant: P.variant, kind: P.kind, ref: P.ref, level: P.level, t: P.t, errs: P.errs, hints: P.hints, moves: P.moves };
    S.saved = { variant: P.variant, kind: P.kind, t: P.t, level: P.level };
    storage.set('save', saveRaw);
  }
  const clearSave = () => { saveRaw = null; S.saved = null; storage.remove('save'); };

  // ---- sound ------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound) audio.tone(o); };
  const later = (t, o) => S.sfx.push({ t, o });
  const PENT = [0, 2, 4, 7, 9];
  const sfx = {
    place: (v) => { const k = v % 10; tone({ freq: 392 * 2 ** ((PENT[k % 5] + 12 * Math.floor(k / 5)) / 12), to: 300, dur: 0.1, type: 'sine', vol: 0.12 }); },
    lift: () => tone({ freq: 520, to: 700, dur: 0.05, type: 'sine', vol: 0.06 }),
    err: () => tone({ freq: 190, to: 120, dur: 0.16, type: 'triangle', vol: 0.09 }),
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.06 }),
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.08 }),
    line: () => { [660, 880, 1175].forEach((f, i) => later(i * 0.08, { freq: f, to: f * 1.01, dur: 0.22, type: 'triangle', vol: 0.08 })); },
    win: () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => later(i * 0.12, { freq: f, to: f, dur: 0.45, type: 'triangle', vol: 0.09 })); },
  };

  // ---- helpers -----------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.6) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; gesture = null; scrollG = null; S.drag = null; wheelInput.dy = 0; S.msg = null; }
  const nOf = () => (S.P ? S.P.puz.n : 3);
  const L = () => playLayout(meta.width, meta.height, { n: nOf(), pan: !!S.P?.puz.pan, coach: !!(S.hint || S.auto.on), lefty: S.prefs.lefty });
  function spark(cx, cy, n, color) {
    for (let i = 0; i < n; i++) { const a = rng.next() * Math.PI * 2, v = 80 + rng.next() * 260; S.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0, life: 0.7 + rng.next() * 0.6, r: 3 + rng.next() * 4, c: color }); }
    if (S.sparks.length > 160) S.sparks.splice(0, S.sparks.length - 160);
  }
  const cellCenter = (i) => { const r = L().board.cells[i]; return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
  const isDone = (ci, i) => !!S.progress[levelKey(ci, i)];
  const globalIndex = (ci, i) => CHAPTERS.slice(0, ci).reduce((a, c) => a + c.count, 0) + i;
  const unlocked = (ci, i) => {
    if (S.dev || config.demo) return true;
    if (ci === 0 && i === 0) return true;
    const g = globalIndex(ci, i); if (g === 0) return true;
    const pc = i > 0 ? ci : ci - 1, pi = i > 0 ? i - 1 : CHAPTERS[ci - 1].count - 1;
    return isDone(pc, pi) || isDone(ci, i);
  };
  const nextLevel = (ci, i) => (i + 1 < CHAPTERS[ci].count ? [ci, i + 1] : ci + 1 < CHAPTERS.length ? [ci + 1, 0] : null);

  // ---- starting puzzles ---------------------------------------------------------------------------------------------------------------
  function begin(P, extra = {}) {
    S.P = P; S.sel = -1; S.held = 0; S.drag = null; S.hint = null; S.paused = false; S.msg = null; S.lineFocus = -1;
    S.auto = { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, ...extra };
    S.fx = { pop: {}, shake: {}, pulse: {} }; S.sparks = []; S.winT = 0; S.winDelay = 0; S.result = null; S.saveAcc = 0;
    go('play');
  }
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_PUZZLES) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }
  function startLevel(ci, i) {
    if (!unlocked(ci, i)) { say('Solve the previous square first.', 2); return; }
    if (demoBlocked()) return;
    const ch = CHAPTERS[ci], puz = puzzleFor(ch.variant, levelIndex(ch.variant, i, ch.count), 1000 + ci * 50 + i);
    S.prefs.autoVariant = ch.variant; savePrefs();
    begin(newSession({ puz, kind: 'journey', ref: levelKey(ci, i), variant: ch.variant, level: globalIndex(ci, i) }));
    persistSession();
  }
  function startFree(vid, tier) {
    if (demoBlocked()) return;
    const puz = puzzleFor(vid, tierIndex(vid, tier, rng.int(1 << 20)), rng.int(1 << 30));
    S.prefs.autoVariant = vid; savePrefs();
    begin(newSession({ puz, kind: 'free', ref: `${vid}:${tier}`, variant: vid, level: tier }));
    persistSession();
  }
  function startDaily() {
    if (demoBlocked()) return;
    const vid = S.dailyVariant, day = S.daily.day, puz = puzzleFor(vid, tierIndex(vid, 1, hash(day, 5)), day * 7919 + 13);
    begin(newSession({ puz, kind: 'daily', ref: `day:${day}`, variant: vid, level: 1 }));
    S.P.day = day;
    persistSession();
  }
  function resumeSaved() {
    const v = saveRaw;
    if (!v) return;
    const P = newSession({ puz: v.puz, kind: v.kind, ref: v.ref, variant: v.variant, level: v.level });
    P.grid = v.grid.slice(); P.t = v.t; P.errs = v.errs; P.hints = v.hints; P.moves = v.moves ?? 0;
    if (v.kind === 'daily') P.day = Number(String(v.ref).split(':')[1]);
    begin(P);
    say('Welcome back.', 1.6);
  }
  function startAuto() {
    const vid = VARIANTS[S.prefs.autoVariant] ? S.prefs.autoVariant : 'loshu';
    const puz = puzzleFor(vid, tierIndex(vid, 0, rng.int(1 << 20)), rng.int(1 << 30));
    begin(newSession({ puz, kind: 'auto', variant: vid }), { on: true });
  }

  // ---- placing ------------------------------------------------------------------------------------------------------------------------
  function linesDone(P) { return new Set(lineStats(P.puz, P.grid).filter((s) => s.ok).map((s) => s.id)); }
  function doPlace(cell, v) {
    const P = S.P, before = linesDone(P);
    const r = place(P, cell, v);
    if (!r.ok) return false;
    S.fx.pop[cell] = 0; S.hint = null; S.held = 0; S.sel = -1;
    sfx.place(v);
    if (r.bad && S.prefs.check === 'marks') { S.fx.shake[cell] = 0; sfx.err(); }
    const after = linesDone(P); let fresh = 0;
    for (const id of after) if (!before.has(id)) { S.fx.pulse[id] = 0; fresh += 1; }
    if (fresh) { sfx.line(); const p = cellCenter(cell); spark(p.x, p.y, 10 + fresh * 4, '#ffd45a'); }
    persistSession();
    if (solvedNow(P)) win();
    return true;
  }
  function doLift(cell) {
    const r = lift(S.P, cell);
    if (!r.ok) return false;
    S.held = r.value; S.sel = -1; S.hint = null; sfx.lift(); persistSession();
    return true;
  }
  function doUndo() { if (undoMove(S.P)) { S.hint = null; S.held = 0; sfx.lift(); persistSession(); } else say('Nothing to undo.', 1.4); }
  function doRedo() { if (redoMove(S.P)) { S.hint = null; S.held = 0; sfx.lift(); persistSession(); } else say('Nothing to redo.', 1.4); }
  function doReset() { if (resetStones(S.P)) { S.hint = null; S.held = 0; sfx.lift(); persistSession(); say('All your stones are back in the tray. Undo brings them back.', 2.4); } }

  // ---- hints (also drive Watch and Learn) ---------------------------------------------------------------------------------------------------------
  function makeHint() { const h = findHint(S.P.puz, S.P.grid); return h ? { stage: h.tech === 'mistake' ? 'mistake' : 'look', h, text: h.look } : null; }
  function askHint() {
    const h = makeHint();
    if (!h) { say('The square is complete.'); return; }
    S.P.hints += 1; S.hint = h; S.held = 0; S.sel = h.h.cell; sfx.hint();
  }
  function applyHintStep() {
    const P = S.P, h = S.hint.h;
    S.hint = null;
    if (h.tech === 'mistake') { lift(P, h.cell); S.held = 0; sfx.lift(); persistSession(); return; }
    P.counts[h.tech] = (P.counts[h.tech] ?? 0) + 1;
    doPlace(h.cell, h.value);
  }
  function hintGo() {
    const h = S.hint;
    if (!h) return;
    if (h.stage === 'look') { h.stage = 'explain'; h.text = h.h.why; sfx.tap(); return; }
    applyHintStep();
  }

  // ---- winning -------------------------------------------------------------------------------------------------------------------------------
  function win() {
    const P = S.P;
    P.done = true; S.hint = null; S.winT = 3.2; S.winDelay = 1.9;
    const lines = linesFor(P.puz.n, P.puz.pan);
    lines.forEach((l, k) => { S.fx.pulse[l.id] = -k * 0.08; });
    const b = L().board; spark(b.x + b.w / 2, b.y + b.h / 2, 70, '#ffd45a'); sfx.win();
    if (S.auto.on) { S.auto.done = true; S.auto.phase = null; say('Solved. That is every step.', 4); return; }
    const v = P.variant, best = S.stats.best[v], first = !best || P.t < best;
    S.stats.solved[v] = (S.stats.solved[v] ?? 0) + 1;
    if (P.t > 0 && first) S.stats.best[v] = Math.max(1, Math.round(P.t));
    const stars = starsFor(P);
    if (P.kind === 'journey') { const old = S.progress[P.ref]; S.progress[P.ref] = { stars: Math.max(old?.stars ?? 0, stars), time: old ? Math.min(old.time, Math.round(P.t)) : Math.round(P.t) }; saveProgress(); }
    let streak = S.streak;
    if (P.kind === 'daily' && P.day === S.daily.day && !S.stats.days.includes(P.day)) { S.stats.days.push(P.day); S.stats.days = S.stats.days.slice(-200); refreshDaily(); streak = S.streak; S.stats.bestStreak = Math.max(S.stats.bestStreak, streak); }
    saveStats(); clearSave();
    if (P.kind === 'daily' && P.day === S.daily.day) storage.set('daily', { day: P.day, streak });
    monetization.track('square_solved', { variant: v, kind: P.kind, t: Math.round(P.t) });
    const techs = Object.entries(P.counts).map(([id, n]) => ({ id, n, name: TECH_NAME[id] ?? id })).sort((a, b2) => b2.n - a.n);
    let next = null;
    if (P.kind === 'journey') { const [ci, i] = P.ref.split(':').map(Number); next = nextLevel(ci, i); }
    S.result = { stars, time: P.t, par: PAR_SECONDS[v], errs: P.errs, hints: P.hints, techs, newBest: first, daily: P.kind === 'daily', streak, variant: v, kind: P.kind, ref: P.ref, next, n: P.puz.n };
  }

  // ---- Watch and Learn ------------------------------------------------------------------------------------------------------------------------------
  const wordCount = (t) => t.split(' ').length;
  const AUTO_GAP = 0.3;
  function autoTick(dt) {
    const a = S.auto, P = S.P;
    if (a.paused || a.done) return;
    if (a.phase === 'gap') { a.timer -= dt; if (a.timer <= 0) a.phase = null; return; }
    if (a.phase === 'think') {
      a.timer -= dt;
      if (a.timer > 0) return;
      S.hint.stage = 'explain'; S.hint.text = S.hint.h.why; a.phase = 'reveal';
      a.timer = a.trivial ? 1.6 + wordCount(S.hint.text) * 0.12 : clamp(2 + wordCount(S.hint.text) * 0.2, 2, 9);
      return;
    }
    if (a.phase === 'reveal') {
      a.timer -= dt;
      if (a.timer > 0) return;
      const h = S.hint.h;
      S.hint = null; P.counts[h.tech] = (P.counts[h.tech] ?? 0) + 1;
      doPlace(h.cell, h.value); P.hints = 0; a.phase = 'gap'; a.timer = AUTO_GAP;
      return;
    }
    const h = makeHint();
    if (!h) { a.done = true; return; }
    if (h.stage === 'mistake') { S.hint = h; applyHintStep(); a.phase = 'gap'; a.timer = AUTO_GAP; return; }
    S.hint = h; a.n += 1; a.phase = 'think';
    a.trivial = h.h.tech === 'last-in-line';
    const base = THINK_STEPS[S.prefs.thinkIdx];
    a.timer = a.trivial ? Math.max(0.9, base * 0.3) : base;
    S.sel = h.h.cell;
  }

  // ---- input -----------------------------------------------------------------------------------------------------------------------------------------
  function hitBtn(id, r, tap) { if (inRect(r, tap.x, tap.y)) { flash(id); return true; } return false; }
  function gaugeAt(l, x, y) {
    const P = S.P, n = P.puz.n, Ls = linesFor(n, P.puz.pan), g = l.board.gauges, rad = g.r * 1.15;
    const pts = [];
    Ls.forEach((ln) => {
      let p;
      if (ln.kind === 'row') p = g.rows[ln.idx]; else if (ln.kind === 'col') p = g.cols[ln.idx];
      else if (!P.puz.pan) p = ln.kind === 'diag' ? g.diagStd : g.antiStd;
      else if (ln.kind === 'diag' || ln.kind === 'bdiag') p = g.tops[ln.idx]; else p = g.lefts[ln.idx];
      pts.push({ id: ln.id, p });
    });
    const hit = pts.find((q) => Math.hypot(q.p.x - x, q.p.y - y) <= rad);
    return hit ? hit.id : -1;
  }
  function traySource(l, x, y) {
    if (!l.tray) return null;
    const nums = S.P.puz.nums;
    for (let i = 0; i < l.tray.slots.length; i++) { const r = l.tray.slots[i]; if (inRect(r, x, y) && S.P.grid.indexOf(nums[i]) < 0) return { kind: 'tray', v: nums[i], slot: i }; }
    return null;
  }
  function tapPlay(tap, l) {
    const P = S.P;
    if (hitBtn('pause', l.pause, tap)) { S.paused = true; persistSession(); return; }
    const ci = cellAt(l.board, tap.x, tap.y);
    if (ci >= 0) {
      if (isGiven(P, ci)) { S.fx.shake[ci] = 0; S.sel = -1; return; }
      if (S.held) { doPlace(ci, S.held); return; }
      if (P.grid[ci]) { doLift(ci); return; }
      S.sel = S.sel === ci ? -1 : ci; sfx.tap(); return;
    }
    const gid = gaugeAt(l, tap.x, tap.y);
    if (gid >= 0) { S.lineFocus = S.lineFocus === gid ? -1 : gid; S.lineFocusT = 0; sfx.tap(); return; }
    if (S.hint) {
      if (hitBtn('close', l.coachBtns.close, tap)) S.hint = null;
      else if (hitBtn('go', l.coachBtns.go, tap)) hintGo();
      return;
    }
    const src = traySource(l, tap.x, tap.y);
    if (src) {
      if (S.sel >= 0 && !isGiven(P, S.sel)) { doPlace(S.sel, src.v); return; }
      S.held = S.held === src.v ? 0 : src.v; sfx.tap(); return;
    }
    if (l.tray && inRect(l.tray.rect, tap.x, tap.y) && S.held && P.grid.indexOf(S.held) < 0) { S.held = 0; return; }
    const T = l.tools;
    if (hitBtn('undo', T.undo, tap)) doUndo();
    else if (hitBtn('redo', T.redo, tap)) doRedo();
    else if (hitBtn('hint', T.hint, tap)) askHint();
    else if (hitBtn('reset', T.reset, tap)) doReset();
    else S.held = 0;
  }
  function updateGesture(p, l) {
    if (p.pressed) {
      const src = traySource(l, p.x, p.y) ?? (() => { const i = cellAt(l.board, p.x, p.y); return i >= 0 && S.P.grid[i] && !isGiven(S.P, i) ? { kind: 'cell', v: S.P.grid[i], slot: i } : null; })();
      gesture = { x0: p.x, y0: p.y, moved: false, src };
    }
    if (!gesture) return null;
    if (p.down && gesture.src && !gesture.moved && Math.hypot(p.x - gesture.x0, p.y - gesture.y0) > 18) { gesture.moved = true; S.held = 0; S.sel = -1; }
    if (gesture.moved && p.down) S.drag = { v: gesture.src.v, x: p.x, y: p.y, from: gesture.src.kind === 'cell' ? gesture.src.slot : -1 };
    if (p.released || !p.down) {
      const g = gesture; gesture = null; S.drag = null;
      if (g.moved) {
        const i = cellAt(l.board, p.x, p.y);
        if (i >= 0 && !isGiven(S.P, i)) doPlace(i, g.src.v);
        else if (g.src.kind === 'cell') doLift(g.src.slot) && (S.held = 0);
        return null;
      }
      return { x: g.x0, y: g.y0 };
    }
    return null;
  }

  function updatePlay(dt, input) {
    const P = S.P, l = L(), p = input.pointer;
    if (!S.paused && !P.done && !S.auto.on && S.winT <= 0) { P.t += dt; S.saveAcc += dt; if (S.saveAcc > 6) { S.saveAcc = 0; persistSession(); } }
    if (S.auto.on && !S.auto.paused && !S.paused) autoTick(dt);
    if (S.winDelay > 0) { S.winDelay -= dt; if (S.winDelay <= 0 && S.result) go('over'); }
    const k = input.keys.pressed;
    if (!S.auto.on && !S.paused && !P.done) {
      const n = P.puz.n;
      const mv = (dx, dy) => { if (S.sel < 0) { S.sel = Math.floor(n * n / 2); return; } S.sel = clamp(Math.floor(S.sel / n) + dy, 0, n - 1) * n + clamp((S.sel % n) + dx, 0, n - 1); };
      if (k.has('ArrowLeft')) mv(-1, 0); if (k.has('ArrowRight')) mv(1, 0); if (k.has('ArrowUp')) mv(0, -1); if (k.has('ArrowDown')) mv(0, 1);
      for (const code of k) { const d = KEY_DIGIT(code); if (d > 0 && S.sel >= 0 && P.puz.nums.includes(d) && P.grid.indexOf(d) < 0) doPlace(S.sel, d); }
      if ((k.has('Backspace') || k.has('Delete')) && S.sel >= 0) { if (P.grid[S.sel]) doLift(S.sel); S.held = 0; }
      if (k.has('KeyU')) doUndo(); if (k.has('KeyY')) doRedo();
      if (k.has('KeyH')) { if (S.hint) hintGo(); else askHint(); }
    }
    if (k.has('KeyP') || k.has('Escape')) { if (S.auto.on) S.auto.paused = !S.auto.paused; else if (!P.done) { S.paused = !S.paused; if (S.paused) persistSession(); } }
    let tap = null;
    if (!S.paused && !S.auto.on && !P.done && !S.hint) tap = updateGesture(p, l);
    else { gesture = null; S.drag = null; if (p.pressed) tap = { x: p.x, y: p.y }; }
    if (!tap) return;
    if (S.paused) {
      const pl = pauseLayout(meta.width, meta.height, l.board);
      if (hitBtn('resume', pl.resume, tap)) S.paused = false;
      else if (hitBtn('restart', pl.restart, tap)) { const g = P.puz; begin(newSession({ puz: { ...g, givens: g.givens.slice() }, kind: P.kind, ref: P.ref, variant: P.variant, level: P.level })); S.P.day = P.day; persistSession(); }
      else if (hitBtn('psettings', pl.settings, tap)) { S.back = 'play'; go('settings'); }
      else if (hitBtn('pmenu', pl.menu, tap)) { persistSession(); S.paused = false; go('title'); }
      return;
    }
    if (S.auto.on) {
      if (hitBtn('aexit', l.rail.exit, tap)) { S.auto.on = false; S.hint = null; S.P = null; go('title'); }
      else if (hitBtn('apause', l.rail.pause, tap)) S.auto.paused = !S.auto.paused;
      else if (hitBtn('adec', l.rail.dec, tap)) { if (S.prefs.thinkIdx > 0) { S.prefs.thinkIdx -= 1; savePrefs(); } }
      else if (hitBtn('ainc', l.rail.inc, tap)) { if (S.prefs.thinkIdx < THINK_STEPS.length - 1) { S.prefs.thinkIdx += 1; savePrefs(); } }
      return;
    }
    if (P.done) return;
    tapPlay(tap, l);
  }

  function doRestore() {
    const R2 = S.restore;
    if (R2.busy || S.owned || S.demo) return;
    R2.busy = true; R2.msg = '';
    Promise.resolve(monetization.restore()).then(() => {
      syncOwned(); R2.msg = S.owned ? 'Purchase restored' : 'No earlier purchase found';
    }).catch(() => { R2.msg = 'Could not reach the store. Try again later.'; }).finally(() => { R2.busy = false; R2.t = 0; });
  }
  function changeSetting(i, k) {
    const id = settingRows(S)[i].id, p = S.prefs;
    switch (id) {
      case 'look': p.look = LOOK_IDS[k]; setLook(p.look); break;
      case 'numerals': p.numerals = ['digits', 'dots', 'chinese'][k]; break;
      case 'check': p.check = ['sums', 'marks', 'off'][k]; break;
      case 'hilite': p.hilite = k === 0; break;
      case 'timer': p.timer = k === 0; break;
      case 'lefty': p.lefty = k === 1; break;
      case 'sound': p.sound = k === 0; audio.setMuted?.(!p.sound); break;
      case 'calm': p.calm = k === 1; break;
      case 'restore': doRestore(); return;
      default: break;
    }
    savePrefs(); sfx.tap();
  }
  function textScale(dir) { const n = clamp(S.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (n !== S.prefs.textIdx) { S.prefs.textIdx = n; S.scrollY = 0; savePrefs(); } }

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

  function updateScene(dt, input) {
    const p = input.pointer, scrolling = ['journey', 'free', 'doc', 'settings', 'stats', 'over'].includes(S.scene);
    if (S.scene === 'play') return updatePlay(dt, input);
    const tap = getTap(p, scrolling ? metrics.rect : null);
    if (scrolling) {
      if (wheelInput.dy) { S.scrollY = clamp(S.scrollY + wheelInput.dy, 0, metrics.max); wheelInput.dy = 0; }
      const k = input.keys.pressed;
      if (k.has('ArrowDown')) S.scrollY = clamp(S.scrollY + 80, 0, metrics.max);
      if (k.has('ArrowUp')) S.scrollY = clamp(S.scrollY - 80, 0, metrics.max);
      S.scrollY = clamp(S.scrollY, 0, metrics.max);
    }
    const sc = S.scene, w = meta.width, h = meta.height, esc = input.keys.pressed.has('Escape');
    if (sc === 'title') {
      if (!tap) { if (input.keys.pressed.has('Enter') || input.keys.pressed.has('Space')) go('journey'); return; }
      const T = titleLayout(w, h, !!S.saved), B = T.buttons;
      for (const id of Object.keys(B)) if (hitBtn(id, B[id], tap)) {
        sfx.tap();
        if (id === 'continue') resumeSaved();
        else if (id === 'journey') go('journey');
        else if (id === 'free') go('free');
        else if (id === 'daily') startDaily();
        else if (id === 'learn') startAuto();
        else if (id === 'howto' || id === 'rules' || id === 'about') { S.doc = { kind: id, page: 0 }; go('doc'); }
        else if (id === 'stats') go('stats');
        else if (id === 'settings') { S.back = 'title'; go('settings'); }
        return;
      }
      if (Math.abs(tap.x - T.brand.x) < 260 && Math.abs(tap.y - T.brand.y) < 26) env.openArcforgeHome?.();
      return;
    }
    if (sc === 'journey' || sc === 'free') {
      const LL = listLayout(w, h);
      if (esc) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', LL.back, tap)) { go('title'); return; }
      if (hitBtn('tdec', LL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', LL.textInc, tap)) return textScale(1);
      if (!inRect(LL.body, tap.x, tap.y)) return;
      const ty = tap.y + S.scrollY, sc2 = TEXT_SCALES[S.prefs.textIdx];
      if (sc === 'journey') {
        const J = journeyRects(LL.body, CHAPTERS.map((c) => c.count), sc2, CHAPTERS.map((c) => c.blurb));
        J.items.forEach((it) => it.lv.forEach((r, i) => { if (inRect(r, tap.x, ty)) { sfx.tap(); startLevel(it.ci, i); } }));
      } else {
        const Fr = freeRects(LL.body, VIDS.length, sc2);
        Fr.cards.forEach((c, vi) => c.tiers.forEach((r, t) => { if (inRect(r, tap.x, ty)) { sfx.tap(); startFree(VIDS[vi], t); } }));
      }
      return;
    }
    if (sc === 'doc') {
      const DL = docLayout(w, h), n = DOCS[S.doc.kind].pages.length;
      if (esc) { go('title'); return; }
      if (input.keys.pressed.has('ArrowRight') && S.doc.page < n - 1) { S.doc.page += 1; S.scrollY = 0; }
      if (input.keys.pressed.has('ArrowLeft') && S.doc.page > 0) { S.doc.page -= 1; S.scrollY = 0; }
      if (!tap) return;
      if (hitBtn('back', DL.menu, tap)) go('title');
      else if (hitBtn('prev', DL.prev, tap) && S.doc.page > 0) { S.doc.page -= 1; S.scrollY = 0; }
      else if (hitBtn('next', DL.next, tap) && S.doc.page < n - 1) { S.doc.page += 1; S.scrollY = 0; }
      else if (hitBtn('tdec', DL.textDec, tap)) textScale(-1);
      else if (hitBtn('tinc', DL.textInc, tap)) textScale(1);
      return;
    }
    if (sc === 'settings') {
      const rows = settingRows(S), SL = settingsLayout(w, h, TEXT_SCALES[S.prefs.textIdx], rows.length);
      const leave = () => { if (S.back === 'play' && S.P) { S.scene = 'play'; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
      if (esc) { leave(); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) return leave();
      if (hitBtn('tdec', SL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', SL.textInc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) {
        const ty = tap.y + S.scrollY;
        rows.forEach((row, i) => {
          const g = SL.rows[i], n = row.opts.length, cw = (g.ctrl.w - 8 * (n - 1)) / n;
          for (let k = 0; k < n; k++) { const r = { x: g.ctrl.x + k * (cw + 8), y: g.ctrl.y, w: cw, h: g.ctrl.h }; if (inRect(r, tap.x, ty)) { flash('set' + i + '.' + k); changeSetting(i, k); } }
        });
      }
      return;
    }
    if (sc === 'stats') {
      const SL = listLayout(w, h);
      if (esc) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) go('title');
      else if (hitBtn('tdec', SL.textDec, tap)) textScale(-1);
      else if (hitBtn('tinc', SL.textInc, tap)) textScale(1);
      return;
    }
    if (sc === 'over') {
      const R0 = S.result, O = overLayout(w, h, TEXT_SCALES[S.prefs.textIdx], R0?.n ?? 3);
      if (!tap || !R0) return;
      if (hitBtn('next', O.btns.next, tap)) {
        if (R0.kind === 'journey' && R0.next) startLevel(R0.next[0], R0.next[1]);
        else if (R0.kind === 'journey') go('journey');
        else if (R0.daily) go('title');
        else startFree(R0.variant, Number(R0.ref.split(':')[1] ?? 1));
      } else if (hitBtn('menu', O.btns.menu, tap)) { if (R0.kind === 'journey') go('journey'); else if (R0.daily) go('free'); else go('title'); }
      else if (hitBtn('share', O.btns.share, tap)) env.share(`Lo Shu Magic Square ${R0.daily ? 'daily square' : VARIANTS[R0.variant].name}: solved in ${fmtTime(R0.time)}, ${R0.stars} star${R0.stars === 1 ? '' : 's'}${R0.daily ? '. Streak ' + R0.streak : ''}.`);
      return;
    }
    if (sc === 'demo-limit' && tap) go('title');
  }

  return {
    update(dt, input) {
      S.t += dt; S.sceneT += dt;
      if (S.flash) { S.flash.t += dt; if (S.flash.t > 0.25) S.flash = null; }
      if (S.restore.msg) { S.restore.t += dt; if (S.restore.t > 5) S.restore.msg = ''; }
      if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold) S.msg = null; }
      const frozen = S.paused || (S.auto.on && S.auto.paused);
      if (!frozen) {
        const adv = (o, lim) => { for (const k of Object.keys(o)) { o[k] += dt; if (o[k] > lim) delete o[k]; } };
        adv(S.fx.pop, 0.4); adv(S.fx.shake, 0.5);
        for (const k of Object.keys(S.fx.pulse)) { S.fx.pulse[k] += dt; if (S.fx.pulse[k] > 0.8) delete S.fx.pulse[k]; }
        for (const sp of S.sparks) { sp.t += dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 600 * dt; }
        S.sparks = S.sparks.filter((sp) => sp.t < sp.life);
        if (S.winT > 0) S.winT -= dt;
        if (S.lineFocus >= 0) { S.lineFocusT += dt; if (S.lineFocusT > 2.2) S.lineFocus = -1; }
        for (const q of S.sfx) q.t -= dt;
        const due = S.sfx.filter((q) => q.t <= 0); if (due.length) { S.sfx = S.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
      }
      // the kit's preview pill sits top centre; in landscape it moves into the info panel so it never covers the board
      if (S.scene === 'play') { const l = L(); if (l.mode === 'portrait') { const k = meta.cssPerUnit || 1, ph = Math.max(16, 11.5 / k) * 1.7; meta.previewBadge = { x: l.pause.x - 14, y: l.hud.title.y + 62 - ph / 2, align: 'right' }; } else meta.previewBadge = l.badge ? { x: l.badge.x, y: l.badge.y, align: 'center' } : null; } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { render(ctx, S, view ?? meta); },
    getState: () => S,
    // Counts real play only: a live square in progress. Menus, Rules, settings, Watch and Learn, pause, results are free.
    isPreviewExempt() { return !(S.scene === 'play' && !S.auto.on && !S.paused && S.P && !S.P.done); },
    // Tester/screenshot hooks (only wired up in dev: see main.js).
    dev: {
      go: (scene, extra) => { Object.assign(S, extra ?? {}); go(scene); },
      level: (ci, i) => { S.dev = true; startLevel(ci, i); }, free: (vid, tier) => startFree(vid, tier), daily: () => startDaily(), auto: () => startAuto(),
      hint: () => askHint(), hintGo: () => hintGo(),
      progress: (n) => { const P = S.P; let k = 0; for (let i = 0; i < P.grid.length && k < n; i++) if (!P.grid[i]) { P.grid[i] = P.puz.sol[i]; k += 1; } },
      select: (i) => { S.sel = i; }, doc: (kind, page = 0) => { S.doc = { kind, page }; go('doc'); },
      layout: () => { const l = L(); return { mode: l.mode, tray: l.tray, tools: l.tools, cells: l.board.cells, w: meta.width, h: meta.height }; },
      solveNow: () => { const P = S.P; P.grid = P.puz.sol.slice(); win(); }, skipOver: () => { S.winDelay = 0.01; },
      setPrefs: (o) => { Object.assign(S.prefs, o); applyPrefs(); },
      unlockAll: () => { S.dev = true; },
    },
  };
}
