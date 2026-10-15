// Secret Puzzle Box: state and flow. Engine = box.js, levels = levels.js, drawing = view.js, geometry = layout.js.
import { playLayout, titleLayout, docLayout, settingsLayout, levelsLayout, overLayout, pauseLayout, inRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { makeBox, tryMove, bestMove, explainMove, isOpen, climb } from './box.js';
import { LEVELS, tierOf, TIER_NAMES, FACE_NAMES, KEEPSAKES } from './levels.js';
import { render, metrics, settingsList, faceMeta } from './view.js';
import { DOCS } from './content.js';
import { setLook, LOOK_IDS } from './ui.js';
import { v3 } from './v3.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen; everything lays out from the live size.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_BOXES = 3;
const AUTO_GAP = 0.35;
const DEFAULT_PREFS = { look: 'cherry', holders: true, sound: true, calm: false, textIdx: 0, thinkIdx: 1 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ORD = ['first', 'second', 'third', 'fourth', 'fifth'];

export function createGame(env) {
  const { storage, audio, monetization, config, rng } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS },
    P: null, focus: -1, hint: null, paused: false, auto: { on: false, phase: null, timer: 0, paused: false, n: 0, done: false }, autoText: '', thinkSecs: 5,
    drag: null, turn: null, held: null, msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0 }, back: 'title', result: null, winDelay: 0,
    stars: [], unlocked: 0, doneCount: 0, hasSave: false, playInfo: '', day: config.day ?? 0, days: [], streak: 0, dailyDone: false, dailyInfo: '',
    demoCount: 0, demo: config.demo === true, owned: !!monetization.owns?.('unlock_game'), restoreMsg: '', restoreT: 0, restoreBusy: false, dev: config.dev === true, sfx: [], sparks: [],
  };
  monetization.onChange?.(() => { S.owned = !!monetization.owns('unlock_game'); });
  let saveRaw = null;
  const boxCache = new Map();

  // ---- persistence ------------------------------------------------------------------------------------------------------------
  const applyPrefs = () => { setLook(S.prefs.look); audio.setMuted?.(!S.prefs.sound); S.thinkSecs = THINK_STEPS[S.prefs.thinkIdx]; };
  const savePrefs = () => storage.set('prefs', S.prefs);
  const saveProgress = () => storage.set('progress', { stars: S.stars, days: S.days });
  function recount() {
    S.doneCount = S.stars.filter((v) => v > 0).length;
    let u = 0; while (u < LEVELS.length - 1 && (S.stars[u] ?? 0) > 0) u += 1;
    S.unlocked = u;
    const set = new Set(S.days); let streak = 0, d = set.has(S.day) ? S.day : S.day - 1;
    while (set.has(d)) { streak += 1; d -= 1; }
    S.streak = streak; S.dailyDone = set.has(S.day);
    S.dailyInfo = S.dailyDone ? 'Done today' : streak ? `${streak} day streak` : 'New every day';
    if (S.hasSave && saveRaw) S.playInfo = saveRaw.id === 'daily' ? 'Daily Box' : `Box ${saveRaw.id + 1}`;
    else S.playInfo = `Box ${Math.min(S.unlocked, LEVELS.length - 1) + 1}`;
  }
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); if (!LOOK_IDS.includes(S.prefs.look)) S.prefs.look = 'cherry'; } applyPrefs(); });
  storage.get('progress', null).then((v) => { if (v) { S.stars = (v.stars ?? []).slice(0, LEVELS.length); S.days = (v.days ?? []).slice(-200); } recount(); });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  storage.get('save', null).then((v) => { if (v && Array.isArray(v.pos) && S.scene === 'title' && !S.P && (v.id !== 'daily' || v.day === S.day)) { saveRaw = v; S.hasSave = true; recount(); } });
  applyPrefs(); recount();

  const persist = () => {
    const P = S.P;
    if (!P || P.done || S.auto.on) return;
    saveRaw = { id: P.id, day: S.day, pos: P.pos.slice(), moves: P.moves, hints: P.hints, undo: P.undo.slice(-80), face: P.face };
    S.hasSave = true; storage.set('save', saveRaw); recount();
  };
  const clearSave = () => { saveRaw = null; S.hasSave = false; storage.remove('save'); recount(); };

  // ---- sound -----------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound) audio.tone(o); };
  const later = (t, o) => S.sfx.push({ t, o });
  const sfx = {
    click: (place) => tone({ freq: 360 + place * 70, to: 260, dur: 0.06, type: 'triangle', vol: 0.12 }),
    knock: () => { tone({ freq: 150, to: 95, dur: 0.09, type: 'triangle', vol: 0.12 }); later(0.09, { freq: 130, to: 85, dur: 0.08, type: 'triangle', vol: 0.09 }); },
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.06 }),
    turn: () => tone({ freq: 220, to: 340, dur: 0.14, type: 'sine', vol: 0.07 }),
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.08 }),
    win: () => { [392, 494, 587, 784, 988].forEach((f, i) => later(i * 0.12, { freq: f, to: f, dur: 0.4, type: 'triangle', vol: 0.09 })); later(0.1, { freq: 120, to: 90, dur: 0.3, type: 'triangle', vol: 0.12 }); },
  };

  // ---- helpers -----------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.4) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; wheelInput.dy = 0; S.msg = null; if (scene === 'title') recount(); }
  const lanesOf = (B, face) => { const out = []; for (let i = 0; i < B.n; i++) if (B.face[i] === face) out.push(i); return out; };
  const laneOf = (B, i) => lanesOf(B, B.face[i]).indexOf(i);
  const nameOf = (B, i) => `${ORD[laneOf(B, i)] ?? 'next'} panel on the ${FACE_NAMES[B.face[i]]}`;
  const L = () => { const P = S.P, fm = faceMeta(P.B, P.face); return playLayout(meta.width, meta.height, fm.lanes, fm.T, fm.vertical, P.B.faces, !!(S.hint || S.auto.on)); };

  // ---- boxes -------------------------------------------------------------------------------------------------------------------
  function levelBox(n) {
    if (!boxCache.has(n)) boxCache.set(n, makeBox(LEVELS[n]));
    return boxCache.get(n);
  }
  // The Daily Box: made from the day number alone, so it is the same for everyone.
  function dailyBox(day) {
    const key = 'd' + day;
    if (boxCache.has(key)) return boxCache.get(key);
    const dm = ((day % 6) + 6) % 6, n = 5 + (((day % 2) + 2) % 2), k = Array.from({ length: n }, (_, i) => ((i + day) % 2 ? 4 : 3)), target = 20 + 4 * dm;
    const c = climb(k, target, 70000 + (((day % 100000) + 100000) % 100000), { iters: 70, slack: 3 });
    let data = { k, f: k.map((_, i) => i % 2), g: c.g, goal: c.goal, par: c.d };
    if (c.d < 12) data = LEVELS[7 + (((day % 5) + 5) % 5)];
    const B = makeBox(data);
    boxCache.set(key, B);
    return B;
  }
  function newSession(B, id, title, sub) {
    return { B, pos: new Array(B.n).fill(0), vis: new Array(B.n).fill(0), moves: 0, hints: 0, undo: [], done: false, id, title, sub, face: 0 };
  }
  function begin(P) {
    S.sparks = []; S.P = P; S.focus = -1; S.hint = null; S.paused = false; S.msg = null; S.result = null; S.winDelay = 0; S.drag = null; S.turn = null; S.held = null;
    S.auto = { on: false, phase: null, timer: 0, paused: false, n: 0, done: false }; S.autoText = '';
    go('play');
  }
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_BOXES) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }
  const subOf = (n) => `${TIER_NAMES[tierOf(n)]}  ·  ${LEVELS[n].n} panels`;
  function restore(P, raw) {
    if (!raw || raw.pos.length !== P.pos.length) return;
    P.pos = raw.pos.slice(); P.vis = raw.pos.slice(); P.moves = raw.moves | 0; P.hints = raw.hints | 0; P.undo = (raw.undo ?? []).slice(); P.face = clamp(raw.face | 0, 0, P.B.faces - 1);
  }
  function startLevel(n, fresh = false) {
    n = clamp(n, 0, LEVELS.length - 1);
    if (n > S.unlocked && !S.dev) { say('Open the box before it first.'); return; }
    if (demoBlocked()) return;
    const P = newSession(levelBox(n), n, `Box ${n + 1}`, subOf(n));
    if (!fresh && saveRaw && saveRaw.id === n) restore(P, saveRaw);
    begin(P); persist();
  }
  function startDaily() {
    if (demoBlocked()) return;
    const B = dailyBox(S.day), P = newSession(B, 'daily', 'Daily Box', `${B.n} panels  ·  ${B.faces} faces`);
    if (saveRaw && saveRaw.id === 'daily' && saveRaw.day === S.day) restore(P, saveRaw);
    begin(P); persist();
  }
  function playButton() {
    if (S.hasSave && saveRaw) { if (saveRaw.id === 'daily') startDaily(); else startLevel(saveRaw.id); } else startLevel(S.unlocked);
  }
  function startAuto() {
    const n = clamp(S.unlocked, 3, 9);
    begin(newSession(levelBox(n), 'auto', 'Watch and Learn', subOf(n)));
    S.auto.on = true;
    say('Watch the game think and slide the panels until the box opens.', 2.4);
  }

  // ---- moves ---------------------------------------------------------------------------------------------------------------------
  function turnTo(face, instant = false) {
    const P = S.P;
    if (face === P.face || face < 0 || face >= P.B.faces) return;
    if (instant || S.prefs.calm) { P.face = face; S.turn = null; } else { S.turn = { from: P.face, to: face, t: 0, dur: 0.34 }; P.face = face; sfx.turn(); }
    S.drag = null; S.focus = -1;
  }
  // A few brass sparks where a panel settles on its mark (positions are virtual units on the current face).
  function burst(i) {
    const P = S.P, B = P.B, face = B.face[i];
    if (face !== P.face) return;
    const l = L(), lane = lanesOf(B, face).indexOf(i), r = l.face.panel(lane, B.goal[i], 0), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    for (let n = 0; n < 12; n++) { const a = rng.range(0, Math.PI * 2), sp = rng.range(60, 220) * (l.face.S / 90); S.sparks.push({ x: cx + Math.cos(a) * r.w * 0.2, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, t: 0, life: rng.range(0.35, 0.7) }); }
    if (S.sparks.length > 80) S.sparks.splice(0, S.sparks.length - 80);
  }
  // Slide panel i one place; refuses (with feedback) when a catch holds it or it is at the end of its groove.
  function slide(i, dir, record = true) {
    const P = S.P, r = tryMove(P.B, P.pos, i, dir);
    if (!r.ok) {
      if (r.end) { sfx.tap(); say('That panel is at the end of its groove.', 1.4); return false; }
      S.held = { i, by: r.by, t: 0 }; sfx.knock();
      say(S.prefs.holders ? `A catch holds it. The ${nameOf(P.B, r.by)} has to be somewhere else first.` : 'A catch holds this panel.', 2.4);
      return false;
    }
    P.pos[i] = r.to;
    if (record) { P.moves += 1; P.undo.push({ i, dir }); }
    sfx.click(r.to);
    if (r.to === P.B.goal[i] && S.scene === 'play') burst(i);
    return true;
  }
  function checkWin() { if (!S.P.done && isOpen(S.P.B, S.P.pos)) win(); }
  function win() {
    const P = S.P;
    P.done = true; S.hint = null; S.drag = null; S.winDelay = 2.8; sfx.win();
    const keep = KEEPSAKES[(P.id === 'daily' ? S.day : typeof P.id === 'number' ? P.id : 0) % KEEPSAKES.length];
    if (S.auto.on) { S.auto.done = true; S.auto.phase = null; S.autoText = 'Every panel is on its mark. The drawer is open.'; S.result = null; return; }
    const par = P.B.par, allow = Math.max(2, Math.ceil(par * 0.1));
    const stars = P.moves <= par + allow && !P.hints ? 3 : P.moves <= Math.floor(par * 1.5) + 2 ? 2 : 1;
    let first = false;
    const daily = P.id === 'daily';
    if (!daily) { first = (S.stars[P.id] ?? 0) === 0; S.stars[P.id] = Math.max(S.stars[P.id] ?? 0, stars); }
    else if (!S.days.includes(S.day)) { S.days.push(S.day); S.days = S.days.slice(-200); }
    saveProgress(); clearSave(); recount();
    if (daily) storage.set('daily', { day: S.day, streak: S.streak });
    monetization.track('box_opened', { id: String(P.id), moves: P.moves, par });
    S.result = { stars, moves: P.moves, par, hints: P.hints, daily, first, id: P.id, streak: S.streak, last: !daily && P.id >= LEVELS.length - 1, keep };
  }
  function doUndo() {
    const P = S.P;
    if (!P.undo.length) { say('Nothing to undo.', 1.2); return; }
    const u = P.undo.pop(); P.pos[u.i] -= u.dir; P.moves = Math.max(0, P.moves - 1); S.hint = null; sfx.click(P.pos[u.i]); persist();
  }
  function doReset() {
    const P = S.P;
    P.pos = new Array(P.B.n).fill(0); P.moves = 0; P.undo = []; S.hint = null; sfx.tap(); persist();
  }

  // ---- hints (also drive Watch and Learn) -------------------------------------------------------------------------------------------
  function makeHint() {
    const P = S.P, B = P.B, mv = bestMove(B, P.pos);
    if (!mv) return null;
    const vertical = B.face[mv.i] === 1, word = vertical ? (mv.dir > 0 ? 'down' : 'up') : mv.dir > 0 ? 'right' : 'left';
    const why = explainMove(B, P.pos, mv);
    const reason = why.opens ? 'This is the last slide: the box opens.' : why.frees >= 0 ? `This lets go of the catch on the ${nameOf(B, why.frees)}.` : 'It is part of the shortest way to open the box.';
    return { i: mv.i, dir: mv.dir, face: B.face[mv.i], left: mv.left, text: `Look at the lit panel: slide the ${nameOf(B, mv.i)} one place ${word}. ${reason}` };
  }
  function askHint() {
    const h = makeHint();
    if (!h) { say('The box is already open.'); return; }
    S.P.hints += 1; S.hint = h; sfx.hint();
  }
  function hintGo() {
    const h = S.hint;
    if (!h) return;
    S.hint = null;
    if (h.face !== S.P.face) turnTo(h.face, true);
    if (slide(h.i, h.dir)) { persist(); checkWin(); }
  }

  // ---- Watch and Learn ---------------------------------------------------------------------------------------------------------------
  function autoTick(dt) {
    const a = S.auto;
    if (a.paused || a.done || S.turn) return;
    if (a.phase === 'gap') { a.timer -= dt; if (a.timer <= 0) a.phase = null; return; }
    if (a.phase === 'think') {
      a.timer -= dt;
      if (a.timer > 0) return;
      a.phase = 'reveal'; a.timer = 2;
      if (S.hint.face !== S.P.face) turnTo(S.hint.face);
      S.autoText = `${S.hint.text} Sliding it now.`;
      return;
    }
    if (a.phase === 'reveal') {
      a.timer -= dt;
      if (a.timer > 0) return;
      const h = S.hint;
      S.hint = null; slide(h.i, h.dir, false); a.phase = 'gap'; a.timer = AUTO_GAP;
      checkWin();
      return;
    }
    const h = makeHint();
    if (!h) { a.done = true; return; }
    S.hint = h; a.n += 1; a.phase = 'think'; a.timer = Math.max(1, S.thinkSecs);
    S.autoText = `Step ${a.n}. Which panel should slide next, and which way?`;
  }

  // ---- input -----------------------------------------------------------------------------------------------------------------------------
  let gesture = null;
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

  // The panel under a point on the current face (the lane's slab at its current place), or -1.
  function panelAt(l, x, y) {
    const P = S.P, ids = lanesOf(P.B, P.face);
    let best = -1, bestD = Infinity;
    for (let lane = 0; lane < ids.length; lane++) {
      const i = ids[lane], r = l.face.panel(lane, P.vis[i], 0), pad = Math.max(10, l.face.S * 0.12);
      if (!inRect({ x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad }, x, y)) continue;
      const d = Math.hypot(x - (r.x + r.w / 2), y - (r.y + r.h / 2));
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }
  function dragUpdate(p, l) {
    const d = S.drag, P = S.P, vertical = l.face.vertical;
    const delta = (vertical ? p.y - d.y0 : p.x - d.x0) / l.face.S;
    if (Math.abs(p.x - d.x0) + Math.abs(p.y - d.y0) > 10) d.moved = true;
    let off = clamp(delta, -1, 1);
    const dir = off > 0 ? 1 : -1, r = tryMove(P.B, P.pos, d.i, dir);
    if (Math.abs(off) > 0.02 && !r.ok) {
      off = clamp(off, -0.16, 0.16);
      if (!d.warned && Math.abs(delta) > 0.18) { d.warned = true; slide(d.i, dir, false); }
    }
    d.off = off;
  }
  function dragEnd(p, l) {
    const d = S.drag, P = S.P;
    S.drag = null;
    if (!d) return;
    const vertical = l.face.vertical;
    let dir = 0;
    if (d.moved) { if (Math.abs(d.off) >= 0.4) dir = d.off > 0 ? 1 : -1; }
    else {
      const lane = lanesOf(P.B, P.face).indexOf(d.i), r = l.face.panel(lane, P.vis[d.i], 0);
      const c = vertical ? r.y + r.h / 2 : r.x + r.w / 2, v = vertical ? p.y : p.x;
      dir = v >= c ? 1 : -1;
    }
    if (!dir || d.warned) return;
    P.vis[d.i] += d.off;   // carry the finger's offset into the glide
    S.hint = null;
    if (slide(d.i, dir)) { persist(); checkWin(); } else P.vis[d.i] = P.pos[d.i];
  }

  function updatePlay(dt, tap, input) {
    const P = S.P, l = L(), B = P.B, p = input.pointer;
    // With the 3D view the face is seen at an angle: panel hit-testing and drags work in face-plane (layout) units.
    const pf = v3.on && v3.unproj ? v3.unproj(p.x, p.y) : null, pp = pf ? { ...p, x: pf.x, y: pf.y } : p;
    if (S.auto.on && !S.auto.paused && !S.paused) autoTick(dt);
    if (S.winDelay > 0) { S.winDelay -= dt; if (S.winDelay <= 0 && S.result) go('over'); }
    const k = input.keys.pressed, live = !S.auto.on && !S.paused && !P.done && !S.turn;
    if (live) {
      const vertical = P.face === 1, ids = lanesOf(B, P.face);
      const across = vertical ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'], along = vertical ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
      if (k.has(across[0]) || k.has(across[1])) S.focus = S.focus < 0 || !ids.includes(S.focus) ? ids[0] : ids[clamp(ids.indexOf(S.focus) + (k.has(across[1]) ? 1 : -1), 0, ids.length - 1)];
      if (S.focus >= 0 && (k.has(along[0]) || k.has(along[1]))) { S.hint = null; if (slide(S.focus, k.has(along[1]) ? 1 : -1)) { persist(); checkWin(); } }
      if (k.has('Tab') || k.has('KeyE')) turnTo((P.face + 1) % B.faces);
      if (k.has('KeyQ')) turnTo((P.face + B.faces - 1) % B.faces);
      if (k.has('KeyU') || k.has('KeyZ')) doUndo();
      if (k.has('KeyH')) { if (S.hint) hintGo(); else askHint(); }
      // dragging a panel along its groove
      if (p.pressed && !S.drag) {
        const onBtn = inRect(l.btns.a, p.x, p.y) || inRect(l.btns.b, p.x, p.y) || inRect(l.btns.c, p.x, p.y) || inRect(l.btns.d, p.x, p.y) || (l.coachR && S.hint && inRect(l.coachR, p.x, p.y));
        const i = onBtn ? -1 : panelAt(l, pp.x, pp.y);
        if (i >= 0) { S.drag = { i, x0: pp.x, y0: pp.y, off: 0, moved: false, warned: false }; S.focus = -1; }
      }
      if (S.drag) {
        if (p.down && !p.released) dragUpdate(pp, l);
        if (p.released || !p.down) dragEnd(pp, l);
      }
    } else if (S.drag) S.drag = null;
    if (k.has('KeyP') || k.has('Escape')) { if (S.auto.on) S.auto.paused = !S.auto.paused; else if (!P.done) { S.paused = !S.paused; if (S.paused) { S.drag = null; persist(); } } }
    if (!tap) return;
    if (S.paused) {
      const pl = pauseLayout(meta.width, meta.height);
      if (hitBtn('resume', pl.resume, tap)) S.paused = false;
      else if (hitBtn('restart', pl.restart, tap)) { doReset(); S.paused = false; }
      else if (hitBtn('pmenu', pl.menu, tap)) { persist(); S.paused = false; go('title'); }
      return;
    }
    const b = l.btns;
    if (S.auto.on) {
      if (hitBtn('aexit', b.a, tap)) { S.auto.on = false; S.hint = null; S.P = null; go('title'); }
      else if (hitBtn('apause', b.b, tap)) S.auto.paused = !S.auto.paused;
      else if (hitBtn('adec', b.c, tap)) { if (S.prefs.thinkIdx > 0) { S.prefs.thinkIdx -= 1; applyPrefs(); savePrefs(); } }
      else if (hitBtn('ainc', b.d, tap)) { if (S.prefs.thinkIdx < THINK_STEPS.length - 1) { S.prefs.thinkIdx += 1; applyPrefs(); savePrefs(); } }
      return;
    }
    if (P.done) { S.winDelay = Math.min(S.winDelay, 0.01); return; }
    if (S.hint && l.coachR) {
      if (hitBtn('close', l.coachBtns.close, tap)) { S.hint = null; return; }
      if (hitBtn('go', l.coachBtns.go, tap)) { hintGo(); return; }
    }
    if (hitBtn('undo', b.a, tap)) return doUndo();
    if (hitBtn('reset', b.b, tap)) return doReset();
    if (hitBtn('hint', b.c, tap)) return S.hint ? undefined : askHint();
    if (hitBtn('pause', b.d, tap)) { S.paused = true; S.drag = null; persist(); return; }
    for (let f = 0; f < l.tabRects.length; f++) if (hitBtn('tab' + f, l.tabRects[f], tap)) { turnTo(f); return; }
  }

  function changeSetting(i, kx) {
    const id = settingsList(S)[i].id, p = S.prefs;
    switch (id) {
      case 'look': p.look = LOOK_IDS[kx]; setLook(p.look); break;
      case 'holders': p.holders = kx === 0; break;
      case 'sound': p.sound = kx === 0; audio.setMuted?.(!p.sound); break;
      case 'calm': p.calm = kx === 1; break;
      case 'restore': doRestore(); return;
      default: break;
    }
    savePrefs(); sfx.tap();
  }
  // Settings > Restore purchase: busy / owned / not found / failed are all shown on the button itself.
  function doRestore() {
    if (S.restoreBusy || S.demo) return;
    S.restoreBusy = true; S.restoreMsg = 'Checking with the store...'; S.restoreT = 0;
    Promise.resolve().then(() => monetization.restore()).then(() => {
      S.owned = !!monetization.owns('unlock_game');
      S.restoreMsg = S.owned ? 'Full game unlocked' : 'No earlier purchase found';
    }).catch(() => { S.restoreMsg = 'Could not reach the store'; }).finally(() => { S.restoreBusy = false; S.restoreT = 0; });
  }
  function textScale(dir) { const n = clamp(S.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (n !== S.prefs.textIdx) { S.prefs.textIdx = n; S.scrollY = 0; savePrefs(); } }

  function updateScene(dt, input) {
    const p = input.pointer, scrolling = ['levels', 'doc', 'settings'].includes(S.scene);
    const sc = S.scene, w = meta.width, h = meta.height;
    if (sc === 'play') return updatePlay(dt, p.pressed ? { x: p.x, y: p.y } : null, input);
    const tap = getTap(p, scrolling ? metrics.rect : null);
    if (scrolling) {
      if (wheelInput.dy) { S.scrollY = clamp(S.scrollY + wheelInput.dy, 0, metrics.max); wheelInput.dy = 0; }
      const k = input.keys.pressed;
      if (k.has('ArrowDown')) S.scrollY = clamp(S.scrollY + 80, 0, metrics.max);
      if (k.has('ArrowUp')) S.scrollY = clamp(S.scrollY - 80, 0, metrics.max);
      S.scrollY = clamp(S.scrollY, 0, metrics.max);
    }
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
      const SL = settingsLayout(w, h, TEXT_SCALES[S.prefs.textIdx], settingsList(S).length);
      const leave = () => { if (S.back === 'play' && S.P) { S.scene = 'play'; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
      if (input.keys.pressed.has('Escape')) { leave(); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) return leave();
      if (hitBtn('tdec', SL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', SL.textInc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) {
        const ty = tap.y + S.scrollY;
        settingsList(S).forEach((row, i) => {
          const g = SL.rows[i], n = row.opts.length, cw = (g.ctrl.w - 8 * (n - 1)) / n;
          for (let kx = 0; kx < n; kx++) { const r = { x: g.ctrl.x + kx * (cw + 8), y: g.ctrl.y, w: cw, h: g.ctrl.h }; if (inRect(r, tap.x, ty)) { flash('set' + i + '.' + kx); changeSetting(i, kx); } }
        });
      }
      return;
    }
    if (sc === 'over') {
      const O = overLayout(w, h);
      if (!tap) return;
      const R0 = S.result;
      if (hitBtn('next', O.next, tap)) { if (R0.daily) go('title'); else if (R0.last) go('levels'); else startLevel(R0.id + 1, true); }
      else if (hitBtn('share', O.again, tap)) env.share(`Secret Puzzle Box ${R0.daily ? 'Daily Box' : 'box ' + (R0.id + 1)}: drawer open in ${R0.moves} moves, ${R0.stars} star${R0.stars === 1 ? '' : 's'}.`);
      else if (hitBtn('menu', O.menu, tap)) { if (R0.daily) go('levels'); else go('title'); }
      return;
    }
    if (sc === 'demo-limit' && tap) go('title');
  }

  return {
    update(dt, input) {
      S.t += dt; S.sceneT += dt;
      if (S.flash) { S.flash.t += dt; if (S.flash.t > 0.25) S.flash = null; }
      if (S.restoreMsg && !S.restoreBusy) { S.restoreT += dt; if (S.restoreT > 5 && !S.owned) S.restoreMsg = ''; }
      if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold) S.msg = null; }
      const frozen = S.paused || (S.auto.on && S.auto.paused);
      if (!frozen) {
        if (S.held) { S.held.t += dt; if (S.held.t > 2) S.held = null; }
        if (S.turn) { S.turn.t += dt; if (S.turn.t >= S.turn.dur) S.turn = null; }
        if (S.P) {
          const P = S.P, a = Math.min(1, dt * (S.prefs.calm ? 30 : 16));
          for (let i = 0; i < P.vis.length; i++) { if (!(S.drag && S.drag.i === i)) { P.vis[i] += (P.pos[i] - P.vis[i]) * a; if (Math.abs(P.pos[i] - P.vis[i]) < 0.002) P.vis[i] = P.pos[i]; } }
        }
        for (const sp of S.sparks) { sp.t += dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 420 * dt; }
        if (S.sparks.length) S.sparks = S.sparks.filter((sp) => sp.t < sp.life);
        for (const q of S.sfx) q.t -= dt;
        const due = S.sfx.filter((q) => q.t <= 0); if (due.length) { S.sfx = S.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
      }
      if (S.scene === 'play' && S.P) {
        const l = L();
        meta.previewBadge = l.land ? { x: l.hud.x, y: l.hud.y + l.hud.h + 4, align: 'left' } : null;
      } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { render(ctx, S, view ?? meta); },
    getState: () => S,
    // Counts real play only: a live box in progress. Menus, Rules, settings, Watch and Learn, pause, results are free.
    isPreviewExempt() { return !(S.scene === 'play' && !S.auto.on && !S.paused && S.P && !S.P.done); },
    // Tester/screenshot hooks (only wired up in dev: see main.js).
    dev: {
      go: (scene, extra) => { Object.assign(S, extra ?? {}); go(scene); },
      start: (n) => { S.dev = true; startLevel(n, true); }, daily: () => startDaily(), auto: () => startAuto(), hint: () => askHint(),
      solveNow: () => { const P = S.P; P.pos = P.B.goal.slice(); P.vis = P.pos.slice(); P.moves = P.B.par; win(); }, skipOver: () => { S.winDelay = 0.01; },
      doc: (kind, page = 0) => { S.doc = { kind, page }; go('doc'); },
      unlock: (n) => { for (let i = 0; i < n; i++) S.stars[i] = S.stars[i] || 2; recount(); },
      autoShow: () => { autoTick(0); const a = S.auto; if (S.hint) { a.phase = 'reveal'; a.timer = 2; S.autoText = `${S.hint.text} Sliding it now.`; } },
      face: (f) => turnTo(f, true),
      panelScreen: (i) => { const r = S.dev && S.P ? L().face.panel(lanesOf(S.P.B, S.P.face).indexOf(i), S.P.vis[i], 0) : null; if (!r) return null; const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 }; return v3.on && v3.proj ? v3.proj(c.x, c.y, 0.1) : c; },
      panelRect: (i) => { const P = S.P, l = L(), lane = lanesOf(P.B, P.face).indexOf(i); return lane < 0 ? null : { ...l.face.panel(lane, P.vis[i], 0), S: l.face.S, vertical: l.face.vertical }; },
      state: () => ({ face: S.P.face, pos: S.P.pos.slice(), moves: S.P.moves, done: S.P.done, hint: S.hint, scene: S.scene, par: S.P.B.par }),
      layout: () => { const l = L(); return { land: l.land, face: l.face.box, btns: l.btns, tabs: l.tabRects, w: meta.width, h: meta.height }; },
    },
  };
}
