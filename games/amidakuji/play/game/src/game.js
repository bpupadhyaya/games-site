// Amidakuji: state and flow. Engine = engine.js, geometry = layout.js, drawing = view.js + art.js.
import { playLayout, titleLayout, docLayout, settingsLayout, listLayout, journeyRects, tierRects, lotsRects, overLayout, pauseLayout, ladderGeo, inRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { CHAPTERS_SPEC, makePuzzle, flatten, findHint, canPlace, idx, routes, route, seeded, makeRound, ROUNDS, TIERS, LOT_SETS, makeLots, MAX_LINES } from './engine.js';
import { pathLength, waypoints } from './art.js';
import { render, metrics, SETTINGS, settingsRows } from './view.js';
import { DOCS, CHAPTERS } from './content.js';
import { setLook, LOOK_IDS } from './ui.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
export const UNIT = 0.26;   // seconds per path unit for a released lantern
const DEMO_SESSIONS = 3;
const DEFAULT_PREFS = { look: 'indigo', numerals: 'digits', guide: false, sound: true, calm: false, textIdx: 0, thinkIdx: 1 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const levelKey = (ci, i) => `${ci}:${i}`;
export const totalLevels = () => CHAPTERS.reduce((a, c) => a + c.count, 0);
const globalIndex = (ci, i) => CHAPTERS.slice(0, ci).reduce((a, c) => a + c.count, 0) + i;
const puzzleSeed = (ci, i) => 1000 + ci * 50 + i;
export const fmtTime = (t) => { const s = Math.max(0, Math.floor(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const puzzleCache = new Map();
export function puzzleFor(ci, i, seed = puzzleSeed(ci, i)) {
  const key = `${ci}:${i}:${seed}`;
  let P = puzzleCache.get(key);
  if (!P) { P = makePuzzle(CHAPTERS_SPEC[ci], i, seed); puzzleCache.set(key, P); if (puzzleCache.size > 40) puzzleCache.delete(puzzleCache.keys().next().value); }
  return P;
}
export const runDuration = (n, rows, calm) => (pathLength(waypoints({ xs: new Array(n).fill(0), ys: new Array(rows).fill(0), tokenY: 0, bowlY: 0, rows }, new Array(rows + 1).fill(0))) + 1.2) * (calm ? UNIT * 0.62 : UNIT);

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS },
    B: null,            // build session
    hint: null, hl: null, paused: false, cursor: { r: 0, g: 0 },
    auto: { on: false, phase: null, timer: 0, paused: false, n: 0, done: false },
    F: null,            // follow session
    LT: null,           // draw-lots session
    run: null,
    lotsCfg: { players: 4, set: 'order' },
    fx: { shake: {}, pop: {} }, sparks: [], winT: 0, winDelay: 0, sfx: [],
    msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0 }, back: 'title', result: null,
    progress: {}, stats: { best: {}, runs: 0, lots: 0, solved: 0, days: [], bestStreak: 0 }, saved: null,
    owned: false, restoreBusy: false, daily: { day: config.day ?? 0 }, demo: config.demo === true, kbd: false, streak: 0, dailyDone: false, demoCount: 0, saveAcc: 0, dev: config.dev === true,
  };
  let saveRaw = null, scrollG = null;

  // ---- persistence ---------------------------------------------------------------------------------------------------------------------------
  const applyPrefs = () => { setLook(S.prefs.look); audio.setMuted?.(!S.prefs.sound); };
  const savePrefs = () => storage.set('prefs', S.prefs);
  const saveProgress = () => storage.set('progress', S.progress);
  const saveStats = () => storage.set('stats', S.stats);
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); if (!LOOK_IDS.includes(S.prefs.look)) S.prefs.look = 'indigo'; } applyPrefs(); });
  storage.get('progress', null).then((v) => { if (v) S.progress = { ...v, ...S.progress }; });
  storage.get('stats', null).then((v) => { if (v) S.stats = { ...S.stats, ...v, best: v.best ?? {}, days: v.days ?? [] }; refreshDaily(); });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  storage.get('save', null).then((v) => { if (v && v.ref && v.puz && S.scene === 'title' && !S.B) { saveRaw = v; S.saved = { kind: v.kind, level: v.level, t: v.t, n: v.puz.n }; } });
  applyPrefs();
  S.owned = !!monetization.owns?.('unlock_game');
  monetization.onChange?.(() => { S.owned = !!monetization.owns('unlock_game'); });

  function refreshDaily() {
    const day = S.daily.day, set = new Set(S.stats.days);
    let streak = 0, d = set.has(day) ? day : day - 1;
    while (set.has(d)) { streak += 1; d -= 1; }
    S.streak = streak; S.dailyDone = set.has(day);
  }
  refreshDaily();
  function persistSession() {
    const B = S.B;
    if (!B || B.done || S.auto.on) return;
    saveRaw = { puz: B.P, player: B.player.slice(), kind: B.kind, ref: B.ref, level: B.level, t: B.t, fails: B.fails, hints: B.hints };
    S.saved = { kind: B.kind, level: B.level, t: B.t, n: B.P.n };
    storage.set('save', saveRaw);
  }
  const clearSave = () => { saveRaw = null; S.saved = null; storage.remove('save'); };

  // ---- sound ----------------------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound) audio.tone(o); };
  const later = (t, o) => S.sfx.push({ t, o });
  const PENT = [0, 2, 4, 7, 9];
  const note = (k) => 330 * 2 ** ((PENT[((k % 5) + 5) % 5] + 12 * Math.floor(k / 5)) / 12);
  const sfx = {
    place: (r) => tone({ freq: note(r), to: note(r) * 0.8, dur: 0.12, type: 'triangle', vol: 0.13 }),
    lift: () => tone({ freq: 520, to: 700, dur: 0.05, type: 'sine', vol: 0.06 }),
    err: () => tone({ freq: 190, to: 120, dur: 0.16, type: 'triangle', vol: 0.09 }),
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.06 }),
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.08 }),
    home: (k) => tone({ freq: note(k + 5), to: note(k + 5), dur: 0.3, type: 'sine', vol: 0.1 }),
    win: () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => later(i * 0.12, { freq: f, to: f, dur: 0.45, type: 'triangle', vol: 0.09 })); },
    cross: (k) => tone({ freq: note(k), to: note(k), dur: 0.05, type: 'sine', vol: 0.04 }),
  };

  // ---- helpers ----------------------------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.6) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; scrollG = null; wheelInput.dy = 0; S.msg = null; }
  const BTN = () => {
    if (S.scene === 'play') return ['release', 'undo', 'hint', 'clear'];
    if (S.scene === 'lots' && S.LT) { const p = S.LT.phase; return p === 'add' ? ['skip', 'undo'] : p === 'reveal' ? ['next', 'all'] : p === 'done' ? ['again', 'lotsmenu'] : []; }
    return [];
  };
  const L = () => playLayout(meta.width, meta.height, { coach: !!(S.hint || S.auto.on), buttons: S.auto.on ? [] : BTN(), band: S.scene === 'follow' || S.scene === 'lots' ? 84 : 0 });
  const curDims = () => {
    if (S.scene === 'play' && S.B) return { n: S.B.P.n, rows: S.B.P.rows };
    if (S.scene === 'follow' && S.F?.cur) return { n: S.F.cur.n, rows: S.F.cur.rows };
    if (S.scene === 'lots' && S.LT) return { n: S.LT.lad.n, rows: S.LT.lad.rows };
    return { n: 3, rows: 5 };
  };
  const geoOf = (l) => { const d = curDims(); return ladderGeo(l.area, d.n, d.rows); };
  function spark(cx, cy, n, color) {
    for (let i = 0; i < n; i++) { const a = rng.next() * Math.PI * 2, v = 80 + rng.next() * 260; S.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0, life: 0.7 + rng.next() * 0.6, r: 3 + rng.next() * 4, c: color }); }
    if (S.sparks.length > 160) S.sparks.splice(0, S.sparks.length - 160);
  }
  const isDone = (ci, i) => !!S.progress[levelKey(ci, i)];
  const unlocked = (ci, i) => {
    if (S.dev || config.demo) return true;
    const g = globalIndex(ci, i); if (g === 0) return true;
    const pc = i > 0 ? ci : ci - 1, pi = i > 0 ? i - 1 : CHAPTERS[ci - 1].count - 1;
    return isDone(pc, pi) || isDone(ci, i);
  };
  const nextLevel = (ci, i) => (i + 1 < CHAPTERS[ci].count ? [ci, i + 1] : ci + 1 < CHAPTERS.length ? [ci + 1, 0] : null);
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_SESSIONS) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }
  function demoUncount() { if (config.demo && S.demoCount > 0) { S.demoCount -= 1; storage.set('demoCount', S.demoCount); } }
  const cellsOf = (B) => flatten(B.P, B.player);

  // ---- a lantern run (shared animation state) -----------------------------------------------------------------------------------------------
  // run: { t, routes: [route per token], who: [tokens that move], ... }. Positions are computed at render time from the live geometry.
  function startRun(rt, who, n, rows, after) {
    const calm = S.prefs.calm;
    S.run = { t: 0, routes: rt, who, n, rows, dur: runDuration(n, rows, calm), stagger: calm ? 0.05 : 0.08, after, pastRow: rt.map(() => -1), unit: calm ? UNIT * 0.62 : UNIT, done: false };
  }
  function runTick(dt) {
    const R0 = S.run;
    if (!R0 || R0.done) return;
    const before = R0.t;
    R0.t += dt;
    // a soft tick each time the first lantern passes a row on which it crosses a rung
    R0.who.forEach((tok, k) => {
      const s = (R0.t - k * R0.stagger) / R0.unit - 1.3, row = Math.floor(s);
      if (row >= 0 && row < R0.rows && row > R0.pastRow[tok]) { R0.pastRow[tok] = row; if (R0.routes[tok][row + 1] !== R0.routes[tok][row] && k === 0) sfx.cross(R0.routes[tok][row + 1] + row); }
    });
    const total = R0.dur + R0.stagger * R0.who.length;
    if (before < total && R0.t >= total) { R0.done = true; const f = R0.after; R0.after = null; f?.(); }
  }

  // ---- build puzzles -------------------------------------------------------------------------------------------------------------------------
  function newBuild(P, extra) {
    const { auto, ...rest } = extra;
    S.B = { P, player: [], undo: [], redo: [], t: 0, fails: 0, hints: 0, done: false, trace: [], bad: [], homeFlag: null, kind: 'journey', ref: '', level: 0, ...rest };
    S.hint = null; S.hl = null; S.paused = false; S.msg = null; S.run = null; S.fx = { shake: {}, pop: {} }; S.sparks = []; S.winT = 0; S.winDelay = 0; S.result = null; S.saveAcc = 0;
    S.cursor = { r: Math.floor(P.rows / 2), g: 0 };
    S.auto = { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, ...(auto ?? {}) };
    go('play');
  }
  function startLevel(ci, i) {
    if (!unlocked(ci, i)) { say('Solve the previous ladder first.', 2); return; }
    if (demoBlocked()) return;
    newBuild(puzzleFor(ci, i), { kind: 'journey', ref: levelKey(ci, i), level: globalIndex(ci, i) });
    if (ci === 0 && i === 0 && !isDone(0, 0)) say('Tap between two lines to add a rung. Tap a lantern to see its path. Then press Release.', 5);
    persistSession();
  }
  function startDaily() {
    if (demoBlocked()) return;
    const day = S.daily.day, ci = 1 + (((day % 4) + 4) % 4), li = 1 + (((day >> 2) % 4) + 4) % 4;
    newBuild(puzzleFor(ci, Math.min(5, li), day * 7919 + 13), { kind: 'daily', ref: `day:${day}`, level: 0, day });
    persistSession();
  }
  function resumeSaved() {
    const v = saveRaw;
    if (!v) return;
    newBuild(v.puz, { kind: v.kind, ref: v.ref, level: v.level, t: v.t, fails: v.fails, hints: v.hints, player: v.player.slice(), day: v.kind === 'daily' ? Number(String(v.ref).split(':')[1]) : undefined });
    say('Welcome back.', 1.6);
  }
  function startAuto() {
    const ci = 1 + rng.int(2), li = rng.int(3);
    newBuild(puzzleFor(ci, li), { kind: 'auto', auto: { on: true } });
    say('Watch the game build this ladder and explain each rung.', 2.2);
  }
  function toggleSlot(r, g) {
    const B = S.B, P = B.P, n = P.n, i = idx(n, r, g);
    if (B.done || S.run) return false;
    if (P.fixed[i]) { S.fx.shake[i] = 0; say('That rung is fixed. It cannot be moved.', 1.8); return false; }
    S.hint = null; S.hl = null;
    if (B.player.includes(i)) {
      B.player.splice(B.player.indexOf(i), 1); B.undo.push({ rm: i }); B.redo = [];
      sfx.lift(); persistSession(); B.bad = []; return true;
    }
    const cells = cellsOf(B);
    if (!canPlace(n, cells, r, g)) { S.fx.shake[i] = 0; sfx.err(); say('Rungs in the same row may not touch.', 1.8); return false; }
    if (B.player.length >= P.budget) { sfx.err(); say(`You only have ${P.budget} rungs. Take one back first.`, 2); return false; }
    B.player.push(i); B.undo.push({ add: i }); B.redo = []; S.fx.pop[i] = 0; B.bad = [];
    sfx.place(r); persistSession();
    return true;
  }
  function doUndo() {
    const B = S.B, a = B.undo.pop();
    if (!a) { say('Nothing to undo.', 1.4); return; }
    if (a.add !== undefined) B.player.splice(B.player.indexOf(a.add), 1); else B.player.push(a.rm);
    B.redo.push(a); S.hint = null; S.hl = null; B.bad = []; sfx.lift(); persistSession();
  }
  function doRedo() {
    const B = S.B, a = B.redo.pop();
    if (!a) { say('Nothing to redo.', 1.4); return; }
    if (a.add !== undefined) B.player.push(a.add); else B.player.splice(B.player.indexOf(a.rm), 1);
    B.undo.push(a); S.hint = null; S.hl = null; B.bad = []; sfx.lift(); persistSession();
  }
  function doClear() {
    const B = S.B;
    if (!B.player.length || S.run) return;
    for (const i of B.player.slice().reverse()) B.undo.push({ rm: i });
    B.player = []; B.redo = []; S.hint = null; S.hl = null; B.bad = []; sfx.lift(); persistSession();
    say('All your rungs are back. Undo brings them back.', 2.2);
  }
  function release() {
    const B = S.B, P = B.P;
    if (S.run || B.done) return;
    S.hint = null; S.hl = null;
    const cells = cellsOf(B), rt = routes(P.n, P.rows, cells);
    B.bad = []; B.runCells = cells;
    startRun(rt, rt.map((_, i) => i), P.n, P.rows, () => {
      const fin = rt.map((r) => r[P.rows]);
      B.bad = fin.map((f, i) => f !== P.target[i]);
      const home = B.bad.filter((b) => !b).length;
      B.homeFlag = home;
      const g = geoOf(L());
      fin.forEach((f, i) => { if (!B.bad[i]) spark(g.xs[f], g.bowlY, 10, '#ffd45a'); });
      if (home === P.n) win();
      else { B.fails += 1; sfx.err(); say(`${home} of ${P.n} lantern${P.n === 1 ? '' : 's'} found their bowl.`, 2.6); S.run = null; if (S.auto.on) S.auto.phase = 'gap'; persistSession(); }
    });
  }

  // ---- hints (also drive Watch and Learn) -------------------------------------------------------------------------------------------------------
  function makeHint() {
    const h = findHint(S.B.P, S.B.player);
    return h ? { stage: h.kind === 'remove' ? 'mistake' : 'look', h, text: h.look } : null;
  }
  function askHint() {
    if (S.run) return;
    const h = makeHint();
    if (!h) { say('The ladder is complete. Press Release.'); return; }
    S.B.hints += 1; S.hint = h; S.hl = { r: h.h.r, g: h.h.g, kind: h.h.kind }; sfx.hint();
  }
  function applyHintStep() {
    const B = S.B, h = S.hint.h;
    S.hint = null; S.hl = null;
    if (h.kind === 'remove') { const i = h.cell; if (B.player.includes(i)) { B.player.splice(B.player.indexOf(i), 1); B.undo.push({ rm: i }); B.redo = []; } sfx.lift(); persistSession(); return; }
    toggleSlot(h.r, h.g);
  }
  function hintGo() {
    const h = S.hint;
    if (!h) return;
    if (h.stage === 'look') { h.stage = 'explain'; h.text = h.h.why; sfx.tap(); return; }
    applyHintStep();
  }

  // ---- winning -------------------------------------------------------------------------------------------------------------------------------
  function win() {
    const B = S.B, P = B.P;
    B.done = true; S.hint = null; S.hl = null; S.winT = 3.2; S.winDelay = 2.2; S.run = null;
    B.bad = P.target.map(() => false);
    const g = geoOf(L()); spark(g.area.x + g.area.w / 2, g.yBot, 60, '#ffd45a'); sfx.win();
    if (S.auto.on) { S.auto.done = true; S.auto.phase = null; say('Solved. That is every rung.', 4); return; }
    const stars = B.hints === 0 && B.fails <= 1 ? 3 : B.hints <= 1 && B.fails <= 4 ? 2 : 1;
    S.stats.solved += 1;
    if (B.kind === 'journey') { const old = S.progress[B.ref]; S.progress[B.ref] = { stars: Math.max(old?.stars ?? 0, stars) }; saveProgress(); }
    let streak = S.streak;
    if (B.kind === 'daily' && B.day === S.daily.day && !S.stats.days.includes(B.day)) { S.stats.days.push(B.day); S.stats.days = S.stats.days.slice(-200); refreshDaily(); streak = S.streak; S.stats.bestStreak = Math.max(S.stats.bestStreak, streak); }
    saveStats(); clearSave();
    monetization.track('ladder_solved', { kind: B.kind, level: B.level, rungs: B.player.length, fails: B.fails });
    let next = null;
    if (B.kind === 'journey') { const [ci, i] = B.ref.split(':').map(Number); next = nextLevel(ci, i); }
    S.result = { type: 'build', stars, time: B.t, fails: B.fails, hints: B.hints, used: B.player.length, min: P.min, budget: P.budget, daily: B.kind === 'daily', streak, kind: B.kind, ref: B.ref, next, n: P.n, rows: P.rows, fact: S.stats.solved % 6 };
  }

  // ---- Watch and Learn -------------------------------------------------------------------------------------------------------------------------
  const wordCount = (t) => t.split(' ').length;
  function autoTick(dt) {
    const a = S.auto, B = S.B;
    if (a.paused || a.done || S.paused) return;
    if (S.run) return;   // a release is running
    if (a.phase === 'gap') { a.timer -= dt; if (a.timer <= 0) a.phase = null; return; }
    if (a.phase === 'think') {
      a.timer -= dt;
      if (a.timer > 0) return;
      S.hint.stage = 'explain'; S.hint.text = S.hint.h.why; a.phase = 'reveal';
      a.timer = clamp(2 + wordCount(S.hint.text) * 0.14, 2, 8);
      return;
    }
    if (a.phase === 'reveal') {
      a.timer -= dt;
      if (a.timer > 0) return;
      applyHintStep(); B.hints = 0; a.phase = 'gap'; a.timer = 0.4;
      return;
    }
    const h = makeHint();
    if (!h) { a.phase = 'release'; release(); return; }
    S.hint = h; S.hl = { r: h.h.r, g: h.h.g, kind: h.h.kind }; a.n += 1; a.phase = 'think'; a.timer = THINK_STEPS[S.prefs.thinkIdx];
  }

  // ---- Follow the Line --------------------------------------------------------------------------------------------------------------------------
  function startFollow(tier) {
    if (demoBlocked()) return;
    const seed = rng.int(1 << 30);
    S.F = { tier, seed, round: 0, score: 0, correct: 0, streak: 0, results: [], phase: 'ask', left: 0, ans: -1, cur: null, ok: false, gain: 0, after: 0 };
    S.hint = null; S.hl = null; S.paused = false; S.run = null; S.sparks = []; S.result = null; S.auto = { on: false, phase: null, timer: 0, paused: false, n: 0, done: false };
    nextRound();
    go('follow');
  }
  function nextRound() {
    const F = S.F;
    F.cur = makeRound(F.tier, F.round, seeded(F.seed * 7 + F.round));
    F.left = F.cur.limit; F.phase = 'ask'; F.ans = -1; F.ok = false; F.gain = 0; S.run = null;
  }
  function answer(b) {
    const F = S.F;
    if (F.phase !== 'ask') return;
    F.ans = b; F.phase = 'run';
    const c = F.cur, rt = route(c.n, c.rows, c.cells, c.start), all = Array.from({ length: c.n }, (_, i) => [i]);
    all[c.start] = rt;
    const ok = b === c.end;
    F.ok = ok;
    startRun(all, [c.start], c.n, c.rows, () => {
      F.phase = 'result'; F.after = 1.4;
      if (ok) {
        const bonus = Math.round(100 * clamp(F.left / c.limit, 0, 1)), streakBonus = Math.min(50, F.streak * 10);
        F.streak += 1; F.correct += 1; F.gain = 100 + bonus + streakBonus; F.score += F.gain;
        const g = geoOf(L()); spark(g.xs[c.end], g.bowlY, 24, '#ffd45a'); sfx.home(F.correct);
      } else { F.streak = 0; F.gain = 0; sfx.err(); }
      F.results.push(ok);
      S.run = null;
    });
  }
  function followTimeout() {
    const F = S.F, c = F.cur;
    F.ans = -2; F.ok = false; F.streak = 0; F.gain = 0; F.phase = 'run'; sfx.err();
    const all = Array.from({ length: c.n }, (_, i) => [i]);
    all[c.start] = route(c.n, c.rows, c.cells, c.start);
    startRun(all, [c.start], c.n, c.rows, () => { F.phase = 'result'; F.after = 1.2; F.results.push(false); S.run = null; });
  }
  function followEnd() {
    const F = S.F, key = TIERS[F.tier].id;
    const best = S.stats.best[key] ?? 0, newBest = F.score > best;
    if (newBest) S.stats.best[key] = F.score;
    S.stats.runs += 1; saveStats();
    const stars = F.correct >= 7 ? 3 : F.correct >= 5 ? 2 : F.correct >= 3 ? 1 : 0;
    monetization.track('follow_run', { tier: key, score: F.score, correct: F.correct });
    S.result = { type: 'follow', tier: F.tier, score: F.score, correct: F.correct, results: F.results.slice(), best: Math.max(best, F.score), newBest, stars, fact: S.stats.runs % 6 };
    go('over');
  }

  // ---- Draw Lots -----------------------------------------------------------------------------------------------------------------------------------
  function startLots() {
    if (demoBlocked()) return;
    const cfg = S.lotsCfg, lad = makeLots(cfg.players, cfg.set, seeded(rng.int(1 << 30)));
    S.LT = { lad, phase: 'add', turn: 0, adds: [], claims: new Array(lad.n).fill(-1), revealed: [], opened: new Array(lad.n).fill(-1), players: lad.n };
    S.paused = false; S.hint = null; S.run = null; S.sparks = []; S.auto = { on: false, phase: null, timer: 0, paused: false, n: 0, done: false };
    go('lots');
  }
  function lotsAdvanceAdd() {
    const LT = S.LT;
    LT.turn += 1;
    if (LT.turn >= LT.players) { LT.phase = 'pick'; LT.turn = 0; say('Now each player chooses a line at the top.', 2.4); }
  }
  function lotsPlace(r, g) {
    const LT = S.LT, lad = LT.lad, i = idx(lad.n, r, g);
    if (!canPlace(lad.n, lad.cells, r, g)) { S.fx.shake[i] = 0; sfx.err(); say('Rungs in the same row may not touch.', 1.8); return; }
    lad.cells[i] = 2; LT.adds.push(i); S.fx.pop[i] = 0; sfx.place(r);
    lotsAdvanceAdd();
  }
  function lotsPick(line) {
    const LT = S.LT;
    if (LT.claims[line] >= 0) { sfx.err(); say('That line is taken. Choose another.', 1.8); return; }
    LT.claims[line] = LT.turn; sfx.tap(); LT.turn += 1;
    if (LT.turn >= LT.players) { LT.phase = 'reveal'; LT.turn = 0; say('Everyone has a line. Reveal one by one.', 2.4); }
  }
  function lotsReveal(all) {
    const LT = S.LT, lad = LT.lad;
    if (S.run) return;
    const pending = [];
    for (let p = 0; p < LT.players; p++) if (!LT.revealed.includes(p)) pending.push(p);
    if (!pending.length) return;
    const who = all ? pending : [pending[0]];
    const lineOf = (p) => LT.claims.indexOf(p);
    const rt = Array.from({ length: lad.n }, (_, i) => route(lad.n, lad.rows, lad.cells, i));
    startRun(rt, who.map(lineOf), lad.n, lad.rows, () => {
      const g = geoOf(L());
      for (const p of who) { const line = lineOf(p), end = rt[line][lad.rows]; LT.opened[end] = p; LT.revealed.push(p); spark(g.xs[end], g.bowlY, 14, '#ffd45a'); }
      sfx.home(LT.revealed.length);
      S.run = null;
      if (LT.revealed.length >= LT.players) { LT.phase = 'done'; S.stats.lots += 1; saveStats(); sfx.win(); monetization.track('lots_done', { players: LT.players, set: lad.set }); }
    });
  }

  // ---- input ------------------------------------------------------------------------------------------------------------------------------------------
  function hitBtn(id, r, tap) { if (r && inRect(r, tap.x, tap.y)) { flash(id); return true; } return false; }
  function pauseOverlayTap(tap, l) {
    const pl = pauseLayout(meta.width, meta.height, l.area);
    if (hitBtn('resume', pl.resume, tap)) S.paused = false;
    else if (hitBtn('restart', pl.restart, tap)) {
      S.paused = false;
      if (S.scene === 'play') newBuild(S.B.P, { kind: S.B.kind, ref: S.B.ref, level: S.B.level, day: S.B.day });
      else if (S.scene === 'follow') { const t = S.F.tier; demoUncount(); startFollow(t); }
      else if (S.scene === 'lots') { demoUncount(); startLots(); }
    } else if (hitBtn('psettings', pl.settings, tap)) { S.back = S.scene; S.scene = 'settings'; S.sceneT = 1; S.scrollY = 0; }
    else if (hitBtn('pmenu', pl.menu, tap)) { if (S.scene === 'play') persistSession(); S.paused = false; go('title'); }
  }

  function updatePlay(dt, input) {
    const B = S.B, l = L(), p = input.pointer, geo = geoOf(l), k = input.keys.pressed;
    if (!S.paused && !B.done && !S.auto.on && S.winT <= 0) { B.t += dt; S.saveAcc += dt; if (S.saveAcc > 6) { S.saveAcc = 0; persistSession(); } }
    if (S.auto.on && !S.auto.paused && !S.paused) autoTick(dt);
    if (S.winDelay > 0 && !S.paused) { S.winDelay -= dt; if (S.winDelay <= 0 && S.result) go('over'); }
    if (!S.auto.on && !S.paused && !B.done && !S.run) {
      const n = B.P.n, rows = B.P.rows, c = S.cursor;
      if (k.has('ArrowLeft') || k.has('ArrowRight') || k.has('ArrowUp') || k.has('ArrowDown')) S.kbd = true;
      if (k.has('ArrowLeft')) c.g = clamp(c.g - 1, 0, n - 2);
      if (k.has('ArrowRight')) c.g = clamp(c.g + 1, 0, n - 2);
      if (k.has('ArrowUp')) c.r = clamp(c.r - 1, 0, rows - 1);
      if (k.has('ArrowDown')) c.r = clamp(c.r + 1, 0, rows - 1);
      if (k.has('Space') || k.has('Enter')) toggleSlot(c.r, c.g);
      if (k.has('KeyR')) release();
      if (k.has('KeyU')) doUndo();
      if (k.has('KeyY')) doRedo();
      if (k.has('KeyH')) { if (S.hint) hintGo(); else askHint(); }
    }
    if (k.has('KeyP') || k.has('Escape')) { if (S.auto.on) S.auto.paused = !S.auto.paused; else if (!B.done) { S.paused = !S.paused; if (S.paused) persistSession(); } }
    if (!p.pressed) return;
    const tap = { x: p.x, y: p.y };
    S.kbd = false;
    if (S.paused) { pauseOverlayTap(tap, l); return; }
    if (S.auto.on) {
      if (hitBtn('aexit', l.rail.exit, tap)) { S.auto.on = false; S.hint = null; S.hl = null; S.run = null; S.B = null; go('title'); }
      else if (hitBtn('apause', l.rail.pause, tap)) S.auto.paused = !S.auto.paused;
      else if (hitBtn('adec', l.rail.dec, tap)) { if (S.prefs.thinkIdx > 0) { S.prefs.thinkIdx -= 1; savePrefs(); } }
      else if (hitBtn('ainc', l.rail.inc, tap)) { if (S.prefs.thinkIdx < THINK_STEPS.length - 1) { S.prefs.thinkIdx += 1; savePrefs(); } }
      return;
    }
    if (B.done) return;
    if (hitBtn('pause', l.pause, tap)) { S.paused = true; persistSession(); return; }
    if (S.hint) {
      if (hitBtn('close', l.coachBtns.close, tap)) { S.hint = null; S.hl = null; }
      else if (hitBtn('go', l.coachBtns.go, tap)) hintGo();
      return;
    }
    if (S.run) return;
    const tk = geo.tokenAt(tap.x, tap.y);
    if (tk >= 0) { const i = B.trace.indexOf(tk); if (i >= 0) B.trace.splice(i, 1); else B.trace.push(tk); sfx.tap(); return; }
    const sl = geo.slotAt(tap.x, tap.y);
    if (sl) { S.cursor = { r: sl.r, g: sl.g }; toggleSlot(sl.r, sl.g); return; }
    const T = l.tools;
    if (!T) return;
    if (hitBtn('release', T.release, tap)) release();
    else if (hitBtn('undo', T.undo, tap)) doUndo();
    else if (hitBtn('hint', T.hint, tap)) askHint();
    else if (hitBtn('clear', T.clear, tap)) doClear();
  }

  function updateFollow(dt, input) {
    const F = S.F, l = L(), p = input.pointer, geo = geoOf(l), k = input.keys.pressed;
    if (k.has('KeyP') || k.has('Escape')) S.paused = !S.paused;
    if (!S.paused) {
      if (F.phase === 'ask') { F.left -= dt; if (F.left <= 0) { F.left = 0; followTimeout(); } }
      else if (F.phase === 'result') { F.after -= dt; if (F.after <= 0) { F.round += 1; if (F.round >= ROUNDS) followEnd(); else nextRound(); } }
    }
    if (S.paused) { if (p.pressed) pauseOverlayTap({ x: p.x, y: p.y }, l); return; }
    if (S.scene !== 'follow') return;
    for (const code of k) { const m = /^(?:Digit|Numpad)([1-9])$/.exec(code); if (m && F.phase === 'ask' && Number(m[1]) <= F.cur.n) answer(Number(m[1]) - 1); }
    if (!p.pressed) return;
    const tap = { x: p.x, y: p.y };
    if (hitBtn('pause', l.pause, tap)) { S.paused = true; return; }
    if (F.phase !== 'ask') return;
    const b = geo.bowlAt(tap.x, tap.y);
    if (b >= 0) answer(b);
  }

  function updateLots(dt, input) {
    const LT = S.LT, l = L(), p = input.pointer, geo = geoOf(l), k = input.keys.pressed;
    if (k.has('KeyP') || k.has('Escape')) S.paused = !S.paused;
    if (S.paused) { if (p.pressed) pauseOverlayTap({ x: p.x, y: p.y }, l); return; }
    if (!p.pressed) return;
    const tap = { x: p.x, y: p.y }, T = l.tools;
    if (hitBtn('pause', l.pause, tap)) { S.paused = true; return; }
    if (S.run) return;
    if (LT.phase === 'add') {
      const sl = geo.slotAt(tap.x, tap.y);
      if (sl) { lotsPlace(sl.r, sl.g); return; }
      if (T?.skip && hitBtn('skip', T.skip, tap)) { sfx.tap(); lotsAdvanceAdd(); }
      else if (T?.undo && hitBtn('undo', T.undo, tap)) {
        const i = LT.adds.pop();
        if (i !== undefined) { LT.lad.cells[i] = 0; LT.turn = Math.max(0, LT.turn - 1); sfx.lift(); } else say('Nothing to undo.', 1.4);
      }
    } else if (LT.phase === 'pick') {
      const tk = geo.tokenAt(tap.x, tap.y);
      if (tk >= 0) lotsPick(tk);
      else { const g = geo.xs.findIndex((x) => Math.abs(x - tap.x) < geo.sp * 0.4 && tap.y >= geo.yTop - geo.tr * 3 && tap.y <= geo.yTop + geo.rowGap * 2); if (g >= 0) lotsPick(g); }
    } else if (LT.phase === 'reveal') {
      if (hitBtn('next', T?.next, tap)) lotsReveal(false);
      else if (hitBtn('all', T?.all, tap)) lotsReveal(true);
    } else if (LT.phase === 'done') {
      if (hitBtn('again', T?.again, tap)) { demoUncount(); startLots(); }
      else if (hitBtn('lotsmenu', T?.lotsmenu, tap)) go('title');
    }
  }

  function changeSetting(i, k) {
    const id = settingsRows(S)[i].id, p = S.prefs;
    switch (id) {
      case 'look': p.look = LOOK_IDS[k]; setLook(p.look); break;
      case 'numerals': p.numerals = ['digits', 'kanji'][k]; break;
      case 'guide': p.guide = k === 1; break;
      case 'sound': p.sound = k === 0; audio.setMuted?.(!p.sound); break;
      case 'calm': p.calm = k === 1; break;
      case 'restore': {
        if (S.owned || S.restoreBusy) return;
        S.restoreBusy = true; say('Checking with the store...', 8);
        Promise.resolve(monetization.restore()).then(() => {
          S.owned = !!monetization.owns('unlock_game');
          say(S.owned ? 'Purchase restored. Full game unlocked.' : 'No earlier purchase found.', 3);
        }).catch(() => say('Could not reach the store. Try again later.', 3)).finally(() => { S.restoreBusy = false; });
        return;
      }
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
    if (S.scene === 'play') return updatePlay(dt, input);
    if (S.scene === 'follow') return updateFollow(dt, input);
    if (S.scene === 'lots') return updateLots(dt, input);
    const p = input.pointer, scrolling = ['journey', 'tiers', 'lotsetup', 'doc', 'settings', 'stats', 'over'].includes(S.scene);
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
        else if (id === 'follow') go('tiers');
        else if (id === 'lots') go('lotsetup');
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
    if (sc === 'journey' || sc === 'tiers' || sc === 'lotsetup') {
      const LL = listLayout(w, h);
      if (esc) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', LL.back, tap)) { go('title'); return; }
      if (hitBtn('tdec', LL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', LL.textInc, tap)) return textScale(1);
      if (!inRect(LL.body, tap.x, tap.y)) return;
      const ty = tap.y + S.scrollY, scl = TEXT_SCALES[S.prefs.textIdx];
      if (sc === 'journey') {
        const J = journeyRects(LL.body, CHAPTERS.map((c) => c.count), scl);
        J.items.forEach((it) => it.lv.forEach((r, i) => { if (inRect(r, tap.x, ty)) { sfx.tap(); startLevel(it.ci, i); } }));
      } else if (sc === 'tiers') {
        const Tr = tierRects(LL.body, TIERS.length, scl);
        Tr.cards.forEach((r, i) => { if (inRect(r, tap.x, ty)) { sfx.tap(); startFollow(i); } });
      } else {
        const LR = lotsRects(LL.body, LOT_SETS.length, scl);
        if (inRect(LR.minus, tap.x, ty)) { S.lotsCfg.players = Math.max(2, S.lotsCfg.players - 1); sfx.tap(); }
        else if (inRect(LR.plus, tap.x, ty)) { S.lotsCfg.players = Math.min(MAX_LINES, S.lotsCfg.players + 1); sfx.tap(); }
        LR.cards.forEach((r, i) => { if (inRect(r, tap.x, ty)) { S.lotsCfg.set = LOT_SETS[i].id; sfx.tap(); } });
        if (inRect(LR.start, tap.x, ty)) { sfx.tap(); startLots(); }
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
      const rows = settingsRows(S), SL = settingsLayout(w, h, TEXT_SCALES[S.prefs.textIdx], rows.length);
      const leave = () => { if ((S.back === 'play' && S.B) || (S.back === 'follow' && S.F) || (S.back === 'lots' && S.LT)) { S.scene = S.back; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
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
      const R0 = S.result, O = overLayout(w, h);
      if (!tap || !R0) return;
      if (hitBtn('next', O.btns.next, tap)) {
        if (R0.type === 'follow') { demoUncount(); startFollow(R0.tier); }
        else if (R0.kind === 'journey' && R0.next) startLevel(R0.next[0], R0.next[1]);
        else if (R0.kind === 'journey') go('journey');
        else go('title');
      } else if (hitBtn('menu', O.btns.menu, tap)) { if (R0.type === 'follow') go('tiers'); else if (R0.kind === 'journey') go('journey'); else go('title'); }
      else if (hitBtn('share', O.btns.share, tap)) {
        if (R0.type === 'follow') env.share(`Amidakuji, Follow the Line (${TIERS[R0.tier].name}): ${R0.score} points, ${R0.correct} of ${ROUNDS} paths right.`);
        else env.share(`Amidakuji ${R0.daily ? 'daily ladder' : 'ladder'} solved with ${R0.used} rung${R0.used === 1 ? '' : 's'} and ${R0.stars} star${R0.stars === 1 ? '' : 's'}${R0.daily ? '. Streak ' + R0.streak : ''}.`);
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
        const adv = (o, lim) => { for (const k of Object.keys(o)) { o[k] += dt; if (o[k] > lim) delete o[k]; } };
        adv(S.fx.pop, 0.4); adv(S.fx.shake, 0.5);
        for (const sp of S.sparks) { sp.t += dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 600 * dt; }
        S.sparks = S.sparks.filter((sp) => sp.t < sp.life);
        if (S.winT > 0) S.winT -= dt;
        for (const q of S.sfx) q.t -= dt;
        const due = S.sfx.filter((q) => q.t <= 0); if (due.length) { S.sfx = S.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
        runTick(dt);
      }
      // the kit's preview pill sits top centre; in landscape it moves into the info panel so it never covers the ladder
      if (['play', 'follow', 'lots'].includes(S.scene)) { const l = L(); meta.previewBadge = l.badge; } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { render(ctx, S, view ?? meta); },
    getState: () => S,
    // Counts real play only: a live ladder, a timed round or a lots session. Menus, Rules, settings, Watch and Learn, pause, results are free.
    isPreviewExempt() {
      if (S.paused || S.auto.on) return true;
      if (S.scene === 'play') return !(S.B && !S.B.done);
      if (S.scene === 'follow') return !(S.F && S.F.phase === 'ask');
      if (S.scene === 'lots') return !(S.LT && S.LT.phase !== 'done');
      return true;
    },
    // Tester/screenshot hooks (only wired up in dev: see main.js).
    dev: {
      go: (scene, extra) => { Object.assign(S, extra ?? {}); go(scene); },
      level: (ci, i) => { S.dev = true; startLevel(ci, i); }, daily: () => startDaily(), auto: () => startAuto(), follow: (t) => startFollow(t),
      lots: (n, set) => { S.lotsCfg = { players: n ?? 4, set: set ?? 'order' }; startLots(); },
      hint: () => askHint(), hintGo: () => hintGo(), doc: (kind, page = 0) => { S.doc = { kind, page }; go('doc'); },
      progress: (k) => { const B = S.B; let c = 0, h = findHint(B.P, B.player); while (h && h.kind === 'add' && c < k) { toggleSlot(h.r, h.g); c += 1; h = findHint(B.P, B.player); } },
      solveNow: () => { const B = S.B; let h; while ((h = findHint(B.P, B.player)) && h.kind === 'add') toggleSlot(h.r, h.g); win(); },
      skipOver: () => { S.winDelay = 0.01; },
      release: () => release(),
      layout: () => { const l = L(), g = geoOf(l); return { mode: l.mode, area: l.area, tools: l.tools, xs: g.xs, ys: g.ys, tokenY: g.tokenY, bowlY: g.bowlY, pause: l.pause, w: meta.width, h: meta.height }; },
      setPrefs: (o) => { Object.assign(S.prefs, o); applyPrefs(); },
      unlockAll: () => { S.dev = true; },
      lotsAll: () => { const LT = S.LT; while (LT.phase === 'add') lotsAdvanceAdd(); let c = 0; while (LT.phase === 'pick' && c < 20) { lotsPick(LT.claims.indexOf(-1)); c++; } },
    },
  };
}
