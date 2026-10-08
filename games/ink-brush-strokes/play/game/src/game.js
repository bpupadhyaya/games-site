// Ink Brush: state and flow. Drawing is in view.js / playview.js / docview.js; the brush physics are in brush.js, the judging in judge.js,
// the lesson data in lessons.js. Time is the sum of the dt values handed to update() (deterministic, pausable).
import { LESSONS, GROUPS, TYPES, SEALS, PAGE, targetPath, pathLen } from './lessons.js';
import { BRUSH, newBrush, beginStroke, strokeMove, strokeEnd, synthSamples, toneBand } from './brush.js';
import { judgeStroke, starsFor } from './judge.js';
import { pen } from './pen.js';
import { makeLayer, clearLayer, liveUpdate, liveCommit, stampSeal, replay } from './ink.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects, lessonItems } from './layout.js';
import { ui, docMetrics } from './docview.js';
import { render, modelImage } from './view.js';
import { RULES } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
export const TOOLS = { practice: ['dip', 'water', 'grind', 'size', 'guide', 'undo', 'hint'], free: ['dip', 'water', 'grind', 'size', 'undo', 'seal', 'left', 'right', 'keep'], auto: ['pause', 'skip'] };
// Free-scroll layer resolution: 1800x800 page units. Touch devices and low-memory phones get a smaller backing store (two canvases of ~7 MB instead of ~17 MB).
const freeRes = () => { try { const nav = globalThis.navigator, mem = nav?.deviceMemory ?? 4, touch = (nav?.maxTouchPoints ?? 0) > 0; return mem <= 3 ? 0.8 : touch ? 0.95 : 1.2; } catch { return 0.95; } };
const DEMO_LESSONS = 3, DEMO_FREE = 2, GALLERY_MAX = 12, FREE_PAGES = 3;
const TONE_D = { dark: 0.88, mid: 0.52, pale: 0.22 };
const HERO = ['da', 'shan', 'mu', 'ren'];
const GUIDES = ['Full', 'Light', 'Off'];

const compactStroke = (st, thin) => {
  const keep = st.s.filter((_, i) => i === 0 || i === st.s.length - 1 || i % thin === 0);
  const r1 = (v) => Math.round(v * 10) / 10;
  return { tone: Math.round(st.tone * 100) / 100, s: keep.map((q) => ({ x: r1(q.x), y: r1(q.y), w: r1(q.w), l: Math.round(q.l * 100) / 100, p: Math.round(q.p * 10) / 10, d: Math.round(q.d) })) };
};

export function createGame(env) {
  const { rng, storage, config } = env;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title',
    prefs: { sound: true, size: 1, guide: 0, think: 5, calm: false, tip: true, textIdx: 0 },
    stars: {}, mastered: {}, gallery: [], workSeq: 1, demoRuns: 0, savedFree: null,
    ink: { d: 0.6 }, brush: newBrush(),
    ps: null, fr: null, hero: { ci: 0, si: 0, u: 0, pause: 0, end: 0, x: 0, y: 0 },
    listScroll: 0, galScroll: 0, work: 0, grind: null, cursor: { x: -99, y: -99, on: false }, flash: null, dipPulse: 0,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true,
  };
  const fx = { lesson: null, free: null, hero: null, thumbs: new Map() };      // paint layers: derived pictures, not game state
  const nTools = () => (state.scene === 'free' ? TOOLS.free.length : state.ps && state.ps.mode === 'auto' ? TOOLS.auto.length : TOOLS.practice.length);
  const lay = () => layoutFor(meta.width, meta.height, nTools(), 0);
  let lastScene = state.scene, drag = null;

  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); state.prefs.textIdx = Math.min(Math.max(state.prefs.textIdx | 0, 0), TEXT_SCALES.length - 1); state.prefs.think = Math.min(10, Math.max(1, state.prefs.think | 0)); applyPrefs(); } });
  storage.get('stars', null).then((v) => { if (v) state.stars = v; });
  storage.get('mastered', null).then((v) => { if (v) state.mastered = v; });
  storage.get('gallery', null).then((v) => { if (Array.isArray(v)) state.gallery = v; });
  storage.get('workSeq', 1).then((v) => { state.workSeq = Math.max(state.workSeq, v); });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  storage.get('free', null).then((v) => { if (v && !state.fr) state.savedFree = v; });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();

  const go = (scene) => {
    if (state.scene === 'free' && state.fr) saveFree();
    state.scene = scene; state.cursor.on = false;
    if (scene !== 'practice') state.ps = null;
    if (scene !== 'free') state.fr = null;
    drag = null;
  };
  const say = (text, hold = 2.4) => { state.toast = { text, t: 0, hold }; };
  const sfx = (o) => { if (state.prefs.sound) env.audio.tone(o); };
  const layer = (kind) => {
    if (kind === 'free') return fx.free ?? (fx.free = makeLayer(PAGE.w * FREE_PAGES, PAGE.h, freeRes()));
    if (kind === 'hero') return fx.hero ?? (fx.hero = makeLayer(PAGE.w, PAGE.h, 0.8));
    return fx.lesson ?? (fx.lesson = makeLayer(PAGE.w, PAGE.h, 1.25));
  };
  const lesson = () => LESSONS[state.ps.li];
  const expected = (ps) => { const n = LESSONS[ps.li].strokes.length; for (let i = 0; i < n; i++) if (!ps.done.includes(i)) return i; return n; };

  // ---- the brush tools ---------------------------------------------------------------------------------------------------------------------------
  const dip = () => { state.brush.load = 1; state.brush.tone = state.ink.d; sfx({ freq: 150, to: 90, dur: 0.14, type: 'sine', vol: 0.06 }); };
  const water = () => { state.brush.tone = Math.max(0.1, state.brush.tone - 0.2); state.brush.load = Math.min(1, state.brush.load + 0.2); sfx({ freq: 520, to: 300, dur: 0.1, type: 'sine', vol: 0.04 }); };
  const cycleSize = () => { state.prefs.size = (state.prefs.size + 1) % BRUSH.sizes.length; savePrefs(); say(`${BRUSH.sizes[state.prefs.size].name} brush`, 1.2); };

  // ---- a practice session (lesson / Watch and Learn) ----------------------------------------------------------------------------------------------
  function newPractice(li, mode) {
    return { li, mode, strokes: [], res: [], done: [], cur: null, orderErrors: 0, overlay: 'none', paused: false, hintT: 0, coach: null, coachT: 0, finishT: -1, stars: 0, avg: 0, metrics: null, sealed: false, sealSel: 0, auto: mode === 'auto' ? { phase: 'think', t: 0, smp: null, n: 0, dur: 1, note: '', ghost: { x: 0, y: 0 } } : null };
  }
  function startPractice(li, mode = 'practice') {
    if (config.demo && li >= DEMO_LESSONS) { go('demo-limit'); return; }
    state.ps = newPractice(li, mode); state.sel = li; state.scene = 'practice'; state.sceneT = 0; state.fr = null;
    clearLayer(layer('lesson'));
    if (mode === 'auto') prepAuto(state.ps);
    env.monetization.track?.('lesson_start', { lesson: LESSONS[li].id, mode });
  }
  const strokeName = (l, i) => `${TYPES[l.strokes[i].type].cn} ${TYPES[l.strokes[i].type].name}`;
  function coachFor(ps) {
    const l = LESSONS[ps.li], e = expected(ps);
    if (ps.hintT > 0 && e < l.strokes.length) return `Stroke ${e + 1}: ${strokeName(l, e)}. ${TYPES[l.strokes[e].type].why}`;
    if (ps.coach && ps.coachT > 0) return ps.coach;
    if (e >= l.strokes.length) return 'Lesson complete.';
    if (state.brush.load <= 0.02) return 'The brush is empty. Tap Dip to load it with ink.';
    const want = l.strokes[e].tone;
    if (want && toneBand(state.brush.tone) !== want) return `Stroke ${e + 1} wants ${want} ink. ${want === 'pale' ? 'Touch the water.' : want === 'dark' ? 'Grind, then dip.' : 'Add water, or dip fresh ink.'}`;
    if (state.prefs.tip && ps.strokes.length === 0 && state.sceneT % 24 < 10) return 'Breathe in as you load the brush, out as you draw the stroke.';
    return `Stroke ${e + 1} of ${l.strokes.length}: ${strokeName(l, e)}. ${TYPES[l.strokes[e].type].why}`;
  }

  function commitStroke(ps, st, forceRes) {
    const l = LESSONS[ps.li], e = expected(ps);
    const r = forceRes ?? judgeStroke(l, e, st, new Set(ps.done));
    ps.done.push(r.chosen); if (!r.ordered) ps.orderErrors += 1;
    ps.strokes.push(st); ps.res.push(r);
    liveCommit(layer('lesson'));
    ps.cur = null;
    if (ps.mode !== 'auto') { ps.coach = r.msg; ps.coachT = 6; ps.hintT = 0; state.flash = { good: r.score >= 0.8, t: 0 }; }
    sfx({ freq: 190 + r.score * 90, to: 120, dur: 0.07, type: 'triangle', vol: 0.05 });
    if (ps.done.length >= l.strokes.length) ps.finishT = ps.mode === 'auto' ? -1 : 1.0;
  }
  function finishLesson(ps) {
    const l = LESSONS[ps.li], avg = ps.res.reduce((s, r) => s + r.score, 0) / Math.max(1, ps.res.length);
    ps.avg = avg; ps.stars = starsFor(avg, ps.orderErrors);
    const m = (k) => { const a = ps.res.filter((r) => r[k] !== null && r[k] !== undefined); return a.length ? a.reduce((s, r) => s + r[k], 0) / a.length : null; };
    ps.metrics = { shape: m('shape'), rhythm: m('rhythm'), order: m('order'), tone: m('tone') };
    if (ps.stars > (state.stars[l.id] ?? 0)) { state.stars[l.id] = ps.stars; storage.set('stars', state.stars); }
    if (ps.stars === 3 && state.prefs.guide === 2 && !state.mastered[l.id]) { state.mastered[l.id] = true; storage.set('mastered', state.mastered); }
    ps.overlay = 'result';
    for (let i = 0; i < ps.stars; i++) sfx({ freq: 520 + i * 160, dur: 0.18, type: 'sine', vol: 0.06 });
    env.monetization.track?.('lesson_end', { lesson: l.id, stars: ps.stars });
  }
  function undo(ps) {
    if (!ps.strokes.length || ps.cur) return;
    ps.strokes.pop(); ps.res.pop(); ps.done.pop(); ps.finishT = -1;
    ps.orderErrors = ps.res.filter((r) => !r.ordered).length; ps.coach = null;
    replay(layer('lesson'), ps.strokes, []);
  }

  const toPage = (P, x, y, offX = 0) => [Math.max(0, Math.min(PAGE.w, ((x - P.paper.x) / P.paper.w) * PAGE.w)) + offX, Math.max(0, Math.min(PAGE.h, ((y - P.paper.y) / P.paper.h) * PAGE.h))];
  function clearLive(L) { if (L.lctx) { L.lctx.save(); L.lctx.setTransform(1, 0, 0, 1, 0, 0); L.lctx.clearRect(0, 0, L.live.width, L.live.height); L.lctx.restore(); } L.liveOn = false; L.liveFrom = 0; }

  // painting with the pointer (practice and free share it)
  function paintPointer(sess, kind, input, P, dt) {
    const p = input.pointer, scrollX = kind === 'free' ? sess.scroll : 0, L = layer(kind === 'free' ? 'free' : 'lesson');
    if (!sess.cur && p.pressed && inRect(P.paper, p.x, p.y)) {
      if (kind === 'free' && sess.sealMode) { placeSeal(sess, toPage(P, p.x, p.y, scrollX)); return; }
      if (state.brush.load <= 0.01) { sess.coach = 'The brush is empty. Tap Dip to load it with ink.'; sess.coachT = 3; state.dipPulse = 1.2; sfx({ freq: 110, dur: 0.06, type: 'sine', vol: 0.04 }); return; }
      const [x, y] = toPage(P, p.x, p.y, scrollX), base = kind === 'free' ? 30 : lesson().base;
      sess.sm = { x: p.x, y: p.y }; sess.cur = beginStroke(state.brush, x, y, base, state.prefs.size);
      liveUpdate(L, sess.cur, sess.strokes.length * 13);
    } else if (sess.cur) {
      // Finger steadiness: the brush follows a lightly smoothed pointer (about one frame of lag), so a trembling fingertip does not make a zigzag line.
      const sm = sess.sm ?? (sess.sm = { x: p.x, y: p.y }), k = p.released ? 1 : 1 - Math.exp(-Math.max(dt, 1 / 120) * 38);
      sm.x += (p.x - sm.x) * k; sm.y += (p.y - sm.y) * k;
      const [x, y] = toPage(P, sm.x, sm.y, scrollX);
      if (p.down && !p.released) {
        strokeMove(sess.cur, state.brush, x, y, dt, pen.p);
        liveUpdate(L, sess.cur, sess.strokes.length * 13);
      } else {
        if (p.released) strokeMove(sess.cur, state.brush, x, y, dt, pen.p);
        endStroke(sess, kind, L);
      }
    }
    state.cursor.x = p.x; state.cursor.y = p.y; state.cursor.on = !!sess.cur;
  }
  function endStroke(sess, kind, L) {
    const st = strokeEnd(sess.cur, state.brush);
    liveUpdate(L, st, sess.strokes.length * 13);
    const tiny = st.len < 9;
    if (kind === 'free') {
      if (st.len < 3) { clearLive(L); sess.cur = null; return; }
      liveCommit(L); sess.strokes.push(st); sess.cur = null; sess.dirty = true;
      sfx({ freq: 170, to: 120, dur: 0.06, type: 'triangle', vol: 0.04 });
      return;
    }
    const e = expected(sess), tp = LESSONS[sess.li].strokes[e]?.type;
    if (e >= LESSONS[sess.li].strokes.length || (tiny && tp !== 'dian' && tp !== 'dot')) { clearLive(L); sess.cur = null; return; }
    commitStroke(sess, st);
  }

  // ---- Watch and Learn -------------------------------------------------------------------------------------------------------------------------------
  function prepAuto(ps) {
    const l = LESSONS[ps.li], e = expected(ps), a = ps.auto;
    a.phase = 'think'; a.t = 0; a.smp = null; a.n = 0; a.note = '';
    if (e >= l.strokes.length) return;
    const want = l.strokes[e].tone, notes = [];
    if (state.brush.load < 0.45) { dip(); notes.push('Dip the brush.'); }
    if (want && toneBand(state.brush.tone) !== want) { state.brush.tone = TONE_D[want]; notes.push(`Ink: ${want}.`); }
    a.note = notes.join(' ');
  }
  function updateAuto(dt) {
    const ps = state.ps, a = ps.auto, l = lesson(), e = expected(ps);
    if (ps.paused) return;
    a.t += dt;
    if (a.phase === 'end') { if (a.t > 3) nextAutoLesson(); return; }
    if (a.phase === 'think') { if (a.t >= state.prefs.think) { a.phase = 'reveal'; a.t = 0; const P = targetPath(l, e)[0]; a.ghost = { x: P[0], y: P[1] }; } return; }
    if (a.phase === 'reveal') {
      if (a.t >= 2) {
        const path = targetPath(l, e), smp = synthSamples(path, l.strokes[e].type, l.base * BRUSH.sizes[state.prefs.size].k, { load: state.brush.load });
        a.phase = 'act'; a.t = 0; a.smp = smp; a.n = 1; a.dur = Math.max(1.1, pathLen(path) / 300);
        ps.cur = { tone: state.brush.tone, s: [smp[0]], len: 0, done: false };
      }
      return;
    }
    if (a.phase === 'act') {
      const target = Math.min(a.smp.length, Math.max(1, Math.round((a.t / a.dur) * a.smp.length)));
      if (target > a.n) { for (let i = a.n; i < target; i++) ps.cur.s.push(a.smp[i]); a.n = target; liveUpdate(layer('lesson'), ps.cur, ps.strokes.length * 13); }
      const q = ps.cur.s[ps.cur.s.length - 1]; a.ghost = { x: q.x, y: q.y };
      if (a.n >= a.smp.length) {
        ps.cur.len = q.d; state.brush.load = q.l;
        commitStroke(ps, ps.cur, { chosen: e, shape: 1, rhythm: 1, order: 1, tone: null, score: 1, msg: '', ordered: true });
        if (ps.done.length >= l.strokes.length) { a.phase = 'end'; a.t = 0; } else prepAuto(ps);
      }
    }
  }
  function nextAutoLesson() {
    const ps = state.ps, lim = config.demo ? DEMO_LESSONS : LESSONS.length, ni = (ps.li + 1) % lim;
    state.ps = newPractice(ni, 'auto'); state.sel = ni; clearLayer(layer('lesson')); prepAuto(state.ps);
  }

  // ---- free scroll -----------------------------------------------------------------------------------------------------------------------------------------
  function startFree() {
    if (config.demo && state.demoRuns >= DEMO_FREE) { go('demo-limit'); return; }
    if (config.demo) { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    const fr = { strokes: [], seals: [], cur: null, scroll: 0, scrollTarget: 0, sealMode: false, sealSel: 0, coach: null, coachT: 0, overlay: 'none', dirty: false };
    const sv = state.savedFree;
    if (sv && Array.isArray(sv.strokes)) { fr.strokes = sv.strokes; fr.seals = sv.seals ?? []; }
    state.fr = fr; state.ps = null; state.scene = 'free'; state.sceneT = 0;
    replay(layer('free'), fr.strokes, fr.seals);
  }
  function saveFree() {
    const fr = state.fr; if (!fr || !fr.dirty) return;
    const thin = fr.strokes.reduce((n, s) => n + s.s.length, 0) > 4000 ? 3 : 1;
    const data = { strokes: fr.strokes.map((s) => (thin > 1 ? compactStroke(s, thin) : s)), seals: fr.seals };
    state.savedFree = data; storage.set('free', data); fr.dirty = false;
  }
  function placeSeal(sess, pt) {
    const seal = { k: SEALS[sess.sealSel].id, x: pt[0], y: pt[1], s: 76, r: rng.range(-0.09, 0.09), v: rng.int(5) };
    sess.seals.push(seal); stampSeal(layer('free'), seal); sess.sealMode = false; sess.dirty = true;
    sfx({ freq: 78, to: 52, dur: 0.16, type: 'sine', vol: 0.14 });
  }
  function keepWork(fromFree) {
    let work;
    if (fromFree) {
      const fr = state.fr;
      if (!fr.strokes.length) { say('Paint something first', 1.8); return; }
      work = { id: state.workSeq++, kind: 'free', title: 'Free scroll', strokes: fr.strokes.map((s) => compactStroke(s, 3)), seals: fr.seals.slice() };
    } else {
      const ps = state.ps, l = lesson();
      const seal = { k: SEALS[ps.sealSel].id, x: l.group === 'comp' ? 520 : 508, y: l.group === 'comp' ? 716 : 690, s: 76, r: rng.range(-0.09, 0.09), v: rng.int(5) };
      stampSeal(layer('lesson'), seal);
      work = { id: state.workSeq++, kind: 'lesson', lesson: l.id, title: `${l.cn} ${l.title}`, stars: ps.stars, strokes: ps.strokes.map((s) => compactStroke(s, 2)), seals: [seal] };
      ps.sealed = true; ps.overlay = 'after';
    }
    state.gallery.push(work);
    while (state.gallery.length > GALLERY_MAX) { const old = state.gallery.shift(); fx.thumbs.delete(old.id); }
    storage.set('gallery', state.gallery); storage.set('workSeq', state.workSeq);
    sfx({ freq: 78, to: 52, dur: 0.16, type: 'sine', vol: 0.14 });
    say('Kept in the gallery', 2);
  }

  // ---- grind ---------------------------------------------------------------------------------------------------------------------------------------------------
  const closeGrind = () => { state.grind = null; const s = state.ps ?? state.fr; if (s) s.overlay = 'none'; };
  function updateGrind(dt, input, tap) {
    const G = lay().grind, p = input.pointer, g = state.grind, s = G.stone;
    if (!g) { closeGrind(); return; }
    if ((tap && inRect(G.done, tap.x, tap.y)) || input.keys.pressed.has('Escape') || input.keys.pressed.has('Enter')) { closeGrind(); return; }
    if (p.down) {
      const ang = Math.atan2((p.y - s.y) / s.ry, (p.x - s.x) / s.rx), rad = Math.hypot((p.x - s.x) / s.rx, (p.y - s.y) / s.ry);
      g.stick = { x: p.x, y: p.y };
      if (g.last !== null && rad > 0.15 && rad < 1.15) {
        let da = ang - g.last; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
        const dd = Math.abs(da); state.ink.d = Math.min(1, state.ink.d + dd * 0.012); g.turned += dd;
        if (g.turned > 0.9) { g.turned = 0; sfx({ freq: 85 + rng.range(0, 25), dur: 0.09, type: 'sawtooth', vol: 0.018 }); }
      }
      g.last = ang;
    } else g.last = null;
  }

  // ---- overlays: result / pause --------------------------------------------------------------------------------------------------------------------------------
  const pauseItems = () => {
    const ps = state.ps, fr = state.fr;
    if (fr) return [['resume', 'Resume'], ['clear', 'Clear the scroll'], ['rules', 'Rules'], ['exit', 'Save and leave']];
    if (ps && ps.mode === 'auto') return [['resume', 'Resume'], ['rules', 'Rules'], ['exit', 'Leave Watch and Learn']];
    return [['resume', 'Resume'], ['retry', 'Start the lesson again'], ['rules', 'Rules'], ['exit', 'Back to lessons']];
  };
  function pauseAction(id) {
    const ps = state.ps, fr = state.fr, sess = ps ?? fr;
    if (id === 'resume') { sess.overlay = 'none'; if (ps) ps.paused = false; }
    else if (id === 'retry') startPractice(ps.li, 'practice');
    else if (id === 'clear') { fr.strokes = []; fr.seals = []; fr.dirty = true; clearLayer(layer('free')); fr.overlay = 'none'; saveFree(); }
    else if (id === 'rules') openDoc('rules', state.scene === 'free' ? 'free' : 'practice');
    else if (id === 'exit') go(fr ? 'title' : ps.mode === 'auto' ? 'title' : 'lessons');
  }
  function updatePauseMenu(tap) {
    if (!tap) return;
    const items = pauseItems(), M = menuRects(lay(), items.length, 130);
    items.forEach(([id], i) => { if (inRect(M.btns[i], tap.x, tap.y)) pauseAction(id); });
  }
  function updateResult(tap) {
    const ps = state.ps, R = lay().result;
    if (!tap) return;
    if (inRect(R.retry, tap.x, tap.y)) { startPractice(ps.li, 'practice'); return; }
    if (inRect(R.next, tap.x, tap.y)) { const ni = ps.li + 1; if (ni < LESSONS.length) startPractice(ni, 'practice'); else go('lessons'); return; }
    if (inRect(R.keep, tap.x, tap.y)) { if (!ps.sealed) keepWork(false); return; }
    if (inRect(R.menu, tap.x, tap.y)) { go('lessons'); return; }
    R.seals.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) { ps.sealSel = i; sfx({ freq: 420, dur: 0.05, type: 'sine', vol: 0.04 }); } });
  }

  // ---- practice / free update --------------------------------------------------------------------------------------------------------------------------------
  function toolTap(kind, id) {
    const sess = kind === 'free' ? state.fr : state.ps;
    if (id === 'dip') dip();
    else if (id === 'water') water();
    else if (id === 'grind') { state.grind = { last: null, stick: null, turned: 0 }; sess.overlay = 'grind'; }
    else if (id === 'size') cycleSize();
    else if (id === 'guide') { state.prefs.guide = (state.prefs.guide + 1) % 3; savePrefs(); say(`Guide: ${GUIDES[state.prefs.guide]}`, 1.2); }
    else if (id === 'undo') { if (kind === 'free') { if (sess.strokes.length) { sess.strokes.pop(); sess.dirty = true; replay(layer('free'), sess.strokes, sess.seals); } } else undo(sess); }
    else if (id === 'hint') sess.hintT = 5;
    else if (id === 'seal') { sess.sealMode = !sess.sealMode; if (sess.sealMode) say('Choose a seal, then tap the paper', 2.2); }
    else if (id === 'left') sess.scrollTarget = Math.max(0, Math.round(sess.scrollTarget / PAGE.w) * PAGE.w - PAGE.w);
    else if (id === 'right') sess.scrollTarget = Math.min(PAGE.w * (FREE_PAGES - 1), Math.round(sess.scrollTarget / PAGE.w) * PAGE.w + PAGE.w);
    else if (id === 'keep') keepWork(true);
    else if (id === 'pause') sess.paused = !sess.paused;
    else if (id === 'skip') nextAutoLesson();
  }
  function updatePlayScene(dt, input, tap, kind) {
    const sess = kind === 'free' ? state.fr : state.ps, L = lay(), P = L.play;
    if (!sess) return;
    const k = input.keys.pressed;
    if (sess.overlay === 'result') { updateResult(tap); return; }
    if (sess.overlay === 'grind') { updateGrind(dt, input, tap); return; }
    if (sess.overlay === 'pause') { updatePauseMenu(tap); if (k.has('Escape')) { sess.overlay = 'none'; if (state.ps) state.ps.paused = false; } return; }
    if (sess.overlay === 'after') {
      if (tap) {
        const half = P.coach.w / 2;
        if (inRect({ x: P.coach.x, y: P.coach.y, w: half - 6, h: P.coach.h }, tap.x, tap.y)) startPractice(sess.li, 'practice');
        else if (inRect({ x: P.coach.x + half + 6, y: P.coach.y, w: half - 6, h: P.coach.h }, tap.x, tap.y)) { const ni = sess.li + 1; if (ni < LESSONS.length) startPractice(ni, 'practice'); else go('lessons'); }
        else if (inRect(P.menu, tap.x, tap.y)) go('lessons');
      }
      return;
    }
    const auto = kind === 'practice' && sess.mode === 'auto';
    if (tap) {
      if (inRect(P.menu, tap.x, tap.y)) { sess.overlay = 'pause'; if (state.ps) state.ps.paused = true; return; }
      const ids = auto ? TOOLS.auto : kind === 'free' ? TOOLS.free : TOOLS.practice;
      for (let i = 0; i < ids.length; i++) if (P.tools[i] && inRect(P.tools[i], tap.x, tap.y)) { toolTap(kind, ids[i]); return; }
      if (kind === 'free' && sess.sealMode) for (let i = 0; i < P.seals.length; i++) if (inRect(P.seals[i], tap.x, tap.y)) { sess.sealSel = i; sfx({ freq: 420, dur: 0.05, type: 'sine', vol: 0.04 }); return; }
    }
    if (k.has('Escape')) { sess.overlay = 'pause'; if (state.ps) state.ps.paused = true; return; }
    if (k.has('Space')) { if (auto) sess.paused = !sess.paused; else { sess.overlay = 'pause'; if (state.ps) state.ps.paused = true; } }
    if (!auto) {
      if (k.has('KeyD')) dip();
      if (k.has('KeyW')) water();
      if (k.has('KeyG')) toolTap(kind, 'grind');
      if (k.has('KeyU')) toolTap(kind, 'undo');
      if (k.has('KeyH') && kind === 'practice') toolTap(kind, 'hint');
      if (k.has('BracketLeft')) { state.prefs.size = Math.max(0, state.prefs.size - 1); savePrefs(); }
      if (k.has('BracketRight')) { state.prefs.size = Math.min(BRUSH.sizes.length - 1, state.prefs.size + 1); savePrefs(); }
    }
    if (kind === 'free') {
      if (k.has('ArrowLeft')) toolTap(kind, 'left');
      if (k.has('ArrowRight')) toolTap(kind, 'right');
      const d = sess.scrollTarget - sess.scroll; sess.scroll += Math.abs(d) < 1 ? d : d * Math.min(1, dt * 9);
    }
    if (sess.coachT > 0) sess.coachT -= dt;
    if (sess.hintT > 0) sess.hintT -= dt;
    if (state.dipPulse > 0) state.dipPulse -= dt;
    if (state.flash) { state.flash.t += dt; if (state.flash.t > 1) state.flash = null; }
    if (auto) { updateAuto(dt); return; }
    if (kind === 'practice' && sess.finishT >= 0) { sess.finishT -= dt; if (sess.finishT < 0) finishLesson(sess); return; }
    paintPointer(sess, kind, input, P, dt);
  }

  // ---- title hero: the brush paints a character by itself ----------------------------------------------------------------------------------------------------
  function tickHero(dt) {
    const h = state.hero, l = LESSONS.find((q) => q.id === HERO[h.ci]);
    if (h.end > 0) { h.end -= dt; if (h.end <= 0) { h.ci = (h.ci + 1) % HERO.length; h.si = 0; h.u = 0; clearLayer(layer('hero')); } return; }
    if (h.pause > 0) { h.pause -= dt; return; }
    const L = layer('hero'), path = targetPath(l, h.si), len = pathLen(path), smp = synthSamples(path, l.strokes[h.si].type, l.base, {});
    const prevN = Math.round(h.u * smp.length);
    h.u = Math.min(1, h.u + (dt * 270) / len);
    const n = Math.max(1, Math.round(h.u * smp.length));
    if (n > prevN || prevN === 0) {
      if (prevN === 0) { L.liveOn = true; L.liveFrom = 0; L.liveTone = 0.95; }
      liveUpdate(L, { s: smp.slice(0, n), tone: 0.95 }, h.si * 17);
    }
    const q = smp[Math.min(smp.length - 1, n - 1)]; h.x = q.x; h.y = q.y;
    if (h.u >= 1) { liveCommit(L); h.si += 1; h.u = 0; if (h.si >= l.strokes.length) h.end = 3.2; else h.pause = 0.4; }
  }

  // ---- docs / lists --------------------------------------------------------------------------------------------------------------------------------------------
  function openDoc(key, back) { state.docKey = key; state.backTo = back; state.docScroll = 0; state.docFrac = 0; if (key !== 'rules') state.rulesPage = 0; state.scene = key; state.sceneT = 0; drag = null; }
  function settingsAction(id) {
    const p = state.prefs;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'size') p.size = (p.size + 1) % BRUSH.sizes.length;
    else if (id === 'guide') p.guide = (p.guide + 1) % 3;
    else if (id === 'thinkDec') p.think = Math.max(1, p.think - 1);
    else if (id === 'thinkInc') p.think = Math.min(10, p.think + 1);
    else if (id === 'tip') p.tip = !p.tip;
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    savePrefs();
  }
  function backFromDoc() {
    const b = state.backTo;
    if (b === 'practice' || b === 'free') { state.scene = b; const s = b === 'free' ? state.fr : state.ps; if (s) s.overlay = 'pause'; return; }
    if (b === 'settings') { openDoc('settings', 'title'); return; }
    go(b);
  }
  function docAction(id) {
    if (id === 'back') { backFromDoc(); return; }
    if (id === 'textDec' || id === 'textInc') {
      const n = state.prefs.textIdx + (id === 'textInc' ? 1 : -1);
      if (n < 0 || n >= TEXT_SCALES.length) return;
      state.docFrac = docMetrics.max > 0 ? state.docScroll / docMetrics.max : 0; state.docRescale = true; state.prefs.textIdx = n; savePrefs(); return;
    }
    if (id === 'prev') { if (state.rulesPage > 0) { state.rulesPage -= 1; state.docScroll = 0; } return; }
    if (id === 'next') { if (state.rulesPage < RULES.length - 1) { state.rulesPage += 1; state.docScroll = 0; } else backFromDoc(); return; }
    if (id.startsWith('set:')) settingsAction(id.slice(4));
  }
  function updateDoc(input) {
    const p = input.pointer, max = docMetrics.max, view = ui.view;
    const setScroll = (v) => { state.docScroll = Math.max(0, Math.min(v, max)); };
    const wy = input.wheel?.dy || 0; if (wy) setScroll(state.docScroll + wy);
    const k = input.keys.pressed;
    if (k.has('ArrowDown')) setScroll(state.docScroll + 70);
    if (k.has('ArrowUp')) setScroll(state.docScroll - 70);
    if (k.has('PageDown')) setScroll(state.docScroll + docMetrics.view * 0.9);
    if (k.has('PageUp')) setScroll(state.docScroll - docMetrics.view * 0.9);
    if (k.has('Escape')) { backFromDoc(); return; }
    if (p.pressed) drag = { x0: p.x, y0: p.y, s0: state.docScroll, moved: false, inView: inRect(view, p.x, p.y) };
    if (drag && p.down) { if (Math.abs(p.y - drag.y0) > 14) drag.moved = true; if (drag.moved && drag.inView) setScroll(drag.s0 - (p.y - drag.y0)); }
    if (drag && p.released) {
      const d = drag; drag = null;
      if (d.moved) return;
      for (const h of ui.hits) { if (!inRect(h.r, d.x0, d.y0)) continue; if (h.clip && !inRect(h.clip, d.x0, d.y0)) continue; docAction(h.id); return; }
    }
  }

  function updateTitle(tap) {
    if (!tap) return;
    const T = lay().title, hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(T.play)) go('lessons');
    else if (hit(T.free)) startFree();
    else if (hit(T.gallery)) { state.galScroll = 0; go('gallery'); }
    else if (hit(T.auto)) startPractice(Math.max(0, Math.min(state.sel, config.demo ? DEMO_LESSONS - 1 : LESSONS.length - 1)), 'auto');
    else if (hit(T.how)) openDoc('howto', 'title');
    else if (hit(T.rules)) openDoc('rules', 'title');
    else if (hit(T.about)) openDoc('about', 'title');
    else if (hit(T.settings)) openDoc('settings', 'title');
    else if (tap.y > T.credit.y - 90 && Math.abs(tap.x - T.credit.x) < 190) env.openArcforgeHome?.();
  }
  // scrolling lists (lessons, gallery): drag to scroll, tap to choose
  function listPointer(input, key, viewRect, totalH, onTap) {
    const p = input.pointer, wy = input.wheel?.dy || 0, maxS = Math.max(0, totalH - viewRect.h);
    if (wy) state[key] = Math.max(0, Math.min(maxS, state[key] + wy));
    if (p.pressed) drag = { x0: p.x, y0: p.y, s0: state[key], moved: false, inView: inRect(viewRect, p.x, p.y) };
    if (drag && p.down) { if (Math.abs(p.y - drag.y0) > 14) drag.moved = true; if (drag.moved && drag.inView) state[key] = Math.max(0, Math.min(maxS, drag.s0 - (p.y - drag.y0))); }
    if (drag && p.released) { const d = drag; drag = null; if (!d.moved && d.inView) onTap(d.x0, d.y0); }
    state[key] = Math.max(0, Math.min(maxS, state[key]));
  }
  function updateLessons(input) {
    const G = lay().lessons, it = lessonItems(lay(), LESSONS, GROUPS);
    if (input.keys.pressed.has('Escape')) { go('title'); return; }
    if (input.pointer.pressed && inRect(G.back, input.pointer.x, input.pointer.y)) { go('title'); return; }
    listPointer(input, 'listScroll', G.view, it.total, (x, y) => {
      const ly = y - G.view.y + state.listScroll, lx = x - G.view.x;
      for (const q of it.items) if (lx >= q.r.x && lx <= q.r.x + q.r.w && ly >= q.r.y && ly <= q.r.y + q.r.h) { startPractice(LESSONS.findIndex((l) => l.id === q.id), 'practice'); return; }
    });
  }
  const galCells = () => { const G = lay().gallery, c = G.cell; return state.gallery.slice().reverse().map((w, i) => ({ w, x: c.x + (i % G.cols) * (c.w + c.gap), y: Math.floor(i / G.cols) * (c.h + c.gap) })); };
  const galTotal = () => { const G = lay().gallery; return Math.ceil(Math.max(1, state.gallery.length) / G.cols) * (G.cell.h + G.cell.gap) + 20; };
  function updateGallery(input) {
    const G = lay().gallery;
    if (input.keys.pressed.has('Escape')) { go('title'); return; }
    if (input.pointer.pressed && inRect(G.back, input.pointer.x, input.pointer.y)) { go('title'); return; }
    listPointer(input, 'galScroll', G.view, galTotal(), (x, y) => {
      const c = G.cell, ly = y - G.view.y + state.galScroll;
      for (const cell of galCells()) if (x >= cell.x && x <= cell.x + c.w && ly >= cell.y && ly <= cell.y + c.h) { state.work = cell.w.id; state.scene = 'work'; state.sceneT = 0; return; }
    });
  }
  function updateWork(tap) {
    const G = lay().gallery;
    if (!tap) return;
    if (inRect(G.back, tap.x, tap.y)) { state.scene = 'gallery'; return; }
    if (inRect(G.del, tap.x, tap.y)) {
      const i = state.gallery.findIndex((w) => w.id === state.work);
      if (i >= 0) { fx.thumbs.delete(state.work); state.gallery.splice(i, 1); storage.set('gallery', state.gallery); }
      state.scene = 'gallery';
    }
  }

  // ---- the object the kit and main.js see ------------------------------------------------------------------------------------------------------------------------------
  const api = {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'title') { updateTitle(tap); tickHero(dt); }
      else if (sc === 'lessons') updateLessons(input);
      else if (sc === 'practice') updatePlayScene(dt, input, tap, 'practice');
      else if (sc === 'free') updatePlayScene(dt, input, tap, 'free');
      else if (sc === 'gallery') updateGallery(input);
      else if (sc === 'work') updateWork(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height, nTools(), 0), view, meta, { layer, fx, pauseItems, galCells, galTotal, TOOLS, DEMO_LESSONS, coachFor, modelImage }); },
    getState: () => state,
    autoPause() {
      if (state.scene === 'practice' && state.ps && state.ps.overlay === 'none') { state.ps.overlay = 'pause'; state.ps.paused = true; }
      else if (state.scene === 'free' && state.fr && state.fr.overlay === 'none') state.fr.overlay = 'pause';
    },
    // Everything except real painting is free: menus, Rules, Watch and Learn, grinding, results, the gallery, pause.
    isPreviewExempt() {
      const ps = state.ps, fr = state.fr;
      if (state.scene === 'practice' && ps) return ps.mode === 'auto' || ps.overlay !== 'none' || ps.paused;
      if (state.scene === 'free' && fr) return fr.overlay !== 'none';
      return true;
    },
    // Tester tools (?dev=1): jump to a screen with a lesson part-painted by a human-looking hand.
    dev: {
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        const sc = o.scene ?? 'title';
        const li = o.lesson !== undefined ? (typeof o.lesson === 'string' ? LESSONS.findIndex((l) => l.id === o.lesson) : o.lesson) : state.sel;
        const hand = (ps, n) => {
          dip();
          const l = LESSONS[ps.li];
          for (let i = 0; i < n && i < l.strokes.length; i++) {
            if (state.brush.load < 0.5) dip();
            if (l.strokes[i].tone) state.brush.tone = TONE_D[l.strokes[i].tone];
            const path = targetPath(l, i).map((q, j) => [q[0] + Math.sin(j * 0.35 + i) * 1.8, q[1] + Math.cos(j * 0.3 + i * 2) * 1.8]);
            const smp = synthSamples(path, l.strokes[i].type, l.base * BRUSH.sizes[state.prefs.size].k, { load: state.brush.load, k: 1 + Math.sin(i) * 0.06 });
            const st = { tone: state.brush.tone, s: smp, len: smp[smp.length - 1].d };
            state.brush.load = smp[smp.length - 1].l;
            ps.cur = st; liveUpdate(layer('lesson'), st, ps.strokes.length * 13); commitStroke(ps, st);
          }
          ps.coachT = 0; state.flash = null; state.brush.tone = state.ink.d; state.brush.load = Math.max(state.brush.load, 0.6);
        };
        if (sc === 'practice' || sc === 'result' || sc === 'auto') {
          startPractice(li, sc === 'auto' ? 'auto' : 'practice'); const ps = state.ps;
          if (sc === 'auto') { if (o.strokes) { hand(ps, o.strokes); prepAuto(ps); } }
          else { hand(ps, o.strokes ?? (sc === 'result' ? 99 : 1)); if (sc === 'result') { ps.finishT = -1; finishLesson(ps); } }
          if (o.hint) ps.hintT = 5;
          if (o.pause) { ps.overlay = 'pause'; ps.paused = true; }
          if (o.grind) { state.grind = { last: null, stick: { x: 400, y: 700 }, turned: 0 }; ps.overlay = 'grind'; state.ink.d = 0.78; }
        } else if (sc === 'free') {
          startFree(); const fr = state.fr; dip();
          const paint = (id, n, sx, sy, kx, ky, base) => {
            const l = LESSONS.find((q) => q.id === id);
            for (let i = 0; i < n; i++) {
              const path = targetPath(l, i).map((q) => [q[0] * kx + sx, q[1] * ky + sy]), smp = synthSamples(path, l.strokes[i].type, base, { load: 1 });
              fr.strokes.push({ tone: TONE_D[l.strokes[i].tone] ?? 0.9, s: smp, len: smp[smp.length - 1].d });
            }
          };
          if (o.strokes !== 0) { paint('orchid', 8, 40, 20, 0.5, 0.9, 22); paint('plum', 5, 640, 30, 0.5, 0.9, 20); fr.seals.push({ k: 'plum', x: 1060, y: 700, s: 76, r: 0.05, v: 2 }); }
          replay(layer('free'), fr.strokes, fr.seals);
          if (o.scroll) { fr.scroll = fr.scrollTarget = PAGE.w * o.scroll; }
          if (o.sealMode) fr.sealMode = true;
        } else if (sc === 'lessons') { state.scene = 'lessons'; state.listScroll = o.scroll ?? 0; state.stars = { heng: 3, shu: 2, dian: 1, yi: 3, san: 2 }; state.mastered = { heng: true }; }
        else if (sc === 'gallery' || sc === 'work') {
          for (const id of ['da', 'bamboo', 'mu', 'plum', 'shan']) {
            startPractice(LESSONS.findIndex((q) => q.id === id), 'practice'); const ps = state.ps; hand(ps, 99); ps.finishT = -1; finishLesson(ps); keepWork(false);
          }
          state.ps = null; state.scene = sc; if (sc === 'work') state.work = state.gallery[state.gallery.length - 1].id;
        } else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else { state.scene = sc; state.sceneT = 0; }
        if (o.advance) {
          const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
          for (let i = 0; i < o.advance * 60; i++) api.update(1 / 60, idle);
        }
      },
    },
  };
  return api;
}
