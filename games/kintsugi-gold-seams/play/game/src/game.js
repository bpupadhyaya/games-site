// Kintsugi: state and flow. Geometry = geom.js, session = play.js, art = art.js, drawing = view.js, layout = layout.js.
import { playLayout, zoomLayout, toWorld, visibleRect, titleLayout, docLayout, settingsLayout, shelfLayout, overLayout, pauseLayout, inRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { VESSELS, vesselById } from './vessels.js';
import { buildVessel } from './geom.js';
import { newSession, finish, trySnap, pickPiece, knobPos, raise, moveBy, pickHint, brushStep, brushUp, reclamp, edgeOf, home, snapInfo, normA, clamp, pack, unpack, mendPct, SPACING } from './play.js';
import { render, metrics, SETTINGS, GUIDES, guideFor } from './view.js';
import { DOCS, ROT_STEP, KEY_STEP, KEY_FINE } from './content.js';
import { dropBakes, bakedPiece } from './art.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_VESSELS = 3;
const BRUSH_TOL = [1.35, 1, 0.8];
const RATE_CSS = 110;       // gold flow limit in css px per second
const DEFAULT_PREFS = { guide: 'auto', brush: 1, glow: true, thinkIdx: 1, sound: true, calm: false, textIdx: 0 };
const NOTES = [523, 587, 659, 784, 880, 1047, 1175];
const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, sceneT2: 0, prefs: { ...DEFAULT_PREFS }, P: null, paused: false, hint: null, drag: null, act: null,
    finger: { x: 0, y: 0, down: false, tail: 0 }, parts: [], msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0 }, back: 'title', result: null,
    winT: 0, winDelay: 0, stats: { v: {} }, saved: null, savedMap: {}, last: null, demoCount: 0, u: 2.8, tolFull: 20, snd: 0, saveAcc: 0,
    auto: { on: false, paused: false, phase: null, timer: 0, i: -1, si: -1, pos: 0, text: '', done: false, tries: 0 },
    dev: config.dev === true,
  };
  const saves = {};
  let gesture = null;

  // ---- persistence -----------------------------------------------------------------------------------------------------------
  const applyPrefs = () => audio.setMuted?.(!S.prefs.sound);
  const savePrefs = () => storage.set('prefs', S.prefs);
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); S.prefs.brush = clamp(S.prefs.brush | 0, 0, 2); } applyPrefs(); });
  storage.get('stats', null).then((v) => { if (v && v.v) S.stats = { v: { ...v.v, ...S.stats.v } }; });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  storage.get('last', null).then((last) => {
    for (const d of VESSELS) storage.get('save.' + d.id, null).then((v) => {
      if (v && v.vid === d.id && v.pieces?.length === d.N) { saves[d.id] = v; S.savedMap[d.id] = { phase: v.phase, placed: v.placedN }; if (last === d.id) { S.last = d.id; S.saved = { vid: d.id, phase: v.phase, placed: v.placedN }; } }
    });
  });
  applyPrefs();
  function persist() {
    const P = S.P;
    if (!P || P.done || P.kind !== 'free') return;
    saves[P.vid] = pack(P); S.savedMap[P.vid] = { phase: P.phase, placed: P.placedN }; S.last = P.vid; S.saved = { vid: P.vid, phase: P.phase, placed: P.placedN };
    storage.set('save.' + P.vid, saves[P.vid]); storage.set('last', P.vid);
  }
  function clearSave(id) { delete saves[id]; delete S.savedMap[id]; storage.remove('save.' + id); if (S.last === id) { S.last = null; S.saved = null; storage.remove('last'); } }

  // ---- sound ------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound) audio.tone(o); };
  const later = [];
  const queue = (t, o) => later.push({ t, o });
  const sfx = {
    pick: () => tone({ freq: 420, to: 380, dur: 0.04, type: 'sine', vol: 0.05 }),
    click: () => { tone({ freq: 1560, to: 1240, dur: 0.06, type: 'triangle', vol: 0.1 }); queue(0.05, { freq: 780, to: 700, dur: 0.18, type: 'sine', vol: 0.08 }); },
    turn: () => tone({ freq: 640, to: 600, dur: 0.025, type: 'sine', vol: 0.035 }),
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.07 }),
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.05 }),
    brush: (i) => tone({ freq: NOTES[i % NOTES.length], to: NOTES[i % NOTES.length] * 1.004, dur: 0.22, type: 'sine', vol: 0.045 }),
    seam: () => { [523, 784, 1047].forEach((f, i) => queue(i * 0.09, { freq: f, to: f, dur: 0.5, type: 'sine', vol: 0.08 })); },
    gild: () => { [392, 523, 659].forEach((f, i) => queue(i * 0.12, { freq: f, to: f * 1.01, dur: 0.4, type: 'triangle', vol: 0.07 })); },
    win: () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => queue(i * 0.14, { freq: f, to: f, dur: 0.7, type: 'sine', vol: 0.085 })); },
  };

  // ---- helpers ----------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.6) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; gesture = null; wheelInput.dy = 0; if (scene !== 'play') S.msg = null; }
  const L = () => { const ph = S.P ? S.P.phase : 'assemble', l = playLayout(meta.width, meta.height, ph, S.P ? vesselById(S.P.vid).N : 8); return ph === 'assemble' ? l : zoomLayout(l, vesselById(S.P.vid).D, S.sceneT2); };
  const rectOf = (l, m = 0) => visibleRect(l, m);
  const defOf = () => vesselById(S.P.vid);
  const Vof = () => buildVessel(defOf());
  const calcU = () => { const l = L(), cpu = meta.cssPerUnit || 0.5; S.u = 1 / (l.board.k * cpu); };
  const brushOpts = (dt) => { const zero = defOf().gild * 1.35 * S.u * BRUSH_TOL[S.prefs.brush]; S.tolFull = zero / 2.4; return { dt, rate: RATE_CSS * S.u, full: zero / 2.4, zero, catchR: zero * 1.2 }; };
  function spark(x, y, n, calm = false) {
    if (S.prefs.calm) n = Math.ceil(n / 4);
    for (let i = 0; i < n; i++) { const a = rng.next() * 6.283, v = 40 + rng.next() * 160; S.parts.push({ k: 'dot', c: rng.next() < 0.7 ? 'gold' : 'pale', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, t: 0, life: 0.6 + rng.next() * 0.7, r: 2.5 + rng.next() * 4 }); }
    if (!calm && !S.prefs.calm) S.parts.push({ k: 'glint', x, y, t: 0, life: 0.7, r: 22 });
    if (S.parts.length > 220) S.parts.splice(0, S.parts.length - 220);
  }
  const ring = (x, y, r0, r1) => S.parts.push({ k: 'ring', x, y, r0, r1, t: 0, life: 0.7 });

  // ---- starting / leaving a vessel -------------------------------------------------------------------------------------------------------
  function begin(P, extra = {}) {
    S.P = P; S.paused = false; S.hint = null; S.drag = null; S.act = null; S.parts = []; S.msg = null; S.result = null; S.winT = 0; S.winDelay = 0; S.finger.down = false; S.finger.tail = 0; S.sceneT2 = P.phase === 'assemble' ? 0 : 1; S.saveAcc = 0;
    S.auto = { on: false, paused: false, phase: null, timer: 0, i: -1, si: -1, pos: 0, text: '', done: false, tries: 0, ...extra };
    dropBakes(P.vid); go('play'); calcU();
  }
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_VESSELS) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }
  function startVessel(id) {
    if (saves[id]) return resume(id);
    if (demoBlocked()) return;
    begin(newSession(vesselById(id), rng, 'free', rectOf(playLayout(meta.width, meta.height, 'assemble', vesselById(id).N)))); persist();
    say(S.P.pieces.length + ' shards. Drag one to begin.', 2.4);
  }
  function resume(id) {
    const v = saves[id]; if (!v) return startVessel(id);
    begin(unpack(v)); say('Welcome back.', 1.6);
  }
  function restartVessel() { const id = S.P.vid; clearSave(id); begin(newSession(vesselById(id), rng, 'free', rectOf(playLayout(meta.width, meta.height, 'assemble', vesselById(id).N)))); persist(); }
  function startAuto() {
    const idx = Math.max(0, VESSELS.findIndex((v) => !S.stats.v[v.id])), def = VESSELS[Math.min(idx, 3)];
    begin(newSession(def, rng, 'auto', rectOf(playLayout(meta.width, meta.height, 'assemble', def.N))), { on: true, text: 'Watch the game mend this vessel and explain each step.' });
  }

  // ---- placing --------------------------------------------------------------------------------------------------------------------------
  function placed(i, byHand = true) {
    const V = Vof(), h = home(V, i), P = S.P;
    sfx.click(); ring(h.x, h.y, 20, 90); spark(h.x, h.y, 16);
    S.hint = null;
    if (P.phase === 'gild') { S.sceneT2 = 0; sfx.gild(); say('Now fill the cracks with gold. Trace slowly.', 3.2); P.sel = -1; }
    else if (byHand) say(`${P.placedN} of ${P.pieces.length} shards in place.`, 1.4);
    persist();
  }
  function releaseDrag() {
    const d = S.drag; S.drag = null;
    if (!d) return;
    if (d.mode === 'move' && trySnap(Vof(), defOf(), S.P, d.i)) placed(d.i);
  }
  function rotateSel(deg) {
    const P = S.P; if (P.sel < 0 || P.pieces[P.sel].placed) { say('Tap a shard first.', 1.6); return; }
    P.pieces[P.sel].a = normA(P.pieces[P.sel].a + (deg * Math.PI) / 180); sfx.turn();
  }

  // ---- hints ---------------------------------------------------------------------------------------------------------------------------------
  function nextSeam() {
    const P = S.P, V = Vof(), from = P.brush ? V.seams[P.brush.s].pts[P.brush.i] : null;
    let best = -1, bd = 1e9;
    P.seamDone.forEach((d, i) => { if (d) return; const p = V.seams[i].pts[0], dd = from ? Math.hypot(p[0] - from[0], p[1] - from[1]) : i; if (dd < bd) { bd = dd; best = i; } });
    return best;
  }
  function askHint() {
    const P = S.P, V = Vof();
    if (P.done || S.act) return;
    if (P.phase === 'gild') { if (S.hint) { S.hint = null; return; } const si = nextSeam(); if (si >= 0) { S.hint = { kind: 'seam', id: si, stage: 'look' }; P.hints += 1; sfx.hint(); } return; }
    if (!S.hint || S.hint.kind !== 'piece' || P.pieces[S.hint.id].placed) { const i = pickHint(V, P); if (i < 0) return; S.hint = { kind: 'piece', id: i, stage: 'look' }; P.hints += 1; P.sel = i; sfx.hint(); return; }
    if (S.hint.stage === 'look') { S.hint.stage = 'show'; sfx.hint(); return; }
    const i = S.hint.id, pc = P.pieces[i]; raise(P, i); S.act = { i, t: 0, dur: 0.9, x0: pc.x, y0: pc.y, a0: pc.a }; S.hint.stage = 'go'; sfx.hint();
  }
  function stepAct(dt) {
    const a = S.act, P = S.P, V = Vof(); if (!a) return false;
    a.t += dt; const e = easeIO(clamp(a.t / a.dur, 0, 1)), h = home(V, a.i), pc = P.pieces[a.i];
    pc.x = a.x0 + (h.x - a.x0) * e; pc.y = a.y0 + (h.y - a.y0) * e; pc.a = a.a0 + normA(0 - a.a0) * e;
    if (a.t >= a.dur) { S.act = null; pc.x = h.x; pc.y = h.y; pc.a = 0; trySnap(V, defOf(), P, a.i); placed(a.i, false); return true; }
    return false;
  }

  // ---- gilding ----------------------------------------------------------------------------------------------------------------------------------
  function afterBrush(ev, dt) {
    const P = S.P;
    if (ev.moved) {
      S.snd -= dt;
      if (S.snd <= 0) { S.snd = 0.14; sfx.brush(Math.floor(P.seamQ.reduce((n, q) => n + q.length, 0) % 7 + (ev.x + ev.y) / 40)); }
      if (rng.next() < 0.5 && !S.prefs.calm) S.parts.push({ k: 'dot', c: 'gold', x: ev.x + (rng.next() - 0.5) * 8, y: ev.y + (rng.next() - 0.5) * 8, vx: (rng.next() - 0.5) * 40, vy: -rng.next() * 50, t: 0, life: 0.5, r: 2 + rng.next() * 2.5 });
    }
    for (const s of ev.done) { const V = Vof(), pts = V.seams[s].pts, m = pts[Math.floor(pts.length / 2)]; sfx.seam(); spark(m[0], m[1], 14); ring(m[0], m[1], 10, 60); }
    if (P.done) win();
    if (ev.done.length) persist();
  }
  function win() {
    const P = S.P; if (S.winT > 0) return;
    S.winT = 3.2; S.winDelay = 3.0; S.hint = null; S.finger.down = false; sfx.win();
    const V = Vof(), b = V.bounds; for (let i = 0; i < 6; i++) spark(b.x0 + rng.next() * b.w, b.y0 + rng.next() * b.h, 8);
    if (S.auto.on) { S.auto.done = true; S.auto.text = 'Mended. That is every step.'; S.winDelay = 0; return; }
    const id = P.vid, rec = S.stats.v[id] ?? { stars: 0, best: 0, n: 0 }, pct = mendPct(P), newBest = pct > rec.best;
    rec.n += 1; rec.stars = Math.max(rec.stars, P.stars); rec.best = Math.max(rec.best, pct); S.stats.v[id] = rec;
    storage.set('stats', S.stats); storage.set('progress', { mended: Object.values(S.stats.v).filter((r) => r.stars).length }); clearSave(id);
    monetization.track('vessel_mended', { id, mend: pct, stars: P.stars });
    S.result = { vid: id, mend: pct, stars: P.stars, time: P.t, hints: P.hints, newBest };
  }

  // ---- Watch and Learn -----------------------------------------------------------------------------------------------------------------------------
  function autoTick(dt) {
    const a = S.auto, P = S.P, V = Vof(), think = THINK_STEPS[S.prefs.thinkIdx];
    if (a.paused || a.done) return;
    if (P.phase === 'assemble') {
      if (S.act) { stepAct(dt); if (!S.act) { a.phase = 'gap'; a.timer = 0.5; } return; }
      if (a.phase === 'gap') { a.timer -= dt; if (a.timer > 0) return; a.phase = null; }
      if (a.phase === null) {
        const i = pickHint(V, P); if (i < 0) return;
        a.i = i; S.hint = { kind: 'piece', id: i, stage: 'look' }; P.sel = i; a.phase = 'think'; a.timer = think; return;
      }
      if (a.phase === 'think') { a.timer -= dt; a.text = `Thinking: which shard fits next? ${Math.ceil(Math.max(0, a.timer))}s`; if (a.timer <= 0) { S.hint.stage = 'show'; a.phase = 'reveal'; a.timer = 2; a.text = 'It belongs here: its pattern continues the neighbours.'; } return; }
      if (a.phase === 'reveal') { a.timer -= dt; if (a.timer <= 0) { const pc = P.pieces[a.i]; raise(P, a.i); S.act = { i: a.i, t: 0, dur: 1.2, x0: pc.x, y0: pc.y, a0: pc.a }; a.phase = 'act'; a.text = 'Turning it and sliding it home.'; } }
      return;
    }
    if (P.phase === 'gild') {
      if (a.phase === 'gap') { a.timer -= dt; if (a.timer > 0) return; a.phase = null; }
      if (a.phase === null) {
        const si = nextSeam(); if (si < 0) return;
        a.si = si; a.tries = 0; S.hint = { kind: 'seam', id: si, stage: 'look' }; a.phase = 'think'; a.timer = Math.max(0.8, Math.min(2, think * 0.4)); a.text = 'Thinking: trace the next crack slowly from its start.'; return;
      }
      if (a.phase === 'think') { a.timer -= dt; if (a.timer <= 0) { a.phase = 'reveal'; a.timer = 0.8; a.text = 'Steady hand, steady gold.'; } return; }
      if (a.phase === 'reveal') { a.timer -= dt; if (a.timer <= 0) { S.hint = null; a.phase = 'act'; a.pos = 0; brushUp(P); } return; }
      if (a.phase === 'act') {
        const s = V.seams[a.si], o = brushOpts(dt); a.pos += (o.rate * 0.26 * dt) / SPACING;
        const k = Math.min(s.pts.length - 1, Math.floor(a.pos)), p = s.pts[k];
        const ev = brushStep(V, P, p[0] + Math.sin(S.t * 3) * 0.7 * S.u, p[1] + Math.cos(S.t * 2.3) * 0.7 * S.u, o);
        afterBrush(ev, dt);
        if (P.seamDone[a.si] || a.pos > s.pts.length + 6) {
          brushUp(P);
          if (!P.seamDone[a.si]) { const q = P.seamQ[a.si]; for (let j = 0; j < q.length; j++) q[j] = Math.max(q[j], 0.7); P.seamDone[a.si] = true; if (P.seamDone.every(Boolean)) { finish(V, P); win(); } }
          a.phase = 'gap'; a.timer = 0.4;
        }
      }
    }
  }

  // ---- input ------------------------------------------------------------------------------------------------------------------------------------------
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
  const scrP = (p) => { const l = L(); return { x: l.board.x + (p[0] - l.board.vx0) * l.board.k, y: l.board.y + (p[1] - l.board.vy0) * l.board.k }; };
  const world = (l, p) => toWorld(l, p.x, p.y);

  function cycleGuide() {
    const cur = guideFor(S, defOf()), next = GUIDES[(GUIDES.indexOf(cur) + 1) % GUIDES.length];
    S.prefs.guide = next; savePrefs(); say('Guide: ' + next, 1.4);
  }
  function openPause() { S.paused = true; S.drag = null; S.finger.down = false; S.finger.tail = 0; brushUp(S.P); persist(); }

  function updatePlay(dt, input) {
    const P = S.P, l = L(), p = input.pointer, k = input.keys.pressed;
    calcU();
    const frozen = S.paused || (S.auto.on && S.auto.paused);
    if (S.winDelay > 0 && !frozen) { S.winDelay -= dt; if (S.winDelay <= 0 && S.result) go('over'); }
    if (!frozen) {
      if (!S.auto.on && !P.done) { P.t += dt; S.saveAcc += dt; if (S.saveAcc > 6) { S.saveAcc = 0; persist(); } }
      if (S.auto.on) autoTick(dt); else if (S.act) stepAct(dt);
      if (P.phase !== 'assemble') S.sceneT2 += dt; else reclamp(Vof(), P, rectOf(l, 0), S.drag ? S.drag.i : S.act ? S.act.i : -1);
      // bake shard bitmaps a few per frame
      let budget = 3; for (let i = 0; i < P.pieces.length && budget > 0; i++) if (!bakedPiece(Vof(), i)) budget--;
    }
    if (k.has('KeyP') || k.has('Escape')) { if (S.auto.on) S.auto.paused = !S.auto.paused; else if (!P.done) { if (S.paused) S.paused = false; else openPause(); } }
    const tap = p.pressed ? { x: p.x, y: p.y } : null;
    if (S.paused) {
      if (!tap) return;
      const pl = pauseLayout(meta.width, meta.height);
      if (hit('resume', pl.resume, tap)) S.paused = false;
      else if (hit('restart', pl.restart, tap)) restartVessel();
      else if (hit('psettings', pl.settings, tap)) { S.back = 'play'; go('settings'); }
      else if (hit('pmenu', pl.menu, tap)) { persist(); S.paused = false; go('title'); }
      return;
    }
    if (S.auto.on) {
      if (!tap) return;
      const A = l.rail;
      if (hit('aexit', A.exit, tap)) { S.auto.on = false; S.hint = null; S.act = null; S.P = null; go('title'); }
      else if (hit('apause', A.pause, tap) || hit('pause', l.pause, tap)) S.auto.paused = !S.auto.paused;
      else if (hit('adec', A.dec, tap)) { if (S.prefs.thinkIdx > 0) { S.prefs.thinkIdx -= 1; savePrefs(); } }
      else if (hit('ainc', A.inc, tap)) { if (S.prefs.thinkIdx < THINK_STEPS.length - 1) { S.prefs.thinkIdx += 1; savePrefs(); } }
      return;
    }
    if (P.done) return;
    const V = Vof(), def = defOf();
    // keyboard
    if (P.phase === 'assemble') {
      const fine = input.keys.down.has('ShiftLeft') || input.keys.down.has('ShiftRight');
      if (k.has('KeyQ')) rotateSel(-(fine ? KEY_FINE : KEY_STEP)); if (k.has('KeyE')) rotateSel(fine ? KEY_FINE : KEY_STEP);
      if (P.sel >= 0 && !P.pieces[P.sel].placed) {
        const st = fine ? 2 : 8, rc = rectOf(l, 0);
        if (k.has('ArrowLeft')) moveBy(V, P, P.sel, -st, 0, rc); if (k.has('ArrowRight')) moveBy(V, P, P.sel, st, 0, rc); if (k.has('ArrowUp')) moveBy(V, P, P.sel, 0, -st, rc); if (k.has('ArrowDown')) moveBy(V, P, P.sel, 0, st, rc);
        if (k.has('Enter') && trySnap(V, def, P, P.sel)) placed(P.sel);
      }
      if (k.has('Tab')) { const loose = P.pieces.map((q, i) => i).filter((i) => !P.pieces[i].placed); if (loose.length) { const at = loose.indexOf(P.sel); P.sel = loose[(at + 1) % loose.length]; raise(P, P.sel); sfx.pick(); } }
      if (wheelInput.dy && P.sel >= 0) { rotateSel(Math.sign(wheelInput.dy) * KEY_STEP); wheelInput.dy = 0; }
    }
    wheelInput.dy = 0;
    if (k.has('KeyH')) askHint();
    if (k.has('KeyG') && P.phase === 'assemble') cycleGuide();
    // pointer
    const w = world(l, p), inBoard = p.x >= l.board.x && p.x <= l.board.x + l.board.w && p.y >= l.board.y && p.y <= l.board.y + l.board.h;
    if (p.pressed) {
      if (hit('pause', l.pause, p)) { openPause(); return; }
      if (hit('hint', l.btn.hint, p)) { askHint(); return; }
      if (l.btn.guide && hit('guide', l.btn.guide, p)) { cycleGuide(); return; }
      if (l.btn.rotl && hit('rotl', l.btn.rotl, p)) { rotateSel(-ROT_STEP); return; }
      if (l.btn.rotr && hit('rotr', l.btn.rotr, p)) { rotateSel(ROT_STEP); return; }
      if (inBoard && !S.act) {
        if (P.phase === 'assemble') {
          let grabbed = false;
          if (P.sel >= 0 && !P.pieces[P.sel].placed) {
            const kp = knobPos(V, P, P.sel, S.u), pc = P.pieces[P.sel];
            if (Math.hypot(w.x - kp.x, w.y - kp.y) < 24 * S.u) { S.drag = { mode: 'rot', i: P.sel, base: Math.atan2(w.y - pc.y, w.x - pc.x) - pc.a }; grabbed = true; }
          }
          if (!grabbed) {
            const i = pickPiece(V, P, w.x, w.y);
            if (i >= 0) { raise(P, i); P.sel = i; S.drag = { mode: 'move', i, dx: w.x - P.pieces[i].x, dy: w.y - P.pieces[i].y }; sfx.pick(); if (S.hint && S.hint.kind === 'piece' && S.hint.id !== i) S.hint = null; }
            else { P.sel = -1; }
          }
        } else if (P.phase === 'gild') { S.finger.down = true; S.hint = S.hint && S.hint.kind === 'seam' ? null : S.hint; P.brush = null; }
      }
    }
    if (S.drag) {
      const d = S.drag, pc = P.pieces[d.i];
      if (!p.down) releaseDrag();
      else if (d.mode === 'move') { const rc = edgeOf(V, d.i, rectOf(l, 0)); pc.x = clamp(w.x - d.dx, rc.x0, rc.x1); pc.y = clamp(w.y - d.dy, rc.y0, rc.y1); }
      else pc.a = normA(Math.atan2(w.y - pc.y, w.x - pc.x) - d.base);
      if (S.drag && d.mode === 'rot' && Math.floor(pc.a * 12) !== d.tick) { d.tick = Math.floor(pc.a * 12); sfx.turn(); }
    }
    if (P.phase === 'gild') {
      if (S.finger.down && p.down) { S.finger.x = w.x; S.finger.y = w.y; const ev = brushStep(V, P, w.x, w.y, brushOpts(dt)); afterBrush(ev, dt); }
      else if (S.finger.down) { S.finger.down = false; S.finger.tail = P.brush ? 1.4 : 0; }
      if (!S.finger.down && S.finger.tail > 0) {   // the gold finishes flowing to where the finger was lifted
        S.finger.tail -= dt;
        const ev = brushStep(V, P, S.finger.x, S.finger.y, brushOpts(dt)); afterBrush(ev, dt);
        const bp = P.brush ? V.seams[P.brush.s].pts[P.brush.i] : null;
        if (!bp || Math.hypot(bp[0] - S.finger.x, bp[1] - S.finger.y) < 3 * S.u || S.finger.tail <= 0) { S.finger.tail = 0; brushUp(P); persist(); }
      }
    }
  }

  function textScale(dir) { const n = clamp(S.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (n !== S.prefs.textIdx) { S.prefs.textIdx = n; S.scrollY = 0; savePrefs(); } }
  function changeSetting(i, kk) {
    const id = SETTINGS[i].id, p = S.prefs;
    switch (id) {
      case 'guide': p.guide = ['auto', 'picture', 'outline', 'slots', 'off'][kk]; break;
      case 'brush': p.brush = kk; break;
      case 'glow': p.glow = kk === 0; break;
      case 'think': p.thinkIdx = kk; break;
      case 'sound': p.sound = kk === 0; audio.setMuted?.(!p.sound); break;
      case 'calm': p.calm = kk === 1; break;
      case 'restore': monetization.restore().then(() => say('Purchases restored.', 2)).catch(() => {}); return;
      default: break;
    }
    savePrefs(); sfx.tap();
  }

  function updateScene(dt, input) {
    const p = input.pointer, scrolling = ['shelf', 'doc', 'settings', 'over'].includes(S.scene);
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
        else if (id === 'howto' || id === 'rules' || id === 'about') { S.doc = { kind: id, page: 0 }; go('doc'); }
        else if (id === 'settings') { S.back = 'title'; go('settings'); }
        return;
      }
      if (Math.abs(tap.x - T.brand.x) < 260 && Math.abs(tap.y - T.brand.y) < Math.max(40, 23 / (meta.cssPerUnit || 0.5))) env.openArcforgeHome?.();
      return;
    }
    if (sc === 'shelf') {
      const SL = shelfLayout(w, h, sca, VESSELS.length);
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (!tap) return;
      if (hit('back', SL.back, tap)) { go('title'); return; }
      if (hit('tdec', SL.dec, tap)) return textScale(-1);
      if (hit('tinc', SL.inc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) VESSELS.forEach((d, i) => { const r = { ...SL.cards[i], y: SL.cards[i].y - S.scrollY }; if (inRect(r, tap.x, tap.y)) { sfx.tap(); flash('card' + i); startVessel(d.id); } });
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
      const leave = () => { if (S.back === 'play' && S.P) { S.scene = 'play'; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
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
    if (sc === 'over') {
      const O = overLayout(w, h, sca);
      if (!tap) return;
      const R0 = S.result, idx = VESSELS.findIndex((v) => v.id === R0.vid);
      if (hit('next', O.btns.next, tap)) startVessel(VESSELS[(idx + 1) % VESSELS.length].id);
      else if (hit('menu', O.btns.menu, tap)) go('shelf');
      else if (hit('share', O.btns.share, tap)) env.share(`Kintsugi: I mended the ${vesselById(R0.vid).name} with gold seams - ${R0.mend}% mend, ${R0.stars} star${R0.stars === 1 ? '' : 's'}.`);
      return;
    }
    if (sc === 'demo-limit' && tap) go('title');
  }

  return {
    update(dt, input) {
      S.sceneT += dt;
      if (S.flash) { S.flash.t += dt; if (S.flash.t > 0.25) S.flash = null; }
      if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold) S.msg = null; }
      const frozen = S.paused || (S.auto.on && S.auto.paused);
      if (!frozen) {
        S.t += dt;
        for (const q of S.parts) { q.t += dt; if (q.vx !== undefined) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 120 * dt; } }
        S.parts = S.parts.filter((q) => q.t < q.life);
        if (S.winT > 0) S.winT -= dt;
        for (const q of later) q.t -= dt;
        const due = later.filter((q) => q.t <= 0); if (due.length) { for (const q of due) { later.splice(later.indexOf(q), 1); tone(q.o); } }
      }
      if (S.scene === 'play') { const l = L(); meta.previewBadge = l.mode === 'portrait' ? { x: l.pause.x - 10, y: l.pause.y + 20, align: 'right' } : { x: l.F.x + 4, y: l.F.y + 76, align: 'left' }; } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { render(ctx, S, view ?? meta); },
    getState: () => S,
    // Counts real play only: assembling or gilding a vessel. Menus, shelf, Rules, settings, Watch and Learn, pause and results are free.
    isPreviewExempt() { return !(S.scene === 'play' && !S.auto.on && !S.paused && S.P && !S.P.done); },
    dev: {
      go: (scene, extra) => { Object.assign(S, extra ?? {}); go(scene); },
      start: (id) => startVessel(id), auto: () => startAuto(), hint: () => askHint(), doc: (kind, page = 0) => { S.doc = { kind, page }; go('doc'); },
      placeN: (n) => { const P = S.P, V = Vof(); let c = 0; for (let i = 0; i < P.pieces.length && c < n; i++) if (!P.pieces[i].placed) { const h = home(V, i), pc = P.pieces[i]; pc.x = h.x; pc.y = h.y; pc.a = 0; trySnap(V, defOf(), P, i); c++; } if (P.phase === 'gild') S.sceneT2 = 2; },
      gild: (frac, q = 0.95) => { const P = S.P; P.seamQ.forEach((a, si) => { if (si / P.seamQ.length < frac) { a.fill(q); P.seamDone[si] = true; } }); },
      layout: () => { const l = L(); return { mode: l.mode, board: l.board, vis: rectOf(l), u: S.u, btn: l.btn, pause: l.pause, rail: l.rail }; },
      solveNow: () => { const P = S.P, V = Vof(); for (let i = 0; i < P.pieces.length; i++) if (!P.pieces[i].placed) { const h = home(V, i); Object.assign(P.pieces[i], { x: h.x, y: h.y, a: 0 }); trySnap(V, defOf(), P, i); } P.seamQ.forEach((a, si) => { a.fill(0.96); P.seamDone[si] = true; }); finish(V, P); win(); },
      scr: (wx, wy) => { const l = L(); return { x: l.board.x + (wx - l.board.vx0) * l.board.k, y: l.board.y + (wy - l.board.vy0) * l.board.k }; },
      homeOf: (i) => home(Vof(), i), pieceR: (i) => Vof().pieces[i].r, seamCount: () => Vof().seams.length,
      seamPts: (si, every = 4) => { const pts = Vof().seams[si].pts, out = []; for (let k = 0; k < pts.length; k += every) out.push(L && scrP(pts[k])); out.push(scrP(pts[pts.length - 1])); return out; },
      skipOver: () => { S.winDelay = 0.01; },
    },
  };
}
