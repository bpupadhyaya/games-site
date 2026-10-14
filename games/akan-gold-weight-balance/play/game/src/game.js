// Akan Gold-Weight Balance: state and flow. Rules = engine.js, session = play.js, drawing = view.js + weights.js, geometry = layout.js.
import { host, playLayout, titleLayout, docLayout, settingsLayout, listLayout, journeyRects, freeRects, overLayout, pauseLayout, inRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { RULES, RULE_IDS, bestMove, describeMove, makeOrder, journeyOrder, lcg } from './engine.js';
import { newSession, keysOf, itemsOn, place, nextSide, allowed, clearPans, canPour, pour, undoPour, solvedNow, overshoot, starsFor, arrange } from './play.js';
import { render, metrics, settingRows, shownModel, beamTarget } from './view.js';
import { DOCS, CHAPTERS } from './content.js';
import { setLook, LOOK_IDS } from './ui.js';
import { balanceGeo, slotPos } from './weights.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_ORDERS = 3;
const DAILY = ['bag', 'both', 'bag', 'right', 'both', 'bag', 'bag'];   // by weekday, 0 = Sunday
const DEFAULT_PREFS = { look: 'dusk', totals: true, sound: true, calm: false, lefty: false, textIdx: 0, thinkIdx: 1, autoRule: 0 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const levelKey = (ci, i) => `${ci}:${i}`;
export const totalLevels = () => CHAPTERS.reduce((a, c) => a + c.count, 0);

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS },
    P: null, drag: null, hint: null, paused: false, beam: { ang: 0, vel: 0 }, pour: null,
    auto: { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, queue: [], keys: [] },
    fx: { pop: {} }, sparks: [], winT: 0, winDelay: 0, sfx: [],
    msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0 }, back: 'title', result: null,
    progress: {}, stats: { solved: {}, starsTotal: {}, days: [], bestStreak: 0 }, saved: null,
    daily: { day: config.day ?? 0 }, streak: 0, dailyDone: false, dailyVariant: 'bag', demoCount: 0, saveAcc: 0, dev: config.dev === true, demo: config.demo === true, owned: monetization.owns('unlock_game'), restore: { busy: false, msg: '' },
  };
  let saveRaw = null, gesture = null, scrollG = null;

  // ---- persistence ---------------------------------------------------------------------------------------------------------
  const applyPrefs = () => { setLook(S.prefs.look); audio.setMuted?.(!S.prefs.sound); };
  const savePrefs = () => storage.set('prefs', S.prefs);
  const saveProgress = () => storage.set('progress', S.progress);
  const saveStats = () => storage.set('stats', S.stats);
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); if (!LOOK_IDS.includes(S.prefs.look)) S.prefs.look = 'dusk'; } applyPrefs(); });
  storage.get('progress', null).then((v) => { if (v) S.progress = { ...v, ...S.progress }; });
  storage.get('stats', null).then((v) => { if (v) S.stats = { ...S.stats, ...v, days: v.days ?? [], solved: v.solved ?? {}, starsTotal: v.starsTotal ?? {} }; refreshDaily(); });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  storage.get('save', null).then((v) => { if (v && v.order && S.scene === 'title' && !S.P) { saveRaw = v; S.saved = { variant: v.variant, kind: v.kind, pours: v.pours, level: v.level }; } });
  applyPrefs();

  function refreshDaily() {
    const day = S.daily.day, set = new Set(S.stats.days);
    let streak = 0, d = set.has(day) ? day : day - 1;
    while (set.has(d)) { streak += 1; d -= 1; }
    S.streak = streak; S.dailyDone = set.has(day); S.dailyVariant = DAILY[(((day + 4) % 7) + 7) % 7];
  }
  refreshDaily();
  function persistSession() {
    const P = S.P;
    if (!P || P.done || S.auto.on) return;
    saveRaw = { order: P.order, side: { ...P.side }, seq: P.seq.slice(), bag: P.bag, pours: P.pours, undo: P.undo.slice(-40), hints: P.hints, kind: P.kind, ref: P.ref, variant: P.variant, level: P.level };
    S.saved = { variant: P.variant, kind: P.kind, pours: P.pours, level: P.level };
    storage.set('save', saveRaw);
  }
  const clearSave = () => { saveRaw = null; S.saved = null; storage.remove('save'); };

  // ---- sound ------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound && !S.auto.on) audio.tone(o); };
  const toneAuto = (o) => { if (S.prefs.sound) audio.tone(o); };
  const later = (t, o) => S.sfx.push({ t, o });
  const sfx = {
    tink: (v = 0) => toneAuto({ freq: 1180 + (v % 5) * 90, to: 900, dur: 0.09, type: 'triangle', vol: 0.09 }),
    lift: () => tone({ freq: 700, to: 880, dur: 0.05, type: 'sine', vol: 0.06 }),
    err: () => tone({ freq: 190, to: 120, dur: 0.16, type: 'triangle', vol: 0.09 }),
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.06 }),
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.08 }),
    pour: () => { for (let i = 0; i < 7; i++) later(i * 0.1, { freq: 1500 + (i % 3) * 260, to: 1100, dur: 0.07, type: 'sine', vol: 0.045 }); },
    level: () => { later(0.7, { freq: 880, to: 880, dur: 0.18, type: 'triangle', vol: 0.07 }); later(0.84, { freq: 1175, to: 1175, dur: 0.25, type: 'triangle', vol: 0.07 }); },
    win: () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => later(i * 0.12, { freq: f, to: f, dur: 0.45, type: 'triangle', vol: 0.09 })); },
  };

  // ---- helpers -----------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.6) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; gesture = null; scrollG = null; S.drag = null; wheelInput.dy = 0; S.msg = null; }
  const nItems = () => (S.P ? keysOf(S.P).length : 4);
  const L = () => playLayout(meta.width, meta.height, { n: nItems(), coach: !!(S.hint || S.auto.on), lefty: S.prefs.lefty });
  const G = () => balanceGeo(L().scene, S.beam.ang);
  function spark(cx, cy, n, color) {
    for (let i = 0; i < n; i++) { const a = rng.next() * Math.PI * 2, v = 80 + rng.next() * 260; S.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0, life: 0.7 + rng.next() * 0.6, r: 3 + rng.next() * 4, c: color }); }
    if (S.sparks.length > 160) S.sparks.splice(0, S.sparks.length - 160);
  }
  const isDone = (ci, i) => !!S.progress[levelKey(ci, i)];
  const globalIndex = (ci, i) => CHAPTERS.slice(0, ci).reduce((a, c) => a + c.count, 0) + i;
  const unlocked = (ci, i) => {
    if (S.dev || config.demo) return true;
    const g = globalIndex(ci, i); if (g === 0) return true;
    const pc = i > 0 ? ci : ci - 1, pi = i > 0 ? i - 1 : CHAPTERS[ci - 1].count - 1;
    return isDone(pc, pi) || isDone(ci, i);
  };
  const nextLevel = (ci, i) => (i + 1 < CHAPTERS[ci].count ? [ci, i + 1] : ci + 1 < CHAPTERS.length ? [ci + 1, 0] : null);

  // ---- starting orders -------------------------------------------------------------------------------------------------------------
  function begin(P, extra = {}) {
    S.P = P; S.drag = null; S.hint = null; S.paused = false; S.msg = null; S.pour = null;
    S.auto = { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, queue: [], keys: [], ...extra };
    S.fx = { pop: {} }; S.sparks = []; S.winT = 0; S.winDelay = 0; S.result = null; S.saveAcc = 0;
    S.beam = { ang: 0, vel: 0 };
    go('play');
  }
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_ORDERS) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }
  function startLevel(ci, i) {
    if (!unlocked(ci, i)) { say('Serve the previous order first.', 2); return; }
    if (demoBlocked()) return;
    const order = journeyOrder(ci, i);
    begin(newSession({ order, kind: 'journey', ref: levelKey(ci, i), variant: CHAPTERS[ci].rule, level: globalIndex(ci, i) }));
    persistSession();
  }
  function startFree(rule, tier) {
    if (demoBlocked()) return;
    const order = makeOrder(rule, tier, (n) => rng.int(n));
    begin(newSession({ order, kind: 'free', ref: `${rule}:${tier}`, variant: rule, level: tier }));
    persistSession();
  }
  function startDaily() {
    if (demoBlocked()) return;
    const rule = S.dailyVariant, day = S.daily.day, order = makeOrder(rule, 1 + (((day % 2) + 2) % 2), lcg(day * 7919 + 13));
    begin(newSession({ order, kind: 'daily', ref: `day:${day}`, variant: rule, level: 1 }));
    S.P.day = day;
    persistSession();
  }
  function resumeSaved() {
    const v = saveRaw;
    if (!v) return;
    const P = newSession({ order: v.order, kind: v.kind, ref: v.ref, variant: v.variant, level: v.level });
    P.side = { ...P.side, ...v.side }; P.seq = v.seq.slice(); P.bag = v.bag; P.pours = v.pours; P.undo = v.undo ?? []; P.hints = v.hints ?? 0;
    if (v.kind === 'daily') P.day = Number(String(v.ref).split(':')[1]);
    begin(P);
    say('Welcome back.', 1.6);
  }
  function startAuto() {
    const rule = RULE_IDS[S.prefs.autoRule % RULE_IDS.length];
    S.prefs.autoRule = (S.prefs.autoRule + 1) % RULE_IDS.length; savePrefs();
    const order = makeOrder(rule, 0, (n) => rng.int(n));
    begin(newSession({ order, kind: 'auto', variant: rule }), { on: true });
    say('Watch the game serve this order and explain each weighing.', 2.4);
  }

  // ---- weighing -------------------------------------------------------------------------------------------------------------------------
  function startPour() {
    const P = S.P;
    if (S.pour || !canPour(P)) return false;
    const before = P.bag, d = pour(P);
    if (d === null) return false;
    S.pour = { t: 0, d, before, dur1: clamp(0.55 + d * 0.011, 0.6, 1.5), dur2: 0.6 };
    S.hint = null; sfx.pour(); sfx.level();
    persistSession();
    return true;
  }
  function finishPour() {
    const P = S.P;
    S.pour = null;
    if (solvedNow(P)) { win(); return; }
    if (overshoot(P) && !S.auto.on) say('That is more than the order. Press Undo to take the last pour back.', 3.4);
    persistSession();
  }
  function doPlace(key, side, quiet = false) {
    const P = S.P;
    if (!allowed(P, key, side)) {
      if (side === 'left' && key !== 'bag' && !RULES[P.order.rule].left) say('On this market day the left pan is for dust only.', 2.6);
      else if (key === 'bag') say('The bag cannot be weighed yet: that comes on the third market day.', 2.6);
      return false;
    }
    if (!place(P, key, side)) return false;
    S.fx.pop[key] = 0; S.hint = null;
    if (!quiet) { sfx.tink(typeof key === 'number' ? key : 3); persistSession(); }
    return true;
  }
  function doUndo() { if (S.pour) return; if (undoPour(S.P)) { S.hint = null; sfx.lift(); persistSession(); } else say('Nothing to undo.', 1.4); }
  function doClear() { if (S.pour) return; if (clearPans(S.P)) { S.hint = null; sfx.lift(); persistSession(); } }

  // ---- hints (also drive Watch and Learn) -----------------------------------------------------------------------------------------------------
  function makeHint() {
    const P = S.P, o = P.order;
    if (overshoot(P)) return { name: 'Too much', stage: 'mistake', move: null, keys: [], text: `The bag holds ${P.bag}, more than the order of ${o.target}. Dust only goes in, so take the last pour back.` };
    const mv = bestMove(o.weights, o.rule, o.target, P.bag);
    if (!mv) return { name: 'No way from here', stage: 'mistake', move: null, keys: [], text: `From a bag of ${P.bag} the order of ${o.target} cannot be made exactly. Take the last pour back.` };
    const d = describeMove(o.weights, o.rule, mv, P.bag, o.target);
    const keys = [];
    mv.assign.forEach((sg, i) => { if (sg) keys.push(o.weights[i]); });
    if (mv.sb) keys.push('bag');
    const need = o.target - P.bag;
    const used = keys.map((k) => (k === 'bag' ? 'the bag' : `the ${k}`));
    const look = `The bag needs ${need} more to reach ${o.target}. ${used.length ? 'Look at ' + (used.length === 1 ? used[0] : used.slice(0, -1).join(', ') + ' and ' + used[used.length - 1]) + '.' : ''}${mv.assign.some((v) => v < 0) ? ' One of them goes on the left pan.' : ''}`;
    return { name: 'Next weighing', stage: 'look', move: mv, keys, desc: d, text: look };
  }
  function askHint() {
    if (S.pour) return;
    if (S.P.done) { say('The order is served.'); return; }
    S.P.hints += 1; S.hint = makeHint(); sfx.hint();
  }
  function hintGo() {
    const h = S.hint;
    if (!h) return;
    if (h.stage === 'look') { h.stage = 'explain'; h.text = h.desc.text; sfx.tap(); return; }
    if (h.stage === 'mistake') { undoPour(S.P); S.hint = null; sfx.lift(); persistSession(); return; }
    arrange(S.P, h.move);
    h.keys.forEach((k) => { S.fx.pop[k] = 0; });
    S.hint = null; sfx.tink(); persistSession();
    say('The pans are set. Press Pour.', 2.4);
  }

  // ---- winning -------------------------------------------------------------------------------------------------------------------------
  function win() {
    const P = S.P;
    P.done = true; S.hint = null; S.winT = 3.2; S.winDelay = 1.9;
    const sc = L().scene; spark(sc.x + sc.w / 2, sc.y + sc.h * 0.3, 70, '#ffd45a'); sfx.win();
    if (S.auto.on) { S.auto.done = true; S.auto.phase = null; say('Order served. That is every step.', 4); S.winDelay = 0; return; }
    const v = P.variant, stars = starsFor(P);
    S.stats.solved[v] = (S.stats.solved[v] ?? 0) + 1;
    S.stats.starsTotal[v] = (S.stats.starsTotal[v] ?? 0) + stars;
    if (P.kind === 'journey') { const old = S.progress[P.ref]; S.progress[P.ref] = { stars: Math.max(old?.stars ?? 0, stars), pours: old ? Math.min(old.pours, P.pours) : P.pours }; saveProgress(); }
    let streak = S.streak;
    if (P.kind === 'daily' && P.day === S.daily.day && !S.stats.days.includes(P.day)) { S.stats.days.push(P.day); S.stats.days = S.stats.days.slice(-200); refreshDaily(); streak = S.streak; S.stats.bestStreak = Math.max(S.stats.bestStreak, streak); }
    saveStats(); clearSave();
    if (P.kind === 'daily' && P.day === S.daily.day) storage.set('daily', { day: P.day, streak });
    monetization.track('order_served', { rule: v, kind: P.kind, pours: P.pours, par: P.order.par });
    let next = null;
    if (P.kind === 'journey') { const [ci, i] = P.ref.split(':').map(Number); next = nextLevel(ci, i); }
    S.result = { stars, pours: P.pours, par: P.order.par, target: P.order.target, hints: P.hints, daily: P.kind === 'daily', streak, variant: v, kind: P.kind, ref: P.ref, next, used: itemsOn(P, 'right').filter((k) => k !== 'bag') };
  }

  // ---- Watch and Learn ------------------------------------------------------------------------------------------------------------------
  const wordCount = (t) => t.split(' ').length;
  function autoTick(dt) {
    const a = S.auto, P = S.P;
    if (a.paused || a.done || S.pour) return;
    if (a.phase === 'gap') { a.timer -= dt; if (a.timer <= 0) a.phase = null; return; }
    if (a.phase === 'think') {
      a.timer -= dt;
      if (a.timer > 0) return;
      S.hint.stage = 'explain'; S.hint.text = S.hint.desc.text; a.phase = 'reveal';
      a.timer = clamp(2 + wordCount(S.hint.text) * 0.17, 2.5, 9);
      return;
    }
    if (a.phase === 'reveal') {
      a.timer -= dt;
      if (a.timer > 0) return;
      const mv = S.hint.move;
      clearPans(P);
      a.queue = [];
      mv.assign.forEach((sg, i) => { if (sg > 0) a.queue.push([P.order.weights[i], 'right']); });
      mv.assign.forEach((sg, i) => { if (sg < 0) a.queue.push([P.order.weights[i], 'left']); });
      if (mv.sb > 0) a.queue.push(['bag', 'right']); else if (mv.sb < 0) a.queue.push(['bag', 'left']);
      a.phase = 'act'; a.timer = 0.4;
      return;
    }
    if (a.phase === 'act') {
      a.timer -= dt;
      if (a.timer > 0) return;
      if (a.queue.length) { const [k, side] = a.queue.shift(); doPlace(k, side, true); sfx.tink(typeof k === 'number' ? k : 3); a.timer = 0.55; return; }
      S.hint = null; a.keys = [];
      startPour(); a.phase = 'gap'; a.timer = 0.9;
      return;
    }
    const h = makeHint();
    if (h.stage === 'mistake') { undoPour(P); a.phase = 'gap'; a.timer = 0.4; return; }
    S.hint = h; a.n += 1; a.phase = 'think'; a.keys = h.keys.slice();
    a.timer = THINK_STEPS[S.prefs.thinkIdx];
  }

  // ---- input -----------------------------------------------------------------------------------------------------------------------------
  function hitBtn(id, r, tap) { if (r && inRect(r, tap.x, tap.y)) { flash(id); return true; } return false; }
  function itemAt(x, y) {
    const P = S.P, l = L(), g = G(), keys = keysOf(P);
    for (const side of ['right', 'left']) {
      const items = itemsOn(P, side);
      for (let k = items.length - 1; k >= 0; k--) {
        const sp = slotPos(g, side, k, items.length), w = sp.s;
        if (x >= sp.x - w * 0.5 && x <= sp.x + w * 0.5 && y >= sp.y - w * 1.15 && y <= sp.y + 4) return { key: items[k], from: side };
      }
    }
    for (let i = 0; i < keys.length; i++) {
      if (P.side[keys[i]] !== 'tray') continue;
      const r = l.tray.slots[i];
      if (inRect({ x: r.x - 4, y: r.y - 4, w: r.w + 8, h: r.h + 8 }, x, y)) return { key: keys[i], from: 'tray' };
    }
    return null;
  }
  function dropSide(x, y) {
    const l = L(), g = G();
    const tr = l.tray.rect, pad = l.tray.s * 0.3;
    if (inRect({ x: tr.x - pad, y: tr.y - pad, w: tr.w + 2 * pad, h: tr.h + 2 * pad }, x, y)) return 'tray';
    if (inRect(l.scene, x, y)) return x < g.cx ? 'left' : 'right';
    return null;
  }
  function tapItem(src) { doPlace(src.key, nextSide(S.P, src.key)); }
  function updateGesture(p) {
    if (p.pressed) gesture = { x0: p.x, y0: p.y, moved: false, src: itemAt(p.x, p.y) };
    if (!gesture) return null;
    if (p.down && gesture.src && !gesture.moved && Math.hypot(p.x - gesture.x0, p.y - gesture.y0) > 16) { gesture.moved = true; sfx.lift(); }
    if (gesture.moved && p.down) { const ds = dropSide(p.x, p.y); S.drag = { key: gesture.src.key, x: p.x, y: p.y, hot: ds === 'tray' ? null : ds }; }
    if (p.released || !p.down) {
      const g = gesture; gesture = null; S.drag = null;
      if (g.moved && g.src) {
        const side = dropSide(p.x, p.y);
        if (side) doPlace(g.src.key, side);
        return null;
      }
      if (g.src) { tapItem(g.src); return null; }
      return { x: g.x0, y: g.y0 };
    }
    return null;
  }

  function updatePlay(dt, input) {
    const P = S.P, l = L(), p = input.pointer;
    if (S.auto.on && !S.auto.paused && !S.paused) autoTick(dt);
    if (S.winDelay > 0 && !S.paused) { S.winDelay -= dt; if (S.winDelay <= 0 && S.result) go('over'); }
    if (!S.paused && !P.done && !S.auto.on) { S.saveAcc += dt; if (S.saveAcc > 6) { S.saveAcc = 0; persistSession(); } }
    const k = input.keys.pressed;
    if (!S.auto.on && !S.paused && !P.done && !S.pour) {
      if (k.has('Space') || k.has('Enter')) { if (S.hint) hintGo(); else if (!startPour()) say('Put weights on the pans: the right pan must be heavier.', 2.2); }
      if (k.has('KeyU') || k.has('Backspace')) doUndo();
      if (k.has('KeyC')) doClear();
      if (k.has('KeyH')) { if (S.hint) hintGo(); else askHint(); }
      const keys = keysOf(P);
      for (const code of k) { const m = /^(?:Digit|Numpad)([1-9])$/.exec(code); if (m && keys[Number(m[1]) - 1] !== undefined) tapItem({ key: keys[Number(m[1]) - 1] }); }
    }
    if (k.has('KeyP') || k.has('Escape')) { if (S.auto.on) S.auto.paused = !S.auto.paused; else if (!P.done) { S.paused = !S.paused; if (S.paused) persistSession(); } }
    let tap = null;
    if (!S.paused && !S.auto.on && !P.done && !S.hint && !S.pour) tap = updateGesture(p);
    else { gesture = null; S.drag = null; if (p.pressed) tap = { x: p.x, y: p.y }; }
    if (!tap) return;
    if (S.paused) {
      const pl = pauseLayout(meta.width, meta.height, l.scene);
      if (hitBtn('resume', pl.resume, tap)) S.paused = false;
      else if (hitBtn('restart', pl.restart, tap)) { const o = P.order; begin(newSession({ order: o, kind: P.kind, ref: P.ref, variant: P.variant, level: P.level })); S.P.day = P.day; persistSession(); }
      else if (hitBtn('psettings', pl.settings, tap)) { S.back = 'play'; go('settings'); }
      else if (hitBtn('pmenu', pl.menu, tap)) { persistSession(); S.paused = false; go('title'); }
      return;
    }
    if (S.auto.on) {
      if (hitBtn('aexit', l.rail.exit, tap)) { S.auto.on = false; S.hint = null; S.P = null; go('title'); }
      else if (hitBtn('apause', l.rail.pause, tap)) S.auto.paused = !S.auto.paused;
      else if (hitBtn('adec', l.rail.dec, tap)) { if (S.prefs.thinkIdx > 0) { S.prefs.thinkIdx -= 1; savePrefs(); } }
      else if (hitBtn('ainc', l.rail.inc, tap)) { if (S.prefs.thinkIdx < THINK_STEPS.length - 1) { S.prefs.thinkIdx += 1; savePrefs(); } }
      return;
    }
    if (P.done) return;
    if (hitBtn('pause', l.pause, tap)) { S.paused = true; persistSession(); return; }
    if (S.hint) {
      if (hitBtn('close', l.coachBtns.close, tap)) S.hint = null;
      else if (hitBtn('go', l.coachBtns.go, tap)) hintGo();
      return;
    }
    if (S.pour) return;
    if (hitBtn('pour', l.pour, tap)) { if (!startPour()) say(P.seq.length ? 'The right pan must be heavier than the left, or there is nothing to pour.' : 'Put some weights on the pans first.', 2.6); return; }
    const T = l.tools;
    if (T && hitBtn('undo', T.undo, tap)) doUndo();
    else if (T && hitBtn('clear', T.clear, tap)) doClear();
    else if (T && hitBtn('hint', T.hint, tap)) askHint();
  }

  function doRestore() {
    if (S.owned || S.demo || S.restore.busy) return;
    S.restore = { busy: true, msg: 'Checking with the store...' };
    Promise.resolve().then(() => monetization.restore()).then(() => {
      S.owned = monetization.owns('unlock_game');
      S.restore = { busy: false, msg: S.owned ? 'Purchase restored' : 'No earlier purchase found' };
    }).catch(() => { S.restore = { busy: false, msg: 'Could not reach the store. Try again later.' }; });
  }
  function changeSetting(i, k) {
    const id = settingRows(S)[i].id, p = S.prefs;
    switch (id) {
      case 'look': p.look = LOOK_IDS[k]; setLook(p.look); break;
      case 'totals': p.totals = k === 0; break;
      case 'lefty': p.lefty = k === 1; break;
      case 'sound': p.sound = k === 0; audio.setMuted?.(!p.sound); break;
      case 'calm': p.calm = k === 1; break;
      case 'restore': doRestore(); return;
      default: break;
    }
    savePrefs(); sfx.tap();
  }
  function textScale(dir) { const n = clamp(S.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (n !== S.prefs.textIdx) { S.prefs.textIdx = n; S.scrollY = 0; savePrefs(); } }

  function getTap(p, rect) {
    if (!rect) { scrollG = null; return p.pressed ? { x: p.x, y: p.y } : null; }
    if (p.pressed) scrollG = { x0: p.x, y0: p.y, s0: S.scrollY, moved: false, inBody: inRect(rect, p.x, p.y) };
    let tap = null;
    if (scrollG) {
      if (p.down && scrollG.inBody) { const dy = p.y - scrollG.y0; if (Math.abs(dy) > 12) scrollG.moved = true; if (scrollG.moved) S.scrollY = clamp(scrollG.s0 - dy, 0, metrics.max); }
      if (p.released || !p.down) { if (!scrollG.moved) tap = { x: scrollG.x0, y: scrollG.y0 }; scrollG = null; }
    }
    return tap;
  }

  function updateScene(dt, input) {
    const p = input.pointer, scrolling = ['journey', 'free', 'doc', 'settings', 'stats', 'over'].includes(S.scene);
    if (S.scene === 'play') return updatePlay(dt, input);
    const tap = getTap(p, scrolling ? metrics.rect : null);
    if (scrolling) {
      if (wheelInput.dy) { S.scrollY = clamp(S.scrollY + wheelInput.dy, 0, metrics.max); wheelInput.dy = 0; }
      const k = input.keys.pressed;
      if (k.has('ArrowDown')) S.scrollY = clamp(S.scrollY + 80, 0, metrics.max);
      if (k.has('ArrowUp')) S.scrollY = clamp(S.scrollY - 80, 0, metrics.max);
      S.scrollY = clamp(S.scrollY, 0, metrics.max);
    }
    const sc = S.scene, w = meta.width, h = meta.height, esc = input.keys.pressed.has('Escape');
    if (sc === 'title') {
      if (!tap) { if (input.keys.pressed.has('Enter') || input.keys.pressed.has('Space')) go('journey'); return; }
      const T = titleLayout(w, h, !!S.saved), B = T.buttons;
      for (const id of Object.keys(B)) if (hitBtn(id, B[id], tap)) {
        sfx.tap();
        if (id === 'continue') resumeSaved();
        else if (id === 'journey') go('journey');
        else if (id === 'free') go('free');
        else if (id === 'daily') startDaily();
        else if (id === 'learn') startAuto();
        else if (id === 'howto' || id === 'rules' || id === 'about') { S.doc = { kind: id, page: 0 }; go('doc'); }
        else if (id === 'stats') go('stats');
        else if (id === 'settings') { S.back = 'title'; go('settings'); }
        return;
      }
      if (Math.abs(tap.x - T.brand.x) < 260 && Math.abs(tap.y - T.brand.y) < 26) env.openArcforgeHome?.();
      return;
    }
    if (sc === 'journey' || sc === 'free') {
      const LL = listLayout(w, h);
      if (esc) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', LL.back, tap)) { go('title'); return; }
      if (hitBtn('tdec', LL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', LL.textInc, tap)) return textScale(1);
      if (!inRect(LL.body, tap.x, tap.y)) return;
      const ty = tap.y + S.scrollY, sc2 = TEXT_SCALES[S.prefs.textIdx];
      if (sc === 'journey') {
        const J = journeyRects(LL.body, CHAPTERS.map((c) => c.count), sc2);
        J.items.forEach((it) => it.lv.forEach((r, i) => { if (inRect(r, tap.x, ty)) { sfx.tap(); startLevel(it.ci, i); } }));
      } else {
        const Fr = freeRects(LL.body, RULE_IDS.length, sc2);
        Fr.cards.forEach((c, vi) => c.tiers.forEach((r, t) => { if (inRect(r, tap.x, ty)) { sfx.tap(); startFree(RULE_IDS[vi], t); } }));
      }
      return;
    }
    if (sc === 'doc') {
      const DL = docLayout(w, h), n = DOCS[S.doc.kind].pages.length;
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
      const SL = settingsLayout(w, h, TEXT_SCALES[S.prefs.textIdx], settingRows(S).length);
      const leave = () => { if (S.back === 'play' && S.P) { S.scene = 'play'; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
      if (esc) { leave(); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) return leave();
      if (hitBtn('tdec', SL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', SL.textInc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) {
        const ty = tap.y + S.scrollY;
        settingRows(S).forEach((row, i) => {
          const g = SL.rows[i], n = row.opts.length, cw = (g.ctrl.w - 8 * (n - 1)) / n;
          for (let k = 0; k < n; k++) { const r = { x: g.ctrl.x + k * (cw + 8), y: g.ctrl.y, w: cw, h: g.ctrl.h }; if (inRect(r, tap.x, ty)) { flash('set' + i + '.' + k); changeSetting(i, k); } }
        });
      }
      return;
    }
    if (sc === 'stats') {
      const SL = listLayout(w, h);
      if (esc) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) go('title');
      else if (hitBtn('tdec', SL.textDec, tap)) textScale(-1);
      else if (hitBtn('tinc', SL.textInc, tap)) textScale(1);
      return;
    }
    if (sc === 'over') {
      const R0 = S.result, O = overLayout(w, h, TEXT_SCALES[S.prefs.textIdx]);
      if (!tap || !R0) return;
      if (hitBtn('next', O.btns.next, tap)) {
        if (R0.kind === 'journey' && R0.next) startLevel(R0.next[0], R0.next[1]);
        else if (R0.kind === 'journey') go('journey');
        else if (R0.daily) go('title');
        else startFree(R0.variant, Number(R0.ref.split(':')[1] ?? 1));
      } else if (hitBtn('menu', O.btns.menu, tap)) { if (R0.kind === 'journey') go('journey'); else if (R0.daily) go('free'); else go('title'); }
      else if (hitBtn('share', O.btns.share, tap)) env.share(`Akan Gold-Weight Balance: served an order of ${R0.target} in ${R0.pours} weighing${R0.pours === 1 ? '' : 's'} (par ${R0.par}), ${R0.stars} star${R0.stars === 1 ? '' : 's'}${R0.daily ? '. Streak ' + R0.streak : ''}.`);
      return;
    }
    if (sc === 'demo-limit' && tap) go('title');
  }

  // The balance beam: a damped spring toward the angle the pans ask for. Frozen by pause.
  function stepBeam(dt) {
    if (!S.P) return;
    const target = beamTarget(shownModel(S)), b = S.beam, k = 70, c = S.prefs.calm ? 2 * Math.sqrt(k) : 9;
    const acc = k * (target - b.ang) - c * b.vel;
    b.vel += acc * dt; b.ang += b.vel * dt;
    if (Math.abs(target - b.ang) < 0.0005 && Math.abs(b.vel) < 0.002) { b.ang = target; b.vel = 0; }
  }

  // Store-screenshot driver: `?shot=1&seed=N` (kit shot mode) opens one fixed real scene per seed and ignores the monkey's input.
  const SHOT_SEEDS = { 11: 'title', 12: 'about', 13: 'play', 14: 'bag', 15: 'hint', 16: 'auto', 17: 'journey', 18: 'over' };
  const shotScene = (() => { try { const q = new URLSearchParams(globalThis.location?.search ?? ''); return q.has('shot') ? SHOT_SEEDS[Number(q.get('seed'))] ?? null : null; } catch { return null; } })();
  function shotSetup() {
    const sc = shotScene;
    if (sc === 'about') { S.doc = { kind: 'about', page: 0 }; go('doc'); }
    else if (sc === 'journey') { S.dev = true; S.progress = { '0:0': { stars: 3, pours: 2 }, '0:1': { stars: 2, pours: 3 }, '0:2': { stars: 3, pours: 3 } }; go('journey'); }
    else if (sc === 'play' || sc === 'hint') { startFree('right', 1); const ks = keysOf(S.P); doPlace(ks[ks.length - 1], 'right', true); S.beam = { ang: beamTarget(shownModel(S)), vel: 0 }; if (sc === 'hint') askHint(); }
    else if (sc === 'bag') { startFree('bag', 1); S.dev = true; S.paused = false; const mv = bestMove(S.P.order.weights, S.P.order.rule, S.P.order.target, S.P.bag); if (mv) arrange(S.P, mv); S.beam = { ang: beamTarget(shownModel(S)), vel: 0 }; }
    else if (sc === 'auto') startAuto();
    else if (sc === 'over') { startFree('right', 1); let g = 0; while (!solvedNow(S.P) && g++ < 12) { const mv = bestMove(S.P.order.weights, S.P.order.rule, S.P.order.target, S.P.bag); if (!mv) break; arrange(S.P, mv); pour(S.P); } win(); S.winDelay = 0.05; }
  }
  if (shotScene) shotSetup();

  return {
    update(dt, input) {
      if (shotScene) input = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { pressed: new Set(), down: new Set() } };
      S.t += dt; S.sceneT += dt;
      if (S.flash) { S.flash.t += dt; if (S.flash.t > 0.25) S.flash = null; }
      if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold) S.msg = null; }
      const frozen = S.paused || (S.auto.on && S.auto.paused);
      if (!frozen) {
        for (const k of Object.keys(S.fx.pop)) { S.fx.pop[k] += dt; if (S.fx.pop[k] > 0.4) delete S.fx.pop[k]; }
        for (const sp of S.sparks) { sp.t += dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 600 * dt; }
        S.sparks = S.sparks.filter((sp) => sp.t < sp.life);
        if (S.winT > 0) S.winT -= dt;
        for (const q of S.sfx) q.t -= dt;
        const due = S.sfx.filter((q) => q.t <= 0); if (due.length) { S.sfx = S.sfx.filter((q) => q.t > 0); for (const q of due) toneAuto(q.o); }
        if (S.pour) { S.pour.t += dt; if (S.pour.t >= S.pour.dur1 + S.pour.dur2) finishPour(); }
        if (S.scene === 'play') stepBeam(dt);
      }
      S.owned = monetization.owns('unlock_game');
      // the kit's preview pill sits top centre by default; here it goes to the bottom-left corner of the scene (the wooden base), clear of the HUD
      if (S.scene === 'play' && S.P) { const l = L(), fs = Math.max(16, 11.5 / (host.px || 0.55)); meta.previewBadge = { x: l.scene.x + 14, y: l.scene.y + l.scene.h - fs * 1.7 - 12, align: 'left' }; } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { render(ctx, S, view ?? meta); },
    getState: () => S,
    // Counts real play only: a live order in progress. Menus, Rules, settings, Watch and Learn, pause, results are free.
    isPreviewExempt() { return !(S.scene === 'play' && !S.auto.on && !S.paused && S.P && !S.P.done); },
    // Tester/screenshot hooks (only wired up in dev: see main.js).
    dev: {
      go: (scene, extra) => { Object.assign(S, extra ?? {}); go(scene); },
      level: (ci, i) => { S.dev = true; startLevel(ci, i); }, free: (rule, tier) => startFree(rule, tier), daily: () => startDaily(), auto: () => startAuto(),
      hint: () => askHint(), hintGo: () => hintGo(),
      set: (pairs) => { for (const [k, side] of pairs) doPlace(k, side, true); },
      pourNow: () => startPour(),
      advance: (n) => { for (let i = 0; i < n; i++) { const mv = bestMove(S.P.order.weights, S.P.order.rule, S.P.order.target, S.P.bag); if (!mv) break; arrange(S.P, mv); pour(S.P); } S.beam = { ang: 0, vel: 0 }; },
      doc: (kind, page = 0) => { S.doc = { kind, page }; go('doc'); },
      layout: () => { const l = L(); return { mode: l.mode, tray: l.tray, tools: l.tools, pour: l.pour, scene: l.scene, w: meta.width, h: meta.height }; },
      solveNow: () => { const P = S.P; let g = 0; while (!solvedNow(P) && g++ < 12) { const mv = bestMove(P.order.weights, P.order.rule, P.order.target, P.bag); if (!mv) break; arrange(P, mv); pour(P); } win(); },
      skipOver: () => { S.winDelay = 0.01; },
      setPrefs: (o) => { Object.assign(S.prefs, o); applyPrefs(); },
      unlockAll: () => { S.dev = true; },
    },
  };
}
