// Costa Rican Painted Oxcart: state and flow. Geometry = geo.js, puzzles and teacher = puzzle.js, orders = commissions.js,
// drawing = view.js + art.js, layout = layout.js, text = content.js.
import { playLayout, titleLayout, docLayout, settingsLayout, pickLayout, galleryLayout, shapeLayout, showLayout, backFooter, pauseLayout, playOpts, toolsFor, inRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { cellAt } from './geo.js';
import { pieceOf, evaluate, potLeft, breaks, plan, applyStep, revive, COLOR_NAME, cap } from './puzzle.js';
import { CAMPAIGN, commission, dailyCommission, dailyWarm, freeChallenge, FREE_SHAPES } from './commissions.js';
import { render, metrics, settingsRows, pickItems, fmtTime, boardRect } from './view.js';
import { toFrame, fromFrame } from './art.js';
import { docOf } from './content.js';
import { setLook, LOOK_IDS } from './ui.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_TASKS = 3;
const DEFAULT_PREFS = { look: 'workshop', hand: 'right', timer: true, marks: false, sound: true, calm: false, textIdx: 0, thinkIdx: 1 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clone = (x) => JSON.parse(JSON.stringify(x));
const stripPiece = (ch) => { const { piece, ...rest } = ch; return rest; };
const NOTES = [392, 440, 523, 587, 659, 784, 880];

export function createGame(env) {
  const { storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS },
    ch: null, a: [], un: [], re: [], moves: 0, smudges: 0, hints: 0, secs: 0, done: false, ev: { items: [], conflicts: [], complete: false, done: false, painted: 0 },
    pick: '', erase: false, pop: [], cursor: -1, press: -1, shake: null, hint: null, paused: false,
    auto: { on: false, phase: null, timer: 0, paused: false, n: 0, done: false },
    msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0 }, back: 'title', show: null, sparks: [], sfx: [], winDelay: 0,
    stats: { stars: {}, done: {}, days: [], bestStreak: 0 }, gallery: [], saved: null, freeShape: 'f3',
    demo: config.demo === true, owned: false, restoreBusy: false, daily: { day: config.day ?? 0 }, dailyReady: false, streak: 0, dailyDone: false, dailyInfo: '', demoCount: 0, saveAcc: 0, dev: config.dev === true,
  };
  let saveRaw = null, stroke = null, gesture = null;

  // ---- persistence ---------------------------------------------------------------------------------------------------------
  const applyPrefs = () => { setLook(S.prefs.look); audio.setMuted?.(!S.prefs.sound); };
  const savePrefs = () => storage.set('prefs', S.prefs);
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); if (!LOOK_IDS.includes(S.prefs.look)) S.prefs.look = 'workshop'; } applyPrefs(); });
  storage.get('stats', null).then((v) => { if (v) S.stats = { stars: v.stars ?? {}, done: v.done ?? {}, days: v.days ?? [], bestStreak: v.bestStreak ?? 0 }; refreshDaily(); });
  storage.get('gallery', []).then((v) => { if (Array.isArray(v) && !S.gallery.length) S.gallery = v; });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  storage.get('save', null).then((v) => { if (v && v.ch && S.scene === 'title' && !S.ch) { saveRaw = v; S.saved = { title: v.ch.title, t: v.secs }; } });
  applyPrefs();
  const saveStats = () => storage.set('stats', S.stats);

  function refreshDaily() {
    const day = S.daily.day, set = new Set(S.stats.days);
    let streak = 0, d = set.has(day) ? day : day - 1;
    while (set.has(d)) { streak += 1; d -= 1; }
    S.streak = streak; S.dailyDone = set.has(day);
    S.dailyInfo = S.dailyDone ? 'Done today' : streak ? `${streak} day streak` : 'A new order every day';
  }
  refreshDaily();
  function persistSession() {
    if (!S.ch || S.done || S.auto.on || S.ch.mode === 'free') return;
    saveRaw = { ch: stripPiece(S.ch), a: S.a, un: S.un, moves: S.moves, smudges: S.smudges, hints: S.hints, secs: S.secs, pick: S.pick };
    S.saved = { title: S.ch.title, t: S.secs };
    storage.set('save', saveRaw);
  }
  const clearSave = () => { saveRaw = null; S.saved = null; storage.remove('save'); };

  // ---- sound ----------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound) audio.tone(o); };
  const later = (t, o) => S.sfx.push({ t, o });
  const sfx = {
    brush: (k) => { const f = NOTES[k % NOTES.length]; tone({ freq: f * 0.96, to: f, dur: 0.09, type: 'triangle', vol: 0.09 }); later(0.05, { freq: f * 1.5, to: f * 1.48, dur: 0.06, type: 'sine', vol: 0.03 }); },
    pick: () => tone({ freq: 640, to: 700, dur: 0.04, type: 'sine', vol: 0.05 }),
    undo: () => tone({ freq: 300, to: 210, dur: 0.07, type: 'triangle', vol: 0.06 }),
    knock: () => { tone({ freq: 150, to: 110, dur: 0.09, type: 'square', vol: 0.05 }); later(0.1, { freq: 140, to: 100, dur: 0.09, type: 'square', vol: 0.05 }); },
    smudge: () => tone({ freq: 220, to: 170, dur: 0.14, type: 'sawtooth', vol: 0.04 }),
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.08 }),
    tick: () => tone({ freq: 880, to: 990, dur: 0.1, type: 'sine', vol: 0.08 }),
    chime: () => { [392, 523, 659, 784, 1046].forEach((f, i) => later(i * 0.1, { freq: f, to: f * 1.004, dur: 0.4, type: 'triangle', vol: 0.08 })); },
  };

  // ---- helpers ---------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.4) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; stroke = null; gesture = null; wheelInput.dy = 0; S.msg = null; }
  const L = () => playLayout(meta.width, meta.height, playOpts(S));
  const P = () => S.ch.piece;
  const refresh = () => { S.ev = evaluate(S.ch, S.a); };
  const left = () => potLeft(S.ch, S.a);
  const locked = (o) => S.ch.given.includes(o);
  function spark(cx, cy, n, colors) {
    for (let i = 0; i < n; i++) { const an = (i * 2.399) % (Math.PI * 2), v = 90 + ((i * 53) % 230); S.sparks.push({ x: cx, y: cy, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 90, t: 0, life: 0.8 + (i % 5) * 0.12, r: 3 + (i % 4), c: colors[i % colors.length] }); }
    if (S.sparks.length > 180) S.sparks.splice(0, S.sparks.length - 180);
  }

  // ---- starting work -------------------------------------------------------------------------------------------------------------
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_TASKS) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }
  function begin(ch, extra = {}) {
    S.ch = ch; S.a = ch.start.slice(); S.un = []; S.re = []; S.moves = 0; S.smudges = 0; S.hints = 0; S.secs = 0; S.done = false; S.winDelay = 0;
    S.pick = ch.colors[0]; S.erase = false; S.pop = new Array(ch.piece.cells.length).fill(99); S.cursor = -1; S.press = -1; S.shake = null;
    S.hint = null; S.paused = false; S.msg = null; S.show = null; S.saveAcc = 0; S.sparks = [];
    S.auto = { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, ...extra };
    refresh(); go('play');
    if (ch.tip && !extra.on && (S.stats.done[ch.id] ?? 0) === 0) say(ch.tip, 5);
  }
  function startCommission(id) { if (demoBlocked()) return; begin(commission(id)); persistSession(); }
  function startDaily() { if (demoBlocked()) return; begin(dailyCommission(S.daily.day)); persistSession(); }
  function startFree(shape) { if (demoBlocked()) return; S.freeShape = shape; begin(freeChallenge(shape)); }
  function resumeSaved() {
    const v = saveRaw;
    if (!v) return;
    const ch = revive(clone(v.ch));
    begin(ch);
    S.a = v.a.slice(); S.un = v.un ?? []; S.moves = v.moves; S.smudges = v.smudges ?? 0; S.hints = v.hints; S.secs = v.secs; S.pick = v.pick || ch.colors[0]; refresh();
    say('Welcome back.', 1.6);
  }
  function startAuto() {
    const pickIds = ['c5', 'c8', 'c10', 'c4'];
    const id = pickIds[(S.auto.n + (S.t | 0)) % pickIds.length];
    begin(commission(id), { on: true });
    say('Watch the workshop solve an order and explain every stroke.', 2.4);
  }
  const nextAfter = (ch) => { const i = CAMPAIGN.findIndex((c) => c.id === ch.id); return CAMPAIGN[i + 1]?.id ?? null; };

  // ---- painting --------------------------------------------------------------------------------------------------------------------
  const snap = () => { S.un.push(S.a.slice()); if (S.un.length > 300) S.un.shift(); S.re.length = 0; };
  function changed() {
    S.hint = null; refresh(); S.saveAcc = 99;
    if (!S.done && S.ev.done && S.ch.mode !== 'free') finish();
  }
  const popOrbit = (o) => { for (const c of P().orbits[o].cells) S.pop[c] = 0; };
  // paint set `o`; returns true when something changed. `free` strokes (hint application) never count as smudges.
  function paintSet(o, colour, { quiet = false } = {}) {
    if (locked(o)) { if (!quiet) { say('The master painted this one. It stays.', 1.8); sfx.knock(); } return false; }
    if (S.erase && !quiet) {
      if (!S.a[o]) return false;
      snap(); S.a[o] = ''; S.moves += 1; sfx.undo(); changed(); return true;
    }
    if (!colour || S.a[o] === colour) return false;
    const base = S.a.slice(); base[o] = '';
    const lf = potLeft(S.ch, base), size = P().orbits[o].cells.length;
    if (lf[colour] !== null && lf[colour] !== undefined && lf[colour] < size) {
      S.shake = { c: colour, t: 0 }; sfx.knock();
      say(lf[colour] <= 0 ? `The ${COLOR_NAME[colour]} pot is empty.` : `The ${COLOR_NAME[colour]} pot has only ${lf[colour]} left; this stroke paints ${size}.`, 2.2);
      return false;
    }
    snap();
    const bad = S.ch.mode !== 'free' && breaks(S.ch, base, o, colour);
    S.a[o] = colour; S.moves += 1; popOrbit(o);
    if (bad && !quiet) { S.smudges += 1; sfx.smudge(); } else sfx.brush(S.moves);
    changed();
    return true;
  }
  function doUndo() { if (!S.un.length) { say('Nothing to undo.', 1.4); return; } S.re.push(S.a.slice()); S.a = S.un.pop(); S.hint = null; sfx.undo(); refresh(); S.saveAcc = 99; }
  function doRedo() { if (!S.re.length) { say('Nothing to redo.', 1.4); return; } S.un.push(S.a.slice()); S.a = S.re.pop(); S.hint = null; sfx.undo(); refresh(); S.saveAcc = 99; }
  function clearFree() { snap(); S.a = S.ch.start.slice(); S.pop.fill(99); sfx.undo(); refresh(); }
  function saveFree() {
    if (!S.a.some(Boolean)) { say('Paint something first.'); return; }
    S.gallery.unshift({ title: `Free painting ${S.gallery.length + 1}`, geom: S.ch.geom, a: S.a.slice(), kind: S.ch.piece.kind }); S.gallery = S.gallery.slice(0, 24);
    storage.set('gallery', S.gallery); sfx.chime(); say('Hung in the Gallery.');
  }

  // ---- hints and Watch and Learn ---------------------------------------------------------------------------------------------------
  function makeHint() {
    if (S.ch.mode === 'free') return null;
    const step = plan(S.ch, S.a);
    return step ? { step, stage: 'look', text: step.text.look } : null;
  }
  function askHint() {
    if (S.ch.mode === 'free') { say('Free painting has no rules. Paint what you like.'); return; }
    const h = makeHint();
    if (!h) { say('Nothing left to paint. Check the brief.'); return; }
    S.hints += 1; S.hint = h; if (h.step.kind === 'place') S.pick = h.step.c; sfx.hint();
  }
  function applyHintStep(step) {
    if (step.kind === 'place') { S.pick = step.c; const e = S.erase; S.erase = false; paintSet(step.o, step.c, { quiet: true }); S.erase = e; }
    else { snap(); S.a[step.o] = ''; S.moves += 1; sfx.undo(); changed(); }
  }
  function hintGo() {
    const h = S.hint;
    if (!h) return;
    if (h.stage === 'look') { h.stage = 'explain'; h.text = h.step.text.why; sfx.pick(); return; }
    S.hint = null; applyHintStep(h.step);
  }
  const words = (t) => t.split(' ').length;
  function autoTick(dt) {
    const a = S.auto;
    if (a.paused || a.done) return;
    if (a.phase === 'gap') { a.timer -= dt; if (a.timer <= 0) a.phase = null; return; }
    if (a.phase === 'think') {
      a.timer -= dt;
      if (a.timer > 0) return;
      S.hint.stage = 'explain'; S.hint.text = S.hint.step.text.why; a.phase = 'reveal';
      a.timer = clamp(2 + words(S.hint.text) * 0.15, 2, 8);
      return;
    }
    if (a.phase === 'reveal') {
      a.timer -= dt;
      if (a.timer > 0) return;
      const step = S.hint.step; S.hint = null; applyHintStep(step); a.phase = 'gap'; a.timer = 0.4;
      return;
    }
    if (S.ev.done || S.done) { a.done = true; S.hint = null; return; }
    const h = makeHint();
    if (!h) { a.done = true; return; }
    S.hint = h; a.n += 1; a.phase = 'think';
    if (h.step.kind === 'place') S.pick = h.step.c;
    a.timer = THINK_STEPS[S.prefs.thinkIdx];
  }

  // ---- finishing --------------------------------------------------------------------------------------------------------------------
  const starsFor = () => (S.smudges <= 1 && S.hints === 0 ? 3 : S.smudges <= 4 && S.hints <= 2 ? 2 : 1);
  function finish() {
    if (S.done) return;
    S.done = true; S.hint = null; S.winDelay = 1.1;
    sfx.chime();
    const b = boardRect(L(), P());
    spark(b.x + b.w / 2, b.y + b.h / 2, 60, ['#ffd45a', '#ff6a55', '#52d38a', '#5ea0ff', '#ffffff']);
    const ch = S.ch, kind = ch.piece.kind, lines = [];
    const nm = kind === 'wheel' ? 'Wheel' : kind === 'panel' ? 'Side panel' : 'Yoke';
    if (S.auto.on) {
      S.show = { kind, ch: stripPiece(ch), a: S.a.slice(), title: `${nm} finished`, stars: 0, lines: ['The workshop painted this one for you, step by step.'], buttons: [{ label: 'Watch another', accent: true, id: 'again' }, { label: 'Menu', id: 'menu' }] };
      S.auto.done = true; S.winDelay = 1.4; return;
    }
    const stars = starsFor(), id = ch.id;
    S.stats.stars[id] = Math.max(S.stats.stars[id] ?? 0, stars); S.stats.done[id] = (S.stats.done[id] ?? 0) + 1;
    if (ch.daily !== undefined && ch.daily === S.daily.day && !S.stats.days.includes(ch.daily)) { S.stats.days.push(ch.daily); S.stats.days = S.stats.days.slice(-200); refreshDaily(); S.stats.bestStreak = Math.max(S.stats.bestStreak, S.streak); lines.push(`Daily streak: ${S.streak} day${S.streak === 1 ? '' : 's'}`); }
    S.gallery.unshift({ title: ch.title, geom: ch.geom, a: S.a.slice(), kind, stars }); S.gallery = S.gallery.slice(0, 24); storage.set('gallery', S.gallery);
    lines.unshift(`${S.moves} stroke${S.moves === 1 ? '' : 's'} · ${S.smudges} smudge${S.smudges === 1 ? '' : 's'} · ${S.hints} hint${S.hints === 1 ? '' : 's'} · ${fmtTime(S.secs)}`);
    lines.push('Hung in the Gallery.');
    saveStats(); clearSave();
    monetization.track('commission_finished', { id, kind, moves: S.moves, smudges: S.smudges, hints: S.hints });
    const nx = ch.daily !== undefined ? null : nextAfter(ch);
    S.show = { kind, ch: stripPiece(ch), a: S.a.slice(), title: `${nm} finished`, stars, lines, buttons: [{ label: nx ? 'Next commission' : 'More commissions', accent: true, id: 'next' }, { label: 'Share', id: 'share' }, { label: 'Menu', id: 'menu' }] };
  }
  const shareText = () => (S.show ? `Costa Rican Painted Oxcart: ${S.show.title.toLowerCase()} with ${S.show.stars} star${S.show.stars === 1 ? '' : 's'} (${S.show.ch.title}).` : '');

  // ---- input ---------------------------------------------------------------------------------------------------------------------------
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
  const hitBtn = (id, r, tap) => { if (inRect(r, tap.x, tap.y)) { flash(id); return true; } return false; };
  // Generous hit area for fingers: the painted frame (tyre / timber border) and a little beyond it count as the nearest edge segment.
  const SLOP = 26;
  const inBoard = (rect, x, y) => {
    if (inRect(rect, x, y)) return true;
    if (!inRect({ x: rect.x - SLOP, y: rect.y - SLOP, w: rect.w + 2 * SLOP, h: rect.h + 2 * SLOP }, x, y)) return false;
    const l = L();   // the slop never steals a tap meant for a pot, tool or the pause button
    return !(l.potRects.some((r) => inRect(r, x, y)) || l.toolRects.some((r) => inRect(r, x, y)) || inRect(l.pause, x, y) || (S.hint && Object.values(l.coachBtns).some((r) => inRect(r, x, y))));
  };
  const orbitAtPoint = (x, y) => {
    const l = L(), rect = boardRect(l, P());
    if (!inBoard(rect, x, y)) return -1;
    let [u, v] = toFrame(P(), rect, x, y);
    const g = P().geom;
    if (g.kind === 'wheel') { const r = Math.hypot(u, v); if (r > 0.9 && r < 1.12) { u *= 0.89 / r; v *= 0.89 / r; } }
    else { u = clamp(u, 0.001, g.cols - 0.001); v = clamp(v, 0.001, g.rows - 0.001); }
    const c = cellAt(P(), u, v);
    return c < 0 ? -1 : P().cells[c].orbit;
  };
  function toolTap(l, tap) {
    const ids = toolsFor(S.ch);
    for (let i = 0; i < ids.length; i++) {
      if (!hitBtn(ids[i], l.toolRects[i], tap)) continue;
      const id = ids[i];
      if (id === 'undo') doUndo(); else if (id === 'redo') doRedo();
      else if (id === 'erase') { S.erase = !S.erase; sfx.pick(); say(S.erase ? 'Eraser on: tap a segment to scrape it bare.' : 'Brush on.', 1.6); }
      else if (id === 'hint') askHint();
      else if (id === 'clear') clearFree();
      else if (id === 'save') saveFree();
      return true;
    }
    return false;
  }
  const choosePot = (i) => { const c = S.ch.colors[i]; if (!c) return; S.pick = c; S.erase = false; sfx.pick(); };
  const KEY_NUM = (code) => { const m = /^(?:Digit|Numpad)([1-9])$/.exec(code); return m ? Number(m[1]) : 0; };
  function kbMove(dx, dy) {
    const Pc = P(), n = Pc.orbits.length;
    if (S.cursor < 0) { S.cursor = 0; return; }
    // move to the nearest set in that direction by centre of its first cell
    const mid = (o) => { const c = Pc.cells[Pc.orbits[o].cells[0]]; return c.mid; };
    const cur = mid(S.cursor); let best = -1, bd = Infinity;
    for (let o = 0; o < n; o++) {
      if (o === S.cursor) continue;
      const m = mid(o), vx = m[0] - cur[0], vy = m[1] - cur[1], along = vx * dx + vy * dy;
      if (along <= 1e-6) continue;
      const d = Math.hypot(vx, vy) + Math.abs(vx * dy - vy * dx) * 2;
      if (d < bd) { bd = d; best = o; }
    }
    if (best >= 0) S.cursor = best; else S.cursor = (S.cursor + dx + dy + n) % n;
  }

  function updatePlay(dt, tap, input) {
    const l = L(), p = input.pointer, k = input.keys.pressed;
    if (!S.paused && !S.done && !S.auto.on) { S.secs += dt; S.saveAcc += dt; if (S.saveAcc > 6 && S.saveAcc !== 99) { S.saveAcc = 0; persistSession(); } }
    if (S.auto.on && !S.auto.paused && !S.paused) autoTick(dt);
    if (S.winDelay > 0) { S.winDelay -= dt; if (S.winDelay <= 0 && S.show) go('show'); }
    if (!S.auto.on && !S.paused && !S.done) {
      for (const code of k) { const n = KEY_NUM(code); if (n && n <= S.ch.colors.length) choosePot(n - 1); }
      if (k.has('ArrowLeft')) kbMove(-1, 0); if (k.has('ArrowRight')) kbMove(1, 0); if (k.has('ArrowUp')) kbMove(0, -1); if (k.has('ArrowDown')) kbMove(0, 1);
      if ((k.has('Space') || k.has('Enter')) && S.cursor >= 0) paintSet(S.cursor, S.pick);
      if (k.has('KeyE')) { S.erase = !S.erase; sfx.pick(); }
      if (k.has('KeyU')) doUndo(); if (k.has('KeyY')) doRedo();
      if (k.has('KeyH')) { if (S.hint) hintGo(); else askHint(); }
    }
    if (k.has('KeyP') || k.has('Escape')) { if (S.auto.on) S.auto.paused = !S.auto.paused; else if (!S.done) { S.paused = !S.paused; if (S.paused) persistSession(); } }
    // painting: press and drag across segments
    const live = !S.paused && !S.auto.on && !S.done && !S.hint;
    if (live) {
      const rect = boardRect(l, P()), inB = inBoard(rect, p.x, p.y);
      if (p.pressed && inB) stroke = { last: -1 };
      if (stroke && (p.down || p.pressed)) {
        const o = orbitAtPoint(p.x, p.y);
        S.press = o;
        if (o >= 0 && o !== stroke.last) { stroke.last = o; S.cursor = -1; paintSet(o, S.pick); }
      }
      if (p.released || !p.down) { stroke = null; S.press = -1; }
      if (tap && inBoard(rect, tap.x, tap.y)) return;
    } else { stroke = null; S.press = -1; }
    if (!tap) return;
    if (S.paused) {
      const pl = pauseLayout(meta.width, meta.height, l.board);
      if (hitBtn('resume', pl.resume, tap)) S.paused = false;
      else if (hitBtn('restart', pl.restart, tap)) { const ch = S.ch; begin(ch); persistSession(); }
      else if (hitBtn('psettings', pl.settings, tap)) { S.back = 'play'; go('settings'); }
      else if (hitBtn('pmenu', pl.menu, tap)) { persistSession(); S.paused = false; go('title'); }
      return;
    }
    if (S.auto.on) {
      if (hitBtn('aexit', l.rail.exit, tap)) { S.auto.on = false; S.hint = null; S.ch = null; S.a = []; go('title'); }
      else if (hitBtn('apause', l.rail.pause, tap)) S.auto.paused = !S.auto.paused;
      else if (hitBtn('adec', l.rail.dec, tap)) { if (S.prefs.thinkIdx > 0) { S.prefs.thinkIdx -= 1; savePrefs(); } }
      else if (hitBtn('ainc', l.rail.inc, tap)) { if (S.prefs.thinkIdx < THINK_STEPS.length - 1) { S.prefs.thinkIdx += 1; savePrefs(); } }
      return;
    }
    if (S.done) return;
    if (hitBtn('pause', l.pause, tap)) { S.paused = true; persistSession(); return; }
    if (S.hint) {
      if (hitBtn('close', l.coachBtns.close, tap)) S.hint = null;
      else if (hitBtn('go', l.coachBtns.go, tap)) hintGo();
      return;
    }
    for (let i = 0; i < l.potRects.length; i++) if (inRect(l.potRects[i], tap.x, tap.y)) { flash('pot' + i); choosePot(i); return; }
    toolTap(l, tap);
  }

  function changeSetting(i, kx) {
    const id = settingsRows(S)[i].id, p = S.prefs;
    switch (id) {
      case 'look': p.look = LOOK_IDS[kx]; setLook(p.look); break;
      case 'hand': p.hand = kx === 1 ? 'left' : 'right'; break;
      case 'timer': p.timer = kx === 0; break;
      case 'marks': p.marks = kx === 0; break;
      case 'sound': p.sound = kx === 0; audio.setMuted?.(!p.sound); break;
      case 'calm': p.calm = kx === 1; break;
      case 'restore': {
        if (S.owned) { say('Full game unlocked.', 2); return; }
        if (S.restoreBusy) { say('Still checking with the store...', 2); return; }
        S.restoreBusy = true; say('Checking with the store...', 2);
        monetization.restore().then(() => { S.owned = monetization.owns('unlock_game'); say(S.owned ? 'Full game unlocked.' : 'No earlier purchase was found for this account.', 2.6); })
          .catch(() => say('Could not reach the store. Try again later.', 2.6)).finally(() => { S.restoreBusy = false; });
        return;
      }
      default: break;
    }
    savePrefs(); sfx.pick();
  }
  function textScale(dir) { const n = clamp(S.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (n !== S.prefs.textIdx) { S.prefs.textIdx = n; S.scrollY = 0; savePrefs(); } }
  function openGalleryItem(i) {
    const g = S.gallery[i], nm = g.kind === 'wheel' ? 'Wheel' : g.kind === 'panel' ? 'Side panel' : 'Yoke';
    S.show = { kind: g.kind, ch: { geom: g.geom, title: g.title }, a: g.a, title: g.title, stars: g.stars ?? 0, lines: [`${nm} from your Gallery.`], gallery: i, buttons: [{ label: 'Back to Gallery', accent: true, id: 'gal' }, { label: 'Remove from Gallery', id: 'del' }] };
    go('show');
  }

  function updateScene(dt, input) {
    const p = input.pointer, scrolling = ['pick', 'doc', 'settings', 'stats', 'gallery', 'show', 'shapes'].includes(S.scene);
    const tap = getTap(p, scrolling ? metrics.rect : null);
    if (scrolling) {
      if (wheelInput.dy) { S.scrollY = clamp(S.scrollY + wheelInput.dy, 0, metrics.max); wheelInput.dy = 0; }
      const k = input.keys.pressed;
      if (k.has('ArrowDown')) S.scrollY = clamp(S.scrollY + 80, 0, metrics.max);
      if (k.has('ArrowUp')) S.scrollY = clamp(S.scrollY - 80, 0, metrics.max);
      S.scrollY = clamp(S.scrollY, 0, metrics.max);
    }
    const sc = S.scene, w = meta.width, h = meta.height, esc = input.keys.pressed.has('Escape');
    if (sc === 'play') return updatePlay(dt, tap, input);
    if (sc === 'title') {
      if (!tap) return;
      const T = titleLayout(w, h, !!S.saved), B = T.buttons;
      for (const id of Object.keys(B)) if (hitBtn(id, B[id], tap)) {
        sfx.pick();
        if (id === 'continue') resumeSaved();
        else if (id === 'play') go('pick');
        else if (id === 'daily') startDaily();
        else if (id === 'free') go('shapes');
        else if (id === 'gallery') go('gallery');
        else if (id === 'learn') startAuto();
        else if (id === 'howto' || id === 'rules' || id === 'about') { S.doc = { kind: id, page: 0 }; go('doc'); }
        else if (id === 'stats') go('stats');
        else if (id === 'settings') { S.back = 'title'; go('settings'); }
        return;
      }
      if (Math.abs(tap.x - T.brand.x) < 260 && Math.abs(tap.y - T.brand.y) < 26) env.openArcforgeHome?.();
      return;
    }
    if (sc === 'pick') {
      const items = pickItems(), PL = pickLayout(w, h, items, TEXT_SCALES[S.prefs.textIdx]);
      if (esc) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', PL.back, tap)) { go('title'); return; }
      if (inRect(PL.body, tap.x, tap.y)) items.forEach((it, i) => {
        if (it.t !== 'c') return;
        const r = { ...PL.rects[i], y: PL.rects[i].y - S.scrollY };
        if (inRect(r, tap.x, tap.y)) { sfx.pick(); startCommission(it.id); }
      });
      return;
    }
    if (sc === 'shapes') {
      const SL = shapeLayout(w, h, FREE_SHAPES.length, TEXT_SCALES[S.prefs.textIdx]);
      if (esc) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) return go('title');
      if (hitBtn('tdec', SL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', SL.textInc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) FREE_SHAPES.forEach((sh, i) => { const r = { ...SL.cards[i], y: SL.cards[i].y - S.scrollY }; if (inRect(r, tap.x, tap.y)) { sfx.pick(); startFree(sh.id); } });
      return;
    }
    if (sc === 'doc') {
      const DL = docLayout(w, h), doc = docOf(S.doc), n = doc.pages.length;
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
      const SL = settingsLayout(w, h, TEXT_SCALES[S.prefs.textIdx], settingsRows(S).length);
      const leave = () => { if (S.back === 'play' && S.ch) { S.scene = 'play'; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
      if (esc) { leave(); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) return leave();
      if (hitBtn('tdec', SL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', SL.textInc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) {
        const ty = tap.y + S.scrollY;
        settingsRows(S).forEach((row, i) => {
          const g = SL.rows[i], n = row.opts.length, cw = (g.ctrl.w - 8 * (n - 1)) / n;
          for (let kx = 0; kx < n; kx++) { const r = { x: g.ctrl.x + kx * (cw + 8), y: g.ctrl.y, w: cw, h: g.ctrl.h }; if (inRect(r, tap.x, ty)) { flash(`set${i}.${kx}`); changeSetting(i, kx); } }
        });
      }
      return;
    }
    if (sc === 'stats') {
      const SL = backFooter(w, h);
      if (esc) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) go('title');
      else if (hitBtn('tdec', SL.textDec, tap)) textScale(-1);
      else if (hitBtn('tinc', SL.textInc, tap)) textScale(1);
      return;
    }
    if (sc === 'gallery') {
      const GL = galleryLayout(w, h, S.gallery.length);
      if (esc) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', GL.back, tap)) return go('title');
      if (hitBtn('tdec', GL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', GL.textInc, tap)) return textScale(1);
      if (inRect(GL.body, tap.x, tap.y)) S.gallery.forEach((g, i) => { const r = { ...GL.cards[i], y: GL.cards[i].y - S.scrollY }; if (inRect(r, tap.x, tap.y)) openGalleryItem(i); });
      return;
    }
    if (sc === 'show') {
      const v = S.show;
      if (!v || !tap) return;
      const O = showLayout(w, h, v.buttons.length);
      if (inRect(O.pic, tap.x, tap.y)) { S.sceneT = 0; return; }
      v.buttons.forEach((b, i) => {
        if (!hitBtn(`sb${i}`, O.btns[i], tap)) return;
        sfx.pick();
        if (b.id === 'gal') go('gallery');
        else if (b.id === 'del') { S.gallery.splice(v.gallery, 1); storage.set('gallery', S.gallery); go('gallery'); }
        else if (b.id === 'share') env.share(shareText());
        else if (b.id === 'menu') { S.ch = null; S.auto.on = false; go('title'); }
        else if (b.id === 'again') startAuto();
        else if (b.id === 'next') { const nx = v.ch.daily !== undefined ? null : nextAfter(v.ch); if (nx) startCommission(nx); else go('pick'); }
      });
      return;
    }
    if (sc === 'demo-limit' && tap) go('title');
  }

  function animate(dt) {
    S.t += dt; S.sceneT += dt;
    // while the player is in a menu, prepare today's daily commission a slice at a time (one search attempt every few frames)
    if ((S.scene === 'title' || S.scene === 'pick') && S.t > 0.8 && !S.dailyReady && Math.floor(S.t * 20) !== Math.floor((S.t - dt) * 20)) S.dailyReady = dailyWarm(S.daily.day);
    if (S.flash) { S.flash.t += dt; if (S.flash.t > 0.25) S.flash = null; }
    if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold) S.msg = null; }
    if (S.shake) { S.shake.t += dt; if (S.shake.t > 0.4) S.shake = null; }
    const frozen = S.paused || (S.auto.on && S.auto.paused);
    if (frozen) return;
    for (let i = 0; i < S.pop.length; i++) if (S.pop[i] < 90) { S.pop[i] += dt; if (S.pop[i] > 0.45) S.pop[i] = 99; }
    for (const sp of S.sparks) { sp.t += dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 600 * dt; }
    S.sparks = S.sparks.filter((sp) => sp.t < sp.life);
    for (const q of S.sfx) q.t -= dt;
    const due = S.sfx.filter((q) => q.t <= 0); if (due.length) { S.sfx = S.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
  }
  // Store screenshots (?shot=1&seed=N): main.js asks for a showcase scene, input is ignored and only animations run.
  function showcase(n) {
    const fill = (k) => { for (let i = 0; i < k; i++) { const st = plan(S.ch, S.a); if (!st) break; applyStep(S.a, st); } refresh(); };
    S.shot = true; S.prefs.sound = false;
    switch (n) {
      case 2: begin(commission('c4')); fill(5); break;
      case 3: begin(commission('c10')); fill(7); break;
      case 4: begin(commission('c22')); fill(9); break;
      case 5: begin(commission('c4')); for (;;) { const st = plan(S.ch, S.a); if (!st) break; applyStep(S.a, st); S.moves += 1; } S.secs = 94; refresh(); changed(); S.sceneT = 0; go('show'); break;
      case 6: begin(commission('c9')); fill(3); askHint(); break;
      case 7: go('pick'); break;
      case 8: begin(freeChallenge('f6')); S.ch.piece.orbits.forEach((o, i) => { S.a[i] = ['red', 'yellow', 'blue', 'green', 'orange', 'white'][(i * 5 + o.ring) % 6]; }); refresh(); break;
      default: go('title');
    }
  }

  return {
    update(dt, input) {
      animate(dt);
      S.owned = monetization.owns('unlock_game');
      if (S.shot) return;
      if (S.saveAcc === 99 && S.scene === 'play') { S.saveAcc = 0; persistSession(); }
      // the kit's preview pill sits top centre; keep it clear of the board
      if (S.scene === 'play' && S.ch) { const l = L(); meta.previewBadge = { x: l.pause.x - 10, y: l.hud.y + 40, align: 'right' }; } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { render(ctx, S, view ?? meta); },
    getState: () => S,
    // Counts real play only: a live commission or free painting in progress. Menus, Rules, settings, Watch and Learn, pause, results, Gallery are free.
    isPreviewExempt() { return !(S.scene === 'play' && !S.auto.on && !S.paused && S.ch && !S.done); },
    dev: {
      shot: showcase,
      go: (scene, extra) => { Object.assign(S, extra ?? {}); go(scene); },
      commission: (id) => { begin(commission(id)); }, daily: () => startDaily(), auto: () => startAuto(), free: (id) => startFree(id),
      restore: () => changeSetting(settingsRows(S).findIndex((r) => r.id === 'restore'), 0),
      hint: () => askHint(), hintGo: () => hintGo(), doc: (kind, page = 0) => { S.doc = { kind, page }; go('doc'); },
      fillTo: (n) => { for (let i = 0; i < n; i++) { const st = plan(S.ch, S.a); if (!st) break; applyStep(S.a, st); } refresh(); },
      solveNow: () => { for (;;) { const st = plan(S.ch, S.a); if (!st) break; applyStep(S.a, st); } refresh(); changed(); }, skipShow: () => { S.winDelay = 0.01; },
      layout: () => { const l = L(); return { mode: l.mode, board: l.board, pots: l.potRects, tools: l.toolRects, w: meta.width, h: meta.height }; },
      cellPoint: (o) => { const l = L(), Pc = P(), c = Pc.cells[Pc.orbits[o].cells[0]]; return fromFrame(Pc, boardRect(l, Pc), c.mid[0], c.mid[1]); },
      potPoint: (i) => { const r = L().potRects[i]; return [r.x + r.w / 2, r.y + r.h / 2]; },
      toolPoint: (i) => { const r = L().toolRects[i]; return [r.x + r.w / 2, r.y + r.h / 2]; },
      paint: (o, c) => { S.pick = c; return paintSet(o, c); },
      gallery: () => { const c = commission('c10'); const a = c.sol; S.gallery = [{ title: c.title, geom: c.geom, a, kind: c.piece.kind, stars: 3 }, { title: 'Wheel', geom: commission('c6').geom, a: commission('c6').sol, kind: 'wheel', stars: 2 }]; },
    },
  };
}
