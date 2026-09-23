// Carrom: state and flow. Drawing is view.js; rules.js is the rule book; physics.js the simulation; ai.js the computer.
// Controls (taught on the How to play page): DRAG the striker along the baseline to place it, DRAG BACK to aim and set
// power, RELEASE to flick. The same stroke machinery runs boards, lessons and the daily trick shot.
import { W, H, K, BX, BY, PLAY, ux, uy, sx, sy, inRect, titleButtons, PLAYB, MENU, OVER, LESSONB, PAGE, PAGE_TEXT, TEXT_SCALES, settingRows, lessonRows, AUTO_THINK_STEPS, AUTO_REVEAL_SECS, AUTO_BAR, AUTO_DEC, AUTO_INC } from './layout.js';
import { S, BASE_Y, BASE_X0, BASE_X1, stepWorld, moving, blocked, cloneWorld, R_STR } from './physics.js';
import { newBoard, cloneGame, placeStriker, flick, resolve, clearX, onBoard, down, other, SIDE_NAME } from './rules.js';
import { createThinker, chooseShot, AI_LEVELS } from './ai.js';
import { LESSONS, judge } from './lessons.js';
import { createPuzzleMaker, puzzleBoard } from './daily.js';
import { THEME_KEYS } from './art.js';
import { GAME_RULES, HOWTO_PAGES, ABOUT_PAGES } from './pages.js';
import { render } from './view.js';

export const meta = { width: W, height: H };
const DEMO_BOARDS = 2, DEMO_LESSONS = 3, PULL = 230, MIN_PULL = 16, HINTS = 3;
const ease = (f) => f * f * (3 - 2 * f);

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, level: 1, mode: 'ai', sound: true, calm: false, textScaleIdx: 0, left: false, theme: 'plywood', guide: 2,
    g: newBoard('W'), phase: 'aim', sx: S / 2, aim: null, drag: null, fx: [], msg: null, tip: '', blocked: false, menu: false, hintsLeft: HINTS, hintBusy: false,
    ev: [], sum: null, wait: 0, shake: 0, page: 0, back: 'title', hintPulse: 1,
    stats: { played: 0, wins: 0 }, learned: {}, lesson: null, demoBoards: 0, saved: null, demoMode: config.demo === true, dev: config.dev === true,
    daily: { day: config.day ?? 0, solvedDay: -1, streak: 0, puzzle: null }, pz: null,
    demo: { world: [], fx: [], t: 0, strokes: 0, wait: 0.35 },
    autoThinkIdx: 1, // indexes AUTO_THINK_STEPS ([2,5,8,10]s); Auto Play's THINK pause, default 5s
    auto: null, // Auto Play ("Watch & Learn") run state; see startAutoPlay()
  };
  let thinker = null, hintThinker = null, aiShot = null, maker = createPuzzleMaker(state.daily.day), sounds = 0;

  // textScaleIdx is clamped on load: a saved index from a build with a longer/shorter TEXT_SCALES
  // must never produce an out-of-range lookup (NaN font sizes) in view.js.
  storage.get('prefs', null).then((v) => { if (v) { for (const k of ['level', 'sound', 'calm', 'left', 'theme', 'guide']) if (v[k] !== undefined) state[k] = v[k]; if (v.textScaleIdx !== undefined) state.textScaleIdx = Math.min(Math.max(v.textScaleIdx, 0), TEXT_SCALES.length - 1); if (v.autoThinkIdx !== undefined) state.autoThinkIdx = Math.min(Math.max(v.autoThinkIdx, 0), AUTO_THINK_STEPS.length - 1); audio.setMuted?.(!state.sound); } });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v }; });
  storage.get('learned', null).then((v) => { if (v) state.learned = { ...state.learned, ...v }; });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demoBoards', 0).then((v) => { state.demoBoards = Math.max(state.demoBoards, v); });
  storage.get('save', null).then((v) => { if (v && v.g && !v.g.over && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, textScaleIdx: state.textScaleIdx, left: state.left, theme: state.theme, guide: state.guide, autoThinkIdx: state.autoThinkIdx });
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.played, wins: state.stats.wins }); };
  const saveBoard = () => { if (state.scene === 'play' && !state.g.over) { state.saved = { g: cloneGame(state.g), mode: state.mode, level: state.level, hintsLeft: state.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  const say = (text, hold = 4) => { state.msg = { text, t: 0, hold }; };
  // Auto Play is silent by design regardless of the player's own Sound setting — single point of
  // truth: every sound in the game already funnels through this one helper.
  const tone = (o) => { if (state.sound && sounds < 3 && state.scene !== 'auto') { sounds++; audio.tone(o); } };
  const dur = (d) => (state.calm ? d * 0.6 : d);
  const sfxHit = (v) => { const f = Math.min(1, v / 1800); tone({ freq: 620 + f * 500, to: 210, dur: 0.07, type: 'triangle', vol: 0.05 + f * 0.09 }); if (f > 0.15) tone({ freq: 2100 + f * 900, to: 900, dur: 0.02, type: 'square', vol: 0.02 + f * 0.03 }); };
  const sfxWall = (v) => { const f = Math.min(1, v / 1500); tone({ freq: 300, to: 130, dur: 0.06, type: 'sine', vol: 0.05 + f * 0.08 }); };
  const sfxPocket = () => { tone({ freq: 240, to: 70, dur: 0.2, type: 'sine', vol: 0.13 }); tone({ freq: 700, to: 260, dur: 0.11, type: 'triangle', vol: 0.05 }); };
  const isHuman = (side) => state.scene !== 'play' || state.mode === 'two' || side === 'W';
  const forward = (side) => (side === 'W' ? -Math.PI / 2 : Math.PI / 2);

  // ---------------------------------------------------------------- starting things
  function resetTurn() { state.aim = null; state.drag = null; state.fx = []; state.menu = false; state.hintBusy = false; hintThinker = null; thinker = null; aiShot = null; state.msg = null; state.ev = []; }
  function beginTurn() {
    const g = state.g; state.sx = clearX(g, g.turn, state.sx);
    if (isHuman(g.turn)) { state.phase = 'aim'; } else { state.phase = 'think'; state.wait = 0; thinker = createThinker(g, g.turn, state.level, rng.int(1 << 30)); }
  }
  function startBoard(mode) {
    if (config.demo && state.demoBoards >= DEMO_BOARDS) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoBoards += 1; storage.set('demoBoards', state.demoBoards); }
    resetTurn(); state.g = newBoard('W'); state.mode = mode; state.scene = 'play'; state.hintsLeft = HINTS; state.sx = S / 2; state.tip = TIPS.aim;
    say(mode === 'two' ? 'Player 1 (white) starts. Player 2 plays from the top.' : 'You are white. Drag the striker along the baseline, then drag back to aim.', 6);
    beginTurn(); monetization.track('board_start', { mode, level: state.level });
  }
  function resumeBoard() {
    const v = state.saved; resetTurn(); state.g = cloneGame(v.g); state.mode = v.mode; state.level = v.level ?? state.level; state.hintsLeft = v.hintsLeft ?? HINTS; state.scene = 'play'; state.sx = S / 2; state.tip = TIPS.aim; say('Board restored.'); beginTurn();
  }
  const lessonWorld = (l) => { const g = puzzleBoard(l.coins); return g; };
  function startLesson(i) {
    if (config.demo && i >= DEMO_LESSONS) { state.scene = 'demo-limit'; return; }
    resetTurn(); const l = LESSONS[i]; state.g = lessonWorld(l); state.scene = 'lesson'; state.lesson = { i, done: false, count: 0, tries: 0 }; state.sx = l.sx; state.phase = 'aim'; state.tip = TIPS.aim; state.msg = null;
  }
  function resetLesson(reason) { const l = LESSONS[state.lesson.i]; state.g = lessonWorld(l); state.lesson.count = 0; state.lesson.tries += 1; state.sx = l.sx; state.phase = 'aim'; state.aim = null; if (reason) say(reason, 5); }
  function startDaily() {
    resetTurn(); state.scene = 'daily'; const p = state.daily.puzzle;
    if (!p) { state.pz = { status: 'making', left: 3, goal: 1 }; return; }
    state.pz = { status: state.daily.solvedDay === state.daily.day ? 'solved' : 'ready', left: 3, goal: p.goal }; state.g = puzzleBoard(p.coins); state.sx = S / 2; state.phase = 'aim'; state.tip = TIPS.aim;
    say(`Pocket ${p.goal === 1 ? 'a white coin' : p.goal + ' white coins'} with one stroke. You have 3 attempts.`, 6);
  }
  const TIPS = { aim: 'DRAG the striker along the baseline to place it. DRAG BACK to aim, RELEASE to flick.' };

  // ---------------------------------------------------------------- the stroke
  function fire(angle, power) {
    const g = state.g, side = g.turn;
    if (state.blocked) { say('The striker is touching a coin. Slide it along the baseline to a clear spot.'); return; }
    placeStriker(g, side, state.sx); flick(g, angle, power);
    state.phase = 'fly'; state.ev = []; state.aim = null; state.drag = null; state.msg = null; state.wait = 0; state.hintPulse = 0;
    tone({ freq: 160 + power * 200, to: 80, dur: 0.08, type: 'triangle', vol: 0.06 });
  }
  function fxFor(ev) {
    for (const e of ev) {
      if (e.t === 'hit') { sfxHit(e.v); if (e.v > 1100 && !state.calm) state.shake = Math.max(state.shake, Math.min(5, e.v / 500)); if (e.v > 260) state.fx.push({ type: 'ring', x: e.x, y: e.y, t: 0, dur: dur(0.3), s: Math.min(1, e.v / 1200) }); }
      else if (e.t === 'wall') sfxWall(e.v);
      else if (e.t === 'pocket') { sfxPocket(); const px = e.p % 2 ? S - 8 : 8, py = e.p > 1 ? S - 8 : 8; state.fx.push({ type: 'ring', x: px, y: py, t: 0, dur: dur(0.5), s: 1.6 }); if (e.k === 'Q' || e.k === 'S') state.fx.push({ type: 'pop', text: e.k === 'Q' ? 'Queen!' : 'Foul', color: e.k === 'Q' ? '#ff8a7a' : '#ff7a5a', x: px, y: py, t: 0, dur: dur(1.1) }); state.fx.push({ type: 'drop', k: e.k, x: e.x, y: e.y, px: e.p % 2 ? S - 8 : 8, py: e.p > 1 ? S - 8 : 8, t: 0, dur: dur(0.4) }); }
    }
  }
  function endStroke() {
    const g = state.g, me = g.turn, wasStriker = state.ev.some((e) => e.t === 'pocket' && e.k === 'S');
    for (const b of g.world) { b.vx = 0; b.vy = 0; }
    const sum = resolve(g, state.ev); state.sum = sum;
    if (sum.foul) state.fx.push({ type: 'flash', t: 0, dur: 0.6 });
    say(sum.notes.length ? sum.notes.join(' ') : g.over ? '' : `No coin pocketed. ${g.turn === 'W' ? (state.mode === 'two' ? 'Player 1' : 'White') : state.mode === 'two' ? 'Player 2' : 'Black'} plays next.`, 5);
    if (!sum.notes.length && !g.over && state.scene === 'play' && state.mode === 'ai') say(g.turn === 'W' ? 'No coin pocketed. Your turn.' : 'No coin pocketed. The computer plays.', 4);
    if (sum.again && !sum.notes.length) say(state.scene === 'play' && state.mode === 'ai' && me === 'B' ? 'The computer pocketed a coin and plays again.' : 'Pocketed! Shoot again.', 3);
    state.phase = 'after'; state.wait = 0; void wasStriker;
    state.hintPulse = 1;
  }
  function afterStroke() {
    const g = state.g;
    if (state.scene === 'lesson') return lessonAfter();
    if (state.scene === 'daily') return dailyAfter();
    if (g.over) { finishBoard(); return; }
    saveBoard(); beginTurn();
  }
  function finishBoard() {
    const g = state.g; state.phase = 'over'; state.stats.played += 1; if (state.mode === 'ai' && g.over.winner === 'W') state.stats.wins += 1; saveStats(); clearSave();
    tone({ freq: g.over.winner === 'B' && state.mode === 'ai' ? 300 : 520, to: g.over.winner === 'B' && state.mode === 'ai' ? 220 : 880, dur: 0.5, type: 'triangle', vol: 0.1 });
    monetization.track('board_end', { winner: g.over.winner, points: g.over.points, strokes: g.strokes.W + g.strokes.B, mode: state.mode, level: state.level });
  }
  function lessonAfter() {
    const l = LESSONS[state.lesson.i], g = state.g; g.turn = 'W'; g.over = null;
    const { ok, partial, why, count } = judge(l.goal, { g, sum: state.sum, ev: state.ev, count: state.lesson.count }); state.lesson.count = count;
    if (ok) { state.lesson.done = true; state.learned[state.lesson.i] = true; storage.set('learned', state.learned); tone({ freq: 520, to: 880, dur: 0.4, type: 'triangle', vol: 0.1 }); state.phase = 'aim'; state.msg = null; return; }
    if (partial) { say(l.goal === 'queen' ? 'Queen pocketed! Now cover it: pocket a white coin.' : 'Good. Now the other coin.', 5); state.sx = clearX(g, 'W', state.sx); state.phase = 'aim'; return; }
    resetLesson(why);
  }
  function dailyAfter() {
    const pz = state.pz, sum = state.sum, p = state.daily.puzzle; state.g.turn = 'W'; state.g.over = null;
    if (!sum.foul && sum.own >= pz.goal) {
      pz.status = 'solved'; const yest = state.daily.solvedDay === state.daily.day - 1; state.daily.streak = state.daily.solvedDay === state.daily.day ? state.daily.streak : yest ? state.daily.streak + 1 : 1; state.daily.solvedDay = state.daily.day;
      storage.set('daily', { solvedDay: state.daily.solvedDay, streak: state.daily.streak }); tone({ freq: 520, to: 980, dur: 0.5, type: 'triangle', vol: 0.1 }); state.msg = null; return;
    }
    pz.left -= 1;
    if (pz.left <= 0) { pz.status = 'failed'; state.msg = null; return; }
    state.g = puzzleBoard(p.coins); state.phase = 'aim'; state.aim = null;
    say(sum.foul ? 'The striker fell in. The shot is set up again.' : sum.own ? `Only ${sum.own} went in; you need ${pz.goal}. Try again.` : 'Not this time. The shot is set up again.', 5);
  }

  // ---------------------------------------------------------------- input on the board
  const inBand = (p, side) => Math.abs(p.y - sy(BASE_Y[side])) < 46 && p.x > BX - 20 && p.x < BX + PLAY + 20;
  const clampX = (x) => Math.max(BASE_X0, Math.min(BASE_X1, x));
  function updateAim(dt, input) {
    const g = state.g, side = g.turn, p = input.pointer, keys = input.keys, dirY = side === 'W' ? -1 : 1;
    state.blocked = blocked(g.world, state.sx, BASE_Y[side]) && [...Array(30).keys()].some((i) => !blocked(g.world, BASE_X0 + i * (BASE_X1 - BASE_X0) / 29, BASE_Y[side]));
    // keyboard
    const ang = () => (state.aim ? state.aim.angle : forward(side));
    if (keys.down.has('ArrowLeft')) { state.sx = clampX(state.sx - 300 * dt); state.hintPulse = 0; } if (keys.down.has('ArrowRight')) { state.sx = clampX(state.sx + 300 * dt); state.hintPulse = 0; }
    const turn = (keys.down.has('KeyD') ? 1 : 0) - (keys.down.has('KeyA') ? 1 : 0), pw = (keys.down.has('ArrowUp') ? 1 : 0) - (keys.down.has('ArrowDown') ? 1 : 0);
    if (turn || pw) { const a = Math.max(forward(side) - 1.35, Math.min(forward(side) + 1.35, ang() + turn * 0.8 * dt)); state.aim = { angle: a, power: Math.max(0.08, Math.min(1, (state.aim ? state.aim.power : 0.5) + pw * 0.6 * dt)) }; }
    if (keys.pressed.has('Space') || keys.pressed.has('Enter')) { if (state.aim) fire(state.aim.angle, state.aim.power); else say('Aim first: A and D turn, Up and Down set power. Then Space.'); return; }
    // pointer
    const d = state.drag;
    if (p.pressed && p.y > 440 && p.y < 1420 && !state.menu) {
      state.hintPulse = 0;
      if (inBand(p, side)) { if (Math.abs(p.x - sx(state.sx)) < 52) state.drag = { mode: 'pending', x0: p.x, y0: p.y, off: state.sx - ux(p.x) }; else { state.drag = { mode: 'slide', x0: p.x, y0: p.y, off: 0 }; state.sx = clampX(ux(p.x)); state.aim = null; } }
      else state.drag = { mode: 'aim', x0: p.x, y0: p.y };
    }
    const dd = state.drag;
    if (dd && p.down) {
      if (dd.mode === 'pending' && Math.hypot(p.x - dd.x0, p.y - dd.y0) > 12) { if (Math.abs(p.x - dd.x0) > 1.3 * Math.abs(p.y - dd.y0)) { dd.mode = 'slide'; state.aim = null; } else dd.mode = 'aim'; }
      if (dd.mode === 'slide') state.sx = clampX(ux(p.x) + dd.off);
      else if (dd.mode === 'aim') {
        const vx = dd.x0 - p.x, vy = dd.y0 - p.y, len = Math.hypot(vx, vy) / K;
        if (len < MIN_PULL || vy * dirY <= 0) { state.aim = null; if (len >= MIN_PULL && vy * dirY <= 0) state.tip = 'Pull back toward your own side: the shot goes the opposite way.'; }
        else { state.aim = { angle: Math.atan2(vy, vx), power: Math.min(1, len / PULL) }; state.tip = TIPS.aim; }
      }
    }
    if (dd && p.released) {
      if (dd.mode === 'aim' && state.aim) fire(state.aim.angle, state.aim.power);
      else if (dd.mode === 'aim' && Math.hypot(p.x - dd.x0, p.y - dd.y0) > 8) say('Pull back further to flick. A short pull cancels the shot.', 3);
      state.drag = null;
    }
    if (dd && !p.down && !p.released) state.drag = null;
  }
  function updateAi(dt) {
    const g = state.g;
    if (state.phase === 'think') {
      state.wait += dt; for (let i = 0; i < 2 && thinker && !aiShot; i++) { const r = thinker.step(); if (r) aiShot = r; }
      if (aiShot && state.wait >= dur(0.7)) { state.phase = 'aiplace'; state.wait = 0; state.aiFrom = state.sx; }
    } else if (state.phase === 'aiplace') {
      state.wait += dt; const f = Math.min(1, state.wait / dur(0.55)); state.sx = state.aiFrom + (aiShot.x - state.aiFrom) * ease(f);
      if (f >= 1) { state.phase = 'aiaim'; state.wait = 0; state.aim = { angle: aiShot.angle, power: 0 }; }
    } else if (state.phase === 'aiaim') {
      state.wait += dt; const f = Math.min(1, state.wait / dur(0.85)); state.aim = { angle: aiShot.angle, power: aiShot.power * ease(f) };
      if (f >= 1) { state.blocked = false; const s = aiShot; aiShot = null; fire(s.angle, s.power); }
    }
    void g;
  }
  function updateHint() {
    if (!hintThinker) return;
    for (let i = 0; i < 3 && hintThinker; i++) { const r = hintThinker.step(); if (r) { hintThinker = null; state.hintBusy = false; state.sx = clearX(state.g, state.g.turn, r.x); state.aim = { angle: r.angle, power: r.power }; say('A suggested shot is lined up. Press Flick to play it, or drag to change it.', 5); } }
  }
  function askHint() {
    if (state.phase !== 'aim' || state.hintBusy || hintThinker) return;
    if (state.scene === 'play') { if (state.hintsLeft <= 0) { say('No hints left on this board.'); return; } state.hintsLeft -= 1; }
    if (state.scene === 'lesson') {
      const l = LESSONS[state.lesson.i], g = state.g, e = l.solve.find((q) => g.world.some((b) => b.on && Math.abs(b.x - q.at[0]) < 2 && Math.abs(b.y - q.at[1]) < 2));
      if (e) { state.sx = e.x; state.aim = { angle: e.angle, power: e.power }; say('A shot is lined up for you. Press Flick, or drag to try your own.', 5); } else say(l.text, 8);
      return;
    }
    if (state.scene === 'daily') { say('Look for a line: a coin driving another coin, or a cushion. The dotted path shows where each one goes.', 6); return; }
    state.hintBusy = true; hintThinker = createThinker(state.g, state.g.turn, 3, rng.int(1 << 30), true);
  }

  // ---------------------------------------------------------------- Auto Play ("Watch & Learn")
  // A full, start-to-finish assisted-learning demo: BOTH sides are driven by the exact same computer
  // move-chooser real Black already uses (ai.js's createThinker/chooseShot — chooseShot just runs a
  // thinker to completion in one call, used already by tests and the daily-shot search), through a
  // THINK -> REVEAL -> ACT loop for every stroke (this game's one decision point, exactly a human's
  // own turn): THINK holds the board still for a configurable pause; REVEAL sets the real chosen shot
  // as the current aim (`state.aim`, `state.phase = 'aiaim'`) so the exact same trajectory-guide line
  // a human's own aim already draws lights up — "a valid shot arc" is literally the brief's own
  // suggested mapping of "legal options" for a shot-based game; ACT fires it through the exact same
  // `fire()` function real play uses, and the exact same `stepWorld`/`endStroke`/`resolve` physics
  // and rules then play out untouched. Loops for a whole board to a real result (`g.over`), reusing
  // the exact same "Play again" / "Menu" overlay a real board-over already shows. Never touches
  // stats/save/demoBoards — Auto Play keeps its own `state.auto` and calls none of those writes.
  const autoThinkSecs = () => AUTO_THINK_STEPS[state.autoThinkIdx];
  function startAutoPlay() {
    resetTurn();
    state.g = newBoard('W');
    state.mode = 'two'; // cosmetic only (Player 1/Player 2 phrasing) — never persisted, never leaks into a real board
    state.scene = 'auto';
    state.sx = S / 2;
    state.auto = { sub: 'think', timer: 0, shot: null, paused: false };
    beginAutoTurn();
  }
  function beginAutoTurn() {
    state.sx = clearX(state.g, state.g.turn, state.sx);
    state.auto.sub = 'think'; state.auto.timer = 0; state.auto.shot = null;
    state.phase = 'think'; state.aim = null;
  }
  function teardownAuto() { state.auto = null; state.aim = null; state.phase = 'aim'; }
  function afterStrokeAuto() {
    const g = state.g;
    if (g.over) { state.phase = 'over'; return; } // reuses the real board-over overlay; never touches stats/save
    beginAutoTurn();
  }
  function updateAutoScene(dt, tap) {
    updateFx(dt);
    const g = state.g, A = state.auto;
    if (!A) return;
    const mir = (r) => (state.left ? { ...r, x: W - r.x - r.w } : r);
    if (tap) {
      if (inRect(mir(AUTO_DEC), tap.x, tap.y)) { if (state.autoThinkIdx > 0) { state.autoThinkIdx -= 1; savePrefs(); } return; }
      if (inRect(mir(AUTO_INC), tap.x, tap.y)) { if (state.autoThinkIdx < AUTO_THINK_STEPS.length - 1) { state.autoThinkIdx += 1; savePrefs(); } return; }
      if (state.phase === 'over') {
        if (inRect(OVER.again, tap.x, tap.y)) startAutoPlay();
        else if (inRect(OVER.menu, tap.x, tap.y)) { teardownAuto(); state.scene = 'title'; }
        return;
      }
      if (inRect(mir(PLAYB.menu), tap.x, tap.y)) { teardownAuto(); state.scene = 'title'; return; } // "Exit"
      if (inRect(mir(PLAYB.hint), tap.x, tap.y)) { A.paused = !A.paused; return; } // "Pause"/"Resume"
      if (inRect(mir(PLAYB.flick), tap.x, tap.y)) { if (A.sub === 'think' || A.sub === 'reveal') A.timer = 999; return; } // "Skip"
      return;
    }
    if (state.phase === 'over' || A.paused) return;
    if (state.phase === 'fly') {
      const ev = []; stepWorld(g.world, ev); state.ev.push(...ev); fxFor(ev); state.wait += dt;
      if (!moving(g.world) || state.wait > 20) endStroke();
      return;
    }
    if (state.phase === 'after') { state.wait += dt; if (state.wait >= dur(0.95)) afterStrokeAuto(); return; }
    if (A.sub === 'think') {
      A.timer += dt;
      if (A.timer >= autoThinkSecs()) {
        A.shot = chooseShot(g, g.turn, state.level, rng.int(1 << 30), false);
        state.sx = clearX(g, g.turn, A.shot.x);
        state.aim = { angle: A.shot.angle, power: A.shot.power };
        state.phase = 'aiaim'; // reuse the human aim's own trajectory-guide rendering, unchanged
        A.sub = 'reveal'; A.timer = 0;
      }
      return;
    }
    if (A.sub === 'reveal') {
      A.timer += dt;
      if (A.timer >= AUTO_REVEAL_SECS) {
        const s = A.shot; A.shot = null; A.sub = 'think'; A.timer = 0;
        fire(s.angle, s.power); // the exact same function a human's own flick calls
      }
      return;
    }
  }

  // ---------------------------------------------------------------- scenes
  function updateFx(dt) { state.shake = state.shake > 0.05 ? state.shake * Math.exp(-9 * dt) : 0; for (const f of state.fx) f.t += dt; state.fx = state.fx.filter((f) => f.t < f.dur); if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; } }
  function updateBoardScene(dt, input, tap) {
    updateFx(dt);
    const s = state.scene, ph = state.phase, g = state.g;
    // overlays and buttons
    if (state.menu) { if (tap) menuTap(tap); return; }
    if (tap) {
      const mir = (r) => (state.left ? { ...r, x: W - r.x - r.w } : r);
      if (inRect(mir(PLAYB.menu), tap.x, tap.y)) { state.menu = true; state.drag = null; return; }
      if (inRect(mir(PLAYB.hint), tap.x, tap.y)) { askHint(); return; }
      if (inRect(mir(PLAYB.flick), tap.x, tap.y)) { if (ph === 'aim' && state.aim) fire(state.aim.angle, state.aim.power); else if (ph === 'aim') say('Aim first: drag back from the striker, then release. Or use the Flick button after a Hint.'); return; }
      if (s === 'lesson' && state.lesson.done && inRect(LESSONB.next, tap.x, tap.y)) { const i = state.lesson.i + 1; if (i >= LESSONS.length) state.scene = 'lessons'; else startLesson(i); return; }
      if (s === 'daily' && (state.pz.status === 'solved' || state.pz.status === 'failed') && inRect(LESSONB.next, tap.x, tap.y)) { state.scene = 'title'; return; }
      if (s === 'play' && ph === 'over') { if (inRect(OVER.again, tap.x, tap.y)) startBoard(state.mode); else if (inRect(OVER.menu, tap.x, tap.y)) state.scene = 'title'; return; }
    }
    if (s === 'daily' && state.pz.status === 'making') { for (let i = 0; i < 3 && !state.daily.puzzle; i++) state.daily.puzzle = maker.step().puzzle; if (state.daily.puzzle) startDaily(); return; }
    if ((s === 'lesson' && state.lesson.done) || (s === 'daily' && state.pz.status !== 'ready')) return;
    if (ph === 'aim') { if (isHuman(g.turn)) { updateAim(dt, input); updateHint(); } }
    else if (ph === 'think' || ph === 'aiplace' || ph === 'aiaim') updateAi(dt);
    else if (ph === 'fly') {
      const ev = []; stepWorld(g.world, ev); state.ev.push(...ev); fxFor(ev); state.wait += dt;
      if (!moving(g.world) || state.wait > 20) endStroke();
    } else if (ph === 'after') { state.wait += dt; if (state.wait >= dur(0.95)) afterStroke(); }
  }
  function menuTap(tap) {
    if (inRect(MENU.resume, tap.x, tap.y)) state.menu = false;
    else if (inRect(MENU.restart, tap.x, tap.y)) { state.menu = false; if (state.scene === 'play') { clearSave(); startBoard(state.mode); } else if (state.scene === 'lesson') startLesson(state.lesson.i); else startDaily(); }
    else if (inRect(MENU.settings, tap.x, tap.y)) { state.back = state.scene; state.menu = false; state.scene = 'settings'; }
    else if (inRect(MENU.quit, tap.x, tap.y)) { state.menu = false; saveBoard(); state.scene = state.scene === 'lesson' ? 'lessons' : 'title'; }
  }

  // Title attract mode: a real board, played by chance, so the first frame already moves.
  function updateDemo(dt) {
    const d = state.demo; d.t += dt;
    for (const f of d.fx) f.t += dt; d.fx = d.fx.filter((f) => f.t < f.dur);
    if (!d.world.length) { d.world = newBoard('W').world; d.strokes = 0; d.wait = 0.4; }
    if (moving(d.world)) { const ev = []; stepWorld(d.world, ev); for (const e of ev) if (e.t === 'pocket') d.fx.push({ type: 'drop', k: e.k, x: e.x, y: e.y, px: e.p % 2 ? S - 8 : 8, py: e.p > 1 ? S - 8 : 8, t: 0, dur: 0.4 }); return; }
    d.world = d.world.filter((b) => b.k !== 'S' || false).map((b) => b);
    d.wait -= dt; if (d.wait > 0) return;
    const coins = d.world.filter((b) => b.on); if (d.strokes >= 7 || coins.length < 8) { d.world = []; return; }
    const target = coins[rng.int(coins.length)], x = 200 + rng.int(340), y = BASE_Y.W, a = Math.atan2(target.y - y, target.x - x);
    d.world.push({ id: 99, k: 'S', x, y, vx: Math.cos(a) * (d.strokes === 0 ? 2500 : 1500 + rng.int(900)), vy: Math.sin(a) * (d.strokes === 0 ? 2500 : 1500 + rng.int(900)), on: true });
    d.strokes += 1; d.wait = 0.9;
  }
  function updateTitle(dt, tap) {
    updateDemo(dt); if (!state.daily.puzzle) for (let i = 0; i < 2 && !state.daily.puzzle; i++) state.daily.puzzle = maker.step().puzzle;
    if (!tap) return;
    const B = titleButtons(!!state.saved), hit = (r) => r && inRect(r, tap.x, tap.y);
    if (hit(B.resume)) resumeBoard(); else if (hit(B.play)) startBoard('ai'); else if (hit(B.two)) startBoard('two');
    else if (hit(B.learn)) state.scene = 'lessons'; else if (hit(B.daily)) startDaily();
    else if (hit(B.level)) { state.level = (state.level + 1) % AI_LEVELS.length; savePrefs(); tone({ freq: 500, to: 300, dur: 0.06, type: 'triangle', vol: 0.06 }); }
    else if (hit(B.howto)) { state.scene = 'howto'; state.page = 0; } else if (hit(B.about)) { state.scene = 'about'; state.page = 0; }
    else if (hit(B.rules)) { state.scene = 'rules'; state.page = 0; } else if (hit(B.settings)) { state.back = 'title'; state.scene = 'settings'; }
    else if (hit(B.auto)) startAutoPlay();
  }
  // Text-size stepper (A-/A+) shared by the About/Controls/Game Rules reference pages. Returns
  // true when the tap landed on one of the two buttons (whether or not it moved the index — tapping
  // a disabled end still consumes the tap so it doesn't fall through to something behind it).
  function stepText(tap) {
    if (inRect(PAGE_TEXT.dec, tap.x, tap.y)) { if (state.textScaleIdx > 0) { state.textScaleIdx--; savePrefs(); tone({ freq: 460, to: 360, dur: 0.05, type: 'triangle', vol: 0.06 }); } return true; }
    if (inRect(PAGE_TEXT.inc, tap.x, tap.y)) { if (state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; savePrefs(); tone({ freq: 460, to: 560, dur: 0.05, type: 'triangle', vol: 0.06 }); } return true; }
    return false;
  }
  function updateSettings(tap) {
    if (!tap) return;
    if (inRect(PAGE.back, tap.x, tap.y)) { state.scene = state.back === 'title' ? 'title' : state.back; if (state.scene !== 'title') state.menu = true; savePrefs(); return; }
    const rows = settingRows(); const i = rows.findIndex((r) => inRect(r, tap.x, tap.y)); if (i < 0) return;
    if (i === 0) { state.sound = !state.sound; audio.setMuted?.(!state.sound); } else if (i === 1) state.calm = !state.calm; else if (i === 2) state.textScaleIdx = (state.textScaleIdx + 1) % TEXT_SCALES.length; else if (i === 3) state.left = !state.left;
    else if (i === 6) { monetization.restore?.(); say('Checking for earlier purchases…', 3); } else if (i === 4) state.theme = THEME_KEYS[(THEME_KEYS.indexOf(state.theme) + 1) % THEME_KEYS.length]; else if (i === 5) state.guide = (state.guide + 2) % 3;
    savePrefs(); tone({ freq: 520, to: 380, dur: 0.05, type: 'triangle', vol: 0.06 });
  }

  return {
    update(dt, input) {
      state.t += dt; sounds = 0;
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'title') updateTitle(dt, tap);
      else if (sc === 'play' || sc === 'lesson' || sc === 'daily') updateBoardScene(dt, input, tap);
      else if (sc === 'settings') updateSettings(tap);
      else if (sc === 'howto') { if (tap) { if (inRect(PAGE.back, tap.x, tap.y)) state.scene = 'title'; else if (inRect(PAGE.next, tap.x, tap.y)) state.page = Math.min(state.page + 1, HOWTO_PAGES.length - 1); else if (inRect(PAGE.prev, tap.x, tap.y)) state.page = Math.max(state.page - 1, 0); else if (stepText(tap)) {} } }
      else if (sc === 'rules') { if (tap) { if (inRect(PAGE.back, tap.x, tap.y)) state.scene = 'title'; else if (inRect(PAGE.next, tap.x, tap.y)) state.page = (state.page + 1) % GAME_RULES.length; else if (inRect(PAGE.prev, tap.x, tap.y)) state.page = (state.page - 1 + GAME_RULES.length) % GAME_RULES.length; else if (stepText(tap)) {} } }
      else if (sc === 'about') { if (tap) { if (inRect(PAGE.back, tap.x, tap.y)) state.scene = 'title'; else if (inRect(PAGE.next, tap.x, tap.y)) state.page = Math.min(state.page + 1, ABOUT_PAGES.length - 1); else if (inRect(PAGE.prev, tap.x, tap.y)) state.page = Math.max(state.page - 1, 0); else if (stepText(tap)) {} } }
      else if (sc === 'demo-limit') { if (tap && inRect(PAGE.back, tap.x, tap.y)) state.scene = 'title'; }
      else if (sc === 'lessons') { if (tap) { if (inRect(PAGE.back, tap.x, tap.y)) state.scene = 'title'; else { const i = lessonRows().findIndex((r) => inRect(r, tap.x, tap.y)); if (i >= 0) startLesson(i); } } }
      else if (sc === 'auto') updateAutoScene(dt, tap);
    },
    render(ctx) { render(ctx, state); },
    getState: () => state,
    // Auto Play is meant to be free like the menu's own attract-mode preview, never gated like real
    // play — exempts this scene's time from the shared free-preview timer (kit 1.6.1+, no-op on
    // free/no-preview games and on older kit).
    isPreviewExempt: () => state.scene === 'auto',
  };
}
