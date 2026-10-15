// Bentengan: state and flow. Drawing is view.js; engine.js is the rule book and simulation; pages.js the text.
// Controls (taught on the How to play page): TAP a player to pick him, TAP the field to send him, TAP a rival to chase, TAP the rival
// pole to run for it, TAP your jail to free prisoners, TAP your fort to come home. Switch picks the next player.
import { inRect, layoutFor, glHook, TEXT_SCALES, AUTO_THINK_STEPS, AUTO_REVEAL_SECS } from './layout.js';
import {
  newRound, step, setGoal, goalTarget, aiPlan, hintFor, newMatch, bookRound, jailedOf, teamOf, LEVELS, POLE, JAIL, FORT_R, JAIL_R, TEAM_SIZE,
  ROUND_TIME, AUTO_ROUND_TIME, WIN_POINTS, ROUNDS_MAX, ROLES,
} from './engine.js';
import { render, reader } from './view.js';

// `meta.width/height` are updated live by the kit on every resize; every position comes from layoutFor(meta.width, meta.height).
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_MATCHES = 2, HINTS = 3, AUTO_PERIOD = 0.6;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const SHOT_INPUT = { pointer: { pressed: false, down: false, x: 0, y: 0 }, keys: { pressed: new Set(), down: new Set() } };

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, level: 1, sound: true, calm: false, textScaleIdx: 0, left: false, guide: true,
    stage: 'intro', stageT: 0, w: null, match: null, sel: 0, fx: [], msg: null, menu: false, hintsLeft: HINTS, hint: null,
    shake: { x: 0, y: 0, a: 0 }, stats: { played: 0, wins: 0, poles: 0 }, scroll: 0, page: 0, back: 'title', endWait: 0,
    demoMode: config.demo === true, dev: config.dev === true, demoMatches: 0, autoThinkIdx: 1, auto: null, lkDown: false,
    owned: false, demo: { w: null, wait: 0 }, restore: { busy: false, msg: '' },
  };
  const lay = () => layoutFor(meta.width, meta.height, state.left);
  let sounds = 0;

  storage.get('prefs', null).then((v) => { if (v) { for (const k of ['level', 'sound', 'calm', 'left', 'guide']) if (v[k] !== undefined) state[k] = v[k]; state.level = clamp(state.level | 0, 0, LEVELS.length - 1); if (v.textScaleIdx !== undefined) state.textScaleIdx = clamp(v.textScaleIdx | 0, 0, TEXT_SCALES.length - 1); if (v.autoThinkIdx !== undefined) state.autoThinkIdx = clamp(v.autoThinkIdx | 0, 0, AUTO_THINK_STEPS.length - 1); audio.setMuted?.(!state.sound); } });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v }; });
  storage.get('demoMatches', 0).then((v) => { state.demoMatches = Math.max(state.demoMatches, v); });
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, textScaleIdx: state.textScaleIdx, left: state.left, guide: state.guide, autoThinkIdx: state.autoThinkIdx });
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.played, wins: state.stats.wins }); };

  const say = (text, hold = 4) => { state.msg = { text, t: 0, hold }; };
  // Auto Play is silent by design regardless of the player's own Sound setting; every sound funnels through this one helper.
  const tone = (o) => { if (state.sound && sounds < 4 && state.scene !== 'title') { sounds++; audio.tone(o); } };
  const dur = (d) => (state.calm ? d * 0.6 : d);
  const names = () => (state.scene === 'auto' ? { H: 'Pink', C: 'Blue' } : { H: 'You', C: 'The computer' });

  // ---------------------------------------------------------------- starting things
  function setupRound() {
    const auto = state.scene === 'auto';
    state.w = newRound(rng, { level: state.level, roundTime: auto ? AUTO_ROUND_TIME : ROUND_TIME, aiH: config.shot === true, aiC: !auto });
    state.sel = 0; state.fx = []; state.msg = null; state.menu = false; state.hint = null; state.endWait = 0; state.stage = 'intro'; state.stageT = 0;
    if (state.auto) { state.auto.sub = 'idle'; state.auto.timer = 0; state.auto.dec = null; state.auto.cool = 0; state.auto.since = 0; }
  }
  function startMatch() {
    if (config.demo && state.demoMatches >= DEMO_MATCHES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoMatches += 1; storage.set('demoMatches', state.demoMatches); }
    state.scene = 'play'; state.match = newMatch(); state.hintsLeft = HINTS; state.auto = null;
    setupRound(); monetization.track('match_start', { level: state.level });
  }
  const autoThinkSecs = () => AUTO_THINK_STEPS[state.autoThinkIdx];
  function startAuto() {
    state.scene = 'auto'; state.match = newMatch(); state.auto = { sub: 'idle', timer: 0, paused: false, dec: null, what: '', cool: 0, since: 0 };
    setupRound();
  }
  function leaveToTitle() { state.scene = 'title'; state.auto = null; state.menu = false; state.stage = 'intro'; state.w = null; state.fx = []; state.msg = null; state.hint = null; }

  // ---------------------------------------------------------------- effects and sound from the engine's event log
  function consume(w, mine) {
    for (const e of w.ev) {
      if (e.t === 'tag') {
        tone({ freq: 420, to: 140, dur: 0.22, type: 'square', vol: 0.07 });
        state.fx.push({ type: 'ring', x: e.x, y: e.y, t: 0, dur: dur(0.55), s: 1.4 });
        for (let i = 0; i < 7; i++) state.fx.push({ type: 'dust', x: e.x, y: e.y, vx: (rng.next() - 0.5) * 180, vy: (rng.next() - 0.5) * 180, t: 0, dur: dur(0.6) });
        state.fx.push({ type: 'pop', text: 'Tagged!', color: e.team === 'H' ? '#ffd0e0' : '#cdeaff', x: e.x, y: e.y, t: 0, dur: dur(1) });
        if (!state.calm) state.shake.a = Math.max(state.shake.a, 6);
      } else if (e.t === 'free') {
        tone({ freq: 440, to: 880, dur: 0.3, type: 'triangle', vol: 0.09 });
        state.fx.push({ type: 'ring', x: e.x, y: e.y, t: 0, dur: dur(0.7), s: 2 });
        state.fx.push({ type: 'pop', text: 'Freed!', color: '#fff3a0', x: e.x, y: e.y, t: 0, dur: dur(1.2) });
        if (state.scene === 'play') say(e.team === 'H' ? 'Prisoners freed. They run back to the fort.' : 'The computer freed its prisoners.', 3);
      } else if (e.t === 'leave') {
        if (mine(e.id)) tone({ freq: 300, to: 380, dur: 0.06, type: 'triangle', vol: 0.04 });
      } else if (e.t === 'home') {
        if (mine(e.id)) tone({ freq: 520, to: 420, dur: 0.07, type: 'sine', vol: 0.04 });
      } else if (e.t === 'pole') {
        tone({ freq: 520, to: 1040, dur: 0.5, type: 'triangle', vol: 0.11 });
        state.fx.push({ type: 'ring', x: e.x, y: e.y, t: 0, dur: dur(0.9), s: 3 });
        state.fx.push({ type: 'pop', text: 'Pole!', color: '#fff3a0', x: e.x, y: e.y + (e.team === 'H' ? 60 : -20), t: 0, dur: dur(1.4) });
      }
    }
    w.ev.length = 0;
  }
  function updateFx(dt) {
    for (const f of state.fx) f.t += dt;
    state.fx = state.fx.filter((f) => f.t < f.dur);
    if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
    const s = state.shake; s.a *= Math.pow(0.02, dt); if (s.a < 0.2) s.a = 0; s.x = Math.sin(state.t * 83) * s.a; s.y = Math.cos(state.t * 71) * s.a * 0.6;
  }

  // ---------------------------------------------------------------- the human's input
  const mineId = (id) => state.scene === 'play' && !!state.w && !!state.w.players[id] && state.w.players[id].team === 'H';
  const pickable = (p) => !!p && p.team === 'H' && (p.st === 'fort' || p.st === 'out');
  function nextPlayer(from) {
    const mine = teamOf(state.w, 'H');
    for (let i = 1; i <= TEAM_SIZE; i++) { const p = mine[(from + i) % TEAM_SIZE]; if (pickable(p)) return p.id; }
    return from;
  }
  const goalLabel = (g) => (g.kind === 'chase' ? 'chase a rival' : g.kind === 'pole' ? 'run at the rival pole' : g.kind === 'jail' ? 'free the prisoners' : g.kind === 'home' ? 'go home' : 'move');
  function applyHint(h) {
    if (!h) return;
    const p = state.w.players[h.id];
    state.sel = h.id; setGoal(state.w, h.id, h.goal); state.hint = null; say(`${ROLES[p.k]} will ${goalLabel(h.goal)}.`, 2.5);
  }
  const hintPoint = (h) => goalTarget(state.w, { ...state.w.players[h.id], goal: h.goal });
  function askHint() {
    const w = state.w;
    if (state.stage !== 'live' || w.result) return;
    if (state.hint) { applyHint(state.hint); return; }
    if (state.hintsLeft <= 0) { say('No hints left in this match.'); return; }
    const h = hintFor(w, 'H', rng);
    if (!h) { say('Nothing to change now. Wait a moment.', 4); return; }
    state.hintsLeft -= 1; state.hint = { id: h.id, goal: h.goal, why: h.why }; state.sel = h.id;
    say(`${h.why}. Tap the glow or Hint again.`, 6);
  }
  function humanTap(tap, P) {
    const w = state.w, c = lay().toCourt(P, tap.x, tap.y);
    const g = glHook.gl && glHook.gl.on && glHook.gl.kind === state.scene ? glHook.gl : null;
    // distance (in court units) from the tap to a figure: in 3D the figure's body (0.9 m up) on the screen, so tapping a torso or a head works
    const near = (p) => { if (!g) return dist(c.x, c.y, p.x, p.y); const b = g.project(p.x, p.y, 0.9), k = Math.max(1e-6, g.scaleAt(p.x, p.y)); return Math.hypot(tap.x - b.x, tap.y - b.y) / k; };
    // 1) the hint marker
    if (state.hint) { const tp = hintPoint(state.hint); if (tp && dist(c.x, c.y, tp.x, tp.y) < 70) { applyHint(state.hint); return; } }
    // 2) pick one of my players
    // hit slop: never smaller than ~26 css px around a figure, however small the screen scales the field
    const cssPerUnit = g ? g.scaleAt(w.players[state.sel]?.x ?? 360, w.players[state.sel]?.y ?? 480) * lay().px : lay().px * P.f;
    const sl = Math.max(1, Math.min(1.7, 26 / (cssPerUnit * 50)));
    let best = null, bd = 50 * sl;
    for (const p of teamOf(w, 'H')) if (pickable(p)) { const d = near(p); if (d < bd) { bd = d; best = p; } }
    if (best) { state.sel = best.id; state.hint = null; tone({ freq: 520, to: 640, dur: 0.05, type: 'triangle', vol: 0.05 }); return; }
    const sel = w.players[state.sel];
    if (!pickable(sel)) { state.sel = nextPlayer(state.sel); return; }
    state.hint = null;
    // 3) a rival in the open, a pole, a jail, the fort, or just a place
    let foe = null; bd = 46 * sl;
    for (const e of teamOf(w, 'C')) if (e.st === 'out') { const d = near(e); if (d < bd) { bd = d; foe = e; } }
    if (foe) { setGoal(w, sel.id, { kind: 'chase', id: foe.id }); tone({ freq: 360, to: 460, dur: 0.06, type: 'triangle', vol: 0.05 }); return; }
    const nearPt = (X, Y, h) => { const d0 = dist(c.x, c.y, X, Y); if (!g) return d0; const b = g.project(X, Y, h), k = Math.max(1e-6, g.scaleAt(X, Y)); return Math.min(d0, Math.hypot(tap.x - b.x, tap.y - b.y) / k); };
    if (nearPt(POLE.C.x, POLE.C.y, 1.5) < 56 * sl) { setGoal(w, sel.id, { kind: 'pole' }); return; }
    if (dist(c.x, c.y, JAIL.H.x, JAIL.H.y) < JAIL_R + 18) { if (jailedOf(w, 'H').length) setGoal(w, sel.id, { kind: 'jail' }); else say('Nobody of yours is in jail.', 2.5); return; }
    if (dist(c.x, c.y, POLE.H.x, POLE.H.y) < FORT_R) { setGoal(w, sel.id, { kind: 'home' }); return; }
    setGoal(w, sel.id, { kind: 'point', x: clamp(c.x, 40, 680), y: clamp(c.y, 100, 860) });
  }
  function updateHumanPlay(input, tap) {
    const w = state.w, P = lay().play(state.scene), keys = input.keys.pressed;
    if (tap) {
      if (inRect(P.btn.menu, tap.x, tap.y)) { state.menu = true; return; }
      if (inRect(P.btn.hint, tap.x, tap.y)) { askHint(); return; }
      if (inRect(P.btn.act, tap.x, tap.y)) { state.sel = nextPlayer(state.sel); state.hint = null; return; }
      if (inRect(P.area, tap.x, tap.y)) humanTap(tap, P);
    }
    if (keys.has('KeyH')) askHint();
    if (keys.has('Space') || keys.has('Tab')) { state.sel = nextPlayer(state.sel); state.hint = null; }
    for (let k = 0; k < TEAM_SIZE; k++) if (keys.has('Digit' + (k + 1)) && pickable(w.players[k])) { state.sel = k; state.hint = null; }
    if (!pickable(w.players[state.sel])) state.sel = nextPlayer(state.sel);
  }

  // ---------------------------------------------------------------- Auto Play ("Watch & Learn")
  // Both teams are the computer. Every decision runs THINK (the configurable pause, the world held still) -> REVEAL (the choice is
  // shown: the player, his target and why) -> ACT (played through the same engine call a human tap makes). Pause freezes everything.
  const RANK = { pole: 5, rescue: 4, flee: 4, chase: 3, launch: 3, home: 1 };
  function autoDecide(w) {
    const A = state.auto;
    A.since = 0;
    const cand = [];
    for (const team of ['H', 'C']) for (const pl of aiPlan(w, team, rng, true)) cand.push({ ...pl, team });
    // quiet changes (heading back to refresh) are played without a decision
    for (const c of cand) if (c.kind === 'home') setGoal(w, c.id, c.goal);
    const sig = cand.filter((c) => c.kind !== 'home').sort((a, b) => RANK[b.kind] - RANK[a.kind] || a.id - b.id);
    if (!sig.length) return false;
    const c = sig[0], nm = names();
    A.dec = { id: c.id, goal: c.goal, why: c.why, kind: c.kind, team: c.team }; A.what = `${nm[c.team]}: ${ROLES[w.players[c.id].k]}`;
    A.sub = 'think'; A.timer = 0; state.sel = c.id; return true;
  }
  function autoAct() {
    const A = state.auto, d = A.dec; A.dec = null; A.sub = 'idle'; A.timer = 0; A.cool = 0.5; state.hint = null;
    if (d) setGoal(state.w, d.id, d.goal);
  }
  function updateAuto(dt, tap, input) {
    const A = state.auto, P = lay().play('auto');
    if (!A) return;
    updateFx(A.paused ? 0 : dt);
    const w = state.w;
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
    if (A.sub === 'think') {
      A.timer += dt;
      if (A.timer >= autoThinkSecs()) { A.sub = 'reveal'; A.timer = 0; state.hint = { id: A.dec.id, goal: A.dec.goal, why: A.dec.why }; }
      return;
    }
    if (A.sub === 'reveal') { A.timer += dt; if (A.timer >= AUTO_REVEAL_SECS) autoAct(); return; }
    A.cool = Math.max(0, A.cool - dt); A.since += dt;
    if (!w.result && A.cool <= 0 && A.since >= AUTO_PERIOD && autoDecide(w)) return;
    runRound(dt);
  }

  // ---------------------------------------------------------------- the round clock (shared)
  function runRound(dt) {
    const w = state.w;
    step(w, rng, dt); consume(w, mineId);
    if (w.result) {
      state.endWait += dt;
      if (state.endWait > dur(0.9)) { state.stage = 'result'; finishRound(); }
    }
    if (state.hint && state.scene === 'play' && !pickable(w.players[state.hint.id])) state.hint = null;
  }
  function finishRound() {
    const m = state.match, w = state.w;
    bookRound(m, w);
    if (state.scene === 'auto' && !m.over) m.over = { winner: m.score.H > m.score.C ? 'H' : m.score.C > m.score.H ? 'C' : 'draw' };
    if (state.scene === 'play') {
      if (w.result.kind === 'pole' && w.result.winner === 'H') state.stats.poles += 1;
      if (m.over) { state.stats.played += 1; if (m.over.winner === 'H') state.stats.wins += 1; saveStats(); monetization.track('match_end', { winner: m.over.winner, h: m.score.H, c: m.score.C, level: state.level }); }
      tone({ freq: w.result.winner === 'H' ? 520 : 300, to: w.result.winner === 'H' ? 900 : 220, dur: 0.45, type: 'triangle', vol: 0.1 });
    }
  }
  function resultTap(tap) {
    const D = lay().dialog(state.stage === 'over' ? 'over' : 'inning');
    if (inRect(D.btns[0], tap.x, tap.y)) {
      if (state.stage === 'over') { if (state.scene === 'auto') startAuto(); else startMatch(); }
      else if (state.match.over) state.stage = 'over';
      else setupRound();
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
      if (state.stageT > dur(1.7) || (tap && state.stageT > 0.4)) { state.stage = 'live'; state.stageT = 0; say('Tap a player, then tap where to go.', 6); }
      return;
    }
    if (state.stage === 'result' || state.stage === 'over') { if (tap) resultTap(tap); return; }
    updateHumanPlay(input, tap);
    if (state.menu) return;
    runRound(dt);
  }

  // ---------------------------------------------------------------- title attract mode: a real round, played by the computer
  function updateDemo(dt) {
    const d = state.demo;
    updateFx(dt);
    if (!d.w) { d.w = newRound(rng, { level: 1, aiH: true, aiC: true }); d.wait = 0; return; }
    if (d.w.result) { d.wait += dt; if (d.wait > 2.2) d.w = null; return; }
    step(d.w, rng, dt); consume(d.w, () => false);
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
  // Restore purchase (Settings): never shown in the web demo; clear busy / restored / not found / failed messages.
  function doRestore() {
    const R = state.restore;
    if (state.demoMode || R.busy || monetization.owns?.('unlock_game')) return;
    R.busy = true; R.msg = '';
    Promise.resolve(monetization.restore?.())
      .then(() => { R.msg = monetization.owns?.('unlock_game') ? 'Restored' : 'Not found'; })
      .catch(() => { R.msg = 'Store busy'; })
      .then(() => { R.busy = false; });
  }
  function updateSettings(tap) {
    if (!tap) return;
    const SET = lay().settings;
    if (inRect(SET.done, tap.x, tap.y)) { const b = state.back; state.scene = b === 'title' ? 'title' : b; if (state.scene !== 'title') state.menu = true; savePrefs(); return; }
    const i = SET.rows.findIndex((r) => inRect(r, tap.x, tap.y)); if (i < 0) return;
    if (i === 0) { state.sound = !state.sound; audio.setMuted?.(!state.sound); } else if (i === 1) state.calm = !state.calm; else if (i === 2) state.textScaleIdx = (state.textScaleIdx + 1) % TEXT_SCALES.length; else if (i === 3) state.left = !state.left;
    else if (i === 4) state.guide = !state.guide; else if (i === 5) { doRestore(); return; }
    savePrefs(); tone({ freq: 520, to: 380, dur: 0.05, type: 'triangle', vol: 0.06 });
  }

  return {
    update(dt, input0) {
      let input = input0;
      if (config.shot === true) {   // store screenshots: a scripted scene (by seed), played by the computer, never by random taps
        input = SHOT_INPUT;
        if (!state.shotDone) {
          state.shotDone = true; const sd = Number(config.shotSeed);
          if (sd === 4) startMatch(); else if (sd === 13) startAuto();
        }
      }
      state.t += dt; sounds = 0; state.owned = monetization.owns?.('unlock_game') === true;
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'title') updateTitle(dt, tap, input);
      else if (sc === 'play') updatePlay(dt, input, tap);
      else if (sc === 'settings') updateSettings(tap);
      else if (sc === 'howto' || sc === 'rules' || sc === 'about') updateReader(input, tap);
      else if (sc === 'demo-limit') { if (tap && inRect(lay().demo.back, tap.x, tap.y)) state.scene = 'title'; }
      else if (sc === 'auto') updateAuto(dt, tap, input);
    },
    render(ctx, view) {
      // the 3D layer (web/view3d) draws behind this transparent canvas: clear it, and publish its camera for the pointer mapping
      ctx.clearRect(0, 0, view?.width ?? meta.width, view?.height ?? meta.height);
      glHook.gl = view?.gl ?? null;
      if (view?.gl?.licenses) state.lic = view.gl.licenses;
      render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height, state.left), view?.gl ?? null);
    },
    getState: () => state,
    devTools: config.dev ? { startAuto: () => startAuto(), startMatch: () => startMatch(), state } : undefined,   // tester tools: the motion measurement script
    // The preview clock counts real play only: a live round of a real match. Menus, the pages, Settings, the pause menu, Auto Play
    // (a free teaching demo), banners and result cards are all free time.
    isPreviewExempt: () => state.menu || !(state.scene === 'play' && state.stage === 'live'),
  };
}
export { ROUNDS_MAX, WIN_POINTS };
