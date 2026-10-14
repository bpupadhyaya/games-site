// Hashi Bridges: state and flow. Engine = hashi.js, session = play.js, drawing = view.js + art.js, geometry = layout.js.
import { playLayout, titleLayout, docLayout, settingsLayout, newLayout, statsLayout, overLayout, pauseLayout, inRect, host, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { LIBRARY } from './library.js';
import { build, transform, nextStep, explain, edgeBetween, TECH_NAME, other } from './hashi.js';
import { newSession, cycle, setLane, clearIsland, undo, redo, applyHint, solved, wrongEdges, starsFor, fmtTime, PAR_SECONDS, puzzleOf } from './play.js';
import { render, metrics, settingsRows, NEW_CARDS } from './view.js';
import { islandAt, laneAt } from './art.js';
import { pt, cellPx, DECK_Y, boardRect } from './v3.js';
import { DOCS, GRADE_INFO } from './content.js';
import { setLook, LOOK_IDS } from './ui.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen; everything lays out from the live size.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_PUZZLES = 3;
const DAILY_LEVEL = [5, 1, 2, 2, 3, 3, 4];   // by weekday, 0 = Sunday
const AUTO_GAP = 0.3;
const DEFAULT_PREFS = { look: 'lagoon', hand: 'right', check: 'conflicts', numbers: 'target', timer: true, sound: true, calm: false, textIdx: 0, thinkIdx: 1, grade: 2 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const emptyFx = (P) => ({ grow: new Array(P ? P.E : 0).fill(99), pop: new Array(P ? P.n : 0).fill(99), wave: new Array(P ? P.n : 0).fill(99), shake: new Array(P ? P.n : 0).fill(99), blink: null });

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS },
    P: null, sel: -1, hint: null, paused: false,
    auto: { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, step: null },
    fx: emptyFx(null), sparks: [], winT: 0, winDelay: 0, sfx: [],
    msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0 }, back: 'title', result: null,
    stats: { solved: [0, 0, 0, 0, 0, 0], best: [0, 0, 0, 0, 0, 0], days: [], bestStreak: 0 }, saved: null,
    daily: { day: config.day ?? 0 }, streak: 0, dailyDone: false, dailyLevel: 1, dailyInfo: '', demoCount: 0, saveAcc: 0,
    dev: config.dev === true, demo: config.demo === true, owned: !!monetization.owns?.('unlock_game'), restore: { busy: false, msg: '' },
  };
  monetization.onChange?.(() => { S.owned = !!monetization.owns('unlock_game'); });
  let saveRaw = null, drag = null;

  // ---- persistence ---------------------------------------------------------------------------------------------------------
  // The kit's unlock overlay follows the text zoom, but its Unlock button overflows above ~1.25x on narrow phones: cap what it sees.
  const gateScale = () => { config.textScale = Math.min(TEXT_SCALES[S.prefs.textIdx] ?? 1, 1.25); };
  const applyPrefs = () => { gateScale(); setLook(S.prefs.look); audio.setMuted?.(!S.prefs.sound); };
  const savePrefs = () => storage.set('prefs', S.prefs);
  const saveStats = () => storage.set('stats', S.stats);
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); if (!LOOK_IDS.includes(S.prefs.look)) S.prefs.look = 'lagoon'; } applyPrefs(); });
  storage.get('stats', null).then((v) => { if (v) { S.stats = { ...S.stats, ...v, solved: v.solved ?? S.stats.solved, best: v.best ?? S.stats.best, days: v.days ?? [] }; } refreshDaily(); });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  storage.get('save', null).then((v) => { if (v && v.s && S.scene === 'title' && !S.P) { saveRaw = v; S.saved = { level: v.level, kind: v.kind, t: v.t }; } });
  applyPrefs();

  function refreshDaily() {
    const day = S.daily.day, set = new Set(S.stats.days);
    let streak = 0, d = set.has(day) ? day : day - 1;
    while (set.has(d)) { streak += 1; d -= 1; }
    S.streak = streak; S.dailyDone = set.has(day); S.dailyLevel = DAILY_LEVEL[(((day + 4) % 7) + 7) % 7];
    S.dailyInfo = S.dailyDone ? `${GRADE_INFO[S.dailyLevel].name}  ·  done today` : `${GRADE_INFO[S.dailyLevel].name}  ·  ${streak ? streak + ' day streak' : 'new every day'}`;
  }
  refreshDaily();
  function persistSession() {
    const P = S.P;
    if (!P || P.done || S.auto.on) return;
    saveRaw = { s: P.str, br: P.br.slice(), cap: P.cap.slice(), level: P.level, kind: P.kind, day: P.day, seed: P.seed, t: P.t, errs: P.errs, hints: P.hints, moves: P.moves };
    S.saved = { level: P.level, kind: P.kind, t: P.t };
    storage.set('save', saveRaw);
  }
  const clearSave = () => { saveRaw = null; S.saved = null; storage.remove('save'); };

  // ---- sound ------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound && !S.auto.on) audio.tone(o); };
  const later = (t, o) => S.sfx.push({ t, o });
  const sfx = {
    plank: (n) => tone({ freq: 330 + n * 70, to: 200, dur: 0.09, type: 'triangle', vol: 0.12 }),
    clear: () => tone({ freq: 260, to: 150, dur: 0.08, type: 'triangle', vol: 0.07 }),
    err: () => tone({ freq: 190, to: 120, dur: 0.16, type: 'triangle', vol: 0.09 }),
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.06 }),
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.08 }),
    island: () => { [523, 659, 784].forEach((f, i) => later(i * 0.08, { freq: f, to: f * 1.01, dur: 0.16, type: 'triangle', vol: 0.07 })); },
    win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => later(i * 0.12, { freq: f, to: f, dur: 0.4, type: 'triangle', vol: 0.09 })); },
  };

  // ---- small helpers -------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.6) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; drag = null; wheelInput.dy = 0; S.msg = null; }
  const pz = () => (S.P ? puzzleOf(S.P) : null);
  const L = () => { const P = pz(); return playLayout(meta.width, meta.height, { coach: !!(S.hint || S.auto.on), hand: S.prefs.hand, pw: P ? P.w : 9, ph: P ? P.h : 9 }); };
  function spark(cx, cy, n, color) {
    for (let i = 0; i < n; i++) { const a = rng.next() * Math.PI * 2, v = 80 + rng.next() * 260; S.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0, life: 0.7 + rng.next() * 0.6, r: 3 + rng.next() * 4, c: color }); }
    if (S.sparks.length > 160) S.sparks.splice(0, S.sparks.length - 160);
  }
  const islandCenter = (i) => { const P = pz(), g = L().board; return pt(g, P.isl[i].x, P.isl[i].y, DECK_Y); };

  // ---- puzzles ---------------------------------------------------------------------------------------------------------------------
  function takePuzzle(level) {
    const lib = LIBRARY[level];
    return transform(lib[rng.int(lib.length)], rng.int(8));
  }
  function dailyPuzzle(day) {
    const level = DAILY_LEVEL[(((day + 4) % 7) + 7) % 7], lib = LIBRARY[level];
    const idx = Math.floor((day * 2654435761 >>> 0) / 4294967296 * lib.length);
    return { level, str: transform(lib[idx], ((day * 40503 + 17) >>> 0) % 8) };
  }
  function begin(P, extra = {}) {
    S.P = P; S.sel = -1; S.hint = null; S.paused = false; S.msg = null;
    S.auto = { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, step: null, ...extra };
    S.fx = emptyFx(puzzleOf(P)); S.sparks = []; S.winT = 0; S.winDelay = 0;
    S.result = null; S.saveAcc = 0; go('play');
  }
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_PUZZLES) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }
  function startPuzzle(level) {
    if (demoBlocked()) return;
    S.prefs.grade = level; savePrefs();
    begin(newSession({ str: takePuzzle(level), level, kind: 'free', seed: rng.int(1 << 30) }));
    persistSession();
  }
  function startDaily() {
    if (demoBlocked()) return;
    const d = dailyPuzzle(S.daily.day);
    begin(newSession({ str: d.str, level: d.level, kind: 'daily', day: S.daily.day }));
    persistSession();
  }
  function resumeSaved() {
    const v = saveRaw;
    if (!v) return;
    const P = newSession({ str: v.s, level: v.level, kind: v.kind, day: v.day ?? 0, seed: v.seed ?? 0 });
    P.br = v.br.slice(); P.cap = (v.cap ?? P.cap).slice(); P.t = v.t; P.errs = v.errs; P.hints = v.hints; P.moves = v.moves ?? 0;
    begin(P);
    say('Welcome back.', 1.6);
  }
  function startAuto() {
    const level = clamp(S.prefs.grade, 1, 5);
    begin(newSession({ str: takePuzzle(level), level, kind: 'auto' }), { on: true });
    say('Watch the game solve this puzzle and explain each step.', 2.2);
  }

  // ---- hints (also drive Watch and Learn) -------------------------------------------------------------------------------------------------
  function makeHint() {
    const P = S.P, Pz = puzzleOf(P), bad = wrongEdges(P);
    if (bad.length) {
      const e = bad[0];
      return { stage: 'mistake', edge: e, ex: null, step: null, text: `The bridge${P.br[e] > 1 ? 's' : ''} between the ${Pz.isl[Pz.ea[e]].n} at row ${Pz.isl[Pz.ea[e]].y + 1}, column ${Pz.isl[Pz.ea[e]].x + 1} and the ${Pz.isl[Pz.eb[e]].n} at row ${Pz.isl[Pz.eb[e]].y + 1}, column ${Pz.isl[Pz.eb[e]].x + 1} breaks the solution. Tap Fix it to take one away.` };
    }
    const step = nextStep(Pz, P);
    if (!step) return null;
    const ex = explain(Pz, P, step);
    return { stage: 'look', step, ex, text: ex.look, edge: step.edge ?? step.place?.[0]?.e ?? step.cap?.e ?? -1, focus: ex.show.focus };
  }
  function askHint() {
    const h = makeHint();
    if (!h) { say(solved(S.P) ? 'Already solved.' : 'No further logical step found.'); return; }
    S.P.hints += 1; S.hint = h; sfx.hint();
    if (h.focus?.length) S.sel = h.focus[0];
  }
  function bridgeEffects(r, edges) {
    if (!r || !r.ok) return;
    const P = pz();
    for (const e of edges) S.fx.grow[e] = 0;
    for (const i of new Set(r.filled ?? [])) { S.fx.pop[i] = 0; const p = islandCenter(i); spark(p.x, p.y, 10, '#ffe28a'); }
    if (r.filled?.length) sfx.island();
  }
  function checkFinished() {
    const P = S.P;
    if (P.done) return;
    if (solved(P)) win();
  }
  function hintGo() {
    const h = S.hint, P = S.P;
    if (!h) return;
    if (h.stage === 'look') { h.stage = 'explain'; h.text = h.ex.why; sfx.tap(); return; }
    if (h.stage === 'mistake') {
      const r = setLane(P, h.edge, Math.max(0, P.br[h.edge] - 1)); S.hint = null; sfx.clear();
      bridgeEffects(r, [h.edge]); persistSession(); return;
    }
    const step = h.step, edges = step.place ? step.place.map((p) => p.e) : [];
    const r = applyHint(P, step);
    S.hint = null; bridgeEffects(r, edges);
    if (edges.length) sfx.plank(P.br[edges[0]]);
    persistSession(); checkFinished();
  }

  // ---- building bridges --------------------------------------------------------------------------------------------------------------------
  function cycleLane(e) {
    const P = S.P;
    S.hint = null;
    const r = cycle(P, e);
    if (!r.ok) {
      if (r.why === 'blocked') { S.fx.blink = { e: r.by, t: 0 }; sfx.err(); say('A bridge is in the way.', 1.6); }
      return;
    }
    if (r.kind === 'clear') sfx.clear(); else sfx.plank(r.to);
    bridgeEffects(r, [e]);
    if (r.bad && S.prefs.check !== 'off') { sfx.err(); }
    persistSession(); checkFinished();
  }
  function tapIsland(i) {
    const Pz = pz();
    if (S.sel < 0 || S.sel === i) { S.sel = S.sel === i ? -1 : i; sfx.tap(); return; }
    const e = edgeBetween(Pz, S.sel, i);
    if (e >= 0) cycleLane(e);
    else { S.sel = i; sfx.tap(); }
  }
  function doClear() {
    const P = S.P;
    if (S.sel < 0) { say('Select an island first.'); return; }
    S.hint = null;
    const r = clearIsland(P, S.sel);
    if (r.ok) { sfx.clear(); persistSession(); } else say('That island has no bridges.', 1.6);
  }
  function doUndo() { if (undo(S.P)) { S.hint = null; sfx.clear(); persistSession(); } else say('Nothing to undo.', 1.4); }
  function doRedo() { if (redo(S.P)) { S.hint = null; sfx.clear(); persistSession(); } else say('Nothing to redo.', 1.4); }
  // keyboard: arrows move between islands, Shift+arrow builds a bridge that way
  function neighbour(dx, dy) {
    const Pz = pz();
    if (S.sel < 0) return 0;
    let best = -1, bd = 1e9;
    const a = Pz.isl[S.sel];
    for (let i = 0; i < Pz.n; i++) {
      if (i === S.sel) continue;
      const vx = Pz.isl[i].x - a.x, vy = Pz.isl[i].y - a.y, along = vx * dx + vy * dy, across = Math.abs(vx * dy - vy * dx);
      if (along <= 0 || across > along) continue;
      const d = along + across * 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function keyMove(dx, dy, build) {
    const n = neighbour(dx, dy);
    if (S.sel < 0) { S.sel = 0; return; }
    if (n < 0) return;
    if (build) { const e = edgeBetween(pz(), S.sel, n); if (e >= 0) cycleLane(e); } else { S.sel = n; sfx.tap(); }
  }

  // ---- winning --------------------------------------------------------------------------------------------------------------------------------
  function win() {
    const P = S.P, Pz = puzzleOf(P);
    P.done = true; S.hint = null; S.winT = 3.2; S.winDelay = 1.7;
    const cx = Pz.w / 2, cy = Pz.h / 2;
    for (let i = 0; i < Pz.n; i++) S.fx.wave[i] = -(Math.abs(Pz.isl[i].x - cx) + Math.abs(Pz.isl[i].y - cy)) * 0.07;
    const b = L().board; spark(b.x + b.size / 2, b.y + b.size / 2, 60, '#ffe28a'); sfx.win();
    if (S.auto.on) { S.auto.done = true; S.auto.phase = null; say('Solved. That is every step.', 4); return; }
    const level = P.level, first = !S.stats.best[level] || P.t < S.stats.best[level];
    S.stats.solved[level] += 1;
    if (P.kind !== 'auto' && P.t > 0 && first) S.stats.best[level] = Math.max(1, Math.round(P.t));
    let streak = S.streak;
    if (P.kind === 'daily' && P.day === S.daily.day && !S.stats.days.includes(P.day)) { S.stats.days.push(P.day); S.stats.days = S.stats.days.slice(-200); refreshDaily(); streak = S.streak; S.stats.bestStreak = Math.max(S.stats.bestStreak, streak); }
    saveStats(); clearSave();
    if (P.kind === 'daily' && P.day === S.daily.day) storage.set('daily', { day: P.day, streak });
    monetization.track('puzzle_solved', { level, kind: P.kind, t: Math.round(P.t) });
    const techs = Object.entries(P.counts).map(([id, n]) => ({ id, n, name: TECH_NAME(id) })).sort((a, b2) => b2.n - a.n);
    S.result = { stars: starsFor(P), time: P.t, par: PAR_SECONDS[level], errs: P.errs, hints: P.hints, techs, newBest: first && P.kind !== 'auto', daily: P.kind === 'daily', streak, level };
  }

  // ---- Watch and Learn --------------------------------------------------------------------------------------------------------------------------
  const wordCount = (t) => t.split(' ').length;
  function autoTick(dt) {
    const a = S.auto, P = S.P;
    if (a.paused || a.done) return;
    if (a.phase === 'gap') { a.timer -= dt; if (a.timer <= 0) a.phase = null; return; }
    if (a.phase === 'think') {
      a.timer -= dt;
      if (a.timer > 0) return;
      S.hint.stage = 'explain'; S.hint.text = S.hint.ex.why; a.phase = 'reveal';
      a.timer = a.trivial ? 1.6 + wordCount(S.hint.text) * 0.12 : clamp(2 + wordCount(S.hint.text) * 0.2, 2, 9);
      return;
    }
    if (a.phase === 'reveal') {
      a.timer -= dt;
      if (a.timer > 0) return;
      const h = S.hint, edges = h.step.place ? h.step.place.map((p) => p.e) : [], r = applyHint(P, h.step);
      bridgeEffects(r, edges); P.hints = 0; S.hint = null; a.phase = 'gap'; a.timer = AUTO_GAP;
      if (solved(P)) win();
      return;
    }
    const h = makeHint();
    if (!h || h.stage === 'mistake') { a.done = true; return; }
    S.hint = h; a.n += 1; a.phase = 'think';
    a.trivial = h.step.tech === 'forced';
    const base = THINK_STEPS[S.prefs.thinkIdx];
    a.timer = a.trivial ? Math.max(0.9, base * 0.3) : base;
    if (h.focus?.length) S.sel = h.focus[0];
  }

  // ---- input -------------------------------------------------------------------------------------------------------------------------------------------
  let gesture = null;
  function getTap(p, scrollRect) {
    if (!scrollRect) { gesture = null; return p.pressed ? { x: p.x, y: p.y } : null; }
    if (p.pressed) gesture = { x0: p.x, y0: p.y, s0: S.scrollY, moved: false, inBody: inRect(scrollRect, p.x, p.y) };
    let tap = null;
    if (gesture) {
      if (p.down && gesture.inBody) {
        const dy = p.y - gesture.y0;
        if (Math.abs(dy) > 12) gesture.moved = true;
        if (gesture.moved) S.scrollY = clamp(gesture.s0 - dy, 0, metrics.max);
      }
      if (p.released || !p.down) { if (!gesture.moved) tap = { x: gesture.x0, y: gesture.y0 }; gesture = null; }
    }
    return tap;
  }
  function hitBtn(id, r, tap) { if (inRect(r, tap.x, tap.y)) { flash(id); return true; } return false; }

  function boardPointer(p, l) {
    const Pz = pz(), g = l.board;
    // Touch slop: at least ~20 css px round an island (small cells on a 14x14 sea), never more than 0.85 of a cell.
    const tol = clamp(20 / Math.max(0.2, host.px) / cellPx(g), 0.55, 0.85);
    if (p.pressed) {
      drag = inRect(boardRect(g), p.x, p.y) ? { i0: islandAt(g, Pz, p.x, p.y, tol), x0: p.x, y0: p.y } : null;
    }
    if (p.released && drag) {
      const d = drag; drag = null;
      const moved = Math.hypot(p.x - d.x0, p.y - d.y0) > cellPx(g) * 0.45, i1 = islandAt(g, Pz, p.x, p.y, tol);
      if (d.i0 >= 0 && moved && i1 >= 0 && i1 !== d.i0) {
        const e = edgeBetween(Pz, d.i0, i1);
        S.sel = d.i0;
        if (e >= 0) cycleLane(e); else say('Those islands are not neighbours in line.', 1.8);
      } else if (!moved) {
        if (d.i0 >= 0) tapIsland(d.i0);
        else {
          const e = laneAt(g, Pz, S.P, d.x0, d.y0, cellPx(g) * 0.3);
          if (e >= 0) cycleLane(e); else if (S.sel >= 0) { S.sel = -1; S.hint = null; }
        }
      }
      return true;
    }
    return false;
  }

  function updatePlay(dt, tap, input) {
    const P = S.P, l = L(), p = input.pointer;
    if (!S.paused && !P.done && !S.auto.on && S.winT <= 0) { P.t += dt; S.saveAcc += dt; if (S.saveAcc > 6) { S.saveAcc = 0; persistSession(); } }
    if (S.auto.on && !S.auto.paused && !S.paused) autoTick(dt);
    if (S.winDelay > 0) { S.winDelay -= dt; if (S.winDelay <= 0 && S.result) go('over'); }
    // keyboard
    const k = input.keys.pressed, shift = input.keys.down.has('ShiftLeft') || input.keys.down.has('ShiftRight');
    if (!S.auto.on && !S.paused && !P.done) {
      if (k.has('ArrowLeft')) keyMove(-1, 0, shift); if (k.has('ArrowRight')) keyMove(1, 0, shift); if (k.has('ArrowUp')) keyMove(0, -1, shift); if (k.has('ArrowDown')) keyMove(0, 1, shift);
      if (k.has('Backspace') || k.has('Delete')) doClear();
      if (k.has('KeyU')) doUndo(); if (k.has('KeyY')) doRedo();
      if (k.has('KeyH')) { if (S.hint) hintGo(); else askHint(); }
    }
    if (k.has('KeyP') || k.has('Escape')) { if (S.auto.on) S.auto.paused = !S.auto.paused; else if (!P.done) { S.paused = !S.paused; if (S.paused) persistSession(); } }
    if (S.paused) {
      if (!tap) return;
      const pl = pauseLayout(meta.width, meta.height, l.board);
      if (hitBtn('resume', pl.resume, tap)) S.paused = false;
      else if (hitBtn('restart', pl.restart, tap)) { const str = P.str; begin(newSession({ str, level: P.level, kind: P.kind, day: P.day, seed: P.seed })); persistSession(); }
      else if (hitBtn('psettings', pl.settings, tap)) { S.back = 'play'; go('settings'); }
      else if (hitBtn('pmenu', pl.menu, tap)) { persistSession(); S.paused = false; go('title'); }
      return;
    }
    if (S.auto.on) {
      if (!tap) return;
      if (hitBtn('aexit', l.rail.exit, tap)) { S.auto.on = false; S.hint = null; S.P = null; go('title'); }
      else if (hitBtn('apause', l.rail.pause, tap)) S.auto.paused = !S.auto.paused;
      else if (hitBtn('adec', l.rail.dec, tap)) { if (S.prefs.thinkIdx > 0) { S.prefs.thinkIdx -= 1; savePrefs(); } }
      else if (hitBtn('ainc', l.rail.inc, tap)) { if (S.prefs.thinkIdx < THINK_STEPS.length - 1) { S.prefs.thinkIdx += 1; savePrefs(); } }
      return;
    }
    if (P.done) return;
    // the sea: taps, drags and bridge taps work on release
    const inBoard = (x, y) => inRect(l.board.rect, x, y);
    if (boardPointer(p, l)) return;
    if (!tap || inBoard(tap.x, tap.y)) return;
    if (hitBtn('pause', l.pause, tap)) { S.paused = true; persistSession(); return; }
    if (S.hint) {
      if (hitBtn('close', l.coachBtns.close, tap)) S.hint = null;
      else if (hitBtn('go', l.coachBtns.go, tap)) hintGo();
      return;
    }
    const T = l.tools;
    if (hitBtn('undo', T.undo, tap)) doUndo();
    else if (hitBtn('redo', T.redo, tap)) doRedo();
    else if (hitBtn('clear', T.clear, tap)) doClear();
    else if (hitBtn('hint', T.hint, tap)) askHint();
  }

  function changeSetting(i, k) {
    const id = settingsRows(S)[i].id, p = S.prefs;
    switch (id) {
      case 'look': p.look = LOOK_IDS[k]; setLook(p.look); break;
      case 'hand': p.hand = k === 1 ? 'left' : 'right'; break;
      case 'check': p.check = ['off', 'conflicts', 'check'][k]; break;
      case 'numbers': p.numbers = k === 1 ? 'remaining' : 'target'; break;
      case 'timer': p.timer = k === 0; break;
      case 'sound': p.sound = k === 0; audio.setMuted?.(!p.sound); break;
      case 'calm': p.calm = k === 1; break;
      case 'restore': {
        if (S.restore.busy || S.owned) return;
        S.restore.busy = true; S.restore.msg = 'Checking with the store...';
        Promise.resolve().then(() => monetization.restore()).then(() => { S.owned = !!monetization.owns('unlock_game'); S.restore.msg = S.owned ? 'Purchase restored. Thank you.' : 'No earlier purchase found.'; })
          .catch(() => { S.restore.msg = 'Could not reach the store. Try again later.'; }).finally(() => { S.restore.busy = false; });
        return;
      }
      default: break;
    }
    savePrefs(); sfx.tap();
  }
  function textScale(dir) { const n = clamp(S.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (n !== S.prefs.textIdx) { S.prefs.textIdx = n; gateScale(); S.scrollY = 0; savePrefs(); } }

  function updateScene(dt, input) {
    const p = input.pointer, scrolling = ['new', 'doc', 'settings', 'stats', 'over'].includes(S.scene);
    const tap = getTap(p, scrolling ? metrics.rect : null);
    if (scrolling) {
      if (wheelInput.dy) { S.scrollY = clamp(S.scrollY + wheelInput.dy, 0, metrics.max); wheelInput.dy = 0; }
      const k = input.keys.pressed;
      if (k.has('ArrowDown')) S.scrollY = clamp(S.scrollY + 80, 0, metrics.max);
      if (k.has('ArrowUp')) S.scrollY = clamp(S.scrollY - 80, 0, metrics.max);
      S.scrollY = clamp(S.scrollY, 0, metrics.max);
    }
    const sc = S.scene, w = meta.width, h = meta.height;
    if (sc === 'play') return updatePlay(dt, tap, input);
    if (sc === 'title') {
      if (!tap) { if (input.keys.pressed.has('Enter') || input.keys.pressed.has('Space')) startPuzzle(S.prefs.grade); return; }
      const B = titleLayout(w, h, !!S.saved).buttons;
      for (const id of Object.keys(B)) if (hitBtn(id, B[id], tap)) {
        sfx.tap();
        if (id === 'continue') resumeSaved();
        else if (id === 'new') go('new');
        else if (id === 'daily') startDaily();
        else if (id === 'learn') startAuto();
        else if (id === 'howto' || id === 'rules' || id === 'about') { S.doc = { kind: id, page: 0 }; go('doc'); }
        else if (id === 'stats') go('stats');
        else if (id === 'settings') { S.back = 'title'; go('settings'); }
        return;
      }
      const t = titleLayout(w, h, !!S.saved);
      if (Math.abs(tap.x - t.brand.x) < 260 && Math.abs(tap.y - t.brand.y) < 26) env.openArcforgeHome?.();
      return;
    }
    if (sc === 'new') {
      const NL = newLayout(w, h, NEW_CARDS.length);
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', NL.back, tap)) { go('title'); return; }
      if (hitBtn('tdec', NL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', NL.textInc, tap)) return textScale(1);
      if (inRect(NL.body, tap.x, tap.y)) {
        NEW_CARDS.forEach((id, i) => { const r = { ...NL.cards[i], y: NL.cards[i].y - S.scrollY }; if (inRect(r, tap.x, tap.y)) { sfx.tap(); if (id === 'daily') startDaily(); else startPuzzle(id); } });
      }
      return;
    }
    if (sc === 'doc') {
      const DL = docLayout(w, h), n = DOCS[S.doc.kind].pages.length;
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
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
      const leave = () => { if (S.back === 'play' && S.P) { S.scene = 'play'; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
      if (input.keys.pressed.has('Escape')) { leave(); return; }
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
      const SL = statsLayout(w, h);
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) go('title');
      else if (hitBtn('tdec', SL.textDec, tap)) textScale(-1);
      else if (hitBtn('tinc', SL.textInc, tap)) textScale(1);
      return;
    }
    if (sc === 'over') {
      const O = overLayout(w, h, TEXT_SCALES[S.prefs.textIdx], pz().w, pz().h);
      if (!tap) return;
      const R0 = S.result;
      if (hitBtn('next', O.btns.next, tap)) { if (R0.daily) go('title'); else startPuzzle(R0.level); }
      else if (hitBtn('menu', O.btns.menu, tap)) { if (R0.daily) go('new'); else go('title'); }
      else if (hitBtn('share', O.btns.share, tap)) env.share(`Hashi Bridges ${R0.daily ? 'daily puzzle' : GRADE_INFO[R0.level].name + ' puzzle'}: solved in ${fmtTime(R0.time)}, ${R0.stars} star${R0.stars === 1 ? '' : 's'}${R0.daily ? '. Streak ' + R0.streak : ''}.`);
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
        const f = S.fx;
        for (let i = 0; i < f.grow.length; i++) if (f.grow[i] < 90) f.grow[i] += dt;
        for (let i = 0; i < f.pop.length; i++) {
          if (f.pop[i] < 90) f.pop[i] += dt;
          if (f.wave[i] < 90) { f.wave[i] += dt; if (f.wave[i] > 0.6) f.wave[i] = 99; }
          if (f.shake[i] < 90) { f.shake[i] += dt; if (f.shake[i] > 0.5) f.shake[i] = 99; }
        }
        if (f.blink) { f.blink.t += dt; if (f.blink.t > 0.6) f.blink = null; }
        for (const sp of S.sparks) { sp.t += dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 600 * dt; }
        S.sparks = S.sparks.filter((sp) => sp.t < sp.life);
        if (S.winT > 0) S.winT -= dt;
        for (const q of S.sfx) q.t -= dt;
        const due = S.sfx.filter((q) => q.t <= 0); if (due.length) { S.sfx = S.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
      }
      // the kit's preview pill sits top centre; in landscape it moves into the info panel so it never covers the board
      if (S.scene === 'play') { const l = L(); meta.previewBadge = l.mode === 'portrait' ? { x: l.pause.x - 12, y: l.pause.y - 8, align: 'right' } : { x: l.info.x + 16, y: l.info.y + 12, align: 'left' }; } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { render(ctx, S, view ?? meta); },
    getState: () => S,
    // Counts real play only: a live puzzle in progress. Menus, Rules, settings, Watch and Learn, pause, results are free.
    isPreviewExempt() { return !(S.scene === 'play' && !S.auto.on && !S.paused && S.P && !S.P.done); },
    // Tester/screenshot hooks (only wired up in dev: see main.js).
    dev: {
      go: (scene, extra) => { Object.assign(S, extra ?? {}); go(scene); },
      start: (level) => startPuzzle(level), daily: () => startDaily(), auto: () => startAuto(), hint: () => askHint(), hintGo: () => hintGo(),
      progress: (n) => { const P = S.P; let k = 0; for (let e = 0; e < P.br.length && k < n; e++) if (P.br[e] < P.sol[e]) { P.br[e] = P.sol[e]; k += 1; } },
      select: (i) => { S.sel = i; }, doc: (kind, page = 0) => { S.doc = { kind, page }; go('doc'); },
      advanced: (level) => { startPuzzle(level); for (let i = 0; i < 200; i++) { const h = makeHint(); if (!h || !h.step) break; if (h.step.tech !== 'forced') { h.stage = 'explain'; h.text = h.ex.why; S.hint = h; if (h.focus?.length) S.sel = h.focus[0]; return h.step.tech; } applyHint(S.P, h.step); } return null; },
      layout: () => { const l = L(); return { mode: l.mode, tools: l.tools, board: { x: l.board.x, y: l.board.y, size: l.board.size, s: l.board.s }, w: meta.width, h: meta.height }; },
      solveNow: () => { const P = S.P; P.br = P.sol.slice(); win(); }, skipOver: () => { S.winDelay = 0.01; },
    },
  };
}
