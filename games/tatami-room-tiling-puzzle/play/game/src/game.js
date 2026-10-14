// Tatami Room Tiling Puzzle: state and flow. Engine = tatami.js, session = play.js, drawing = view.js + art.js, geometry = layout.js.
import { playLayout, titleLayout, docLayout, settingsLayout, newLayout, statsLayout, overLayout, pauseLayout, inRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { LIBRARY } from './library.js';
import { parsePuzzle, puzzleToStr, fits, vertexConflicts, tileAt, uncovered, supplyLeft, nextStep, look, why, cellName, isFull, badVertices } from './tatami.js';
import { newSession, puzzleFor, putMat, pickUp, undo, redo, clearPlayer, solvedNow, starsFor, fmtTime, PAR_SECONDS } from './play.js';
import { render, metrics, settingRows, NEW_CARDS } from './view.js';
import { gridPt, v3 } from './v3.js';
import { DOCS, GRADE_INFO } from './content.js';
import { setLook, LOOK_IDS } from './ui.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen; everything lays out from the live size.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_PUZZLES = 3;
const DAILY_LEVEL = [5, 1, 2, 2, 3, 3, 4];   // by weekday, 0 = Sunday
const AUTO_GAP = 0.3;
const DEFAULT_PREFS = { look: 'spring', corner: 'show', names: true, timer: true, sound: true, calm: false, textIdx: 0, thinkIdx: 1, grade: 2 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS },
    P: null, tool: 'full', orient: 'lying', hint: null, paused: false, flagWrong: false, ghost: null, blockPts: null,
    auto: { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, trivial: false },
    fx: { drop: {} }, sparks: [], winT: 0, winDelay: 0, sfx: [],
    msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0 }, back: 'title', result: null,
    stats: { solved: [0, 0, 0, 0, 0, 0], best: [0, 0, 0, 0, 0, 0], days: [], bestStreak: 0 }, saved: null,
    daily: { day: config.day ?? 0 }, streak: 0, dailyDone: false, dailyLevel: 1, dailyInfo: '', demoCount: 0, saveAcc: 0,
    dev: config.dev === true, demo: config.demo === true, owned: monetization.owns?.('unlock_game') === true, restoreBusy: false, restoreMsg: '',
  };
  monetization.onChange?.(() => { S.owned = monetization.owns('unlock_game'); });
  let saveRaw = null, gesture = null, press = null;

  // ---- persistence ---------------------------------------------------------------------------------------------------------
  // the kit's unlock card follows the text zoom; its Unlock label overflows beyond 1.25x on narrow phones, so it sees at most that
  const gateScale = () => { config.textScale = Math.min(TEXT_SCALES[S.prefs.textIdx] ?? 1, 1.25); };
  const applyPrefs = () => { setLook(S.prefs.look); audio.setMuted?.(!S.prefs.sound); gateScale(); };
  const savePrefs = () => storage.set('prefs', S.prefs);
  const saveStats = () => storage.set('stats', S.stats);
  storage.get('prefs', null).then((v) => {
    if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); if (!LOOK_IDS.includes(S.prefs.look)) S.prefs.look = 'spring'; }
    applyPrefs();
  });
  storage.get('stats', null).then((v) => { if (v) S.stats = { ...S.stats, ...v, solved: v.solved ?? S.stats.solved, best: v.best ?? S.stats.best, days: v.days ?? [] }; refreshDaily(); });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  storage.get('save', null).then((v) => { if (v && v.puz && S.scene === 'title' && !S.P) { saveRaw = v; S.saved = { level: v.level, kind: v.kind, t: v.t }; } });
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
    saveRaw = { puz: puzzleToStr(P.puz), mats: P.B.tiles.filter((t) => t && !t.given).map((t) => [t.a, t.b]), level: P.level, kind: P.kind, day: P.day, seed: P.seed, t: P.t, errs: P.errs, hints: P.hints, moves: P.moves };
    S.saved = { level: P.level, kind: P.kind, t: P.t };
    storage.set('save', saveRaw);
  }
  const clearSave = () => { saveRaw = null; S.saved = null; storage.remove('save'); };

  // ---- sound ----------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound && !S.auto.on) audio.tone(o); };
  const later = (t, o) => S.sfx.push({ t, o });
  const sfx = {
    place: () => {
      if (v3.on) {   // 3D: a soft straw swish as the mat slides, the thud when it lands (0.3 s), then two gentle pats of the hands
        tone({ freq: 900, to: 420, dur: 0.22, type: 'sine', vol: 0.03 });
        later(0.3, { freq: 190, to: 120, dur: 0.09, type: 'triangle', vol: 0.14 }); later(0.33, { freq: 520, to: 430, dur: 0.05, type: 'sine', vol: 0.05 });
        later(0.5, { freq: 150, to: 110, dur: 0.06, type: 'triangle', vol: 0.07 }); later(0.66, { freq: 140, to: 105, dur: 0.06, type: 'triangle', vol: 0.06 });
        return;
      }
      tone({ freq: 190, to: 120, dur: 0.09, type: 'triangle', vol: 0.14 }); later(0.03, { freq: 520, to: 430, dur: 0.05, type: 'sine', vol: 0.05 });
    },
    lift: () => tone({ freq: 380, to: 520, dur: 0.07, type: 'sine', vol: 0.07 }),
    err: () => tone({ freq: 200, to: 130, dur: 0.18, type: 'triangle', vol: 0.1 }),
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.06 }),
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.08 }),
    win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => later(i * 0.12, { freq: f, to: f, dur: 0.4, type: 'triangle', vol: 0.09 })); },
  };

  // ---- helpers ----------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.6) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; gesture = null; press = null; S.ghost = null; wheelInput.dy = 0; S.msg = null; }
  const L = () => playLayout(meta.width, meta.height, { coach: !!(S.hint || S.auto.on), cols: S.P.B.w, rows: S.P.B.h });
  function spark(cx, cy, n, color) {
    for (let i = 0; i < n; i++) { const a = rng.next() * Math.PI * 2, v = 80 + rng.next() * 240; S.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0, life: 0.6 + rng.next() * 0.5, r: 3 + rng.next() * 4, c: color }); }
    if (S.sparks.length > 140) S.sparks.splice(0, S.sparks.length - 140);
  }
  const cellCenter = (i) => { const g = L().board; return gridPt(g, (i % g.cols) + 0.5, Math.floor(i / g.cols) + 0.5, 0.12); };

  // ---- puzzles ----------------------------------------------------------------------------------------------------------------
  function takePuzzle(level) {
    const lib = LIBRARY[level];
    return puzzleFor(lib[rng.int(lib.length)], rng.int(8));
  }
  function dailyPuzzle(day) {
    const level = DAILY_LEVEL[(((day + 4) % 7) + 7) % 7], lib = LIBRARY[level];
    const idx = Math.floor((day * 2654435761 >>> 0) / 4294967296 * lib.length);
    return { level, puzzle: puzzleFor(lib[idx], (day * 7 + 3) & 7) };
  }
  function begin(P, extra = {}) {
    S.P = P; S.hint = null; S.paused = false; S.flagWrong = false; S.msg = null; S.ghost = null; S.blockPts = null;
    S.auto = { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, trivial: false, ...extra };
    S.fx = { drop: {} }; S.sparks = []; S.winT = 0; S.winDelay = 0; S.result = null; S.saveAcc = 0;
    S.tool = 'full'; go('play');
  }
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_PUZZLES) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }
  function startPuzzle(level) {
    if (demoBlocked()) return;
    S.prefs.grade = level; savePrefs();
    begin(newSession({ puzzle: takePuzzle(level), level, kind: 'free', seed: rng.int(1 << 30) }));
    persistSession();
  }
  function startDaily() {
    if (demoBlocked()) return;
    const d = dailyPuzzle(S.daily.day);
    begin(newSession({ puzzle: d.puzzle, level: d.level, kind: 'daily', day: S.daily.day }));
    persistSession();
  }
  function resumeSaved() {
    const v = saveRaw;
    if (!v) return;
    const P = newSession({ puzzle: parsePuzzle(v.puz), level: v.level, kind: v.kind, day: v.day ?? 0, seed: v.seed ?? 0 });
    for (const [a, b] of v.mats) if (fits(P.B, a, b)) putMat(P, a, b, { record: false });
    P.t = v.t; P.errs = v.errs; P.hints = v.hints; P.moves = v.moves ?? 0;
    begin(P);
    say('Welcome back.', 1.6);
  }
  function startAuto() {
    const level = clamp(S.prefs.grade, 1, 5);
    begin(newSession({ puzzle: takePuzzle(level), level, kind: 'auto' }), { on: true });
    say('Watch the game lay this room and explain each mat.', 2.4);
  }

  // ---- hints (also drive Watch and Learn) ----------------------------------------------------------------------------------------
  function makeHint() {
    const P = S.P, step = nextStep(P.B, P.sol);
    if (!step) return null;
    if (step.type === 'mistake') return { stage: 'mistake', step, text: `${look(P.B, step)} ${why(P.B, step)}` };
    return { stage: 'look', step, text: look(P.B, step) };
  }
  function askHint() {
    const h = makeHint();
    if (!h) { say('No further step found.'); return; }
    S.P.hints += 1; S.hint = h; sfx.hint();
  }
  function afterPlace(id, a, b) {
    S.fx.drop[id] = 0;
    if (!v3.on) { const c = cellCenter(a); spark(c.x, c.y, 6, '#f3e6a0'); }   // in 3D the dust puffs rise from the landing instead
    sfx.place();
  }
  function checkFinished() {
    const P = S.P;
    if (P.done) return;
    if (solvedNow(P)) return win();
    if (uncovered(P.B) === 0) { S.flagWrong = true; say('Every square is covered, but four corners still meet at a red point.', 3.2); sfx.err(); } else S.flagWrong = false;
  }
  function hintGo() {
    const h = S.hint, P = S.P;
    if (!h) return;
    if (h.stage === 'look') { h.stage = 'explain'; h.text = why(P.B, h.step); sfx.tap(); return; }
    if (h.stage === 'mistake') { pickUp(P, h.step.tile.a); S.hint = null; sfx.lift(); persistSession(); return; }
    const st = h.step, r = putMat(P, st.a, st.b);
    S.hint = null;
    if (r.ok) afterPlace(r.id, st.a, st.b);
    persistSession(); checkFinished();
  }

  // ---- placing mats -----------------------------------------------------------------------------------------------------------------
  function fullCandidates(cell) {
    const B = S.P.B, w = B.w, c = cell % w, r = Math.floor(cell / w);
    const lying = [[c < w - 1, cell, cell + 1], [c > 0, cell - 1, cell]];
    const standing = [[r < B.h - 1, cell, cell + w], [r > 0, cell - w, cell]];
    const order = S.orient === 'lying' ? lying.concat(standing) : standing.concat(lying);
    return order.filter(([ok, a, b]) => ok && fits(B, a, b)).map(([, a, b]) => ({ a, b }));
  }
  function candidateFor(cell) {   // the mat a tap on this empty square would put down
    const B = S.P.B;
    if (S.tool === 'half') return fits(B, cell, cell) ? { a: cell, b: cell } : null;
    const c = fullCandidates(cell);
    if (!c.length) return null;
    return c.find((x) => vertexConflicts(B, x.a, x.b).length === 0) ?? c[0];
  }
  function place(a, b) {
    const P = S.P, block = S.prefs.corner === 'block';
    const r = putMat(P, a, b, { block });
    S.hint = null; S.blockPts = null;
    if (!r.ok) {
      if (r.reason === 'corner') { S.blockPts = { pts: r.bad, t: 0 }; say('That would put four corners together.', 2.2); sfx.err(); }
      else if (r.reason === 'nofull') say('No full mats left. Pick one up, or use a half mat.', 2.6);
      else if (r.reason === 'nohalf') say('No half mats left.', 2.2);
      return false;
    }
    afterPlace(r.id, a, b);
    if (r.bad.length && S.prefs.corner !== 'off') { sfx.err(); say('Four corners meet at the red point.', 2); }
    S.flagWrong = false;
    persistSession(); checkFinished();
    return true;
  }
  function tapCell(cell) {
    const P = S.P, B = P.B;
    if (!B.room[cell]) return;
    const t = tileAt(B, cell);
    if (t) {
      if (t.given) { say('That mat came with the puzzle.', 1.8); sfx.err(); return; }
      pickUp(P, cell); S.hint = null; S.flagWrong = false; sfx.lift(); persistSession();
      return;
    }
    const left = supplyLeft(B);
    if (S.tool === 'full' && left.full <= 0) { say('No full mats left. Pick one up, or use a half mat.', 2.4); return; }
    if (S.tool === 'half' && left.half <= 0) { say('No half mats left.', 2.2); return; }
    const c = candidateFor(cell);
    if (!c) { say(S.tool === 'full' ? 'No room for a full mat on that square.' : 'That square is taken.', 2); sfx.err(); return; }
    place(c.a, c.b);
  }
  const doUndo = () => { if (undo(S.P)) { S.hint = null; S.flagWrong = false; sfx.lift(); persistSession(); } else say('Nothing to undo.', 1.4); };
  const doRedo = () => { if (redo(S.P)) { S.hint = null; sfx.lift(); persistSession(); checkFinished(); } else say('Nothing to redo.', 1.4); };
  const doTurn = () => { S.orient = S.orient === 'lying' ? 'standing' : 'lying'; S.tool = 'full'; sfx.tap(); };

  // ---- winning ----------------------------------------------------------------------------------------------------------------------
  function win() {
    const P = S.P;
    P.done = true; S.hint = null; S.flagWrong = false; S.winT = 3.2; S.winDelay = 1.9;
    const b = L().board; spark(b.x + b.w / 2, b.y + b.h / 2, 50, '#ffd45a'); sfx.win();
    if (S.auto.on) { S.auto.done = true; S.auto.phase = null; say('Finished. That is every mat.', 4); return; }
    const level = P.level, first = !S.stats.best[level] || P.t < S.stats.best[level];
    S.stats.solved[level] += 1;
    if (P.kind !== 'auto' && P.t > 0 && first) S.stats.best[level] = Math.max(1, Math.round(P.t));
    let streak = S.streak;
    if (P.kind === 'daily' && P.day === S.daily.day && !S.stats.days.includes(P.day)) { S.stats.days.push(P.day); S.stats.days = S.stats.days.slice(-200); refreshDaily(); streak = S.streak; S.stats.bestStreak = Math.max(S.stats.bestStreak, streak); }
    saveStats(); clearSave();
    if (P.kind === 'daily' && P.day === S.daily.day) storage.set('daily', { day: P.day, streak });
    monetization.track('puzzle_solved', { level, kind: P.kind, t: Math.round(P.t) });
    const tiles = P.B.tiles.filter(Boolean), fullMats = tiles.filter(isFull).length;
    S.result = { stars: starsFor(P), time: P.t, par: PAR_SECONDS[level], errs: P.errs, hints: P.hints, newBest: first && P.kind !== 'auto', daily: P.kind === 'daily', streak, level, mats: tiles.length, fullMats, halfMats: tiles.length - fullMats };
  }

  // ---- Watch and Learn --------------------------------------------------------------------------------------------------------------
  const wordCount = (t) => t.split(' ').length;
  function autoTick(dt) {
    const a = S.auto, P = S.P;
    if (a.paused || a.done || P.done) return;
    if (a.phase === 'gap') { a.timer -= dt; if (a.timer <= 0) a.phase = null; return; }
    if (a.phase === 'think') {
      a.timer -= dt;
      if (a.timer > 0) return;
      S.hint.stage = 'explain'; S.hint.text = why(P.B, S.hint.step); a.phase = 'reveal';
      a.timer = a.trivial ? 1.6 + wordCount(S.hint.text) * 0.12 : clamp(2 + wordCount(S.hint.text) * 0.2, 2, 9);
      return;
    }
    if (a.phase === 'reveal') {
      a.timer -= dt;
      if (a.timer > 0) return;
      const st = S.hint.step, r = putMat(P, st.a, st.b, { record: false });
      if (r.ok) afterPlace(r.id, st.a, st.b);
      P.errs = 0; S.hint = null; a.phase = 'gap'; a.timer = AUTO_GAP;
      if (solvedNow(P)) win();
      return;
    }
    const h = makeHint();
    if (!h || h.stage === 'mistake') { a.done = true; return; }
    S.hint = h; a.n += 1; a.phase = 'think';
    a.trivial = h.step.technique === 'only-fit';
    const base = THINK_STEPS[S.prefs.thinkIdx];
    a.timer = a.trivial ? Math.max(0.9, base * 0.3) : base;
  }

  // ---- input -------------------------------------------------------------------------------------------------------------------------
  let scrollGesture = null;
  function getTap(p, scrollRect) {
    if (!scrollRect) { scrollGesture = null; return p.pressed ? { x: p.x, y: p.y } : null; }
    if (p.pressed) scrollGesture = { x0: p.x, y0: p.y, s0: S.scrollY, moved: false, inBody: inRect(scrollRect, p.x, p.y) };
    let tap = null;
    if (scrollGesture) {
      if (p.down && scrollGesture.inBody) {
        const dy = p.y - scrollGesture.y0;
        if (Math.abs(dy) > 12) scrollGesture.moved = true;
        if (scrollGesture.moved) S.scrollY = clamp(scrollGesture.s0 - dy, 0, metrics.max);
      }
      if (p.released || !p.down) { if (!scrollGesture.moved) tap = { x: scrollGesture.x0, y: scrollGesture.y0 }; scrollGesture = null; }
    }
    return tap;
  }
  function hitBtn(id, r, tap) { if (inRect(r, tap.x, tap.y)) { flash(id); return true; } return false; }

  function boardTouch(input, l) {
    const p = input.pointer, B = S.P.B;
    if (p.pressed) {
      const i = l.board.at(p.x, p.y);
      if (i >= 0 && B.room[i]) gesture = { cell: i, x: p.x, y: p.y };
    }
    if (!gesture) return false;
    const cur = l.board.at(p.x, p.y);
    const dragTo = cur >= 0 && cur !== gesture.cell && B.room[cur] && Math.abs(cur - gesture.cell) <= B.w && (cur - gesture.cell === 1 || gesture.cell - cur === 1 || Math.abs(cur - gesture.cell) === B.w) && (Math.abs(cur - gesture.cell) !== 1 || Math.floor(cur / B.w) === Math.floor(gesture.cell / B.w));
    let want = null;
    if (dragTo) { const a = Math.min(cur, gesture.cell), b = Math.max(cur, gesture.cell); if (fits(B, a, b)) want = { a, b }; }
    else if (cur === gesture.cell && !tileAt(B, cur)) want = candidateFor(cur);
    if (p.down) S.ghost = want ? { a: want.a, b: want.b, ok: vertexConflicts(B, want.a, want.b).length === 0 } : null;
    if (p.released || !p.down) {
      S.ghost = null;
      const g = gesture; gesture = null;
      if (dragTo && want) { S.hint = null; place(want.a, want.b); }
      else if (cur === g.cell || !dragTo) tapCell(g.cell);
    }
    return true;
  }

  function updatePlay(dt, input) {
    const P = S.P, l = L(), p = input.pointer;
    const live = !S.paused && !P.done && !S.auto.on && S.winT <= 0;
    if (live) { P.t += dt; S.saveAcc += dt; if (S.saveAcc > 6) { S.saveAcc = 0; persistSession(); } }
    if (S.auto.on && !S.auto.paused && !S.paused) autoTick(dt);
    if (S.winDelay > 0) { S.winDelay -= dt; if (S.winDelay <= 0 && S.result) go('over'); }
    const k = input.keys.pressed;
    if (live) {
      if (k.has('Digit1')) { S.tool = 'full'; sfx.tap(); }
      if (k.has('Digit2')) { S.tool = 'half'; sfx.tap(); }
      if (k.has('KeyT') || k.has('KeyR')) doTurn();
      if (k.has('KeyU')) doUndo();
      if (k.has('KeyY')) doRedo();
      if (k.has('KeyH')) { if (S.hint) hintGo(); else askHint(); }
    }
    if (k.has('KeyP') || k.has('Escape')) { if (S.auto.on) S.auto.paused = !S.auto.paused; else if (!P.done) { S.paused = !S.paused; if (S.paused) persistSession(); } }
    // the room itself: press, drag across two squares or tap
    if (live && !S.paused && boardTouch(input, l)) return;
    if (!p.pressed) return;
    const tap = { x: p.x, y: p.y };
    if (S.paused) {
      const pl = pauseLayout(meta.width, meta.height, l.board);
      if (hitBtn('resume', pl.resume, tap)) S.paused = false;
      else if (hitBtn('restart', pl.restart, tap)) { clearPlayer(P); P.t = 0; P.errs = 0; P.hints = 0; P.moves = 0; S.fx = { drop: {} }; S.paused = false; S.hint = null; persistSession(); }
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
    if (hitBtn('pause', l.pause, tap)) { S.paused = true; persistSession(); return; }
    if (S.hint) {
      if (hitBtn('close', l.coachBtns.close, tap)) S.hint = null;
      else if (hitBtn('go', l.coachBtns.go, tap)) hintGo();
      return;
    }
    const T = l.tools;
    if (hitBtn('full', T.full, tap)) { if (S.tool === 'full') doTurn(); else { S.tool = 'full'; sfx.tap(); } }
    else if (hitBtn('half', T.half, tap)) { S.tool = 'half'; sfx.tap(); }
    else if (hitBtn('turn', T.turn, tap)) doTurn();
    else if (hitBtn('undo', T.undo, tap)) doUndo();
    else if (hitBtn('redo', T.redo, tap)) doRedo();
    else if (hitBtn('hint', T.hint, tap)) askHint();
  }

  function changeSetting(i, k) {
    const id = settingRows(S)[i].id, p = S.prefs;
    switch (id) {
      case 'look': p.look = LOOK_IDS[k]; setLook(p.look); break;
      case 'corner': p.corner = ['show', 'block', 'off'][k]; break;
      case 'names': p.names = k === 0; break;
      case 'timer': p.timer = k === 0; break;
      case 'sound': p.sound = k === 0; audio.setMuted?.(!p.sound); break;
      case 'calm': p.calm = k === 1; break;
      case 'restore': {
        if (S.restoreBusy || S.owned) return;
        S.restoreBusy = true; S.restoreMsg = 'Checking with the store...'; sfx.tap();
        Promise.resolve(monetization.restore()).then(() => {
          S.owned = monetization.owns('unlock_game');
          S.restoreMsg = S.owned ? 'Purchase restored' : 'No earlier purchase found';
        }).catch(() => { S.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { S.restoreBusy = false; });
        return;
      }
      default: break;
    }
    savePrefs(); sfx.tap();
  }
  function textScale(dir) { const n = clamp(S.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (n !== S.prefs.textIdx) { S.prefs.textIdx = n; S.scrollY = 0; gateScale(); savePrefs(); } }

  function updateScene(dt, input) {
    const p = input.pointer, scrolling = ['new', 'doc', 'settings', 'stats', 'over'].includes(S.scene);
    if (S.scene === 'play') return updatePlay(dt, input);
    const tap = getTap(p, scrolling ? metrics.rect : null);
    if (scrolling) {
      if (wheelInput.dy) { S.scrollY = clamp(S.scrollY + wheelInput.dy, 0, metrics.max); wheelInput.dy = 0; }
      const k = input.keys.pressed;
      if (k.has('ArrowDown')) S.scrollY = clamp(S.scrollY + 80, 0, metrics.max);
      if (k.has('ArrowUp')) S.scrollY = clamp(S.scrollY - 80, 0, metrics.max);
      S.scrollY = clamp(S.scrollY, 0, metrics.max);
    }
    const sc = S.scene, w = meta.width, h = meta.height;
    if (sc === 'title') {
      if (!tap) { if (input.keys.pressed.has('Enter') || input.keys.pressed.has('Space')) startPuzzle(S.prefs.grade); return; }
      const t = titleLayout(w, h, !!S.saved), B = t.buttons;
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
      const SL = settingsLayout(w, h, TEXT_SCALES[S.prefs.textIdx], settingRows(S).length);
      const leave = () => { if (S.back === 'play' && S.P) { S.scene = 'play'; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
      if (input.keys.pressed.has('Escape')) { leave(); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) return leave();
      if (hitBtn('tdec', SL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', SL.textInc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) {
        const ty = tap.y + S.scrollY;
        settingRows(S).forEach((row, i) => {
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
      const O = overLayout(w, h, TEXT_SCALES[S.prefs.textIdx], S.P.B.w, S.P.B.h);
      if (!tap) return;
      const R0 = S.result;
      if (hitBtn('next', O.btns.next, tap)) { if (R0.daily) go('title'); else startPuzzle(R0.level); }
      else if (hitBtn('menu', O.btns.menu, tap)) { if (R0.daily) go('new'); else go('title'); }
      else if (hitBtn('share', O.btns.share, tap)) env.share(`Tatami Room Tiling Puzzle ${R0.daily ? 'daily puzzle' : GRADE_INFO[R0.level].name + ' room'}: finished in ${fmtTime(R0.time)}, ${R0.stars} star${R0.stars === 1 ? '' : 's'}${R0.daily ? '. Streak ' + R0.streak : ''}.`);
      return;
    }
    if (sc === 'demo-limit' && tap) go('title');
  }

  return {
    update(dt, input) {
      S.t += dt; S.sceneT += dt;
      if (S.flash) { S.flash.t += dt; if (S.flash.t > 0.25) S.flash = null; }
      if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold) S.msg = null; }
      if (S.blockPts) { S.blockPts.t += dt; if (S.blockPts.t > 1.4) S.blockPts = null; }
      const frozen = S.paused || (S.auto.on && S.auto.paused);
      if (!frozen) {
        for (const id of Object.keys(S.fx.drop)) { S.fx.drop[id] += dt; if (S.fx.drop[id] > 0.4) delete S.fx.drop[id]; }
        for (const sp of S.sparks) { sp.t += dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 600 * dt; }
        S.sparks = S.sparks.filter((sp) => sp.t < sp.life);
        if (S.winT > 0) S.winT -= dt;
        for (const q of S.sfx) q.t -= dt;
        const due = S.sfx.filter((q) => q.t <= 0); if (due.length) { S.sfx = S.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
      }
      // the kit's preview pill sits top centre; it moves beside the pause button (portrait) or into the info panel (landscape) so it never covers the HUD or the room
      if (S.scene === 'play' && S.P) { const l = L(); meta.previewBadge = l.mode === 'portrait' ? { x: l.pause.x - 14, y: l.pause.y + 15, align: 'right' } : { x: l.info.x + 18, y: l.hud.title.y + 84, align: 'left' }; } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { render(ctx, S, view ?? meta); },
    getState: () => S,
    // Counts real play only: a live room in progress. Menus, Rules, settings, Watch and Learn, pause, results are free.
    isPreviewExempt() { return !(S.scene === 'play' && !S.auto.on && !S.paused && S.P && !S.P.done); },
    // Tester/screenshot hooks (only wired up in dev: see main.js).
    dev: {
      go: (scene, extra) => { Object.assign(S, extra ?? {}); go(scene); S.sceneT = 1; },
      start: (level) => startPuzzle(level), daily: () => startDaily(), auto: () => startAuto(), hint: () => askHint(), hintGo: () => hintGo(),
      progress: (n) => { const P = S.P; let k = 0; for (const [a, b] of P.sol) { if (k >= n) break; if (!tileAt(P.B, a) && fits(P.B, a, b)) { const r = putMat(P, a, b, { record: false }); if (r.ok) k += 1; } } },
      doc: (kind, page = 0) => { S.doc = { kind, page }; go('doc'); S.sceneT = 1; },
      layout: () => { const l = L(); return { mode: l.mode, tools: l.tools, board: { x: l.board.x, y: l.board.y, s: l.board.s, cols: l.board.cols, rows: l.board.rows }, w: meta.width, h: meta.height }; },
      solveNow: () => { const P = S.P; for (const [a, b] of P.sol) if (!tileAt(P.B, a) && fits(P.B, a, b)) putMat(P, a, b, { record: false }); win(); }, skipOver: () => { S.winDelay = 0.01; },
      season: (id) => { S.prefs.look = id; setLook(id); },
      zoom: (i) => { S.prefs.textIdx = clamp(i | 0, 0, TEXT_SCALES.length - 1); },
    },
  };
}
