// Crossword Grid Clues: state and flow. Engine = grid.js, session = play.js, drawing = view.js + board.js, geometry = layout.js.
import { playLayout, playLayoutZ, titleLayout, docLayout, settingsLayout, newLayout, statsLayout, overLayout, pauseLayout, popLayout, pageLayout, listGeo, inRect, TEXT_SCALES, THINK_STEPS, zoomGeo, zoomSpan, zoomChip, host } from './layout.js';
import { LIBRARY, SIZES } from './library.js';
import { makePuzzle, slotOf, stepSlot, moveCell, ACROSS, DOWN } from './grid.js';
import { newSession, put, erase, undo, redo, check, reveal, solved, wrongCells, refreshDone, pickSlot, explain, slotCorrect, starsFor, fmtTime, GRADES, GRADE_COUNT } from './play.js';
import { render, metrics, SETTINGS, NEW_CARDS, listArea, listFs, cluesArea } from './view.js';
import { DOCS } from './content.js';
import { setLook, LOOK_IDS } from './ui.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen; everything lays out from the live size.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_PUZZLES = 3;
const DAILY_LEVEL = [5, 1, 2, 3, 3, 4, 4];   // by weekday, 0 = Sunday
const AUTO_GAP = 0.35, TYPE_GAP = 0.15;
const BLANK = (n) => new Array(n).fill(99);
const DEFAULT_PREFS = { look: 'newsprint', check: 'off', skip: true, next: true, hilite: true, timer: true, sound: true, calm: false, textIdx: 0, thinkIdx: 1, grade: 2 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KEY_LETTER = (code) => { const m = /^Key([A-Z])$/.exec(code); return m ? m[1] : ''; };
const hash = (day, salt) => (Math.imul(day + salt, 2654435761) >>> 0);

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS },
    P: null, sel: -1, dir: ACROSS, pencilMode: false, hint: null, paused: false, menu: null,
    auto: { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, slot: null, ex: null, cells: [], i: 0 },
    fx: { pop: BLANK(1), wave: BLANK(1), shake: BLANK(1) }, cellFlash: [], sparks: [], winT: 0, winDelay: 0, sfx: [],
    msg: null, flash: null, scrollY: 0, listY: 0, doc: { kind: 'rules', page: 0 }, back: 'title', result: null,
    stats: { solved: [0, 0, 0, 0, 0, 0], best: [0, 0, 0, 0, 0, 0], days: [], bestStreak: 0 }, saved: null, played: {},
    daily: { day: config.day ?? 0 }, streak: 0, dailyDone: false, dailyLevel: 1, dailyInfo: '', demoCount: 0, saveAcc: 0,
    dev: config.dev === true,
    zoomUser: null, cam: { x: 0, y: 0 }, camT: { x: 0, y: 0 }, camSel: -2, camWas: false, drag: null,
  };
  let saveRaw = null;
  let gesture = null, lgesture = null;

  // ---- persistence ---------------------------------------------------------------------------------------------------------
  const applyPrefs = () => { setLook(S.prefs.look); audio.setMuted?.(!S.prefs.sound); };
  const savePrefs = () => storage.set('prefs', S.prefs);
  const saveStats = () => storage.set('stats', S.stats);
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); S.prefs.grade = clamp(S.prefs.grade | 0, 1, GRADE_COUNT); if (!LOOK_IDS.includes(S.prefs.look)) S.prefs.look = 'newsprint'; } applyPrefs(); });
  storage.get('stats', null).then((v) => { if (v) { S.stats = { ...S.stats, ...v, solved: v.solved ?? S.stats.solved, best: v.best ?? S.stats.best, days: v.days ?? [] }; } refreshDaily(); });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  storage.get('played', null).then((v) => { if (v) S.played = { ...v, ...S.played }; });
  storage.get('save', null).then((v) => { if (v && v.id && S.scene === 'title' && !S.P) { saveRaw = v; S.saved = { level: v.level, kind: v.kind, t: v.t }; } });
  applyPrefs();

  function refreshDaily() {
    const day = S.daily.day, set = new Set(S.stats.days);
    let streak = 0, d = set.has(day) ? day : day - 1;
    while (set.has(d)) { streak += 1; d -= 1; }
    S.streak = streak; S.dailyDone = set.has(day); S.dailyLevel = DAILY_LEVEL[(((day + 4) % 7) + 7) % 7];
    S.dailyInfo = S.dailyDone ? `${GRADES[S.dailyLevel].name}  ·  done today` : `${GRADES[S.dailyLevel].name}  ·  ${streak ? streak + ' day streak' : 'new every day'}`;
  }
  refreshDaily();
  function persistSession() {
    const P = S.P;
    if (!P || P.done || S.auto.on) return;
    saveRaw = { id: P.id, level: P.level, kind: P.kind, day: P.day, v: P.v.map((c) => c || '.').join(''), pencil: P.pencil.join(''), rev: P.rev.join(''), t: P.t, errs: P.errs, hints: P.hints, reveals: P.reveals, checks: P.checks, moves: P.moves, sel: S.sel, dir: S.dir };
    S.saved = { level: P.level, kind: P.kind, t: P.t };
    storage.set('save', saveRaw);
  }
  const clearSave = () => { saveRaw = null; S.saved = null; storage.remove('save'); };

  // ---- sound --------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound && !S.auto.on) audio.tone(o); };
  const autoTone = (o) => { if (S.prefs.sound) audio.tone(o); };
  const later = (t, o) => S.sfx.push({ t, o });
  const sfx = {
    letter: (ch) => tone({ freq: 430 + (ch.charCodeAt(0) - 65) * 9, to: 330, dur: 0.06, type: 'sine', vol: 0.1 }),
    pencil: () => tone({ freq: 760, to: 700, dur: 0.04, type: 'sine', vol: 0.05 }),
    erase: () => tone({ freq: 300, to: 190, dur: 0.07, type: 'triangle', vol: 0.07 }),
    err: () => tone({ freq: 190, to: 120, dur: 0.16, type: 'triangle', vol: 0.09 }),
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.06 }),
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.08 }),
    word: () => { [523, 659, 784].forEach((f, i) => later(i * 0.08, { freq: f, to: f * 1.01, dur: 0.16, type: 'triangle', vol: 0.08 })); },
    win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => later(i * 0.12, { freq: f, to: f, dur: 0.4, type: 'triangle', vol: 0.09 })); },
    write: (ch) => autoTone({ freq: 430 + (ch.charCodeAt(0) - 65) * 9, to: 340, dur: 0.05, type: 'sine', vol: 0.07 }),
  };

  // ---- small helpers -------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.6) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; gesture = null; lgesture = null; wheelInput.dy = 0; S.msg = null; S.menu = null; }
  // Small squares (Giant and Grand on phones): the grid zooms to about 46 css px per square and follows the cursor; a chip toggles fit / zoom.
  const L = () => playLayoutZ(meta.width, meta.height, { coach: !!(S.hint || S.auto.on), n: S.P.pz.n }, S);
  function resetFx() { const N = S.P.pz.n * S.P.pz.n; S.fx = { pop: BLANK(N), wave: BLANK(N), shake: BLANK(N) }; S.sparks = []; S.cellFlash = []; S.winT = 0; S.winDelay = 0; }
  function spark(cx, cy, count, color) {
    for (let i = 0; i < count; i++) { const a = rng.next() * Math.PI * 2, v = 80 + rng.next() * 260; S.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0, life: 0.7 + rng.next() * 0.6, r: 3 + rng.next() * 4, c: color }); }
    if (S.sparks.length > 160) S.sparks.splice(0, S.sparks.length - 160);
  }
  const cellCenter = (i) => { const r = L().board.cells[i]; return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
  const curSlot = () => (S.sel >= 0 ? S.P.pz.slots[slotOf(S.P.pz, S.sel, S.dir)] : null);
  const hasSlot = (c, dir) => (dir === ACROSS ? S.P.pz.acc[c] : S.P.pz.dwn[c]) >= 0;

  // ---- puzzles -------------------------------------------------------------------------------------------------------------------
  function pickIndex(level) {
    const lib = LIBRARY[level], played = new Set(S.played[level] ?? []);
    let free = []; for (let i = 0; i < lib.length; i++) if (!played.has(i)) free.push(i);
    if (!free.length) { S.played[level] = []; free = lib.map((_, i) => i); }
    return free[rng.int(free.length)];
  }
  function markPlayed(level, idx) {
    const a = S.played[level] ?? (S.played[level] = []);
    if (!a.includes(idx)) a.push(idx);
    storage.set('played', S.played);
  }
  function session(level, idx, flip, extra = {}) {
    const pz = makePuzzle(LIBRARY[level][idx], SIZES[level], flip);
    return newSession({ pz, level, id: `${level}:${idx}:${flip ? 1 : 0}`, ...extra });
  }
  function begin(P, extra = {}) {
    S.P = P; S.hint = null; S.paused = false; S.menu = null; S.msg = null; S.pencilMode = false; S.listY = 0;
    S.auto = { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, slot: null, ex: null, cells: [], i: 0, ...extra };
    const first = P.pz.slots[P.pz.order[0]];
    S.sel = first.cells[0]; S.dir = first.dir; S.camSel = -2; S.camWas = false; S.drag = null; { const n = P.pz.n; S.cam = { x: (S.sel % n) + 0.5, y: Math.floor(S.sel / n) + 0.5 }; S.camT = { ...S.cam }; }
    resetFx(); S.result = null; S.saveAcc = 0; go('play');
  }
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_PUZZLES) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }
  function startPuzzle(level) {
    if (demoBlocked()) return;
    S.prefs.grade = level; savePrefs();
    const idx = pickIndex(level);
    markPlayed(level, idx);
    begin(session(level, idx, rng.chance(0.5), { kind: 'free', seed: rng.int(1 << 30) }));
    persistSession();
  }
  function startDaily() {
    if (demoBlocked()) return;
    const day = S.daily.day, level = DAILY_LEVEL[(((day + 4) % 7) + 7) % 7], idx = hash(day, 11) % LIBRARY[level].length;
    begin(session(level, idx, ((hash(day, 29) >>> 5) % 2) === 1, { kind: 'daily', day }));
    persistSession();
  }
  function resumeSaved() {
    const v = saveRaw;
    if (!v) return;
    const [level, idx, flip] = v.id.split(':').map(Number);
    if (!LIBRARY[level] || !LIBRARY[level][idx]) { clearSave(); return; }
    const P = session(level, idx, flip === 1, { kind: v.kind, day: v.day ?? 0 });
    P.v = [...v.v].map((c) => (c === '.' ? '' : c)); P.pencil = [...v.pencil].map(Number); P.rev = [...v.rev].map(Number);
    P.t = v.t; P.errs = v.errs; P.hints = v.hints; P.reveals = v.reveals ?? 0; P.checks = v.checks ?? 0; P.moves = v.moves ?? 0;
    refreshDone(P);
    begin(P);
    if (v.sel >= 0 && !P.pz.block[v.sel]) { S.sel = v.sel; S.dir = v.dir ?? 0; if (!hasSlot(S.sel, S.dir)) S.dir = 1 - S.dir; }
    say('Welcome back.', 1.6);
  }
  function startAuto() {
    const level = clamp(S.prefs.grade, 1, 3);
    const idx = pickIndex(level);
    begin(session(level, idx, rng.chance(0.5), { kind: 'auto' }), { on: true });
    say('Watch the game solve this puzzle and explain its thinking.', 2.4);
  }

  // ---- selection --------------------------------------------------------------------------------------------------------------------
  function keepListVisible() {
    if (!S.P || S.sel < 0) return;
    const l = L();
    if (!l.list) return;
    const area = listArea(l), geo = listGeo(area, S.P.pz, listFs()), id = slotOf(S.P.pz, S.sel, S.dir);
    const row = geo.rows.find((r) => r.k === 'clue' && r.id === id);
    if (!row) return;
    const max = Math.max(0, geo.total - area.h + 6);
    if (row.y < S.listY) S.listY = row.y - 6; else if (row.y + row.h > S.listY + area.h) S.listY = row.y + row.h - area.h + 6;
    S.listY = clamp(S.listY, 0, max);
  }
  function toggleDir() { if (S.sel >= 0 && hasSlot(S.sel, 1 - S.dir)) S.dir = 1 - S.dir; }
  function selectCell(c) {
    if (S.P.pz.block[c]) return;
    if (c === S.sel) toggleDir();
    else { S.sel = c; if (!hasSlot(c, S.dir)) S.dir = 1 - S.dir; }
    keepListVisible();
  }
  function goSlot(id) {
    const P = S.P, slot = P.pz.slots[id];
    const empty = slot.cells.find((c) => !P.v[c]) ?? slot.cells.find((c) => P.v[c] !== P.pz.sol[c]) ?? slot.cells[0];
    S.sel = empty; S.dir = slot.dir; keepListVisible();
  }
  function stepClue(step) {
    const pz = S.P.pz;
    goSlot(stepSlot(pz, slotOf(pz, S.sel, S.dir), step)); sfx.tap(); S.hint = null;
  }

  // ---- hints (also drive Watch and Learn) ---------------------------------------------------------------------------------------------------
  function makeHint() {
    const P = S.P, bad = wrongCells(P);
    if (bad.length) {
      const c = bad[0], r = Math.floor(c / P.pz.n) + 1, col = (c % P.pz.n) + 1;
      return { stage: 'mistake', cell: c, slot: null, ex: null, text: `The letter ${P.v[c]} in row ${r}, column ${col} does not fit. Check both answers that cross there, or tap Clear it to take it out.` };
    }
    const slot = pickSlot(P);
    if (!slot) return null;
    const ex = explain(P, slot);
    return { stage: 'look', slot, ex, text: ex.look };
  }
  function askHint() {
    const h = makeHint();
    if (!h) { say('Nothing left to hint.'); return; }
    S.P.hints += 1; S.hint = h; sfx.hint(); S.menu = null;
    if (h.slot) goSlot(h.slot.id); else S.sel = h.cell;
  }
  function slotDoneFx(ids) {
    const P = S.P;
    for (const id of ids) {
      const slot = P.pz.slots[id];
      slot.cells.forEach((c, k) => { S.fx.wave[c] = -k * 0.05; });
      S.cellFlash.push({ cells: slot.cells, t: 0 });
      const mid = cellCenter(slot.cells[Math.floor(slot.cells.length / 2)]); spark(mid.x, mid.y, 12, '#ffd45a');
    }
    if (ids.length) sfx.word();
  }
  function checkFinished() { if (!S.P.done && solved(S.P)) win(); }
  function hintGo() {
    const h = S.hint, P = S.P;
    if (!h) return;
    if (h.stage === 'look') { h.stage = 'explain'; h.text = h.ex.why; sfx.tap(); return; }
    if (h.stage === 'mistake') { erase(P, h.cell); S.hint = null; S.sel = h.cell; sfx.erase(); refreshDone(P); persistSession(); return; }
    const slot = h.slot, cells = reveal(P, slot.cells, false);
    cells.forEach((c, k) => { S.fx.pop[c] = -k * 0.06; });
    S.hint = null; sfx.letter('A');
    if (slotCorrect(P, slot)) slotDoneFx([slot.id]);
    S.sel = slot.cells[slot.cells.length - 1]; advanceFrom(slot, true);
    persistSession(); checkFinished();
  }

  // ---- typing -----------------------------------------------------------------------------------------------------------------------------
  // After a letter: move to the next square of the answer (skipping filled squares when asked); at the end, on to the next clue that has room.
  function advanceFrom(slot, forceNext = false) {
    const P = S.P, cells = slot.cells, i = cells.indexOf(S.sel);
    let next = -1;
    for (let k = i + 1; k < cells.length; k++) { if (!S.prefs.skip || !P.v[cells[k]]) { next = cells[k]; break; } }
    if (next < 0 && S.prefs.skip) { for (let k = 0; k < cells.length; k++) if (!P.v[cells[k]]) { next = cells[k]; break; } }
    if (next >= 0) { S.sel = next; return; }
    if ((S.prefs.next || forceNext) && cells.every((c) => P.v[c])) {
      const pz = P.pz; let id = slot.id;
      for (let k = 0; k < pz.slots.length; k++) { id = stepSlot(pz, id, 1); if (pz.slots[id].cells.some((c) => !P.v[c])) { goSlot(id); return; } }
    }
  }
  function typeLetter(ch) {
    const P = S.P;
    if (S.sel < 0 || P.done) return;
    const slot = curSlot();
    if (P.rev[S.sel]) { if (slot) advanceFrom(slot); return; }
    S.hint = null; S.menu = null;
    const r = put(P, S.sel, ch, { pencil: S.pencilMode });
    if (!r.ok) return;
    S.fx.pop[S.sel] = 0;
    if (r.kind === 'pencil') sfx.pencil(); else { sfx.letter(ch); if (r.bad && S.prefs.check === 'type') { S.fx.shake[S.sel] = 0; sfx.err(); } }
    slotDoneFx(r.done);
    if (slot) advanceFrom(slot);
    keepListVisible(); persistSession(); checkFinished();
  }
  function backspace() {
    const P = S.P;
    if (S.sel < 0 || P.done) return;
    S.hint = null; S.menu = null;
    if (P.v[S.sel] && !P.rev[S.sel]) { erase(P, S.sel); sfx.erase(); refreshDone(P); persistSession(); return; }
    const slot = curSlot();
    if (!slot) return;
    const i = slot.cells.indexOf(S.sel);
    if (i > 0) { S.sel = slot.cells[i - 1]; if (P.v[S.sel] && !P.rev[S.sel]) { erase(P, S.sel); sfx.erase(); refreshDone(P); persistSession(); } }
  }
  function arrow(dr, dc) {
    if (S.sel < 0) return;
    const pz = S.P.pz, nd = dr !== 0 ? DOWN : ACROSS;
    if (nd !== S.dir && hasSlot(S.sel, nd)) { S.dir = nd; return; }
    const c = moveCell(pz, S.sel, dr, dc);
    if (c !== S.sel) { S.sel = c; if (!hasSlot(c, S.dir)) S.dir = 1 - S.dir; keepListVisible(); }
  }
  const cellsFor = (kind) => {
    const P = S.P;
    if (kind === 0) return S.sel >= 0 ? [S.sel] : [];
    if (kind === 1) { const sl = curSlot(); return sl ? sl.cells : []; }
    return P.pz.sol.map((ch, i) => (ch ? i : -1)).filter((i) => i >= 0);
  };
  function doCheck(kind) {
    const bad = check(S.P, cellsFor(kind));
    S.menu = null;
    say(bad ? `${bad} wrong letter${bad === 1 ? '' : 's'} marked in red.` : 'Everything checked so far is right.', 2.4);
    if (bad) sfx.err(); else sfx.hint();
  }
  function doReveal(kind) {
    const P = S.P, cells = reveal(P, cellsFor(kind));
    S.menu = null;
    if (!cells.length) { say('Nothing to reveal there.', 1.6); return; }
    cells.forEach((c, k) => { S.fx.pop[c] = -k * 0.04; });
    sfx.hint(); S.hint = null;
    slotDoneFx(P.pz.slots.filter((sl) => P.sdone[sl.id] && sl.cells.some((c) => cells.includes(c))).map((sl) => sl.id));
    persistSession(); checkFinished();
  }
  function doUndo() { if (undo(S.P)) { S.hint = null; sfx.erase(); persistSession(); } else say('Nothing to undo.', 1.4); }
  function doRedo() { if (redo(S.P)) { S.hint = null; sfx.erase(); persistSession(); } else say('Nothing to redo.', 1.4); }

  // ---- winning ----------------------------------------------------------------------------------------------------------------------------
  function win() {
    const P = S.P, pz = P.pz;
    P.done = true; S.hint = null; S.menu = null; S.winT = 3.2; S.winDelay = 1.7;
    for (let i = 0; i < pz.n * pz.n; i++) S.fx.wave[i] = -((i % pz.n) + Math.floor(i / pz.n)) * 0.05;
    const b = L().board; spark(b.x + b.size / 2, b.y + b.size / 2, 60, '#ffd45a'); sfx.win();
    if (S.auto.on) { S.auto.done = true; S.auto.phase = null; say('Solved. That is every answer.', 4); return; }
    const level = P.level, first = !S.stats.best[level] || P.t < S.stats.best[level];
    S.stats.solved[level] += 1;
    if (P.t > 0 && first) S.stats.best[level] = Math.max(1, Math.round(P.t));
    let streak = S.streak;
    if (P.kind === 'daily' && P.day === S.daily.day && !S.stats.days.includes(P.day)) { S.stats.days.push(P.day); S.stats.days = S.stats.days.slice(-200); refreshDaily(); streak = S.streak; S.stats.bestStreak = Math.max(S.stats.bestStreak, streak); }
    saveStats(); clearSave();
    if (P.kind === 'daily' && P.day === S.daily.day) storage.set('daily', { day: P.day, streak });
    monetization.track('puzzle_solved', { level, kind: P.kind, t: Math.round(P.t) });
    const longest = pz.slots.slice().sort((a, b2) => b2.len - a.len || a.id - b2.id).slice(0, 6).map((sl) => ({ word: sl.word, clue: sl.clue }));
    S.result = { stars: starsFor(P), time: P.t, par: GRADES[level].par, errs: P.errs, help: P.hints + P.reveals, longest, newBest: first, daily: P.kind === 'daily', streak, level };
  }

  // ---- Watch and Learn -------------------------------------------------------------------------------------------------------------------------
  const wordCount = (t) => t.split(' ').length;
  function autoTick(dt) {
    const a = S.auto, P = S.P;
    if (a.paused || a.done) return;
    if (a.phase === 'gap') { a.timer -= dt; if (a.timer <= 0) a.phase = null; return; }
    if (a.phase === 'think') {
      a.timer -= dt;
      if (a.timer > 0) return;
      a.phase = 'reveal'; a.timer = clamp(2 + wordCount(a.ex.why + ' ' + a.ex.reveal) * 0.12, 2.4, 8);
      return;
    }
    if (a.phase === 'reveal') {
      a.timer -= dt;
      if (a.timer > 0) return;
      a.phase = 'write'; a.cells = a.slot.cells.filter((c) => P.v[c] !== P.pz.sol[c]); a.i = 0; a.timer = 0;
      return;
    }
    if (a.phase === 'write') {
      a.timer -= dt;
      if (a.timer > 0) return;
      if (a.i < a.cells.length) {
        const c = a.cells[a.i]; a.i += 1; S.sel = c;
        const r = put(P, c, P.pz.sol[c]); S.fx.pop[c] = 0; sfx.write(P.pz.sol[c]);
        if (r.ok) slotDoneFx(r.done);
        a.timer = TYPE_GAP;
        if (solved(P)) win();
      } else { a.phase = 'gap'; a.timer = AUTO_GAP; }
      return;
    }
    const slot = pickSlot(P);
    if (!slot) { a.done = true; if (solved(P)) win(); return; }
    a.slot = slot; a.ex = explain(P, slot); a.n += 1; a.phase = 'think';
    const known = slot.cells.filter((c) => P.v[c] === P.pz.sol[c]).length, trivial = known / slot.len >= 0.6 || slot.len <= 3;
    const base = THINK_STEPS[S.prefs.thinkIdx];
    a.timer = trivial ? Math.max(0.9, base * 0.3) : base;
    goSlot(slot.id);
  }

  // ---- input -------------------------------------------------------------------------------------------------------------------------------------
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
  // drag-scroll for a clue list; returns a tap if the press was a tap
  function listTap(p, area, geo, getY, setY) {
    const max = Math.max(0, geo.total - area.h + 6);
    if (p.pressed) lgesture = { x0: p.x, y0: p.y, s0: getY(), moved: false, inBody: inRect(area, p.x, p.y) };
    let tap = null;
    if (lgesture) {
      if (p.down && lgesture.inBody) {
        const dy = p.y - lgesture.y0;
        if (Math.abs(dy) > 12) lgesture.moved = true;
        if (lgesture.moved) setY(clamp(lgesture.s0 - dy, 0, max));
      }
      if (p.released || !p.down) { if (!lgesture.moved && lgesture.inBody) tap = { x: lgesture.x0, y: lgesture.y0 }; lgesture = null; }
    }
    return tap;
  }
  const pickRow = (geo, area, y, scroll) => { const ry = y - area.y + scroll; return geo.rows.find((r) => r.k === 'clue' && ry >= r.y && ry < r.y + r.h); };
  function openClues() {
    go('clues');
    const area = cluesArea(meta.width, meta.height), geo = listGeo(area, S.P.pz, listFs()), id = slotOf(S.P.pz, S.sel, S.dir);
    const row = geo.rows.find((r) => r.k === 'clue' && r.id === id);
    S.scrollY = row ? clamp(row.y - area.h / 3, 0, Math.max(0, geo.total - area.h + 6)) : 0;
  }

  function updatePlay(dt, p, input) {
    const P = S.P, l = L();
    if (!S.paused && !P.done && !S.auto.on && S.winT <= 0) { P.t += dt; S.saveAcc += dt; if (S.saveAcc > 6) { S.saveAcc = 0; persistSession(); } }
    if (S.auto.on && !S.auto.paused && !S.paused) autoTick(dt);
    if (S.winDelay > 0) { S.winDelay -= dt; if (S.winDelay <= 0 && S.result) go('over'); }
    // keyboard
    const k = input.keys.pressed;
    if (!S.auto.on && !S.paused && !P.done && S.scene === 'play') {
      for (const code of k) { const ch = KEY_LETTER(code); if (ch) typeLetter(ch); }
      if (k.has('Backspace') || k.has('Delete')) backspace();
      if (k.has('ArrowLeft')) arrow(0, -1); if (k.has('ArrowRight')) arrow(0, 1); if (k.has('ArrowUp')) arrow(-1, 0); if (k.has('ArrowDown')) arrow(1, 0);
      if (k.has('Tab')) stepClue(input.keys.down.has('ShiftLeft') || input.keys.down.has('ShiftRight') ? -1 : 1);
      if (k.has('Space')) toggleDir();
      if (k.has('Enter')) { if (S.hint) hintGo(); else askHint(); }
    }
    if (k.has('Escape')) { if (S.menu) S.menu = null; else if (S.auto.on) S.auto.paused = !S.auto.paused; else if (!P.done) { S.paused = !S.paused; if (S.paused) persistSession(); } }
    if (S.scene !== 'play') return;
    // the embedded list takes wheel, drags and taps first
    if (l.list) {
      const area = listArea(l), geo = listGeo(area, P.pz, listFs());
      if (wheelInput.dy && inRect(area, input.pointer.x, input.pointer.y)) { S.listY = clamp(S.listY + wheelInput.dy, 0, Math.max(0, geo.total - area.h + 6)); wheelInput.dy = 0; }
      if (!S.paused && !S.menu && !S.hint && !S.auto.on) {
        const lt = listTap(p, area, geo, () => S.listY, (y) => { S.listY = y; });
        if (lt) { const row = pickRow(geo, area, lt.y, S.listY); if (row) { goSlot(row.id); sfx.tap(); } return; }
        if (lgesture && lgesture.inBody) return;
      }
    }
    // zoomed grid: camera follows the selection, a drag pans, a tap (press and release without moving) selects
    let tap = p.pressed ? { x: p.x, y: p.y } : null;
    if (l.zoomOn) {
      const g = l.fit, { hs } = zoomSpan(g), n = g.n, T = S.camT;
      if (!S.camWas) { S.camWas = true; S.camSel = -2; }
      if (S.sel !== S.camSel) {
        S.camSel = S.sel;
        if (S.sel >= 0) {
          const sl = curSlot(), cs = sl ? sl.cells : [S.sel];
          const cols = cs.map((c) => (c % n) + 0.5), rows = cs.map((c) => Math.floor(c / n) + 0.5);
          const fit = (lo, hi, t, sc) => { const m = hs - 0.7; if (hi - lo <= 2 * m) { if (lo < t - m) return lo + m; if (hi > t + m) return hi - m; return t; } const k = hs - 1.4; return clamp(t, sc - k, sc + k); };
          T.x = fit(Math.min(...cols), Math.max(...cols), T.x, (S.sel % n) + 0.5); T.y = fit(Math.min(...rows), Math.max(...rows), T.y, Math.floor(S.sel / n) + 0.5);
        }
      }
      T.x = clamp(T.x, hs, n - hs); T.y = clamp(T.y, hs, n - hs);
      const k = Math.min(1, dt * 12); S.cam.x += (T.x - S.cam.x) * k; S.cam.y += (T.y - S.cam.y) * k;
      const canDrag = !S.paused && !S.menu && !S.hint && !S.auto.on && !P.done;
      if (canDrag && p.pressed && inRect(l.board.view, p.x, p.y) && !(l.chip && inRect(l.chip, p.x, p.y))) { S.drag = { x0: p.x, y0: p.y, cx: S.cam.x, cy: S.cam.y, moved: false }; tap = null; }
      if (S.drag) {
        tap = null;
        if (p.down) { const dx = p.x - S.drag.x0, dy = p.y - S.drag.y0; if (Math.abs(dx) + Math.abs(dy) > 16) S.drag.moved = true; if (S.drag.moved) { S.cam.x = clamp(S.drag.cx - dx / l.board.s, hs, n - hs); S.cam.y = clamp(S.drag.cy - dy / l.board.s, hs, n - hs); T.x = S.cam.x; T.y = S.cam.y; } }
        if (p.released || !p.down) { if (!S.drag.moved) tap = { x: S.drag.x0, y: S.drag.y0 }; S.drag = null; }
      }
    } else S.camWas = false;
    if (!tap) return;
    if (l.chip && inRect(l.chip, tap.x, tap.y) && !S.paused && !S.menu) { S.zoomUser = !l.zoomOn; S.camWas = false; if (S.zoomUser && S.sel >= 0) { const n = S.P.pz.n; S.cam = { x: (S.sel % n) + 0.5, y: Math.floor(S.sel / n) + 0.5 }; S.camT = { ...S.cam }; } flash('zoom'); sfx.tap(); return; }
    if (S.paused) {
      const pl = pauseLayout(meta.width, meta.height, l.board);
      if (hitBtn('resume', pl.resume, tap)) S.paused = false;
      else if (hitBtn('restart', pl.restart, tap)) { const id = P.id.split(':').map(Number); begin(session(id[0], id[1], id[2] === 1, { kind: P.kind, day: P.day })); persistSession(); }
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
    if (S.menu) {
      const pl = popLayout(l, l.tools[S.menu], 3);
      for (let i = 0; i < 3; i++) if (hitBtn('pop' + i, pl.items[i], tap)) { if (S.menu === 'check') doCheck(i); else doReveal(i); return; }
      S.menu = null; return;
    }
    if (hitBtn('pause', l.pause, tap)) { S.paused = true; persistSession(); return; }
    const i = l.board.at(tap.x, tap.y);
    if (i >= 0) { selectCell(i); sfx.tap(); S.hint = null; return; }
    if (S.hint) {
      if (hitBtn('close', l.coachBtns.close, tap)) S.hint = null;
      else if (hitBtn('go', l.coachBtns.go, tap)) hintGo();
      return;
    }
    if (hitBtn('cprev', l.clueNav.prev, tap)) { stepClue(-1); return; }
    if (hitBtn('cnext', l.clueNav.next, tap)) { stepClue(1); return; }
    if (l.clueCross && inRect(l.clueCross, tap.x, tap.y)) { toggleDir(); sfx.tap(); return; }
    if (inRect(l.clueText, tap.x, tap.y)) { if (!l.list) openClues(); else { toggleDir(); sfx.tap(); } return; }
    for (const ch of Object.keys(l.keys)) if (hitBtn('k' + ch, l.keys[ch], tap)) { if (ch === 'DEL') backspace(); else typeLetter(ch); return; }
    const T = l.tools;
    if (hitBtn('undo', T.undo, tap)) doUndo();
    else if (hitBtn('redo', T.redo, tap)) doRedo();
    else if (hitBtn('pencil', T.pencil, tap)) { S.pencilMode = !S.pencilMode; sfx.tap(); }
    else if (hitBtn('check', T.check, tap)) { S.menu = 'check'; sfx.tap(); }
    else if (hitBtn('reveal', T.reveal, tap)) { S.menu = 'reveal'; sfx.tap(); }
    else if (hitBtn('hint', T.hint, tap)) askHint();
    else if (T.list && hitBtn('list', T.list, tap)) openClues();
  }

  function changeSetting(i, k) {
    const id = SETTINGS[i].id, p = S.prefs;
    switch (id) {
      case 'look': p.look = LOOK_IDS[k]; setLook(p.look); break;
      case 'check': p.check = k === 1 ? 'type' : 'off'; break;
      case 'skip': p.skip = k === 0; break;
      case 'next': p.next = k === 0; break;
      case 'hilite': p.hilite = k === 0; break;
      case 'timer': p.timer = k === 0; break;
      case 'sound': p.sound = k === 0; audio.setMuted?.(!p.sound); break;
      case 'calm': p.calm = k === 1; break;
      case 'restore': monetization.restore().then(() => say('Purchases restored.', 2)).catch(() => {}); return;
      default: break;
    }
    savePrefs(); sfx.tap();
  }
  function textScale(dir) { const nn = clamp(S.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (nn !== S.prefs.textIdx) { S.prefs.textIdx = nn; S.scrollY = 0; savePrefs(); } }

  function updateScene(dt, input) {
    const p = input.pointer, sc = S.scene, w = meta.width, h = meta.height;
    if (sc === 'play') return updatePlay(dt, p, input);
    if (sc === 'clues') {
      const area = cluesArea(w, h), geo = listGeo(area, S.P.pz, listFs()), max = Math.max(0, geo.total - area.h + 6);
      if (wheelInput.dy) { S.scrollY = clamp(S.scrollY + wheelInput.dy, 0, max); wheelInput.dy = 0; }
      const back = (() => { const f = pageLayout(w, h, { footer: 1 }).footer; return { x: f.x + f.w / 2 - 160, y: f.y, w: 320, h: f.h }; })();
      const leave = () => { go('play'); S.sceneT = 1; };
      if (input.keys.pressed.has('Escape')) { leave(); return; }
      if (p.pressed && inRect(back, p.x, p.y)) { flash('back'); leave(); return; }
      const lt = listTap(p, area, geo, () => S.scrollY, (y) => { S.scrollY = y; });
      if (lt) { const row = pickRow(geo, area, lt.y, S.scrollY); if (row) { goSlot(row.id); sfx.tap(); leave(); } }
      return;
    }
    const scrolling = ['new', 'doc', 'settings', 'stats', 'over'].includes(sc);
    const tap = getTap(p, scrolling ? metrics.rect : null);
    if (scrolling) {
      if (wheelInput.dy) { S.scrollY = clamp(S.scrollY + wheelInput.dy, 0, metrics.max); wheelInput.dy = 0; }
      const k = input.keys.pressed;
      if (k.has('ArrowDown')) S.scrollY = clamp(S.scrollY + 80, 0, metrics.max);
      if (k.has('ArrowUp')) S.scrollY = clamp(S.scrollY - 80, 0, metrics.max);
      S.scrollY = clamp(S.scrollY, 0, metrics.max);
    }
    if (sc === 'title') {
      if (!tap) { if (input.keys.pressed.has('Enter') || input.keys.pressed.has('Space')) startPuzzle(S.prefs.grade); return; }
      const T0 = titleLayout(w, h, !!S.saved), B = T0.buttons;
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
      if (Math.abs(tap.x - T0.brand.x) < 260 && Math.abs(tap.y - T0.brand.y) < 26) env.openArcforgeHome?.();
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
      const DL = docLayout(w, h), nn = DOCS[S.doc.kind].pages.length;
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (input.keys.pressed.has('ArrowRight') && S.doc.page < nn - 1) { S.doc.page += 1; S.scrollY = 0; }
      if (input.keys.pressed.has('ArrowLeft') && S.doc.page > 0) { S.doc.page -= 1; S.scrollY = 0; }
      if (!tap) return;
      if (hitBtn('back', DL.menu, tap)) go('title');
      else if (hitBtn('prev', DL.prev, tap) && S.doc.page > 0) { S.doc.page -= 1; S.scrollY = 0; }
      else if (hitBtn('next', DL.next, tap) && S.doc.page < nn - 1) { S.doc.page += 1; S.scrollY = 0; }
      else if (hitBtn('tdec', DL.textDec, tap)) textScale(-1);
      else if (hitBtn('tinc', DL.textInc, tap)) textScale(1);
      return;
    }
    if (sc === 'settings') {
      const SL = settingsLayout(w, h, TEXT_SCALES[S.prefs.textIdx], SETTINGS.length);
      const leave = () => { if (S.back === 'play' && S.P) { S.scene = 'play'; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
      if (input.keys.pressed.has('Escape')) { leave(); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) return leave();
      if (hitBtn('tdec', SL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', SL.textInc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) {
        const ty = tap.y + S.scrollY;
        SETTINGS.forEach((row, i) => {
          const g = SL.rows[i], nn = row.opts.length, cw = (g.ctrl.w - 8 * (nn - 1)) / nn;
          for (let k = 0; k < nn; k++) { const r = { x: g.ctrl.x + k * (cw + 8), y: g.ctrl.y, w: cw, h: g.ctrl.h }; if (inRect(r, tap.x, ty)) { flash('set' + i + '.' + k); changeSetting(i, k); } }
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
      const O = overLayout(w, h, TEXT_SCALES[S.prefs.textIdx], S.P ? S.P.pz.n : 9);
      if (!tap) return;
      const R0 = S.result;
      if (hitBtn('next', O.btns.next, tap)) { if (R0.daily) go('title'); else startPuzzle(R0.level); }
      else if (hitBtn('menu', O.btns.menu, tap)) { if (R0.daily) go('new'); else go('title'); }
      else if (hitBtn('share', O.btns.share, tap)) env.share(`Crossword Grid Clues ${R0.daily ? 'daily crossword' : GRADES[R0.level].name + ' crossword'}: solved in ${fmtTime(R0.time)}, ${R0.stars} star${R0.stars === 1 ? '' : 's'}${R0.daily ? '. Streak ' + R0.streak : ''}.`);
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
        const f = S.fx, N = f.pop.length;
        for (let i = 0; i < N; i++) { if (f.pop[i] < 90) f.pop[i] += dt; if (f.wave[i] < 90) { f.wave[i] += dt; if (f.wave[i] > 0.6) f.wave[i] = 99; } if (f.shake[i] < 90) { f.shake[i] += dt; if (f.shake[i] > 0.5) f.shake[i] = 99; } }
        for (const sp of S.sparks) { sp.t += dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 600 * dt; }
        S.sparks = S.sparks.filter((sp) => sp.t < sp.life);
        for (const cf of S.cellFlash) cf.t += dt;
        S.cellFlash = S.cellFlash.filter((cf) => cf.t < 0.9);
        if (S.winT > 0) S.winT -= dt;
        for (const q of S.sfx) q.t -= dt;
        const due = S.sfx.filter((q) => q.t <= 0); if (due.length) { S.sfx = S.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
      }
      // the kit's preview pill sits top centre; in landscape it moves into the panel header so it never covers the grid
      if (S.scene === 'play' && S.P) { const l = L(); meta.previewBadge = l.mode === 'portrait' ? { x: l.pause.x - 12, y: l.pause.y - 2, align: 'right' } : { x: l.badgeAt.x, y: l.badgeAt.y, align: 'right' }; } else meta.previewBadge = null;
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
      progress: (frac) => { const P = S.P, cells = P.pz.sol.map((c, i) => (c ? i : -1)).filter((i) => i >= 0), k = Math.floor(cells.length * frac); for (let j = 0; j < k; j++) { const i = cells[(j * 7) % cells.length]; if (!P.v[i]) P.v[i] = P.pz.sol[i]; } refreshDone(P); },
      select: (i) => { S.sel = i; }, doc: (kind, page = 0) => { S.doc = { kind, page }; go('doc'); },
      layout: () => { const l = L(); return { mode: l.mode, keys: l.keys, tools: l.tools, cells: l.board.cells, w: meta.width, h: meta.height, list: l.list, zoom: l.zoomOn, chip: l.chip, cam: l.board.cam, hs: l.board.hs }; },
      solveNow: () => { const P = S.P; P.v = P.pz.sol.slice(); win(); }, skipOver: () => { S.winDelay = 0.01; },
    },
  };
}
