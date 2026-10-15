// Kho-Kho: state and flow. Drawing is view.js; engine.js is the rule book and simulation; pages.js the text.
// Controls (taught on the How to play page): TAP or DRAG on the court to send the standing chaser there; tap a glowing seat or the
// KHO button to hand over the chase. In the running turns TAP a runner to pick it, then tap or drag to send it. HINT freezes the
// court for a moment and shows the computer's choice. Arrow keys, Space, 1-3, Tab and H do the same on a keyboard.
import { inRect, layoutFor, TEXT_SCALES, AUTO_THINK_STEPS, AUTO_REVEAL_SECS } from './layout.js';
import { render, reader } from './view.js';
import {
  COURT, SEAT_Y, RUNNERS, BATCHES, INNINGS, HINTS, HINT_FREEZE, LEVELS, newBatch, step, setTarget, selectRunner, nextRunner,
  giveKho, legalSeats, advise, planChaser,
} from './engine.js';

// `meta.width/height` are updated live by the kit on every resize; every position comes from layoutFor(meta.width, meta.height).
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
// Mouse-wheel travel (virtual units) collected by main.js and consumed by the reader pages; empty in headless runs.
export const wheelInput = { dy: 0 };
const DEMO_MATCHES = 1, AUTO_LEVEL = 0, AUTO_LIMIT = 24, ACT_SECS = 3, TOTAL = 2 * BATCHES * INNINGS, SEAT_TAP = 50, RUNNER_TAP = 52;
const SHOT_INPUT = { pointer: { pressed: false, down: false, x: 0, y: 0 }, keys: { pressed: new Set(), down: new Set() } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const roleOf = (n) => (n % (2 * BATCHES) < BATCHES ? 'chase' : 'run');

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, level: 0, sound: true, calm: false, textScaleIdx: 0, left: false, guide: true,
    stage: 'intro', stageT: 0, role: 'chase', b: newBatch(rng, { level: 0, mode: 'chase', index: 0 }), match: null, freeze: 0,
    fx: [], msg: null, menu: false, hintsLeft: HINTS, hint: null, shake: { x: 0, y: 0, a: 0 }, stats: { matches: 0, wins: 0, best: 0 },
    scroll: 0, back: 'title', endWait: 0, demoMode: config.demo === true, dev: config.dev === true, demoMatches: 0,
    autoThinkIdx: 1, auto: null, lkDown: false, demo: { b: null, wait: 0, n: 0 }, restoreMsg: '', restoreBusy: false, owned: false,
  };
  const PRODUCT = 'unlock_game';
  state.owned = !!monetization.owns?.(PRODUCT);
  monetization.onChange?.(() => { state.owned = !!monetization.owns(PRODUCT); });
  const lay = () => layoutFor(meta.width, meta.height, state.left);
  let sounds = 0, drag = false;

  storage.get('prefs', null).then((v) => {
    if (!v) return;
    for (const k of ['level', 'sound', 'calm', 'left', 'guide']) if (v[k] !== undefined) state[k] = v[k];
    state.level = clamp(state.level | 0, 0, LEVELS.length - 1);
    if (v.textScaleIdx !== undefined) state.textScaleIdx = clamp(v.textScaleIdx | 0, 0, TEXT_SCALES.length - 1);
    if (v.autoThinkIdx !== undefined) state.autoThinkIdx = clamp(v.autoThinkIdx | 0, 0, AUTO_THINK_STEPS.length - 1);
    audio.setMuted?.(!state.sound);
  });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v }; });
  storage.get('demoMatches', 0).then((v) => { state.demoMatches = Math.max(state.demoMatches, v); });
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, textScaleIdx: state.textScaleIdx, left: state.left, guide: state.guide, autoThinkIdx: state.autoThinkIdx });
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { matches: state.stats.matches, wins: state.stats.wins }); };

  const say = (text, hold = 4) => { state.msg = { text, t: 0, hold }; };
  // Every sound funnels through this one helper (audible in Auto Play too).
  const tone = (o) => { if (state.sound && sounds < 4 && state.scene !== 'title') { sounds++; audio.tone(o); } };
  const dur = (d) => (state.calm ? d * 0.6 : d);

  // ---------------------------------------------------------------- starting things
  const newMatch = () => ({ n: 0, me: 0, them: 0, meT: 0, themT: 0, segs: [], over: null });
  function beginBatch() {
    const m = state.match, role = roleOf(m.n);
    state.role = role;
    state.b = newBatch(rng, { level: state.level, mode: role === 'chase' ? 'chase' : 'defend', index: m.n % BATCHES, inning: Math.floor(m.n / (2 * BATCHES)) });
    state.fx = []; state.msg = null; state.menu = false; state.hint = null; state.freeze = 0;
    state.stage = 'intro'; state.stageT = 0; state.endWait = 0; drag = false;
  }
  function startMatch() {
    if (config.demo && state.demoMatches >= DEMO_MATCHES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoMatches += 1; storage.set('demoMatches', state.demoMatches); }
    state.scene = 'play'; state.match = newMatch(); state.hintsLeft = HINTS; state.auto = null;
    beginBatch(); monetization.track('match_start', { level: state.level });
  }
  const autoThinkSecs = () => AUTO_THINK_STEPS[state.autoThinkIdx];
  function startAuto() {
    state.scene = 'auto'; state.match = newMatch(); state.role = 'chase'; state.auto = { sub: 'idle', timer: 0, paused: false, dec: null, what: '', khos: 0 };
    state.b = newBatch(rng, { level: AUTO_LEVEL, mode: 'auto', index: 0 }); state.b.limit = AUTO_LIMIT;
    state.fx = []; state.msg = null; state.menu = false; state.hint = null; state.freeze = 0;
    state.stage = 'intro'; state.stageT = 0; state.endWait = 0;
  }
  function leaveToTitle() { state.scene = 'title'; state.auto = null; state.menu = false; state.stage = 'intro'; state.fx = []; state.msg = null; state.hint = null; state.freeze = 0; }

  // ---------------------------------------------------------------- effects and sound from the engine's event log
  function consume(b) {
    for (const e of b.ev) {
      if (e.t === 'tag') {
        tone({ freq: 360, to: 110, dur: 0.16, type: 'square', vol: 0.06 });
        state.fx.push({ type: 'ring', x: e.x, y: e.y, t: 0, dur: dur(0.6), s: 1.5 });
        state.fx.push({ type: 'pop', text: state.role === 'chase' ? 'Touched!' : 'Caught!', color: state.role === 'chase' ? '#9ff5e6' : '#ff9a80', x: e.x, y: e.y, t: 0, dur: dur(1.1) });
        state.fx.push({ type: 'flash', t: 0, dur: dur(0.35) });
        for (let k = 0; k < 8; k++) state.fx.push({ type: 'dust', x: e.x, y: e.y, vx: (rng.next() - 0.5) * 240, vy: (rng.next() - 0.5) * 200, t: 0, dur: dur(0.6) });
        for (let k = 0; k < 6; k++) state.fx.push({ type: 'star', x: e.x, y: e.y, vx: (rng.next() - 0.5) * 300, vy: -100 - rng.next() * 140, t: 0, dur: dur(0.9), color: ['#ffcf5a', '#ff8a50', '#46e6d4'][k % 3] });
        if (!state.calm) state.shake.a = 7;
      } else if (e.t === 'kho') {
        tone({ freq: 620, to: 880, dur: 0.1, type: 'triangle', vol: 0.09 });
        tone({ freq: 440, to: 330, dur: 0.18, type: 'triangle', vol: 0.07 });
        state.fx.push({ type: 'ring', x: e.x, y: e.y, t: 0, dur: dur(0.5), s: 1.1 });
        state.fx.push({ type: 'pop', text: 'KHO!', color: '#46e6d4', x: e.x, y: e.y, t: 0, dur: dur(0.9) });
      }
    }
    b.ev.length = 0;
  }
  function updateFx(dt) {
    for (const f of state.fx) f.t += dt;
    state.fx = state.fx.filter((f) => f.t < f.dur);
    if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
    if (state.hint) state.hint.t += dt;
    const s = state.shake; s.a *= Math.pow(0.02, dt); if (s.a < 0.2) s.a = 0; s.x = Math.sin(state.t * 83) * s.a; s.y = Math.cos(state.t * 71) * s.a * 0.6;
  }
  // advance the court by dt of real time, in fixed small steps
  function runSim(b, dt) {
    let left = Math.min(dt, 0.05);
    while (left > 1e-6) { const d = Math.min(left, 1 / 60); step(b, d); left -= d; }
    consume(b);
  }

  // ---------------------------------------------------------------- the human's moves
  function khoNearest() {
    const b = state.b, ls = legalSeats(b);
    if (!ls.length) { say('Get to the back of a seated player first: the side he is not facing.', 3.5); return false; }
    let best = ls[0];
    for (const j of ls) if (Math.abs(SEAT_Y[j] - b.active.y) < Math.abs(SEAT_Y[best] - b.active.y)) best = j;
    return giveKho(b, best);
  }
  function askHint() {
    const b = state.b;
    if (state.stage !== 'live' || b.result || state.freeze > 0) return;
    if (state.hintsLeft <= 0) { say('No hints left in this match.'); return; }
    const plan = advise(b);
    if (!plan) return;
    state.hint = { plan, t: 0 }; state.freeze = HINT_FREEZE; state.hintsLeft -= 1;
    if (plan.kind === 'kho') say(`Run to the back of seat ${plan.seat + 1} and give Kho. The gold ring shows it.`, 4);
    else if (plan.kind === 'chase') say(plan.rid >= 0 ? `Run at runner ${plan.rid + 1}. The gold dots show the path.` : 'Run on to the pole: you must turn there.', 4);
    else say('Slip away to the marked spot.', 4);
  }
  function updateHumanPlay(input, tap) {
    const b = state.b, P = lay().play(state.scene), L = lay(), p = input.pointer, keys = input.keys;
    if (tap) {
      if (inRect(P.btn.menu, tap.x, tap.y)) { state.menu = true; drag = false; return; }
      if (inRect(P.btn.hint, tap.x, tap.y)) { askHint(); return; }
      if (inRect(P.btn.act, tap.x, tap.y)) { if (state.role === 'chase') khoNearest(); else nextRunner(b); return; }
    }
    if (keys.pressed.has('KeyH')) askHint();
    if (state.freeze > 0) return;
    const a = b.active;
    if (state.role === 'chase') {
      if (keys.pressed.has('Space') || keys.pressed.has('KeyK')) khoNearest();
    } else {
      for (let i = 0; i < RUNNERS; i++) if (keys.pressed.has('Digit' + (i + 1))) selectRunner(b, i);
      if (keys.pressed.has('Tab') || keys.pressed.has('Space')) nextRunner(b);
    }
    const kx = (keys.down.has('ArrowRight') ? 1 : 0) - (keys.down.has('ArrowLeft') ? 1 : 0), ky = (keys.down.has('ArrowDown') ? 1 : 0) - (keys.down.has('ArrowUp') ? 1 : 0);
    if (kx || ky) { const me = state.role === 'chase' ? a : b.runners[b.sel]; setTarget(b, me.x + kx * 70, me.y + ky * 70); }
    if (p.pressed && inRect(P.area, p.x, p.y)) {
      const c = L.toCourt(P, p.x, p.y);
      drag = true;
      if (state.role === 'chase') {
        const hit = legalSeats(b).find((j) => Math.hypot(c.x - COURT.spine, c.y - SEAT_Y[j]) < SEAT_TAP);
        if (hit != null) { giveKho(b, hit); drag = false; } else setTarget(b, c.x, c.y);
      } else {
        let best = null, bd = RUNNER_TAP;
        // the figures stand up from their feet: a tap on the body lands a little "up the screen" from the ground point
        const bx = P.rot ? 38 : 0, by = P.rot ? 0 : 38;
        for (const r of b.runners) if (!r.out) { const d = Math.min(Math.hypot(r.x - c.x, r.y - c.y), Math.hypot(r.x - c.x - bx, r.y - c.y - by)); if (d < bd) { bd = d; best = r; } }
        if (best) { selectRunner(b, best.id); drag = false; } else setTarget(b, c.x, c.y);
      }
    } else if (drag && p.down) {
      const c = L.toCourt(P, p.x, p.y);
      setTarget(b, c.x, c.y);
    }
    if (!p.down) drag = false;
  }

  // ---------------------------------------------------------------- the clock of a batch (shared by play and Auto Play)
  function afterSim(dt) {
    const b = state.b;
    if (b.result) {
      state.endWait += dt;
      if (state.endWait > dur(0.9) && state.stage === 'live') { state.stage = 'result'; finishBatch(); }
    }
  }
  function finishBatch() {
    const m = state.match, b = state.b, role = state.role;
    if (state.scene === 'auto') { m.over = { me: b.outs, them: 0 }; return; }
    m.segs.push({ role, outs: b.outs, time: b.timeSum });
    if (role === 'chase') { m.me += b.outs; m.meT += b.timeSum; } else { m.them += b.outs; m.themT += b.timeSum; }
    m.n += 1;
    if (m.n >= TOTAL) {
      const win = m.me > m.them || (m.me === m.them && m.meT > 0 && m.themT > 0 && m.meT < m.themT);
      m.over = { me: m.me, them: m.them, win, draw: !win && m.me === m.them };
      state.stats.matches += 1; if (win) state.stats.wins += 1; state.stats.best = Math.max(state.stats.best, m.me);
      monetization.track('match_end', { me: m.me, them: m.them, level: state.level });
      saveStats();
      tone({ freq: win ? 520 : 300, to: win ? 900 : 220, dur: 0.45, type: 'triangle', vol: 0.1 });
    }
  }
  function resultTap(tap) {
    const D = lay().dialog(state.stage === 'over' ? 'over' : 'round');
    if (inRect(D.btns[0], tap.x, tap.y)) {
      if (state.stage === 'over') { if (state.scene === 'auto') startAuto(); else startMatch(); }
      else if (state.match.over) state.stage = 'over';
      else beginBatch();
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
      if (state.stageT > dur(1.9) || (tap && state.stageT > 0.4)) {
        state.stage = 'live'; state.stageT = 0;
        say(state.role === 'chase' ? 'Tap or drag to run. Glowing seats: tap one to give Kho.' : 'Tap a runner to pick it, then tap the court to send it.', 5);
      }
      return;
    }
    if (state.stage === 'result' || state.stage === 'over') { if (tap) resultTap(tap); return; }
    if (!state.b.result) {
      updateHumanPlay(input, tap);
      if (state.menu) return;
      if (state.freeze > 0) { state.freeze = Math.max(0, state.freeze - dt); if (state.freeze === 0) state.hint = null; }
      else runSim(state.b, dt);
    }
    afterSim(dt);
  }

  // ---------------------------------------------------------------- Auto Play ("Watch & Learn")
  // The computer chases. Every decision runs THINK (the configurable pause, the court held still) -> REVEAL (the choice is shown)
  // -> ACT (the court runs for a few seconds with that choice). Pause freezes everything.
  const describe = (d) => (d.kind === 'kho' ? `Give Kho at seat ${d.seat + 1}` : d.rid >= 0 ? `Chase runner ${d.rid + 1}` : 'Run to the pole');
  function autoDecide() {
    const A = state.auto, d = planChaser(state.b);
    A.dec = d; A.what = describe(d); A.sub = 'think'; A.timer = 0;
  }
  function autoAct() {
    const A = state.auto, b = state.b;
    b.plan = { ...A.dec }; b.planT = ACT_SECS + 1; A.sub = 'act'; A.timer = 0; A.khos = b.khos;
  }
  function updateAuto(dt, tap, input) {
    const A = state.auto, P = lay().play('auto');
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
    if (state.stage === 'intro') { state.stageT += dt; if (state.stageT > dur(1.9)) state.stage = 'live'; return; }
    if (state.stage !== 'live') return;
    const b = state.b;
    if (b.result) { afterSim(dt); return; }
    if (A.sub === 'act') {
      runSim(b, dt); A.timer += dt;
      if (b.result) { afterSim(0); return; }
      if (A.timer >= ACT_SECS || b.khos > A.khos) { A.sub = 'idle'; A.timer = 0; b.plan = null; b.planT = 0; }
      return;
    }
    if (A.sub === 'think') { A.timer += dt; if (A.timer >= autoThinkSecs()) { A.sub = 'reveal'; A.timer = 0; } return; }
    if (A.sub === 'reveal') { A.timer += dt; if (A.timer >= AUTO_REVEAL_SECS) autoAct(); return; }
    autoDecide();
  }

  // ---------------------------------------------------------------- title attract mode: a real batch, played by the computer
  function updateDemo(dt) {
    const d = state.demo;
    updateFx(dt);
    if (!d.b) { d.b = newBatch(rng, { level: 1, mode: 'auto', index: d.n % 2, inning: d.n }); d.n += 1; d.wait = 0; return; }
    if (d.b.result) { d.wait += dt; if (d.wait > 2.2) d.b = null; return; }
    let left = Math.min(dt, 0.05);
    while (left > 1e-6) { const s = Math.min(left, 1 / 60); step(d.b, s); left -= s; }
    d.b.ev.length = 0;
  }
  function updateTitle(dt, tap, input0) {
    updateDemo(dt);
    const LT = lay().title().lockTap; state.lkDown = !!(input0 && input0.pointer.down && inRect(LT, input0.pointer.x, input0.pointer.y));
    if (tap && inRect(LT, tap.x, tap.y)) { env.openArcforgeHome?.(); return; }
    if (!tap) return;
    const B = lay().title().rows, hit = (r) => r && inRect(r, tap.x, tap.y);
    if (hit(B.play)) startMatch();
    else if (hit(B.level)) { state.level = (state.level + 1) % LEVELS.length; savePrefs(); tone({ freq: 500, to: 300, dur: 0.06, type: 'triangle', vol: 0.06 }); }
    else if (hit(B.howto)) { state.scene = 'howto'; state.scroll = 0; } else if (hit(B.about)) { state.scene = 'about'; state.scroll = 0; }
    else if (hit(B.rules)) { state.scene = 'rules'; state.scroll = 0; } else if (hit(B.settings)) { state.back = 'title'; state.scene = 'settings'; }
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
    if (input.keys.down.has('ArrowDown')) setS(state.scroll + 12);
    if (input.keys.down.has('ArrowUp')) setS(state.scroll - 12);
    const kp = input.keys.pressed;
    if (kp.has('PageDown') || kp.has('Space')) setS(state.scroll + RD.viewport.h * 0.85);
    if (kp.has('PageUp')) setS(state.scroll - RD.viewport.h * 0.85);
    if (kp.has('Home')) setS(0);
    if (kp.has('End')) setS(1e9);
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
  // Settings > Restore purchase: busy / restored / not found / store unreachable, all shown on the row itself.
  function restorePurchase() {
    if (state.owned || state.restoreBusy || !monetization.restore) return;
    state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
    monetization.restore().then(() => {
      state.owned = !!monetization.owns(PRODUCT);
      state.restoreMsg = state.owned ? 'Purchase restored' : 'No earlier purchase found';
    }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
  }
  function updateSettings(tap) {
    if (!tap) return;
    const SET = lay().settings;
    if (inRect(SET.done, tap.x, tap.y)) { const bk = state.back; state.scene = bk === 'title' ? 'title' : bk; if (state.scene !== 'title') state.menu = true; savePrefs(); return; }
    const i = (state.demoMode ? SET.rows5 : SET.rows).findIndex((r) => inRect(r, tap.x, tap.y)); if (i < 0) return;
    if (i === 0) { state.sound = !state.sound; audio.setMuted?.(!state.sound); } else if (i === 1) state.calm = !state.calm; else if (i === 2) state.textScaleIdx = (state.textScaleIdx + 1) % TEXT_SCALES.length; else if (i === 3) state.left = !state.left;
    else if (i === 4) state.guide = !state.guide; else if (i === 5 && !state.demoMode) restorePurchase();
    savePrefs(); tone({ freq: 520, to: 380, dur: 0.05, type: 'triangle', vol: 0.06 });
  }

  return {
    update(dt, input0) {
      let input = input0;
      if (config.shot === true) {   // store screenshots: a scripted scene (by seed), played by the computer, never by random taps
        input = SHOT_INPUT;
        if (!state.shotDone) {
          state.shotDone = true; const sd = Number(config.shotSeed);
          if (sd === 4 || sd === 5) {
            state.guide = false; startMatch();
            if (sd === 5) { state.match.n = 2; beginBatch(); }
            state.b.mode = 'auto'; state.stage = 'live'; state.stageT = 0; state.msg = null;
          } else if (sd === 13) { state.autoThinkIdx = 0; startAuto(); }
        }
      }
      state.t += dt; sounds = 0;
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'title') updateTitle(dt, tap, input);
      else if (sc === 'play') updatePlay(dt, input, tap);
      else if (sc === 'settings') updateSettings(tap);
      else if (sc === 'howto' || sc === 'rules' || sc === 'about') updateReader(input, tap);
      else if (sc === 'demo-limit') { if (tap && inRect(lay().demo.back, tap.x, tap.y)) state.scene = 'title'; }
      else if (sc === 'auto') updateAuto(dt, tap, input);
    },
    render(ctx, view) {
      // keep the kit's preview pill off the court in landscape: park it at the foot of the info column
      if (state.scene === 'play' && meta.width > meta.height) { const P = lay().play('play'); meta.previewBadge = P.info ? { x: P.info.x + 14, y: P.info.y + P.info.h - 30, align: 'left' } : undefined; } else meta.previewBadge = undefined;
      render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height, state.left));
    },
    getState: () => state,
    // The preview clock counts real play only: a live batch of a real match. Menu, Rules / How to Play / About, Settings, the pause
    // menu, hints, Auto Play (a free teaching demo), banners and result cards are all free time.
    isPreviewExempt: () => state.menu || state.freeze > 0 || !(state.scene === 'play' && state.stage === 'live'),
  };
}
export { BATCHES, INNINGS };
