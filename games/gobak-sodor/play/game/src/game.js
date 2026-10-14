// Gobak Sodor: state and flow. Drawing is view.js; engine.js is the rule book and simulation; pages.js the text.
// Controls (taught on the How to play page): TAP a runner to pick it, then TAP a cell or SWIPE to step it one cell; WAIT passes the
// beat; HINT shows the computer's move. Arrow keys, 1-3, Tab, Space and H do the same on a keyboard.
import { inRect, layoutFor, TEXT_SCALES, AUTO_THINK_STEPS, AUTO_REVEAL_SECS, CELL, cellY, cellX, cellAtPoint } from './layout.js';
import { render, reader } from './view.js';
import { newRound, step, bestAction, canMove, onGrid, W, RUNNERS, ROUNDS, HINTS, LEVELS } from './engine.js';

// `meta.width/height` are updated live by the kit on every resize; every position comes from layoutFor(meta.width, meta.height).
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
// Mouse-wheel travel (virtual units) collected by main.js and consumed by the reader pages; empty in headless runs.
export const wheelInput = { dy: 0 };
const DEMO_MATCHES = 2, STEP_ANIM = 0.5, AUTO_LEVEL = 0, SWIPE = 34;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dirWord = (dc, dr) => (dr > 0 ? 'steps up' : dr < 0 ? 'steps back' : dc < 0 ? 'steps left' : 'steps right');

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    pitch: CELL, scene: 'title', t: 0, level: 0, sound: true, calm: false, textScaleIdx: 0, left: false, guide: true,
    stage: 'intro', stageT: 0, r: newRound(rng, { level: 0, round: 0 }), match: null, sel: 1, anim: { t: 0, dur: 0 }, fx: [], msg: null,
    menu: false, hintsLeft: HINTS, hint: null, shake: { x: 0, y: 0, a: 0 }, stats: { rounds: 0, stars: 0, matches: 0 },
    scroll: 0, page: 0, back: 'title', endWait: 0, demoMode: config.demo === true, dev: config.dev === true, demoMatches: 0,
    autoThinkIdx: 1, restoreMsg: '', restoreBusy: false, owned: false, auto: null, lkDown: false, demo: { r: null, a: 1, animT: 0, wait: 0.8 },
  };
  const lay = () => layoutFor(meta.width, meta.height, state.left);
  // Store screenshots (tools/arc shots opens ?shot=1&seed=N&ticks=T). A seed of 9000 or more is a SCRIPTED scene, not the random
  // monkey: the last digit picks the scene (1 Village, 2 Schoolyard, 3 Champions mid-round, 4 Auto Play, 5 a finished round) and
  // the computer's own runner AI plays it. Pointer input is ignored in that mode. Inert in the app and the web demo.
  const shotKind = (() => { try { const q = new URLSearchParams(globalThis.location?.search ?? ''); const sd = Number(q.get('seed')); return q.has('shot') && sd >= 9000 ? sd % 10 : -1; } catch { return -1; } })();
  const SHOT_BEATS = { 1: 7, 2: 9, 3: 20, 4: 6, 5: 999 };
  let shotTick = 0;
  let sounds = 0, drag = null;

  const CLAMP = (v) => Math.min(Math.max(v, 0), TEXT_SCALES.length - 1);
  storage.get('prefs', null).then((v) => { if (v) { for (const k of ['level', 'sound', 'calm', 'left', 'guide']) if (v[k] !== undefined) state[k] = v[k]; state.level = clamp(state.level | 0, 0, LEVELS.length - 1); if (v.textScaleIdx !== undefined) state.textScaleIdx = CLAMP(v.textScaleIdx); if (v.autoThinkIdx !== undefined) state.autoThinkIdx = clamp(v.autoThinkIdx, 0, AUTO_THINK_STEPS.length - 1); audio.setMuted?.(!state.sound); } });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v }; });
  storage.get('demoMatches', 0).then((v) => { state.demoMatches = Math.max(state.demoMatches, v); });
  // Settings > Restore purchase: hidden in the web demo, "Full game unlocked" once owned, clear busy / not-found / failed messages.
  const isDemo = () => config.demo === true || monetization.mode === 'demo';
  const owns = () => !!(monetization.owns && monetization.owns('unlock_game'));
  function doRestore() {
    if (isDemo() || state.restoreBusy || owns()) return;
    state.restoreBusy = true; state.restoreMsg = '';
    Promise.resolve(monetization.restore()).then(() => { state.restoreMsg = owns() ? '' : 'No earlier purchase found'; })
      .catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
  }
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, textScaleIdx: state.textScaleIdx, left: state.left, guide: state.guide, autoThinkIdx: state.autoThinkIdx });
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { rounds: state.stats.rounds, stars: state.stats.stars }); };

  const say = (text, hold = 4) => { state.msg = { text, t: 0, hold }; };
  // Auto Play is silent by design regardless of the player's own Sound setting; every sound funnels through this one helper.
  const tone = (o) => { if (state.sound && sounds < 4 && state.scene !== 'auto' && state.scene !== 'title') { sounds++; audio.tone(o); } };
  const dur = (d) => (state.calm ? d * 0.6 : d);
  const cellPos = (c, row, lines) => ({ x: cellX(c), y: cellY(row, lines, state.pitch) });

  // ---------------------------------------------------------------- starting things
  const newMatch = () => ({ n: 0, stars: [], over: null });
  const firstActive = (r) => { const ru = r.runners.find(onGrid); return ru ? ru.id : 0; };
  function beginRound(levelOverride) {
    const lvl = levelOverride ?? state.level;
    state.r = newRound(rng, { level: lvl, round: state.match.n });
    state.sel = 1; state.fx = []; state.msg = null; state.menu = false; state.hint = null;
    state.stage = 'intro'; state.stageT = 0; state.anim = { t: 0, dur: 0 }; state.endWait = 0; drag = null;
    if (state.auto) { state.auto.sub = 'idle'; state.auto.timer = 0; state.auto.dec = null; }
  }
  function startMatch() {
    if (config.demo && state.demoMatches >= DEMO_MATCHES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoMatches += 1; storage.set('demoMatches', state.demoMatches); }
    state.scene = 'play'; state.match = newMatch(); state.hintsLeft = HINTS; state.auto = null;
    beginRound(); monetization.track('match_start', { level: state.level });
  }
  const autoThinkSecs = () => AUTO_THINK_STEPS[state.autoThinkIdx];
  function startAuto() {
    state.scene = 'auto'; state.match = newMatch(); state.auto = { sub: 'idle', timer: 0, paused: false, dec: null, what: '' };
    beginRound(AUTO_LEVEL);
  }
  function leaveToTitle() { state.scene = 'title'; state.auto = null; state.menu = false; state.stage = 'intro'; state.fx = []; state.msg = null; state.hint = null; }

  // ---------------------------------------------------------------- effects and sound from the engine's event log
  function consume(r) {
    const ln = r.lines;
    for (const e of r.ev) {
      if (e.t === 'move') {
        tone({ freq: e.line ? 330 : 260, to: e.line ? 400 : 300, dur: 0.06, type: 'triangle', vol: 0.05 });
      } else if (e.t === 'end') {
        const ru = r.runners[e.id], p = cellPos(ru.c, ru.row, ln);
        tone({ freq: 520, to: 880, dur: 0.25, type: 'triangle', vol: 0.09 });
        state.fx.push({ type: 'ring', x: p.x, y: p.y, t: 0, dur: dur(0.6), s: 1.3 }); state.fx.push({ type: 'pop', text: 'Far end!', color: '#9cf29a', down: true, x: p.x, y: p.y, t: 0, dur: dur(1.1) });
        if (state.scene === 'play') say('Touched the far end. Now come all the way back home.', 4);
      } else if (e.t === 'home') {
        const ru = r.runners[e.id], p = cellPos(ru.c, 0, ln);
        for (let k = 0; k < 3; k++) tone({ freq: 440 + k * 160, to: 560 + k * 160, dur: 0.14, type: 'triangle', vol: 0.08 });
        state.fx.push({ type: 'pop', text: 'Home! +1', color: '#ffd24a', x: p.x, y: p.y - 20, t: 0, dur: dur(1.2) });
        for (let k = 0; k < 14; k++) state.fx.push({ type: 'star', x: p.x, y: p.y, vx: (rng.next() - 0.5) * 340, vy: -120 - rng.next() * 160, t: 0, dur: dur(1.0), color: ['#ffd24a', '#ff6a5c', '#38c9a8'][k % 3] });
      } else if (e.t === 'tag') {
        const p = cellPos(e.c, e.row, ln);
        for (let k = 0; k < 4; k++) tone({ freq: 380 - k * 60, to: 120, dur: 0.12, type: 'square', vol: 0.05 });
        state.fx.push({ type: 'ring', x: p.x, y: p.y, t: 0, dur: dur(0.5), s: 1.6 }); state.fx.push({ type: 'pop', text: 'Touched!', color: '#ff8a70', x: p.x, y: p.y, t: 0, dur: dur(1.1) });
        state.fx.push({ type: 'flash', t: 0, dur: dur(0.45) });
        for (let k = 0; k < 8; k++) state.fx.push({ type: 'dust', x: p.x, y: p.y, vx: (rng.next() - 0.5) * 220, vy: (rng.next() - 0.5) * 160, t: 0, dur: dur(0.6) });
        if (!state.calm) state.shake.a = 9;
        if (state.scene === 'play') say(e.by === 'sodor' ? 'The Sodor guard touched your runner.' : 'A line guard touched your runner. Watch the red zone.', 4);
      }
    }
    r.ev.length = 0;
  }
  function updateFx(dt) {
    for (const f of state.fx) f.t += dt;
    state.fx = state.fx.filter((f) => f.t < f.dur);
    if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
    if (state.hint) state.hint.t += dt;
    const s = state.shake; s.a *= Math.pow(0.02, dt); if (s.a < 0.2) s.a = 0; s.x = Math.sin(state.t * 83) * s.a; s.y = Math.cos(state.t * 71) * s.a * 0.6;
    if (state.anim.dur > 0) { state.anim.t += dt; if (state.anim.t >= state.anim.dur) state.anim = { t: 0, dur: 0 }; }
  }

  // ---------------------------------------------------------------- one beat
  function playBeat(action) {
    const r = state.r;
    if (!step(r, action)) return false;
    state.anim = { t: 0, dur: state.calm ? 0.34 : STEP_ANIM }; state.hint = null;
    consume(r);
    if (state.scene === 'auto' && r.home >= 1 && !r.result) r.result = { kind: 'done', home: r.home, out: r.out, beats: r.beat };
    const cur = r.runners[state.sel];
    if (!cur || !onGrid(cur)) state.sel = firstActive(r);
    return true;
  }
  function tryMove(id, dc, dr) {
    const r = state.r, ru = r.runners[id];
    if (!ru || !onGrid(ru)) return false;
    if (!canMove(r, ru, dc, dr)) { if (ru.c + dc >= 0 && ru.c + dc < W && ru.row + dr >= 0 && ru.row + dr <= r.top) say('That cell is taken by another runner.', 2); return false; }
    return playBeat({ runner: id, dc, dr });
  }
  function askHint() {
    const r = state.r;
    if (state.stage !== 'live' || r.result || state.anim.dur > 0) return;
    if (state.hintsLeft <= 0) { say('No hints left in this match.'); return; }
    const best = bestAction(r, 4).action;
    state.hint = { action: best, t: 0 };
    if (best.wait) say('Wait a beat: every step now would be touched.', 4);
    else { state.sel = best.runner; say(`Runner ${best.runner + 1} ${dirWord(best.dc, best.dr)}. The glowing arrow shows it.`, 5); }
    state.hintsLeft -= 1;
  }

  // ---------------------------------------------------------------- the human's input
  function stepToward(id, col, row) {
    const ru = state.r.runners[id], dx = col - ru.c, dy = row - ru.row;
    if (!dx && !dy) return;
    if (Math.abs(dy) >= Math.abs(dx)) tryMove(id, 0, dy > 0 ? 1 : -1); else tryMove(id, dx > 0 ? 1 : -1, 0);
  }
  function pickNext() {
    const r = state.r, n = r.runners.length;
    for (let k = 1; k <= n; k++) { const ru = r.runners[(state.sel + k) % n]; if (onGrid(ru)) { state.sel = ru.id; return; } }
  }
  function updateHumanPlay(input, tap) {
    const r = state.r, P = lay().play(state.scene, r.lines), p = input.pointer, keys = input.keys, LY = lay();
    state.pitch = P.pitch;
    if (tap) {
      if (inRect(P.btn.menu, tap.x, tap.y)) { state.menu = true; drag = null; return; }
      if (inRect(P.btn.hint, tap.x, tap.y)) { askHint(); return; }
      if (inRect(P.btn.act, tap.x, tap.y)) { if (state.anim.dur <= 0) playBeat({ wait: true }); return; }
    }
    if (keys.pressed.has('KeyH')) askHint();
    for (let i = 0; i < RUNNERS; i++) if (keys.pressed.has('Digit' + (i + 1)) && onGrid(r.runners[i])) state.sel = i;
    if (keys.pressed.has('Tab')) pickNext();
    if (state.anim.dur > 0) { drag = null; return; }
    if (keys.pressed.has('Space') || keys.pressed.has('KeyW')) { playBeat({ wait: true }); return; }
    const k = keys.pressed;
    if (k.has('ArrowUp')) tryMove(state.sel, 0, 1); else if (k.has('ArrowDown')) tryMove(state.sel, 0, -1);
    else if (k.has('ArrowLeft')) tryMove(state.sel, -1, 0); else if (k.has('ArrowRight')) tryMove(state.sel, 1, 0);
    if (state.anim.dur > 0) return;
    if (p.pressed && inRect(P.area, p.x, p.y)) drag = { c0: LY.toCourt(P, p.x, p.y) };
    if (drag && p.released) {
      const c1 = LY.toCourt(P, p.x, p.y), dx = c1.x - drag.c0.x, dy = c1.y - drag.c0.y;
      const { col: col0, row: row0 } = cellAtPoint(drag.c0.x, drag.c0.y, r.lines, P.pitch);
      const at = r.runners.find((x) => onGrid(x) && x.c === col0 && x.row === row0);
      if (Math.hypot(dx, dy) > SWIPE) {
        const id = at ? at.id : state.sel;
        state.sel = id;
        if (Math.abs(dx) > Math.abs(dy)) tryMove(id, dx > 0 ? 1 : -1, 0); else tryMove(id, 0, dy < 0 ? 1 : -1);
      } else if (at) state.sel = at.id;
      else if (onGrid(r.runners[state.sel])) stepToward(state.sel, col0, row0);
      drag = null;
    }
    if (drag && !p.down && !p.released) drag = null;
  }

  function driveShot() {
    shotTick += 1;
    if (shotTick === 1 && shotKind > 0) {
      state.level = shotKind === 2 ? 1 : shotKind === 3 ? 2 : 0; state.sound = false; state.guide = true;
      if (shotKind === 4) startAuto(); else startMatch();
    }
    if (state.scene !== 'play' && state.scene !== 'auto') return;
    if (state.stage !== 'live' || state.anim.dur > 0 || state.r.result || state.menu) return;
    if (state.scene === 'auto') {      // Auto Play plays itself: fast-forward its THINK/REVEAL, then hold the last REVEAL on screen
      const A = state.auto;
      if (state.r.beat < SHOT_BEATS[shotKind]) { if (A.sub === 'think' || A.sub === 'reveal') A.timer = 999; } else if (A.sub === 'reveal') A.timer = 0; else if (A.sub === 'think') A.timer = 999;
      return;
    }
    if (state.r.beat >= SHOT_BEATS[shotKind]) return;
    if (shotTick % 16 !== 0) return;
    const best = bestAction(state.r, 3).action;
    if (!best.wait) state.sel = best.runner;
    playBeat(best);
  }

  // ---------------------------------------------------------------- Auto Play ("Watch & Learn")
  // The computer leads the runners. Every beat runs THINK (the configurable pause, the world held still) -> REVEAL (the chosen
  // runner and its arrow are shown) -> ACT (played through the same playBeat a human's input makes). Pause freezes everything.
  function autoDecide() {
    const A = state.auto, best = bestAction(state.r, 3).action;
    A.dec = best; A.what = best.wait ? 'The team waits a beat' : `Runner ${best.runner + 1} ${dirWord(best.dc, best.dr)}`;
    if (!best.wait) state.sel = best.runner;
    A.sub = 'think'; A.timer = 0;
  }
  function autoAct() {
    const A = state.auto, d = A.dec; A.dec = null; A.sub = 'idle'; A.timer = 0;
    if (d) playBeat(d);
  }
  function updateAuto(dt, tap, input) {
    const A = state.auto, P = lay().play('auto', state.r.lines);
    if (!A) return;
    updateFx(A.paused ? 0 : dt);
    if (tap) {
      if (inRect(P.auto.dec, tap.x, tap.y)) { if (state.autoThinkIdx > 0) { state.autoThinkIdx -= 1; savePrefs(); } return; }
      if (inRect(P.auto.inc, tap.x, tap.y)) { if (state.autoThinkIdx < AUTO_THINK_STEPS.length - 1) { state.autoThinkIdx += 1; savePrefs(); } return; }
      if (state.menu) { menuTap(tap); return; }
      if (state.stage === 'result' || state.stage === 'over') { resultTap(tap); return; }
      if (inRect(P.btn.menu, tap.x, tap.y)) { leaveToTitle(); return; }
      if (inRect(P.btn.hint, tap.x, tap.y)) { A.paused = !A.paused; return; }
      if (inRect(P.btn.act, tap.x, tap.y)) { if (A.sub === 'think' || A.sub === 'reveal') A.timer = 999; return; }
      return;
    }
    if (input.keys.pressed.has('KeyP')) A.paused = !A.paused;
    if (A.paused || state.menu) return;
    if (state.stage === 'intro') { state.stageT += dt; if (state.stageT > dur(1.7)) state.stage = 'live'; return; }
    if (state.stage !== 'live') return;
    if (state.anim.dur > 0) return;
    if (state.r.result) { afterBeat(dt); return; }
    if (A.sub === 'think') { A.timer += dt; if (A.timer >= autoThinkSecs()) { A.sub = 'reveal'; A.timer = 0; } return; }
    if (A.sub === 'reveal') { A.timer += dt; if (A.timer >= AUTO_REVEAL_SECS) autoAct(); return; }
    autoDecide();
  }

  // ---------------------------------------------------------------- the round clock (shared)
  function afterBeat(dt) {
    const r = state.r;
    if (r.result && state.anim.dur <= 0) {
      state.endWait += dt;
      if (state.endWait > dur(1.0)) { state.stage = 'result'; finishRound(); }
    }
  }
  function finishRound() {
    const m = state.match, r = state.r;
    m.stars.push(r.home); m.n += 1;
    const total = m.stars.reduce((x, y) => x + y, 0);
    if (state.scene === 'auto' || m.n >= ROUNDS) m.over = { total };
    if (state.scene === 'play') {
      state.stats.rounds += 1; state.stats.stars += r.home;
      if (m.over) { state.stats.matches += 1; monetization.track('match_end', { total, level: state.level }); }
      saveStats();
      tone({ freq: r.home > 0 ? 520 : 300, to: r.home > 0 ? 900 : 220, dur: 0.45, type: 'triangle', vol: 0.1 });
    }
  }
  function resultTap(tap) {
    const D = lay().dialog(state.stage === 'over' ? 'over' : 'round');
    if (inRect(D.btns[0], tap.x, tap.y)) {
      if (state.stage === 'over') { if (state.scene === 'auto') startAuto(); else startMatch(); }
      else if (state.match.over) state.stage = 'over';
      else beginRound();
    } else if (inRect(D.btns[1], tap.x, tap.y)) leaveToTitle();
  }
  function menuTap(tap) {
    const MENU = lay().menu;
    if (inRect(MENU.resume, tap.x, tap.y)) state.menu = false;
    else if (inRect(MENU.restart, tap.x, tap.y)) { state.menu = false; if (state.scene === 'auto') startAuto(); else startMatch(); }
    else if (inRect(MENU.settings, tap.x, tap.y)) { state.back = state.scene; state.menu = false; state.scene = 'settings'; }
    else if (inRect(MENU.quit, tap.x, tap.y)) { state.menu = false; leaveToTitle(); }
  }
  function updatePlay(dt, input, tap) {
    updateFx(dt);
    if (state.menu) { if (tap) menuTap(tap); return; }
    if (state.stage === 'intro') {
      state.stageT += dt;
      if (state.stageT > dur(1.7) || (tap && state.stageT > 0.4)) { state.stage = 'live'; state.stageT = 0; say('Tap a runner, then tap or swipe to step it. Guards move after every step.', 5); }
      return;
    }
    if (state.stage === 'result' || state.stage === 'over') { if (tap) resultTap(tap); return; }
    if (!state.r.result) updateHumanPlay(input, tap);
    if (state.menu) return;
    afterBeat(dt);
  }

  // ---------------------------------------------------------------- title attract mode: a real round, led by the computer
  function updateDemo(dt) {
    const d = state.demo;
    updateFx(dt);
    if (d.animT > 0) { d.animT -= dt; d.a = 1 - Math.max(0, d.animT) / 0.5; } else d.a = 1;
    if (!d.r) { d.r = newRound(rng, { level: 0, round: 1 }); d.wait = 0.9; return; }
    const r = d.r;
    if (r.result) { d.wait -= dt; if (d.wait < -2.4) d.r = null; return; }
    d.wait -= dt;
    if (d.wait <= 0 && d.animT <= 0) {
      step(r, bestAction(r, 2).action); r.ev.length = 0; d.animT = 0.5; d.a = 0; d.wait = 0.34;
      if (r.result) d.wait = 0;
    }
  }
  function updateTitle(dt, tap, input0) {
    updateDemo(dt);
    const LT = lay().title(false).lockTap; state.lkDown = !!(input0 && input0.pointer.down && inRect(LT, input0.pointer.x, input0.pointer.y));
    if (tap && inRect(LT, tap.x, tap.y)) { env.openArcforgeHome?.(); return; }
    if (!tap) return;
    const B = lay().title(false).rows, hit = (r) => r && inRect(r, tap.x, tap.y);
    if (hit(B.play)) startMatch();
    else if (hit(B.level)) { state.level = (state.level + 1) % LEVELS.length; savePrefs(); tone({ freq: 500, to: 300, dur: 0.06, type: 'triangle', vol: 0.06 }); }
    else if (hit(B.howto)) { state.scene = 'howto'; state.page = 0; state.scroll = 0; } else if (hit(B.about)) { state.scene = 'about'; state.page = 0; state.scroll = 0; }
    else if (hit(B.rules)) { state.scene = 'rules'; state.page = 0; state.scroll = 0; } else if (hit(B.settings)) { state.back = 'title'; state.scene = 'settings'; }
    else if (hit(B.auto)) startAuto();
  }

  // ---------------------------------------------------------------- reader pages and settings
  function stepText(tap) {
    const RD = lay().reader;
    if (inRect(RD.dec, tap.x, tap.y)) { state.scroll = 0; if (state.textScaleIdx > 0) { state.textScaleIdx--; savePrefs(); tone({ freq: 460, to: 360, dur: 0.05, type: 'triangle', vol: 0.06 }); } return true; }
    if (inRect(RD.inc, tap.x, tap.y)) { state.scroll = 0; if (state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; savePrefs(); tone({ freq: 460, to: 560, dur: 0.05, type: 'triangle', vol: 0.06 }); } return true; }
    return false;
  }
  let rdrag = null;
  function updateReader(input, tap) {
    const RD = lay().reader, p = input.pointer, maxS = () => Math.max(0, reader.max || 0), setS = (v) => { state.scroll = Math.min(Math.max(0, v), maxS()); };
    if (wheelInput.dy) { setS(state.scroll + wheelInput.dy); wheelInput.dy = 0; }
    if (input.keys.down.has('ArrowDown')) setS(state.scroll + 12); if (input.keys.down.has('ArrowUp')) setS(state.scroll - 12);
    const kp = input.keys.pressed;
    if (kp.has('PageDown') || kp.has('Space')) setS(state.scroll + RD.viewport.h * 0.85); if (kp.has('PageUp')) setS(state.scroll - RD.viewport.h * 0.85);
    if (kp.has('Home')) setS(0); if (kp.has('End')) setS(1e9);
    if (kp.has('Escape')) { state.scene = 'title'; return; }
    if (p.pressed && inRect(RD.viewport, p.x, p.y)) rdrag = { y0: p.y, s0: state.scroll, moved: false };
    if (rdrag && p.down) { if (Math.abs(p.y - rdrag.y0) > 6) rdrag.moved = true; if (rdrag.moved) setS(rdrag.s0 - (p.y - rdrag.y0)); }
    if (!p.down) rdrag = null;
    if (!tap) return;
    if (inRect(RD.nav.back, tap.x, tap.y)) state.scene = 'title';
    else if (inRect(RD.nav.next, tap.x, tap.y)) setS(state.scroll + RD.viewport.h * 0.85);
    else if (inRect(RD.nav.prev, tap.x, tap.y)) setS(0);
    else stepText(tap);
  }
  function updateSettings(tap) {
    if (!tap) return;
    const SET = lay().settings;
    if (inRect(SET.done, tap.x, tap.y)) { const b = state.back; state.scene = b === 'title' ? 'title' : b; if (state.scene !== 'title') state.menu = true; savePrefs(); return; }
    const i = SET.rows.findIndex((r) => inRect(r, tap.x, tap.y)); if (i < 0) return;
    if (i === 0) { state.sound = !state.sound; audio.setMuted?.(!state.sound); } else if (i === 1) state.calm = !state.calm; else if (i === 2) state.textScaleIdx = (state.textScaleIdx + 1) % TEXT_SCALES.length; else if (i === 3) state.left = !state.left;
    else if (i === 4) state.guide = !state.guide; else if (i === 5) doRestore();
    savePrefs(); tone({ freq: 520, to: 380, dur: 0.05, type: 'triangle', vol: 0.06 });
  }

  return {
    update(dt, input0) {
      let input = input0;
      if (shotKind >= 0) { driveShot(); input = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() }, wheel: { dx: 0, dy: 0 } }; }
      state.t += dt; sounds = 0; state.owned = owns(); state.demoMode = isDemo();
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'play' || sc === 'auto') state.pitch = lay().play(sc, state.r.lines).pitch;
      if (sc === 'title') updateTitle(dt, tap, input);
      else if (sc === 'play') updatePlay(dt, input, tap);
      else if (sc === 'settings') updateSettings(tap);
      else if (sc === 'howto' || sc === 'rules' || sc === 'about') updateReader(input, tap);
      else if (sc === 'demo-limit') { if (tap && inRect(lay().demo.back, tap.x, tap.y)) state.scene = 'title'; }
      else if (sc === 'auto') updateAuto(dt, tap, input);
    },
    render(ctx, view) {
      // keep the kit's preview pill off the court in landscape: park it at the foot of the info column
      if (state.scene === 'play' && meta.width > meta.height) { const P = lay().play('play', state.r.lines); meta.previewBadge = P.info ? { x: P.info.x + 14, y: P.info.y + P.info.h - 30, align: 'left' } : undefined; } else meta.previewBadge = undefined;
      render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height, state.left));
    },
    getState: () => state,
    // The preview clock counts real play only: a live round of a real match. Menu, Rules / How to Play / About, Settings, the pause
    // menu, Auto Play (a free teaching demo), banners and result cards are all free time.
    isPreviewExempt: () => state.menu || !(state.scene === 'play' && state.stage === 'live'),
  };
}
export { ROUNDS };
