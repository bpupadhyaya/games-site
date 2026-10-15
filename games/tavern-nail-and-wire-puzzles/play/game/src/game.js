// Tavern Nail and Wire Puzzles: state and flow. Rules = wire.js, levels = levels.js, picture = scene.js + view.js, geometry = layout.js.
import { playLayout, titleLayout, docLayout, settingsLayout, levelsLayout, overLayout, pauseLayout, inRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { SLIDES, otherKeys, otherSegs, trySlide, tryTurn, isClear, solveOne } from './wire.js';
import { LEVELS, DAILY, TIER_NAMES, tierOf, rulesFor } from './levels.js';
import { render, metrics, SETTINGS, settingsRows, sceneOf } from './view.js';
import { DOCS } from './content.js';
import { setLook, LOOK_IDS } from './ui.js';
import { newCamera, orbit, makeView, setup, proj, pickPiece } from './scene.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen; everything lays out from the live size.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_PUZZLES = 3;
const DEFAULT_PREFS = { look: 'taproom', guides: true, sound: true, calm: false, textIdx: 0, thinkIdx: 1 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SLIDE_T = 0.15, TURN_T = 0.26;
const AXIS = ['X', 'Y', 'Z'], AXIS_COLOUR = ['red', 'green', 'blue'];
const KIND_NAME = { ring: 'ring', lring: 'bent ring', hook: 'hook', nail: 'nail', bar: 'pin' };

export function createGame(env) {
  const { storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS },
    P: null, sel: 0, hint: null, paused: false, auto: { on: false, phase: null, timer: 0, paused: false, n: 0, done: false }, autoText: '', thinkSecs: 5,
    msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0 }, back: 'title', result: null, winT: 0, winDelay: 0,
    stars: [], unlocked: 0, doneCount: 0, hasSave: false, playInfo: '', day: config.day ?? 0, days: [], streak: 0, dailyDone: false, dailyInfo: '',
    demoCount: 0, demo: config.demo === true, owned: !!monetization.owns?.('unlock_game'), restoreMsg: '', restoreBusy: false, dev: config.dev === true, sfx: [], tip: 0, tipsSeen: 0,
  };
  let saveRaw = null;

  // ---- persistence ------------------------------------------------------------------------------------------------------------
  const applyPrefs = () => { setLook(S.prefs.look); audio.setMuted?.(!S.prefs.sound); S.thinkSecs = THINK_STEPS[S.prefs.thinkIdx]; try { config.textScale = TEXT_SCALES[S.prefs.textIdx] ?? 1; } catch { /* config may be read-only */ } };
  monetization.onChange?.(() => { S.owned = !!monetization.owns('unlock_game'); });
  const savePrefs = () => storage.set('prefs', S.prefs);
  const saveProgress = () => storage.set('progress', { stars: S.stars, days: S.days, tips: S.tipsSeen });
  function recount() {
    S.doneCount = S.stars.filter((v) => v > 0).length;
    let u = 0; while (u < LEVELS.length - 1 && (S.stars[u] ?? 0) > 0) u += 1;
    S.unlocked = u;
    const set = new Set(S.days); let streak = 0, d = set.has(S.day) ? S.day : S.day - 1;
    while (set.has(d)) { streak += 1; d -= 1; }
    S.streak = streak; S.dailyDone = set.has(S.day);
    S.dailyInfo = S.dailyDone ? 'Done today' : streak ? `${streak} day streak` : 'New every day';
    S.playInfo = S.hasSave && saveRaw ? (saveRaw.id === 'daily' ? 'Round of the Day' : `Level ${saveRaw.id + 1}`) : `Level ${Math.min(S.unlocked, LEVELS.length - 1) + 1}`;
  }
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); if (!LOOK_IDS.includes(S.prefs.look)) S.prefs.look = 'taproom'; } applyPrefs(); });
  storage.get('progress', null).then((v) => { if (v) { S.stars = (v.stars ?? []).slice(0, LEVELS.length); S.days = (v.days ?? []).slice(-200); S.tipsSeen = v.tips | 0; } recount(); });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  storage.get('save', null).then((v) => { if (v && Array.isArray(v.poses) && S.scene === 'title' && !S.P) { saveRaw = v; S.hasSave = true; recount(); } });
  applyPrefs(); recount();

  const persist = () => {
    const P = S.P;
    if (!P || P.done || S.auto.on) return;
    saveRaw = { id: P.id, poses: P.poses.map((p) => ({ ...p })), moves: P.moves, hints: P.hints, undo: P.undo.slice(-80).map((u) => ({ p: u.p, from: { ...u.from } })) };
    S.hasSave = true; storage.set('save', saveRaw); recount();
  };
  const clearSave = () => { saveRaw = null; S.hasSave = false; storage.remove('save'); recount(); };

  // ---- sound -----------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound) audio.tone(o); };
  const later = (t, o) => S.sfx.push({ t, o });
  const sfx = {
    slide: () => tone({ freq: 330, to: 260, dur: 0.07, type: 'triangle', vol: 0.08 }),
    turn: () => { tone({ freq: 520, to: 380, dur: 0.05, type: 'square', vol: 0.045 }); later(0.1, { freq: 300, to: 260, dur: 0.06, type: 'triangle', vol: 0.07 }); },
    bump: () => tone({ freq: 150, to: 90, dur: 0.12, type: 'sawtooth', vol: 0.07 }),
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.06 }),
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.08 }),
    free: () => { [392, 494, 587, 784, 988].forEach((f, i) => later(i * 0.1, { freq: f, to: f, dur: 0.38, type: 'triangle', vol: 0.09 })); },
    clink: () => { later(0, { freq: 1320, to: 1180, dur: 0.14, type: 'sine', vol: 0.07 }); later(0.07, { freq: 1760, to: 1500, dur: 0.18, type: 'sine', vol: 0.05 }); },
  };

  // ---- helpers -----------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.2) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; wheelInput.dy = 0; S.msg = null; if (scene === 'title') recount(); }
  const L = () => playLayout(meta.width, meta.height, !!(S.hint || S.auto.on));
  const piecesClear = () => S.P.poses.map((p, i) => isClear(S.P.rules, S.P.lv.puzzle.loose[i].shape, p));
  const pieceName = (i) => { const l = S.P.lv.puzzle.loose[i]; return `${l.metal} ${KIND_NAME[l.kind] ?? 'piece'}`.trim(); };

  // ---- sessions --------------------------------------------------------------------------------------------------------------------
  function newSession(lv, id, title, sub) {
    const rules = rulesFor(lv);
    return { lv, rules, view: makeView(rules), poses: lv.puzzle.loose.map((l) => ({ ...l.pose })), moves: 0, hints: 0, undo: [], done: false, id, title, sub, cam: newCamera(), anim: null, bump: null, wasClear: null };
  }
  function begin(P) {
    S.P = P; S.hint = null; S.paused = false; S.msg = null; S.result = null; S.winT = 0; S.winDelay = 0;
    S.auto = { on: false, phase: null, timer: 0, paused: false, n: 0, done: false }; S.autoText = '';
    const c = piecesClear(); P.wasClear = c; S.sel = Math.max(0, c.findIndex((x) => !x));
    S.tip = S.tipsSeen < 2 ? 6 : 0;
    go('play');
  }
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_PUZZLES) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }
  const pieceCount = (lv) => (lv.puzzle.loose.length > 1 ? 'two loose pieces' : 'one loose piece');
  function restoreFrom(P, raw) {
    if (!raw || !Array.isArray(raw.poses) || raw.poses.length !== P.poses.length) return;
    P.poses = raw.poses.map((p) => ({ o: p.o | 0, x: p.x | 0, y: p.y | 0, z: p.z | 0 }));
    P.moves = raw.moves | 0; P.hints = raw.hints | 0; P.undo = (raw.undo ?? []).map((u) => ({ p: u.p | 0, from: { ...u.from } }));
  }
  function startLevel(n, fresh = false) {
    n = clamp(n, 0, LEVELS.length - 1);
    if (n > S.unlocked && !S.dev) { say('Free the pieces in the level before it first.'); return; }
    if (demoBlocked()) return;
    const lv = LEVELS[n], P = newSession(lv, n, `${n + 1}. ${lv.name}`, `${TIER_NAMES[tierOf(n)]}  ·  ${pieceCount(lv)}`);
    if (!fresh && saveRaw && saveRaw.id === n) restoreFrom(P, saveRaw);
    begin(P); persist();
  }
  const dailyLevel = (day) => DAILY[((day % DAILY.length) + DAILY.length) % DAILY.length];
  function startDaily() {
    if (demoBlocked()) return;
    const lv = dailyLevel(S.day), P = newSession(lv, 'daily', `Daily: ${lv.name}`, `${lv.name}  ·  ${pieceCount(lv)}`);
    if (saveRaw && saveRaw.id === 'daily') restoreFrom(P, saveRaw);
    begin(P); persist();
  }
  function playButton() {
    if (S.hasSave && saveRaw) { if (saveRaw.id === 'daily') startDaily(); else startLevel(saveRaw.id); } else startLevel(S.unlocked);
  }
  function startAuto() {
    const n = clamp(S.unlocked, 2, 8), lv = LEVELS[n];
    begin(newSession(lv, 'auto', 'Watch and Learn', `${lv.name}  ·  ${pieceCount(lv)}`));
    S.auto.on = true;
    say('Watch the game think, then slide or turn the piece.', 2.4);
  }

  // ---- moves -----------------------------------------------------------------------------------------------------------------------
  const finishAnim = () => { const P = S.P; if (P && P.anim) P.anim = null; };
  // Try one move of loose piece p. Returns true when it happened.
  function doMove(p, k, i, record = true) {
    const P = S.P;
    finishAnim();
    const shape = P.lv.puzzle.loose[p].shape, keys = otherKeys(P.rules, P.poses, p), from = P.poses[p];
    const np = k === 's' ? trySlide(P.rules, shape, from, i, keys) : tryTurn(P.rules, shape, from, i, keys, otherSegs(P.rules, P.poses, p));
    if (!np) { P.bump = { piece: p, t: 0 }; sfx.bump(); if (!S.auto.on) say(k === 's' ? 'Blocked: the wire is in the way, or the piece is at the edge of the mat.' : 'It cannot turn that way here: it would hit the wire.', 1.8); return false; }
    P.poses[p] = np;
    if (record) { P.moves += 1; P.undo.push({ p, from: { ...from } }); }
    P.anim = { piece: p, kind: k, from: { ...from }, turn: i, t: 0, dur: S.prefs.calm ? 0.001 : k === 's' ? SLIDE_T : TURN_T };
    if (k === 's') sfx.slide(); else sfx.turn();
    S.hint = null;
    return true;
  }
  function checkWin() {
    const P = S.P;
    if (P.done) return;
    const c = piecesClear();
    c.forEach((v, i) => { if (v && !(P.wasClear && P.wasClear[i])) sfx.clink(); });
    P.wasClear = c;
    if (c.every(Boolean)) win();
    else if (c[S.sel]) { const n = c.findIndex((x) => !x); if (n >= 0) S.sel = n; }
  }
  function win() {
    const P = S.P;
    P.done = true; S.hint = null; S.winT = 1.4; S.winDelay = 2.8; sfx.free();
    if (S.auto.on) { S.auto.done = true; S.auto.phase = null; S.autoText = 'Every piece is clear of the frame.'; return; }
    const par = P.lv.par, stars = P.moves <= par + Math.max(2, Math.ceil(par * 0.35)) && !P.hints ? 3 : P.moves <= par * 2 + 4 ? 2 : 1;
    const daily = P.id === 'daily';
    let first = false;
    if (!daily) { first = (S.stars[P.id] ?? 0) === 0; S.stars[P.id] = Math.max(S.stars[P.id] ?? 0, stars); }
    else if (!S.days.includes(S.day)) { S.days.push(S.day); S.days = S.days.slice(-200); }
    S.tipsSeen = Math.max(S.tipsSeen, 2);
    saveProgress(); clearSave(); recount();
    if (daily) storage.set('daily', { day: S.day, streak: S.streak });
    monetization.track('puzzle_freed', { id: String(P.id), moves: P.moves, par });
    S.result = { stars, moves: P.moves, par, hints: P.hints, daily, first, id: P.id, streak: S.streak, last: !daily && P.id >= LEVELS.length - 1, n: P.lv.puzzle.loose.length };
  }
  function doUndo() {
    const P = S.P;
    if (!P.undo.length) { say('Nothing to undo.', 1.2); return; }
    finishAnim();
    const u = P.undo.pop(); P.poses[u.p] = u.from; P.moves = Math.max(0, P.moves - 1); S.hint = null; S.sel = u.p; sfx.slide(); P.wasClear = piecesClear(); persist();
  }
  function doReset() {
    const P = S.P;
    finishAnim();
    P.poses = P.lv.puzzle.loose.map((l) => ({ ...l.pose })); P.moves = 0; P.undo = []; S.hint = null; sfx.tap(); P.wasClear = piecesClear(); persist();
  }

  // ---- hints (also drive Watch and Learn) -------------------------------------------------------------------------------------------
  const countSlides = (P, p, pose) => { const keys = otherKeys(P.rules, P.poses, p), shape = P.lv.puzzle.loose[p].shape; let n = 0; for (let i = 0; i < 6; i++) if (trySlide(P.rules, shape, pose, i, keys)) n += 1; return n; };
  function makeHint() {
    const P = S.P, clear = piecesClear();
    const order = [S.sel, ...P.poses.map((_, i) => i).filter((i) => i !== S.sel)].filter((i) => !clear[i]);
    for (const p of order) {
      const sol = solveOne(P.rules, p, P.poses);
      if (!sol || !sol.moves.length) continue;
      const m = sol.moves[0], left = sol.moves.length, name = pieceName(p), shape = P.lv.puzzle.loose[p].shape;
      const keys = otherKeys(P.rules, P.poses, p);
      const next = m.k === 's' ? trySlide(P.rules, shape, P.poses[p], m.i, keys) : tryTurn(P.rules, shape, P.poses[p], m.i, keys, otherSegs(P.rules, P.poses, p));
      const opens = next ? countSlides(P, p, next) - countSlides(P, p, P.poses[p]) : 0;
      const ax = m.i >> 1, sign = m.i & 1 ? 'minus' : 'plus';
      let text;
      if (m.k === 's') {
        const after = sol.moves[1];
        const why = left === 1 ? 'That carries it clear of the frame.' : after && after.k === 't' ? 'That lines it up with the room it needs for the turn that follows.' : 'It is a step along the way out: the wire around it lets it travel this way.';
        text = `Slide the ${name} one step toward ${sign} ${AXIS[ax]} (the ${AXIS_COLOUR[ax]} axis). ${why}`;
      } else {
        const why = opens > 0 ? `Turned that way it can slide in ${opens} more direction${opens === 1 ? '' : 's'} than it can now.` : 'Turned that way it clears the part of the wire it is resting against.';
        text = `Turn the ${name} a quarter about ${AXIS[ax]} (the ${AXIS_COLOUR[ax]} axis), ${m.i & 1 ? 'against' : 'with'} the curl of the plus arrow. ${why}`;
      }
      text += ` From here the quickest way out is ${left} move${left === 1 ? '' : 's'}.`;
      return { piece: p, k: m.k, i: m.i, text, left };
    }
    return { stuck: true, text: 'The pieces are jammed together here, so no single piece can get out on its own. Undo your last move or two and the way out opens again.', piece: -1 };
  }
  function askHint() {
    const P = S.P;
    if (piecesClear().every(Boolean)) return;
    const h = makeHint();
    P.hints += 1; S.hint = h; sfx.hint();
    if (h.piece >= 0) S.sel = h.piece;
  }
  function hintGo() {
    const h = S.hint;
    if (!h) return;
    if (h.stuck) { S.hint = null; doUndo(); return; }
    S.hint = null; S.sel = h.piece;
    if (doMove(h.piece, h.k, h.i)) persist();
  }

  // ---- Watch and Learn ---------------------------------------------------------------------------------------------------------------
  function autoTick(dt) {
    const a = S.auto, P = S.P;
    if (a.paused || a.done || P.done) return;
    if (a.phase === 'gap') { a.timer -= dt; if (a.timer <= 0) a.phase = null; return; }
    if (a.phase === 'think') {
      a.timer -= dt;
      if (a.timer > 0) return;
      a.phase = 'reveal'; a.timer = 2;
      S.autoText = S.hint.text;
      return;
    }
    if (a.phase === 'reveal') {
      a.timer -= dt;
      if (a.timer > 0) return;
      const h = S.hint;
      S.hint = null; a.phase = 'gap'; a.timer = 0.55;
      if (h && !h.stuck) { S.sel = h.piece; doMove(h.piece, h.k, h.i, false); checkWin(); } else a.done = true;
      return;
    }
    const h = makeHint();
    if (h.stuck) { a.done = true; S.autoText = 'This is as far as the demonstration goes.'; return; }
    S.hint = h; S.sel = h.piece; a.n += 1; a.phase = 'think'; a.timer = Math.max(1, S.thinkSecs);
    S.autoText = `Move ${a.n}. Which piece moves, and which way? ${h.left} move${h.left === 1 ? '' : 's'} to go.`;
  }

  // ---- input -----------------------------------------------------------------------------------------------------------------------------
  let gesture = null;   // scrolling lists
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

  // Field drag: look round (empty mat or the frame), or slide the grabbed piece along the axis it is dragged along.
  let drag = null;
  function fieldGesture(p, l) {
    const P = S.P;
    if (p.pressed && inRect(l.area, p.x, p.y)) {
      finishAnim();
      const hit = pickPiece(l.area, sceneOf(S), p.x, p.y);
      if (hit >= 1) { S.sel = hit - 1; drag = { mode: 'slide', x0: p.x, y0: p.y, dir: -1, n: 0, piece: hit - 1, sv: null }; }
      else drag = { mode: 'orbit', lx: p.x, ly: p.y };
      S.tip = Math.min(S.tip, 0.99);
    }
    if (!drag) return;
    if (p.down) {
      if (drag.mode === 'orbit') {
        orbit(P.cam, (p.x - drag.lx) * 0.0085, (p.y - drag.ly) * 0.0065); drag.lx = p.x; drag.ly = p.y;
      } else {
        const dx = p.x - drag.x0, dy = p.y - drag.y0;
        if (drag.dir < 0 && Math.hypot(dx, dy) > 18) {
          const Pj = setup(P.cam, l.area, P.view), pv = P.poses[drag.piece], o = proj(Pj, pv.x, pv.y, pv.z);
          let best = 0, bs = -2, bsv = null;
          for (let i = 0; i < 6; i++) {
            const d = SLIDES[i], q = proj(Pj, pv.x + d[0], pv.y + d[1], pv.z + d[2]), sx = q.x - o.x, sy = q.y - o.y, sl = Math.max(8, Math.hypot(sx, sy));
            const sc = (sx * dx + sy * dy) / (sl * Math.hypot(dx, dy));
            if (sc > bs) { bs = sc; best = i; bsv = { x: sx, y: sy, l: sl }; }
          }
          drag.dir = best; drag.sv = bsv;
        }
        if (drag.dir >= 0) {
          const prog = (dx * drag.sv.x + dy * drag.sv.y) / (drag.sv.l * drag.sv.l);
          const target = prog >= 0 ? Math.floor(prog + 0.4) : -Math.floor(-prog + 0.4);
          let guard = 0, moved = false;
          while (drag.n < target && guard++ < 4) { if (doMove(drag.piece, 's', drag.dir)) { drag.n += 1; moved = true; } else break; }
          while (drag.n > target && guard++ < 4) { if (doMove(drag.piece, 's', drag.dir ^ 1)) { drag.n -= 1; moved = true; } else break; }
          if (moved) { persist(); checkWin(); }
        }
      }
    }
    if (p.released || !p.down) drag = null;
  }

  function updatePlay(dt, input) {
    const P = S.P, l = L(), p = input.pointer;
    if (S.auto.on && !S.auto.paused && !S.paused) autoTick(dt);
    if (S.winDelay > 0) { S.winDelay -= dt; if (S.winDelay <= 0 && S.result) go('over'); }
    if (!(S.paused || (S.auto.on && S.auto.paused))) {
      if (P.anim) { P.anim.t += dt; if (P.anim.t >= P.anim.dur) { P.anim = null; checkWin(); } }
      if (P.bump) { P.bump.t += dt; if (P.bump.t > 0.3) P.bump = null; }
    }
    const k = input.keys.pressed;
    if (!S.auto.on && !S.paused && !P.done) {
      const mv = (kk, i) => { if (doMove(S.sel, kk, i)) { persist(); checkWin(); } };
      if (k.has('ArrowRight')) mv('s', 0); else if (k.has('ArrowLeft')) mv('s', 1);
      else if (k.has('KeyW')) mv('s', 2); else if (k.has('KeyS')) mv('s', 3);
      else if (k.has('ArrowDown')) mv('s', 4); else if (k.has('ArrowUp')) mv('s', 5);
      else if (k.has('KeyI')) mv('t', 0); else if (k.has('KeyK')) mv('t', 1);
      else if (k.has('KeyL')) mv('t', 2); else if (k.has('KeyJ')) mv('t', 3);
      else if (k.has('KeyO')) mv('t', 4); else if (k.has('KeyU')) mv('t', 5);
      if (k.has('KeyQ')) orbit(P.cam, -0.2, 0);
      if (k.has('KeyE')) orbit(P.cam, 0.2, 0);
      if (k.has('KeyR')) orbit(P.cam, 0, 0.15);
      if (k.has('KeyF')) orbit(P.cam, 0, -0.15);
      if (k.has('Tab')) S.sel = (S.sel + 1) % P.lv.puzzle.loose.length;
      if (k.has('KeyZ') || k.has('Backspace')) doUndo();
      if (k.has('KeyH')) { if (S.hint) hintGo(); else askHint(); }
    }
    if (k.has('KeyP') || k.has('Escape')) { if (S.auto.on) S.auto.paused = !S.auto.paused; else if (!P.done) { S.paused = !S.paused; if (S.paused) persist(); } }
    if (wheelInput.dy && !S.paused) { P.cam.zoom = clamp(P.cam.zoom * Math.exp(-wheelInput.dy * 0.0012), 0.7, 2.2); wheelInput.dy = 0; }
    const t = p.pressed ? { x: p.x, y: p.y } : null;
    if (S.paused) {
      drag = null;
      if (!t) return;
      const pl = pauseLayout(meta.width, meta.height);
      if (hitBtn('resume', pl.resume, t)) S.paused = false;
      else if (hitBtn('restart', pl.restart, t)) { doReset(); S.paused = false; }
      else if (hitBtn('pmenu', pl.menu, t)) { persist(); S.paused = false; go('title'); }
      return;
    }
    const C = l.ctl;
    if (S.auto.on) {
      if (!t) return;
      const bx = C.slide[1].x, bw = C.turn[0].x + C.turn[0].w - bx, gap = 10, w4 = (bw - gap * 3) / 4, y = C.undo.y;
      const R4 = (n) => ({ x: bx + n * (w4 + gap), y, w: w4, h: 66 });
      if (hitBtn('aexit', R4(0), t)) { S.auto.on = false; S.hint = null; S.P = null; go('title'); }
      else if (hitBtn('apause', R4(1), t)) S.auto.paused = !S.auto.paused;
      else if (hitBtn('adec', R4(2), t)) { if (S.prefs.thinkIdx > 0) { S.prefs.thinkIdx -= 1; applyPrefs(); savePrefs(); } }
      else if (hitBtn('ainc', R4(3), t)) { if (S.prefs.thinkIdx < THINK_STEPS.length - 1) { S.prefs.thinkIdx += 1; applyPrefs(); savePrefs(); } }
      return;
    }
    if (P.done) { if (t) S.winDelay = Math.min(S.winDelay, 0.01); return; }
    if (t) {
      if (S.hint && l.coachR) {
        const c = l.coachR, bh = 54, pad = 14, bw = (c.w - pad * 2 - 10) / 2, y = c.y + c.h - pad - bh;
        if (hitBtn('close', { x: c.x + pad, y, w: bw, h: bh }, t)) { S.hint = null; return; }
        if (hitBtn('go', { x: c.x + pad + bw + 10, y, w: bw, h: bh }, t)) { hintGo(); return; }
      }
      for (let i = 0; i < 6; i++) {
        if (hitBtn('sl' + i, C.slide[i], t)) { if (doMove(S.sel, 's', i)) { persist(); checkWin(); } return; }
        if (hitBtn('tu' + i, C.turn[i], t)) { if (doMove(S.sel, 't', i)) { persist(); checkWin(); } return; }
      }
      if (hitBtn('undo', C.undo, t)) return doUndo();
      if (hitBtn('reset', C.reset, t)) return doReset();
      if (hitBtn('think', C.think, t)) { if (!S.hint) askHint(); return; }
      if (hitBtn('piece', C.piece, t)) { if (P.lv.puzzle.loose.length > 1) { S.sel = (S.sel + 1) % P.lv.puzzle.loose.length; sfx.tap(); } return; }
      if (hitBtn('pause', C.menu, t)) { S.paused = true; persist(); return; }
    }
    fieldGesture(p, l);
  }

  function changeSetting(i, kk) {
    const id = settingsRows(S)[i].id, p = S.prefs;
    switch (id) {
      case 'look': p.look = LOOK_IDS[kk]; setLook(p.look); break;
      case 'guides': p.guides = kk === 0; break;
      case 'sound': p.sound = kk === 0; audio.setMuted?.(!p.sound); break;
      case 'calm': p.calm = kk === 1; break;
      case 'restore': restorePurchase(); return;
      default: break;
    }
    savePrefs(); sfx.tap();
  }
  function restorePurchase() {
    if (S.restoreBusy || S.owned || S.demo) return;
    S.restoreBusy = true; S.restoreMsg = 'Checking with the store...';
    Promise.resolve(monetization.restore()).then(() => {
      S.owned = !!monetization.owns('unlock_game');
      S.restoreMsg = S.owned ? 'Purchase restored. Thank you.' : 'No earlier purchase found.';
    }).catch(() => { S.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { S.restoreBusy = false; });
  }
  function textScale(dir) { const n = clamp(S.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (n !== S.prefs.textIdx) { S.prefs.textIdx = n; S.scrollY = 0; applyPrefs(); savePrefs(); } }

  function updateScene(dt, input) {
    const p = input.pointer, scrolling = ['levels', 'doc', 'settings'].includes(S.scene);
    if (S.scene === 'play') return updatePlay(dt, input);
    const tap = getTap(p, scrolling ? metrics.rect : null);
    if (scrolling) {
      if (wheelInput.dy) { S.scrollY = clamp(S.scrollY + wheelInput.dy, 0, metrics.max); wheelInput.dy = 0; }
      const k = input.keys.pressed;
      if (k.has('ArrowDown')) S.scrollY = clamp(S.scrollY + 80, 0, metrics.max);
      if (k.has('ArrowUp')) S.scrollY = clamp(S.scrollY - 80, 0, metrics.max);
      S.scrollY = clamp(S.scrollY, 0, metrics.max);
    }
    const sc = S.scene, w = meta.width, h = meta.height;
    if (sc === 'title') {
      if (!tap) { if (input.keys.pressed.has('Enter') || input.keys.pressed.has('Space')) playButton(); return; }
      const t = titleLayout(w, h), B = t.buttons;
      for (const id of Object.keys(B)) if (hitBtn(id, B[id], tap)) {
        sfx.tap();
        if (id === 'play') playButton();
        else if (id === 'levels') go('levels');
        else if (id === 'daily') startDaily();
        else if (id === 'learn') startAuto();
        else if (id === 'howto' || id === 'rules' || id === 'about') { S.doc = { kind: id, page: 0 }; go('doc'); }
        else if (id === 'settings') { S.back = 'title'; go('settings'); }
        return;
      }
      if (Math.abs(tap.x - t.brand.x) < 260 && Math.abs(tap.y - t.brand.y) < 26) env.openArcforgeHome?.();
      return;
    }
    if (sc === 'levels') {
      const LL = levelsLayout(w, h, LEVELS.length);
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', LL.back, tap)) { go('title'); return; }
      if (hitBtn('tdec', LL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', LL.textInc, tap)) return textScale(1);
      if (inRect(LL.body, tap.x, tap.y)) {
        LEVELS.forEach((_, i) => { const r = { ...LL.tiles[i], y: LL.tiles[i].y - S.scrollY }; if (inRect(r, tap.x, tap.y)) { sfx.tap(); startLevel(i); } });
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
      const SL = settingsLayout(w, h, TEXT_SCALES[S.prefs.textIdx], settingsRows(S).length);
      const leave = () => { if (S.back === 'play' && S.P) { S.scene = 'play'; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
      if (input.keys.pressed.has('Escape')) { leave(); return; }
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
    if (sc === 'over') {
      const O = overLayout(w, h);
      if (!tap) return;
      const R0 = S.result;
      if (hitBtn('next', O.next, tap)) { if (R0.daily) go('title'); else if (R0.last) go('levels'); else startLevel(R0.id + 1, true); }
      else if (hitBtn('share', O.again, tap)) env.share(`Tavern Nail and Wire Puzzles ${R0.daily ? 'Round of the Day' : 'level ' + (R0.id + 1)}: freed in ${R0.moves} moves, ${R0.stars} star${R0.stars === 1 ? '' : 's'}.`);
      else if (hitBtn('menu', O.menu, tap)) { if (R0.daily) go('levels'); else go('title'); }
      return;
    }
    if (sc === 'demo-limit' && tap) go('title');
  }

  // Store screenshots (main.js: ?shot=1 and the seed in store/shots.json pick the moment). Scripted, not random input.
  const shotBody = (name) => {
      applyPrefs();
      S.stars = Array.from({ length: LEVELS.length }, (_, i) => (i < 8 ? (i % 3 === 0 ? 3 : 2) : 0)); S.days = [S.day - 2, S.day - 1]; recount();
      const idle = () => { S.msg = null; S.tip = 0; S.sceneT = 1; };
      if (name === 'title') { go('title'); S.sceneT = 1; return; }
      if (name === 'levels') { go('levels'); S.sceneT = 1; return; }
      if (name === 'play' || name === 'think' || name === 'turn') {
        startLevel(name === 'play' ? 9 : name === 'turn' ? 7 : 4, true); idle();
        if (name === 'play' || name === 'turn') { for (const m of S.P.lv.sol.slice(0, name === 'turn' ? 2 : 2)) { doMove(m.p, m.k, m.i); S.P.anim = null; } }
        if (name === 'think') { askHint(); }
        S.P.cam.yaw += 0.1; return;
      }
      if (name === 'watch') { startAuto(); idle(); for (let i = 0; i < 60 * 9; i++) { if (S.auto.on) { autoTick(1 / 60); const P = S.P; if (P.anim) { P.anim.t += 1 / 60; if (P.anim.t >= P.anim.dur) P.anim = null; } } } S.autoText = S.autoText || ''; return; }
      if (name === 'result') { startLevel(2, true); S.dev = true; for (const m of S.P.lv.sol) { doMove(m.p, m.k, m.i); S.P.anim = null; } checkWin(); S.winDelay = 0.01; S.scene = 'over'; S.sceneT = 1; return; }
      if (name === 'rules' || name === 'howto' || name === 'about') { S.doc = { kind: name, page: 0 }; go('doc'); S.sceneT = 1; return; }
      if (name === 'settings') { S.back = 'title'; go('settings'); S.sceneT = 1; }
  };

  return {
    update(dt, input) {
      S.t += dt; S.sceneT += dt;
      if (S.flash) { S.flash.t += dt; if (S.flash.t > 0.25) S.flash = null; }
      if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold) S.msg = null; }
      if (S.tip > 0 && S.scene === 'play') S.tip = Math.max(0, S.tip - dt * 0.35);
      const frozen = S.paused || (S.auto.on && S.auto.paused);
      if (!frozen) {
        if (S.winT > 0) S.winT -= dt;
        for (const q of S.sfx) q.t -= dt;
        const due = S.sfx.filter((q) => q.t <= 0); if (due.length) { S.sfx = S.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
      }
      if (S.scene === 'play') {
        const l = L();
        meta.previewBadge = l.land ? { x: l.hud.x, y: l.hud.y + l.hud.h + 4, align: 'left' } : { x: l.hud.x + l.hud.w, y: l.hud.y + 4, align: 'right' };
      } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { render(ctx, S, view ?? meta); },
    getState: () => S,
    // Counts real play only: a live puzzle in progress. Menus, Rules, settings, Watch and Learn, pause, results are free.
    isPreviewExempt() { return !(S.scene === 'play' && !S.auto.on && !S.paused && S.P && !S.P.done); },
    // Tester/screenshot hooks (only wired up in dev: see main.js).
    shotScene(name) { const keep = S.dev; S.dev = true; try { shotBody(name); } finally { S.dev = keep; } },
    dev: {
      go: (scene, extra) => { Object.assign(S, extra ?? {}); go(scene); },
      start: (n) => { S.dev = true; startLevel(n, true); }, daily: () => startDaily(), auto: () => startAuto(), hint: () => askHint(),
      move: (kk, i, p = S.sel) => { const ok = doMove(p, kk, i); if (ok) { S.P.anim = null; checkWin(); } return ok; },
      solveNow: () => { const P = S.P; for (const m of P.lv.sol) { doMove(m.p, m.k, m.i); S.P.anim = null; } checkWin(); },
      skipOver: () => { S.winDelay = 0.01; },
      doc: (kind, page = 0) => { S.doc = { kind, page }; go('doc'); },
      unlock: (n) => { for (let i = 0; i < n; i++) S.stars[i] = S.stars[i] || 2; recount(); },
      layout: () => { const l = L(); return { land: l.land, area: l.area, ctl: l.ctl, w: meta.width, h: meta.height }; },
    },
  };
}
