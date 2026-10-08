// Pottery Wheel: state and flow. The clay is in sim.js, a pot's life in session.js, the demonstrator in pilot.js; drawing is in view.js / docview.js.
//
// Everything here is pure and deterministic: time is the sum of the dt values handed to update(), randomness comes from env.rng.
// The 3D presenter (view3d/presenter.js) only READS getState().g3 and never writes back.
import { layoutFor, inRect, TEXT_SCALES, menuRects } from './layout.js';
import { camFor, unproject } from './cam.js';
import { newSession, applyFinger, stepSession, advance, undo, canAdvance, stationId, FIRE_TIME } from './session.js';
import { nextStroke, runPilot } from './pilot.js';
import { pack, unpack, potFromOutline, N } from './sim.js';
import { CHALLENGES, STATIONS, CAPTIONS, RULES, THINK_OPTS, WHEEL_OPTS } from './content.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const DEMO_POTS = 3, SHELF_MAX = 24;
const DEMO_TARGET = CHALLENGES.find((c) => c.id === 'vase');
const SCENES_3D = new Set(['title', 'play', 'result', 'study']);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// A calm showpiece for the title and menus (not a session).
function showPot() { return potFromOutline((y) => 0.62 + 0.4 * Math.sin(Math.min(1, y / 2.7) * Math.PI * 0.92) + (y > 2.4 ? 0.06 : 0), 2.9, 0.18, 0.2); }

export function createGame(env) {
  const { rng, storage, config } = env;
  const state = {
    scene: 'title', sceneT: 0, t: 0, backTo: 'title',
    prefs: { sound: true, haptics: true, calm: false, wheelIdx: 1, thinkIdx: 1, textIdx: 0 },
    shelf: [], stars: {}, best: {}, demoPots: 0, nextId: 1,
    ses: null, auto: null, hint: null, paused: false, result: null, sel: 0, study: null,
    credits: '', showPot: showPot(), showT: 0, glFallback: false, zoom: { y1: 4.3, w: 3.5 },
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    scroll: { pick: 0, shelf: 0 }, parts: [], toast: null,
    g3: { rect: null, pot: null, glaze: null, fire: 0, mode: 'title', finger: null, target: null, visible: true, glazed: false, stage: 'fire' },
    audio: { wheel: 0, touch: 0, press: 0, fire: 0, chime: 0 },
    dev: config.dev === true, demo: config.demo === true,
  };
  let lastScene = state.scene, drag = null, potDrag = false, scrollDrag = null;

  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); state.prefs.textIdx = clamp(state.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); applyPrefs(); } });
  storage.get('shelf', null).then((v) => { if (Array.isArray(v) && !state.shelf.length) state.shelf = v.filter((p) => p && p.pack && p.pack.Ro && p.pack.Ro.length === N).slice(0, SHELF_MAX); });
  storage.get('stars', null).then((v) => { if (v) state.stars = v; });
  storage.get('best', null).then((v) => { if (v) state.best = v; });
  storage.get('nextId', 1).then((v) => { state.nextId = Math.max(state.nextId, v | 0); });
  storage.get('demoPots', 0).then((v) => { state.demoPots = Math.max(state.demoPots, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; if (state.ses) state.ses.pot.spin = 6.4 * WHEEL_OPTS[state.prefs.wheelIdx]; }
  applyPrefs();
  const lay = () => layoutFor(meta.width, meta.height);
  const say = (text, hold = 2.2) => { state.toast = { text, t: 0, hold }; };
  const go = (scene) => { state.scene = scene; };
  const tone = (o) => { if (state.prefs.sound) env.audio.tone?.(o); };

  // ---- the camera for the current scene --------------------------------------------------------------------------------------------------
  function potRectFor(scene) {
    const L = lay();
    if (scene === 'title') return L.title.pot;
    if (scene === 'result') return L.result.pot;
    if (scene === 'study') return L.study.pot;
    return L.play.pot;
  }
  // Title, result and study frame the pot more tightly than the play screen (whose camera never moves, so the target outline stays put).
  const zoomWant = () => { const s = state.ses; if (!s) return { y1: 4.3, w: 3.5 }; return s.station <= 1 ? { y1: 2.7, w: 3.1 } : { y1: s.target ? clamp(s.target.H + 0.75, 3.0, 4.3) : 4.3, w: 3.5 }; };
  const boxFor = (scene) => (scene === 'play' ? { y1: state.zoom.y1, worldW: state.zoom.w } : scene === 'title' ? { y1: 3.3, worldW: 2.7 } : scene === 'study' || scene === 'result' ? { y1: Math.max(2.5, (state.g3.pot ? state.g3.pot.H : 3) + 0.6), worldW: 3.2 } : null);
  const camNow = (scene = state.scene) => camFor(meta.width, meta.height, potRectFor(scene), boxFor(scene));

  // ---- sessions --------------------------------------------------------------------------------------------------------------------------------
  function dailyChallenge() { const d = config.day ?? 0; return { ch: CHALLENGES[((d % 12) + 12) % 12], trad: (((d * 5) % 6) + 6) % 6 }; }
  function startSession(kind, ch = null, auto = false) {
    if (config.demo && !auto && state.demoPots >= DEMO_POTS) { go('demo-limit'); return; }
    if (config.demo && !auto) { state.demoPots += 1; storage.set('demoPots', state.demoPots); }
    let target = ch, trad = ch ? ch.trad : 0;
    if (kind === 'daily') { const d = dailyChallenge(); target = d.ch; trad = d.trad; }
    if (auto) { target = DEMO_TARGET; trad = DEMO_TARGET.trad; }
    const ses = newSession({ target, rng: rng.fork(), mode: auto ? 'auto' : kind, trad });
    ses.pot.spin = 6.4 * WHEEL_OPTS[state.prefs.wheelIdx];
    state.ses = ses; state.zoom = { ...zoomWant() }; state.result = null; state.hint = null; state.paused = false; state.parts = [];
    state.auto = auto ? { phase: 'think', t: 0, step: null, last: '', thinkFor: 0, revealFor: 0, fp: { X: 0, Y: 0, down: false } } : null;
    go('play');
    env.monetization.track?.('pot_start', { mode: kind, ch: target?.id ?? 'studio' });
  }
  function leaveSession(to = 'title') { state.ses = null; state.auto = null; state.hint = null; state.paused = false; go(to); }

  // ---- hints (the same planner the demonstration uses) ---------------------------------------------------------------------------------
  function makeHint() {
    const s = state.ses; if (!s) return;
    const id = stationId(s);
    const clone = { ...s, pilot: { ...(s.pilot ?? {}) }, pilotSide: s.pilotSide ?? 1 };
    const n = nextStroke(clone);
    let h;
    if (n && n.id && n.caption && n.id !== 'pick') h = { caption: n.caption, mark: n.mark?.() ?? null };
    else if (id === 'glaze') h = { caption: ['Glaze', 'Pick a tradition and colours below, then hold the brush on the turning pot.'], mark: { X: 0.6, Y: s.pot.H * 0.4 } };
    else if (id === 'shape' && !s.target) h = { caption: CAPTIONS.shape, mark: { X: s.pot.Ro[20] ?? 1, Y: s.pot.yc[20] ?? 1 } };
    else if (n && n.advance) h = { caption: ['This step looks done', 'Tap Next to move on, or keep refining.'], mark: null };
    else h = { caption: [STATIONS[s.station].short, STATIONS[s.station].tip], mark: null };
    state.hint = { ...h, t: 0, hold: 7 };
  }

  // ---- the finishing of a pot ----------------------------------------------------------------------------------------------------------------------
  function finishPot() {
    const s = state.ses, sc = s.scores;
    const key = s.target ? s.target.id : 'studio';
    const old = state.stars[key] ?? 0;
    if (s.mode !== 'auto') {
      state.stars[key] = Math.max(old, sc.stars); storage.set('stars', state.stars);
      state.best[key] = Math.max(state.best[key] ?? 0, sc.total); storage.set('best', state.best);
    }
    state.result = { scores: sc, name: s.target ? s.target.name : 'Studio pot', stars: sc.stars, newBest: sc.stars > old, saved: false, auto: s.mode === 'auto', key, mode: s.mode, chId: s.target?.id ?? null };
    state.audio.chime += 1;
    go('result');
    env.monetization.track?.('pot_end', { key, score: sc.total });
  }
  function saveToShelf() {
    const r = state.result, s = state.ses; if (!r || r.saved || !s || r.auto) return;
    const piece = { id: state.nextId++, name: r.name, day: config.day ?? 0, pack: pack(s.pot), glaze: JSON.parse(JSON.stringify(s.glaze)), total: r.scores.total, stars: r.scores.stars, ch: r.chId };
    state.shelf.unshift(piece); if (state.shelf.length > SHELF_MAX) state.shelf.length = SHELF_MAX;
    storage.set('shelf', state.shelf); storage.set('nextId', state.nextId);
    r.saved = true; say('On the shelf');
  }

  // ---- play: input -> finger -------------------------------------------------------------------------------------------------------------------------
  function playFinger(input) {
    const p = input.pointer, P = lay().play, cam = camNow('play');
    if (p.pressed) potDrag = inRect(P.pot, p.x, p.y);
    if (!p.down) potDrag = false;
    if (potDrag && p.down) { const w = unproject(cam, p.x, p.y); return { X: w.X, Y: w.Y, down: true }; }
    return { X: state.ses.finger.X, Y: state.ses.finger.Y, down: false };
  }
  function playTap(tap) {
    const s = state.ses, P = lay().play, id = stationId(s);
    if (inRect(P.pause, tap.x, tap.y)) { pause(); return true; }
    if (state.auto) return false;
    if (id !== 'fire') {
      if (inRect(P.undo, tap.x, tap.y)) { if (undo(s)) tone({ freq: 300, to: 200, dur: 0.1, vol: 0.2 }); return true; }
      if (inRect(P.hint, tap.x, tap.y)) { makeHint(); return true; }
    }
    if (inRect(P.next, tap.x, tap.y)) { nextStation(); return true; }
    if (id === 'glaze') {
      const G = P.glaze;
      G.trads.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) { s.glaze.trad = i; s.glaze.base = 0; s.glaze.acc = 0; s.glaze.motif = 0; tone({ freq: 520 + i * 40, dur: 0.08, vol: 0.15 }); } });
      G.bases.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) s.glaze.base = i; });
      G.accs.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) s.glaze.acc = i; });
      G.motifs.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) s.glaze.motif = i; });
    }
    return false;
  }
  function nextStation() {
    const s = state.ses, id = stationId(s);
    if (id === 'fire') { s.fireT = FIRE_TIME; s.fireDone = true; return; }
    if (!canAdvance(s)) { say(id === 'open' ? 'Open the lump first' : 'Not yet'); return; }
    if (advance(s)) { state.hint = null; tone({ freq: 440, to: 660, dur: 0.12, vol: 0.2 }); }
  }
  function pause() { if (state.paused || state.shotMode) return; state.paused = true; state.audio.touch = 0; }
  function resume() { state.paused = false; }

  // ---- play: update ----------------------------------------------------------------------------------------------------------------------------------------
  function emit(x, y, n) {
    if (state.prefs.calm) return;
    for (let i = 0; i < n; i++) state.parts.push({ x, y, vx: rng.range(-1.2, 1.2), vy: rng.range(0.6, 2.2), life: 0, max: rng.range(0.4, 0.8) });
    if (state.parts.length > 60) state.parts.splice(0, state.parts.length - 60);
  }
  function stepParts(dt) {
    for (const q of state.parts) { q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy -= 5 * dt; }
    state.parts = state.parts.filter((q) => q.life < q.max);
  }
  function updatePlay(dt, tap, input) {
    const s = state.ses;
    if (state.paused) { updatePauseMenu(tap, input); return; }
    const k = input.keys.pressed;
    if (k.has('Space') || k.has('Escape')) { pause(); return; }
    if (state.auto) updateAuto(dt, tap);
    else {
      if (k.has('KeyH')) makeHint();
      if (k.has('KeyZ')) undo(s);
      if (k.has('KeyN')) nextStation();
      if (tap) playTap(tap);
      const fp = playFinger(input);
      const t = applyFinger(s, fp, dt);
      if (t.contact && t.effort > 0.15 && fp.down) emit(fp.X, fp.Y, 1);
      stepSession(s, dt);
    }
    if (state.scene !== 'play') return;
    { const w = zoomWant(), k = Math.min(1, 2.5 * dt); state.zoom.y1 += (w.y1 - state.zoom.y1) * k; state.zoom.w += (w.w - state.zoom.w) * k; }
    stepParts(dt);
    if (state.hint) { state.hint.t += dt; if (state.hint.t > state.hint.hold) state.hint = null; }
    const A = state.audio, id = stationId(s);
    A.wheel = id === 'fire' ? 0.25 : 1; A.touch = s.tel.contact ? clamp(0.3 + s.tel.effort, 0, 1) : 0; A.press = s.tel.pressure;
    A.fire = id === 'fire' ? clamp(s.fireT / FIRE_TIME, 0, 1) : 0;
    if (id === 'fire' && s.fireDone) { if (state.auto) finishAuto(); else finishPot(); }
  }

  // ---- Watch and Learn -----------------------------------------------------------------------------------------------------------------------------------------
  const thinkSec = () => THINK_OPTS[state.prefs.thinkIdx] ?? 5;
  function updateAuto(dt, tap) {
    const s = state.ses, a = state.auto, P = lay().play;
    if (tap) {
      if (inRect(P.skip, tap.x, tap.y)) { skipStroke(); return; }
      if (inRect(P.close, tap.x, tap.y)) { leaveSession('title'); return; }
      if (inRect(P.pause, tap.x, tap.y)) { pause(); return; }
    }
    const idle = () => { applyFinger(s, { X: a.fp.X, Y: a.fp.Y, down: false }, dt); stepSession(s, dt); };
    if (!a.step) {
      const n = nextStroke(s);
      if (!n) { idle(); return; }
      if (n.advance) { advance(s); return; }
      if (n.wait) { idle(); return; }
      a.step = n; a.phase = 'think'; a.t = 0;
      const repeat = n.id === a.last && n.id !== 'pick';
      a.thinkFor = repeat ? 0.9 : thinkSec(); a.revealFor = repeat ? 0.5 : 2;
      if (n.id === 'pick') { a.thinkFor = Math.min(thinkSec(), 5); a.revealFor = 0.6; }
      n.begin?.(a.fp, s);
    }
    const n = a.step;
    if (a.phase === 'think') { a.t += dt; if (a.t >= a.thinkFor) { a.phase = 'reveal'; a.t = 0; } idle(); return; }
    if (a.phase === 'reveal') { a.t += dt; if (a.t >= a.revealFor) { a.phase = 'act'; a.t = 0; } idle(); return; }
    if (n.id === 'pick') { a.last = n.id; a.step = null; idle(); return; }
    const r = n.run(s, dt, a.fp);
    const fp = r ?? { X: a.fp.X, Y: a.fp.Y, down: false };
    const t = applyFinger(s, fp, dt);
    if (t.contact && t.effort > 0.15 && fp.down) emit(fp.X, fp.Y, 1);
    stepSession(s, dt);
    if (!r) { a.last = n.id; a.step = null; }
  }
  function skipStroke() {
    const s = state.ses, a = state.auto; if (!a) return;
    if (a.step && a.phase === 'act') {
      let guard = 0;
      while (guard++ < 6000) { const r = a.step.run(s, 1 / 30, a.fp); applyFinger(s, r ?? { X: a.fp.X, Y: a.fp.Y, down: false }, 1 / 30); stepSession(s, 1 / 30); if (!r) break; }
      a.last = a.step.id; a.step = null; return;
    }
    if (a.step) { a.phase = 'act'; a.t = 0; }
  }
  function finishAuto() {
    const s = state.ses;
    state.result = { scores: s.scores, name: 'Demonstration', stars: s.scores.stars, newBest: false, saved: false, auto: true, key: 'auto', mode: 'auto', chId: DEMO_TARGET.id };
    state.audio.chime += 1; go('result');
  }

  // ---- pause menu ----------------------------------------------------------------------------------------------------------------------------------------------------
  function pauseItems() { return state.auto ? ['resume', 'skip', 'quit'] : ['resume', 'restart', 'quit']; }
  function updatePauseMenu(tap, input) {
    const items = pauseItems(), M = menuRects(lay(), items.length);
    if (input.keys.pressed.has('Escape') || input.keys.pressed.has('Space')) { resume(); return; }
    if (!tap) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tap.x, tap.y)) return;
      if (it === 'resume') resume();
      else if (it === 'skip') { resume(); skipStroke(); }
      else if (it === 'restart') { const s = state.ses; state.paused = false; startSession(s.mode, s.mode === 'challenge' ? s.target : null); }
      else leaveSession('title');
    });
  }

  // ---- documents -----------------------------------------------------------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs, cyc = (v, n) => (v + 1) % n;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'haptics') p.haptics = !p.haptics;
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'wheel') p.wheelIdx = cyc(p.wheelIdx, WHEEL_OPTS.length);
    else if (id === 'think') p.thinkIdx = cyc(p.thinkIdx, THINK_OPTS.length);
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    savePrefs();
  }
  function updateDoc(input) {
    const p = input.pointer, max = docMetrics.max, view = ui.view;
    const setScroll = (v) => { state.docScroll = Math.max(0, Math.min(v, max)); };
    const wy = input.wheel?.dy || 0;
    if (wy) setScroll(state.docScroll + wy);
    const k = input.keys.pressed;
    if (k.has('ArrowDown')) setScroll(state.docScroll + 70);
    if (k.has('ArrowUp')) setScroll(state.docScroll - 70);
    if (k.has('PageDown')) setScroll(state.docScroll + docMetrics.view * 0.9);
    if (k.has('PageUp')) setScroll(state.docScroll - docMetrics.view * 0.9);
    if (k.has('Escape')) { go(state.backTo); return; }
    if (p.pressed) drag = { x0: p.x, y0: p.y, s0: state.docScroll, moved: false, inView: inRect(view, p.x, p.y) };
    if (drag && p.down) {
      if (Math.abs(p.y - drag.y0) > 14) drag.moved = true;
      if (drag.moved && drag.inView) setScroll(drag.s0 - (p.y - drag.y0));
    }
    if (drag && p.released) {
      const d = drag; drag = null;
      if (d.moved) return;
      for (const h of ui.hits) {
        if (!inRect(h.r, d.x0, d.y0)) continue;
        if (h.clip && !inRect(h.clip, d.x0, d.y0)) continue;
        docAction(h.id); return;
      }
    }
  }
  function docAction(id) {
    if (id === 'back') { go(state.backTo); return; }
    if (id === 'textDec' || id === 'textInc') {
      const n = state.prefs.textIdx + (id === 'textInc' ? 1 : -1);
      if (n < 0 || n >= TEXT_SCALES.length) return;
      state.docFrac = docMetrics.max > 0 ? state.docScroll / docMetrics.max : 0; state.docRescale = true;
      state.prefs.textIdx = n; savePrefs(); return;
    }
    if (id === 'prev') { if (state.rulesPage > 0) { state.rulesPage -= 1; state.docScroll = 0; } return; }
    if (id === 'next') { if (state.rulesPage < RULES.length - 1) { state.rulesPage += 1; state.docScroll = 0; } else go(state.backTo); return; }
    if (id.startsWith('set:')) settingsAction(id.slice(4));
  }

  // ---- title, pick, shelf, study, result --------------------------------------------------------------------------------------------------------------
  function updateTitle(tap) {
    if (!tap) return;
    const T = lay().title, hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(T.throw)) startSession('studio');
    else if (hit(T.challenges)) go('pick');
    else if (hit(T.shelf)) go('shelf');
    else if (hit(T.watch)) startSession('studio', null, true);
    else if (hit(T.how)) openDoc('howto', 'title');
    else if (hit(T.rules)) openDoc('rules', 'title');
    else if (hit(T.about)) openDoc('about', 'title');
    else if (hit(T.settings)) openDoc('settings', 'title');
    else if (tap.y > T.credit.y - 90 && Math.abs(tap.x - T.credit.x) < 190) env.openArcforgeHome?.();
  }
  function listScroll(input, key, grid, total) {
    const p = input.pointer, max = Math.max(0, total - grid.h);
    const set = (v) => { state.scroll[key] = clamp(v, 0, max); };
    set(state.scroll[key]);
    const wy = input.wheel?.dy || 0; if (wy) set(state.scroll[key] + wy);
    if (p.pressed) scrollDrag = { x0: p.x, y0: p.y, s0: state.scroll[key], moved: false, inView: inRect(grid, p.x, p.y) };
    if (scrollDrag && p.down) { if (Math.abs(p.y - scrollDrag.y0) > 14) scrollDrag.moved = true; if (scrollDrag.moved && scrollDrag.inView) set(scrollDrag.s0 - (p.y - scrollDrag.y0)); }
    if (scrollDrag && p.released) { const d = scrollDrag; scrollDrag = null; return d.moved ? null : { x: d.x0, y: d.y0 }; }
    return null;
  }
  const cardRect = (K, i, scroll) => { const c = i % K.cols, r = Math.floor(i / K.cols); return { x: K.grid.x + c * (K.cw + K.gap), y: K.grid.y + r * (K.ch + K.gap) - scroll, w: K.cw, h: K.ch }; };
  function updatePick(input) {
    const L = lay(), K = L.pick;
    if (input.keys.pressed.has('Escape')) { go('title'); return; }
    const tap = listScroll(input, 'pick', K.grid, K.total);
    if (!tap) return;
    if (inRect(L.back, tap.x, tap.y)) { go('title'); return; }
    if (!inRect(K.grid, tap.x, tap.y)) return;
    for (let i = 0; i < 14; i++) {
      if (!inRect(cardRect(K, i, state.scroll.pick), tap.x, tap.y)) continue;
      if (i === 0) startSession('studio');
      else if (i === 1) startSession('daily');
      else {
        if (config.demo && i - 2 >= 3) { go('demo-limit'); return; }
        startSession('challenge', CHALLENGES[i - 2]);
      }
      return;
    }
  }
  function updateShelf(input) {
    const L = lay(), K = L.shelf;
    if (input.keys.pressed.has('Escape')) { go('title'); return; }
    const rows = Math.ceil(Math.max(1, state.shelf.length) / K.cols), total = rows * (K.ch + K.gap);
    const tap = listScroll(input, 'shelf', K.grid, total);
    if (!tap) return;
    if (inRect(L.back, tap.x, tap.y)) { go('title'); return; }
    for (let i = 0; i < state.shelf.length; i++) if (inRect(cardRect(K, i, state.scroll.shelf), tap.x, tap.y) && inRect(K.grid, tap.x, tap.y)) { openStudy(i); return; }
  }
  function openStudy(i) {
    const piece = state.shelf[i]; if (!piece) return;
    state.study = { i, pot: unpack(piece.pack), glaze: piece.glaze, piece }; go('study');
  }
  function updateStudy(tap, input) {
    if (input.keys.pressed.has('Escape')) { go('shelf'); return; }
    if (!tap) return;
    const L = lay();
    if (inRect(L.back, tap.x, tap.y)) { go('shelf'); return; }
    if (inRect(L.study.btns[0], tap.x, tap.y)) { state.shelf.splice(state.study.i, 1); storage.set('shelf', state.shelf); state.study = null; go('shelf'); return; }
    if (inRect(L.study.btns[1], tap.x, tap.y)) go('shelf');
  }
  function updateResult(tap) {
    if (!tap) return;
    const L = lay(), B = L.result.btns, r = state.result;
    if (r.auto) {
      if (inRect(B[0], tap.x, tap.y)) startSession('studio', null, true);
      else if (inRect(B[1], tap.x, tap.y)) startSession('studio');
      else if (inRect(B[2], tap.x, tap.y)) leaveSession('title');
      return;
    }
    if (inRect(B[0], tap.x, tap.y)) saveToShelf();
    else if (inRect(B[1], tap.x, tap.y)) { const s = state.ses; startSession(s.mode, s.mode === 'challenge' ? s.target : null); }
    else if (inRect(B[2], tap.x, tap.y)) leaveSession(r.mode === 'challenge' ? 'pick' : 'title');
  }

  // ---- what the 3D presenter reads -----------------------------------------------------------------------------------------------------------------------------
  function syncView() {
    const g = state.g3, sc = state.scene, s = state.ses;
    g.visible = SCENES_3D.has(sc) && !state.glFallback;
    g.mode = sc;
    if ((sc === 'play' || sc === 'result') && s) {
      const glazed = s.station >= 5;
      g.pot = s.pot; g.glaze = glazed ? s.glaze : null; g.glazed = glazed;
      g.fire = stationId(s) === 'fire' || sc === 'result' ? clamp(s.fireT / FIRE_TIME, 0, 1) : 0;
      g.stage = stationId(s);
      g.finger = s.finger.down && s.tel.contact ? { X: s.finger.X, Y: s.finger.Y, p: s.tel.pressure } : null;
      g.target = s.target && sc === 'play' && s.station >= 2 && s.station <= 4 ? s.target : null;
    } else if (sc === 'study' && state.study) {
      g.pot = state.study.pot; g.glaze = state.study.glaze; g.fire = 1; g.glazed = true; g.stage = 'fire'; g.finger = null; g.target = null;
    } else { g.pot = state.showPot; g.glaze = null; g.fire = 0; g.glazed = false; g.stage = 'fire'; g.finger = null; g.target = null; }
    g.rect = potRectFor(sc === 'study' || sc === 'result' || sc === 'title' ? sc : 'play');
    g.W = meta.width; g.H = meta.height; g.box = boxFor(sc === 'study' || sc === 'result' || sc === 'title' ? sc : 'play');
  }

  // ---- the object the kit and main.js see ----------------------------------------------------------------------------------------------------------------
  const api = {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; scrollDrag = null; potDrag = false; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      state.showT += dt; state.showPot.theta += 0.7 * dt;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'pick') updatePick(input);
      else if (sc === 'shelf') updateShelf(input);
      else if (sc === 'study') { updateStudy(tap, input); if (state.study) state.study.pot.theta += 0.9 * dt; }
      else if (sc === 'play') updatePlay(dt, tap, input);
      else if (sc === 'result') { updateResult(tap); if (state.ses) state.ses.pot.theta += 0.9 * dt; }
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
      if (state.scene !== 'play') { state.audio.touch = 0; state.audio.wheel = state.scene === 'result' || state.scene === 'study' ? 0.15 : 0; state.audio.fire = 0; }
      syncView();
      if (state.scene === 'play') { const P = lay().play; meta.previewBadge = { x: P.pot.x + P.pot.w / 2, y: P.pot.y + P.pot.h - 34, align: 'center' }; } else meta.previewBadge = null;
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems, camNow); },
    getState: () => state,
    autoPause() { if (state.scene === 'play' && !state.paused) pause(); },
    setGL(ok) { state.glFallback = !ok; },
    setCredits(text) { state.credits = String(text || ''); },
    // Everything except real throwing is free: menus, Rules, Watch and Learn, results, the shelf, pause.
    isPreviewExempt() {
      return !(state.scene === 'play' && state.ses && !state.auto && !state.paused);
    },
    // Tester tools (?dev=1): jump to a screen, fast-forward a pot with the pilot.
    dev: {
      jump(o = {}) {
        const sc = o.scene ?? 'title';
        state.shotMode = !!o.shot;
        if (o.pref) Object.assign(state.prefs, o.pref);
        const ch = o.ch !== undefined ? CHALLENGES[o.ch] : null;
        if (sc === 'play' || sc === 'result') {
          startSession(o.mode ?? (ch ? 'challenge' : 'studio'), ch, !!o.auto);
          const s = state.ses;
          if (o.trad !== undefined) s.glaze.trad = o.trad;
          const until = o.station !== undefined ? (q) => q.station >= o.station && (o.frac === undefined || q.stationT >= o.frac) : (o.secs ? (q) => q.t >= o.secs : () => false);
          if (o.station !== undefined || o.secs) runPilot(s, { until });
          state.zoom = { ...zoomWant() };
          if (o.glazed) runPilot(s, { until: (q) => q.glaze.bands.length >= 2 });
          if (sc === 'result') {
            runPilot(s, { until: (q) => q.fireDone });
            s.fireT = FIRE_TIME; s.fireDone = true;
            if (state.auto) finishAuto(); else { finishPot(); if (o.save) saveToShelf(); }
          }
          if (o.pause) pause();
          if (o.hint) makeHint();
        } else if (sc === 'shelf' || sc === 'study') {
          if (o.fill) {
            state.shelf = [];
            for (const idx of o.fill) {
              const c = CHALLENGES[idx], s = newSession({ target: c, rng: rng.fork(), trad: c.trad });
              runPilot(s, { until: (q) => q.fireDone });
              state.shelf.push({ id: state.nextId++, name: c.name, day: 0, pack: pack(s.pot), glaze: JSON.parse(JSON.stringify(s.glaze)), total: s.scores.total, stars: s.scores.stars, ch: c.id });
            }
          }
          if (sc === 'shelf') go('shelf'); else openStudy(o.i ?? 0);
        } else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'pick') { for (const c of CHALLENGES.slice(0, 7)) state.stars[c.id] = 1 + (c.name.length % 3); go('pick'); }
        else go(sc);
      },
    },
  };
  return api;
}
