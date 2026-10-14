// Kamishibai: state and flow. Rules = engine.js, tales = stories.js, pictures = art.js, drawing = view.js, geometry = layout.js.
import { playLayout, titleLayout, docLayout, settingsLayout, listLayout, journeyRects, freeRects, overLayout, pauseLayout, flipRect, tabCenter, inRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { STORIES, STORY_IDS, CHAPTERS, beatFor } from './stories.js';
import { newSession, swap, undo, check, findHint, isSolvedOrder, newShow, gradeOf, ATT_DELTA, LATE_DRAIN, starsFor, score } from './engine.js';
import { render, metrics, settingsRows } from './view.js';
import { DOCS, FACTS } from './content.js';
import { setLook, LOOK_IDS } from './ui.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_TALES = 3;
const DEFAULT_PREFS = { look: 'lantern', ring: true, caps: true, sound: true, calm: false, textIdx: 0, thinkIdx: 1 };
const JOURNEY_TIER = [0, 1, 1, 2];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ORDER = CHAPTERS.flatMap((c, ci) => c.tales.map((id) => ({ id, ci })));
const hash = (a, b = 0) => { let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; return h >>> 0; };
function seeded(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, shuffle: (arr) => { const o = arr.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; } };
}
const AUTO_OFFS = [0.02, -0.08, 0.1, 0, -0.05, 0.07];

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS },
    P: null, show: null, sel: -1, cursor: 0, drag: null, hint: null, paused: false,
    auto: { on: false, phase: null, timer: 0, paused: false, n: 0, done: false },
    fx: { shake: {}, lock: {} }, sfx: [], msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0 }, back: 'title', result: null,
    pullAnim: null, pullDrag: null, lastGrade: null, cheerT: 0, beginT: 0, endT: 0, winAt: 0, toOver: false,
    progress: {}, stats: { told: 0, perfect: 0, best: {}, days: [], bestStreak: 0 }, saved: null, unlocked: {},
    daily: { day: config.day ?? 0 }, streak: 0, dailyDone: false, dailyStory: 'kite', demoCount: 0, saveAcc: 0, dev: config.dev === true, demo: config.demo === true, owned: false, restoreBusy: false, restoreMsg: '',
  };
  let saveRaw = null, gesture = null, scrollG = null;

  // ---- persistence -------------------------------------------------------------------------------------------------------------
  const applyPrefs = () => { setLook(S.prefs.look); audio.setMuted?.(!S.prefs.sound); };
  const savePrefs = () => storage.set('prefs', S.prefs);
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); if (!LOOK_IDS.includes(S.prefs.look)) S.prefs.look = 'lantern'; } applyPrefs(); });
  storage.get('progress', null).then((v) => { if (v) { S.progress = { ...v, ...S.progress }; refreshUnlocked(); } });
  storage.get('stats', null).then((v) => { if (v) S.stats = { ...S.stats, ...v, days: v.days ?? [], best: v.best ?? {} }; refreshDaily(); });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  storage.get('save', null).then((v) => { if (v && v.story && STORIES[v.story] && S.scene === 'title' && !S.P) { saveRaw = v; S.saved = { story: v.story, phase: v.phase, kind: v.kind }; } });
  applyPrefs();
  S.owned = !!monetization.owns?.('unlock_game');
  monetization.onChange?.(() => { S.owned = !!monetization.owns?.('unlock_game'); });

  function refreshUnlocked() {
    ORDER.forEach((o, i) => { S.unlocked[o.id] = S.dev || config.demo || i === 0 || !!S.progress[o.id] || !!S.progress[ORDER[i - 1].id]; });
  }
  function refreshDaily() {
    const day = S.daily.day, set = new Set(S.stats.days);
    let streak = 0, d = set.has(day) ? day : day - 1;
    while (set.has(d)) { streak += 1; d -= 1; }
    S.streak = streak; S.dailyDone = set.has(day); S.dailyStory = STORY_IDS[hash(day, 77) % STORY_IDS.length];
  }
  refreshDaily(); refreshUnlocked();
  function persistSession() {
    const P = S.P;
    if (!P || P.phase === 'done' || S.auto.on) return;
    saveRaw = { story: P.story, tier: P.tier, kind: P.kind, ref: P.ref, order: P.order.slice(), locked: P.locked.slice(), tries: P.tries, hints: P.hints, phase: P.phase, i: S.show ? S.show.i : 0, day: P.day };
    S.saved = { story: P.story, phase: P.phase, kind: P.kind };
    storage.set('save', saveRaw);
  }
  const clearSave = () => { saveRaw = null; S.saved = null; storage.remove('save'); };

  // ---- sound -------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound && !S.auto.on) audio.tone(o); };
  const later = (t, o) => S.sfx.push({ t, o });
  const PENT = [0, 2, 4, 7, 9, 12];
  const sfx = {
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.06 }),
    swap: () => tone({ freq: 300, to: 420, dur: 0.07, type: 'triangle', vol: 0.09 }),
    lock: (k) => tone({ freq: 392 * 2 ** (PENT[k % 6] / 12), to: 392 * 2 ** (PENT[k % 6] / 12), dur: 0.3, type: 'triangle', vol: 0.1 }),
    err: () => tone({ freq: 190, to: 130, dur: 0.14, type: 'triangle', vol: 0.08 }),
    clap: () => { tone({ freq: 1500, to: 900, dur: 0.04, type: 'square', vol: 0.09 }); later(0.16, { freq: 1500, to: 900, dur: 0.04, type: 'square', vol: 0.09 }); },
    // paper sliding out of the box: a short breathy swish (two detuned saws sweeping down) with a soft wooden tick at the end
    pull: () => { tone({ freq: 2600, to: 700, dur: 0.22, type: 'sawtooth', vol: 0.018 }); tone({ freq: 2100, to: 520, dur: 0.24, type: 'sawtooth', vol: 0.014 }); later(0.2, { freq: 420, to: 300, dur: 0.05, type: 'triangle', vol: 0.05 }); },
    perfect: () => { [784, 988, 1175].forEach((f, i) => later(0.02 + i * 0.07, { freq: f, to: f, dur: 0.22, type: 'sine', vol: 0.09 })); },
    good: () => tone({ freq: 660, to: 700, dur: 0.18, type: 'sine', vol: 0.08 }),
    bad: () => tone({ freq: 240, to: 150, dur: 0.2, type: 'sawtooth', vol: 0.05 }),
    win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => later(i * 0.12, { freq: f, to: f, dur: 0.45, type: 'triangle', vol: 0.09 })); },
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.08 }),
  };

  // ---- helpers -----------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.6) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; gesture = null; scrollG = null; S.drag = null; wheelInput.dy = 0; S.msg = null; }
  const mode = () => (S.P && S.P.phase === 'perform' ? 'perform' : 'arrange');
  const L = () => playLayout(meta.width, meta.height, { n: S.P ? S.P.n : 4, mode: mode(), coach: !!(S.hint || (S.auto.on && mode() === 'arrange')) });
  const frozen = () => S.paused || (S.auto.on && S.auto.paused);

  // ---- starting tales ----------------------------------------------------------------------------------------------------------
  function begin(P, auto = false) {
    S.P = P; S.show = null; S.sel = -1; S.cursor = 0; S.drag = null; S.hint = null; S.paused = false; S.msg = null; S.pullAnim = null; S.pullDrag = null; S.lastGrade = null; S.cheerT = 0; S.beginT = 0; S.endT = 0; S.toOver = false;
    S.auto = { on: auto, phase: null, timer: 0, paused: false, n: 0, done: false };
    S.fx = { shake: {}, lock: {} }; S.result = null; S.saveAcc = 0;
    go('play');
  }
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_TALES) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }
  function startTale(story, tier, kind = 'free', ref = '', seedRng = null) {
    if (demoBlocked()) return;
    const P = newSession({ story, tier, rng: seedRng ?? rng, kind, ref: ref || `${story}:${tier}` });
    begin(P);
    persistSession();
  }
  function startJourney(id) {
    if (!S.unlocked[id]) { say('Tell the previous tale first.', 2); return; }
    const o = ORDER.find((q) => q.id === id);
    startTale(id, JOURNEY_TIER[o.ci], 'journey', id);
  }
  function startDaily() {
    const day = S.daily.day, st = S.dailyStory, tier = hash(day, 5) % 3;
    startTale(st, tier, 'daily', `day:${day}`, seeded(day * 7919 + 13));
    if (S.P) S.P.day = day;
  }
  function resumeSaved() {
    const v = saveRaw;
    if (!v) return;
    const P = newSession({ story: v.story, tier: v.tier, rng: seeded(1), kind: v.kind, ref: v.ref });
    P.order = v.order.slice(); P.locked = v.locked.slice(); P.tries = v.tries; P.hints = v.hints; P.day = v.day;
    begin(P);
    if (v.phase === 'perform') { P.solved = true; startShow(); S.show.i = clamp(v.i | 0, 0, P.n - 1); S.show.beat = beatFor(STORIES[P.story].cards[S.show.i]); }
    say('Welcome back.', 1.6);
  }
  function startAuto() {
    const id = STORY_IDS[rng.int(4)];   // gentle, short tales
    const P = newSession({ story: id, tier: 1, rng, kind: 'auto' });
    begin(P, true);
    say('Watch the storyteller arrange the cards and tell the tale.', 2.4);
  }

  // ---- arranging ---------------------------------------------------------------------------------------------------------------
  function doSwap(a, b) {
    const P = S.P;
    if (P.locked[a] || P.locked[b]) { S.fx.shake[P.locked[a] ? a : b] = 0; sfx.err(); say('A gold-edged card is already in place.', 1.6); return false; }
    if (!swap(P, a, b)) return false;
    sfx.swap(); S.hint = null; S.sel = -1; persistSession();
    return true;
  }
  function doCheck() {
    const P = S.P;
    if (P.locked.every(Boolean)) return;
    const r = check(P);
    S.hint = null; S.sel = -1;
    r.fresh.forEach((i, k) => { S.fx.lock[i] = -k * 0.07; later(k * 0.09, { freq: 392 * 2 ** (PENT[k % 6] / 12), to: 392 * 2 ** (PENT[k % 6] / 12), dur: 0.3, type: 'triangle', vol: 0.1 }); });
    r.wrong.forEach((i) => { S.fx.shake[i] = 0; });
    if (r.wrong.length) { sfx.err(); say(r.fresh.length ? `${r.fresh.length} in place. The others are still mixed up.` : 'None of those are right yet. Look at the clues again.', 2.4); }
    persistSession();
    if (r.solved) { S.beginT = 1.3; sfx.win(); say('Every card is hung. Time to tell the tale.', 2.4); }
  }
  function makeHint() {
    const h = findHint(S.P);
    return h ? { stage: 'look', h, text: h.look } : null;
  }
  function askHint() {
    const h = makeHint();
    if (!h) { say('Every card is already in place.'); return; }
    S.P.hints += 1; S.hint = h; S.sel = -1; sfx.hint();
  }
  function applyHint() {
    const P = S.P, h = S.hint.h;
    S.hint = null;
    if (P.order[h.slot] !== h.card) { P.undo.push(P.order.slice()); [P.order[h.slot], P.order[h.from]] = [P.order[h.from], P.order[h.slot]]; }
    P.locked[h.slot] = true; S.fx.lock[h.slot] = 0; sfx.lock(0);
    if (P.locked.every(Boolean) || isSolvedOrder(P)) { P.locked = P.locked.map(() => true); P.solved = true; S.beginT = 1.0; }
    persistSession();
  }
  function hintGo() {
    const h = S.hint;
    if (!h) return;
    if (h.stage === 'look') { h.stage = 'explain'; h.text = h.h.why; sfx.tap(); return; }
    applyHint();
  }
  function startShow() {
    const P = S.P;
    P.phase = 'perform'; S.show = newShow(P); S.show.wait = 1.1; S.sel = -1; S.hint = null; S.beginT = 0;
    sfx.clap(); persistSession();
  }

  // ---- performing --------------------------------------------------------------------------------------------------------------
  function pull(dir = 1) {
    const sh = S.show, P = S.P;
    if (!sh || sh.done || sh.failed || sh.wait > 0 || S.pullAnim) return;
    const err = sh.t - sh.beat, grade = gradeOf(err);
    const f = P.tier === 2 && ATT_DELTA[grade] > 0 ? 0.75 : 1;
    sh.att = clamp(sh.att + ATT_DELTA[grade] * f, 0, 5);
    if (P.tier === 0) sh.att = Math.max(sh.att, 1);
    sh.lowest = Math.min(sh.lowest, sh.att);
    sh.grades.push(grade); sh.errs.push(Math.round(err * 100) / 100);
    S.lastGrade = { grade, t: 0 }; S.pullAnim = { card: sh.i, t: 0, dir };
    if (grade === 'perfect') { S.cheerT = 1.2; sfx.perfect(); } else if (grade === 'good') { S.cheerT = 0.6; sfx.good(); } else sfx.bad();
    sfx.pull();
    sh.i += 1; sh.t = 0;
    if (sh.i >= P.n) { sh.done = true; S.endT = 1.4; }
    else sh.beat = beatFor(STORIES[P.story].cards[sh.i]);
    persistSession();
  }
  function showTick(dt) {
    const sh = S.show, P = S.P;
    if (sh.done || sh.failed) return;
    if (sh.wait > 0) { sh.wait -= dt; return; }
    if (S.pullAnim) return;
    sh.t += dt;
    if (sh.t > sh.beat + 1.3) sh.att = Math.max(P.tier === 0 ? 1 : 0, sh.att - (P.tier === 2 ? 0.5 : LATE_DRAIN) * dt);
    sh.lowest = Math.min(sh.lowest, sh.att);
    if (sh.att <= 0 && P.tier > 0 && !S.auto.on) { sh.failed = true; sfx.bad(); }
  }
  function retryShow() {
    const sh = S.show;
    sh.failed = false; sh.t = 0; sh.att = 2.5;
    sfx.clap();
  }
  function finish() {
    const P = S.P, sh = S.show;
    P.phase = 'done'; P.solved = true;
    sfx.win();
    if (S.auto.on) { S.auto.done = true; say('The tale is told. That was every step.', 4); return; }
    const stars = starsFor(P, sh), sc = score(P, sh), best = S.stats.best[`${P.story}:${P.tier}`] ?? 0, perfect = sh.grades.filter((g) => g === 'perfect').length;
    S.stats.told += 1; S.stats.perfect += perfect;
    const newBest = stars > best;
    if (newBest) S.stats.best[`${P.story}:${P.tier}`] = stars;
    if (P.kind === 'journey') { const old = S.progress[P.story]; S.progress[P.story] = { stars: Math.max(old?.stars ?? 0, stars) }; storage.set('progress', S.progress); refreshUnlocked(); }
    let streak = S.streak;
    if (P.kind === 'daily' && P.day === S.daily.day && !S.stats.days.includes(P.day)) { S.stats.days.push(P.day); S.stats.days = S.stats.days.slice(-200); refreshDaily(); streak = S.streak; S.stats.bestStreak = Math.max(S.stats.bestStreak, streak); }
    storage.set('stats', S.stats); clearSave();
    if (P.kind === 'daily' && P.day === S.daily.day) storage.set('daily', { day: P.day, streak });
    monetization.track('tale_told', { story: P.story, tier: P.tier, tries: P.tries, stars });
    let next = null;
    if (P.kind === 'journey') { const i = ORDER.findIndex((o) => o.id === P.story); next = i + 1 < ORDER.length ? ORDER[i + 1].id : null; }
    S.result = { stars, score: sc, tries: P.tries, perfect, cards: P.n, att: sh.att, newBest, daily: P.kind === 'daily', streak, story: P.story, tier: P.tier, kind: P.kind, next, fact: FACTS[(hash(P.story.length, P.n) + S.stats.told) % FACTS.length] };
    S.winAt = 1.2; S.toOver = true;
  }

  // ---- Watch and Learn ---------------------------------------------------------------------------------------------------------
  const AUTO_GAP = 0.35;
  function autoTick(dt) {
    const a = S.auto, P = S.P;
    if (a.paused || a.done) return;
    if (P.phase === 'perform') {
      const sh = S.show;
      if (sh.done || S.pullAnim || sh.wait > 0) return;
      const off = AUTO_OFFS[sh.i % AUTO_OFFS.length];
      if (sh.t >= sh.beat + off) { pull(1); a.n += 1; }
      return;
    }
    if (P.phase !== 'arrange' || S.beginT > 0) return;
    if (a.phase === 'gap') { a.timer -= dt; if (a.timer <= 0) a.phase = null; return; }
    if (a.phase === 'think') {
      a.timer -= dt;
      if (a.timer > 0) return;
      S.hint.stage = 'explain'; S.hint.text = S.hint.h.why; a.phase = 'reveal';
      a.timer = clamp(1.8 + S.hint.text.split(' ').length * 0.16, 2, 7);
      return;
    }
    if (a.phase === 'reveal') {
      a.timer -= dt;
      if (a.timer > 0) return;
      applyHint(); a.phase = 'gap'; a.timer = AUTO_GAP;
      return;
    }
    const h = makeHint();
    if (!h) { P.solved = true; S.beginT = 0.6; return; }
    S.hint = h; a.n += 1; a.phase = 'think'; a.timer = THINK_STEPS[S.prefs.thinkIdx];
  }

  // ---- input ---------------------------------------------------------------------------------------------------------------------
  function hitBtn(id, r, tap) { if (inRect(r, tap.x, tap.y)) { flash(id); return true; } return false; }
  const slotAt = (l, x, y) => l.grid.rects.findIndex((r) => inRect(r, x, y));
  function tapArrange(tap, l) {
    const P = S.P;
    if (hitBtn('pause', l.pause, tap)) { S.paused = true; persistSession(); return; }
    if (S.hint) {
      if (hitBtn('close', l.coachBtns.close, tap)) S.hint = null;
      else if (hitBtn('go', l.coachBtns.go, tap)) hintGo();
      return;
    }
    const i = slotAt(l, tap.x, tap.y);
    if (i >= 0) {
      if (inRect(flipRect(l.grid.rects[i]), tap.x, tap.y)) { const c = P.order[i]; P.flipped[c] = !P.flipped[c]; sfx.tap(); return; }
      S.cursor = i;
      if (S.sel < 0) { if (P.locked[i]) { S.fx.shake[i] = 0; sfx.err(); return; } S.sel = i; sfx.tap(); }
      else if (S.sel === i) { S.sel = -1; sfx.tap(); }
      else doSwap(S.sel, i);
      return;
    }
    const T = l.tools;
    if (hitBtn('hang', T.hang, tap)) doCheck();
    else if (hitBtn('hint', T.hint, tap)) askHint();
    else if (hitBtn('undo', T.undo, tap)) { if (undo(P)) { sfx.swap(); S.sel = -1; persistSession(); } else say('Nothing to undo since the last check.', 1.6); }
    else if (hitBtn('flip', T.flip, tap)) { P.flipped.all = !P.flipped.all; sfx.tap(); }
    else S.sel = -1;
  }
  function updateGesture(p, l) {
    if (p.pressed) { const i = slotAt(l, p.x, p.y); gesture = { x0: p.x, y0: p.y, moved: false, slot: i, onFlip: i >= 0 && inRect(flipRect(l.grid.rects[i]), p.x, p.y) }; }
    if (!gesture) return null;
    if (p.down && gesture.slot >= 0 && !gesture.onFlip && !gesture.moved && Math.hypot(p.x - gesture.x0, p.y - gesture.y0) > 16 && !S.P.locked[gesture.slot]) { gesture.moved = true; S.sel = -1; }
    if (gesture.moved && p.down) S.drag = { slot: gesture.slot, x: p.x, y: p.y, moved: true };
    if (p.released || !p.down) {
      const g = gesture; gesture = null; S.drag = null;
      if (g.moved) { const i = slotAt(l, p.x, p.y); if (i >= 0 && i !== g.slot) doSwap(g.slot, i); return null; }
      return { x: g.x0, y: g.y0 };
    }
    return null;
  }
  function updatePerformInput(p, l, input) {
    const sh = S.show, c = l.stage.card, k = input.keys.pressed;
    if (k.has('Space') || k.has('Enter') || k.has('ArrowRight')) { if (sh.failed) retryShow(); else pull(1); }
    if (sh.failed) { if (p.pressed) { retryShow(); flash('retry'); } return; }
    if (p.pressed) {
      const pt = { x: p.x, y: p.y };
      if (inRect(l.pause, pt.x, pt.y)) { flash('pause'); S.paused = true; persistSession(); return; }
      if (inRect(l.pull, pt.x, pt.y)) { flash('pull'); pull(1); return; }
      if (inRect(c, pt.x, pt.y)) gesture = { x0: p.x, y0: p.y, dx: 0 };
    }
    if (gesture && p.down) { const dx = p.x - gesture.x0; gesture.dx = dx; if (Math.abs(dx) > 8) S.pullDrag = { dx: clamp(dx, -c.w * 0.9, c.w * 0.9) }; }
    if (gesture && (p.released || !p.down)) {
      const g = gesture; gesture = null; S.pullDrag = null;
      const tb = tabCenter(c);
      if (Math.abs(g.dx) > c.w * 0.18 || (Math.abs(g.dx) < 10 && Math.hypot(g.x0 - tb.x, g.y0 - tb.y) < tb.r * 2.2)) pull(g.dx < 0 ? -1 : 1);
    }
  }

  function updatePlay(dt, input) {
    const P = S.P, p = input.pointer, k = input.keys.pressed;
    if (!frozen()) {
      if (S.beginT > 0) { S.beginT -= dt; if (S.beginT <= 0) startShow(); }
      if (P.phase === 'perform' && S.show) {
        showTick(dt);
        if (S.pullAnim) { S.pullAnim.t += dt; if (S.pullAnim.t >= 0.5) S.pullAnim = null; }
        if (S.lastGrade) S.lastGrade.t += dt;
        if (S.cheerT > 0) S.cheerT -= dt;
        if (S.show.done && !S.pullAnim && S.endT > 0) { S.endT -= dt; if (S.endT <= 0) finish(); }
      }
      if (S.toOver) { S.winAt -= dt; if (S.winAt <= 0) { S.toOver = false; go('over'); return; } }
      if (!S.auto.on && P.phase !== 'done') { P.t += dt; S.saveAcc += dt; if (S.saveAcc > 6) { S.saveAcc = 0; persistSession(); } }
    }
    if (S.auto.on && !S.paused) autoTick(dt);
    const l = L();
    if (k.has('KeyP') || k.has('Escape')) { if (S.auto.on) S.auto.paused = !S.auto.paused; else if (P.phase !== 'done') { S.paused = !S.paused; if (S.paused) persistSession(); } }
    if (S.paused) {
      gesture = null; S.drag = null;
      if (!p.pressed) return;
      const pl = pauseLayout(meta.width, meta.height), tap = { x: p.x, y: p.y };
      if (hitBtn('resume', pl.resume, tap)) S.paused = false;
      else if (hitBtn('restart', pl.restart, tap)) { const q = newSession({ story: P.story, tier: P.tier, rng, kind: P.kind, ref: P.ref }); q.day = P.day; begin(q); persistSession(); }
      else if (hitBtn('psettings', pl.settings, tap)) { S.back = 'play'; go('settings'); }
      else if (hitBtn('pmenu', pl.menu, tap)) { persistSession(); S.paused = false; go('title'); }
      return;
    }
    if (S.auto.on) {
      if (p.pressed) {
        const tap = { x: p.x, y: p.y }, r = l.rail;
        if (hitBtn('aexit', r.exit, tap)) { S.auto.on = false; S.hint = null; S.P = null; S.show = null; go('title'); }
        else if (hitBtn('apause', r.pause, tap)) S.auto.paused = !S.auto.paused;
        else if (hitBtn('adec', r.dec, tap)) { if (S.prefs.thinkIdx > 0) { S.prefs.thinkIdx -= 1; savePrefs(); } }
        else if (hitBtn('ainc', r.inc, tap)) { if (S.prefs.thinkIdx < THINK_STEPS.length - 1) { S.prefs.thinkIdx += 1; savePrefs(); } }
      }
      return;
    }
    if (P.phase === 'done') return;
    if (P.phase === 'perform') { if (S.show) updatePerformInput(p, l, input); return; }
    if (S.beginT > 0) return;
    const n = P.n, cols = l.grid.cols, mv = (d) => { S.cursor = clamp(S.cursor + d, 0, n - 1); };
    if (!S.hint) {
      if (k.has('ArrowLeft')) mv(-1); if (k.has('ArrowRight')) mv(1); if (k.has('ArrowUp')) mv(-cols); if (k.has('ArrowDown')) mv(cols);
      if (k.has('Enter') || k.has('Space')) { if (S.sel < 0) { if (!P.locked[S.cursor]) S.sel = S.cursor; } else if (S.sel === S.cursor) S.sel = -1; else doSwap(S.sel, S.cursor); }
      if (k.has('KeyF')) { const c = P.order[S.cursor]; P.flipped[c] = !P.flipped[c]; }
      if (k.has('KeyU')) { if (undo(P)) { sfx.swap(); persistSession(); } }
      if (k.has('KeyC')) doCheck();
    }
    if (k.has('KeyH')) { if (S.hint) hintGo(); else askHint(); }
    const tap = updateGesture(p, l);
    if (tap) tapArrange(tap, l);
  }

  function changeSetting(i, kk) {
    const id = settingsRows(S)[i].id, p = S.prefs;
    switch (id) {
      case 'look': p.look = LOOK_IDS[kk]; setLook(p.look); break;
      case 'ring': p.ring = kk === 0; break;
      case 'caps': p.caps = kk === 0; break;
      case 'sound': p.sound = kk === 0; audio.setMuted?.(!p.sound); break;
      case 'calm': p.calm = kk === 1; break;
      case 'restore':
        if (S.owned || S.restoreBusy) return;
        S.restoreBusy = true; S.restoreMsg = 'Checking with the store...';
        Promise.resolve(monetization.restore()).then(() => {
          S.owned = !!monetization.owns?.('unlock_game');
          S.restoreMsg = S.owned ? 'Purchase restored. Thank you!' : 'No earlier purchase found.';
        }).catch(() => { S.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { S.restoreBusy = false; });
        return;
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
      const kk = input.keys.pressed;
      if (kk.has('ArrowDown')) S.scrollY = clamp(S.scrollY + 80, 0, metrics.max);
      if (kk.has('ArrowUp')) S.scrollY = clamp(S.scrollY - 80, 0, metrics.max);
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
        const J = journeyRects(LL.body, CHAPTERS.map((c) => c.tales.length), sc2);
        J.items.forEach((it) => it.rows.forEach((r, i) => { if (inRect(r, tap.x, ty)) { sfx.tap(); startJourney(CHAPTERS[it.ci].tales[i]); } }));
      } else {
        const Fr = freeRects(LL.body, STORY_IDS.length, sc2);
        Fr.cards.forEach((c, vi) => c.tiers.forEach((r, t) => { if (inRect(r, tap.x, ty)) { sfx.tap(); startTale(STORY_IDS[vi], t, 'free'); } }));
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
      const SL = settingsLayout(w, h, TEXT_SCALES[S.prefs.textIdx], settingsRows(S).length);
      const leave = () => { if (S.back === 'play' && S.P) { S.scene = 'play'; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
      if (esc) { leave(); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) return leave();
      if (hitBtn('tdec', SL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', SL.textInc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) {
        const ty = tap.y + S.scrollY;
        settingsRows(S).forEach((row, i) => {
          const g = SL.rows[i], n = row.opts.length, cw = (g.ctrl.w - 8 * (n - 1)) / n;
          for (let kk = 0; kk < n; kk++) { const r = { x: g.ctrl.x + kk * (cw + 8), y: g.ctrl.y, w: cw, h: g.ctrl.h }; if (inRect(r, tap.x, ty)) { flash('set' + i + '.' + kk); changeSetting(i, kk); } }
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
      const R0 = S.result, O = overLayout(w, h, TEXT_SCALES[S.prefs.textIdx]);
      if (!tap || !R0) return;
      if (hitBtn('next', O.btns.next, tap)) {
        if (R0.kind === 'journey' && R0.next) startJourney(R0.next);
        else if (R0.kind === 'journey') go('journey');
        else if (R0.daily) go('title');
        else startTale(STORY_IDS[(STORY_IDS.indexOf(R0.story) + 1) % STORY_IDS.length], R0.tier, 'free');
      } else if (hitBtn('menu', O.btns.menu, tap)) { if (R0.kind === 'journey') go('journey'); else if (R0.daily) go('free'); else go('title'); }
      else if (hitBtn('share', O.btns.share, tap)) env.share(`Kamishibai, ${STORIES[R0.story].name}: ${R0.stars} star${R0.stars === 1 ? '' : 's'}, ${R0.perfect} of ${R0.cards} perfect pulls${R0.daily ? '. Streak ' + R0.streak : ''}.`);
      return;
    }
    if (sc === 'demo-limit' && tap) go('title');
  }

  return {
    update(dt, input) {
      S.t += dt; S.sceneT += dt;
      if (S.flash) { S.flash.t += dt; if (S.flash.t > 0.25) S.flash = null; }
      if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold) S.msg = null; }
      if (!frozen()) {
        for (const kk of Object.keys(S.fx.shake)) { S.fx.shake[kk] += dt; if (S.fx.shake[kk] > 0.5) delete S.fx.shake[kk]; }
        for (const kk of Object.keys(S.fx.lock)) { S.fx.lock[kk] += dt; if (S.fx.lock[kk] > 0.4) delete S.fx.lock[kk]; }
        for (const q of S.sfx) q.t -= dt;
        const due = S.sfx.filter((q) => q.t <= 0); if (due.length) { S.sfx = S.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
      }
      // the kit's preview pill sits top centre; portrait: tuck it into the header beside Pause (never over the cards); landscape: under Pause
      if (S.scene === 'play' && S.P) { const l = L(); meta.previewBadge = l.land ? { x: l.pause.x + l.pause.w, y: l.pause.y + l.pause.h + 8, align: 'right' } : { x: l.pause.x - 12, y: l.pause.y + 30, align: 'right' }; } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { render(ctx, S, view ?? meta); },
    getState: () => S,
    // Counts real play only: arranging or performing a tale. Menus, Rules, settings, Watch and Learn, pause, results are free.
    isPreviewExempt() { return !(S.scene === 'play' && !S.auto.on && !S.paused && S.P && S.P.phase !== 'done'); },
    dev: {
      go: (scene, extra) => { Object.assign(S, extra ?? {}); go(scene); },
      tale: (id, tier = 1) => { S.dev = true; refreshUnlocked(); startTale(id, tier, 'free'); },
      journey: (id) => { S.dev = true; refreshUnlocked(); startJourney(id); },
      daily: () => startDaily(), auto: () => startAuto(),
      hint: () => askHint(), hintGo: () => hintGo(),
      select: (i) => { S.sel = i; },
      placeSome: (n) => { const P = S.P; for (let i = 0; i < P.n && n > 0; i++) { if (!P.locked[i] && P.order[i] !== i) { const f = P.order.indexOf(i); [P.order[i], P.order[f]] = [P.order[f], P.order[i]]; P.locked[i] = true; n -= 1; } } },
      flipSome: () => { const P = S.P; P.flipped[P.order[0]] = true; P.flipped[P.order[2]] = true; },
      perform: () => { const P = S.P; P.order = P.order.map((c, i) => i); P.locked = P.locked.map(() => true); P.solved = true; startShow(); S.show.wait = 0; },
      show: (i, frac = 1) => { const sh = S.show; sh.i = i; sh.beat = beatFor(STORIES[S.P.story].cards[i]); sh.t = sh.beat * frac; sh.wait = 0; },
      pullNow: () => pull(1),
      finishNow: () => { const sh = S.show; while (!sh.done) { sh.t = sh.beat; sh.wait = 0; S.pullAnim = null; pull(1); } S.pullAnim = null; S.endT = 0.01; },
      skipOver: () => { S.winAt = 0.01; },
      doc: (kind, page = 0) => { S.doc = { kind, page }; go('doc'); },
      layout: () => { const l = L(); return { land: l.land, grid: l.grid, tools: l.tools, stage: l.stage, pull: l.pull, w: meta.width, h: meta.height }; },
      setPrefs: (o) => { Object.assign(S.prefs, o); applyPrefs(); },
      unlockAll: () => { S.dev = true; refreshUnlocked(); },
    },
  };
}
