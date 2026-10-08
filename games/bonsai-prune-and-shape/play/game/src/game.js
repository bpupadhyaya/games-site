// Bonsai: state and flow. Tree = tree.js, planner = coach.js, judging = judge.js, art = art.js, drawing = view.js, layout = layout.js.
import { playLayout, titleLayout, shelfLayout, docLayout, settingsLayout, overLayout, potLayout, briefLayout, pauseLayout, inRect, TEXT_SCALES, THINK_STEPS, SPEEDS } from './layout.js';
import { COMMISSIONS, SPECIES, STYLES, POTS, SEASON_NAMES, potById, commissionById } from './species.js';
import { makeTree, stepTree, geo, snip, pinch, rubBud, nearestLimb, nearestTip, nearestBud, wireStart, wireDrag, wireRelease, wireRemove, seasonIdx, wrap, clamp, MAX_WIRES } from './tree.js';
import { advise, applyAdvice } from './coach.js';
import { judge } from './judge.js';
import { camTarget, toWorld, toScreen, render, metrics, SETTINGS } from './view.js';
import { snapOf, leafState } from './art.js';
import { DOCS } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_TREES = 2;
const SNIP_BIAS = 9;
const DEFAULT_PREFS = { forecast: true, thinkIdx: 1, sound: true, calm: false, textIdx: 0 };
const NOTES = [523, 587, 659, 784, 880, 1047];
const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS }, T: null, briefId: 'c1', tool: 'snip', speed: 0, paused: false, hint: null, act: null, drag: null,
    cam: { cx: 0, cy: -140, k: 1 }, parts: [], fall: [], msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0 }, back: 'title', result: null,
    stats: { c: {} }, saved: null, savedMap: {}, last: null, demoCount: 0, potId: 'drum', canPresent: false, saveAcc: 0, amb: 0, lastSeason: 0, creak: 0, overSeen: 0,
    auto: { on: false, paused: false, phase: null, timer: 0, text: '', adv: null, done: false },
    dev: config.dev === true,
  };
  const saves = {};
  let gesture = null;

  // ---- persistence ------------------------------------------------------------------------------------------------------------
  const applyPrefs = () => audio.setMuted?.(!S.prefs.sound);
  const savePrefs = () => storage.set('prefs', S.prefs);
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); } applyPrefs(); });
  storage.get('stats', null).then((v) => { if (v && v.c) S.stats = { c: { ...v.c, ...S.stats.c } }; });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  storage.get('last', null).then((last) => {
    for (const c of COMMISSIONS) storage.get('save.' + c.id, null).then((v) => {
      if (v && v.tree && v.tree.comId === c.id && v.tree.limbs?.length) { saves[c.id] = v; S.savedMap[c.id] = { year: v.tree.year }; if (last === c.id) { S.last = c.id; S.saved = { com: c.id, year: v.tree.year }; } }
    });
  });
  applyPrefs();
  const strip = (T) => JSON.parse(JSON.stringify(T, (k, v) => (k === 'g' ? undefined : v)));
  function persist() {
    const T = S.T;
    if (!T || S.auto.on || S.scene === 'over') return;
    saves[T.comId] = { tree: strip(T), potId: S.potId, speed: S.speed }; S.savedMap[T.comId] = { year: T.year }; S.last = T.comId; S.saved = { com: T.comId, year: T.year };
    storage.set('save.' + T.comId, saves[T.comId]); storage.set('last', T.comId);
  }
  function clearSave(id) { delete saves[id]; delete S.savedMap[id]; storage.remove('save.' + id); if (S.last === id) { S.last = null; S.saved = null; storage.remove('last'); } }

  // ---- sound ------------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound) audio.tone(o); };
  const later = [];
  const queue = (t, o) => later.push({ t, o });
  const sfx = {
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.05 }),
    snip: () => { tone({ freq: 1800, to: 900, dur: 0.05, type: 'triangle', vol: 0.09 }); queue(0.04, { freq: 420, to: 260, dur: 0.1, type: 'sine', vol: 0.07 }); },
    pinch: () => tone({ freq: 700, to: 980, dur: 0.07, type: 'sine', vol: 0.07 }),
    creak: () => tone({ freq: 150 + rng.next() * 40, to: 190, dur: 0.07, type: 'sawtooth', vol: 0.03 }),
    wire: () => { tone({ freq: 330, to: 300, dur: 0.12, type: 'triangle', vol: 0.07 }); },
    set: () => { [660, 880].forEach((f, i) => queue(i * 0.12, { freq: f, to: f, dur: 0.4, type: 'sine', vol: 0.06 })); },
    warn: () => { tone({ freq: 220, to: 180, dur: 0.3, type: 'triangle', vol: 0.08 }); },
    bud: () => tone({ freq: 880 + rng.next() * 300, to: 1100, dur: 0.1, type: 'sine', vol: 0.025 }),
    season: (si) => { const f = NOTES[(si * 2) % NOTES.length]; tone({ freq: f, to: f, dur: 0.9, type: 'sine', vol: 0.05 }); queue(0.15, { freq: f * 1.5, to: f * 1.5, dur: 0.8, type: 'sine', vol: 0.03 }); },
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.07 }),
    score: (i) => tone({ freq: NOTES[i % NOTES.length], to: NOTES[i % NOTES.length], dur: 0.35, type: 'sine', vol: 0.06 }),
    win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => queue(i * 0.13, { freq: f, to: f, dur: 0.7, type: 'sine', vol: 0.08 })); },
  };

  // ---- helpers ----------------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.6) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; gesture = null; wheelInput.dy = 0; if (scene !== 'play') S.msg = null; }
  const L = () => playLayout(meta.width, meta.height, S.auto.on);
  const potNow = () => potById(S.T?.potId ?? 'drum');
  const cpu = () => meta.cssPerUnit || 0.5;
  const pickR = (css = 30) => css / cpu() / S.cam.k;
  const worldOf = (p) => toWorld(S.cam, L().board, p.x, p.y);
  const comOf = () => commissionById(S.T.comId);
  function spark(x, y, n, kind = 'leaf') {
    if (S.prefs.calm) n = Math.ceil(n / 3);
    const sp = SPECIES[S.T.species];
    for (let i = 0; i < n; i++) {
      const a = rng.next() * 6.283, v = 20 + rng.next() * 90, c = leafState(sp, S.T.t).col;
      S.parts.push({ k: kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: 0, life: 0.9 + rng.next() * 0.8, r: 4 + rng.next() * 4, rot: rng.next() * 6, spin: (rng.next() - 0.5) * 8, c });
    }
    if (S.parts.length > 160) S.parts.splice(0, S.parts.length - 160);
  }
  const ring = (x, y, r0, r1) => S.parts.push({ k: 'ring', x, y, r0, r1, t: 0, life: 0.6 });

  // ---- starting / leaving a tree ---------------------------------------------------------------------------------------------------------
  function begin(T, extra = {}) {
    S.T = T; S.paused = false; S.hint = null; S.act = null; S.drag = null; S.parts = []; S.fall = []; S.msg = null; S.result = null; S.tool = 'snip'; S.speed = 0; S.saveAcc = 0; S.amb = 0;
    S.potId = T.potId ?? 'drum'; T.potId = S.potId; S.lastSeason = seasonIdx(T); S.canPresent = false;
    S.auto = { on: false, paused: false, phase: null, timer: 0, text: '', adv: null, done: false, ...extra };
    geo(T); S.cam = camTarget(T, potNow(), L().board); go('play');
  }
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_TREES) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }
  function openBrief(id) { if (saves[id]) return resume(id); S.briefId = id; go('brief'); }
  function startTree(id) {
    if (saves[id]) return resume(id);
    if (demoBlocked()) return;
    begin(makeTree(id)); persist();
    say('Press Snip, Pinch or Wire, then touch the tree. Time is running.', 3.2);
  }
  function resume(id) {
    const v = saves[id]; if (!v) return startTree(id);
    const T = v.tree; T.ev = []; begin(T); S.potId = v.potId ?? 'drum'; T.potId = S.potId; S.speed = 0; say('Welcome back.', 1.6);
  }
  function restartTree() { const id = S.T.comId; clearSave(id); begin(makeTree(id)); persist(); }
  function startAuto() {
    const idx = COMMISSIONS.findIndex((c) => !S.stats.c[c.id]), id = COMMISSIONS[Math.max(0, Math.min(idx, 2))].id;
    begin(makeTree(id), { on: true, text: 'Watch the game train this tree and explain each step.' });
  }

  // ---- actions on the tree ---------------------------------------------------------------------------------------------------------------
  function doSnip(id, seg, t) {
    const T = S.T, r = snip(T, id, seg, t); if (!r) return null;
    sfx.snip();
    const base = r.at;
    for (const piece of r.removed) {
      const p0 = piece.pts[0];
      S.fall.push({ pts: piece.pts, th: piece.th, ox: 0, oy: 0, px: p0.x, py: p0.y, t: 0, life: 1.3, spin: (rng.next() - 0.5) * 3 });
    }
    if (S.fall.length > 24) S.fall.splice(0, S.fall.length - 24);
    spark(base.x, base.y, 9); ring(base.x, base.y, 6, 30);
    if (r.shock) { sfx.warn(); say('Too much at once. The tree is shocked and grows slowly for a while.', 3.4); }
    else say(r.lost > 0.2 ? `Cut. About ${Math.round(r.lost * 100)} percent of the foliage is gone.` : 'Cut. New buds will wake near the cut.', 2.2);
    S.hint = null; persist();
    return r;
  }
  function doPinch(cand) {
    const T = S.T;
    if (cand.kind === 'bud') { if (rubBud(T, cand.limb.id, cand.seg)) { sfx.pinch(); spark(cand.x, cand.y, 4); say('Bud rubbed off. It will not become a branch.', 2.2); } }
    else if (pinch(T, cand.limb.id)) { sfx.pinch(); ring(cand.x, cand.y, 4, 22); spark(cand.x, cand.y, 4); say('Pinched. Next spring it back-buds, making the pad denser.', 2.6); }
    S.hint = null; persist();
  }
  function doUnwire(L2) {
    const ok = L2.wire && L2.wire.age >= 6;
    if (wireRemove(S.T, L2)) { sfx.tap(); say(ok ? 'Wire off. The bend has set.' : 'Wire off early: the bend will spring back a little.', 2.6); }
    S.hint = null; persist();
  }

  // ---- hints -------------------------------------------------------------------------------------------------------------------------------------
  function askHint() {
    if (S.act || S.auto.on) return;
    if (!S.hint) { const a = advise(S.T); S.hint = { a, stage: 'look' }; sfx.hint(); if (a.kind === 'wait') say(a.why, 3.4); return; }
    if (S.hint.a.kind === 'wait') { S.hint = null; return; }
    startAct(S.hint.a); S.hint = null;
  }
  function startAct(a) {
    if (a.kind === 'wait') return;
    S.act = { a, t: 0, dur: a.kind === 'wire' ? 1.2 : 0.9, started: false };
  }
  function stepAct(dt) {
    const act = S.act; if (!act) return false;
    const T = S.T, a = act.a, L2 = T.limbs.find((q) => q.id === a.limb);
    if (!L2) { S.act = null; return true; }
    act.t += dt;
    if (a.kind === 'wire') {
      if (!act.started) { if (!wireStart(T, L2, a.seg)) { S.act = null; say(`All ${MAX_WIRES} wires are on. Take one off first.`, 2.4); return true; } act.started = true; sfx.wire(); }
      wireDrag(L2, a.delta * easeIO(clamp(act.t / act.dur, 0, 1)));
      if (act.t >= act.dur) { wireRelease(L2); S.act = null; say('Wired. Leave it until the ring turns green, then take it off.', 3); persist(); return true; }
      return false;
    }
    if (act.t >= act.dur) {
      S.act = null;
      if (a.kind === 'snip') doSnip(a.limb, a.seg, a.t);
      else if (a.kind === 'pinch') doPinch({ kind: 'tip', limb: L2, x: a.x, y: a.y });
      else if (a.kind === 'unwire') doUnwire(L2);
      return true;
    }
    return false;
  }

  // ---- finishing -------------------------------------------------------------------------------------------------------------------------------------
  function toPot() {
    S.hint = null; S.act = null; S.drag = null; S.paused = false;
    if (S.auto.on) { S.potId = STYLES[comOf().style].pot; S.T.potId = S.potId; return finishTree(); }
    go('pot'); say('Choose a pot, then present your tree to the judge.', 3);
  }
  function finishTree() {
    const T = S.T, com = comOf(); T.potId = S.potId;
    const J = judge(T, S.potId), id = com.id;
    sfx.win();
    let newBest = false;
    if (!S.auto.on) {
      const rec = S.stats.c[id] ?? { best: 0, stars: 0, n: 0, snap: null, pot: S.potId };
      newBest = J.total > rec.best; rec.n += 1;
      if (newBest) { rec.best = J.total; rec.snap = snapOf(T); rec.pot = S.potId; }
      rec.stars = Math.max(rec.stars, J.stars); S.stats.c[id] = rec;
      storage.set('stats', S.stats); storage.set('progress', { trees: Object.values(S.stats.c).filter((r) => r.stars).length });
      clearSave(id); monetization.track('tree_judged', { id, total: J.total, stars: J.stars });
    }
    S.result = { com: id, total: J.total, stars: J.stars, score: J.score, why: J.why, pot: S.potId, newBest, auto: S.auto.on };
    S.overSeen = 0; go('over');
  }

  // ---- Watch and Learn ------------------------------------------------------------------------------------------------------------------------------------
  function autoTick(dt) {
    const a = S.auto, T = S.T, think = THINK_STEPS[S.prefs.thinkIdx];
    if (a.paused || a.done) return;
    if (S.act) { stepAct(dt); if (!S.act) { a.phase = 'gap'; a.timer = 0.6; } return; }
    if (a.phase === 'gap' || a.phase === 'grow') { a.timer -= dt; if (a.timer > 0) return; a.phase = null; S.speed = 0; }
    if (a.phase === null) {
      const adv = advise(T);
      if (adv.kind === 'wait') { a.phase = 'grow'; a.timer = 2.4; S.speed = 2; a.text = adv.why; return; }
      a.adv = adv; S.hint = { a: adv, stage: 'look' }; a.phase = 'think'; a.timer = think; a.text = `Thinking: ${adv.short.toLowerCase()}?`; sfx.hint(); return;
    }
    if (a.phase === 'think') { a.timer -= dt; a.text = `Thinking: ${a.adv.short.toLowerCase()}? ${Math.ceil(Math.max(0, a.timer))}s`; if (a.timer <= 0) { a.phase = 'reveal'; a.timer = 2; a.text = a.adv.why; } return; }
    if (a.phase === 'reveal') { a.timer -= dt; if (a.timer <= 0) { S.hint = null; startAct(a.adv); a.phase = 'act'; a.text = a.adv.short + '.'; } }
  }

  // ---- input -----------------------------------------------------------------------------------------------------------------------------------------------------
  function getTap(p, scrollRect) {
    if (!scrollRect) { gesture = null; return p.pressed ? { x: p.x, y: p.y } : null; }
    if (p.pressed) gesture = { x0: p.x, y0: p.y, s0: S.scrollY, moved: false, inBody: inRect(scrollRect, p.x, p.y) };
    let tap = null;
    if (gesture) {
      if (p.down && gesture.inBody) { const dy = p.y - gesture.y0; if (Math.abs(dy) > 12) gesture.moved = true; if (gesture.moved) S.scrollY = clamp(gesture.s0 - dy, 0, metrics.max); }
      if (p.released || !p.down) { if (!gesture.moved) tap = { x: gesture.x0, y: gesture.y0 }; gesture = null; }
    }
    return tap;
  }
  const hit = (id, r, tap) => { if (inRect(r, tap.x, tap.y)) { flash(id); return true; } return false; };

  function openPause() { S.paused = true; S.drag = null; S.hint = null; persist(); }
  function cycleSpeed() { S.speed = (S.speed + 1) % SPEEDS.length; sfx.tap(); say(`Speed x${SPEEDS[S.speed]}`, 1.2); }
  function setTool(t) { S.tool = t; S.drag = null; sfx.tap(); }

  function beginGesture(p) {
    const w = worldOf(p), T = S.T;
    if (S.tool === 'snip') { const c = nearestLimb(T, w.x, w.y, pickR(), SNIP_BIAS); S.drag = { tool: 'snip', cand: c ? { limb: c.limb, seg: c.seg, t: clamp(c.t, 0.02, 0.98), x: c.x, y: c.y } : null }; }
    else if (S.tool === 'pinch') {
      const b = nearestBud(T, w.x, w.y, pickR(24)), tp = b ? null : nearestTip(T, w.x, w.y, pickR());
      S.drag = { tool: 'pinch', cand: b ? { kind: 'bud', limb: b.limb, seg: b.seg, x: b.x, y: b.y } : tp ? { kind: 'tip', limb: tp.limb, x: tp.x, y: tp.y } : null };
    } else {
      const c = nearestLimb(T, w.x, w.y, pickR());
      if (c) { const pv = c.limb.g.pts[c.seg]; S.drag = { tool: 'wire', limb: c.limb, seg: c.seg, pivot: { x: pv.x, y: pv.y }, a0: Math.atan2(w.y - pv.y, w.x - pv.x), x0: p.x, y0: p.y, started: false }; }
      else S.drag = { tool: 'wire', limb: null };
    }
  }
  function moveGesture(p) {
    const d = S.drag; if (!d) return; const w = worldOf(p), T = S.T;
    if (d.tool === 'snip') {
      const c = nearestLimb(T, w.x, w.y, pickR(d.cand ? 56 : 30), SNIP_BIAS);
      d.cand = c ? { limb: c.limb, seg: c.seg, t: clamp(c.t, 0.02, 0.98), x: c.x, y: c.y } : null;
    } else if (d.tool === 'pinch') {
      const b = nearestBud(T, w.x, w.y, pickR(d.cand ? 40 : 24)), tp = b ? null : nearestTip(T, w.x, w.y, pickR(d.cand ? 48 : 30));
      d.cand = b ? { kind: 'bud', limb: b.limb, seg: b.seg, x: b.x, y: b.y } : tp ? { kind: 'tip', limb: tp.limb, x: tp.x, y: tp.y } : null;
    } else if (d.tool === 'wire' && d.limb) {
      if (!d.started && Math.hypot(p.x - d.x0, p.y - d.y0) > 14) {
        if (wireStart(T, d.limb, d.seg)) { d.started = true; sfx.wire(); } else { say(`All ${MAX_WIRES} wires are on. Tap a wired limb to take one off.`, 2.8); S.drag = null; return; }
      }
      if (d.started) {
        wireDrag(d.limb, wrap(Math.atan2(w.y - d.pivot.y, w.x - d.pivot.x) - d.a0));
        S.creak -= 1 / 60; if (S.creak <= 0) { S.creak = 0.12; sfx.creak(); }
      }
    }
  }
  function endGesture(p) {
    const d = S.drag; S.drag = null; if (!d) return;
    const inBoard = inRect(L().board, p.x, p.y);
    if (d.tool === 'snip' && d.cand && inBoard) doSnip(d.cand.limb.id, d.cand.seg, d.cand.t);
    else if (d.tool === 'pinch' && d.cand && inBoard) doPinch(d.cand);
    else if (d.tool === 'wire' && d.limb) {
      if (d.started) { wireRelease(d.limb); say('Wired. Leave it until the ring turns green, then take it off.', 3.2); persist(); }
      else if (d.limb.wire && !d.limb.wire.end) doUnwire(d.limb);
      else say('Press and drag a limb to wire it.', 1.8);
    }
  }

  function updatePlay(dt, input) {
    const T = S.T, l = L(), p = input.pointer, k = input.keys.pressed, com = comOf(), a = S.auto;
    const frozen = S.paused || (a.on && a.paused);
    // camera follows the tree smoothly
    const tgt = camTarget(T, potNow(), l.board), f = 1 - Math.exp(-dt * 3.2);
    S.cam = { cx: S.cam.cx + (tgt.cx - S.cam.cx) * f, cy: S.cam.cy + (tgt.cy - S.cam.cy) * f, k: S.cam.k + (tgt.k - S.cam.k) * f };
    S.canPresent = T.year > 1 || T.t >= 16;
    if (!frozen) {
      if (a.on) autoTick(dt); else if (S.act) stepAct(dt);
      const sim = dt * SPEEDS[S.speed], n = Math.max(1, Math.ceil(sim / 0.04));
      for (let i = 0; i < n; i++) stepTree(T, sim / n);
      geo(T);
      for (const e of T.ev) {
        if (e.k === 'set') { sfx.set(); say('The wire has set. You can take it off now.', 3); }
        else if (e.k === 'bite') { sfx.warn(); say('A wire is biting into the bark. Take it off!', 3.4); }
        else if (e.k === 'bud') { if (rng.next() < 0.25) sfx.bud(); }
      }
      T.ev.length = 0;
      const si = seasonIdx(T);
      if (si !== S.lastSeason) { S.lastSeason = si; sfx.season(si); if (!a.on) say(`${SEASON_NAMES[si]}, year ${T.year}.`, 1.8); }
      ambient(dt, l);
      if (!a.on) { S.saveAcc += dt; if (S.saveAcc > 6) { S.saveAcc = 0; persist(); } }
      if (T.year >= com.years && T.t >= 24) { toPot(); return; }
    }
    if (k.has('KeyP') || k.has('Escape')) { if (a.on) a.paused = !a.paused; else if (S.paused) S.paused = false; else openPause(); }
    const tap = p.pressed ? { x: p.x, y: p.y } : null;
    if (S.paused) {
      if (!tap) return;
      const pl = pauseLayout(meta.width, meta.height);
      if (hit('resume', pl.resume, tap)) S.paused = false;
      else if (hit('restart', pl.restart, tap)) restartTree();
      else if (hit('psettings', pl.settings, tap)) { S.back = 'play'; go('settings'); }
      else if (hit('pmenu', pl.menu, tap)) { persist(); S.paused = false; go('title'); }
      return;
    }
    if (a.on) {
      if (!tap) return;
      const A = l.rail;
      if (hit('aexit', A.exit, tap)) { a.on = false; S.hint = null; S.act = null; S.T = null; go('title'); }
      else if (hit('apause', A.pause, tap) || hit('pause', l.pause, tap)) a.paused = !a.paused;
      else if (hit('adec', A.dec, tap)) { if (S.prefs.thinkIdx > 0) { S.prefs.thinkIdx -= 1; savePrefs(); } }
      else if (hit('ainc', A.inc, tap)) { if (S.prefs.thinkIdx < THINK_STEPS.length - 1) { S.prefs.thinkIdx += 1; savePrefs(); } }
      return;
    }
    if (S.act) return;
    // keyboard
    if (k.has('Digit1')) setTool('snip'); if (k.has('Digit2')) setTool('pinch'); if (k.has('Digit3')) setTool('wire');
    if (k.has('KeyH')) askHint(); if (k.has('KeyF')) cycleSpeed(); if (k.has('Enter') && S.canPresent) toPot();
    // buttons and the board
    if (p.pressed) {
      if (hit('pause', l.pause, p)) { openPause(); return; }
      if (hit('snip', l.btn.snip, p)) { setTool('snip'); return; }
      if (hit('pinch', l.btn.pinch, p)) { setTool('pinch'); return; }
      if (hit('wire', l.btn.wire, p)) { setTool('wire'); return; }
      if (hit('hint', l.btn.hint, p)) { askHint(); return; }
      if (hit('speed', l.btn.speed, p)) { cycleSpeed(); return; }
      if (hit('present', l.btn.present, p)) { if (S.canPresent) toPot(); else say('Let the tree grow through its first autumn before presenting.', 2.6); return; }
      if (inRect(l.board, p.x, p.y)) beginGesture(p);
    }
    if (S.drag) { if (p.down) moveGesture(p); if (p.released || !p.down) endGesture(p); }
  }

  function ambient(dt, l) {
    const T = S.T, si = seasonIdx(T), sp = SPECIES[T.species];
    const rate = S.prefs.calm ? 0.8 : 2.2;
    const kind = si === 0 ? 'petal' : si === 2 && !sp.evergreen ? 'leaf' : si === 3 ? 'snow' : null;
    S.amb += dt * rate;
    while (S.amb >= 1) {
      S.amb -= 1;
      if (!kind || S.parts.length > 150) continue;
      const b = l.board, k = S.cam.k, x = S.cam.cx + (rng.next() - 0.5) * (b.w / k), y = S.cam.cy - (b.h / k) / 2 - 10;
      S.parts.push({ k: kind, x, y, vx: 14 + rng.next() * 20, vy: 26 + rng.next() * 30, t: 0, life: 7 + rng.next() * 3, r: kind === 'snow' ? 1.6 + rng.next() * 1.6 : 4 + rng.next() * 3, rot: rng.next() * 6, spin: (rng.next() - 0.5) * 3, c: kind === 'leaf' ? leafState(sp, T.t).col : undefined });
    }
  }

  function textScale(dir) { const n = clamp(S.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (n !== S.prefs.textIdx) { S.prefs.textIdx = n; S.scrollY = 0; savePrefs(); } }
  function changeSetting(i, kk) {
    const id = SETTINGS[i].id, p = S.prefs;
    switch (id) {
      case 'forecast': p.forecast = kk === 0; break;
      case 'think': p.thinkIdx = kk; break;
      case 'sound': p.sound = kk === 0; audio.setMuted?.(!p.sound); break;
      case 'calm': p.calm = kk === 1; break;
      case 'restore': monetization.restore().then(() => say('Purchases restored.', 2)).catch(() => {}); return;
      default: break;
    }
    savePrefs(); sfx.tap();
  }

  function updateScene(dt, input) {
    const p = input.pointer, scrolling = ['shelf', 'doc', 'settings', 'over', 'brief'].includes(S.scene);
    const tap = getTap(p, scrolling ? metrics.rect : null);
    if (scrolling) {
      if (wheelInput.dy) { S.scrollY = clamp(S.scrollY + wheelInput.dy, 0, metrics.max); wheelInput.dy = 0; }
      const k = input.keys.pressed;
      if (k.has('ArrowDown')) S.scrollY = clamp(S.scrollY + 80, 0, metrics.max);
      if (k.has('ArrowUp')) S.scrollY = clamp(S.scrollY - 80, 0, metrics.max);
      S.scrollY = clamp(S.scrollY, 0, metrics.max);
    }
    const sc = S.scene, w = meta.width, h = meta.height, sca = TEXT_SCALES[S.prefs.textIdx];
    if (sc === 'play') return updatePlay(dt, input);
    if (sc === 'title') {
      const T = titleLayout(w, h, !!S.saved, sca);
      if (!tap) return;
      for (const id of Object.keys(T.buttons)) if (hit(id, T.buttons[id], tap)) {
        sfx.tap();
        if (id === 'continue') resume(S.last); else if (id === 'play') go('shelf'); else if (id === 'learn') startAuto();
        else if (id === 'howto' || id === 'rules' || id === 'about' || id === 'lessons') { S.doc = { kind: id, page: 0 }; go('doc'); }
        else if (id === 'settings') { S.back = 'title'; go('settings'); }
        return;
      }
      if (Math.abs(tap.x - T.brand.x) < 260 && Math.abs(tap.y - T.brand.y) < 28) env.openArcforgeHome?.();
      return;
    }
    if (sc === 'shelf') {
      const SL = shelfLayout(w, h, sca, COMMISSIONS.length);
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (!tap) return;
      if (hit('back', SL.back, tap)) { go('title'); return; }
      if (hit('tdec', SL.dec, tap)) return textScale(-1);
      if (hit('tinc', SL.inc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) COMMISSIONS.forEach((c, i) => { const r = { ...SL.cards[i], y: SL.cards[i].y - S.scrollY }; if (inRect(r, tap.x, tap.y)) { sfx.tap(); flash('card' + i); openBrief(c.id); } });
      return;
    }
    if (sc === 'brief') {
      const BL = briefLayout(w, h, sca);
      if (input.keys.pressed.has('Escape')) { go('shelf'); return; }
      if (!tap) return;
      if (hit('begin', BL.begin, tap)) { sfx.tap(); startTree(S.briefId); } else if (hit('bback', BL.back, tap)) go('shelf');
      return;
    }
    if (sc === 'doc') {
      const DL = docLayout(w, h, sca), n = DOCS[S.doc.kind].pages.length, k = input.keys.pressed;
      if (k.has('Escape')) { go('title'); return; }
      if (k.has('ArrowRight') && S.doc.page < n - 1) { S.doc.page += 1; S.scrollY = 0; }
      if (k.has('ArrowLeft') && S.doc.page > 0) { S.doc.page -= 1; S.scrollY = 0; }
      if (!tap) return;
      if (hit('back', DL.back, tap)) go('title');
      else if (hit('prev', DL.prev, tap) && S.doc.page > 0) { S.doc.page -= 1; S.scrollY = 0; }
      else if (hit('next', DL.next, tap) && S.doc.page < n - 1) { S.doc.page += 1; S.scrollY = 0; }
      else if (hit('tdec', DL.dec, tap)) textScale(-1);
      else if (hit('tinc', DL.inc, tap)) textScale(1);
      return;
    }
    if (sc === 'settings') {
      const SL = settingsLayout(w, h, sca, SETTINGS.length);
      const leave = () => { if (S.back === 'play' && S.T) { S.scene = 'play'; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
      if (input.keys.pressed.has('Escape')) { leave(); return; }
      if (!tap) return;
      if (hit('back', SL.back, tap)) return leave();
      if (hit('tdec', SL.dec, tap)) return textScale(-1);
      if (hit('tinc', SL.inc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) SETTINGS.forEach((row, i) => {
        const g = SL.rows[i], n = row.opts.length, cw = (g.ctrl.w - 8 * (n - 1)) / n;
        for (let kk = 0; kk < n; kk++) { const r = { x: g.ctrl.x + kk * (cw + 8), y: g.ctrl.y - S.scrollY, w: cw, h: g.ctrl.h }; if (inRect(r, tap.x, tap.y)) { flash('set' + i + '.' + kk); changeSetting(i, kk); } }
      });
      return;
    }
    if (sc === 'pot') {
      const PL = potLayout(w, h);
      if (input.keys.pressed.has('Enter')) { finishTree(); return; }
      if (!tap) return;
      if (hit('back', PL.back, tap)) { if (S.T.year < comOf().years || S.T.t < 24) go('play'); return; }
      for (let i = 0; i < POTS.length; i++) if (hit('pot' + i, PL.cards[i], tap)) { S.potId = POTS[i].id; S.T.potId = S.potId; sfx.tap(); return; }
      if (hit('go', PL.go, tap)) finishTree();
      return;
    }
    if (sc === 'over') {
      const O = overLayout(w, h);
      const step = Math.floor(S.sceneT * 3); if (step !== S.overSeen) { S.overSeen = step; if (step > 1 && step < 9) sfx.score(step); }
      if (!tap) return;
      const R0 = S.result, idx = COMMISSIONS.findIndex((c) => c.id === R0.com);
      if (hit('next', O.btns.next, tap)) { if (R0.auto) startAuto(); else openBrief(COMMISSIONS[(idx + 1) % COMMISSIONS.length].id); }
      else if (hit('menu', O.btns.menu, tap)) { S.T = null; go(R0.auto ? 'title' : 'shelf'); }
      else if (hit('share', O.btns.share, tap)) env.share(`Bonsai: I trained the ${commissionById(R0.com).name} (${STYLES[commissionById(R0.com).style].name}). The judge gave it ${R0.total} out of 100 and ${R0.stars} star${R0.stars === 1 ? '' : 's'}.`);
      return;
    }
    if (sc === 'demo-limit' && tap) go('title');
  }

  const api = {
    update(dt, input) {
      S.sceneT += dt;
      if (S.flash) { S.flash.t += dt; if (S.flash.t > 0.25) S.flash = null; }
      if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold) S.msg = null; }
      const frozen = S.paused || (S.auto.on && S.auto.paused);
      if (!frozen) {
        S.t += dt;
        for (const q of S.parts) { q.t += dt; if (q.vx !== undefined) { q.x += q.vx * dt; q.y += q.vy * dt; if (q.k === 'dot' || q.k === 'leaf') q.vy += 90 * dt; else q.vx += Math.sin(S.t * 1.4 + q.rot) * 12 * dt; } }
        S.parts = S.parts.filter((q) => q.t < q.life);
        for (const f of S.fall) f.t += dt;
        S.fall = S.fall.filter((f) => f.t < f.life);
        for (const q of later) q.t -= dt;
        const due = later.filter((q) => q.t <= 0); if (due.length) { for (const q of due) { later.splice(later.indexOf(q), 1); tone(q.o); } }
      }
      if (S.scene === 'play') { const l = L(); meta.previewBadge = l.mode === 'portrait' ? { x: l.pause.x - 10, y: l.pause.y + 20, align: 'right' } : { x: l.F.x + 4, y: l.F.y + 76, align: 'left' }; } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { render(ctx, S, view ?? meta); },
    getState: () => S,
    // Counts real play only: training a tree. Menus, shelf, Rules, Lessons, settings, Watch and Learn, pause, pot choice and judging are free.
    isPreviewExempt() { return !(S.scene === 'play' && !S.auto.on && !S.paused && S.T); },
    dev: {
      go: (scene, extra) => { Object.assign(S, extra ?? {}); go(scene); },
      start: (id) => startTree(id), auto: () => startAuto(), hint: () => askHint(), doc: (kind, page = 0) => { S.doc = { kind, page }; go('doc'); },
      // grow the current tree for `sec` seconds of tree time; train: let the coach prune and wire as it goes
      grow: (sec, train = true) => { const T = S.T; for (let t = 0, n = 0; t < sec; t += 0.1, n++) { stepTree(T, 0.1); if (train && n % 40 === 39) applyAdvice(T, advise(T)); } T.ev.length = 0; geo(T); S.cam = camTarget(T, potNow(), L().board); S.lastSeason = seasonIdx(T); },
      setTime: (yt) => { S.T.t = yt; S.lastSeason = seasonIdx(S.T); },
      tool: (t) => { S.tool = t; },
      layout: () => { const l = L(); return { mode: l.mode, board: l.board, btn: l.btn, pause: l.pause, rail: l.rail, dial: l.dial, status: l.status }; },
      scr: (wx, wy) => toScreen(S.cam, L().board, wx, wy),
      world: (sx, sy) => toWorld(S.cam, L().board, sx, sy),
      snapCam: () => { S.cam = camTarget(S.T, potNow(), L().board); },
      toPot: () => toPot(), finish: () => finishTree(),
      pot: (id) => { S.potId = id; S.T.potId = id; },
      advise: () => advise(S.T),
      advance: (sec) => { const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } }; for (let i = 0; i < sec * 60; i++) api.update(1 / 60, idle); },
    },
  };
  return api;
}
