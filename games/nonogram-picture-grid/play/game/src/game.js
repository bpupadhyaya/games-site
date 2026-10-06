// GAME CONTRACT (docs/GAME-CONTRACT.md). Nonogram: 121 verified pictures, a line-logic solver behind Think and Watch & Learn, a Learn path.
import { hintWhy, SCREEN, inRect, hudOf, playLayout, autoLayout, boardGeo, cellAt, panTo, setView, fitMin, host, docRects } from './layout.js';
import { TEXT_SCALES, hitDoc, clampScroll } from './ui.js';
import { buildUi, THINK_STEPS, demoOver, DEMO_PUZZLES, chapterStats } from './screens.js';
import { CHAPTERS, CHAPTER_PUZZLES, ALL_BANK, puzzleById, chapterOf, TOTAL } from './chapters.js';
import { LESSONS } from './lessons.js';
import { THEMES, themeById } from './art.js';
import { PAL } from './palette.js';
import { RULE_COUNT, HOWTO_COUNT, tr, setLang, nameOf } from './content.js';
import { explainStep, explainBad } from './explain.js';
import { FILLED, CROSSED, UNKNOWN, nextStep, applyStep, isSolved, lineDone } from './solver.js';
import { newBoard, refresh, encode, decode, commit, undo, redo, strokeValue, wrongMark, TOOL_FILL, TOOL_CROSS, TOOL_MOVE } from './board.js';
import { render } from './view.js';

// The kit's fluid viewport (1.7): the short side is always 720 units, the long side follows the screen. meta.width/height are live.
export const meta = { width: SCREEN.width, height: SCREEN.height, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };   // main.js adds the mouse wheel (virtual units) here

const VERSION = '1.1.0';
const WIN_NOTES = [523, 659, 784, 1047, 1319, 1568];
const AUTO_PUZZLES = ['leaf', 'teapot', 'fuji'];
const ATTRACT_PUZZLE = 'cottage';
const STRAY_PX = 230;

export async function createGame(env) {
  const { rng, storage, audio, config } = env;

  const S = {
    scene: 'title', overlay: null, t: 0, ovT: 0, sound: true, themeId: 'paper', textIdx: 0, thinkIdx: 1, check: false, lang: 'en',
    results: {}, saves: {}, openIds: {}, lastId: null, lessons: {}, daily: { streak: 0, last: -1 }, demoIds: [], demoCount: 0,
    page: { howto: 0, rules: 0 }, scroll: {}, scrollVel: {}, press: null, match: null, auto: null, chapterIdx: 0, lessonIdx: 0, endInfo: null,
    demo: Boolean(config?.demo), dev: Boolean(config?.dev), owns: false, price: '', resetArm: false, version: VERSION, shot: false, lastPtr: { x: 0, y: 0 },
    cont: null, dailyDone: false, dailyPuz: null, attract: null, kbd: false, jump: null, sizeKey: '',
  };

  const [set, res, openIds, last, les, daily, dem] = await Promise.all([
    storage.get('ng.settings', null), storage.get('ng.res', null), storage.get('ng.open', null), storage.get('ng.last', null),
    storage.get('ng.lessons', null), storage.get('ng.daily', null), storage.get('ng.demo', null),
  ]);
  if (set) {
    if (typeof set.sound === 'boolean') S.sound = set.sound;
    if (typeof set.check === 'boolean') S.check = set.check;
    if (THEMES.some((t) => t.id === set.themeId)) S.themeId = set.themeId;
    if (set.lang === 'ja' || set.lang === 'en') S.lang = set.lang;
    if (Number.isInteger(set.textIdx)) S.textIdx = Math.min(Math.max(set.textIdx, 0), TEXT_SCALES.length - 1);
    if (Number.isInteger(set.thinkIdx)) S.thinkIdx = Math.min(Math.max(set.thinkIdx, 0), THINK_STEPS.length - 1);
  }
  setLang(S.lang);
  if (res && typeof res === 'object') S.results = res;
  if (les && typeof les === 'object') S.lessons = les;
  if (daily && Number.isInteger(daily.streak) && Number.isInteger(daily.last)) S.daily = daily;
  if (Array.isArray(dem)) { S.demoIds = dem.filter((x) => typeof x === 'string'); S.demoCount = S.demoIds.length; }
  if (typeof last === 'string') S.lastId = last;
  if (openIds && typeof openIds === 'object') {
    for (const id of Object.keys(openIds)) {
      const sv = await storage.get(`ng.s.${id}`, null);
      const p = puzzleById(id);
      if (sv && p && decode(p, sv.c)) { S.saves[id] = sv; S.openIds[id] = 1; }
    }
  }
  audio.setMuted(!S.sound);
  const refreshOwns = () => { S.owns = Boolean(env.monetization?.owns?.('unlock_game')); S.price = env.monetization?.priceOf?.('unlock_game') ?? ''; };
  refreshOwns();
  env.monetization?.onChange?.(refreshOwns);

  const today = () => Number.isInteger(config?.day) ? config.day : 0;
  const dailyPuzzle = (day) => {
    const pool = ALL_BANK.filter((p) => p.w >= 10);
    return pool[(Math.imul(day, 2654435761) >>> 0) % pool.length];
  };
  const refreshMeta = () => {
    S.dailyPuz = dailyPuzzle(today());
    S.dailyDone = S.daily.last === today();
    const sv = S.lastId && S.saves[S.lastId] ? S.lastId : Object.keys(S.saves)[0];
    if (sv) {
      const p = puzzleById(sv), cells = decode(p, S.saves[sv].c);
      let n = 0; for (let i = 0; i < cells.length; i++) if (cells[i] === FILLED && p.sol[i]) n++;
      S.cont = { id: sv, name: nameOf(p), pct: Math.min(99, Math.round((n / p.filled) * 100)) };
    } else S.cont = null;
  };
  const setAttract = () => {
    const puz = puzzleById(ATTRACT_PUZZLE);
    const st = new Uint8Array(puz.w * puz.h), seq = [];
    for (let n = 0; n < 60; n++) { const s = nextStep(puz, st); if (!s || s.bad) break; applyStep(st, s); for (const c of s.cells) if (c.v === FILLED) seq.push(c); }
    const done = (cells) => { const R = [], C = []; for (let r = 0; r < puz.h; r++) R.push(lineDone(puz, cells, 'row', r) ? 1 : 0); for (let c = 0; c < puz.w; c++) C.push(lineDone(puz, cells, 'col', c) ? 1 : 0); return [R, C]; };
    S.attract = { puz, seq, doneR: (cells) => done(cells)[0], doneC: (cells) => done(cells)[1] };
  };
  refreshMeta();
  setAttract();

  const saveSettings = () => storage.set('ng.settings', { sound: S.sound, themeId: S.themeId, textIdx: S.textIdx, thinkIdx: S.thinkIdx, check: S.check, lang: S.lang });
  const saveRes = () => { storage.set('ng.res', S.results); storage.set('ng.progress', { pictures: Object.values(S.results).filter((v) => v > 0).length, stars: Object.values(S.results).reduce((a, b) => a + b, 0) }); };

  // ------------------------------------------------------------------------------ sound
  const sfx = (o) => { if (S.sound) audio.tone(o); };
  const SOUNDS = {
    fill: (n) => sfx({ freq: 360 + Math.min(n, 12) * 22, to: 300 + Math.min(n, 12) * 18, dur: 0.07, type: 'triangle', vol: 0.13 }),
    cross: () => sfx({ freq: 300, to: 240, dur: 0.06, type: 'sine', vol: 0.08 }),
    clear: () => sfx({ freq: 330, to: 260, dur: 0.06, type: 'sine', vol: 0.07 }),
    line: () => { sfx({ freq: 784, dur: 0.14, type: 'sine', vol: 0.1 }); sfx({ freq: 1047, dur: 0.2, type: 'sine', vol: 0.07 }); },
    refuse: () => sfx({ freq: 170, to: 110, dur: 0.18, type: 'sawtooth', vol: 0.07 }),
    undo: () => sfx({ freq: 520, to: 330, dur: 0.1, type: 'triangle', vol: 0.1 }),
    hint: () => { sfx({ freq: 660, dur: 0.12, type: 'sine', vol: 0.1 }); sfx({ freq: 990, dur: 0.18, type: 'sine', vol: 0.06 }); },
    ui: () => sfx({ freq: 560, to: 700, dur: 0.05, type: 'sine', vol: 0.08 }),
  };

  // ------------------------------------------------------------------------------ matches
  const lay = () => playLayout(TEXT_SCALES[S.textIdx]);
  const geoOf = (M) => boardGeo(M.puz, (S.scene === 'auto' ? autoLayout(TEXT_SCALES[S.textIdx]) : lay()).area, TEXT_SCALES[S.textIdx], M.zoom, M.ox, M.oy);

  function makeMatch(puz, o = {}) {
    const M = {
      puz, b: newBoard(puz), tool: TOOL_FILL, zoom: 'fit', ox: 0, oy: 0, focus: null, hint: null, stroke: null, pan: null, pops: new Map(), flashes: new Map(), toast: null, toastT: 0,
      parts: [], reveal: null, canZoom: false, daily: Boolean(o.daily), lesson: o.lesson ?? null, lessonTask: o.lesson !== undefined && o.lesson !== null ? tr('lessonTask') : null, cur: { r: 0, c: 0 }, auto: Boolean(o.auto), hideName: false,
    };
    return M;
  }

  function launch(M, paused = false) {
    S.match = M; S.scene = M.auto ? 'auto' : 'play'; S.overlay = paused ? 'pause' : null; S.ovT = 0; S.press = null; S.endInfo = null;
    const g = geoOf(M);
    M.zoom = g.canZoom && g.fitS < fitMin() ? 'close' : 'fit';
    const g2 = geoOf(M);
    const pt = panTo(M.puz, g2, 0, 0); M.ox = pt.ox; M.oy = pt.oy;
  }

  function startPuzzle(puz, o = {}) {
    if (!puz) return;
    const saved = o.lesson !== undefined && o.lesson !== null ? null : S.saves[puz.id];
    const isLesson = o.lesson !== undefined && o.lesson !== null;
    if (S.demo && !isLesson && !S.demoIds.includes(puz.id)) {
      if (S.demoIds.length >= DEMO_PUZZLES) { S.scene = 'demo-limit'; S.overlay = null; return; }
      S.demoIds.push(puz.id); S.demoCount = S.demoIds.length; storage.set('ng.demo', S.demoIds);
    }
    const M = makeMatch(puz, o);
    let paused = false;
    if (saved && !o.fresh) {
      const cells = decode(puz, saved.c);
      if (cells) { M.b.cells = cells; M.b.hints = saved.h ?? 0; M.b.mistakes = saved.m ?? 0; refresh(puz, M.b); paused = true; }
    } else if (saved && o.fresh) { dropSave(puz.id); }
    if (!isLesson) { S.lastId = puz.id; storage.set('ng.last', puz.id); }
    launch(M, paused);
    refreshMeta();
  }

  function dropSave(id) {
    delete S.saves[id]; delete S.openIds[id];
    storage.remove(`ng.s.${id}`); storage.set('ng.open', S.openIds);
  }
  function saveMatch() {
    const M = S.match;
    if (!M || S.scene !== 'play' || M.lesson !== null && M.lesson !== undefined || M.reveal || M.auto) return;
    const id = M.puz.id;
    let any = false; for (const v of M.b.cells) if (v) { any = true; break; }
    if (!any) { if (S.saves[id]) dropSave(id); refreshMeta(); return; }
    S.saves[id] = { c: encode(M.b.cells), h: M.b.hints, m: M.b.mistakes };
    S.openIds[id] = 1;
    storage.set(`ng.s.${id}`, S.saves[id]); storage.set('ng.open', S.openIds);
    refreshMeta();
  }

  const toast = (msg) => { const M = S.match; if (M) { M.toast = msg; M.toastT = 2.2; } };

  // ------------------------------------------------------------------------------ strokes
  function startStroke(M, c, r) {
    const i = r * M.puz.w + c;
    const from = M.b.cells[i];
    const v = strokeValue(M.tool, from);
    M.stroke = { from, v, base: Uint8Array.from(M.b.cells), r0: r, c0: c, axis: null, tr: r, tc: c, stray: 0, flag: new Set(), px: S.lastPtr.x, py: S.lastPtr.y, ptr: null };
    M.hint = null; M.focus = { r, c };
    paintStroke(M, r, c);
  }
  // the stroke is the base board plus the mark on every square of the line from the start to (tr, tc) that began in the start state
  function paintStroke(M, tR, tC) {
    const st = M.stroke, w = M.puz.w;
    st.tr = tR; st.tc = tC;
    const cells = Uint8Array.from(st.base);
    const list = [];
    if (!st.axis) list.push(st.r0 * w + st.c0);
    else if (st.axis === 'row') { const a = Math.min(st.c0, tC), b = Math.max(st.c0, tC); for (let c = a; c <= b; c++) list.push(st.r0 * w + c); }
    else { const a = Math.min(st.r0, tR), b = Math.max(st.r0, tR); for (let r = a; r <= b; r++) list.push(r * w + st.c0); }
    for (const i of list) {
      if (st.base[i] !== st.from) continue;
      if (S.check && wrongMark(M.puz, i, st.v)) {
        if (!st.flag.has(i)) { st.flag.add(i); M.flashes.set(i, S.t); SOUNDS.refuse(); toast(tr('wrongMark')); }
        continue;
      }
      cells[i] = st.v;
      if (M.b.cells[i] !== st.v && st.v === FILLED) M.pops.set(i, S.t);
    }
    const before = M.b.cells;
    let changed = 0; for (let i = 0; i < cells.length; i++) if (cells[i] !== before[i]) changed++;
    M.b.cells = cells;
    if (changed) { if (st.v === FILLED) SOUNDS.fill(list.length); else if (st.v === CROSSED) SOUNDS.cross(); else SOUNDS.clear(); }
  }
  function endStroke(M) {
    const st = M.stroke;
    if (!st) return;
    M.stroke = null;
    const changes = [];
    let wrong = 0;
    for (let i = 0; i < st.base.length; i++) if (st.base[i] !== M.b.cells[i]) { changes.push([i, st.base[i], M.b.cells[i]]); if (!S.check && wrongMark(M.puz, i, M.b.cells[i])) wrong++; }
    wrong += st.flag.size;
    M.b.mistakes += wrong;
    if (!commit(M.puz, M.b, st.base, changes)) { if (st.flag.size) saveMatch(); return; }
    afterChange(M, st.base);
  }
  function afterChange(M, prev) {
    M.hint = null;
    let lines = 0;
    // a line completed by this move chimes once
    const n = M.puz.w * M.puz.h;
    for (let r = 0; r < M.puz.h; r++) if (M.b.doneR[r] && !prevDone(M, prev, 'row', r)) lines++;
    for (let c = 0; c < M.puz.w; c++) if (M.b.doneC[c] && !prevDone(M, prev, 'col', c)) lines++;
    if (lines) { SOUNDS.line(); { const a = lay().area; for (let k = 0; k < 6; k++) spark(M, a.x + a.w / 2 + rng.range(-200, 200) * Math.min(1, a.w / 672), a.y + a.h / 2 + rng.range(-120, 120), '#ffd877'); } }
    if (isSolved(M.puz, M.b.cells)) { finishPuzzle(M); return; }
    saveMatch();
  }
  const prevDone = (M, prev, axis, k) => {
    const tmp = { cells: prev };
    return lineDone(M.puz, prev, axis, k) && (axis === 'row' ? M.puz.rows[k].length : M.puz.cols[k].length) > 0;
  };

  function spark(M, x, y, color) {
    M.parts.push({ x, y, vx: rng.range(-140, 140), vy: rng.range(-220, -40), life: rng.range(0.5, 1), max: 1, size: rng.range(3, 7), color, shape: 'dot' });
  }

  function finishPuzzle(M) {
    M.reveal = { t: 0, note: 0 };
    M.hint = null; M.stroke = null; M.focus = null;
    const id = M.puz.id;
    if (M.lesson !== null && M.lesson !== undefined) {
      const l = LESSONS[M.lesson];
      if (!S.lessons[l.id]) { S.lessons[l.id] = true; storage.set('ng.lessons', S.lessons); }
      S.endInfo = { head: tr('lessonPass'), body: '', stars: 0, lesson: true, last: M.lesson + 1 >= LESSONS.length };
      return;
    }
    if (M.auto) return;
    let stars = 1;
    if (M.b.hints === 0) stars = 2;
    if (M.b.hints === 0 && M.b.mistakes === 0) stars = 3;
    const had = S.results[id] ?? 0;
    if (stars > had) { S.results[id] = stars; saveRes(); }
    if (M.daily) {
      if (S.daily.last !== today()) {
        S.daily = { streak: S.daily.last === today() - 1 ? S.daily.streak + 1 : 1, last: today() };
        storage.set('ng.daily', S.daily);
      }
    }
    if (S.saves[id]) dropSave(id);
    const lines = [tr('star1')]; if (stars >= 2) lines.push(tr('star2')); if (stars >= 3) lines.push(tr('star3'));
    const ci = chapterOf(id), list = CHAPTER_PUZZLES[ci] ?? [];
    const nextP = list[list.findIndex((p) => p.id === id) + 1] ?? null;
    S.endInfo = { head: tr('endHead'), body: `${nameOf(M.puz)}\n${tr('starLine', { n: stars })}  ·  ${lines.join(' · ')}`, stars, next: nextP && !M.daily ? nextP.id : null };
    refreshMeta();
  }

  // ------------------------------------------------------------------------------ hints
  function doThink() {
    const M = S.match;
    if (!M || M.reveal || M.auto) return;
    const st = nextStep(M.puz, M.b.cells);
    SOUNDS.hint();
    M.stroke = null;
    if (!st) { M.hint = { head: tr('hintNone'), why: '' }; return; }
    if (st.bad) { const e = explainBad(st.bad, M.puz); M.hint = { bad: st.bad, head: e.head, why: e.why }; M.b.hints += M.lesson === null || M.lesson === undefined ? 1 : 0; M.focus = null; return; }
    const e = explainStep(st);
    M.hint = { step: st, head: e.head, why: e.why };
    M.b.hints += M.lesson === null || M.lesson === undefined ? 1 : 0;
    const first = st.cells[0];
    M.focus = { r: Math.floor(first.at / M.puz.w), c: first.at % M.puz.w };
    if (M.zoom === 'close') { const g = geoOf(M); const p = panTo(M.puz, g, M.focus.c, M.focus.r); M.ox = p.ox; M.oy = p.oy; }
    saveMatch();
  }
  function applyHint() {
    const M = S.match;
    if (!M || !M.hint || !M.hint.step || M.reveal) return;
    const base = Uint8Array.from(M.b.cells), changes = [];
    for (const c of M.hint.step.cells) { M.b.cells[c.at] = c.v; if (c.v === FILLED) M.pops.set(c.at, S.t); changes.push([c.at, base[c.at], c.v]); }
    M.b.hints = M.b.hints; // already counted when shown
    commit(M.puz, M.b, base, changes);
    SOUNDS.fill(changes.length);
    afterChange(M, base);
  }

  // ------------------------------------------------------------------------------ Watch & Learn
  function startAutoPuzzle() {
    const a = S.auto;
    const puz = puzzleById(AUTO_PUZZLES[a.k]);
    const M = makeMatch(puz, { auto: true });
    M.zoom = 'fit';
    S.match = M;
    Object.assign(a, { phase: 'intro', t: 0, step: null, scan: null, note: { head: '', why: '' }, lines: [] });
    a.lines = [];
    for (let r = 0; r < puz.h; r++) a.lines.push({ axis: 'row', k: r });
    for (let c = 0; c < puz.w; c++) a.lines.push({ axis: 'col', k: c });
  }
  function startAuto() {
    S.auto = { k: 0, phase: 'intro', t: 0, paused: false, step: null, scan: null, note: { head: '', why: '' }, lines: [] };
    S.scene = 'auto'; S.overlay = null; S.press = null;
    startAutoPuzzle();
  }
  function planAuto() {
    const a = S.auto, M = S.match;
    const st = nextStep(M.puz, M.b.cells);
    a.step = st && !st.bad ? st : null;
    if (a.step) a.note = explainStep(a.step);
    // the line the solver settles on is where the scan ends
    a.target = a.step ? { axis: a.step.axis, k: a.step.k } : null;
  }
  function stepAutoMatch(dt) {
    const M = S.match;
    for (let i = M.parts.length - 1; i >= 0; i--) { const q = M.parts[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 360 * dt; if (q.life <= 0) M.parts.splice(i, 1); }
  }
  // THINK (configurable) -> REVEAL (2 s: the line and its squares light up, the reason is written) -> ACT (the marks go in)
  function updateAuto(dt) {
    const a = S.auto, M = S.match;
    if (a.paused) return;
    a.t += dt;
    if (M.reveal) {
      M.reveal.t += dt;
      stepReveal(M, dt);
      if (a.phase === 'celebrate' && a.t >= 4.2) {
        if (a.k + 1 < AUTO_PUZZLES.length) { a.k += 1; startAutoPuzzle(); } else { S.overlay = 'autosum'; S.ovT = 0; a.phase = 'summary'; }
      }
      return;
    }
    if (a.phase === 'intro') {
      if (a.t >= 1.4) { a.phase = 'think'; a.t = 0; planAuto(); }
    } else if (a.phase === 'think') {
      const idx = Math.floor(a.t / 0.2);
      const line = a.lines[idx % a.lines.length];
      a.scan = line;
      if (a.t >= THINK_STEPS[S.thinkIdx]) { a.phase = 'reveal'; a.t = 0; a.scan = a.target; SOUNDS.hint(); }
    } else if (a.phase === 'reveal') {
      if (a.t >= 2) {
        a.phase = 'act'; a.t = 0;
        if (a.step) { for (const c of a.step.cells) { M.b.cells[c.at] = c.v; if (c.v === FILLED) M.pops.set(c.at, S.t); } refresh(M.puz, M.b); SOUNDS.fill(a.step.cells.length); }
      }
    } else if (a.phase === 'act') {
      if (a.t >= 0.8) {
        if (isSolved(M.puz, M.b.cells) || !a.step) { M.reveal = { t: 0 }; a.phase = 'celebrate'; a.t = 0; M.revealNotes = 0; }
        else { a.phase = 'think'; a.t = 0; planAuto(); }
      }
    }
  }

  function stepReveal(M, dt) {
    const R = M.reveal;
    // arpeggio and sparkles as the colours arrive
    while (R.note === undefined ? false : (M.notes ?? 0) < WIN_NOTES.length && R.t >= 1.0 + (M.notes ?? 0) * 0.16) {
      sfx({ freq: WIN_NOTES[M.notes ?? 0], dur: 0.4, type: 'sine', vol: 0.15 }); sfx({ freq: WIN_NOTES[M.notes ?? 0] / 2, dur: 0.45, type: 'triangle', vol: 0.05 });
      M.notes = (M.notes ?? 0) + 1;
    }
    if (R.t > 1.2 && R.t < 2.6 && Math.floor(R.t * 30) !== Math.floor((R.t - dt) * 30)) {
      const rv = (S.scene === 'auto' ? autoLayout(TEXT_SCALES[S.textIdx]) : lay()).area;
      const colors = ['#ffd877', '#fff3c4', '#ff9d8f', '#9fd8ff'];
      for (let k = 0; k < 2; k++) M.parts.push({ x: rv.x + rng.range(0.11, 0.89) * rv.w, y: rv.y + rng.range(0.22, 0.65) * rv.h, vx: rng.range(-60, 60), vy: rng.range(-120, 20), life: rng.range(0.6, 1.2), max: 1.2, size: rng.range(3, 8), color: colors[rng.int(4)], shape: 'dot' });
    }
    for (let i = M.parts.length - 1; i >= 0; i--) { const q = M.parts[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 140 * dt; if (q.life <= 0) M.parts.splice(i, 1); }
  }

  // ------------------------------------------------------------------------------ store screenshots
  // `tools/arc shots` loads ?shot=1&seed=N. Seeds 900001.. stage real moments; 901001+ and 902001+ show Rules pages at 100 and 300 percent.
  function solveSome(M, n) {
    const st = M.b.cells;
    for (let i = 0; i < n; i++) { const s = nextStep(M.puz, st); if (!s || s.bad) break; applyStep(st, s); }
    refresh(M.puz, M.b);
  }
  function stagePlay(id, steps, o = {}) {
    const puz = puzzleById(id);
    const M = makeMatch(puz, o);
    S.match = M; S.scene = 'play'; S.overlay = null;
    solveSome(M, steps);
    const g0 = geoOf(M);
    M.zoom = o.zoom ?? (g0.canZoom && g0.fitS < Math.min(34, fitMin()) ? 'close' : 'fit');
    return M;
  }
  function stageShot(n) {
    S.shot = true;
    S.results = { heart: 3, apple: 2, pine: 3, cottage: 3, teacup: 1, sailboat: 2, butterfly5: 3, flower: 1, key: 3, star: 2, moon: 3, toadstool: 3, teapot: 3, lighthouse: 2, whale: 1, owl: 3, cactus: 3 };
    S.lessons = { clues: true, overlap: true };
    S.daily = { streak: 4, last: today() - 1 };
    refreshMeta();
    if (n === 1) { const M = stagePlay('lighthouse', 5); M.b.hints = 1; M.focus = { r: 2, c: 3 }; }
    else if (n === 2) { const M = stagePlay('fuji', 4); doThink(); S.t = 1; }
    else if (n === 3) { const M = stagePlay('cottage', 40); const rt = typeof location !== 'undefined' && /[?&]rt=([\d.]+)/.exec(location.search); M.reveal = { t: rt ? Number(rt[1]) : 1.7 }; M.notes = 9; }
    else if (n === 4) { const M = stagePlay('lantern', 50); M.reveal = { t: 3.2 }; M.notes = 9; }
    else if (n === 5) { const M = stagePlay('fujiblossom', 14); M.focus = { r: 9, c: 8 }; M.zoom = 'close'; const g = geoOf(M); const p = panTo(M.puz, g, 9, 9); M.ox = p.ox; M.oy = p.oy; }
    else if (n === 6) { S.thinkIdx = 0; startAuto(); S.auto.k = 1; startAutoPuzzle(); solveSome(S.match, 5); planAuto(); S.auto.phase = 'reveal'; S.auto.t = 1; S.auto.scan = S.auto.target; }
    else if (n === 7) { S.scene = 'chapters'; }
    else if (n === 8) { S.scene = 'pictures'; S.chapterIdx = 0; }
    else if (n === 9) { S.scene = 'title'; S.t = 2.6; }
    else if (n === 10) { S.scene = 'daily'; }
    else if (n === 11) { S.themeId = 'lacquer'; const M = stagePlay('tallship', 6); M.focus = { r: 4, c: 5 }; }
    else if (n === 12) { S.scene = 'learn'; }
    else if (n === 13) { S.lang = 'ja'; setLang('ja'); refreshMeta(); const M = stagePlay('fan', 4); M.focus = { r: 3, c: 4 }; }
    else if (n === 14) { S.themeId = 'slate'; const M = stagePlay('koi', 6); M.focus = { r: 5, c: 4 }; }
    else if (n === 15) { S.themeId = 'lacquer'; S.scene = 'title'; S.t = 1.6; }
    else if (n === 16) { S.themeId = 'slate'; S.scene = 'chapters'; }
    else if (n >= 17 && n <= 50) { // text-zoom and screen checks (QA only)
      S.textIdx = 4;
      if (n === 17) S.scene = 'title';
      else if (n === 18) S.scene = 'settings';
      else if (n === 19) S.scene = 'about';
      else if (n === 20) { stagePlay('lighthouse', 5); S.match.focus = { r: 2, c: 3 }; }
      else if (n === 21) { stagePlay('fuji', 4); doThink(); S.t = 1; }
      else if (n === 22) { stagePlay('cottage', 40); S.match.reveal = { t: 3.3 }; S.endInfo = { head: tr('endHead'), body: `${nameOf(S.match.puz)}\n${tr('starLine', { n: 3 })}`, stars: 3, next: 'pine' }; S.overlay = 'end'; S.ovT = 1; }
      else if (n === 23) { stagePlay('lighthouse', 5); S.overlay = 'pause'; S.ovT = 1; }
      else if (n === 24) { S.scene = 'chapters'; }
      else if (n === 25) { S.scene = 'pictures'; }
      else if (n === 26) { S.scene = 'learn'; }
      else if (n === 27) { S.scene = 'lesson'; S.lessonIdx = 1; }
      else if (n === 28) { S.scene = 'demo-limit'; }
      else if (n === 29) { S.scene = 'howto'; S.page.howto = 3; S.jump = { scene: 'howto', page: 3 }; }
      else if (n === 30) { S.thinkIdx = 0; startAuto(); S.auto.k = 1; startAutoPuzzle(); solveSome(S.match, 5); planAuto(); S.auto.phase = 'reveal'; S.auto.t = 1; S.auto.scan = S.auto.target; S.auto.paused = true; }
      else if (n === 31) { S.scene = 'daily'; }
      else if (n === 32) { stagePlay('fujiblossom', 14); S.match.zoom = 'close'; S.match.focus = { r: 9, c: 8 }; }
      else if (n === 33) { S.textIdx = 0; stagePlay('starfish', 6); S.match.tool = 'cross'; S.match.focus = { r: 4, c: 4 }; }
      else if (n === 34) { S.textIdx = 0; S.lang = 'ja'; setLang('ja'); S.scene = 'title'; }
      else if (n === 35) { S.textIdx = 0; S.lang = 'ja'; setLang('ja'); S.scene = 'pictures'; }
      else if (n === 36) { S.textIdx = 0; S.lang = 'ja'; setLang('ja'); stagePlay('fan', 4); doThink(); S.t = 1; }
      else if (n === 37) { S.textIdx = 2; stagePlay('starfish', 6); S.match.focus = { r: 4, c: 4 }; }
      else if (n === 38) { S.textIdx = 0; S.scene = 'settings'; }
      else if (n === 39) { S.textIdx = 0; S.scene = 'about'; }
      else if (n === 40) { S.textIdx = 0; stagePlay('whale', 0); }
      else if (n === 41) { S.textIdx = 0; const M = stagePlay('fuji', 4); M.hint = { head: '', why: '' }; doThink(); doThink(); S.t = 1.2; }
      else if (n === 44) { S.textIdx = 0; S.results = { fujiblossom: 3, whaletail: 2, tallship20: 3, lighthousestorm: 1, windmillvillage: 3, castlekingdom: 2 }; S.scene = 'pictures'; S.chapterIdx = 5; }
      else if (n === 45) { S.textIdx = 0; stagePlay('campnight', 12); S.match.focus = { r: 6, c: 7 }; }
      else if (n === 46) { S.textIdx = 0; stagePlay('bicycle', 8); S.match.focus = { r: 6, c: 5 }; }
      else if (n === 47) { S.textIdx = 0; stagePlay('moonowl', 16); S.match.focus = { r: 8, c: 9 }; }
      else if (n === 48) { S.textIdx = 0; stagePlay('cottage', 40); S.match.reveal = { t: 3.3 }; S.endInfo = { head: tr('endHead'), body: `${nameOf(S.match.puz)}\n${tr('starLine', { n: 3 })}`, stars: 3, next: 'pine' }; S.overlay = 'end'; S.ovT = 1; }
      else if (n === 49) { S.textIdx = 0; S.thinkIdx = 0; startAuto(); S.overlay = 'autosum'; S.ovT = 1; }
      else if (n === 50) { S.textIdx = 0; stagePlay('lighthouse', 5); S.match.hint = { head: 'Row 3', why: 'Block 7 fills the whole line.' }; doThink(); S.t = 1; }
      else if (n === 43) { stagePlay('fuji', 4); doThink(); S.t = 1; S.overlay = 'why'; S.ovT = 1; }
      else if (n === 42) { S.textIdx = 0; stagePlay('tulip', 3); S.overlay = 'pause'; S.ovT = 1; }
    } else if (n >= 1001 && n <= 1030) { S.scene = 'rules'; S.page.rules = n - 1001; S.jump = { scene: 'rules', page: n - 1001 }; }
    else if (n >= 2001 && n <= 2030) { S.scene = 'rules'; S.page.rules = n - 2001; S.textIdx = 4; S.jump = { scene: 'rules', page: n - 2001 }; }
    else if (n >= 3001 && n <= 3020) { S.scene = 'howto'; S.page.howto = n - 3001; S.jump = { scene: 'howto', page: n - 3001 }; }
  }
  const wantsShot = typeof location !== 'undefined' && /[?&]shot=1/.test(location.search);
  const sd = config?.seed ?? 0;
  const shotSeed = wantsShot && ((sd >= 900001 && sd <= 900050) || (sd >= 901001 && sd <= 901030) || (sd >= 902001 && sd <= 902030) || (sd >= 903001 && sd <= 903020)) ? sd - 900000 : 0;
  if (shotSeed) stageShot(shotSeed);

  // ------------------------------------------------------------------------------ ui plumbing
  const getScroll = (ui) => S.scroll[ui.scrollKey] ?? 0;
  const setScroll = (ui, v) => { if (ui.layout && ui.region) S.scroll[ui.scrollKey] = clampScroll(v, ui.layout.height, ui.region.h); };

  function gotoScene(scene) {
    S.scene = scene; S.overlay = null; S.press = null; S.resetArm = false; S.scrollVel = {};
    if (scene === 'howto') S.page.howto = 0;
    if (scene === 'rules') S.page.rules = 0;
    S.scroll[scene] = 0;
    if (scene === 'title') refreshMeta();
    SOUNDS.ui();
  }
  function setText(d) {
    const n = Math.min(Math.max(S.textIdx + d, 0), TEXT_SCALES.length - 1);
    if (n === S.textIdx) return;
    S.textIdx = n; saveSettings(); S.scroll = {};
    const M = S.match;
    if (M && (S.scene === 'play')) { const g = geoOf(M); const p = panTo(M.puz, g, M.focus ? M.focus.c : 0, M.focus ? M.focus.r : 0); M.ox = p.ox; M.oy = p.oy; }
  }
  function leaveToMenu() { endStroke0(); saveMatch(); S.match = null; S.auto = null; gotoScene('title'); }
  function endStroke0() { const M = S.match; if (M && M.stroke) endStroke(M); }
  function setLangTo(l) { S.lang = l; setLang(l); saveSettings(); S.scroll = {}; refreshMeta(); SOUNDS.ui(); }

  function toolAction(id) {
    const M = S.match;
    if (!M || M.reveal) return;
    endStroke0();
    if (id === 'fill' || id === 'cross' || id === 'move') { M.tool = id; M.hint = null; SOUNDS.ui(); }
    else if (id === 'zoom') {
      if (!M.canZoom) return;
      M.zoom = M.zoom === 'close' ? 'fit' : 'close';
      const g = geoOf(M); const p = panTo(M.puz, g, M.focus ? M.focus.c : 0, M.focus ? M.focus.r : 0); M.ox = M.zoom === 'fit' ? 0 : p.ox; M.oy = M.zoom === 'fit' ? 0 : p.oy;
      SOUNDS.ui();
    } else if (id === 'undo') { const ch = undo(M.puz, M.b); if (ch) { SOUNDS.undo(); M.hint = null; saveMatch(); } else toast(tr('nothingUndo')); }
    else if (id === 'redo') { const ch = redo(M.puz, M.b); if (ch) { SOUNDS.undo(); M.hint = null; if (isSolved(M.puz, M.b.cells)) finishPuzzle(M); else saveMatch(); } else toast(tr('nothingRedo')); }
    else if (id === 'think') doThink();
    else if (id === 'check') { S.check = !S.check; saveSettings(); toast(S.check ? tr('tipCheck') : tr('tipFill')); SOUNDS.ui(); }
  }

  function activate(id) {
    if (id == null) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    if (id === 'zoom-') { setText(-1); return; }
    if (id === 'zoom+') { setText(1); return; }
    if (id.startsWith('lang:')) { setLangTo(id.slice(5)); return; }
    if (id.startsWith('theme:')) { S.themeId = id.slice(6); saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('ch:')) { S.chapterIdx = Number(id.slice(3)); gotoScene('pictures'); return; }
    if (id.startsWith('pz:')) {
      const p = puzzleById(id.slice(3));
      if (S.demo && (chapterOf(p.id) !== 0 || CHAPTER_PUZZLES[0].indexOf(p) >= DEMO_PUZZLES)) { S.scene = 'demo-limit'; return; }
      SOUNDS.ui(); startPuzzle(p); return;
    }
    if (id.startsWith('les:') && id !== 'les:list' && id !== 'les:go') { const i = Number(id.slice(4)); if (S.demo && i >= 3) { S.scene = 'demo-limit'; return; } S.lessonIdx = i; gotoScene('lesson'); return; }
    switch (id) {
      case 'play': gotoScene('chapters'); return;
      case 'continue': if (S.cont) startPuzzle(puzzleById(S.cont.id)); return;
      case 'daily': gotoScene('daily'); return;
      case 'daily:play': startPuzzle(S.dailyPuz, { daily: true }); return;
      case 'learn': gotoScene('learn'); return;
      case 'les:list': gotoScene('learn'); return;
      case 'les:go': { const l = LESSONS[S.lessonIdx]; startPuzzle(puzzleById(l.puz), { lesson: S.lessonIdx, fresh: true }); return; }
      case 'auto': startAuto(); return;
      case 'howto': case 'rules': case 'about': case 'settings': gotoScene(id); return;
      case 'back': case 'menu': gotoScene(S.scene === 'pictures' ? 'chapters' : S.scene === 'lesson' ? 'learn' : 'title'); return;
      case 'prev': S.page[S.scene] = Math.max(0, S.page[S.scene] - 1); S.scroll = {}; SOUNDS.ui(); return;
      case 'next': {
        const total = S.scene === 'rules' ? RULE_COUNT : HOWTO_COUNT;
        if (S.scene === 'howto' && S.page.howto >= total - 1) { activate('play'); return; }
        S.page[S.scene] = Math.min(total - 1, S.page[S.scene] + 1); S.scroll = {}; SOUNDS.ui(); return;
      }
      case 'set:sound': S.sound = !S.sound; audio.setMuted(!S.sound); saveSettings(); if (S.sound) SOUNDS.ui(); return;
      case 'set:check': S.check = !S.check; saveSettings(); SOUNDS.ui(); return;
      case 'set:think-': S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); return;
      case 'set:think+': S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); return;
      case 'set:restore': Promise.resolve(env.monetization?.restore?.()).then(refreshOwns); return;
      case 'set:unlock': Promise.resolve(env.monetization?.purchase?.('unlock_game')).then(refreshOwns); return;
      case 'set:reset':
        if (!S.resetArm) { S.resetArm = true; return; }
        for (const k of Object.keys(S.saves)) dropSave(k);
        S.results = {}; S.lessons = {}; S.daily = { streak: 0, last: -1 }; S.lastId = null; S.demoIds = [];
        saveRes(); storage.set('ng.lessons', S.lessons); storage.set('ng.daily', S.daily); storage.set('ng.last', null); storage.set('ng.demo', []); S.resetArm = false; refreshMeta(); return;
      case 'ov:resume': S.overlay = null; return;
      case 'ov:hintdo': S.overlay = null; applyHint(); return;
      case 'ov:hintclose': S.overlay = null; return;
      case 'ov:restart': { S.overlay = null; const M = S.match; if (M) { if (M.lesson !== null && M.lesson !== undefined) startPuzzle(M.puz, { lesson: M.lesson, fresh: true }); else startPuzzle(M.puz, { fresh: true, daily: M.daily }); } return; }
      case 'ov:menu': S.overlay = null; leaveToMenu(); return;
      case 'ov:list': S.overlay = null; { const M = S.match; endStroke0(); saveMatch(); S.match = null; if (M) S.chapterIdx = Math.max(0, chapterOf(M.puz.id)); gotoScene('pictures'); } return;
      case 'ov:again': { S.overlay = null; const M = S.match; startPuzzle(M.puz, { fresh: true, daily: M.daily }); return; }
      case 'ov:nextpic': { S.overlay = null; const id = S.endInfo && S.endInfo.next; S.match = null; if (id) startPuzzle(puzzleById(id)); else gotoScene('pictures'); return; }
      case 'ov:lessons': S.overlay = null; S.match = null; gotoScene('learn'); return;
      case 'ov:lessonnext': { S.overlay = null; S.match = null; const n = S.lessonIdx + 1; if (n >= LESSONS.length) gotoScene('learn'); else { S.lessonIdx = n; gotoScene('lesson'); } return; }
      case 'ov:autoagain': S.overlay = null; startAuto(); return;
      case 'ov:autoexit': S.overlay = null; S.auto = null; S.match = null; gotoScene('title'); return;
      default:
    }
  }

  // ------------------------------------------------------------------------------ pointer handling
  function fixedHit(ui, x, y) {
    const list = [...ui.fixed];
    if (ui.nav) list.push(...[ui.nav.prev, ui.nav.next].filter(Boolean));
    for (const f of list) if (f.id != null && !f.disabled && inRect(x, y, f.rect)) return f;
    return null;
  }

  function onDown(x, y) {
    if (S.match) S.match.toast = null;
    if (S.scene === 'play' && !S.overlay && S.match) { playDown(x, y); return; }
    if (S.scene === 'auto' && !S.overlay) { autoDown(x, y); return; }
    const ui = buildUi(S);
    if (!ui.layout) return;
    const f = fixedHit(ui, x, y);
    if (f) { S.press = { id: f.id, active: true, kind: 'fixed', rect: f.rect }; return; }
    const reg = ui.region;
    if (ui.layout.height > reg.h && inRect(x, y, { x: reg.x + reg.w + 2, y: reg.y - 4, w: 30, h: reg.h + 8 })) {   // the scroll bar: drag it
      S.press = { id: null, active: false, kind: 'bar' };
      setScroll(ui, ((y - reg.y) / reg.h) * (ui.layout.height - reg.h));
      return;
    }
    if (inRect(x, y, { x: reg.x - 6, y: reg.y - 4, w: reg.w + 12, h: reg.h + 8 })) {
      const hit = hitDoc(ui.layout, x - reg.x, y - reg.y - (ui.offY || 0) + getScroll(ui));
      const ok = Boolean(hit && !hit.disabled);
      S.press = { id: ok ? hit.id : null, active: ok, kind: 'doc', x0: x, y0: y, scroll0: getScroll(ui), scrolling: false, lastY: y, vel: 0 };
      S.scrollVel = {};
    } else S.press = null;
  }

  function onMove(x, y, dt) {
    const pr = S.press;
    if (!pr) return;
    if (pr.kind === 'stroke') { strokeMove(x, y); return; }
    if (pr.kind === 'pan') {
      const M = S.match; if (!M) return;
      const g = geoOf(M);
      M.ox = Math.min(Math.max(0, pr.ox0 - (x - pr.x0)), g.maxX); M.oy = Math.min(Math.max(0, pr.oy0 - (y - pr.y0)), g.maxY);
      return;
    }
    if (pr.kind === 'bar') {
      const ui = buildUi(S);
      if (ui.layout && ui.region) setScroll(ui, ((y - ui.region.y) / ui.region.h) * (ui.layout.height - ui.region.h));
      return;
    }
    if (pr.kind === 'doc') {
      const ui = buildUi(S);
      if (!ui.layout || !ui.region) { S.press = null; return; }
      if (!pr.scrolling && Math.abs(y - pr.y0) > 10) { pr.scrolling = true; pr.active = false; }
      if (pr.scrolling) {
        setScroll(ui, pr.scroll0 - (y - pr.y0));
        pr.vel = pr.vel * 0.6 + (-(y - pr.lastY) / Math.max(dt, 1e-3)) * 0.4;
        pr.lastY = y;
      }
    } else if (pr.rect) pr.active = inRect(x, y, pr.rect);
  }

  function onUp(x, y) {
    const pr = S.press;
    S.press = null;
    if (!pr) return;
    if (pr.kind === 'stroke') { const M = S.match; if (M) endStroke(M); return; }
    if (pr.kind === 'pan' || pr.kind === 'bar') return;
    if (pr.kind === 'doc') {
      const ui = buildUi(S);
      if (!ui.layout || !ui.region) return;
      if (pr.scrolling) { S.scrollVel[ui.scrollKey] = pr.vel; return; }
      const hit = hitDoc(ui.layout, x - ui.region.x, y - ui.region.y - (ui.offY || 0) + getScroll(ui));
      if (hit && hit.id === pr.id && !hit.disabled) activate(hit.id);
    } else if (pr.kind === 'fixed') { if (inRect(x, y, pr.rect)) activate(pr.id); }
    else if (pr.kind === 'hud') { if (inRect(x, y, pr.rect)) hudAction(pr.id); }
    else if (pr.kind === 'auto') { if (inRect(x, y, pr.rect)) autoAction(pr.id); }
    else if (pr.kind === 'tool') { if (inRect(x, y, pr.rect)) toolAction(pr.id.slice(5)); }
  }

  // ---- play
  function playDown(x, y) {
    const M = S.match;
    const L = lay();
    const HD = hudOf(TEXT_SCALES[S.textIdx]);
    if (inRect(x, y, HD.back)) { S.press = { id: 'hud:back', active: true, kind: 'hud', rect: HD.back }; return; }
    if (M.reveal) return;
    if (inRect(x, y, HD.pause)) { S.press = { id: 'hud:pause', active: true, kind: 'hud', rect: HD.pause }; return; }
    if (M.hint && (M.hint.step || M.hint.bad) && (M.hint.step || hintWhy(TEXT_SCALES[S.textIdx])) && inRect(x, y, L.applyBtn)) { S.press = { id: 'hud:apply', active: true, kind: 'hud', rect: L.applyBtn }; return; }
    for (const r of L.tools) if (inRect(x, y, r)) { S.press = { id: `tool:${r.id}`, active: true, kind: 'tool', rect: r }; return; }
    const g = geoOf(M);
    S.lastPtr.x = x; S.lastPtr.y = y;
    if (M.tool === TOOL_MOVE) {
      if (inRect(x, y, g.card)) S.press = { id: 'pan', kind: 'pan', x0: x, y0: y, ox0: M.ox, oy0: M.oy };
      return;
    }
    const cell = cellAt(M.puz, g, x, y);
    if (cell) { S.press = { id: 'stroke', kind: 'stroke' }; startStroke(M, cell.c, cell.r); M.stroke.ptr = { x, y }; }
  }
  function strokeMove(x, y) {
    const M = S.match;
    if (!M || !M.stroke) { S.press = null; return; }
    const st = M.stroke;
    const g = geoOf(M);
    // a second finger lands somewhere else and the single pointer jumps: ignore the jump, and give up if it never comes back
    const dx = x - st.ptr.x, dy = y - st.ptr.y;
    if (Math.hypot(dx, dy) > Math.max(STRAY_PX, g.s * 3.2)) {
      st.stray += 1;
      if (st.stray > 24) { endStroke(M); S.press = null; }
      return;
    }
    st.stray = 0; st.ptr = { x, y }; S.lastPtr.x = x; S.lastPtr.y = y;
    const cell = cellAt(M.puz, g, x, y, true);
    if (!st.axis && (cell.r !== st.r0 || cell.c !== st.c0)) st.axis = Math.abs(cell.c - st.c0) >= Math.abs(cell.r - st.r0) ? 'row' : 'col';
    const tr2 = st.axis === 'col' ? cell.r : st.r0, tc2 = st.axis === 'row' ? cell.c : st.c0;
    if (tr2 !== st.tr || tc2 !== st.tc) { paintStroke(M, tr2, tc2); M.focus = { r: cell.r, c: cell.c }; }
  }
  function hudAction(id) {
    if (id === 'hud:back') leaveToMenu();
    else if (id === 'hud:pause') { endStroke0(); S.overlay = 'pause'; S.ovT = 0; }
    else if (id === 'hud:apply') { if (hintWhy(TEXT_SCALES[S.textIdx])) { S.overlay = 'why'; S.ovT = 0; } else applyHint(); }
  }

  // ---- auto
  function autoDown(x, y) {
    const L = autoLayout(TEXT_SCALES[S.textIdx]);
    const HD = L.hud;
    if (inRect(x, y, HD.back)) { S.press = { id: 'auto:exit', active: true, kind: 'auto', rect: HD.back }; return; }
    for (const id of ['slower', 'pause', 'faster']) {
      if (inRect(x, y, L[id])) { S.press = { id: `auto:${id}`, active: true, kind: 'auto', rect: L[id] }; return; }
    }
  }
  function autoAction(id) {
    if (id === 'auto:exit') { S.auto = null; S.match = null; gotoScene('title'); }
    else if (id === 'auto:pause') S.auto.paused = !S.auto.paused;
    else if (id === 'auto:slower') { S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); }
    else if (id === 'auto:faster') { S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); }
  }

  // ---- keyboard
  function keyTap(M, tool) {
    const keep = M.tool; M.tool = tool;
    startStroke(M, M.cur.c, M.cur.r); endStroke(M); M.tool = keep;
  }
  function onKeys(keys) {
    const has = (c) => keys.pressed.has(c);
    if (S.scene === 'play' && !S.overlay && S.match && !S.match.reveal) {
      const M = S.match;
      const mv = (dr, dc) => { S.kbd = true; M.cur = { r: Math.max(0, Math.min(M.puz.h - 1, M.cur.r + dr)), c: Math.max(0, Math.min(M.puz.w - 1, M.cur.c + dc)) }; M.focus = { ...M.cur }; if (M.zoom === 'close') { const p = panTo(M.puz, geoOf(M), M.cur.c, M.cur.r); M.ox = p.ox; M.oy = p.oy; } };
      if (has('ArrowLeft')) mv(0, -1);
      if (has('ArrowRight')) mv(0, 1);
      if (has('ArrowUp')) mv(-1, 0);
      if (has('ArrowDown')) mv(1, 0);
      if (has('Enter') || has('Space')) keyTap(M, M.tool === TOOL_CROSS ? TOOL_CROSS : TOOL_FILL);
      if (has('KeyX')) keyTap(M, TOOL_CROSS);
      if (has('KeyF')) toolAction('fill');
      if (has('KeyC')) toolAction('cross');
      if (has('KeyM')) toolAction('move');
      if (has('KeyU')) toolAction('undo');
      if (has('KeyY')) toolAction('redo');
      if (has('KeyT')) toolAction('think');
      if (has('Escape') || has('KeyP')) { endStroke0(); S.overlay = 'pause'; S.ovT = 0; }
      return;
    }
    if (S.overlay === 'pause' && (has('Escape') || has('KeyP'))) { S.overlay = null; return; }
    if (S.scene === 'auto' && S.auto) {
      if (has('Space') || has('KeyP')) S.auto.paused = !S.auto.paused;
      if (has('Escape') && !S.overlay) autoAction('auto:exit');
      return;
    }
    const ui = buildUi(S);
    if (ui.layout && ui.region) {
      if (keys.down.has('ArrowDown') || keys.down.has('PageDown')) setScroll(ui, getScroll(ui) + (keys.down.has('PageDown') ? 46 : 18));
      if (keys.down.has('ArrowUp') || keys.down.has('PageUp')) setScroll(ui, getScroll(ui) - (keys.down.has('PageUp') ? 46 : 18));
    }
    if (has('Escape') && ['chapters', 'learn', 'howto', 'rules', 'about', 'settings', 'demo-limit', 'daily'].includes(S.scene)) gotoScene('title');
    if (has('Escape') && S.scene === 'pictures') gotoScene('chapters');
    if ((S.scene === 'howto' || S.scene === 'rules') && ui.pageY && ui.region) {   // left / right jump a section of the reader
      const cur = getScroll(ui), at = ui.pageY.findIndex((y0, i) => cur < (ui.pageY[i + 1] ?? Infinity) - 1);
      if (has('ArrowRight') && at < ui.pageY.length - 1) setScroll(ui, ui.pageY[at + 1]);
      if (has('ArrowLeft')) setScroll(ui, at > 0 && cur - ui.pageY[at] < 4 ? ui.pageY[at - 1] : ui.pageY[Math.max(0, at)]);
    }
  }

  // ------------------------------------------------------------------------------ rotation / resize
  // The layout is a pure function of the live size, so a resize only needs the state tidied: a half-made stroke is finished where it
  // is (nothing is lost), a pan is re-clamped, and the focused square stays in view when zoomed in.
  function onResized() {
    const key = `${meta.width}x${meta.height}`;
    if (key === S.sizeKey) return;
    const first = S.sizeKey === '';
    S.sizeKey = key;
    if (first) return;
    const M = S.match;
    if (S.press && (S.press.kind === 'stroke' || S.press.kind === 'pan')) { endStroke0(); S.press = null; }
    if (M && (S.scene === 'play' || S.scene === 'auto')) {
      const g = geoOf(M);
      if (M.zoom === 'close' && g.canZoom) { const p = panTo(M.puz, g, M.focus ? M.focus.c : M.cur.c, M.focus ? M.focus.r : M.cur.r); M.ox = Math.min(Math.max(M.ox, 0), g.maxX); M.oy = Math.min(Math.max(M.oy, 0), g.maxY); if (M.focus) { M.ox = p.ox; M.oy = p.oy; } }
      else { M.ox = Math.min(Math.max(M.ox, 0), g.maxX); M.oy = Math.min(Math.max(M.oy, 0), g.maxY); if (!g.canZoom) M.zoom = 'fit'; }
    }
    S.scroll = Object.fromEntries(Object.entries(S.scroll).map(([k, v]) => [k, Math.max(0, v)]));
    S.scrollVel = {};
  }

  // ------------------------------------------------------------------------------ main loop
  return {
    update(dt, input) {
      setView(meta.width, meta.height);
      onResized();
      if (S.jump && S.jump.scene === S.scene) { const u = buildUi(S); if (u.pageY && u.region) setScroll(u, u.pageY[Math.min(S.jump.page, u.pageY.length - 1)] ?? 0); S.jump = null; }
      if (wheelInput.dy) {   // mouse wheel: scroll the reader / list under the pointer, or pan a zoomed board
        const dy = wheelInput.dy; wheelInput.dy = 0;
        const u = buildUi(S);
        if (u.layout && u.region && u.layout.height > u.region.h) setScroll(u, getScroll(u) + dy);
        else if (S.match && S.scene === 'play' && !S.overlay && S.match.zoom === 'close') { const M = S.match, g = geoOf(M); M.oy = Math.min(Math.max(0, M.oy + dy), g.maxY); }
      }
      // Watch & Learn's Pause (and the in-game pause card) freezes the whole loop: timers, animations, particles, the ambient clock.
      const frozen = (S.scene === 'auto' && S.auto && S.auto.paused) || S.overlay === 'pause';
      if (!frozen) S.t += dt;
      if (S.overlay) S.ovT += dt;
      const ptr = S.shot ? { pressed: false, down: false, released: false, x: 0, y: 0 } : input.pointer;
      if (ptr.pressed) onDown(ptr.x, ptr.y);
      else if (ptr.down) onMove(ptr.x, ptr.y, dt);
      if (ptr.released) onUp(ptr.x, ptr.y);
      else if (S.press && (S.press.kind === 'stroke' || S.press.kind === 'pan') && !ptr.down && !ptr.pressed && !S.shot) {
        // The release never reached us (the preview gate held the game, the app was backgrounded): let go where the finger last was.
        const p = S.press; S.press = null;
        if (p.kind === 'stroke' && S.match) endStroke(S.match);
      }
      if (ptr.down || ptr.pressed) { S.lastPtr.x = ptr.x; S.lastPtr.y = ptr.y; }
      if (!S.shot && (input.keys.pressed.size || input.keys.down.size)) onKeys(input.keys);

      for (const k of Object.keys(S.scrollVel)) {
        const v = S.scrollVel[k];
        if (Math.abs(v) < 8) { delete S.scrollVel[k]; continue; }
        const ui = buildUi(S);
        if (ui.scrollKey === k && ui.layout && ui.region) setScroll(ui, (S.scroll[k] ?? 0) + v * dt);
        S.scrollVel[k] = v * Math.exp(-dt * 5);
      }

      const M = S.match;
      if (M && !frozen) {
        if (M.toastT > 0) { M.toastT -= dt; if (M.toastT <= 0) M.toast = null; }
        if (S.scene === 'play') {
          // drag near the edge of a zoomed board slides it so a long stroke can keep going
          if (M.stroke && S.press && S.press.kind === 'stroke' && M.zoom === 'close' && !S.overlay) {
            const g = geoOf(M), p = M.stroke.ptr, e = 44, sp = 520 * dt;
            let nx = M.ox, ny = M.oy;
            if (p.x < g.view.x + e) nx -= sp; else if (p.x > g.view.x + g.view.w - e) nx += sp;
            if (p.y < g.view.y + e) ny -= sp; else if (p.y > g.view.y + g.view.h - e) ny += sp;
            nx = Math.min(Math.max(0, nx), g.maxX); ny = Math.min(Math.max(0, ny), g.maxY);
            if (nx !== M.ox || ny !== M.oy) { M.ox = nx; M.oy = ny; strokeMove(p.x, p.y); }
          }
          if (M.reveal) {
            M.reveal.t += dt; stepReveal(M, dt);
            if (!S.overlay && M.reveal.t > 3.4 && S.endInfo && !S.shot) { S.overlay = 'end'; S.ovT = 0; }
          } else {
            for (const [i, t0] of M.pops) if (S.t - t0 > 0.5) M.pops.delete(i);
            for (const [i, t0] of M.flashes) if (S.t - t0 > 0.7) M.flashes.delete(i);
            for (let i = M.parts.length - 1; i >= 0; i--) { const q = M.parts[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 360 * dt; if (q.life <= 0) M.parts.splice(i, 1); }
          }
        } else if (S.scene === 'auto') { stepAutoMatch(dt); updateAuto(dt); }
      }
    },

    render(ctx, view) {
      setView(view?.width ?? meta.width, view?.height ?? meta.height);
      render(ctx, S, buildUi(S));
    },

    // dev only (?dev=1): start a picture directly, for the layout / rotation check scripts
    devStart(id, zoom) { if (!config?.dev) return; startPuzzle(puzzleById(id), { fresh: true }); if (zoom && S.match) { S.match.zoom = zoom; const gg = geoOf(S.match); const p = panTo(S.match.puz, gg, 0, 0); S.match.ox = p.ox; S.match.oy = p.oy; } },

    getState() {
      const M = S.match;
      return {
        scene: S.scene, overlay: S.overlay, textIdx: S.textIdx, thinkIdx: S.thinkIdx, sound: S.sound, theme: S.themeId, lang: S.lang, check: S.check,
        results: S.results, lessons: Object.keys(S.lessons).length, lessonIdx: S.lessonIdx, page: S.page, scroll: S.scroll, demoCount: S.demoCount,
        daily: S.daily, open: Object.keys(S.openIds).length,
        auto: S.auto ? { k: S.auto.k, phase: S.auto.phase, t: Math.round(S.auto.t * 100) / 100, paused: S.auto.paused } : null,
        match: M ? {
          id: M.puz.id, cells: encode(M.b.cells), tool: M.tool, zoom: M.zoom, hints: M.b.hints, mistakes: M.b.mistakes, undo: M.b.undo.length, redo: M.b.redo.length,
          hint: M.hint && M.hint.step ? [M.hint.step.axis, M.hint.step.k] : null, reveal: M.reveal ? Math.round(M.reveal.t * 100) / 100 : null, stroke: Boolean(M.stroke), ox: Math.round(M.ox), oy: Math.round(M.oy),
        } : null,
      };
    },

    // The preview clock counts real play only. Menus, chapter lists, Learn (lessons), Rules / How to Play / About, Settings, every overlay
    // (pause, result, Watch & Learn summary), the demo card and Watch & Learn are all free time.
    // Dev tools only (?dev=1): the layout checks read the rects of the screen that is showing through this.
    dbg: config?.dev ? { buildUi: () => buildUi(S) } : undefined,

    isPreviewExempt: () => S.shot || S.scene !== 'play' || Boolean(S.overlay) || Boolean(S.match && S.match.lesson !== null && S.match.lesson !== undefined) || Boolean(S.match && S.match.reveal),
  };
}
