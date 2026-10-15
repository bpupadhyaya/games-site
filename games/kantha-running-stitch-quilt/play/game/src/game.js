// Kantha Running Stitch Quilt: state and flow. Engine = engine.js, geometry = layout.js, drawing = view.js + art.js.
import { playLayout, titleLayout, docLayout, settingsLayout, listLayout, quiltRects, tierRects, overLayout, pauseLayout, patchGeo, inRect, host, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { patch, dailyPatch, walk, previewStep, findHint, bestFinish, starsFor, makeRhythm, judge, roundStars, RHYTHM, POINTS, CHAPTERS, completion } from './engine.js';
import { render, metrics, settingRows } from './view.js';
import { DOCS } from './content.js';
import { setLook, LOOK_IDS } from './ui.js';
import { v3 } from './v3.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_SESSIONS = 3;
const DEFAULT_PREFS = { look: 'ivory', marks: false, floats: true, guide: false, sound: true, calm: false, textIdx: 0, thinkIdx: 1 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const levelKey = (ci, i) => `${ci}:${i}`;
export const totalLevels = () => CHAPTERS.reduce((a, c) => a + c.count, 0);
const globalIndex = (ci, i) => ci * 6 + i;
export const fmtTime = (t) => { const s = Math.max(0, Math.floor(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const SEW_SPEED = 13;       // cloth units of row per second
const HOP_TIME = 0.28;      // seconds for the thread to cross under the cloth

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS },
    B: null,            // quilt / daily / watch-and-learn session
    hint: null, hl: null, paused: false, cursor: 0,
    auto: { on: false, phase: null, timer: 0, paused: false, n: 0, done: false },
    R: null,            // Steady Hand round
    fx: [], sparks: [], winT: 0, winDelay: 0, sfx: [], pop: {},
    msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0 }, back: 'title', result: null,
    progress: {}, stats: { best: {}, solved: 0, rounds: 0, days: [], bestStreak: 0 }, saved: null,
    daily: { day: config.day ?? 0 }, demo: config.demo === true, kbd: false, streak: 0, dailyDone: false, demoCount: 0, saveAcc: 0, dev: config.dev === true,
  };
  let saveRaw = null, scrollG = null;
  S.owned = !!monetization.owns?.('unlock_game'); S.restoreMsg = ''; S.restoreBusy = false;
  monetization.onChange?.(() => { S.owned = !!monetization.owns?.('unlock_game'); });

  // ---- persistence ---------------------------------------------------------------------------------------------------------------------------
  const applyPrefs = () => { setLook(S.prefs.look); audio.setMuted?.(!S.prefs.sound); };
  const savePrefs = () => storage.set('prefs', S.prefs);
  const saveProgress = () => storage.set('progress', S.progress);
  const saveStats = () => storage.set('stats', S.stats);
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); if (!LOOK_IDS.includes(S.prefs.look)) S.prefs.look = 'ivory'; } applyPrefs(); });
  storage.get('progress', null).then((v) => { if (v) S.progress = { ...v, ...S.progress }; });
  storage.get('stats', null).then((v) => { if (v) S.stats = { ...S.stats, ...v, best: v.best ?? {}, days: v.days ?? [] }; refreshDaily(); });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  storage.get('save', null).then((v) => { if (v && v.ref && Array.isArray(v.steps) && S.scene === 'title' && !S.B) { saveRaw = v; S.saved = { kind: v.kind, ref: v.ref, t: v.t, n: v.steps.length }; } });
  applyPrefs();

  function refreshDaily() {
    const day = S.daily.day, set = new Set(S.stats.days);
    let streak = 0, d = set.has(day) ? day : day - 1;
    while (set.has(d)) { streak += 1; d -= 1; }
    S.streak = streak; S.dailyDone = set.has(day);
  }
  refreshDaily();
  // the 3D layer's credits and licences (vendor3d/LICENSES.md) join the About pages when the file is there
  if (typeof fetch === 'function' && typeof location !== 'undefined' && !DOCS.about.pages.some((p) => p.cred)) {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter((x) => x && !/fetch\(|keep it as is|LICENSES\.md/.test(x));
      let page = [], n = 0, k = 1;
      const flush = () => { if (page.length) { DOCS.about.pages.push({ title: k === 1 ? 'Credits: 3D art' : `Credits: 3D art (${k})`, body: page.map((p) => ({ p })), fig: null, cred: true }); k += 1; page = []; n = 0; } };
      for (const p of paras) { if (n + p.length > 1500) flush(); page.push(p); n += p.length; }
      flush();
    }).catch(() => {});
  }
  function persistSession() {
    const B = S.B;
    if (!B || B.done || S.auto.on) return;
    saveRaw = { ref: B.ref, kind: B.kind, steps: B.steps.map((s) => ({ g: s.g })), t: B.t, day: B.day, hints: B.hints };
    S.saved = { kind: B.kind, ref: B.ref, t: B.t, n: B.steps.length };
    storage.set('save', saveRaw);
  }
  const clearSave = () => { saveRaw = null; S.saved = null; storage.remove('save'); };

  // ---- sound ----------------------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound) audio.tone(o); };
  const later = (t, o) => S.sfx.push({ t, o });
  const PENT = [0, 2, 4, 7, 9];
  const note = (k) => 262 * 2 ** ((PENT[((k % 5) + 5) % 5] + 12 * Math.floor(k / 5)) / 12);
  const sfx = {
    pull: (k) => tone({ freq: 520 + (k % 6) * 40, to: 380, dur: 0.07, type: 'triangle', vol: 0.05 }),
    row: (k) => tone({ freq: note(k + 3), to: note(k + 3) * 1.01, dur: 0.22, type: 'sine', vol: 0.1 }),
    lift: () => tone({ freq: 520, to: 700, dur: 0.05, type: 'sine', vol: 0.06 }),
    err: () => tone({ freq: 200, to: 130, dur: 0.16, type: 'triangle', vol: 0.09 }),
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.06 }),
    pick: () => tone({ freq: 700, to: 780, dur: 0.05, type: 'sine', vol: 0.07 }),
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.08 }),
    win: () => { [392, 523, 659, 784, 1047].forEach((f, i) => later(i * 0.11, { freq: f, to: f, dur: 0.5, type: 'triangle', vol: 0.09 })); },
    knot: () => tone({ freq: 330, to: 240, dur: 0.1, type: 'triangle', vol: 0.08 }),
    hit: (grade, k) => tone({ freq: note(k) * (grade === 0 ? 2 : 1), to: note(k) * (grade === 0 ? 2 : 1), dur: grade === 0 ? 0.12 : 0.09, type: 'sine', vol: grade === 0 ? 0.11 : 0.08 }),
    miss: () => tone({ freq: 150, to: 110, dur: 0.1, type: 'triangle', vol: 0.06 }),
  };

  // ---- helpers ----------------------------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.6) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; scrollG = null; wheelInput.dy = 0; S.msg = null; }
  const BTN = () => (S.scene === 'play' ? ['sew', 'undo', 'hint', 'clear'] : []);
  const L = () => playLayout(meta.width, meta.height, { coach: !!(S.hint || S.auto.on), buttons: S.auto.on ? [] : BTN() });
  const geoOf = (l) => patchGeo(l.area, 10);
  function spark(x, y, n, color) {
    for (let i = 0; i < n; i++) { const a = rng.next() * Math.PI * 2, v = 60 + rng.next() * 240; S.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90, t: 0, life: 0.7 + rng.next() * 0.7, r: 2.5 + rng.next() * 3.5, c: color }); }
    if (S.sparks.length > 180) S.sparks.splice(0, S.sparks.length - 180);
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
  // The derived thread state of the current session (cached on the step count).
  const stateOf = (B) => {
    if (!B.wc || B.wc.n !== B.steps.length || B.wc.arr !== B.steps || B.wc.P !== B.P) B.wc = { n: B.steps.length, arr: B.steps, P: B.P, st: walk(B.P, B.steps) };
    return B.wc.st;
  };

  // ---- a patch session ---------------------------------------------------------------------------------------------------------------------
  function newSession(P, extra) {
    const { auto, ...rest } = extra;
    S.B = { P, steps: [], hist: [], sel: null, t: 0, hints: 0, undos: 0, done: false, anim: null, wc: null, kind: 'quilt', ref: '', level: 0, ...rest };
    S.R = null;
    S.hint = null; S.hl = null; S.paused = false; S.msg = null; S.sparks = []; S.fx = []; S.winT = 0; S.winDelay = 0; S.result = null; S.saveAcc = 0; S.pop = {};
    S.cursor = 0;
    S.auto = { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, ...(auto ?? {}) };
    go('play');
  }
  function startLevel(ci, i) {
    if (!unlocked(ci, i)) { say('Sew the previous patch first.', 2); return; }
    if (demoBlocked()) return;
    newSession(patch(ci, i), { kind: 'quilt', ref: levelKey(ci, i), level: globalIndex(ci, i) });
    if (ci === 0 && i === 0 && !isDone(0, 0)) say('Tap the end of a row, then tap it again to sew it. Make the thread last.', 5);
    persistSession();
  }
  function startDaily() {
    if (demoBlocked()) return;
    const day = S.daily.day;
    newSession(dailyPatch(day), { kind: 'daily', ref: `day:${day}`, level: 0, day });
    persistSession();
  }
  function resumeSaved() {
    const v = saveRaw;
    if (!v) return;
    let P;
    if (v.kind === 'daily') P = dailyPatch(Number(String(v.ref).split(':')[1]));
    else { const [ci, i] = String(v.ref).split(':').map(Number); P = patch(ci, i); }
    const valid = v.steps.filter((s) => Number.isInteger(s.g) && s.g >= 0 && s.g < P.opts.length);
    newSession(P, { kind: v.kind, ref: v.ref, level: v.level ?? 0, t: v.t, hints: v.hints ?? 0, steps: valid, day: v.kind === 'daily' ? Number(String(v.ref).split(':')[1]) : undefined });
    say('Welcome back.', 1.6);
  }
  function startAuto() {
    const ci = rng.int(3), li = rng.int(6);
    newSession(patch(ci, li), { kind: 'auto', auto: { on: true } });
    say('Watch the game plan every row and explain each choice.', 2.4);
  }
  // Which unsewn options can be tapped.
  function liveOpts(B) {
    const st = stateOf(B), out = [];
    for (const r of B.P.runs) if (!(st.mask & (1 << r.i))) for (const o of r.opts) out.push(o);
    return out;
  }
  function optAt(B, geo, x, y) {
    const rad = Math.max(34, 24 / (host.px || 0.55)), r2 = rad * rad;
    let best = null, bd = r2;
    for (const o of liveOpts(B)) {
      const c = geo.P(o.from[0], o.from[1], 0.006), dx = c.x - x, dy = c.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  function snapshot(B) { B.hist.push(B.steps.map((s) => ({ g: s.g }))); if (B.hist.length > 60) B.hist.shift(); }
  function commit(g) {
    const B = S.B;
    if (B.done || B.anim) return false;
    const st = stateOf(B), pv = previewStep(B.P, st, g);
    snapshot(B);
    B.steps.push({ g }); B.sel = null; S.hint = null; S.hl = null;
    const run = B.P.runs[B.P.opts[g].run];
    B.anim = { g, u: 0, hop: pv.hop > 0 && !pv.nw ? 0 : 1, len: run.len, nw: pv.nw, from: st.pos };
    if (pv.nw && st.last >= 0) sfx.knot();
    persistSession();
    return true;
  }
  function select(g) {
    const B = S.B;
    if (B.anim || B.done) return;
    if (B.sel === g) { commit(g); return; }
    B.sel = g; sfx.pick();
  }
  function doUndo() {
    const B = S.B;
    if (B.anim) finishAnim();
    if (B.done) return;
    const prev = B.hist.pop();
    if (!prev) { say('Nothing to undo.', 1.4); return; }
    B.steps = prev; B.sel = null; S.hint = null; S.hl = null; B.undos += 1; sfx.lift(); persistSession();
  }
  function doClear() {
    const B = S.B;
    if (B.anim) finishAnim();
    if (!B.steps.length || B.done) return;
    snapshot(B);
    B.steps = []; B.sel = null; S.hint = null; S.hl = null; sfx.lift(); persistSession();
    say('The cloth is bare again. Undo brings it back.', 2.2);
  }
  function finishAnim() {
    const B = S.B, a = B.anim;
    if (!a) return;
    B.anim = null;
    const st = stateOf(B), geo = geoOf(L()), o = B.P.opts[a.g], c = o.to;
    const sp = geo.P(c[0], c[1], 0.006); spark(sp.x, sp.y, 8, '#ffd45a');
    sfx.row(B.steps.length);
    if (st.done) win();
    else if (S.auto.on) S.auto.phase = 'gap';
  }

  // ---- hints (also drive Watch and Learn) -------------------------------------------------------------------------------------------------------
  function makeHint() {
    const B = S.B, h = findHint(B.P, B.steps);
    return h ? { stage: 'look', h, text: h.look } : null;
  }
  function askHint() {
    const B = S.B;
    if (B.anim || B.done) return;
    const h = makeHint();
    if (!h) { say('Every row is sewn.'); return; }
    B.hints += 1; S.hint = h; S.hl = { g: h.h.g, run: h.h.run }; B.sel = null; sfx.hint();
  }
  function applyHintStep() {
    const g = S.hint.h.g;
    S.hint = null; S.hl = null;
    commit(g);
  }
  function hintGo() {
    const h = S.hint;
    if (!h) return;
    if (h.stage === 'look') { h.stage = 'explain'; h.text = h.h.why; sfx.tap(); return; }
    applyHintStep();
  }

  // ---- winning -------------------------------------------------------------------------------------------------------------------------------
  function win() {
    const B = S.B, P = B.P, st = stateOf(B);
    B.done = true; S.hint = null; S.hl = null; S.winT = 3.2; S.winDelay = 2.6;
    const geo = geoOf(L()), wc = geo.P(geo.size / 2, geo.size / 2, 0.004); spark(wc.x, wc.y, 70, '#ffd45a'); sfx.win();
    if (S.auto.on) { S.auto.done = true; S.auto.phase = null; say(`Done in ${st.t} thread${st.t === 1 ? '' : 's'}. That is the best plan.`, 4); return; }
    const stars = starsFor(P, st.t);
    S.stats.solved += 1;
    if (B.kind === 'quilt') { const old = S.progress[B.ref]; S.progress[B.ref] = { stars: Math.max(old?.stars ?? 0, stars), threads: Math.min(old?.threads ?? 99, st.t) }; saveProgress(); }
    let streak = S.streak;
    if (B.kind === 'daily' && B.day === S.daily.day && !S.stats.days.includes(B.day)) { S.stats.days.push(B.day); S.stats.days = S.stats.days.slice(-200); refreshDaily(); streak = S.streak; S.stats.bestStreak = Math.max(S.stats.bestStreak, streak); }
    saveStats(); clearSave();
    if (B.kind === 'daily' && B.day === S.daily.day) storage.set('daily', { day: B.day, streak });
    monetization.track('patch_sewn', { kind: B.kind, level: B.level, threads: st.t, aim: P.opt, undos: B.undos });
    let next = null;
    if (B.kind === 'quilt') { const [ci, i] = B.ref.split(':').map(Number); next = nextLevel(ci, i); }
    S.result = { type: 'patch', stars, threads: st.t, aim: P.opt, hops: st.hops, wasted: st.wasted, time: B.t, hints: B.hints, undos: B.undos, daily: B.kind === 'daily', streak, kind: B.kind, ref: B.ref, next, name: P.name, fact: S.stats.solved % 8 };
  }

  // ---- Watch and Learn -------------------------------------------------------------------------------------------------------------------------
  const wordCount = (t) => t.split(' ').length;
  function autoTick(dt) {
    const a = S.auto, B = S.B;
    if (a.paused || a.done || S.paused) return;
    if (B.anim) return;   // a row is being sewn
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
      a.phase = 'sew'; applyHintStep(); B.hints = 0; a.timer = 0.4;
      return;
    }
    if (a.phase === 'sew') { a.phase = 'gap'; a.timer = 0.4; return; }
    const h = makeHint();
    if (!h) return;
    S.hint = h; S.hl = { g: h.h.g, run: h.h.run }; a.n += 1; a.phase = 'think'; a.timer = THINK_STEPS[S.prefs.thinkIdx];
  }

  // ---- Steady Hand ------------------------------------------------------------------------------------------------------------------------------
  function startSteady(tier) {
    if (demoBlocked()) return;
    const seed = rng.int(1 << 30), data = makeRhythm(tier, seed);
    S.R = {
      tier, seed, data, t: 0, phase: 'play', score: 0, combo: 0, bestCombo: 0, counts: [0, 0, 0, 0], base: 0, n: data.rows.reduce((a, r) => a + r.holes.length, 0),
      holes: data.rows.map((r) => r.holes.map(() => ({ res: null, err: 0, grade: -1 }))), rowAcc: data.rows.map(() => null), tension: 0,
    };
    S.hint = null; S.hl = null; S.paused = false; S.sparks = []; S.fx = []; S.result = null; S.auto = { on: false, phase: null, timer: 0, paused: false, n: 0, done: false };
    S.B = null;
    go('steady');
  }
  function rowPoint(row, s) {
    const run = row.run, q = clamp(s, 0, run.len), c = run.cum;
    let lo = 0, hi = c.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (c[mid] <= q) lo = mid; else hi = mid; }
    const seg = c[hi] - c[lo], t = seg > 0 ? (q - c[lo]) / seg : 0, a = run.pts[lo], b = run.pts[hi];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  function updateRowAcc(r) {
    const R = S.R, hs = R.holes[r];
    if (hs.some((h) => h.res === null)) return;
    const pts = hs.reduce((a, h) => a + (POINTS[h.grade] ?? 0), 0);
    R.rowAcc[r] = pts / (100 * hs.length);
  }
  function steadyTap() {
    const R = S.R, T = RHYTHM[R.tier], rows = R.data.rows;
    let best = null, bd = 9;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (R.t < row.start - 1.2 || R.t > row.start + row.dur + 0.6) continue;
      for (let k = 0; k < row.holes.length; k++) {
        const h = R.holes[r][k];
        if (h.res !== null) continue;
        const d = Math.abs(R.t - row.holes[k].t);
        if (d <= T.win[2] + 0.04 && d < bd) { bd = d; best = { r, k }; }
      }
    }
    if (!best) { sfx.tap(); return; }
    const row = rows[best.r], hole = row.holes[best.k], err = R.t - hole.t, grade = judge(T, err), h = R.holes[best.r][best.k];
    h.res = 'hit'; h.err = err; h.grade = grade;
    R.counts[grade] += 1; R.base += POINTS[grade] ?? 0;
    R.combo += 1; R.bestCombo = Math.max(R.bestCombo, R.combo);
    R.score += (POINTS[grade] ?? 0) + Math.min(R.combo, 20) * 2;
    sfx.hit(grade, best.k);
    const geo = geoOf(L()), p = rowPoint(row, hole.s + err * T.speed);
    S.fx.push({ x: p[0], y: p[1], t: 0, text: ['Perfect', 'Good', 'Close'][grade] ?? '', grade });
    if (grade === 0) { const q = geo.P(p[0], p[1], 0.006); spark(q.x, q.y, 5, '#ffe28a'); }
    updateRowAcc(best.r);
  }
  function steadyTick(dt) {
    const R = S.R, T = RHYTHM[R.tier], rows = R.data.rows;
    R.t += dt;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let k = 0; k < row.holes.length; k++) {
        const h = R.holes[r][k];
        if (h.res === null && R.t > row.holes[k].t + T.win[2] + 0.04) {
          h.res = 'miss'; h.grade = 3; R.counts[3] += 1; R.combo = 0; sfx.miss();
                    updateRowAcc(r);
        }
      }
    }
    R.tension = rows.reduce((a, r, i) => a + (R.rowAcc[i] ?? 0), 0) / rows.length;
    if (R.t > R.data.end + 0.5 && R.phase === 'play') steadyEnd();
  }
  function steadyEnd() {
    const R = S.R, T = RHYTHM[R.tier], key = T.id;
    R.phase = 'done';
    const acc = R.base / (100 * R.n), stars = roundStars(acc);
    const best = S.stats.best[key] ?? 0, newBest = R.score > best;
    if (newBest) S.stats.best[key] = R.score;
    S.stats.rounds += 1; saveStats();
    monetization.track('steady_round', { tier: key, score: R.score, acc: Math.round(acc * 100) });
    sfx.win();
    S.result = { type: 'steady', tier: R.tier, score: R.score, acc, stars, counts: R.counts.slice(), combo: R.bestCombo, best: Math.max(best, R.score), newBest, fact: S.stats.rounds % 8 };
    S.winDelay = 1.6; S.winT = 2;
  }

  // ---- input ------------------------------------------------------------------------------------------------------------------------------------------
  function hitBtn(id, r, tap) { if (r && inRect(r, tap.x, tap.y)) { flash(id); return true; } return false; }
  function pauseOverlayTap(tap, l) {
    const pl = pauseLayout(meta.width, meta.height, l.area);
    if (hitBtn('resume', pl.resume, tap)) S.paused = false;
    else if (hitBtn('restart', pl.restart, tap)) {
      S.paused = false;
      if (S.scene === 'play') newSession(S.B.P, { kind: S.B.kind, ref: S.B.ref, level: S.B.level, day: S.B.day });
      else if (S.scene === 'steady') { const t = S.R.tier; demoUncount(); startSteady(t); }
    } else if (hitBtn('psettings', pl.settings, tap)) { S.back = S.scene; S.scene = 'settings'; S.sceneT = 1; S.scrollY = 0; }
    else if (hitBtn('pmenu', pl.menu, tap)) { if (S.scene === 'play') persistSession(); S.paused = false; go('title'); }
  }
  const cycle = (dir) => {
    const B = S.B, opts = liveOpts(B).slice().sort((a, b) => a.from[1] - b.from[1] || a.from[0] - b.from[0]);
    if (!opts.length) return;
    const cur = B.sel !== null ? opts.findIndex((o) => o.g === B.sel) : -1;
    const n = (cur + dir + opts.length * 4) % opts.length;
    B.sel = opts[n].g; S.kbd = true; sfx.pick();
  };

  function updatePlay(dt, input) {
    const B = S.B, l = L(), p = input.pointer, geo = geoOf(l), k = input.keys.pressed;
    if (!S.paused && !B.done && !S.auto.on && S.winT <= 0) { B.t += dt; S.saveAcc += dt; if (S.saveAcc > 6) { S.saveAcc = 0; persistSession(); } }
    if (S.auto.on && !S.auto.paused && !S.paused) autoTick(dt);
    // sewing animation
    if (B.anim && !S.paused && !(S.auto.on && S.auto.paused)) {
      const a = B.anim;
      if (a.hop < 1) a.hop = Math.min(1, a.hop + dt / HOP_TIME);
      else {
        const before = Math.floor(a.u * 2.2);
        a.u += SEW_SPEED * dt * (S.prefs.calm ? 0.7 : 1);
        if (Math.floor(Math.min(a.u, a.len) * 2.2) > before) sfx.pull(before);
        if (a.u >= a.len) finishAnim();
      }
    }
    if (S.winDelay > 0 && !S.paused) { S.winDelay -= dt; if (S.winDelay <= 0 && S.result) go('over'); }
    if (!S.auto.on && !S.paused && !B.done) {
      if (k.has('ArrowRight') || k.has('ArrowDown') || k.has('Tab')) cycle(1);
      if (k.has('ArrowLeft') || k.has('ArrowUp')) cycle(-1);
      if (k.has('Space') || k.has('Enter')) { if (B.sel !== null) select(B.sel); else cycle(1); }
      if (k.has('KeyU')) doUndo();
      if (k.has('KeyH')) { if (S.hint) hintGo(); else askHint(); }
    }
    if (k.has('KeyP') || k.has('Escape')) { if (S.auto.on) S.auto.paused = !S.auto.paused; else if (!B.done) { S.paused = !S.paused; if (S.paused) persistSession(); } }
    if (!p.pressed) return;
    const tap = { x: p.x, y: p.y };
    S.kbd = false;
    if (S.paused) { pauseOverlayTap(tap, l); return; }
    if (S.auto.on) {
      if (hitBtn('aexit', l.rail.exit, tap)) { S.auto.on = false; S.hint = null; S.hl = null; S.B = null; go('title'); }
      else if (hitBtn('apause', l.rail.pause, tap)) S.auto.paused = !S.auto.paused;
      else if (hitBtn('adec', l.rail.dec, tap)) { if (S.prefs.thinkIdx > 0) { S.prefs.thinkIdx -= 1; savePrefs(); } }
      else if (hitBtn('ainc', l.rail.inc, tap)) { if (S.prefs.thinkIdx < THINK_STEPS.length - 1) { S.prefs.thinkIdx += 1; savePrefs(); } }
      return;
    }
    if (B.done) return;
    if (hitBtn('pause', l.pause, tap)) { S.paused = true; persistSession(); return; }
    if (B.anim) { B.anim.hop = 1; B.anim.u = B.anim.len; finishAnim(); return; }
    if (S.hint) {
      if (hitBtn('close', l.coachBtns.close, tap)) { S.hint = null; S.hl = null; }
      else if (hitBtn('go', l.coachBtns.go, tap)) hintGo();
      return;
    }
    const o = optAt(B, geo, tap.x, tap.y);
    if (o) { S.cursor = o.g; select(o.g); return; }
    const T = l.tools;
    if (!T) return;
    if (hitBtn('sew', T.sew, tap)) { if (B.sel !== null) commit(B.sel); else say('Tap the end of a row first.', 1.8); }
    else if (hitBtn('undo', T.undo, tap)) doUndo();
    else if (hitBtn('hint', T.hint, tap)) askHint();
    else if (hitBtn('clear', T.clear, tap)) doClear();
    else if (B.sel !== null) B.sel = null;
  }

  function updateSteady(dt, input) {
    const R = S.R, l = L(), p = input.pointer, k = input.keys.pressed;
    if (k.has('KeyP') || k.has('Escape')) S.paused = !S.paused;
    if (!S.paused && R.phase === 'play') steadyTick(dt);
    if (S.winDelay > 0 && !S.paused) { S.winDelay -= dt; if (S.winDelay <= 0 && S.result) go('over'); }
    if (S.paused) { if (p.pressed) pauseOverlayTap({ x: p.x, y: p.y }, l); return; }
    if (S.scene !== 'steady' || R.phase !== 'play') return;
    if (k.has('Space') || k.has('Enter')) steadyTap();
    if (!p.pressed) return;
    const tap = { x: p.x, y: p.y };
    if (hitBtn('pause', l.pause, tap)) { S.paused = true; return; }
    steadyTap();
  }

  function restorePurchase() {
    if (S.restoreBusy || S.owned || S.demo) return;
    S.restoreBusy = true; S.restoreMsg = 'Checking with the store...';
    Promise.resolve(monetization.restore()).then(() => {
      S.owned = !!monetization.owns?.('unlock_game');
      S.restoreMsg = S.owned ? 'Purchase restored' : 'No earlier purchase found';
    }).catch(() => { S.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { S.restoreBusy = false; });
  }
  function changeSetting(i, kk) {
    const id = settingRows(S)[i].id, p = S.prefs;
    switch (id) {
      case 'look': p.look = LOOK_IDS[kk]; setLook(p.look); break;
      case 'marks': p.marks = kk === 1; break;
      case 'floats': p.floats = kk === 0; break;
      case 'guide': p.guide = kk === 1; break;
      case 'sound': p.sound = kk === 0; audio.setMuted?.(!p.sound); break;
      case 'calm': p.calm = kk === 1; break;
      case 'restore': restorePurchase(); return;
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
    if (S.scene === 'steady') return updateSteady(dt, input);
    const p = input.pointer, scrolling = ['quilt', 'tiers', 'doc', 'settings', 'stats', 'over'].includes(S.scene);
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
      if (!tap) { if (input.keys.pressed.has('Enter') || input.keys.pressed.has('Space')) go('quilt'); return; }
      const T = titleLayout(w, h, !!S.saved), B = T.buttons;
      for (const id of Object.keys(B)) if (hitBtn(id, B[id], tap)) {
        sfx.tap();
        if (id === 'continue') resumeSaved();
        else if (id === 'quilt') go('quilt');
        else if (id === 'steady') go('tiers');
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
    if (sc === 'quilt' || sc === 'tiers') {
      const LL = listLayout(w, h);
      if (esc) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', LL.back, tap)) { go('title'); return; }
      if (hitBtn('tdec', LL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', LL.textInc, tap)) return textScale(1);
      if (!inRect(LL.body, tap.x, tap.y)) return;
      const ty = tap.y + S.scrollY, scl = TEXT_SCALES[S.prefs.textIdx];
      if (sc === 'quilt') {
        const J = quiltRects(LL.body, CHAPTERS.map((c) => c.count), scl);
        J.items.forEach((it) => it.lv.forEach((r, i) => { if (inRect(r, tap.x, ty)) { sfx.tap(); startLevel(it.ci, i); } }));
      } else {
        const Tr = tierRects(LL.body, RHYTHM.length, scl);
        Tr.cards.forEach((r, i) => { if (inRect(r, tap.x, ty)) { sfx.tap(); startSteady(i); } });
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
      const SL = settingsLayout(w, h, TEXT_SCALES[S.prefs.textIdx], settingRows(S).length);
      const leave = () => { if ((S.back === 'play' && S.B) || (S.back === 'steady' && S.R)) { S.scene = S.back; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
      if (esc) { leave(); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) return leave();
      if (hitBtn('tdec', SL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', SL.textInc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) {
        const ty = tap.y + S.scrollY;
        settingRows(S).forEach((row, i) => {
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
      const R0 = S.result, O = overLayout(w, h);
      if (!tap || !R0) return;
      if (hitBtn('next', O.btns.next, tap)) {
        if (R0.type === 'steady') { demoUncount(); startSteady(R0.tier); }
        else if (R0.kind === 'quilt' && R0.next) startLevel(R0.next[0], R0.next[1]);
        else if (R0.kind === 'quilt') go('quilt');
        else go('title');
      } else if (hitBtn('menu', O.btns.menu, tap)) { if (R0.type === 'steady') go('tiers'); else if (R0.kind === 'quilt') go('quilt'); else go('title'); }
      else if (hitBtn('share', O.btns.share, tap)) {
        if (R0.type === 'steady') env.share(`Kantha Running Stitch Quilt, Steady Hand (${RHYTHM[R0.tier].name}): ${R0.score} points, ${Math.round(R0.acc * 100)}% even stitches.`);
        else env.share(`Kantha Running Stitch Quilt: ${R0.name} sewn with ${R0.threads} thread${R0.threads === 1 ? '' : 's'} (best ${R0.aim}) and ${R0.stars} star${R0.stars === 1 ? '' : 's'}${R0.daily ? '. Streak ' + R0.streak : ''}.`);
      }
      return;
    }
    if (sc === 'demo-limit' && tap) go('title');
  }

  return {
    update(dt, input) {
      S.t += dt; S.sceneT += dt;
      v3.W = meta.width; v3.H = meta.height;
      S.press = input.pointer && input.pointer.down ? { x: input.pointer.x, y: input.pointer.y } : null;
      if (S.flash) { S.flash.t += dt; if (S.flash.t > 0.25) S.flash = null; }
      if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold) S.msg = null; }
      const frozen = S.paused || (S.auto.on && S.auto.paused);
      if (!frozen) {
        for (const k of Object.keys(S.pop)) { S.pop[k] += dt; if (S.pop[k] > 0.4) delete S.pop[k]; }
        for (const sp of S.sparks) { sp.t += dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 600 * dt; }
        S.sparks = S.sparks.filter((sp) => sp.t < sp.life);
        for (const f of S.fx) f.t += dt;
        S.fx = S.fx.filter((f) => f.t < 0.9);
        if (S.winT > 0) S.winT -= dt;
        for (const q of S.sfx) q.t -= dt;
        const due = S.sfx.filter((q) => q.t <= 0); if (due.length) { S.sfx = S.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
      }
      // the kit's preview pill sits top centre; in landscape it moves into the info panel so it never covers the cloth
      if (['play', 'steady'].includes(S.scene)) { const l = L(); meta.previewBadge = l.badge; } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { render(ctx, S, view ?? meta); },
    getState: () => S,
    // Counts real play only: a live patch or a running Steady Hand round. Menus, Rules, settings, Watch and Learn, pause, results are free.
    isPreviewExempt() {
      if (S.paused || S.auto.on) return true;
      if (S.scene === 'play') return !(S.B && !S.B.done);
      if (S.scene === 'steady') return !(S.R && S.R.phase === 'play');
      return true;
    },
    // Tester/screenshot hooks (only wired up in dev: see main.js).
    dev: {
      go: (scene, extra) => { Object.assign(S, extra ?? {}); go(scene); },
      level: (ci, i) => { S.dev = true; startLevel(ci, i); }, daily: () => startDaily(), auto: () => startAuto(), steady: (t) => startSteady(t),
      hint: () => askHint(), hintGo: () => hintGo(), doc: (kind, page = 0) => { S.doc = { kind, page }; go('doc'); },
      progress: (n) => {   // sew the first n rows of the best plan instantly
        const B = S.B; let c = 0;
        while (c < n && !B.done) { const h = findHint(B.P, B.steps); if (!h) break; B.steps.push({ g: h.g }); c += 1; B.wc = null; }
        B.wc = null;
        if (stateOf(B).done) win();
      },
      solveNow: () => { const B = S.B; let h; B.anim = null; while ((h = findHint(B.P, B.steps))) { B.steps.push({ g: h.g }); B.wc = null; } B.wc = null; win(); },
      skipOver: () => { S.winDelay = 0.01; },
      select: (g) => { S.B.sel = g; },
      sew: (g) => { select(g); select(g); },
      steadyAt: (t, jitter = 0.07) => {   // jump a round to time t with every earlier mark tapped with a small deterministic error
        const R = S.R, T = RHYTHM[R.tier];
        R.t = t;
        R.data.rows.forEach((row, r) => row.holes.forEach((hole, k) => {
          const hh = R.holes[r][k];
          if (hole.t < t - 0.3 && hh.res === null) {
            const err = ((((r * 31 + k * 17) % 11) - 5) / 5) * jitter, grade = judge(T, err);
            hh.res = 'hit'; hh.err = err; hh.grade = grade; R.counts[grade] += 1; R.base += POINTS[grade] ?? 0; R.combo += 1; R.score += (POINTS[grade] ?? 0) + Math.min(R.combo, 20) * 2;
          }
        }));
        R.data.rows.forEach((_, r) => updateRowAcc(r));
      },
      layout: () => { const l = L(), geo = geoOf(l); return { mode: l.mode, area: l.area, tools: l.tools, geo: { x0: geo.x0, y0: geo.y0, s: geo.s, side: geo.side }, pause: l.pause, w: meta.width, h: meta.height }; },
      setPrefs: (o) => { Object.assign(S.prefs, o); applyPrefs(); },
      unlockAll: () => { S.dev = true; },
      completion: () => completion(S.B.P, S.B.P.C, null),
      bestFinish: () => bestFinish(S.B.P, S.B.steps),
      state: () => ({ scene: S.scene, rows: S.B ? S.B.steps.length : null, done: S.B ? !!S.B.done : null, sel: S.B ? S.B.sel : null, nextG: S.B && !S.B.done ? (findHint(S.B.P, S.B.steps) || {}).g ?? null : null, size: [meta.width, meta.height] }),
      optPos: (g) => { const l = L(), geo = geoOf(l), o = S.B.P.opts[g]; return geo.P(o.from[0], o.from[1], 0.006); },
    },
  };
}
