// Abacus Soroban: state and flow. Engine = soroban.js, content = lessons.js, drawing = view.js + art.js, geometry = layout.js.
import { playLayout, titleLayout, docLayout, settingsLayout, listLayout, lessonCardH, levelCardH, statsLayout, overLayout, inRect, TEXT_SCALES, THINK_STEPS, clamp } from './layout.js';
import { digitsOf, valueOf, heavenOf, earthOf, plan, planTo, placeName } from './soroban.js';
import { LESSONS, LESSON_BY_ID, FLASH_LEVELS, SPRINT_LEVELS, flashSequence, nextSprintTask, tourExercises } from './lessons.js';
import { render, metrics } from './view.js';
import { posOf } from './art.js';
import { SETTINGS, DEFAULT_PREFS } from './prefs.js';
import { DOCS } from './content.js';
import { setLook, LOOK_IDS } from './ui.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen; everything lays out from the live size.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_SESSIONS = 3;
const SPRINT_SECONDS = 60, ROUNDS = 5, LESSON_LEN = 5;

const newAbacus = (rods) => {
  const A = { rods, d: new Array(rods).fill(0), hp: new Array(rods).fill(0), ep: Array.from({ length: rods }, () => [0, 0, 0, 0]), glow: new Array(rods).fill(0), sel: 0, hl: null };
  return A;
};
function setAbacus(A, value, instant = true) {
  A.d = digitsOf(value, A.rods);
  if (instant) A.d.forEach((v, r) => { const p = posOf(v); A.hp[r] = p.hp; A.ep[r] = p.ep.slice(); });
}
function animateAbacus(A, dt, calm) {
  const k = 1 - Math.exp(-dt * (calm ? 18 : 30));
  for (let r = 0; r < A.rods; r++) {
    const p = posOf(A.d[r]);
    A.hp[r] += (p.hp - A.hp[r]) * k; if (Math.abs(p.hp - A.hp[r]) < 0.004) A.hp[r] = p.hp;
    for (let i = 0; i < 4; i++) { A.ep[r][i] += (p.ep[i] - A.ep[r][i]) * k; if (Math.abs(p.ep[i] - A.ep[r][i]) < 0.004) A.ep[r][i] = p.ep[i]; }
    if (A.glow[r] > 0) A.glow[r] = Math.max(0, A.glow[r] - dt * 3);
  }
}
const stars3 = (helps) => (helps === 0 ? 3 : helps <= 3 ? 2 : 1);

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS },
    ab: newAbacus(5), run: null, hint: null, paused: false, accept: null, shake: 0,
    auto: { on: false, phase: 'think', timer: 0, paused: false, exs: [], ei: 0, oi: 0, plan: null, si: 0, hold: 0, caption: '', done: false, op: null, ex: null },
    sparks: [], sfx: [], msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0 }, back: 'title', result: null, levelsFor: 'flash',
    stats: { lessons: {}, flashBest: [0, 0, 0, 0, 0], sprintBest: [0, 0, 0, 0, 0], sessions: 0, beads: 0 }, demoCount: 0, haptic: 0, dev: config.dev === true,
  };
  let drag = null, gesture = null;

  // ---- persistence ---------------------------------------------------------------------------------------------------------
  const applyPrefs = () => { setLook(S.prefs.look); audio.setMuted?.(!S.prefs.sound); };
  const savePrefs = () => storage.set('prefs', S.prefs);
  const saveStats = () => storage.set('stats', S.stats);
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); if (!LOOK_IDS.includes(S.prefs.look)) S.prefs.look = 'kyoto'; } applyPrefs(); });
  storage.get('stats', null).then((v) => { if (v) S.stats = { ...S.stats, ...v, lessons: v.lessons ?? {}, flashBest: v.flashBest ?? S.stats.flashBest, sprintBest: v.sprintBest ?? S.stats.sprintBest }; });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  applyPrefs();

  // ---- sound (all synthesized) ------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound) audio.tone(o); };
  const later = (t, o) => S.sfx.push({ t, o });
  const sfx = {
    click: (r, engage) => { tone({ freq: (engage ? 1650 : 1250) + r * 70, to: 760, dur: 0.035, type: 'square', vol: 0.035 }); tone({ freq: engage ? 420 : 330, to: 250, dur: 0.06, type: 'triangle', vol: 0.09 }); },
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.06 }),
    good: () => { [659, 988].forEach((f, i) => later(i * 0.09, { freq: f, to: f, dur: 0.22, type: 'sine', vol: 0.09 })); },
    bad: () => tone({ freq: 200, to: 130, dur: 0.18, type: 'triangle', vol: 0.09 }),
    thud: () => tone({ freq: 150, to: 90, dur: 0.12, type: 'triangle', vol: 0.1 }),
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.08 }),
    flashTick: () => tone({ freq: 880, to: 880, dur: 0.05, type: 'sine', vol: 0.05 }),
    win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => later(i * 0.12, { freq: f, to: f, dur: 0.4, type: 'triangle', vol: 0.09 })); },
  };

  // ---- helpers -----------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.6) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; drag = null; wheelInput.dy = 0; S.msg = null; }
  const A = () => S.ab;
  const rodsNow = () => S.ab.rods;
  const choicesNow = () => (S.run && S.run.kind === 'lesson' && curEx()?.read ? curEx().read.options.length : 0);
  const L = () => playLayout(meta.width, meta.height, { rods: rodsNow(), choices: choicesNow() });
  function spark(cx, cy, n, color) {
    if (S.prefs.calm) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) { const a = rng.next() * Math.PI * 2, v = 80 + rng.next() * 240; S.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90, t: 0, life: 0.6 + rng.next() * 0.6, r: 3 + rng.next() * 4, c: color }); }
    if (S.sparks.length > 140) S.sparks.splice(0, S.sparks.length - 140);
  }
  const frozen = () => S.paused || (S.auto.on && S.auto.paused);
  const locked = () => S.paused || S.auto.on || !!S.accept || S.scene !== 'play' || !S.run || S.run.locked || (S.run.kind === 'lesson' && !!curEx()?.read) || (S.run.kind === 'flash' && S.run.phase !== 'answer');

  // ---- demo cap -----------------------------------------------------------------------------------------------------------------
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_SESSIONS) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }

  // ---- lessons ------------------------------------------------------------------------------------------------------------------
  const curEx = () => (S.run && S.run.kind === 'lesson' ? S.run.exs[S.run.idx] : null);
  function startLesson(id) {
    if (demoBlocked()) return;
    const les = LESSON_BY_ID[id];
    S.run = { kind: 'lesson', id, title: les.title, exs: les.gen(rng).slice(0, LESSON_LEN), idx: 0, op: 0, hints: 0, resets: 0, wrong: 0, skipped: 0, done: 0, t: 0, locked: false };
    S.paused = false; S.hint = null; S.accept = null; S.result = null;
    loadExercise(); go('play'); S.stats.sessions += 1;
  }
  function loadExercise() {
    const ex = curEx(); S.run.op = 0; S.hint = null; S.accept = null; S.run.readOk = -1; S.run.badPick = -1;
    S.ab = newAbacus(ex.rods); setAbacus(S.ab, ex.read ? ex.read.value : ex.start);
    S.ab.locked = !!ex.read;
  }
  function lessonBase() { const ex = curEx(), o = S.run.op; return o === 0 ? ex.start : ex.targets[o - 1]; }
  function lessonTarget() { const ex = curEx(); return ex.read ? ex.read.value : ex.targets[S.run.op]; }
  const helpsOf = (r) => r.hints + r.resets + r.wrong + r.skipped;
  function finishLesson() {
    const r = S.run, helps = helpsOf(r), stars = r.done === 0 ? 0 : stars3(helps);
    const prev = S.stats.lessons[r.id] ?? { stars: 0, plays: 0 };
    S.stats.lessons[r.id] = { stars: Math.max(prev.stars, stars), plays: prev.plays + 1 }; saveStats();
    S.result = { kind: 'lesson', id: r.id, title: r.title, stars, lines: [`${r.done} of ${LESSON_LEN} exercises done`, `${r.hints} hint${r.hints === 1 ? '' : 's'} · ${r.resets} reset${r.resets === 1 ? '' : 's'}${r.wrong ? ` · ${r.wrong} wrong choice${r.wrong === 1 ? '' : 's'}` : ''}${r.skipped ? ` · ${r.skipped} skipped` : ''}`] };
    monetization.track('lesson_done', { id: r.id, stars });
    sfx.win(); go('over');
  }

  // ---- flash ----------------------------------------------------------------------------------------------------------------------
  function startFlash(level) {
    if (demoBlocked()) return;
    S.prefs.flashLevel = level; savePrefs();
    S.run = { kind: 'flash', level, round: 0, right: 0, phase: 'ready', timer: 1.2, seq: [], show: -1, on: false, total: 0, ms: 1000, lastOk: null, t: 0, results: [], locked: false };
    S.paused = false; S.hint = null; S.accept = null; S.result = null; S.ab = newAbacus(5);
    beginFlashRound(); go('play'); S.stats.sessions += 1;
  }
  function beginFlashRound() {
    const r = S.run, f = flashSequence(rng, r.level);
    Object.assign(r, { seq: f.seq, total: f.total, ms: f.ms * 1000 / 1000, phase: 'ready', timer: 1.2, show: -1, on: false, lastOk: null });
    setAbacus(S.ab, 0, false); S.ab.locked = true;
  }
  function updateFlash(dt) {
    const r = S.run;
    if (r.phase === 'ready') { r.timer -= dt; if (r.timer <= 0) { r.phase = 'show'; r.show = 0; r.on = true; r.timer = r.ms / 1000; sfx.flashTick(); } }
    else if (r.phase === 'show') {
      r.timer -= dt;
      if (r.timer <= 0) {
        if (r.on) { r.on = false; r.timer = 0.22; if (r.show >= r.seq.length - 1) { r.phase = 'answer'; r.show = -1; S.ab.locked = false; } }
        else { r.show += 1; r.on = true; r.timer = r.ms / 1000; sfx.flashTick(); }
      }
    } else if (r.phase === 'reveal') {
      r.timer -= dt;
      if (r.timer <= 0) { r.round += 1; if (r.round >= ROUNDS) finishFlash(); else beginFlashRound(); }
    }
  }
  function checkFlash() {
    const r = S.run; if (r.phase !== 'answer') return;
    const ok = valueOf(S.ab.d) === r.total;
    r.lastOk = ok; if (ok) r.right += 1;
    r.results.push({ seq: r.seq.slice(), total: r.total, ok, said: valueOf(S.ab.d) });
    r.phase = 'reveal'; r.timer = ok ? 1.5 : 2.6; S.ab.locked = true;
    if (ok) { sfx.good(); spark(meta.width / 2, L().task.y + L().task.h / 2, 26, '#ffd25a'); } else { sfx.bad(); S.shake = 0.4; }
  }
  function finishFlash() {
    const r = S.run, stars = r.right >= 5 ? 3 : r.right === 4 ? 2 : r.right === 3 ? 1 : 0;
    const prev = S.stats.flashBest[r.level]; const newBest = r.right > prev; if (newBest) S.stats.flashBest[r.level] = r.right; saveStats();
    S.result = { kind: 'flash', level: r.level, title: `Flash Mental · ${FLASH_LEVELS[r.level].name}`, stars, score: r.right, outOf: ROUNDS, newBest, lines: [`${r.right} of ${ROUNDS} rounds right`, FLASH_LEVELS[r.level].tag] };
    monetization.track('flash_done', { level: r.level, right: r.right });
    sfx.win(); go('over');
  }

  // ---- sprint ---------------------------------------------------------------------------------------------------------------------
  function startSprint(level) {
    if (demoBlocked()) return;
    S.prefs.sprintLevel = level; savePrefs();
    S.run = { kind: 'sprint', level, time: SPRINT_SECONDS, score: 0, solved: 0, streak: 0, bestStreak: 0, total: 0, task: null, taskT: 0, hinted: false, hints: 0, skips: 0, resets: 0, t: 0, locked: false, last: null };
    S.paused = false; S.hint = null; S.accept = null; S.result = null; S.ab = newAbacus(5);
    S.run.task = nextSprintTask(rng, level, 0); go('play'); S.stats.sessions += 1;
  }
  function sprintNext(from) {
    const r = S.run; r.total = from; r.task = nextSprintTask(rng, r.level, from); r.taskT = 0; r.hinted = false; S.hint = null;
    if (r.task.reset) { r.total = 0; setAbacus(S.ab, 0, false); }
  }
  function finishSprint() {
    const r = S.run, prev = S.stats.sprintBest[r.level], newBest = r.score > prev;
    if (newBest) S.stats.sprintBest[r.level] = r.score; saveStats();
    const stars = r.score >= 400 ? 3 : r.score >= 220 ? 2 : r.solved >= 3 ? 1 : 0;
    S.result = { kind: 'sprint', level: r.level, title: `Timed Challenge · ${SPRINT_LEVELS[r.level].name}`, stars, score: r.score, newBest, best: Math.max(prev, r.score), lines: [`${r.solved} tasks solved · best streak ${r.bestStreak}`, SPRINT_LEVELS[r.level].tag] };
    monetization.track('sprint_done', { level: r.level, score: r.score });
    sfx.win(); go('over');
  }

  // ---- watch and learn ----------------------------------------------------------------------------------------------------------------
  const thinkSecs = () => THINK_STEPS[S.prefs.thinkIdx] ?? 5;
  function startAuto() {
    S.run = null; S.paused = false; S.hint = null; S.accept = null;
    const exs = tourExercises(rng);
    S.auto = { on: true, phase: 'think', timer: 0, paused: false, exs, ei: 0, oi: 0, plan: null, si: 0, hold: 0, caption: '', done: false, op: null, ex: null };
    autoExercise(); go('play');
  }
  // Watch and Learn for Flash Mental: two rounds play themselves (numbers flash, THINK, REVEAL the total, ACT sets it on the beads).
  function startAutoFlash(level) {
    S.run = null; S.paused = false; S.hint = null; S.accept = null;
    const exs = [0, 1].map(() => { const f = flashSequence(rng, level); return { rods: 5, start: 0, flashSeq: f.seq, ms: f.ms, ops: [{ op: '+', n: Math.max(1, f.total), label: `Total ${f.total}` }] }; });
    S.auto = { on: true, phase: 'think', timer: 0, paused: false, exs, ei: 0, oi: 0, plan: null, si: 0, hold: 0, caption: '', done: false, op: null, ex: null, show: -1, fon: false, flash: true };
    autoExercise(); go('play');
  }
  function autoExercise() {
    const a = S.auto, ex = a.exs[a.ei]; a.ex = ex; a.oi = 0;
    S.ab = newAbacus(ex.rods); setAbacus(S.ab, ex.start); S.ab.locked = true;
    autoOp();
  }
  function autoOp() {
    const a = S.auto, ex = a.ex; a.op = ex.ops[a.oi];
    a.plan = plan(S.ab.d, a.op.op, a.op.n); a.phase = 'think'; a.timer = thinkSecs(); a.si = 0; a.hold = 0; S.ab.hl = null;
    a.caption = `Think: ${a.op.label}. Which beads will move?`;
    if (a.ex.flashSeq && a.oi === 0) { a.phase = 'show'; a.show = 0; a.fon = true; a.timer = a.ex.ms / 1000; a.caption = 'Watch the numbers go by and keep a running total in your head.'; sfx.flashTick(); }
  }
  function autoThinkTotal() { const a = S.auto; a.phase = 'think'; a.timer = thinkSecs(); a.show = -1; a.fon = false; a.caption = 'Think: what is the total? Add the numbers in your head.'; }
  function autoTick(dt) {
    const a = S.auto;
    if (a.done) return;
    a.timer -= dt;
    if (a.phase === 'show') {
      if (a.timer <= 0) {
        if (a.fon) { a.fon = false; a.timer = 0.22; if (a.show >= a.ex.flashSeq.length - 1) autoThinkTotal(); }
        else { a.show += 1; a.fon = true; a.timer = a.ex.ms / 1000; sfx.flashTick(); }
      }
    } else if (a.phase === 'think') {
      if (a.timer <= 0) {
        const first = a.plan.steps.find((s) => s.kind !== 'place') ?? a.plan.steps[0];
        a.phase = 'reveal'; a.timer = 2; S.ab.hl = { rod: first.rod, part: 'rod' };
        a.caption = a.plan.steps[0] ? a.plan.steps[0].text : 'Watch the highlighted rod.'; sfx.hint();
      }
    } else if (a.phase === 'reveal') {
      if (a.timer <= 0) { a.phase = 'act'; a.timer = 0; a.si = 0; }
    } else if (a.phase === 'act') {
      if (a.timer <= 0) {
        const st = a.plan.steps[a.si];
        if (!st) {
          if (a.hold === 0) { a.hold = 1; a.timer = 1.4; a.caption = `${valueOf(S.ab.d)}. ${a.op.label} done.`; S.ab.hl = null; sfx.good(); spark(meta.width / 2, L().avail.y + L().avail.h * 0.4, 18, '#ffd25a'); return; }
          a.oi += 1;
          if (a.oi < a.ex.ops.length) { autoOp(); return; }
          a.ei += 1;
          if (a.ei < a.exs.length) { autoExercise(); return; }
          a.done = true; a.caption = a.flash ? 'That was Flash Mental. Try a level yourself, or watch again.' : 'That was the tour. Try a lesson, or watch again.'; S.ab.hl = null; sfx.win(); return;
        }
        S.ab.hl = { rod: st.rod, part: 'rod' };
        if (st.to !== S.ab.d[st.rod]) { const old = S.ab.d[st.rod]; S.ab.d[st.rod] = st.to; S.ab.glow[st.rod] = 1; sfx.click(st.rod, st.to > old); S.haptic += 1; }
        a.caption = st.text; a.timer = clamp(1.1 + st.text.length * 0.032, 1.5, 4.2); a.si += 1;
      }
    }
  }

  // ---- bead interaction -------------------------------------------------------------------------------------------------------------------
  function setRod(r, nd) {
    const A0 = S.ab, old = A0.d[r]; if (nd === old || nd < 0 || nd > 9) return;
    A0.d[r] = nd; A0.glow[r] = 0.6; A0.sel = r; S.stats.beads += 1; S.haptic += 1;
    sfx.click(r, nd > old); env.haptic?.('click');
    onChange();
  }
  const tapBead = (r, kind, i) => {
    const d = S.ab.d[r], h = heavenOf(d), e = earthOf(d);
    if (kind === 'h') return setRod(r, (h ? 0 : 5) + e);
    return setRod(r, h * 5 + (i < e ? i : i + 1));
  };
  const slideBead = (r, kind, i, toward) => {
    const d = S.ab.d[r], h = heavenOf(d), e = earthOf(d);
    if (kind === 'h') return setRod(r, (toward ? 5 : 0) + e);
    return setRod(r, h * 5 + (toward ? Math.max(e, i + 1) : Math.min(e, i)));
  };
  function pickBead(g, r, y) {
    if (y <= g.beamTop + g.beamH * 0.5) return { kind: 'h', i: 0 };
    let best = 0, bd = 1e9;
    for (let i = 0; i < 4; i++) { const dy = Math.abs(g.earthY(i, S.ab.ep[r][i]) - y); if (dy < bd) { bd = dy; best = i; } }
    return { kind: 'e', i: best };
  }
  function pointerBeads(p) {
    const g = L().geo;
    if (locked()) { drag = null; return; }
    if (p.pressed) {
      const r = g.colAt(p.x);
      if (r >= 0 && p.y >= g.y - g.slot && p.y <= g.y + g.h + g.slot) { const b = pickBead(g, r, p.y); drag = { r, kind: b.kind, i: b.i, y0: p.y, moved: false }; S.ab.sel = r; } else drag = null;
    }
    if (drag && p.down) {
      const dy = p.y - drag.y0, thr = g.slot * 0.3;
      if (Math.abs(dy) >= thr) {
        const toward = drag.kind === 'h' ? dy > 0 : dy < 0;
        slideBead(drag.r, drag.kind, drag.i, toward); drag.moved = true; drag.y0 = p.y;
      }
    }
    if (drag && p.released) { if (!drag.moved) tapBead(drag.r, drag.kind, drag.i); drag = null; }
  }
  function keyBeads(k) {
    if (locked()) return;
    const A0 = S.ab;
    if (k.has('ArrowLeft')) A0.sel = Math.min(A0.rods - 1, A0.sel + 1);
    if (k.has('ArrowRight')) A0.sel = Math.max(0, A0.sel - 1);
    if (k.has('ArrowUp')) setRod(A0.sel, Math.min(9, A0.d[A0.sel] + 1));
    if (k.has('ArrowDown')) setRod(A0.sel, Math.max(0, A0.d[A0.sel] - 1));
    for (const code of k) { const m = /^(?:Digit|Numpad)([0-9])$/.exec(code); if (m) setRod(A0.sel, Number(m[1])); }
  }

  // ---- progress -----------------------------------------------------------------------------------------------------------------------
  function onChange() {
    if (S.hint) refreshHint(true);
    const r = S.run; if (!r || S.accept) return;
    const v = valueOf(S.ab.d);
    if (r.kind === 'lesson' && !curEx().read && v === lessonTarget()) accept(0.55);
    else if (r.kind === 'sprint' && v === r.task.target) accept(0.16);
  }
  function accept(hold) {
    const r = S.run; S.accept = { t: 0, hold };
    sfx.good(); const l = L(); spark(l.geo.x + l.geo.w / 2, l.geo.beamTop, r.kind === 'sprint' ? 12 : 22, '#ffd25a');
    S.ab.sel = -1;
    if (r.kind === 'sprint') {
      const sec = r.taskT, speed = Math.max(0, 10 - Math.floor(sec)), bonus = Math.min(r.streak, 5) * 2;
      const pts = 10 + speed + bonus; r.score += pts; r.solved += 1; r.streak += 1; r.bestStreak = Math.max(r.bestStreak, r.streak); r.last = { pts, t: 0 };
    }
  }
  function advanceAccepted() {
    const r = S.run; S.accept = null; S.hint = null;
    if (r.kind === 'lesson') {
      const ex = curEx();
      if (r.op + 1 < ex.ops.length) { r.op += 1; return; }
      r.done += 1; r.idx += 1;
      if (r.idx >= r.exs.length) finishLesson(); else loadExercise();
    } else if (r.kind === 'sprint') sprintNext(r.task.target);
  }
  function chooseRead(i) {
    const r = S.run, ex = curEx(); if (S.accept) return;
    const v = ex.read.options[i];
    if (v === ex.read.value) { S.run.readOk = i; accept(0.7); } else { r.wrong += 1; S.shake = 0.35; sfx.bad(); r.badPick = i; }
  }
  function refreshHint(silent) {
    const r = S.run; if (!r || r.kind === 'flash') return;
    const target = r.kind === 'lesson' ? lessonTarget() : r.task.target;
    const p = planTo(S.ab.d, target);
    if (!p || p.error) { S.hint = p ? { text: 'Clear the rods with Reset and try again.', rod: -1, steps: [] } : null; return; }
    const first = p.steps.find((s) => s.kind !== 'place') ?? p.steps[0];
    let end = p.steps.findIndex((st, i) => i > 0 && st.kind === 'place'); if (end < 0) end = p.steps.length;
    const more = end < p.steps.length ? ` Then the ${placeName(p.steps[end].rod)} rod.` : '';
    S.hint = { steps: p.steps, rod: first.rod, text: p.steps.slice(0, end).map((st) => st.text).join(' ') + more };
    if (!silent) sfx.hint();
  }
  function askHint() {
    const r = S.run; if (!r || r.kind === 'flash' || S.accept) return;
    if (curEx()?.read) { say('Look at which beads touch the beam: 5 for a heaven bead, 1 for each earth bead.', 3.2); return; }
    if (r.kind === 'sprint') { if (!r.hinted) { r.hinted = true; r.hints += 1; r.time = Math.max(0, r.time - 3); r.streak = 0; } } else r.hints += 1;
    refreshHint(false);
  }
  function resetRods() {
    const r = S.run; if (!r || S.accept) return;
    if (r.kind === 'flash') { setAbacus(S.ab, 0, false); sfx.thud(); return; }
    if (curEx()?.read) return;
    setAbacus(S.ab, r.kind === 'lesson' ? lessonBase() : r.total, false); sfx.thud();
    if (r.kind === 'lesson') r.resets += 1; else { r.resets += 1; r.streak = 0; }
    if (S.hint) refreshHint(true);
  }
  function skipTask() {
    const r = S.run; if (!r || S.accept) return;
    if (r.kind === 'lesson') { r.skipped += 1; r.idx += 1; if (r.idx >= r.exs.length) finishLesson(); else loadExercise(); }
    else if (r.kind === 'sprint') { r.time = Math.max(0, r.time - 3); r.skips += 1; r.streak = 0; setAbacus(S.ab, r.total, false); sprintNext(r.total); }
  }

  // ---- settings / text ------------------------------------------------------------------------------------------------------------------
  function changeSetting(i, k) {
    const id = SETTINGS[i].id, p = S.prefs;
    switch (id) {
      case 'look': p.look = LOOK_IDS[k]; setLook(p.look); break;
      case 'readout': p.readout = k === 0; break;
      case 'digits': p.digits = k === 0; break;
      case 'sound': p.sound = k === 0; audio.setMuted?.(!p.sound); break;
      case 'calm': p.calm = k === 1; break;
      case 'think': p.thinkIdx = k; break;
      case 'restore': monetization.restore().then(() => say('Purchases restored.', 2)).catch(() => {}); return;
      default: break;
    }
    savePrefs(); sfx.tap();
  }
  function textScale(dir) { const n = clamp(S.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (n !== S.prefs.textIdx) { S.prefs.textIdx = n; S.scrollY = 0; savePrefs(); } }

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

  // ---- play ------------------------------------------------------------------------------------------------------------------------------
  function leavePlay() {
    S.auto.on = false; S.paused = false; S.hint = null; S.accept = null; S.ab.hl = null; S.run = null;
    go(S.back === 'lessons' ? 'lessons' : S.back === 'levels' ? 'levels' : 'title');
  }
  function updatePlay(dt, p, input) {
    const l = L(), r = S.run, a = S.auto;
    const k = input.keys.pressed;
    // timers
    if (!frozen()) {
      if (S.accept) { S.accept.t += dt; if (S.accept.t >= S.accept.hold) advanceAccepted(); }
      else if (r && !S.paused) {
        r.t += dt;
        if (r.kind === 'flash') updateFlash(dt);
        if (r.kind === 'sprint') {
          r.taskT += dt; r.time -= dt;
          if (r.time <= 0) { r.time = 0; finishSprint(); return; }
        }
      }
      if (a.on) autoTick(dt);
    }
    if (S.scene !== 'play') return;
    // buttons
    const press = p.pressed ? { x: p.x, y: p.y } : null;
    if (k.has('Escape')) { leavePlay(); return; }
    if (k.has('KeyP')) togglePause();
    if (press) {
      if (hitBtn('menu', l.menu, press)) { leavePlay(); return; }
      if (hitBtn('pause', l.pause, press)) { togglePause(); return; }
      if (a.on) {
        if (hitBtn('b0', l.b[0], press)) { if (a.done) { if (a.flash) startAutoFlash(S.prefs.flashLevel); else startAuto(); } else a.paused = !a.paused; }
        else if (hitBtn('b1', l.b[1], press)) { if (!a.done) { if (a.ei + 1 < a.exs.length) { a.ei += 1; autoExercise(); } else { a.done = true; a.caption = 'That was the tour.'; } } }
        else if (hitBtn('b2', l.b[2], press)) leavePlay();
        return;
      }
      if (S.paused) { return pausedPress(press, l); }
      if (r) {
        if (r.kind === 'lesson' && curEx().read) {
          l.choices?.forEach((c, i) => { if (inRect(c, press.x, press.y)) { flash('c' + i); chooseRead(i); } });
        }
        if (hitBtn('b0', l.b[0], press)) { if (r.kind === 'flash') { if (r.phase === 'answer') resetRods(); } else askHint(); }
        else if (hitBtn('b1', l.b[1], press)) { if (r.kind === 'flash') checkFlash(); else resetRods(); }
        else if (hitBtn('b2', l.b[2], press)) { if (r.kind !== 'flash') skipTask(); else if (r.phase === 'answer') checkFlash(); }
      }
    }
    if (k.has('KeyH')) askHint();
    if (k.has('KeyR')) resetRods();
    if (r && r.kind === 'flash' && (k.has('Enter') || k.has('Space'))) checkFlash();
    pointerBeads(p); keyBeads(k);
  }
  function togglePause() {
    if (S.auto.on) { S.auto.paused = !S.auto.paused; return; }
    if (!S.run) return;
    S.paused = !S.paused; if (S.paused) drag = null;
  }
  function pausedPress(press, l) {
    const c = pauseCard(l);
    if (inRect(c.resume, press.x, press.y)) { S.paused = false; flash('resume'); }
    else if (inRect(c.menu, press.x, press.y)) { S.paused = false; leavePlay(); }
  }
  function pauseCard(l) {
    const w = Math.min(420, l.geo.w), h = 330, x = l.geo.x + (l.geo.w - w) / 2, y = l.geo.y + Math.max(10, (l.geo.h - h) / 2);
    return { card: { x, y, w, h }, resume: { x: x + 24, y: y + 86, w: w - 48, h: 92 }, menu: { x: x + 24, y: y + 196, w: w - 48, h: 92 } };
  }

  // ---- scenes ---------------------------------------------------------------------------------------------------------------------------------
  function updateScene(dt, input) {
    const p = input.pointer, scrolling = ['lessons', 'levels', 'doc', 'settings', 'stats'].includes(S.scene);
    const tap = getTap(p, scrolling ? metrics.rect : null);
    if (scrolling) {
      if (wheelInput.dy) { S.scrollY = clamp(S.scrollY + wheelInput.dy, 0, metrics.max); wheelInput.dy = 0; }
      const k = input.keys.pressed;
      if (k.has('ArrowDown')) S.scrollY = clamp(S.scrollY + 80, 0, metrics.max);
      if (k.has('ArrowUp')) S.scrollY = clamp(S.scrollY - 80, 0, metrics.max);
      S.scrollY = clamp(S.scrollY, 0, metrics.max);
    }
    const sc = S.scene, w = meta.width, h = meta.height;
    if (sc === 'play') return updatePlay(dt, p, input);
    if (sc === 'title') {
      if (!tap) return;
      const T = titleLayout(w, h), B = T.buttons;
      for (const id of Object.keys(B)) if (hitBtn(id, B[id], tap)) {
        sfx.tap();
        if (id === 'lessons') { S.back = 'title'; go('lessons'); }
        else if (id === 'flash' || id === 'sprint') { S.levelsFor = id; go('levels'); }
        else if (id === 'learn') { S.back = 'title'; startAuto(); }
        else if (id === 'howto' || id === 'rules' || id === 'about') { S.doc = { kind: id, page: 0 }; go('doc'); }
        else if (id === 'stats') go('stats');
        else if (id === 'settings') go('settings');
        return;
      }
      if (Math.abs(tap.x - T.brand.x) < 260 && Math.abs(tap.y - T.brand.y) < 26) env.openArcforgeHome?.();
      return;
    }
    if (sc === 'lessons' || sc === 'levels') {
      const n = sc === 'lessons' ? LESSONS.length : 5, LL = listLayout(w, h, n, sc === 'lessons' ? lessonCardH(TEXT_SCALES[S.prefs.textIdx]) : levelCardH(TEXT_SCALES[S.prefs.textIdx]));
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', sc === 'levels' && S.levelsFor === 'flash' ? LL.back2 : LL.back, tap)) { go('title'); return; }
      if (sc === 'levels' && S.levelsFor === 'flash' && hitBtn('watch', LL.watch, tap)) { S.back = 'levels'; startAutoFlash(S.prefs.flashLevel); return; }
      if (hitBtn('tdec', LL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', LL.textInc, tap)) return textScale(1);
      if (inRect(LL.body, tap.x, tap.y)) {
        for (let i = 0; i < n; i++) {
          const rr0 = { ...LL.cards[i], y: LL.cards[i].y - S.scrollY };
          if (inRect(rr0, tap.x, tap.y)) {
            sfx.tap();
            if (sc === 'lessons') { S.back = 'lessons'; startLesson(LESSONS[i].id); } else { S.back = 'levels'; if (S.levelsFor === 'flash') startFlash(i); else startSprint(i); }
            return;
          }
        }
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
      const SL = settingsLayout(w, h, TEXT_SCALES[S.prefs.textIdx], SETTINGS.length);
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) return go('title');
      if (hitBtn('tdec', SL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', SL.textInc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) {
        const ty = tap.y + S.scrollY;
        SETTINGS.forEach((row, i) => {
          const g = SL.rows[i], n = row.opts.length, cw = (g.ctrl.w - 8 * (n - 1)) / n;
          for (let k = 0; k < n; k++) { const rr0 = { x: g.ctrl.x + k * (cw + 8), y: g.ctrl.y, w: cw, h: g.ctrl.h }; if (inRect(rr0, tap.x, ty)) { flash('set' + i + '.' + k); changeSetting(i, k); } }
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
      const O = overLayout(w, h);
      if (!tap) return;
      const R0 = S.result;
      if (hitBtn('next', O.btns.next, tap)) {
        if (R0.kind === 'lesson') { const i = LESSONS.findIndex((x) => x.id === R0.id); const nx = R0.stars > 0 && i + 1 < LESSONS.length ? LESSONS[i + 1].id : R0.id; startLesson(nx); }
        else if (R0.kind === 'flash') startFlash(R0.level); else startSprint(R0.level);
      } else if (hitBtn('menu', O.btns.menu, tap)) go(S.back === 'lessons' ? 'lessons' : S.back === 'levels' ? 'levels' : 'title');
      else if (hitBtn('share', O.btns.share, tap)) env.share(`Abacus Soroban: ${R0.title} - ${R0.kind === 'sprint' ? R0.score + ' points' : R0.kind === 'flash' ? R0.score + ' of ' + R0.outOf + ' right' : R0.stars + ' star' + (R0.stars === 1 ? '' : 's')}.`);
      return;
    }
    if (sc === 'demo-limit' && tap) go('title');
  }

  return {
    update(dt, input) {
      S.t += dt; S.sceneT += dt;
      try { config.textScale = TEXT_SCALES[S.prefs.textIdx]; } catch { /* config is read-only */ }
      if (S.flash) { S.flash.t += dt; if (S.flash.t > 0.25) S.flash = null; }
      if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold) S.msg = null; }
      if (S.shake > 0) S.shake = Math.max(0, S.shake - dt);
      if (!frozen()) {
        animateAbacus(S.ab, dt, S.prefs.calm);
        for (const sp of S.sparks) { sp.t += dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 600 * dt; }
        S.sparks = S.sparks.filter((sp) => sp.t < sp.life);
        for (const q of S.sfx) q.t -= dt;
        const due = S.sfx.filter((q) => q.t <= 0); if (due.length) { S.sfx = S.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
        if (S.run && S.run.last) { S.run.last.t += dt; if (S.run.last.t > 1) S.run.last = null; }
      }
      // the kit's preview pill: centred between the header and the task card
      if (S.scene === 'play') { const l = L(); meta.previewBadge = { x: l.pill.x, y: l.pill.y, align: 'center' }; } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { render(ctx, S, view ?? meta, { pauseCard, curEx, lessonTarget, helpsOf, thinkSecs }); },
    getState: () => S,
    // Counts real play only: a live task in a lesson, flash session or sprint. Menus, Rules, Watch and Learn, pause and results are free.
    isPreviewExempt() { return !(S.scene === 'play' && !S.auto.on && !S.paused && S.run); },
    // Tester/screenshot hooks (only wired up in dev: see main.js).
    dev: {
      go: (scene, extra) => { Object.assign(S, extra ?? {}); go(scene); },
      lesson: (id) => startLesson(id), flash: (lv) => startFlash(lv), sprint: (lv) => startSprint(lv), auto: () => startAuto(), autoFlash: (lv = 1) => startAutoFlash(lv), hint: () => askHint(),
      set: (value) => { setAbacus(S.ab, value, true); onChange(); }, doc: (kind, page = 0) => { S.doc = { kind, page }; go('doc'); },
      layout: () => { const l = L(); return { panel: l.panel, geo: { x: l.geo.x, y: l.geo.y, w: l.geo.w, h: l.geo.h, slot: l.geo.slot }, w: meta.width, h: meta.height }; },
      skipTo: (n) => { if (S.run?.kind === 'lesson') { S.run.idx = n; loadExercise(); } },
    },
  };
}
