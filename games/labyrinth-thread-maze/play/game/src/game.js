// Labyrinth Thread Maze: state and flow. Engine = maze.js, session = play.js, drawing = scene.js + view.js, geometry = layout.js.
import { playLayout, titleLayout, docLayout, settingsLayout, newLayout, statsLayout, overLayout, pauseLayout, inRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { GRADES, describeFork, branchText, nextForkOnRoute, generate, lightFrom, N, E, S, W } from './maze.js';
import { newSession, aim, stepDir, backToFork, rewindAll, advance, relaxThread, hintLook, hintShow, starsFor, fmtTime, routeOf, goalDist, fogged, centerOf } from './play.js';
import { camTarget, cellAt } from './scene.js';
import { render, metrics, SETTINGS, NEW_CARDS } from './view.js';
import { DOCS } from './content.js';
import { setLook, LOOK_IDS } from './ui.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen; everything lays out from the live size.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_MAZES = 3;
const DAILY_LEVEL = [5, 1, 2, 3, 3, 4, 6];   // by weekday, 0 = Sunday
const AUTO_GAP = 0.25;
const DEFAULT_PREFS = { look: 'torch', hand: 'right', timer: true, sound: true, calm: false, textIdx: 0, thinkIdx: 1, grade: 2 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KEY_DIR = { ArrowUp: N, KeyW: N, ArrowRight: E, KeyD: E, ArrowDown: S, KeyS: S, ArrowLeft: W, KeyA: W };

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const St = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS },
    P: null, hint: null, paused: false, map: false,
    auto: { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, route: null, idx: 0, target: 0 },
    cam: { cx: 0, cy: 0, v: 10 }, sparks: [], winT: 0, winDelay: 0, sfx: [],
    msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0 }, back: 'title', result: null,
    stats: { solved: [0, 0, 0, 0, 0, 0, 0], best: [0, 0, 0, 0, 0, 0, 0], days: [], bestStreak: 0 }, saved: null,
    daily: { day: config.day ?? 0 }, streak: 0, dailyDone: false, dailyLevel: 1, dailyInfo: '', demoCount: 0, saveAcc: 0,
    hero: generate(31, 1), dev: config.dev === true, hintT: 0, drag: false, keyT: 0,
  };
  const S_ = St;
  let saveRaw = null;

  // ---- persistence ---------------------------------------------------------------------------------------------------------
  const applyPrefs = () => { setLook(S_.prefs.look); audio.setMuted?.(!S_.prefs.sound); };
  const savePrefs = () => storage.set('prefs', S_.prefs);
  const saveStats = () => storage.set('stats', S_.stats);
  storage.get('prefs', null).then((v) => { if (v) { S_.prefs = { ...DEFAULT_PREFS, ...v }; S_.prefs.textIdx = clamp(S_.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S_.prefs.thinkIdx = clamp(S_.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); S_.prefs.grade = clamp(S_.prefs.grade | 0, 1, 6); if (!LOOK_IDS.includes(S_.prefs.look)) S_.prefs.look = 'torch'; } applyPrefs(); });
  storage.get('stats', null).then((v) => { if (v) { S_.stats = { ...S_.stats, ...v, solved: v.solved ?? S_.stats.solved, best: v.best ?? S_.stats.best, days: v.days ?? [] }; } refreshDaily(); });
  storage.get('demoCount', 0).then((v) => { S_.demoCount = Math.max(S_.demoCount, v | 0); });
  storage.get('save', null).then((v) => { if (v && v.stack && S_.scene === 'title' && !S_.P) { saveRaw = v; S_.saved = { grade: v.grade, kind: v.kind, t: v.t }; } });
  applyPrefs();

  function refreshDaily() {
    const day = S_.daily.day, set = new Set(S_.stats.days);
    let streak = 0, d = set.has(day) ? day : day - 1;
    while (set.has(d)) { streak += 1; d -= 1; }
    S_.streak = streak; S_.dailyDone = set.has(day); S_.dailyLevel = DAILY_LEVEL[(((day + 4) % 7) + 7) % 7];
    S_.dailyInfo = S_.dailyDone ? `${GRADES[S_.dailyLevel].name}  ·  done today` : `${GRADES[S_.dailyLevel].name}  ·  ${streak ? streak + ' day streak' : 'new every day'}`;
  }
  refreshDaily();
  function persistSession() {
    const P = S_.P;
    if (!P || P.done || S_.auto.on) return;
    saveRaw = { seed: P.seed, grade: P.grade, kind: P.kind, day: P.day, stack: P.stack.slice(), visited: P.visited.slice(), seen: P.seen.slice(), walked: P.walked, hints: P.hints, t: P.t, steps: P.steps };
    S_.saved = { grade: P.grade, kind: P.kind, t: P.t };
    storage.set('save', saveRaw);
  }
  const clearSave = () => { saveRaw = null; S_.saved = null; storage.remove('save'); };

  // ---- sound ------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S_.prefs.sound) audio.tone(o); };
  const later = (t, o) => S_.sfx.push({ t, o });
  const sfx = {
    step: (n) => tone({ freq: 330 + (n % 4) * 22, to: 250, dur: 0.045, type: 'sine', vol: 0.035 }),
    back: () => tone({ freq: 420, to: 340, dur: 0.05, type: 'triangle', vol: 0.03 }),
    fork: () => { tone({ freq: 660, to: 700, dur: 0.12, type: 'sine', vol: 0.06 }); later(0.09, { freq: 880, to: 900, dur: 0.16, type: 'sine', vol: 0.045 }); },
    dead: () => tone({ freq: 230, to: 150, dur: 0.22, type: 'triangle', vol: 0.07 }),
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.06 }),
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.08 }),
    win: () => { [392, 523, 659, 784, 1047].forEach((f, i) => later(i * 0.13, { freq: f, to: f * 1.005, dur: 0.5, type: 'triangle', vol: 0.085 })); },
  };

  // ---- small helpers -------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.6) => { S_.msg = { text, t: 0, hold }; };
  const flash = (id) => { S_.flash = { id, t: 0 }; };
  function go(scene) { S_.scene = scene; S_.sceneT = 0; S_.scrollY = 0; S_.drag = false; wheelInput.dy = 0; S_.msg = null; }
  const L = () => playLayout(meta.width, meta.height, { coach: !!(S_.hint || S_.auto.on), hand: S_.prefs.hand });
  function spark(wx, wy, n, speed = 1.6) {
    for (let i = 0; i < n; i++) { const a = rng.next() * Math.PI * 2, v = (0.4 + rng.next()) * speed; S_.sparks.push({ x: wx, y: wy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, t: 0, life: 0.8 + rng.next() * 0.9, r: 0.03 + rng.next() * 0.04 }); }
    if (S_.sparks.length > 140) S_.sparks.splice(0, S_.sparks.length - 140);
  }

  // ---- starting mazes ---------------------------------------------------------------------------------------------------------------
  function begin(P, extra = {}) {
    S_.P = P; S_.hint = null; S_.paused = false; S_.msg = null; S_.map = false; S_.drag = false;
    S_.auto = { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, route: null, idx: 0, target: 0, ...extra };
    S_.cam = camTarget(P.maze, P, P.grade, false);
    S_.sparks = []; S_.winT = 0; S_.winDelay = 0; S_.result = null; S_.saveAcc = 0; go('play');
  }
  function demoBlocked() {
    if (config.demo && S_.demoCount >= DEMO_MAZES) { go('demo-limit'); return true; }
    if (config.demo) { S_.demoCount += 1; storage.set('demoCount', S_.demoCount); }
    return false;
  }
  function startMaze(grade) {
    if (demoBlocked()) return;
    S_.prefs.grade = grade; savePrefs();
    begin(newSession({ seed: rng.int(1 << 30) + 1, grade, kind: 'free' }));
    persistSession();
  }
  const dailySeed = (day) => ((day * 7919 + 13) >>> 0) % 1000003 + 1;
  function startDaily() {
    if (demoBlocked()) return;
    begin(newSession({ seed: dailySeed(S_.daily.day), grade: DAILY_LEVEL[(((S_.daily.day + 4) % 7) + 7) % 7], kind: 'daily', day: S_.daily.day }));
    persistSession();
  }
  function resumeSaved() {
    const v = saveRaw;
    if (!v) return;
    const P = newSession({ seed: v.seed, grade: v.grade, kind: v.kind, day: v.day ?? 0 });
    P.stack = v.stack.slice(); P.cell = P.stack[P.stack.length - 1]; const c = centerOf(P.maze, P.cell); P.x = c.x; P.y = c.y;
    P.visited = v.visited.slice(); P.seen = v.seen.slice(); P.walked = v.walked; P.hints = v.hints; P.t = v.t; P.steps = v.steps ?? 0;
    begin(P);
    say('Welcome back.', 1.6);
  }
  function startAuto() {
    const grade = clamp(S_.prefs.grade, 1, 4);
    const P = newSession({ seed: rng.int(1 << 30) + 1, grade, kind: 'auto' });
    begin(P, { on: true, route: routeOf(P.maze), idx: 0, target: 0 });
    say('Watch the game find its way to the heart and explain each fork.', 2.4);
  }
  function restartMaze() {
    const P = S_.P, fresh = newSession({ seed: P.seed, grade: P.grade, kind: P.kind, day: P.day, maze: P.maze });
    begin(fresh); persistSession();
  }

  // ---- hints -----------------------------------------------------------------------------------------------------------------------------
  function askHint() {
    const P = S_.P;
    if (P.done) return;
    if (S_.hint) { if (S_.hint.stage === 'look') hintGo(); else S_.hint = null; return; }
    const h = hintLook(P);
    S_.hint = { stage: 'look', text: h.text, fork: h.fork, cells: null }; S_.hintT = 0; sfx.hint();
  }
  function hintGo() {
    const h = S_.hint, P = S_.P;
    if (!h) return;
    if (h.stage === 'look') { h.stage = 'show'; h.cells = hintShow(P, 12); h.text = 'The gold thread shows the next steps. Follow it with the lamp, then ask again if you need more.'; P.hints += 1; S_.hintT = 0; sfx.hint(); persistSession(); }
    else S_.hint = null;
  }

  // ---- movement events --------------------------------------------------------------------------------------------------------------------
  function onEvents(ev) {
    const P = S_.P;
    for (const e of ev) {
      if (e.type === 'step') sfx.step(P.steps);
      else if (e.type === 'back') sfx.back();
      else if (e.type === 'fork') { sfx.fork(); const c = centerOf(P.maze, e.cell); spark(c.x, c.y, 3, 0.8); }
      else if (e.type === 'dead') { sfx.dead(); if (!S_.auto.on) say('A dead end. Wind back along the thread.', 1.6); }
      else if (e.type === 'win') win();
    }
  }
  function win() {
    const P = S_.P, g = P.grade, c = centerOf(P.maze, P.maze.goal);
    P.done = true; S_.hint = null; S_.winT = 3.4; S_.winDelay = 2.4;
    spark(c.x, c.y, 70, 2.4); sfx.win();
    if (S_.auto.on) { S_.auto.done = true; S_.auto.phase = null; say('The heart. That is every fork.', 4); return; }
    const first = !S_.stats.best[g] || P.t < S_.stats.best[g];
    S_.stats.solved[g] += 1;
    if (P.t > 0 && first) S_.stats.best[g] = Math.max(1, Math.round(P.t));
    let streak = S_.streak;
    if (P.kind === 'daily' && P.day === S_.daily.day && !S_.stats.days.includes(P.day)) { S_.stats.days.push(P.day); S_.stats.days = S_.stats.days.slice(-200); refreshDaily(); streak = S_.streak; S_.stats.bestStreak = Math.max(S_.stats.bestStreak, streak); }
    saveStats(); clearSave();
    if (P.kind === 'daily' && P.day === S_.daily.day) storage.set('daily', { day: P.day, streak });
    monetization.track('maze_solved', { grade: g, kind: P.kind, t: Math.round(P.t) });
    S_.result = { stars: starsFor(P), time: P.t, steps: P.walked, opt: P.maze.opt, wasted: Math.max(0, P.walked - P.maze.opt), hints: P.hints, newBest: first, daily: P.kind === 'daily', streak, grade: g };
  }

  // ---- Watch and Learn -----------------------------------------------------------------------------------------------------------------------
  const wordCount = (t) => t.split(' ').length;
  function describe(P, idx) {
    const m = P.maze, route = S_.auto.route, cell = route[idx], prev = idx > 0 ? route[idx - 1] : -1, gd = goalDist(m);
    if (idx === 0) return { options: [], text: 'Start at the doorway. The heart is in the middle of the maze. Look for the corridor that runs toward it, and watch for forks.', verdict: 'Follow the corridor to the first fork.', trivial: true };
    const rows = describeFork(m, cell, prev, gd);
    const options = rows.map((r) => r.cell);
    const text = `A fork with ${rows.length} ways on. Which one leads to the heart?`;
    const verdict = rows.map(branchText).join('. ') + '.';
    const trivial = rows.every((r) => r.onRoute || (r.kind === 'dead' && r.size <= 2));
    return { options, text, verdict, trivial };
  }
  function autoTick(dt) {
    const a = S_.auto, P = S_.P, m = P.maze;
    if (a.paused || a.done || P.done) return;
    if (a.phase === 'walk') {
      if (P.q.length === 0) { a.idx = a.target; a.phase = 'gap'; a.timer = AUTO_GAP; S_.hint = null; }
      return;
    }
    if (a.phase === 'gap') { a.timer -= dt; if (a.timer <= 0) a.phase = null; return; }
    if (a.phase === 'think') {
      a.timer -= dt;
      if (a.timer > 0) return;
      const d = a.desc;
      S_.hint.stage = 'explain'; S_.hint.text = d.verdict; S_.hint.cells = a.route.slice(a.idx, a.idx + 5);
      a.phase = 'reveal'; a.timer = 2 + (d.trivial ? 0 : clamp(wordCount(d.verdict) * 0.08, 0, 3));
      return;
    }
    if (a.phase === 'reveal') {
      a.timer -= dt;
      if (a.timer > 0) return;
      const t2 = nextForkOnRoute(m, a.route, a.idx);
      a.target = t2; P.q = a.route.slice(a.idx + 1, t2 + 1); a.phase = 'walk'; S_.hint = null;
      return;
    }
    const d = describe(P, a.idx);
    a.desc = d; a.n += 1; a.phase = 'think';
    S_.hint = { stage: 'look', text: d.text, fork: -1, cells: null, opts: d.options };
    const base = THINK_STEPS[S_.prefs.thinkIdx];
    a.timer = d.trivial ? Math.max(0.9, base * 0.3) : base;
  }

  // ---- input -------------------------------------------------------------------------------------------------------------------------------------
  let gesture = null;
  function getTap(p, scrollRect) {
    if (!scrollRect) { gesture = null; return p.pressed ? { x: p.x, y: p.y } : null; }
    if (p.pressed) gesture = { x0: p.x, y0: p.y, s0: S_.scrollY, moved: false, inBody: inRect(scrollRect, p.x, p.y) };
    let tap = null;
    if (gesture) {
      if (p.down && gesture.inBody) {
        const dy = p.y - gesture.y0;
        if (Math.abs(dy) > 12) gesture.moved = true;
        if (gesture.moved) S_.scrollY = clamp(gesture.s0 - dy, 0, metrics.max);
      }
      if (p.released || !p.down) { if (!gesture.moved) tap = { x: gesture.x0, y: gesture.y0 }; gesture = null; }
    }
    return tap;
  }
  function hitBtn(id, r, tap) { if (inRect(r, tap.x, tap.y)) { flash(id); return true; } return false; }
  const isFog = () => !!S_.P && fogged(S_.P);
  function toggleMap() { if (!isFog()) return; S_.map = !S_.map; sfx.tap(); }

  function updatePlay(dt, tap, input) {
    const P = S_.P, l = L(), k = input.keys.pressed, p = input.pointer;
    const frozen = S_.paused || (S_.auto.on && S_.auto.paused);
    if (!frozen) {
      if (!P.done && !S_.auto.on && S_.winT <= 0) { P.t += dt; S_.saveAcc += dt; if (S_.saveAcc > 6) { S_.saveAcc = 0; persistSession(); } }
      if (S_.auto.on) autoTick(dt);
      // steering: finger drag inside the board, or the keyboard
      if (!S_.auto.on && !P.done) {
        if (p.pressed && inRect(l.board.rect, p.x, p.y)) S_.drag = true;
        if (!p.down) S_.drag = false;
        if (S_.drag && p.down) { const c = cellAt(P.maze, l.board.rect, S_.cam, p.x, p.y); if (c >= 0) aim(P, c); }
        S_.keyT -= dt;
        for (const code of input.keys.down) { const d = KEY_DIR[code]; if (d && (k.has(code) || S_.keyT <= 0)) { if (stepDir(P, d)) S_.keyT = 0.11; } }
      }
      onEvents(advance(P, dt));
      relaxThread(P, dt, P.q.length > 0);
      if (S_.hint && S_.hint.stage === 'show') { S_.hintT += dt; if (S_.hintT > 12) S_.hint = null; }
      // camera follows the lamp (or shows the whole maze)
      const tg = camTarget(P.maze, P, P.grade, S_.map), kk = S_.prefs.calm ? 1 : 1 - Math.exp(-dt * 7);
      S_.cam.cx += (tg.cx - S_.cam.cx) * kk; S_.cam.cy += (tg.cy - S_.cam.cy) * kk; S_.cam.v += (tg.v - S_.cam.v) * kk;
    }
    // keyboard commands
    if (!S_.auto.on && !S_.paused && !P.done) {
      if (k.has('KeyH')) askHint();
      if (k.has('KeyM')) toggleMap();
      if (k.has('KeyB') || k.has('Backspace')) { if (backToFork(P)) sfx.tap(); }
    }
    if (k.has('KeyP') || k.has('Escape')) { if (S_.auto.on) S_.auto.paused = !S_.auto.paused; else if (!P.done) { S_.paused = !S_.paused; if (S_.paused) persistSession(); } }
    if (S_.winDelay > 0 && !frozen) { S_.winDelay -= dt; if (S_.winDelay <= 0 && S_.result) go('over'); }
    if (!tap) return;
    if (S_.paused) {
      const pl = pauseLayout(meta.width, meta.height, l.board);
      if (hitBtn('resume', pl.resume, tap)) S_.paused = false;
      else if (hitBtn('restart', pl.restart, tap)) restartMaze();
      else if (hitBtn('psettings', pl.settings, tap)) { S_.back = 'play'; go('settings'); }
      else if (hitBtn('pmenu', pl.menu, tap)) { persistSession(); S_.paused = false; go('title'); }
      return;
    }
    if (S_.auto.on) {
      if (hitBtn('aexit', l.rail.exit, tap)) { S_.auto.on = false; S_.hint = null; S_.P = null; go('title'); }
      else if (hitBtn('apause', l.rail.pause, tap)) S_.auto.paused = !S_.auto.paused;
      else if (hitBtn('adec', l.rail.dec, tap)) { if (S_.prefs.thinkIdx > 0) { S_.prefs.thinkIdx -= 1; savePrefs(); } }
      else if (hitBtn('ainc', l.rail.inc, tap)) { if (S_.prefs.thinkIdx < THINK_STEPS.length - 1) { S_.prefs.thinkIdx += 1; savePrefs(); } }
      return;
    }
    if (P.done) return;
    if (hitBtn('pause', l.pause, tap)) { S_.paused = true; persistSession(); return; }
    if (S_.hint) {
      if (hitBtn('close', l.coachBtns.close, tap)) S_.hint = null;
      else if (hitBtn('go', l.coachBtns.go, tap)) hintGo();
      return;
    }
    const T = l.tools;
    if (hitBtn('fork', T.fork, tap)) { if (backToFork(P)) sfx.tap(); else say('You are already at the first fork.', 1.6); }
    else if (hitBtn('hint', T.hint, tap)) askHint();
    else if (hitBtn('third', T.third, tap)) { if (isFog()) toggleMap(); else if (rewindAll(P)) sfx.tap(); }
  }

  function changeSetting(i, kk) {
    const id = SETTINGS[i].id, p = S_.prefs;
    switch (id) {
      case 'look': p.look = LOOK_IDS[kk]; setLook(p.look); break;
      case 'hand': p.hand = kk === 1 ? 'left' : 'right'; break;
      case 'timer': p.timer = kk === 0; break;
      case 'sound': p.sound = kk === 0; audio.setMuted?.(!p.sound); break;
      case 'calm': p.calm = kk === 1; break;
      case 'restore': monetization.restore().then(() => say('Purchases restored.', 2)).catch(() => {}); return;
      default: break;
    }
    savePrefs(); sfx.tap();
  }
  function textScale(dir) { const n = clamp(S_.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (n !== S_.prefs.textIdx) { S_.prefs.textIdx = n; S_.scrollY = 0; savePrefs(); } }

  function updateScene(dt, input) {
    const p = input.pointer, scrolling = ['new', 'doc', 'settings', 'stats', 'over'].includes(S_.scene);
    const tap = getTap(p, scrolling ? metrics.rect : null);
    if (scrolling) {
      if (wheelInput.dy) { S_.scrollY = clamp(S_.scrollY + wheelInput.dy, 0, metrics.max); wheelInput.dy = 0; }
      const kk = input.keys.pressed;
      if (kk.has('ArrowDown')) S_.scrollY = clamp(S_.scrollY + 80, 0, metrics.max);
      if (kk.has('ArrowUp')) S_.scrollY = clamp(S_.scrollY - 80, 0, metrics.max);
      S_.scrollY = clamp(S_.scrollY, 0, metrics.max);
    }
    const sc = S_.scene, w = meta.width, h = meta.height;
    if (sc === 'play') return updatePlay(dt, tap, input);
    if (sc === 'title') {
      if (!tap) { if (input.keys.pressed.has('Enter') || input.keys.pressed.has('Space')) startMaze(S_.prefs.grade); return; }
      const t = titleLayout(w, h, !!S_.saved), B = t.buttons;
      for (const id of Object.keys(B)) if (hitBtn(id, B[id], tap)) {
        sfx.tap();
        if (id === 'continue') resumeSaved();
        else if (id === 'new') go('new');
        else if (id === 'daily') startDaily();
        else if (id === 'learn') startAuto();
        else if (id === 'howto' || id === 'rules' || id === 'about') { S_.doc = { kind: id, page: 0 }; go('doc'); }
        else if (id === 'stats') go('stats');
        else if (id === 'settings') { S_.back = 'title'; go('settings'); }
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
        NEW_CARDS.forEach((id, i) => { const r = { ...NL.cards[i], y: NL.cards[i].y - S_.scrollY }; if (inRect(r, tap.x, tap.y)) { sfx.tap(); if (id === 'daily') startDaily(); else startMaze(id); } });
      }
      return;
    }
    if (sc === 'doc') {
      const DL = docLayout(w, h), n = DOCS[S_.doc.kind].pages.length;
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (input.keys.pressed.has('ArrowRight') && S_.doc.page < n - 1) { S_.doc.page += 1; S_.scrollY = 0; }
      if (input.keys.pressed.has('ArrowLeft') && S_.doc.page > 0) { S_.doc.page -= 1; S_.scrollY = 0; }
      if (!tap) return;
      if (hitBtn('back', DL.menu, tap)) go('title');
      else if (hitBtn('prev', DL.prev, tap) && S_.doc.page > 0) { S_.doc.page -= 1; S_.scrollY = 0; }
      else if (hitBtn('next', DL.next, tap) && S_.doc.page < n - 1) { S_.doc.page += 1; S_.scrollY = 0; }
      else if (hitBtn('tdec', DL.textDec, tap)) textScale(-1);
      else if (hitBtn('tinc', DL.textInc, tap)) textScale(1);
      return;
    }
    if (sc === 'settings') {
      const SL = settingsLayout(w, h, TEXT_SCALES[S_.prefs.textIdx], SETTINGS.length);
      const leave = () => { if (S_.back === 'play' && S_.P) { S_.scene = 'play'; S_.sceneT = 1; S_.scrollY = 0; } else go('title'); };
      if (input.keys.pressed.has('Escape')) { leave(); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) return leave();
      if (hitBtn('tdec', SL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', SL.textInc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) {
        const ty = tap.y + S_.scrollY;
        SETTINGS.forEach((row, i) => {
          const g = SL.rows[i], n = row.opts.length, cw = (g.ctrl.w - 8 * (n - 1)) / n;
          for (let kk = 0; kk < n; kk++) { const r = { x: g.ctrl.x + kk * (cw + 8), y: g.ctrl.y, w: cw, h: g.ctrl.h }; if (inRect(r, tap.x, ty)) { flash('set' + i + '.' + kk); changeSetting(i, kk); } }
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
      const O = overLayout(w, h, TEXT_SCALES[S_.prefs.textIdx]);
      if (!tap) return;
      const R0 = S_.result;
      if (hitBtn('next', O.btns.next, tap)) { if (R0.daily) go('title'); else startMaze(R0.grade); }
      else if (hitBtn('menu', O.btns.menu, tap)) { if (R0.daily) go('new'); else go('title'); }
      else if (hitBtn('share', O.btns.share, tap)) env.share(`Labyrinth Thread Maze, ${R0.daily ? 'daily maze' : GRADES[R0.grade].name}: reached the heart in ${fmtTime(R0.time)}, ${R0.stars} star${R0.stars === 1 ? '' : 's'}${R0.daily ? '. Streak ' + R0.streak : ''}.`);
      return;
    }
    if (sc === 'demo-limit' && tap) go('title');
  }

  return {
    update(dt, input) {
      S_.t += dt; S_.sceneT += dt;
      if (S_.flash) { S_.flash.t += dt; if (S_.flash.t > 0.25) S_.flash = null; }
      if (S_.msg) { S_.msg.t += dt; if (S_.msg.t > S_.msg.hold) S_.msg = null; }
      const frozen = S_.paused || (S_.auto.on && S_.auto.paused);
      if (!frozen) {
        for (const sp of S_.sparks) { sp.t += dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 3.2 * dt; }
        S_.sparks = S_.sparks.filter((sp) => sp.t < sp.life);
        if (S_.winT > 0) S_.winT -= dt;
        for (const q of S_.sfx) q.t -= dt;
        const due = S_.sfx.filter((q) => q.t <= 0); if (due.length) { S_.sfx = S_.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
      }
      // the kit's preview pill sits top centre; in landscape it moves into the info panel so it never covers the board
      if (S_.scene === 'play') { const l = L(); meta.previewBadge = l.mode === 'portrait' ? { x: l.pause.x - 14, y: l.pause.y + 18, align: 'right' } : { x: l.info.x + 16, y: l.info.y + 12, align: 'left' }; } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { render(ctx, S_, view ?? meta); },
    getState: () => S_,
    // Counts real play only: a maze in progress. Menus, Rules, settings, Watch and Learn, pause, results are free.
    isPreviewExempt() { return !(S_.scene === 'play' && !S_.auto.on && !S_.paused && S_.P && !S_.P.done); },
    // Tester/screenshot hooks (only wired up in dev: see main.js).
    dev: {
      go: (scene, extra) => { Object.assign(S_, extra ?? {}); go(scene); },
      start: (grade) => startMaze(grade), daily: () => startDaily(), auto: () => startAuto(), hint: () => askHint(), hintGo: () => hintGo(),
      progress: (n) => {
        const P = S_.P, route = routeOf(P.maze), upto = Math.min(n, route.length - 2), r = GRADES[P.grade].torch;
        P.stack = route.slice(0, upto + 1); P.cell = route[upto]; const c = centerOf(P.maze, P.cell); P.x = c.x; P.y = c.y; P.q = [];
        for (const cell of P.stack) { P.visited[cell] = 1; if (r) for (const [kk] of lightFrom(P.maze, cell, r)) P.seen[kk] = 1; }
        P.walked = upto + Math.floor(upto / 3); P.steps = P.walked; S_.cam = camTarget(P.maze, P, P.grade, false);
      },
      doc: (kind, page = 0) => { S_.doc = { kind, page }; go('doc'); },
      layout: () => { const l = L(); return { mode: l.mode, board: l.board.rect, tools: l.tools, w: meta.width, h: meta.height }; },
      solveNow: () => { const P = S_.P, route = routeOf(P.maze); P.stack = route.slice(); P.cell = P.maze.goal; P.walked = route.length + 6; const c = centerOf(P.maze, P.cell); P.x = c.x; P.y = c.y; for (const cell of route) P.visited[cell] = 1; win(); },
      skipOver: () => { S_.winDelay = 0.01; },
      fullMap: () => { S_.map = true; },
      route: () => routeOf(S_.P.maze),
    },
  };
}
