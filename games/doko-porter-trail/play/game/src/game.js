// Doko Porter Trail: state and flow. Rules = engine.js, drawing = scene.js + porter.js + screens.js, geometry = layout.js.
import { K, TRAILS, CHAPTERS, TRAILS_PER_CHAPTER, genTrail, trailSpec, newRun, stepRun, botControl, coachFor, cardForSeg, cardForGust, starsFor, longRoadScore, segAt, slopeAt, groundY } from './engine.js';
import { playLayout, titleLayout, headerLayout, docLayout, settingsLayout, journeyRects, pauseLayout, overLayout, inRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { DOCS } from './content.js';
import { drawTitle, drawJourney, drawDoc, drawSettings, drawHud, drawPause, drawOver, drawDemo, metrics, settingRows } from './screens.js';
import { drawScene } from './scene.js';
import { mode3d } from './mode3d.js';
import { goodWorldPos, LOAD_KEYS } from './porter.js';
import { setLook } from './ui.js';

// Fluid viewport: the short side is 720 units, the long side follows the screen.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_RUNS = 3;
const DEFAULT_PREFS = { sound: true, assist: false, hand: 'right', restCue: true, textIdx: 0, thinkIdx: 1, lesson: 0 };
const DAILY_D = [0.45, 0.3, 0.42, 0.52, 0.62, 0.72, 0.82];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const LESSON_SEEDS = [4001, 4004, 4005];

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS }, run: null, doc: { kind: 'rules', page: 0 }, scrollY: 0, msg: null,
    flash: null, back: 'title', result: null, progress: {}, stats: { bestLong: 0, days: [], trailsDone: 0, longRuns: 0 },
    streak: 0, dailyDone: false, dailyDay: config.day ?? 0, demoCount: 0, dev: config.dev === true, demo: config.demo === true, owned: false, restoreBusy: false, sfx: [], titleBrand: null,
    menu: { trail: genTrail({ name: 'Menu', kg: 30, items: 5, len: 400, d: 0.5, seed: 9931 }), x: 0, f: 0.12, pose: null, phase: 0 },
    isOpen: null,
  };
  S.menu.pose = { phase: 0, walking: 0.8, breathLevel: 1, lean: 0.12, load: 0, rest: 0, items: 5, loadKind: 'sacks', slope: 0 };
  let gestureTap = null;

  // ---- persistence ----------------------------------------------------------------------------------------------------
  const applyPrefs = () => { setLook('highland'); audio.setMuted?.(!S.prefs.sound); };
  const savePrefs = () => storage.set('prefs', S.prefs);
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); } applyPrefs(); });
  storage.get('progress', null).then((v) => { if (v) S.progress = { ...v, ...S.progress }; });
  storage.get('stats', null).then((v) => { if (v) { S.stats = { ...S.stats, ...v, days: v.days ?? [] }; } refreshDaily(); });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  applyPrefs();
  function refreshDaily() {
    const day = S.dailyDay, set = new Set(S.stats.days);
    let streak = 0, d = set.has(day) ? day : day - 1;
    while (set.has(d)) { streak += 1; d -= 1; }
    S.streak = streak; S.dailyDone = set.has(day);
  }
  refreshDaily();
  S.isOpen = (idx) => S.dev || config.demo || idx === 0 || !!S.progress[idx] || !!S.progress[idx - 1];

  // ---- sound ------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound) audio.tone(o); };
  const later = (t, o) => S.sfx.push({ t, o });
  const sfx = {
    foot: (heavy) => tone({ freq: 96 + heavy * 12, to: 60, dur: 0.07, type: 'sine', vol: 0.05 }),
    step: () => tone({ freq: 210, to: 120, dur: 0.06, type: 'triangle', vol: 0.06 }),
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.06 }),
    spill: () => { tone({ freq: 300, to: 120, dur: 0.22, type: 'sawtooth', vol: 0.06 }); later(0.1, { freq: 180, to: 90, dur: 0.2, type: 'triangle', vol: 0.06 }); },
    gust: () => tone({ freq: 220, to: 330, dur: 0.5, type: 'sine', vol: 0.04 }),
    chime: () => { tone({ freq: 880, to: 880, dur: 0.3, type: 'sine', vol: 0.06 }); later(0.14, { freq: 1175, to: 1175, dur: 0.4, type: 'sine', vol: 0.06 }); },
    repack: () => tone({ freq: 520, to: 780, dur: 0.18, type: 'triangle', vol: 0.07 }),
    halt: () => tone({ freq: 160, to: 100, dur: 0.4, type: 'sine', vol: 0.07 }),
    creak: () => tone({ freq: 140, to: 125, dur: 0.18, type: 'sawtooth', vol: 0.025 }),
    arrive: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => later(i * 0.13, { freq: f, to: f, dur: 0.45, type: 'triangle', vol: 0.08 })); },
    lost: () => { [392, 330, 262].forEach((f, i) => later(i * 0.2, { freq: f, to: f * 0.96, dur: 0.4, type: 'triangle', vol: 0.07 })); },
  };

  // ---- helpers --------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.4) => { S.msg = { text, t: 0, hold }; };
  const flashBtn = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; gestureTap = null; wheelInput.dy = 0; S.msg = null; }
  const dayFraction = (run) => (run.trail.endless ? (run.R.t / 150) % 1.2 : clamp(run.R.t / run.trail.dayLen, 0, 1.25));

  // ---- starting a trail --------------------------------------------------------------------------------------------------------
  function begin(trail, kind, ref, extra = {}) {
    const idx = extra.idx ?? -1;
    const firstWalk = idx === 0 && !S.progress[0];   // the very first walk of the first trail is kinder: a softer load and a how-to card
    const R = newRun(trail, { assist: S.prefs.assist || firstWalk });
    S.run = {
      trail, R, kind, ref, idx, name: trail.name, mem: {}, ctrl: { hold: false, lean: 0, pace: 1 }, anchor: null, kLean: 0, hint: null, hints: 0,
      paused: false, falls: [], msg: null, loadKind: LOAD_KEYS[(idx >= 0 ? idx : trail.seed) % LOAD_KEYS.length], walkS: 0, restS: 0, shake: 0, endT: 0,
      footPrev: 0, auto: { phase: 'act', timer: 0, paused: false, card: null, seen: [], done: false, n: 0 }, announcedRest: false, creakT: 0, ...extra,
    };
    S.result = null;
    if (firstWalk && kind === 'journey') S.run.hint = { card: { kind: 'intro', title: 'Hold to walk, lean to balance', text: 'Keep your thumb down to walk. When the load tips, drag your thumb the other way, a little, to bring it back to the middle. Lift your thumb to rest.', lean: 0, pace: 1 }, t: 0, ttl: 14 };
    go('play');
  }
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_RUNS) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }
  function startTrail(idx) {
    if (!S.isOpen(idx)) { say('Finish the trail before it first.', 2); return; }
    if (demoBlocked()) return;
    begin(genTrail(trailSpec(idx)), 'journey', `t${idx}`, { idx });
  }
  function startLong() {
    if (config.demo) { say('The Long Road is in the full game.', 2.4); return; }
    const seed = 3001 + rng.int(900000);
    begin(genTrail({ name: 'Long Road', story: 'No end, no dusk. How far can you carry it?', kg: 30, items: 5, len: 160, d: 0.25, seed, endless: true, theme: 0 }), 'long', 'long');
  }
  function startDaily() {
    if (config.demo) { say('The Daily Trail is in the full game.', 2.4); return; }
    const day = S.dailyDay, wd = (((day + 4) % 7) + 7) % 7;
    const trail = genTrail({ name: 'Daily Trail', story: 'The same trail for everyone today.', kg: 36 + (day % 3) * 2, items: 6, len: 110 + (day % 5) * 10, d: DAILY_D[wd], seed: 12000 + day * 17, theme: day % 3, rain: day % 4 === 0 });
    begin(trail, 'daily', `day:${day}`, { day });
  }
  function startAuto() {
    const n = S.prefs.lesson % LESSON_SEEDS.length; S.prefs.lesson = (S.prefs.lesson + 1) % LESSON_SEEDS.length; savePrefs();
    const trail = genTrail({ name: 'Lesson trail', story: '', kg: 34, items: 6, len: 130, d: 0.6, seed: LESSON_SEEDS[n], theme: n % 3 });
    begin(trail, 'auto', 'auto');
    S.run.auto.card = { title: 'Watch and Learn', text: 'The game walks a whole trail. It stops before each hazard to explain it, shows the lean and pace, then walks it.' };
    S.run.auto.phase = 'think'; S.run.auto.timer = THINK_STEPS[S.prefs.thinkIdx];
  }

  // ---- hints and Watch and Learn --------------------------------------------------------------------------------------------------
  function askHint() {
    const run = S.run;
    if (run.R.ended) return;
    run.hint = { card: coachFor(run.R, run.trail), t: 0, ttl: 10 };
    run.hints += 1; tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.07 });
  }
  const upcoming = (run) => {
    const { R, trail } = run, a = run.auto;
    const seg0 = segAt(trail, R.x);
    for (let i = trail.segs.indexOf(seg0); i < trail.segs.length; i++) {
      const s = trail.segs[i];
      if (s.x0 - R.x > 5.5) break;
      if (s.t === 'flat' || a.seen.includes(s.x0)) continue;
      if (s.t === 'rest' && R.breath > 0.9 && R.items >= R.items0) { a.seen.push(s.x0); continue; }
      return { seg: s };
    }
    const g = trail.gusts[R.gustIdx];
    if (g && g.x - R.x < 5.5 && g.x > R.x && !a.seen.includes(`g${g.x}`)) return { gust: g };
    return null;
  };
  function autoControl(dt) {
    const run = S.run, a = run.auto, R = run.R;
    if (a.paused || a.done) return { hold: false, lean: 0, pace: 1 };
    if (a.phase === 'think') {
      a.timer -= dt;
      if (a.timer <= 0) { a.phase = 'reveal'; a.timer = 2; run.hint = { card: a.card, t: 0, ttl: 99 }; }
      return { hold: false, lean: 0, pace: 1 };
    }
    if (a.phase === 'reveal') {
      a.timer -= dt;
      if (a.timer <= 0) { a.phase = 'act'; run.hint = null; }
      return { hold: false, lean: 0, pace: 1 };
    }
    const up = upcoming(run);
    if (up && !R.ended && R.halt <= 0) {
      const card = up.seg ? cardForSeg(up.seg) : cardForGust(up.gust, R);
      a.seen.push(up.seg ? up.seg.x0 : `g${up.gust.x}`); a.card = card; a.phase = 'think'; a.timer = THINK_STEPS[S.prefs.thinkIdx]; a.n += 1;
      return { hold: false, lean: 0, pace: 1 };
    }
    return botControl(R, run.trail, run.mem);
  }

  // ---- finishing -------------------------------------------------------------------------------------------------------------------
  function finish() {
    const run = S.run, R = run.R, trail = run.trail;
    const arrived = R.ended === 'arrived';
    if (run.kind === 'auto') {
      if (!arrived) { startAuto(); return; }
      run.auto.done = true; run.auto.card = { title: 'Arrived', text: 'That was every kind of hazard. Now try a trail yourself: the hint lamp is always there.' };
      return;
    }
    const stars = starsFor(R, trail);
    const res = { kind: run.kind, name: trail.name, arrived, stars, items: R.items, items0: R.items0, time: R.t, dayLen: trail.dayLen, halts: R.halts, hints: run.hints, idx: run.idx, nextIdx: null, note: '', story: trail.story };
    if (run.kind === 'long') {
      res.distance = Math.floor(R.distance); res.rests = R.visited.length; res.score = longRoadScore(R);
      S.stats.longRuns = (S.stats.longRuns ?? 0) + 1;
      if (res.distance > S.stats.bestLong) { S.stats.bestLong = res.distance; res.note = 'A new best distance.'; }
      res.best = S.stats.bestLong;
      storage.set('stats', S.stats);
      monetization.track('long_road_end', { distance: res.distance });
    } else if (arrived) {
      S.stats.trailsDone = (S.stats.trailsDone ?? 0) + 1;
      if (run.kind === 'journey') {
        const old = S.progress[run.idx];
        S.progress[run.idx] = { stars: Math.max(old?.stars ?? 0, stars), items: Math.max(old?.items ?? 0, R.items) };
        storage.set('progress', S.progress);
        res.nextIdx = run.idx + 1 < TRAILS.length ? run.idx + 1 : null;
      }
      if (run.kind === 'daily' && run.day === S.dailyDay && !S.stats.days.includes(run.day)) { S.stats.days.push(run.day); S.stats.days = S.stats.days.slice(-200); refreshDaily(); storage.set('daily', { day: run.day, streak: S.streak }); res.note = `Daily Trail done. Streak ${S.streak}.`; }
      storage.set('stats', S.stats);
      if (stars < 3 && !res.note) res.note = R.late ? 'Dusk came before the village. Rest less, or rest on the rest platforms.' : R.items < R.items0 ? 'Some goods slipped. Lean earlier and slow down on steps.' : R.halts ? 'The porter ran out of breath. Rest before the breath bar empties.' : '';
      monetization.track('trail_done', { idx: run.idx, stars, items: R.items });
    } else res.note = 'The goods all slipped. Slow down on steps, lean into gusts and break your step on bridges.';
    S.result = res;
    go('over');
  }

  // ---- play --------------------------------------------------------------------------------------------------------------------------
  const P = () => playLayout(meta.width, meta.height, { hand: S.prefs.hand, coach: !!S.run?.hint, auto: S.run?.kind === 'auto' });
  function poseOf(run) {
    const { R, trail } = run, slope = slopeAt(trail, R.x);
    return {
      phase: R.walkPhase, walking: clamp(run.walkS, 0, 1.3), breathLevel: R.breath, lean: 0.1 + slope * 0.6 + R.leanS * 0.16,
      load: R.a, rest: run.restS, stumble: R.stumble > 0 ? R.stumble : 0, items: R.items, loadKind: run.loadKind, slope,
    };
  }
  function spawnFall(run) {
    const { R } = run, i = Math.max(0, R.items);   // the item at the top of the heap
    const off = goodWorldPos({ ...poseOf(run), x: 0, y: 0 }, i);
    const wx = R.x * 100 + off.x, wy = groundY(run.trail, R.x) * 100 - off.y;
    const dir = R.a >= 0 ? 1 : -1;
    run.falls.push({ x: wx, y: wy, vx: dir * (90 + 60 * Math.abs(R.w)) + R.v * 40, vy: 260, rot: 0, vr: dir * 6, kind: run.loadKind, age: 0, bounces: 0 });
    if (run.falls.length > 14) run.falls.shift();
  }
  function updatePlay(dt, input) {
    const run = S.run, R = run.R, trail = run.trail, L = P(), p = input.pointer, kd = input.keys.down, kp = input.keys.pressed;
    const auto = run.kind === 'auto';
    if ((kp.has('KeyP') || kp.has('Escape')) && !R.ended) { if (auto) run.auto.paused = !run.auto.paused; else run.paused = !run.paused; }
    const tapAt = p.pressed ? { x: p.x, y: p.y } : null;
    let onHud = false;
    if (tapAt) {
      if (run.paused) {
        onHud = true;
        const pl = pauseLayout(meta.width, meta.height);
        if (inRect(pl.resume, tapAt.x, tapAt.y)) { flashBtn('resume'); run.paused = false; }
        else if (inRect(pl.restart, tapAt.x, tapAt.y)) { flashBtn('restart'); restart(); return; }
        else if (inRect(pl.settings, tapAt.x, tapAt.y)) { flashBtn('psettings'); S.back = 'play'; go('settings'); return; }
        else if (inRect(pl.menu, tapAt.x, tapAt.y)) { flashBtn('pmenu'); S.run = null; go('title'); return; }
      } else if (auto) {
        const B = L.railBtns;
        if (inRect(L.pause, tapAt.x, tapAt.y) || inRect(B.pause, tapAt.x, tapAt.y)) { flashBtn('apause'); run.auto.paused = !run.auto.paused; onHud = true; }
        else if (inRect(B.dec, tapAt.x, tapAt.y)) { flashBtn('adec'); if (S.prefs.thinkIdx > 0) { S.prefs.thinkIdx -= 1; savePrefs(); } onHud = true; }
        else if (inRect(B.inc, tapAt.x, tapAt.y)) { flashBtn('ainc'); if (S.prefs.thinkIdx < THINK_STEPS.length - 1) { S.prefs.thinkIdx += 1; savePrefs(); } onHud = true; }
        else if (inRect(B.exit, tapAt.x, tapAt.y)) { flashBtn('aexit'); S.run = null; go('title'); return; }
      } else if (inRect(L.pause, tapAt.x, tapAt.y)) { flashBtn('pause'); run.paused = true; onHud = true; run.anchor = null; }
      else if (inRect(L.hint, tapAt.x, tapAt.y)) { flashBtn('hint'); if (run.hint) run.hint = null; else askHint(); onHud = true; }
      else if (run.hint && inRect(L.coachBtns.close, tapAt.x, tapAt.y)) { flashBtn('close'); run.hint = null; onHud = true; }
    }
    if (run.paused || (auto && run.auto.paused)) { run.anchor = null; return; }
    if (R.ended) {
      run.endT += dt;
      if (run.endT > (R.ended === 'arrived' ? 1.9 : 1.6) && !run.auto.done) finish();
      return stepWorld(run, dt);
    }
    let ctrl;
    if (auto) ctrl = autoControl(dt);
    else {
      let hold = false, lean = 0, pace = 1;
      if (tapAt && !onHud) run.anchor = { x: p.x, y: p.y };
      if (!p.down) run.anchor = null;
      if (run.anchor) {
        const a = run.anchor;
        let dx = p.x - a.x, dy = p.y - a.y;
        if (dx > 150) { a.x += dx - 150; dx = 150; } else if (dx < -150) { a.x += dx + 150; dx = -150; }
        if (dy > 150) { a.y += dy - 150; dy = 150; } else if (dy < -150) { a.y += dy + 150; dy = -150; }
        const dz = (v) => (Math.abs(v) < 8 ? 0 : v - Math.sign(v) * 8);
        lean = clamp(dz(dx) / 102, -1, 1);
        pace = clamp(1 - (dz(dy) / 142) * 0.4, K.PACE_MIN, K.PACE_MAX);
        hold = true;
      }
      const left = kd.has('ArrowLeft') || kd.has('KeyA'), right = kd.has('ArrowRight') || kd.has('KeyD'), upk = kd.has('ArrowUp') || kd.has('KeyW'), dnk = kd.has('ArrowDown') || kd.has('KeyS');
      if (kd.has('Space') || left || right || upk || dnk) {
        hold = true;
        const target = (right ? 0.75 : 0) - (left ? 0.75 : 0);
        run.kLean += (target - run.kLean) * Math.min(1, dt * 9);
        if (!run.anchor) { lean = run.kLean; pace = upk ? 1.25 : dnk ? 0.75 : 1; }
      } else run.kLean += (0 - run.kLean) * Math.min(1, dt * 9);
      if (kp.has('KeyH')) { if (run.hint) run.hint = null; else askHint(); }
      ctrl = { hold, lean, pace };
    }
    run.ctrl = ctrl;
    if (run.hint && !auto) { run.hint.t += dt; if (run.hint.t > run.hint.ttl) run.hint = null; }
    stepRun(R, trail, ctrl, dt);
    for (const e of R.events) onEvent(run, e);
    R.events.length = 0;
    stepWorld(run, dt);
  }
  function stepWorld(run, dt) {
    const { R } = run;
    const moving = R.v > 0.05;
    run.walkS += ((moving ? Math.min(1.25, 0.25 + R.v / K.WALK_V) : 0) - run.walkS) * Math.min(1, dt / 0.15);
    const seg = segAt(run.trail, R.x);
    const propped = !moving && seg.t !== 'bridge' && R.halt <= 0 && !R.ended;
    run.restS += ((propped ? 1 : 0) - run.restS) * Math.min(1, dt / 0.18);
    const ph = Math.floor(R.walkPhase * 2);
    if (ph !== run.footPrev) { run.footPrev = ph; if (moving) sfx.foot(1 - R.breath); }
    if (seg.t === 'bridge') { run.creakT -= dt; if (run.creakT <= 0 && moving) { sfx.creak(); run.creakT = 0.7; } }
    if (run.shake > 0) run.shake = Math.max(0, run.shake - dt * 3);
    for (const f of run.falls) {
      f.age += dt; f.vy -= 1500 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
      const g = groundY(run.trail, f.x / 100) * 100 + 14;
      if (f.y < g) { f.y = g; if (f.bounces < 2) { f.vy = -f.vy * 0.3; f.vx *= 0.55; f.vr *= 0.5; f.bounces += 1; } else { f.vy = 0; f.vx = 0; f.vr = 0; } }
    }
    run.falls = run.falls.filter((f) => f.age < 6);
    if (run.msg) { run.msg.t += dt; if (run.msg.t > run.msg.hold) run.msg = null; }
  }
  function onEvent(run, e) {
    const say2 = (text, hold = 2.2) => { run.msg = { text, t: 0, hold }; };
    if (e.type === 'step') { sfx.step(); run.shake = Math.min(0.4, run.shake + 0.08); }
    else if (e.type === 'spill') { spawnFall(run); sfx.spill(); run.shake = 0.7; say2(run.R.items > 0 ? 'An item slipped from the doko' : 'The last item fell', 2); }
    else if (e.type === 'gust') sfx.gust();
    else if (e.type === 'chautara') { sfx.chime(); if (!run.announcedRest && run.kind !== 'auto') { run.announcedRest = true; say2('A rest platform. Lift your thumb to rest well.', 2.8); } }
    else if (e.type === 'repack') { sfx.repack(); say2('An item was repacked', 2); }
    else if (e.type === 'halt') { sfx.halt(); say2('Out of breath! The porter must stop.', 2.4); }
    else if (e.type === 'arrive') sfx.arrive();
    else if (e.type === 'lost') sfx.lost();
  }
  function restart() {
    const r = S.run;
    if (r.kind === 'journey') begin(genTrail(trailSpec(r.idx)), 'journey', r.ref, { idx: r.idx });
    else if (r.kind === 'long') startLong();
    else if (r.kind === 'daily') startDaily();
    else startAuto();
  }

  // ---- menu scenes ------------------------------------------------------------------------------------------------------------------
  function hit(id, r, tap) { if (r && inRect(r, tap.x, tap.y)) { flashBtn(id); return true; } return false; }
  function getTap(p, rect) {
    if (!rect) { gestureTap = null; return p.pressed ? { x: p.x, y: p.y } : null; }
    if (p.pressed) gestureTap = { x0: p.x, y0: p.y, s0: S.scrollY, moved: false, inBody: inRect(rect, p.x, p.y) };
    let tap = null;
    const g = gestureTap;
    if (g) {
      if (p.down && g.inBody) { const dy = p.y - g.y0; if (Math.abs(dy) > 12) g.moved = true; if (g.moved) S.scrollY = clamp(g.s0 - dy, 0, metrics.max); }
      if (p.released || !p.down) { if (!g.moved) tap = { x: g.x0, y: g.y0 }; gestureTap = null; }
    }
    return tap;
  }
  function textScale(dir) { const n = clamp(S.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (n !== S.prefs.textIdx) { S.prefs.textIdx = n; S.scrollY = 0; savePrefs(); } }
  function changeSetting(i, k) {
    const id = settingRows(S)[i].id, p = S.prefs;
    if (id === 'sound') { p.sound = k === 0; audio.setMuted?.(!p.sound); }
    else if (id === 'assist') p.assist = k === 1;
    else if (id === 'hand') p.hand = k === 1 ? 'left' : 'right';
    else if (id === 'rest') p.restCue = k === 0;
    else if (id === 'restore') {
      if (S.restoreBusy || S.owned || S.demo) return;
      S.restoreBusy = true; say('Checking with the store...', 8);
      const done = (m) => { S.restoreBusy = false; S.owned = monetization.owns('unlock_game'); say(m, 3); };
      Promise.resolve().then(() => monetization.restore())
        .then(() => done(monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found for this store account.'))
        .catch(() => done('The store is not available right now. Please try again later.'));
      return;
    }
    savePrefs(); sfx.tap();
  }

  function updateScene(dt, input) {
    const p = input.pointer, sc = S.scene;
    if (sc === 'play') return updatePlay(dt, input);
    const scrolling = ['journey', 'doc', 'settings'].includes(sc);
    const tap = getTap(p, scrolling ? metrics.rect : null);
    if (scrolling) {
      if (wheelInput.dy) { S.scrollY = clamp(S.scrollY + wheelInput.dy, 0, metrics.max); wheelInput.dy = 0; }
      const k = input.keys.pressed;
      if (k.has('ArrowDown')) S.scrollY = clamp(S.scrollY + 80, 0, metrics.max);
      if (k.has('ArrowUp')) S.scrollY = clamp(S.scrollY - 80, 0, metrics.max);
    }
    const w = meta.width, h = meta.height, esc = input.keys.pressed.has('Escape');
    if (sc === 'title') {
      if (!tap) { if (input.keys.pressed.has('Enter')) go('journey'); return; }
      const T = titleLayout(w, h), B = T.buttons;
      for (const id of Object.keys(B)) if (hit(id, B[id], tap)) {
        sfx.tap();
        if (id === 'journey') go('journey');
        else if (id === 'long') startLong();
        else if (id === 'daily') startDaily();
        else if (id === 'learn') startAuto();
        else if (id === 'howto' || id === 'rules' || id === 'about') { S.doc = { kind: id, page: 0 }; go('doc'); }
        else if (id === 'settings') { S.back = 'title'; go('settings'); }
        return;
      }
      if (S.titleBrand && Math.abs(tap.x - S.titleBrand.x) < 260 && Math.abs(tap.y - S.titleBrand.y) < 30) env.openArcforgeHome?.();
      return;
    }
    if (sc === 'journey') {
      const H = headerLayout(w, h);
      if (esc) { go('title'); return; }
      if (!tap) return;
      if (hit('back', H.back, tap)) { go('title'); return; }
      if (hit('tdec', H.textDec, tap)) return textScale(-1);
      if (hit('tinc', H.textInc, tap)) return textScale(1);
      if (!inRect(H.body, tap.x, tap.y)) return;
      const J = journeyRects(H.body, CHAPTERS.map(() => TRAILS_PER_CHAPTER), TEXT_SCALES[S.prefs.textIdx]), ty = tap.y + S.scrollY;
      J.items.forEach((it) => it.cards.forEach((r, i) => { if (inRect(r, tap.x, ty)) { sfx.tap(); startTrail(it.ci * TRAILS_PER_CHAPTER + i); } }));
      return;
    }
    if (sc === 'doc') {
      const DL = docLayout(w, h), n = DOCS[S.doc.kind].pages.length;
      if (esc) { go('title'); return; }
      if (input.keys.pressed.has('ArrowRight') && S.doc.page < n - 1) { S.doc.page += 1; S.scrollY = 0; }
      if (input.keys.pressed.has('ArrowLeft') && S.doc.page > 0) { S.doc.page -= 1; S.scrollY = 0; }
      if (!tap) return;
      if (hit('back', DL.back, tap)) go('title');
      else if (hit('prev', DL.prev, tap) && S.doc.page > 0) { S.doc.page -= 1; S.scrollY = 0; }
      else if (hit('next', DL.next, tap) && S.doc.page < n - 1) { S.doc.page += 1; S.scrollY = 0; }
      else if (hit('tdec', DL.textDec, tap)) textScale(-1);
      else if (hit('tinc', DL.textInc, tap)) textScale(1);
      return;
    }
    if (sc === 'settings') {
      const SL = settingsLayout(w, h, TEXT_SCALES[S.prefs.textIdx], settingRows(S).length);
      const leave = () => { if (S.back === 'play' && S.run) { S.scene = 'play'; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
      if (esc) { leave(); return; }
      if (!tap) return;
      if (hit('back', SL.back, tap)) return leave();
      if (hit('tdec', SL.textDec, tap)) return textScale(-1);
      if (hit('tinc', SL.textInc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) {
        const ty = tap.y + S.scrollY;
        settingRows(S).forEach((row, i) => {
          const g = SL.rows[i], n = row.opts.length, cw = (g.ctrl.w - 8 * (n - 1)) / n;
          for (let k = 0; k < n; k++) { const r = { x: g.ctrl.x + k * (cw + 8), y: SL.body.y + g.ctrl.y, w: cw, h: g.ctrl.h }; if (inRect(r, tap.x, ty)) { flashBtn(`set${i}.${k}`); changeSetting(i, k); } }
        });
      }
      return;
    }
    if (sc === 'over') {
      const O = overLayout(w, h, Math.min(1.3, TEXT_SCALES[S.prefs.textIdx])), r0 = S.result;
      if (!tap || !r0) return;
      if (hit('next', O.btns.next, tap)) {
        if (r0.kind === 'journey' && r0.arrived && r0.nextIdx !== null) startTrail(r0.nextIdx);
        else if (r0.kind === 'journey' && r0.arrived) go('journey');
        else restart();
      } else if (hit('menu', O.btns.menu, tap)) { S.run = null; go(r0.kind === 'journey' ? 'journey' : 'title'); }
      else if (hit('share', O.btns.share, tap)) {
        const msg = r0.kind === 'long' ? `Doko Porter Trail: carried the doko ${r0.distance} m along the Long Road.` : `Doko Porter Trail: ${r0.name}, ${r0.stars} star${r0.stars === 1 ? '' : 's'}, ${r0.items} of ${r0.items0} goods kept.`;
        env.share?.(msg);
      }
      return;
    }
    if (sc === 'demo-limit' && tap) go('title');
  }

  // ---- render ---------------------------------------------------------------------------------------------------------------------
  function model(run) {
    const { R, trail } = run;
    return {
      trail, x: R.x, t: S.t, f: dayFraction(run), theme: trail.theme ?? 0, pose: poseOf(run), bridgeSway: R.bridgeSway, gust: R.gust, rain: trail.rain,
      highlight: run.hint?.card?.seg && run.hint.card.seg.t !== 'flat' ? run.hint.card.seg : null, falls: run.falls, restCue: S.prefs.restCue,
      shake: S.prefs.assist ? 0 : run.shake,
    };
  }
  const fl = (id) => (S.flash && S.flash.id === id ? Math.max(0, 1 - S.flash.t / 0.25) : 0);
  function drawPlay(ctx, w, h) {
    const run = S.run, m = model(run);
    if (!mode3d.on) {
      ctx.save();
      if (m.shake > 0) ctx.translate(Math.sin(S.t * 71) * m.shake * 5, Math.cos(S.t * 63) * m.shake * 4);
      drawScene(ctx, w, h, m);
      ctx.restore();
    }
    drawHud(ctx, w, h, S, fl, m);
  }

  return {
    update(dt, input) {
      S.t += dt; S.sceneT += dt; S.owned = monetization.owns('unlock_game');
      if (S.flash) { S.flash.t += dt; if (S.flash.t > 0.25) S.flash = null; }
      if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold) S.msg = null; }
      for (const q of S.sfx) q.t -= dt;
      const due = S.sfx.filter((q) => q.t <= 0); if (due.length) { S.sfx = S.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
      const m = S.menu;
      m.x += dt * 0.95; if (m.x > 330) m.x = 0;
      m.phase += (dt * 0.95) / 0.78; m.f = 0.1 + 0.05 * Math.sin(S.t * 0.05);
      m.pose = { phase: m.phase, walking: 0.8, breathLevel: 1, lean: 0.12 + slopeAt(m.trail, m.x) * 0.6, load: 0.03 * Math.sin(S.t * 1.7), rest: 0, items: 5, loadKind: 'sacks', slope: slopeAt(m.trail, m.x) };
      if (S.scene === 'play' && S.run && S.run.kind !== 'auto') { const L = P(); meta.previewBadge = { x: L.U.x1 - 12, y: L.sceneTop - 6, align: 'right' }; } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx) {
      const w = meta.width, h = meta.height;
      if (mode3d.on) ctx.clearRect(0, 0, w, h);
      switch (S.scene) {
        case 'title': drawTitle(ctx, w, h, S, fl); break;
        case 'journey': drawJourney(ctx, w, h, S, fl); break;
        case 'doc': drawDoc(ctx, w, h, S, fl); break;
        case 'settings': drawSettings(ctx, w, h, S, fl); break;
        case 'play': drawPlay(ctx, w, h); if (S.run.paused) drawPause(ctx, w, h, S, fl); break;
        case 'over': drawPlay(ctx, w, h); if (S.result) drawOver(ctx, w, h, S, fl); break;
        case 'demo-limit': drawDemo(ctx, w, h, S, fl); break;
        default: break;
      }
    },
    getState: () => S,
    // Counts real play only: a live trail in progress. Menus, Rules, settings, Watch and Learn, pause and results are free.
    isPreviewExempt() { return !(S.scene === 'play' && S.run && S.run.kind !== 'auto' && !S.run.paused && !S.run.R.ended); },
    // Tester and screenshot hooks (wired up in dev only: see main.js).
    dev: {
      go: (scene, extra) => { Object.assign(S, extra ?? {}); go(scene); },
      trail: (idx) => { S.dev = true; startTrail(idx); },
      long: () => startLong(), daily: () => startDaily(), auto: () => startAuto(),
      doc: (kind, page = 0) => { S.doc = { kind, page }; go('doc'); },
      hint: () => askHint(),
      // play with the game's own bot for `sec` seconds (screenshots, tests)
      fast(sec) {
        const run = S.run, n = Math.round(sec * 60);
        for (let i = 0; i < n && !run.R.ended; i++) {
          const c = botControl(run.R, run.trail, run.mem); run.ctrl = c; stepRun(run.R, run.trail, c, 1 / 60);
          for (const e of run.R.events) if (e.type === 'spill') spawnFall(run);
          run.R.events.length = 0; stepWorld(run, 1 / 60);
        }
      },
      toX(x) {
        const run = S.run; let g = 0;
        while (run.R.x < x && !run.R.ended && g++ < 60 * 600) { const c = botControl(run.R, run.trail, run.mem); run.ctrl = c; stepRun(run.R, run.trail, c, 1 / 60); run.R.events.length = 0; stepWorld(run, 1 / 60); }
      },
      setPrefs: (o) => { Object.assign(S.prefs, o); applyPrefs(); },
      end: (how = 'arrived') => { const R = S.run.R; if (how === 'arrived') { R.x = S.run.trail.goal || R.x; R.ended = 'arrived'; } else { R.items = 0; R.ended = 'lost'; } S.run.endT = 99; finish(); },
      pause: () => { if (S.run) S.run.paused = true; },
      poke: (o) => { Object.assign(S.run.R, o); },
      unlockAll: () => { S.dev = true; },
    },
  };
}
