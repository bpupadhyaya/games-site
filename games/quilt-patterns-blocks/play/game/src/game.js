// Quilt Patterns: state and flow. Geometry = blocks.js, rules = rules.js, challenges = gen.js, drawing = view.js + art.js, layout = layout.js.
import { playLayout, titleLayout, docLayout, settingsLayout, pickLayout, galleryLayout, showLayout, backFooter, pauseLayout, playOpts, toolsFor, inRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { blockOf, pickPatch, BLOCK_IDS } from './blocks.js';
import { fab } from './fabrics.js';
import { evaluate, quiltGeo, SASH_NAME } from './rules.js';
import { makeChallenge, makeLesson, makeDaily, studioChallenge, STARTER_TILES, newDesign, plan, explain, applyStep, starsFor, LESSONS, CARDS } from './gen.js';
import { render, metrics, SETTINGS, pickItems, fmtTime } from './view.js';
import { docOf } from './content.js';
import { setLook, LOOK_IDS } from './ui.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen; everything lays out from the live size.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_TASKS = 3;
const DEFAULT_PREFS = { look: 'hearth', hand: 'right', timer: true, labels: true, sound: true, calm: false, textIdx: 0, thinkIdx: 1 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clone = (x) => JSON.parse(JSON.stringify(x));
const KEY_NUM = (code) => { const m = /^(?:Digit|Numpad)([1-9])$/.exec(code); return m ? Number(m[1]) : 0; };

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS },
    ch: null, d: null, un: [], re: [], moves: 0, hints: 0, secs: 0, done: false, ev: { items: [], complete: false, done: false },
    fab: '', roleFill: false, squint: false, sel: -1, tab: 'tiles', tileSel: 0, rot: 0, pop: [], pressT: 0, finished: false, winDelay: 0,
    hint: null, paused: false, auto: { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, stage: 'block', last: null },
    msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0 }, back: 'title', show: null, sparks: [], sfx: [],
    stats: { stars: {}, done: {}, days: [], bestStreak: 0 }, shelf: [], gallery: [], seq: {}, saved: null,
    daily: { day: config.day ?? 0 }, streak: 0, dailyDone: false, dailyInfo: '', demoCount: 0, saveAcc: 0, studioBlock: 'nine-patch',
    dev: config.dev === true,
  };
  let saveRaw = null, stroke = null, gesture = null;

  // ---- persistence ---------------------------------------------------------------------------------------------------------
  const applyPrefs = () => { setLook(S.prefs.look); audio.setMuted?.(!S.prefs.sound); };
  const savePrefs = () => storage.set('prefs', S.prefs);
  const saveStats = () => storage.set('stats', S.stats);
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); if (!LOOK_IDS.includes(S.prefs.look)) S.prefs.look = 'hearth'; } applyPrefs(); });
  storage.get('stats', null).then((v) => { if (v) S.stats = { stars: v.stars ?? {}, done: v.done ?? {}, days: v.days ?? [], bestStreak: v.bestStreak ?? 0 }; refreshDaily(); });
  storage.get('shelf', []).then((v) => { if (Array.isArray(v) && !S.shelf.length) S.shelf = v; });
  storage.get('gallery', []).then((v) => { if (Array.isArray(v) && !S.gallery.length) S.gallery = v; });
  storage.get('seq', {}).then((v) => { S.seq = { ...v, ...S.seq }; });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  storage.get('save', null).then((v) => { if (v && v.ch && S.scene === 'title' && !S.ch) { saveRaw = v; S.saved = { title: v.ch.title, t: v.secs }; } });
  applyPrefs();

  function refreshDaily() {
    const day = S.daily.day, set = new Set(S.stats.days);
    let streak = 0, d = set.has(day) ? day : day - 1;
    while (set.has(d)) { streak += 1; d -= 1; }
    S.streak = streak; S.dailyDone = set.has(day);
    S.dailyInfo = S.dailyDone ? 'Done today' : streak ? `${streak} day streak` : 'A new brief every day';
  }
  refreshDaily();
  function persistSession() {
    if (!S.ch || S.done || S.auto.on) return;
    saveRaw = { ch: S.ch, d: S.d, moves: S.moves, hints: S.hints, secs: S.secs, fab: S.fab, tab: S.tab, tileSel: S.tileSel, rot: S.rot };
    S.saved = { title: S.ch.title, t: S.secs };
    storage.set('save', saveRaw);
  }
  const clearSave = () => { saveRaw = null; S.saved = null; storage.remove('save'); };

  // ---- sound -------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound && !S.auto.on) audio.tone(o); };
  const later = (t, o) => S.sfx.push({ t, o });
  const sfx = {
    stitch: () => tone({ freq: 520, to: 380, dur: 0.06, type: 'triangle', vol: 0.09 }),
    pick: () => tone({ freq: 700, to: 640, dur: 0.035, type: 'sine', vol: 0.05 }),
    undo: () => tone({ freq: 300, to: 200, dur: 0.07, type: 'triangle', vol: 0.06 }),
    turn: () => tone({ freq: 440, to: 560, dur: 0.07, type: 'sine', vol: 0.07 }),
    tick: () => tone({ freq: 880, to: 990, dur: 0.1, type: 'sine', vol: 0.08 }),
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.08 }),
    press: () => { [392, 523, 659, 784].forEach((f, i) => later(i * 0.1, { freq: f, to: f * 1.005, dur: 0.38, type: 'triangle', vol: 0.08 })); },
  };

  // ---- helpers -------------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.4) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; stroke = null; gesture = null; wheelInput.dy = 0; S.msg = null; }
  const L = () => playLayout(meta.width, meta.height, playOpts(S));
  function spark(cx, cy, n, color) {
    for (let i = 0; i < n; i++) { const a = rng.next() * Math.PI * 2, v = 80 + rng.next() * 260; S.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0, life: 0.7 + rng.next() * 0.6, r: 3 + rng.next() * 4, c: color }); }
    if (S.sparks.length > 160) S.sparks.splice(0, S.sparks.length - 160);
  }
  const nPieces = () => (S.ch.kind === 'block' ? blockOf(S.ch.block).patches.length : S.ch.cols * S.ch.cols);
  const refresh = () => { S.ev = evaluate(S.ch, S.d); };

  // ---- starting tasks ---------------------------------------------------------------------------------------------------------------
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_TASKS) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }
  function begin(ch, extra = {}) {
    S.ch = ch; S.d = newDesign(ch);
    if (ch.mode === 'studio' && ch.kind === 'quilt') ch.tiles = (S.shelf.length ? S.shelf.slice(-6) : STARTER_TILES()).map(clone);
    S.un = []; S.re = []; S.moves = 0; S.hints = 0; S.secs = 0; S.done = false; S.finished = false; S.winDelay = 0; S.pressT = 0;
    S.fab = ch.kind === 'block' ? ch.tray[0] : ''; S.roleFill = false; S.squint = false; S.sel = -1; S.tab = 'tiles'; S.tileSel = 0; S.rot = 0;
    S.pop = new Array(ch.kind === 'block' ? blockOf(ch.block).patches.length : ch.cols * ch.cols).fill(99);
    S.hint = null; S.paused = false; S.msg = null; S.show = null; S.saveAcc = 0;
    S.auto = { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, stage: 'block', last: null, ...extra };
    refresh(); go('play');
  }
  function nextSeed(cardId) { S.seq[cardId] = (S.seq[cardId] ?? rng.int(1 << 20)) + 1; storage.set('seq', S.seq); return S.seq[cardId]; }
  function startCard(cardId) {
    if (demoBlocked()) return;
    const ch = makeChallenge(cardId, nextSeed(cardId));
    begin(ch); persistSession();
  }
  function startLesson(id) { if (demoBlocked()) return; begin(makeLesson(id)); persistSession(); }
  function startDaily() { if (demoBlocked()) return; begin(makeDaily(S.daily.day)); persistSession(); }
  function startStudio(kind) { begin(studioChallenge(kind, S.studioBlock, kind === 'quilt' ? [] : null)); }
  function resumeSaved() {
    const v = saveRaw;
    if (!v) return;
    begin(v.ch);
    S.d = v.d; S.moves = v.moves; S.hints = v.hints; S.secs = v.secs; S.fab = v.fab; S.tab = v.tab; S.tileSel = v.tileSel; S.rot = v.rot; refresh();
    say('Welcome back.', 1.6);
  }
  function startAuto() {
    const ch = makeChallenge(['brief1', 'brief1', 'copy1'][rng.int(3)], rng.int(1 << 20) + 1);
    begin(ch, { on: true, stage: 'block' });
    say('Watch the game design a block, then a quilt, and explain each choice.', 2.4);
  }

  // ---- making changes ---------------------------------------------------------------------------------------------------------------------
  function snap() { S.un.push(JSON.stringify(S.d)); if (S.un.length > 200) S.un.shift(); S.re.length = 0; }
  function changed() {
    S.hint = null; refresh(); persistSessionSoon();
    if (!S.done && S.ev.done && S.ch.mode !== 'studio') finish();
  }
  const persistSessionSoon = () => { S.saveAcc = 99; };
  function paintAt(i, fid) {
    const ch = S.ch, block = blockOf(ch.block);
    const idx = S.roleFill ? block.byRole[block.patches[i].role] : [i];
    const todo = idx.filter((j) => S.d.paint[j] !== fid);
    if (!todo.length) return false;
    if (!stroke || !stroke.counted) { snap(); S.moves += 1; if (stroke) stroke.counted = true; }
    for (const j of todo) { S.d.paint[j] = fid; S.pop[j] = 0; }
    sfx.stitch(); changed();
    return true;
  }
  function cellAt(x, y) {
    const b = L().board, g = quiltGeo(S.d, S.ch.cols, b.w);
    for (let i = 0; i < g.cells.length; i++) { const c = g.cells[i]; if (x >= b.x + c.x && x <= b.x + c.x + c.s && y >= b.y + c.y && y <= b.y + c.y + c.s) return i; }
    return -1;
  }
  function placeCell(i) {
    const c = S.d.cells[i];
    if (S.tileSel < 0 || S.tileSel >= S.ch.tiles.length) { say('Choose a block in the tray first.'); return; }
    snap(); S.moves += 1;
    if (c.t === S.tileSel && c.r === S.rot) { c.r = (c.r + 1) % 4; S.rot = c.r; sfx.turn(); } else { S.d.cells[i] = { t: S.tileSel, r: S.rot }; sfx.stitch(); }
    S.pop[i] = 0; changed();
  }
  function setQuiltPart(part, value) {
    const d = S.d; snap(); S.moves += 1;
    if (part === 'sashw') d.sashW = value; else if (part === 'bordw') d.bordW = value;
    else if (part === 'sashf') { d.sashF = value; if (!d.sashW) d.sashW = 1; } else { d.bordF = value; if (!d.bordW) d.bordW = 1; }
    sfx.stitch(); changed();
  }
  function doUndo() { if (!S.un.length) { say('Nothing to undo.', 1.4); return; } S.re.push(JSON.stringify(S.d)); S.d = JSON.parse(S.un.pop()); S.hint = null; sfx.undo(); refresh(); persistSessionSoon(); }
  function doRedo() { if (!S.re.length) { say('Nothing to redo.', 1.4); return; } S.un.push(JSON.stringify(S.d)); S.d = JSON.parse(S.re.pop()); S.hint = null; sfx.undo(); refresh(); persistSessionSoon(); }

  // ---- hints and Watch and Learn --------------------------------------------------------------------------------------------------------------
  function makeHint() {
    if (!S.ch.sol) return null;
    const steps = plan(S.ch, S.d);
    if (!steps.length) return null;
    const ex = explain(S.ch, steps[0]);
    return { stage: 'look', step: steps[0], ex, text: ex.look };
  }
  function askHint() {
    if (S.ch.mode === 'studio') { say('There are no rules in the Studio. Make what you like.'); return; }
    const h = makeHint();
    if (!h) { say('Nothing left to place. Check the rules on the card.'); return; }
    S.hints += 1; S.hint = h; sfx.hint();
  }
  function applyHintStep(step) {
    snap();
    applyStep(S.ch, S.d, step);
    if (step.op === 'paint') S.pop[step.i] = 0; else if (step.op === 'cell') S.pop[step.i] = 0;
    sfx.stitch(); changed();
  }
  function hintGo() {
    const h = S.hint;
    if (!h) return;
    if (h.stage === 'look') { h.stage = 'explain'; h.text = h.ex.why; sfx.pick(); return; }
    const step = h.step; S.hint = null; applyHintStep(step);
  }
  const words = (t) => t.split(' ').length;
  function autoTick(dt) {
    const a = S.auto;
    if (a.paused || a.done) return;
    if (a.phase === 'gap') { a.timer -= dt; if (a.timer <= 0) a.phase = null; return; }
    if (a.phase === 'stage') { a.timer -= dt; if (a.timer <= 0) startAutoQuilt(); return; }
    if (a.phase === 'think') {
      a.timer -= dt;
      if (a.timer > 0) return;
      S.hint.stage = 'explain'; S.hint.text = S.hint.ex.why; a.phase = 'reveal';
      a.timer = a.quick ? 0.9 + words(S.hint.text) * 0.05 : clamp(2 + words(S.hint.text) * 0.14, 2, 7);
      return;
    }
    if (a.phase === 'reveal') {
      a.timer -= dt;
      if (a.timer > 0) return;
      const step = S.hint.step; S.hint = null; applyHintStep(step); a.phase = 'gap'; a.timer = 0.3;
      return;
    }
    const h = makeHint();
    if (!h) {
      if (S.ev.done || S.done) { if (a.stage === 'block') { a.phase = 'stage'; a.timer = 2.2; S.hint = null; say('The block is pressed. Now a quilt from finished blocks.', 2.2); } else { a.done = true; S.hint = null; } } else a.done = true;
      return;
    }
    S.hint = h; a.n += 1; a.phase = 'think';
    const sig = `${h.step.op}|${h.step.role ?? ''}|${h.step.f ?? h.step.t ?? ''}`;
    a.quick = a.last === sig || a.n > 7; a.last = sig;
    const base = THINK_STEPS[S.prefs.thinkIdx];
    a.timer = a.quick ? Math.max(0.8, base * 0.25) : base;
  }
  function startAutoQuilt() {
    const ch = makeChallenge('qbrief2', rng.int(1 << 20) + 1);
    const n = S.auto.n;
    begin(ch, { on: true, stage: 'quilt', n });
  }

  // ---- finishing -----------------------------------------------------------------------------------------------------------------------
  function finish() {
    if (S.done) return;
    S.done = true; S.hint = null; S.pressT = 1.2; S.winDelay = 1.5; S.finished = true;
    sfx.press();
    const r = L().board; spark(r.x + r.w / 2, r.y + r.h / 2, 50, '#ffd45a');
    if (S.auto.on) { if (S.auto.stage === 'quilt') S.auto.done = true; S.winDelay = 0; S.pressT = 0.01; return; }
    const ch = S.ch, stars = starsFor(ch, S), id = ch.lesson ?? ch.id;
    S.stats.stars[id] = Math.max(S.stats.stars[id] ?? 0, stars); S.stats.done[id] = (S.stats.done[id] ?? 0) + 1;
    const lines = [];
    if (ch.daily !== undefined && ch.daily === S.daily.day && !S.stats.days.includes(ch.daily)) { S.stats.days.push(ch.daily); S.stats.days = S.stats.days.slice(-200); refreshDaily(); S.stats.bestStreak = Math.max(S.stats.bestStreak, S.streak); lines.push(`Daily streak: ${S.streak} day${S.streak === 1 ? '' : 's'}`); }
    if (ch.kind === 'block') {
      const entry = { type: ch.block, paint: S.d.paint.slice() };
      if (!S.shelf.some((e) => JSON.stringify(e) === JSON.stringify(entry))) { S.shelf.push(entry); S.shelf = S.shelf.slice(-12); storage.set('shelf', S.shelf); }
      lines.push('Added to My Blocks for Free Studio quilts.');
    } else {
      S.gallery.unshift({ name: `Quilt ${S.stats.done[id] + (S.gallery.length ? S.gallery.length : 0)}`, cols: ch.cols, tiles: clone(ch.tiles), d: clone(S.d) }); S.gallery = S.gallery.slice(0, 24); storage.set('gallery', S.gallery);
      lines.push('Hung in the Gallery.');
    }
    saveStats(); clearSave();
    monetization.track('task_finished', { id, kind: ch.kind, mode: ch.mode, moves: S.moves, hints: S.hints });
    lines.unshift(`${S.moves} move${S.moves === 1 ? '' : 's'} · ${S.hints} hint${S.hints === 1 ? '' : 's'} · ${fmtTime(S.secs)}`);
    const verb = ch.kind === 'quilt' ? 'Quilt pressed' : 'Block pressed';
    S.show = { kind: ch.kind, ch: clone(ch), d: clone(S.d), title: verb, stars, lines, lift: true, more: true, buttons: [{ label: ch.lesson ? (LESSONS[LESSONS.findIndex((l) => l.id === ch.lesson) + 1] ? 'Next lesson' : 'More lessons') : ch.daily !== undefined ? 'Back to menu' : 'Another one', accent: true, id: 'next' }, { label: 'Share', id: 'share' }, { label: 'Menu', id: 'menu' }] };
  }
  function shareText() {
    const v = S.show; if (!v) return '';
    return `Quilt Patterns: ${v.title.toLowerCase()} with ${v.stars} star${v.stars === 1 ? '' : 's'} (${v.ch.title}).`;
  }

  // ---- input --------------------------------------------------------------------------------------------------------------------------------
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

  function trayTap(l, tap) {
    const tr = l.tray, ch = S.ch;
    if (ch.kind === 'block') {
      for (let i = 0; i < ch.tray.length; i++) if (inRect(tr.items[i], tap.x, tap.y)) { S.fab = ch.tray[i]; sfx.pick(); return true; }
      return false;
    }
    const tabs = ['tiles', 'sash', 'border'];
    for (let i = 0; i < 3; i++) if (hitBtn('tab' + tabs[i], tr.tabs[i], tap)) { S.tab = tabs[i]; sfx.pick(); return true; }
    if (S.tab === 'tiles') {
      for (let i = 0; i < ch.tiles.length; i++) if (inRect(tr.items[i], tap.x, tap.y)) { if (S.tileSel === i) { S.rot = (S.rot + 1) % 4; sfx.turn(); } else { S.tileSel = i; sfx.pick(); } return true; }
      return false;
    }
    const sash = S.tab === 'sash';
    for (let i = 0; i < 3; i++) if (hitBtn('chip' + i, tr.chips[i], tap)) { if ((sash ? S.d.sashW : S.d.bordW) !== i) setQuiltPart(sash ? 'sashw' : 'bordw', i); return true; }
    for (let i = 0; i < ch.tray.length; i++) if (inRect(tr.items[i], tap.x, tap.y)) { if ((sash ? S.d.sashF : S.d.bordF) !== ch.tray[i] || !(sash ? S.d.sashW : S.d.bordW)) setQuiltPart(sash ? 'sashf' : 'bordf', ch.tray[i]); return true; }
    return false;
  }
  function saveStudio() {
    const ch = S.ch;
    if (ch.kind === 'block') {
      if (!S.d.paint.every(Boolean)) { say('Fill every piece first.'); return; }
      const entry = { type: ch.block, paint: S.d.paint.slice() };
      if (!S.shelf.some((e) => JSON.stringify(e) === JSON.stringify(entry))) { S.shelf.push(entry); S.shelf = S.shelf.slice(-12); storage.set('shelf', S.shelf); }
      sfx.tick(); say('Added to My Blocks.');
    } else {
      if (!S.d.cells.every((c) => c.t >= 0)) { say('Fill every square first.'); return; }
      S.gallery.unshift({ name: `Studio quilt ${S.gallery.length + 1}`, cols: ch.cols, tiles: clone(ch.tiles), d: clone(S.d) }); S.gallery = S.gallery.slice(0, 24); storage.set('gallery', S.gallery);
      S.pressT = 1; sfx.press(); say('Hung in the Gallery.');
    }
  }
  function toolTap(l, tap) {
    const ids = toolsFor(S.ch);
    for (let i = 0; i < ids.length; i++) {
      if (!hitBtn(ids[i], l.toolRects[i], tap)) continue;
      const id = ids[i];
      if (id === 'undo') doUndo(); else if (id === 'redo') doRedo();
      else if (id === 'role') { S.roleFill = !S.roleFill; sfx.pick(); say(S.roleFill ? 'Fill shape on: one tap paints the whole shape group.' : 'Fill shape off.', 1.8); }
      else if (id === 'squint') { S.squint = !S.squint; sfx.pick(); }
      else if (id === 'hint') askHint();
      else if (id === 'rotate') { S.rot = (S.rot + 1) % 4; sfx.turn(); }
      else if (id === 'save') saveStudio();
      return true;
    }
    return false;
  }
  function kbStep(dx, dy) {
    if (S.ch.kind === 'block') { const n = blockOf(S.ch.block).patches.length; S.sel = S.sel < 0 ? 0 : (S.sel + dx + dy + n) % n; }
    else { const n = S.ch.cols; if (S.sel < 0) S.sel = 0; else S.sel = clamp((S.sel % n) + dx, 0, n - 1) + clamp(Math.floor(S.sel / n) + dy, 0, n - 1) * n; }
  }

  function updatePlay(dt, tap, input) {
    const l = L(), p = input.pointer;
    if (!S.paused && !S.done && !S.auto.on) { S.secs += dt; S.saveAcc += dt; if (S.saveAcc > 6) { S.saveAcc = 0; persistSession(); } }
    if (S.auto.on && !S.auto.paused && !S.paused) autoTick(dt);
    if (S.winDelay > 0) { S.winDelay -= dt; if (S.winDelay <= 0 && S.show) go('show'); }
    const k = input.keys.pressed;
    if (!S.auto.on && !S.paused && !S.done) {
      for (const code of k) { const n = KEY_NUM(code); const list = S.ch.kind === 'block' ? S.ch.tray : S.ch.tiles; if (n && n <= list.length) { if (S.ch.kind === 'block') S.fab = S.ch.tray[n - 1]; else S.tileSel = n - 1; sfx.pick(); } }
      if (k.has('ArrowLeft')) kbStep(-1, 0); if (k.has('ArrowRight')) kbStep(1, 0); if (k.has('ArrowUp')) kbStep(0, -1); if (k.has('ArrowDown')) kbStep(0, 1);
      if ((k.has('Space') || k.has('Enter')) && S.sel >= 0) { if (S.ch.kind === 'block') paintAt(S.sel, S.fab); else placeCell(S.sel); }
      if (k.has('KeyU')) doUndo(); if (k.has('KeyY')) doRedo(); if (k.has('KeyS')) S.squint = !S.squint; if (k.has('KeyR')) { S.rot = (S.rot + 1) % 4; sfx.turn(); }
      if (k.has('KeyH')) { if (S.hint) hintGo(); else askHint(); }
    }
    if (k.has('KeyP') || k.has('Escape')) { if (S.auto.on) S.auto.paused = !S.auto.paused; else if (!S.done) { S.paused = !S.paused; if (S.paused) persistSession(); } }
    // painting strokes on the block: press and drag across pieces
    if (!S.paused && !S.auto.on && !S.done && !S.hint && S.ch.kind === 'block') {
      const b = l.board, inB = inRect(b, p.x, p.y);
      if (p.pressed && inB) stroke = { last: -1, counted: false };
      if (stroke && p.down && inB) {
        const i = pickPatch(blockOf(S.ch.block), (p.x - b.x) / b.w, (p.y - b.y) / b.w);
        if (i >= 0 && i !== stroke.last) { stroke.last = i; if (S.fab) paintAt(i, S.fab); S.sel = -1; }
      }
      if (p.released || !p.down) stroke = null;
      if (tap && inB) return;
    }
    if (!tap) return;
    if (S.paused) {
      const pl = pauseLayout(meta.width, meta.height, l.mat);
      if (hitBtn('resume', pl.resume, tap)) S.paused = false;
      else if (hitBtn('restart', pl.restart, tap)) { const ch = S.ch; begin(ch); persistSession(); }
      else if (hitBtn('psettings', pl.settings, tap)) { S.back = 'play'; go('settings'); }
      else if (hitBtn('pmenu', pl.menu, tap)) { persistSession(); S.paused = false; go('title'); }
      return;
    }
    if (S.auto.on) {
      if (hitBtn('aexit', l.rail.exit, tap)) { S.auto.on = false; S.hint = null; S.ch = null; S.d = null; go('title'); }
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
    if (S.ch.kind === 'quilt' && inRect(l.board, tap.x, tap.y)) { const i = cellAt(tap.x, tap.y); if (i >= 0) { S.sel = -1; if (S.tab !== 'tiles') S.tab = 'tiles'; placeCell(i); } return; }
    if (S.ch.mode === 'studio' && S.ch.kind === 'block') {
      const step = (dir) => { const i = (BLOCK_IDS.indexOf(S.studioBlock) + dir + BLOCK_IDS.length) % BLOCK_IDS.length; S.studioBlock = BLOCK_IDS[i]; startStudio('block'); sfx.pick(); };
      if (hitBtn('tprev', l.typePrev, tap)) return step(-1);
      if (hitBtn('tnext', l.typeNext, tap)) return step(1);
    }
    if (trayTap(l, tap)) return;
    toolTap(l, tap);
  }

  function changeSetting(i, k) {
    const id = SETTINGS[i].id, p = S.prefs;
    switch (id) {
      case 'look': p.look = LOOK_IDS[k]; setLook(p.look); break;
      case 'hand': p.hand = k === 1 ? 'left' : 'right'; break;
      case 'timer': p.timer = k === 0; break;
      case 'labels': p.labels = k === 0; break;
      case 'sound': p.sound = k === 0; audio.setMuted?.(!p.sound); break;
      case 'calm': p.calm = k === 1; break;
      case 'restore': monetization.restore().then(() => say('Purchases restored.', 2)).catch(() => {}); return;
      default: break;
    }
    savePrefs(); sfx.pick();
  }
  function textScale(dir) { const n = clamp(S.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (n !== S.prefs.textIdx) { S.prefs.textIdx = n; S.scrollY = 0; savePrefs(); } }
  function openLesson(id) { S.doc = { kind: 'lesson', page: 0, lesson: id }; S.back = 'pick'; go('doc'); }

  function updateScene(dt, input) {
    const p = input.pointer, scrolling = ['pick', 'doc', 'settings', 'stats', 'gallery', 'show'].includes(S.scene);
    const tap = getTap(p, scrolling ? metrics.rect : null);
    if (scrolling) {
      if (wheelInput.dy) { S.scrollY = clamp(S.scrollY + wheelInput.dy, 0, metrics.max); wheelInput.dy = 0; }
      const k = input.keys.pressed;
      if (k.has('ArrowDown')) S.scrollY = clamp(S.scrollY + 80, 0, metrics.max);
      if (k.has('ArrowUp')) S.scrollY = clamp(S.scrollY - 80, 0, metrics.max);
      S.scrollY = clamp(S.scrollY, 0, metrics.max);
    }
    const sc = S.scene, w = meta.width, h = meta.height;
    if (sc === 'play') return updatePlay(dt, tap, input);
    if (sc === 'title') {
      if (!tap) return;
      const B = titleLayout(w, h, !!S.saved).buttons;
      for (const id of Object.keys(B)) if (hitBtn(id, B[id], tap)) {
        sfx.pick();
        if (id === 'continue') resumeSaved();
        else if (id === 'play') go('pick');
        else if (id === 'daily') startDaily();
        else if (id === 'studio') { startStudio('block'); }
        else if (id === 'gallery') go('gallery');
        else if (id === 'learn') startAuto();
        else if (id === 'howto' || id === 'rules' || id === 'about') { S.doc = { kind: id, page: 0 }; go('doc'); }
        else if (id === 'stats') go('stats');
        else if (id === 'settings') { S.back = 'title'; go('settings'); }
        return;
      }
      const t = titleLayout(w, h, !!S.saved);
      if (Math.abs(tap.x - t.brand.x) < 260 && Math.abs(tap.y - t.brand.y) < 26) env.openArcforgeHome?.();
      return;
    }
    if (sc === 'pick') {
      const items = pickItems(), PL = pickLayout(w, h, items, TEXT_SCALES[S.prefs.textIdx]);
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', PL.back, tap)) { go('title'); return; }
      if (hitBtn('tdec', PL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', PL.textInc, tap)) return textScale(1);
      if (inRect(PL.body, tap.x, tap.y)) {
        items.forEach((it, i) => {
          if (it.t !== 'c') return;
          const r = { ...PL.rects[i], y: PL.rects[i].y - S.scrollY };
          if (inRect(r, tap.x, tap.y)) { sfx.pick(); if (it.lesson) openLesson(it.id); else startCard(it.id); }
        });
      }
      return;
    }
    if (sc === 'doc') {
      const DL = docLayout(w, h), doc = docOf(S.doc), n = doc.pages.length, lesson = S.doc.kind === 'lesson';
      if (input.keys.pressed.has('Escape')) { go(S.back === 'pick' ? 'pick' : 'title'); return; }
      if (input.keys.pressed.has('ArrowRight') && S.doc.page < n - 1) { S.doc.page += 1; S.scrollY = 0; }
      if (input.keys.pressed.has('ArrowLeft') && S.doc.page > 0) { S.doc.page -= 1; S.scrollY = 0; }
      if (!tap) return;
      if (hitBtn('back', DL.menu, tap)) go(lesson ? 'pick' : 'title');
      else if (lesson && hitBtn('next', DL.next, tap)) startLesson(S.doc.lesson);
      else if (!lesson && hitBtn('prev', DL.prev, tap) && S.doc.page > 0) { S.doc.page -= 1; S.scrollY = 0; }
      else if (!lesson && hitBtn('next', DL.next, tap) && S.doc.page < n - 1) { S.doc.page += 1; S.scrollY = 0; }
      else if (hitBtn('tdec', DL.textDec, tap)) textScale(-1);
      else if (hitBtn('tinc', DL.textInc, tap)) textScale(1);
      return;
    }
    if (sc === 'settings') {
      const SL = settingsLayout(w, h, TEXT_SCALES[S.prefs.textIdx], SETTINGS.length);
      const leave = () => { if (S.back === 'play' && S.ch) { S.scene = 'play'; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
      if (input.keys.pressed.has('Escape')) { leave(); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) return leave();
      if (hitBtn('tdec', SL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', SL.textInc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) {
        const ty = tap.y + S.scrollY;
        SETTINGS.forEach((row, i) => {
          const g = SL.rows[i], n = row.opts.length, cw = (g.ctrl.w - 8 * (n - 1)) / n;
          for (let k = 0; k < n; k++) { const r = { x: g.ctrl.x + k * (cw + 8), y: g.ctrl.y, w: cw, h: g.ctrl.h }; if (inRect(r, tap.x, ty)) { flash('set' + i + '.' + k); changeSetting(i, k); } }
        });
      }
      return;
    }
    if (sc === 'stats') {
      const SL = backFooter(w, h);
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) go('title');
      else if (hitBtn('tdec', SL.textDec, tap)) textScale(-1);
      else if (hitBtn('tinc', SL.textInc, tap)) textScale(1);
      return;
    }
    if (sc === 'gallery') {
      const GL = galleryLayout(w, h, S.gallery.length, TEXT_SCALES[S.prefs.textIdx]);
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', GL.back, tap)) return go('title');
      if (hitBtn('tdec', GL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', GL.textInc, tap)) return textScale(1);
      if (inRect(GL.body, tap.x, tap.y)) S.gallery.forEach((g, i) => {
        const r = { ...GL.cards[i], y: GL.cards[i].y - S.scrollY };
        if (inRect(r, tap.x, tap.y)) { S.show = { kind: 'quilt', ch: { cols: g.cols, tiles: g.tiles }, d: g.d, title: g.name, stars: 0, lines: ['Hand-quilted top, hung in your Gallery.'], lift: false, gallery: i, buttons: [{ label: 'Back to Gallery', accent: true, id: 'gal' }, { label: 'Remove from Gallery', id: 'del' }] }; go('show'); }
      });
      return;
    }
    if (sc === 'show') {
      const v = S.show;
      if (!v || !tap) return;
      const O = showLayout(w, h, v.buttons.length);
      v.buttons.forEach((b, i) => {
        if (!hitBtn('sb' + i, O.btns[i], tap)) return;
        sfx.pick();
        if (b.id === 'gal') go('gallery');
        else if (b.id === 'del') { S.gallery.splice(v.gallery, 1); storage.set('gallery', S.gallery); go('gallery'); }
        else if (b.id === 'share') env.share(shareText());
        else if (b.id === 'menu') go('title');
        else if (b.id === 'next') {
          const ch = v.ch;
          if (ch.lesson) { const nx = LESSONS[LESSONS.findIndex((l) => l.id === ch.lesson) + 1]; if (nx) openLesson(nx.id); else go('pick'); }
          else if (ch.daily !== undefined) go('title');
          else if (CARDS.some((c) => c.id === ch.id)) startCard(ch.id);
          else go('title');
        }
      });
      return;
    }
    if (sc === 'demo-limit' && tap) go('title');
  }

  return {
    update(dt, input) {
      S.t += dt; S.sceneT += dt;
      if (S.flash) { S.flash.t += dt; if (S.flash.t > 0.25) S.flash = null; }
      if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold) S.msg = null; }
      const frozen = S.paused || (S.auto.on && S.auto.paused);
      if (!frozen) {
        for (let i = 0; i < S.pop.length; i++) if (S.pop[i] < 90) { S.pop[i] += dt; if (S.pop[i] > 0.4) S.pop[i] = 99; }
        for (const sp of S.sparks) { sp.t += dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 600 * dt; }
        S.sparks = S.sparks.filter((sp) => sp.t < sp.life);
        if (S.pressT > 0) S.pressT -= dt;
        for (const q of S.sfx) q.t -= dt;
        const due = S.sfx.filter((q) => q.t <= 0); if (due.length) { S.sfx = S.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
      }
      if (S.saveAcc === 99 && S.scene === 'play') { S.saveAcc = 0; persistSession(); }
      // the kit's preview pill sits top centre; keep it clear of the board
      if (S.scene === 'play' && S.ch) { const l = L(); meta.previewBadge = l.mode === 'stacked' ? { x: l.pause.x - 10, y: l.hud.y + 40, align: 'right' } : { x: l.mat.x + l.mat.w / 2, y: l.mat.y + l.mat.h - 40, align: 'center' }; } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { render(ctx, S, view ?? meta); },
    getState: () => S,
    // Counts real play only: a live task in progress. Menus, Rules, settings, Watch and Learn, pause, results, Gallery are free.
    isPreviewExempt() { return !(S.scene === 'play' && !S.auto.on && !S.paused && S.ch && !S.done); },
    dev: {
      go: (scene, extra) => { Object.assign(S, extra ?? {}); go(scene); },
      card: (id, seed) => { begin(makeChallenge(id, seed ?? 3)); }, lesson: (id) => { begin(makeLesson(id)); }, daily: () => startDaily(), auto: () => startAuto(), studio: (k) => startStudio(k),
      hint: () => askHint(), hintGo: () => hintGo(), doc: (kind, page = 0, lesson) => { S.doc = { kind, page, lesson }; go('doc'); },
      fillTo: (n) => { const steps = plan(S.ch, S.d); for (const st of steps.slice(0, n)) { applyStep(S.ch, S.d, st); } refresh(); },
      solveNow: () => { for (const st of plan(S.ch, S.d)) applyStep(S.ch, S.d, st); refresh(); changed(); }, skipShow: () => { S.winDelay = 0.01; },
      tab: (t) => { S.tab = t; }, squint: (v) => { S.squint = v; }, layout: () => { const l = L(); return { mode: l.mode, mat: l.mat, board: l.board, tray: l.tray.items, tools: l.toolRects, w: meta.width, h: meta.height }; },
      gallery: () => { const ch = makeChallenge('qbrief2', 5); const d = newDesign(ch); for (const st of plan(ch, d)) applyStep(ch, d, st); S.gallery = [{ name: 'Quilt 1', cols: ch.cols, tiles: ch.tiles, d }]; },
    },
  };
}
