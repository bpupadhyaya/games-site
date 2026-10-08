// Datse: Bhutan Archery. State and flow. The match engine is in engine.js, drawing in view.js / menus.js, the 3D presenter in web/view3d (it only reads getState()).
// Scenes: title, setup, practice, settings, learn, howto / about / rules, demolimit, play (a match, the practice range, a lesson or Watch & Learn), result.
import { W, H, PLAY, LY, TEXT_SCALES, THINK_STEPS, REVEAL_SECS, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, SETUP_PINS, READ, syncLayout, inRect, inCircle, resetPlayLayout, setPlayLayout, viewRegion } from './layout.js';
import { createMatch, step as engineStep, setReticle, setZoom, beginDraw, releaseDraw, cancelDraw, actPlan, continueEnd, skipDance, canAct, isHuman, coachHint, T, breath, drawFrac, makePlan } from './engine.js';
import { ZOOMS, ZOOM_DEFAULT, LEVELS, LESSONS, VALLEYS, MATCH_TARGETS } from './consts.js';
import { renderPlay, drawLensOverlay } from './view.js';
import { renderTitle, renderSetup, renderPractice, renderSettings, renderLearn, renderResult, renderPause, renderHint, renderLesson, renderDemoLimit, renderPages, hitScreen, flowMeta, readerMeta, ensureLayout, resetMenus, resetPages, getLockTap, setLockDown } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';
import { boardZ } from './ballistics.js';

export const meta = { width: W, height: H, fluid: { short: 720 }, previewBadge: { x: 700, y: 120, align: 'right' } };
const DEMO_MATCH_CAP = 1, DEMO_PRACTICE_CAP = 12;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  resetMenus(); resetPlayLayout();
  const fx = rng.fork();
  let shotMode = false, shotZoom = -1;
  try { shotMode = /[?&]shot=/.test(globalThis.location.search); } catch { shotMode = false; }
  try { const z = /[?&]zoom=(\d)/.exec(globalThis.location.search); if (z) shotZoom = Number(z[1]); } catch { shotZoom = -1; }
  const shotSeed = config.seed | 0;

  const state = {
    scene: 'title', back: 'title', has3d: false, t: 0, paused: false, pauseMenu: false, mode: 'ai', v3: false, demo: !!config.demo, credits: '', shot: false,
    settings: { sound: true, textIdx: 0, thinkIdx: 1, tips: true },
    record: { played: 0, wins: [0, 0, 0], lost: 0, draws: 0, demoMatches: 0, lessons: [], karay: 0, bestRun: 0, arrows: 0, practiceArrows: 0 },
    setup: { valley: 0, level: 0, target: 0, help: 0, gender: 'mixed', pwind: -1 },
    page: 0, resume: null, loaded: false, E: null, hint: null, watch: null, lesson: null, over: null, toast: '', toastT: 0, restoreMsg: '', setupMsg: '', tip: '',
    ui: { scroll: 0, drag: null, drawing: false, aim: null, ff: false, keyDraw: false, moved: false }, evSeen: 0,
    viewRect: { x: 0, y: 0, w: W, h: H }, lensRect: { x: 0, y: 0, w: 100, h: 100 }, lensOn: false, layoutW: W, layoutH: H, lyKey: '', hide3d: false, endBtn: null, shotFreeze: false, sfxQ: [],
  };

  // ---- persistence -----------------------------------------------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); storage.set('setup', state.setup); };
  const clearResume = () => { state.resume = null; storage.remove('resume'); };
  const validSave = (r) => !!r && Array.isArray(r.teams) && r.teams.length === 2 && Array.isArray(r.order) && typeof r.seed === 'number' && r.cfg && r.cfg.mode === 'match';
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('resume', null), storage.get('setup', null)]).then(([s, r, res, su]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    if (su) Object.assign(state.setup, su);
    const st = state.settings;
    st.textIdx = clamp(st.textIdx | 0, 0, TEXT_SCALES.length - 1); st.thinkIdx = clamp(st.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 3) state.record.wins = [0, 0, 0];
    if (!Array.isArray(state.record.lessons)) state.record.lessons = [];
    if (validSave(res) && !shotMode) state.resume = res;
    state.loaded = true; audio.setMuted?.(!st.sound);
  }).catch(() => { state.loaded = true; });

  // ---- sound -------------------------------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    creak: (k) => tone({ freq: 180 + 120 * k, to: 140 + 120 * k, dur: 0.07, type: 'square', vol: 0.012 }),
    twang: () => { tone({ freq: 190, to: 95, dur: 0.22, type: 'sawtooth', vol: 0.07 }); tone({ freq: 1250, to: 420, dur: 0.16, type: 'sine', vol: 0.05 }); },
    whoosh: () => tone({ freq: 1500, to: 260, dur: 1.5, type: 'sine', vol: 0.012 }),
    thud: () => { tone({ freq: 160, to: 55, dur: 0.2, type: 'sine', vol: 0.3 }); tone({ freq: 520, to: 220, dur: 0.06, type: 'triangle', vol: 0.07 }); },
    soft: () => tone({ freq: 110, to: 60, dur: 0.16, type: 'sine', vol: 0.12 }),
    karay: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.3 + i * 0.06, type: 'triangle', vol: 0.1 })),
    cheer: () => [0, 7, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.18 + i * 0.05, type: 'triangle', vol: 0.07 })),
    lose: () => tone({ freq: 300, to: 120, dur: 0.4, type: 'sawtooth', vol: 0.05 }),
    win: () => [0, 2, 4, 7, 9, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.3 + i * 0.05, type: 'triangle', vol: 0.1 })),
    chime: () => [0, 7].forEach((n, i) => tone({ freq: 660 * Math.pow(2, n / 12), dur: 0.25 + i * 0.1, type: 'sine', vol: 0.07 })),
  };
  // the celebration song: a call and an answer on a five-note scale over a steady drum, queued as (time, tone) pairs
  const queueSong = () => {
    const sc = [0, 2, 4, 7, 9], root = 293.66, q = [];
    const call = [0, 2, 4, 2, 0, 1, 2, 4], ans = [4, 3, 2, 1, 2, 0, 1, 0];
    [...call, ...ans].forEach((d, i) => { const t = 0.2 + i * 0.28 + (i >= 8 ? 0.2 : 0), f = root * Math.pow(2, sc[d % 5] / 12 + (d >= 5 ? 1 : 0)); q.push({ t, o: { freq: f, dur: 0.24, type: 'triangle', vol: i < 8 ? 0.07 : 0.06 } }); });
    for (let i = 0; i < 16; i++) q.push({ t: 0.15 + i * 0.28, o: { freq: i % 2 ? 90 : 70, to: 50, dur: 0.1, type: 'sine', vol: 0.12 } });
    state.sfxQ.push(...q.map((x) => ({ ...x, at: state.t + x.t })));
  };
  const toast = (text) => { state.toast = text; state.toastT = 2; };

  // ---- starting things -----------------------------------------------------------------------------------------------------------------------------------
  const afterNewEngine = () => { state.hint = null; state.watch = null; state.over = null; state.paused = false; state.pauseMenu = false; state.scene = 'play'; state.ui.scroll = 0; state.evSeen = 0; state.ui.drawing = false; state.ui.aim = null; state.ui.moved = false; resetPlayLayout(); };
  const newE = (cfg) => { const E = createMatch(rng.int(1 << 30), cfg); E.zoom = ZOOM_DEFAULT; return E; };
  const startMatch = () => {
    const s = state.setup;
    if (state.demo && state.record.demoMatches >= DEMO_MATCH_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    let opp = fx.int(VALLEYS.length - 1); if (opp >= s.valley) opp++;
    state.mode = 'ai'; state.lesson = null;
    state.E = newE({ mode: 'match', target: state.demo ? 0 : s.target, level: state.demo ? 0 : s.level, help: s.help, valley: s.valley, opp, gender: s.gender, first: fx.int(2) });
    afterNewEngine();
  };
  const startPractice = () => {
    const s = state.setup;
    if (state.demo && state.record.practiceArrows >= DEMO_PRACTICE_CAP) { state.scene = 'demolimit'; return; }
    state.mode = 'practice'; state.lesson = null;
    state.E = newE({ mode: 'practice', help: s.help, valley: s.valley, gender: s.gender, practiceWind: s.pwind });
    afterNewEngine();
  };
  const startWatch = () => {
    const a = fx.int(3), b = Math.min(2, a + 1 + fx.int(2));
    state.mode = 'watch'; state.lesson = null;
    state.E = newE({ mode: 'watch', target: 0, level: b, help: 0, valley: fx.int(3), opp: 3 + fx.int(3), levels: [a, b], gender: 'mixed', first: fx.int(2) });
    afterNewEngine();
  };
  const startLesson = (idx) => {
    const def = LESSONS[idx]; state.mode = 'lesson';
    state.E = newE({ mode: 'lesson', lesson: idx, valley: state.setup.valley, gender: state.setup.gender });
    state.lesson = { idx, def, phase: 'intro', pts: 0, shots: 0 };
    afterNewEngine(); state.paused = true;
  };
  const resumeMatch = () => {
    if (!state.resume) return;
    if (state.demo && state.record.demoMatches >= DEMO_MATCH_CAP) { clearResume(); state.scene = 'demolimit'; return; }
    state.mode = 'ai'; state.lesson = null;
    state.E = JSON.parse(JSON.stringify(state.resume)); state.E.events = []; state.E.evId = state.E.evId | 0;
    state.setup.level = state.E.cfg.level; state.setup.valley = state.E.cfg.valley;
    afterNewEngine(); state.paused = true; state.pauseMenu = true;
  };
  const leaveGame = () => {
    const E = state.E;
    if (E && state.mode === 'ai' && !E.over && E.snap) { state.resume = JSON.parse(JSON.stringify(E.snap)); storage.set('resume', state.resume); }
    state.scene = state.mode === 'lesson' ? 'learn' : 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.hint = null; state.watch = null; state.lesson = null; state.E = state.scene === 'title' ? null : state.E;
  };
  const finishMatch = () => {
    if (state.scene === 'result') return;
    const E = state.E, rec = state.record, w = E.over ? E.over.winner : -1;
    state.over = { winner: w, score: [E.teams[0].pts, E.teams[1].pts], mode: state.mode, level: E.cfg.level, names: [E.teams[0].name, E.teams[1].name], stats: [E.teams[0].st, E.teams[1].st], ends: E.end + 1 };
    state.scene = 'result'; state.ui.scroll = 0; state.paused = false; clearResume();
    if (state.mode === 'ai') {
      rec.played++; rec.karay += E.teams[0].st.karay; rec.bestRun = Math.max(rec.bestRun, E.teams[0].st.best); rec.arrows += E.teams[0].st.arrows;
      if (w === 0) { rec.wins[E.cfg.level] = (rec.wins[E.cfg.level] | 0) + 1; sfx.win(); } else if (w === 1) { rec.lost++; sfx.lose(); } else rec.draws++;
      if (state.demo) rec.demoMatches++;
    }
    save();
  };

  // ---- Think and Watch & Learn --------------------------------------------------------------------------------------------------------------------------------------
  const openHint = () => {
    const E = state.E; if (!E || !canAct(E)) { toast('Nothing to think about right now'); return; }
    const h = coachHint(E); if (!h) { toast('Nothing to think about right now'); return; }
    state.hint = h; state.paused = true; state.ui.scroll = 0; state.ui.drawing = false; sfx.tick();
  };
  const closeHint = () => { state.hint = null; state.paused = false; state.ui.scroll = 0; };
  const applyHint = () => { const h = state.hint; if (h && h.value && state.E) { setReticle(state.E, h.value.u, h.value.h); state.ui.moved = true; } closeHint(); };
  const watchStep = (dt) => {
    const E = state.E;
    if (E.phase !== 'aim' || !E.ai || !E.plan) { state.watch = null; return; }
    const key = `${E.shots}`;
    if (!state.watch || state.watch.key !== key) state.watch = { key, phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx] };
    const w = state.watch; w.t += dt;
    if (w.phase === 'think' && w.t >= w.dur) { w.phase = 'reveal'; w.t = 0; E.ai.rev = true; }
    else if (w.phase === 'reveal' && w.t >= REVEAL_SECS) { actPlan(E); state.watch.phase = 'act'; }
  };

  // ---- events from the sim: sounds -----------------------------------------------------------------------------------------------------------------------------------
  const consumeEvents = () => {
    const E = state.E; if (!E) return;
    for (const e of E.events) {
      if (e.id <= state.evSeen) continue;
      state.evSeen = e.id;
      if (e.type === 'release') { sfx.twang(); sfx.whoosh(); }
      else if (e.type === 'karay') { sfx.thud(); sfx.karay(); } else if (e.type === 'hit') { sfx.thud(); if (e.team === 0 || state.mode === 'watch') sfx.cheer(); }
      else if (e.type === 'near' || e.type === 'miss') sfx.soft();
      else if (e.type === 'dance') queueSong();
      else if (e.type === 'endScore') sfx.chime();
    }
  };
  const trackEnd = () => {
    const E = state.E;
    if (E.lesson && E.over && state.lesson && state.lesson.phase === 'play') {
      const L = state.lesson; L.pts = E.lesson.pts; L.shots = E.shots; L.phase = E.lesson.pass ? 'done' : 'retry'; state.paused = true; state.ui.scroll = 0;
      if (E.lesson.pass) { state.record.lessons = Array.from(new Set([...state.record.lessons, L.def.id])); save(); sfx.win(); }
    }
    if (E.phase === 'over' && !E.lesson) finishMatch();
  };

  // ---- pause -------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const openPause = () => { if (state.scene !== 'play') return; state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.ui.drawing = false; state.ui.aim = null; if (state.E && state.E.phase === 'draw' && isHuman(state.E, state.E.cur.team)) cancelDraw(state.E); };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  }
  const updateFlowOverlay = (input, key, handler) => {
    const ptr = input.pointer;
    ensureLayout(state, key);
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
    const mt = flowMeta(), max = mt && mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };
  const handlePauseTap = (id) => {
    if (!id) return; sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; } else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'quit') leaveGame();
  };
  const handleLessonTap = (id) => {
    const L = state.lesson; if (!id || !L) return; sfx.tick();
    if (id === 'ls-start') { L.phase = 'play'; state.paused = false; state.ui.scroll = 0; }
    else if (id === 'ls-retry') startLesson(L.idx);
    else if (id === 'ls-next') { const n = L.idx + 1; if (n < LESSONS.length) startLesson(n); else { state.scene = 'learn'; state.lesson = null; state.paused = false; state.ui.scroll = 0; } }
    else if (id === 'ls-back') { state.scene = 'learn'; state.lesson = null; state.paused = false; state.ui.scroll = 0; }
  };

  // ---- the play scene ----------------------------------------------------------------------------------------------------------------------------------------------------
  const cycleZoom = (E) => { setZoom(E, (E.zoom + 1) % ZOOMS.length); sfx.tick(); };
  const tipFor = (E) => {
    if (!state.settings.tips || state.record.arrows + state.record.practiceArrows > 8 || !E.cur || !isHuman(E, E.cur.team) || E.phase !== 'aim') return '';
    return state.ui.moved ? 'Hold DRAW. Let go when the ring is green.' : 'Drag on the lens to put the reticle on the board.';
  };
  const updatePlay = (dt, input) => {
    const ptr = input.pointer, keys = input.keys, E = state.E;
    if (!E) { state.scene = 'title'; return; }
    if (state.pauseMenu) { updateFlowOverlay(input, 'pause', handlePauseTap); if (keys.pressed.has('Escape')) closePause(); return; }
    if (state.hint) { updateFlowOverlay(input, 'hint', (id) => { if (id === 'hint-do') applyHint(); else if (id === 'hint-close') closeHint(); }); return; }
    if (state.lesson && state.lesson.phase !== 'play') { updateFlowOverlay(input, 'lesson', handleLessonTap); return; }
    if (state.toastT > 0) { state.toastT -= dt; if (state.toastT <= 0) state.toast = ''; }
    const watch = state.mode === 'watch';
    // the song queue
    if (state.sfxQ.length) { const keep = []; for (const x of state.sfxQ) { if (state.t >= x.at) tone(x.o); else keep.push(x); } state.sfxQ = keep; }
    // buttons
    if (ptr.pressed) {
      if (inRect(PLAY.menu, ptr.x, ptr.y)) { openPause(); return; }
      if (inRect(PLAY.think, ptr.x, ptr.y)) { if (watch) { state.paused = !state.paused; sfx.tick(); } else openHint(); return; }
      if (inRect(PLAY.zoom, ptr.x, ptr.y)) { cycleZoom(E); return; }
    }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (watch) state.paused = !state.paused; else openPause(); return; }
    if (state.paused) return;                                   // Watch & Learn paused: everything stands still
    const human = !!E.cur && isHuman(E, E.cur.team) && !watch;
    if (E.phase === 'endscore') {
      if ((ptr.pressed && state.endBtn && inRect(state.endBtn, ptr.x, ptr.y)) || keys.pressed.has('Enter') || keys.pressed.has('Space')) { if (!watch) { continueEnd(E); sfx.tick(); } else continueEnd(E); }
    } else if (E.phase === 'dance') { if (ptr.pressed || keys.pressed.has('Space')) skipDance(E); }
    else if (E.phase === 'result' && (ptr.pressed || keys.pressed.has('Space')) && E.pt > 0.5) E.pt = Math.max(E.pt, T.result);
    else if (E.phase === 'endintro' && ptr.pressed) E.pt = Math.max(E.pt, T.endintro);
    else if (E.phase === 'walk' && ptr.pressed) E.pt = Math.max(E.pt, T.walk - 0.5);
    state.ui.ff = E.phase === 'flight' && (ptr.down || keys.down.has('KeyF'));
    // aiming and drawing (one pointer: aiming and drawing are separate)
    if (human && canAct(E)) {
      if (ptr.pressed && inCircle(PLAY.draw, ptr.x, ptr.y)) { if (beginDraw(E)) { state.ui.drawing = true; state.ui.aim = null; } }
      else if (ptr.pressed && (inRect(PLAY.aimArea, ptr.x, ptr.y) || inCircle({ cx: PLAY.lens.cx, cy: PLAY.lens.cy, r: PLAY.lens.r }, ptr.x, ptr.y))) state.ui.aim = { x0: ptr.x, y0: ptr.y, u0: E.aim.u, h0: E.aim.h };
      if (keys.pressed.has('Space')) { if (beginDraw(E)) { state.ui.drawing = true; state.ui.keyDraw = true; } }
      if (keys.pressed.has('KeyZ')) cycleZoom(E);
      if (keys.pressed.has('KeyT') || keys.pressed.has('KeyH')) { openHint(); return; }
      const sp = ZOOMS[E.zoom] * 0.4 * dt * (keys.down.has('ShiftLeft') || keys.down.has('ShiftRight') ? 0.25 : 1);
      let du = 0, dh = 0; if (keys.down.has('ArrowLeft')) du -= sp; if (keys.down.has('ArrowRight')) du += sp; if (keys.down.has('ArrowUp')) dh += sp; if (keys.down.has('ArrowDown')) dh -= sp;
      if (du || dh) { setReticle(E, E.aim.u + du, E.aim.h + dh); state.ui.moved = true; }
    }
    if (state.ui.aim && ptr.down && human && E.phase === 'aim') {
      const k = ZOOMS[E.zoom] / PLAY.lens.w, a = state.ui.aim;
      setReticle(E, a.u0 + (ptr.x - a.x0) * k, a.h0 - (ptr.y - a.y0) * k); if (Math.hypot(ptr.x - a.x0, ptr.y - a.y0) > 6) state.ui.moved = true;
    }
    if (state.ui.drawing && E.phase === 'draw') {
      if (E.draw.t > 0.1 && Math.floor(E.draw.t * 6) !== state.ui.lastCreak) { state.ui.lastCreak = Math.floor(E.draw.t * 6); if (E.draw.t < 1.3) sfx.creak(drawFrac(E.draw.t)); }
      if ((state.ui.keyDraw ? !keys.down.has('Space') : !ptr.down)) { releaseDraw(E); state.ui.drawing = false; state.ui.keyDraw = false; }
    }
    if (!ptr.down && !state.ui.keyDraw) { state.ui.aim = null; if (state.ui.drawing && E.phase !== 'draw') state.ui.drawing = false; }
    if (E.phase !== 'draw') state.ui.drawing = false;
    if (watch) watchStep(dt);
    const n = state.ui.ff ? 3 : E.phase === 'flight' && E.cur && !isHuman(E, E.cur.team) && !watch ? 2 : 1;
    // the last few metres of your own arrow are shown in slow motion
    let ds = 1;
    if (!state.ui.ff && E.phase === 'flight' && E.arrow && E.arrow.alive && human) { const left = Math.abs(boardZ(E.dir) - E.arrow.z); if (left < 22) ds = 0.45; }
    for (let i = 0; i < n; i++) engineStep(E, dt * ds);
    consumeEvents(); trackEnd();
    if (E.snap && state.mode === 'ai' && E.snap !== state.lastSnap) { state.lastSnap = E.snap; storage.set('resume', E.snap); state.resume = E.snap; }
    if (state.mode === 'practice') { const c = E.shots; if (c !== state.lastShots) { state.record.practiceArrows += c - (state.lastShots | 0); state.lastShots = c; if (c % 6 === 0) save(); if (state.demo && state.record.practiceArrows >= DEMO_PRACTICE_CAP && E.phase === 'aim') { state.scene = 'demolimit'; } } }
    state.tip = tipFor(E);
    if (E.phase === 'aim' && human && E.arrowNo === 0 && E.cfg.mode !== 'lesson') { /* the reticle starts on the middle of the board */ }
  };

  // ---- menus ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return; sfx.tick();
    if (id === 'play') { state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; } else if (id === 'practice') { state.scene = 'practice'; state.ui.scroll = 0; } else if (id === 'learn') { state.scene = 'learn'; state.ui.scroll = 0; }
    else if (id === 'watch') startWatch(); else if (id === 'continue') resumeMatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
  };
  const handleSetup = (id) => {
    if (!id) return; const s = state.setup; sfx.tick();
    if (/^v\d$/.test(id)) s.valley = Number(id.slice(1));
    else if (id.startsWith('lv')) { const i = Number(id.slice(2)); if (state.demo && i > 0) { state.setupMsg = 'That opponent is in the full game.'; return; } s.level = i; state.setupMsg = ''; }
    else if (/^m\d$/.test(id)) { const i = Number(id.slice(1)); if (state.demo && i !== 0) { state.setupMsg = 'Longer matches are in the full game.'; return; } s.target = i; }
    else if (/^h\d$/.test(id)) s.help = Number(id.slice(1));
    else if (id.startsWith('g-')) s.gender = id.slice(2);
    else if (id === 'start') { save(); startMatch(); }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handlePractice = (id) => {
    if (!id) return; const s = state.setup; sfx.tick();
    if (id.startsWith('pw')) s.pwind = Number(id.slice(2)); else if (/^h\d$/.test(id)) s.help = Number(id.slice(1));
    else if (id === 'start') { save(); startPractice(); } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return; const st = state.settings; sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); } else if (id === 'set-tips') st.tips = !st.tips;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1); else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1); else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') { state.restoreMsg = 'Checking with the store...'; Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; }); }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleLearn = (id) => { if (!id) return; sfx.tick(); if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; } else if (id.startsWith('lesson')) startLesson(Number(id.slice(6))); };
  const handleResult = (id) => {
    if (!id) return; sfx.tick(); const mode = state.over?.mode;
    if (id === 'again') { if (mode === 'watch') startWatch(); else startMatch(); } else if (id === 'new') { state.scene = 'setup'; state.ui.scroll = 0; } else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.E = null; }
  };
  function updateFlowScene(input, handler, key) {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key);
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta(); const scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll)); else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  }
  const updatePinned = (input, key, handler) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handler('start'); return; }
    if (k.pressed.has('Escape')) { handler('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) { handler(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(input, handler, key);
  };
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys, R = readerMeta();
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.page = 0; state.ui.drag = null; };
    const setS = (v) => { state.page = clamp(v, 0, R.max); };
    const zoom = (d) => { state.settings.textIdx = clamp(state.settings.textIdx + d, 0, TEXT_SCALES.length - 1); state.page = 0; resetPages(); save(); };
    if (ptr.pressed) {
      if (inRect(REF_NEXT, ptr.x, ptr.y)) { if (state.page >= R.max - 4) close(); else setS(state.page + R.view * 0.85); state.ui.drag = null; }
      else if (inRect(REF_BACK, ptr.x, ptr.y)) close();
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) zoom(-1); else if (inRect(TEXT_INC, ptr.x, ptr.y)) zoom(1);
      else if (R.max > 0 && ptr.x >= READ.bar.x - 14 && ptr.x <= READ.bar.x + READ.bar.w + 14 && ptr.y >= READ.view.y && ptr.y <= READ.view.y + READ.view.h) state.ui.drag = { bar: true };
      else state.ui.drag = { y0: ptr.y, s0: state.page };
    }
    if (state.ui.drag && state.ui.drag.bar && ptr.down) setS(((ptr.y - READ.view.y) / READ.view.h) * R.max);
    else if (state.ui.drag && ptr.down) setS(state.ui.drag.s0 - (ptr.y - state.ui.drag.y0));
    if (ptr.released) state.ui.drag = null;
    if (state.wheel) { setS(state.page + state.wheel); state.wheel = 0; }
    if (keys.down.has('ArrowDown')) setS(state.page + 36); if (keys.down.has('ArrowUp')) setS(state.page - 36);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) setS(state.page + R.view * 0.85); if (keys.pressed.has('PageUp')) setS(state.page - R.view * 0.85);
    if (keys.pressed.has('End')) setS(R.max); if (keys.pressed.has('Home')) setS(0);
    if (keys.pressed.has('Equal') || keys.pressed.has('NumpadAdd')) zoom(1); if (keys.pressed.has('Minus') || keys.pressed.has('NumpadSubtract')) zoom(-1);
    if (keys.pressed.has('Escape')) close();
  };

  // ---- shot presets: ?shot=1&seed=N picks a fixed, deterministic screen ----------------------------------------------------------------------------------------------------------------
  const autoHuman = (E, holdT = 2.1) => {
    // plays the human's shots for scripted screens: aim at the coach's mark, draw, let go at the calm moment
    if (E.phase === 'aim' && canAct(E)) { const h = coachHint(E); if (h) setReticle(E, h.value.u, h.value.h); beginDraw(E); E.__rel = holdT; }
    else if (E.phase === 'draw' && E.draw && !E.draw.auto && E.draw.t >= (E.__rel || holdT)) releaseDraw(E);
    if (E.phase === 'endscore') continueEnd(E);
  };
  const runUntil = (test, max = 1500, holdT = 2.1) => { const E = state.E; let g = 0; while (!test(E) && g++ < max * 60 && E.phase !== 'over') { autoHuman(E, holdT); if (E.phase === 'aim' && E.ai && !E.go) actPlan(E); engineStep(E, 1 / 60); } };
  const shotMatch = (cfg, test, max, holdT) => { state.mode = 'ai'; state.E = newE({ mode: 'match', target: 0, level: 1, help: 0, valley: 0, opp: 1, first: 0, ...cfg }); afterNewEngine(); state.E.evId = 0; state.shot = true; runUntil(test, max, holdT); state.shotFreeze = true; };
  const applyPreset = () => {
    state.shot = true; state.settings.tips = false;
    if (shotZoom >= 0 && shotZoom < TEXT_SCALES.length) state.settings.textIdx = shotZoom;
    const n = ((shotSeed % 100) + 100) % 100;
    const aimPh = (E) => E.phase === 'aim' && E.end === 0 && E.turn === 2 && E.arrowNo === 0 && isHuman(E, E.cur.team) === true;
    if (n === 1) { state.scene = 'title'; return; }
    if (n === 2) { shotMatch({}, aimPh, 300); state.E.aim.u = 0.2; state.E.aim.h = 0.55; return; }
    if (n === 3) { shotMatch({}, (E) => E.phase === 'draw' && E.draw && E.draw.t > 1.7, 300, 3.5); return; }
    if (n === 4) { shotMatch({}, (E) => E.phase === 'flight' && E.t - E.arrow.t0 > 1.5, 300); return; }
    if (n === 5) { shotMatch({ perfect: true }, (E) => E.phase === 'result' && E.last && E.last.pts >= 2 && E.pt > 0.8, 1200); return; }
    if (n === 6) { shotMatch({ perfect: true, level: 2 }, (E) => E.phase === 'dance' && E.pt > 1.8, 3000); return; }
    if (n === 7) { state.back = 'title'; state.scene = 'rules'; state.page = 0; return; }
    if (n === 8) { state.back = 'title'; state.scene = 'howto'; return; }
    if (n === 9) { state.scene = 'setup'; return; }
    if (n === 10) { state.scene = 'settings'; return; }
    if (n === 11) { state.back = 'title'; state.scene = 'about'; return; }
    if (n === 12) { state.scene = 'learn'; return; }
    if (n === 13) { shotMatch({}, (E) => E.phase === 'endscore', 1500); return; }
    if (n === 14) { startWatch(); state.shot = true; const E = state.E; let g = 0; while (!(E.phase === 'aim' && E.shots >= 2) && g++ < 60 * 900) { if (E.phase === 'aim' && E.ai && !E.go) actPlan(E); if (E.phase === 'endscore') continueEnd(E); engineStep(E, 1 / 60); } state.watch = { key: 'x', phase: 'think', t: 1.5, dur: 5 }; state.shotFreeze = true; return; }
    if (n === 15) { state.settings.textIdx = 4; state.back = 'title'; state.scene = 'rules'; state.page = 3000; return; }
    if (n === 16) { state.settings.textIdx = 4; state.scene = 'title'; return; }
    if (n === 17) { state.settings.textIdx = 4; shotMatch({}, aimPh, 300); return; }
    if (n === 18) { state.settings.textIdx = 4; state.scene = 'settings'; return; }
    if (n === 19) { state.settings.textIdx = 4; state.scene = 'setup'; return; }
    if (n === 20) { shotMatch({}, (E) => E.phase === 'over', 6000); finishMatch(); state.shotFreeze = true; return; }
    if (n === 21) { shotMatch({}, aimPh, 300); state.E.wind.s = 6; state.E.zoom = 1; return; }
    if (n === 22) { state.mode = 'practice'; state.E = newE({ mode: 'practice', help: 1, practiceWind: -1 }); afterNewEngine(); state.shot = true; runUntil((E) => E.phase === 'aim' && E.shots >= 2); state.shotFreeze = true; return; }
    if (n === 23) { shotMatch({}, aimPh, 300); state.paused = true; state.pauseMenu = true; return; }
    if (n === 24) { shotMatch({}, aimPh, 300); state.hint = coachHint(state.E); state.paused = true; return; }
    if (n === 25) { state.scene = 'practice'; return; }
    if (n === 26) { shotMatch({}, (E) => E.phase === 'endintro' && E.end === 1 && E.pt > 0.8, 3000); return; }
    if (n === 27) { shotMatch({}, (E) => E.phase === 'result' && E.last && E.last.kind === 'miss' && E.pt > 0.8, 1200); return; }
  };

  // ---- the object the kit and the shell see ---------------------------------------------------------------------------------------------------------------------------------------
  const aboutList = () => state.creditsList ?? ABOUT;
  function relayout() {
    syncLayout(meta.width, meta.height); setPlayLayout(state.settings.textIdx);
    if (state.lyKey !== LY.key) {
      if (state.lyKey) { state.ui.drag = null; state.ui.aim = null; resetPages(); }
      state.lyKey = LY.key; resetPlayLayout(); setPlayLayout(state.settings.textIdx);
      meta.previewBadge = { x: LY.U.x1 - 10, y: PLAY.sb.y + PLAY.sb.h + 14 + (LY.land ? 0 : 0), align: 'right' };
    }
    state.layoutW = LY.w; state.layoutH = LY.h;
    state.viewRect = state.scene === 'play' || !LY.land ? viewRegion() : { x: LY.U.x0, y: Math.round(LY.U.y0 + LY.U.h * 0.38), w: Math.round(LY.U.w * 0.5), h: Math.round(LY.U.h * 0.62) }; const l = PLAY.lens; state.lensRect = { x: l.x, y: l.y, w: l.w, h: l.h };
  }
  const game = {
    scrollBy(dy) { if (['rules', 'howto', 'about'].includes(state.scene)) state.wheel = (state.wheel || 0) + dy; else { const mt = flowMeta(); const max = mt && mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0; state.ui.scroll = clamp(state.ui.scroll + dy, 0, max); } },
    // Everything except the live shooting in a match or on the practice range is free: menus, Rules, About, Learn, lessons, Watch & Learn, pause.
    isPreviewExempt: () => !(state.scene === 'play' && (state.mode === 'ai' || state.mode === 'practice') && !!state.E && ['aim', 'draw', 'flight'].includes(state.E.phase) && !state.paused),
    setView3d(on) { state.v3 = !!on; },
    setHas3d(on) { state.has3d = !!on; },
    drawLens: (ctx, L) => { if (state.E) drawLensOverlay(ctx, state, state.E, L); },
    debugStart: (cfg) => { state.E = newE(cfg); state.mode = cfg.mode === 'watch' ? 'watch' : cfg.mode === 'practice' ? 'practice' : 'ai'; afterNewEngine(); },
    setCredits(text) {
      state.credits = String(text || '');
      const paras = state.credits.split(/\n{2,}/).map((s) => s.replace(/^#+\s*/gm, '').replace(/\n/g, ' ').trim()).filter(Boolean);
      if (paras.length) { state.creditsList = [...ABOUT, { title: 'Credits', p: paras }]; resetPages(); }
    },
    update(dt, input) {
      relayout();
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.shotFreeze) return;
      if (state.shot && !state.E) return;
      switch (state.scene) {
        case 'title': {
          const lt = getLockTap(), pp = input.pointer;
          setLockDown(state.lockDown > state.t);
          if (lt && pp.pressed && pp.x >= lt.x && pp.x <= lt.x + lt.w && pp.y >= lt.y && pp.y <= lt.y + lt.h) { state.lockDown = state.t + 0.25; env.openArcforgeHome?.(); break; }
          updateFlowScene(input, handleTitle, 'title'); break;
        }
        case 'setup': updatePinned(input, 'setup', handleSetup); break;
        case 'practice': updatePinned(input, 'practice', handlePractice); break;
        case 'settings': updateFlowScene(input, handleSettings, 'settings'); break;
        case 'learn': updateFlowScene(input, handleLearn, 'learn'); break;
        case 'result': updateFlowScene(input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.E = null; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      relayout();
      ctx.clearRect(0, 0, W, H);
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'practice': renderPractice(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'learn': renderLearn(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, aboutList(), 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play': if (state.E) { renderPlay(ctx, state); if (state.pauseMenu || state.hint || (state.lesson && state.lesson.phase !== 'play')) state.lensOn = false; if (state.pauseMenu) renderPause(ctx, state); else if (state.hint) renderHint(ctx, state); else if (state.lesson && state.lesson.phase !== 'play') renderLesson(ctx, state); } break;
        default: break;
      }
    },
    getState: () => state,
  };
  if (shotMode) { applyPreset(); state.shotFreeze = true; }
  void LEVELS; void MATCH_TARGETS; void breath; void makePlan;
  return game;
}
