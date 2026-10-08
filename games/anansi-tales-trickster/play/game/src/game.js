// Anansi Tales: state and flow. Content = content.js, rules = engine.js, drawing = art.js + view.js, geometry = layout.js.
import { playLayout, titleLayout, docLayout, settingsLayout, talesLayout, galleryLayout, overLayout, pauseLayout, inRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { TALES, DOCS } from './content.js';
import { newSession, startBeat, advance, tapChoose, tapOrder, tapMatchLeft, tapMatchRight, tapTrap, hintStep, nextTarget, autoAct, starsFor, narrationOf, puzzleOf, fmtTime } from './engine.js';
import { render, metrics, hits, SETTINGS, docOf } from './view.js';
import { setLook, LOOK_IDS } from './ui.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen; everything lays out from the live size.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_STARTS = 2;
const TYPE_SPEED = 46;            // characters per second while the storyteller speaks
const SCALE = [392, 440, 523.25, 587.33, 659.25, 783.99, 880];   // a gentle pentatonic
const DEFAULT_PREFS = { look: 'dusk', hand: 'left', sound: true, music: true, calm: false, textIdx: 0, thinkIdx: 1, next: 0 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wordsOf = (t) => t.split(' ').length;

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const St = {
    scene: 'title', t: 0, at: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS },
    P: null, paused: false, say: null,
    auto: { on: false, phase: null, timer: 0, paused: false, done: false, gap: 0 },
    msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0, tale: 0 }, back: 'title', result: null,
    stats: { tales: TALES.map(() => ({ done: 0, stars: 0, best: 0 })), told: 0 }, saved: null,
    demoCount: 0, demo: config.demo === true, saveAcc: 0, px: 0, look: { x: 0.5, y: 0 }, beatPulse: 0, cheer: 0, confetti: [], sfx: [], calm: false,
    mus: { t: 0, i: 2, n: 0, seed: 12345 }, dev: config.dev === true,
  };
  const S_ = St;
  let saveRaw = null;

  // ---- persistence ---------------------------------------------------------------------------------------------------------------
  const applyPrefs = () => { setLook(S_.prefs.look); audio.setMuted?.(!S_.prefs.sound); S_.calm = S_.prefs.calm; };
  const savePrefs = () => storage.set('prefs', S_.prefs);
  const saveStats = () => storage.set('stats', S_.stats);
  storage.get('prefs', null).then((v) => { if (v) { S_.prefs = { ...DEFAULT_PREFS, ...v }; S_.prefs.textIdx = clamp(S_.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S_.prefs.thinkIdx = clamp(S_.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); S_.prefs.next = clamp(S_.prefs.next | 0, 0, TALES.length - 1); if (!LOOK_IDS.includes(S_.prefs.look)) S_.prefs.look = 'dusk'; } applyPrefs(); });
  storage.get('stats', null).then((v) => { if (v && Array.isArray(v.tales)) S_.stats = { told: v.told | 0, tales: TALES.map((_, i) => ({ done: 0, stars: 0, best: 0, ...(v.tales[i] ?? {}) })) }; });
  storage.get('demoCount', 0).then((v) => { S_.demoCount = Math.max(S_.demoCount, v | 0); });
  storage.get('save', null).then((v) => { if (v && TALES[v.tale] && S_.scene === 'title' && !S_.P) { saveRaw = v; S_.saved = { tale: v.tale, beat: v.beat }; } });
  applyPrefs();
  function persistSession() {
    const P = S_.P;
    if (!P || P.done || S_.auto.on || P.phase === 'over') return;
    const beat = P.phase === 'intro' ? 0 : Math.min(P.beat, 3);
    saveRaw = { seed: P.seed, tale: P.tale, beat, misses: P.misses, hints: P.hints, t: P.t, intro: P.phase === 'intro' };
    S_.saved = { tale: P.tale, beat };
    storage.set('save', saveRaw);
  }
  const clearSave = () => { saveRaw = null; S_.saved = null; storage.remove('save'); };

  // ---- sound ---------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S_.prefs.sound) audio.tone(o); };
  const later = (t, o) => S_.sfx.push({ t, o });
  const sfx = {
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.06 }),
    place: () => { tone({ freq: 523, to: 659, dur: 0.12, type: 'triangle', vol: 0.07 }); },
    wrong: () => tone({ freq: 220, to: 150, dur: 0.22, type: 'triangle', vol: 0.07 }),
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.08 }),
    cheer: () => { [523, 659, 784, 1047].forEach((f, i) => later(i * 0.09, { freq: f, to: f * 1.01, dur: 0.4, type: 'triangle', vol: 0.075 })); },
    win: () => { [392, 523, 659, 784, 1047, 1318].forEach((f, i) => later(i * 0.13, { freq: f, to: f * 1.005, dur: 0.55, type: 'triangle', vol: 0.085 })); },
  };
  // A soft generative thumb-piano line over a slow drum: deterministic from its own tiny generator (never touches env.rng).
  function musicTick(dt) {
    const m = S_.mus; m.t += dt;
    if (S_.beatPulse > 0) S_.beatPulse = Math.max(0, S_.beatPulse - dt * 2.2);
    if (m.t < 0.46) return;
    m.t -= 0.46; m.n += 1; m.seed = (Math.imul(m.seed, 1664525) + 1013904223) >>> 0;
    const r = m.seed / 4294967296;
    if (m.n % 4 === 1) { S_.beatPulse = 1; if (S_.prefs.music) tone({ freq: 130, to: 62, dur: 0.2, type: 'sine', vol: 0.06 }); }
    if (!S_.prefs.music) return;
    if (r < 0.62) { m.i = clamp(m.i + (r < 0.2 ? -1 : r < 0.4 ? 1 : r < 0.5 ? -2 : 2), 0, SCALE.length - 1); const f = SCALE[m.i]; tone({ freq: f, to: f * 0.998, dur: 0.55, type: 'sine', vol: 0.03 }); tone({ freq: f * 2, to: f * 2, dur: 0.2, type: 'sine', vol: 0.008 }); }
  }

  // ---- small helpers ---------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.6) => { S_.msg = { text, t: 0, hold }; };
  const flash = (id) => { S_.flash = { id, t: 0 }; };
  function go(scene) { S_.scene = scene; S_.sceneT = 0; S_.scrollY = 0; wheelInput.dy = 0; S_.msg = null; }
  const L = () => playLayout(meta.width, meta.height, { hand: S_.prefs.hand, rail: S_.auto.on });
  const frozen = () => S_.paused || (S_.auto.on && S_.auto.paused);
  const talk = () => { const n = narrationOf(S_.P); S_.say = n ? { text: n.text, n: 0 } : null; };
  function confetti(n = 46) { for (let i = 0; i < n; i++) S_.confetti.push({ x: 0.2 + rng.next() * 0.6, y: 0.62, vx: (rng.next() - 0.5) * 0.9, vy: -0.5 - rng.next() * 0.9, a: rng.next() * 6, va: (rng.next() - 0.5) * 12, c: rng.int(5), t: 0, life: 1.4 + rng.next() * 0.8 }); if (S_.confetti.length > 120) S_.confetti.splice(0, S_.confetti.length - 120); }

  // ---- starting tales --------------------------------------------------------------------------------------------------------------
  function begin(P, auto = false) {
    S_.P = P; S_.paused = false; S_.msg = null; S_.cheer = 0; S_.confetti = []; S_.result = null; S_.saveAcc = 0;
    S_.auto = { on: auto, phase: auto ? 'read' : null, timer: 0, paused: false, done: false, gap: 0 };
    talk(); go('play');
    if (!auto) persistSession();
  }
  function demoBlocked(i) {
    if (config.demo && (i > 0 || S_.demoCount >= DEMO_STARTS)) { go('demo-limit'); return true; }
    if (config.demo) { S_.demoCount += 1; storage.set('demoCount', S_.demoCount); }
    return false;
  }
  function startTale(i) {
    if (demoBlocked(i)) return;
    S_.prefs.next = i; savePrefs();
    begin(newSession({ seed: rng.int(1 << 30) + 1, tale: i }));
  }
  function resumeSaved() {
    const v = saveRaw; if (!v) return;
    const P = newSession({ seed: v.seed, tale: v.tale });
    P.misses = v.misses | 0; P.hints = v.hints | 0; P.t = v.t || 0;
    if (!v.intro) { P.beat = clamp(v.beat | 0, 0, 3); P.phase = 'tell'; startBeat(P); }
    begin(P); say('Welcome back.', 1.6);
  }
  function startAuto() {
    const i = config.demo ? 0 : clamp(S_.prefs.next, 0, TALES.length - 1);
    begin(newSession({ seed: rng.int(1 << 30) + 1, tale: i }), true);
    say('Watch the tale play itself, and hear why each trick works.', 2.6);
  }
  function restartTale() { const P = S_.P; begin(newSession({ seed: rng.int(1 << 30) + 1, tale: P.tale })); }

  // ---- the tale flow -----------------------------------------------------------------------------------------------------------------
  function onSolved() { S_.cheer = 1.5; confetti(); sfx.cheer(); }
  function afterAction(r) {
    if (!r || r.ok === undefined) return;
    if (r.solved || r.miss) S_.followMsg = true;
    if (r.solved) onSolved();
    else if (r.miss) sfx.wrong();
    else if (r.ok) sfx.place();
  }
  function cont() {
    const P = S_.P;
    if (P.phase === 'solve' && !P.pz.solved) return;
    if (S_.say && S_.say.n < S_.say.text.length) { S_.say.n = S_.say.text.length; return; }
    sfx.tap();
    advance(P); talk(); S_.scrollY = 0; P.hintStage = 0; P.hintText = null;
    if (P.phase === 'tell' || P.phase === 'intro') persistSession();
    if (P.phase === 'over') finishTale();
  }
  function finishTale() {
    const P = S_.P, i = P.tale, st = S_.stats.tales[i], stars = starsFor(P), first = !st.best || P.t < st.best;
    st.done += 1; st.stars = Math.max(st.stars, stars); if (first && P.t > 0) st.best = Math.max(1, Math.round(P.t));
    S_.stats.told += 1; saveStats(); clearSave();
    monetization.track('tale_told', { tale: TALES[i].id, stars, misses: P.misses, hints: P.hints });
    S_.result = { tale: i, stars, misses: P.misses, hints: P.hints, time: P.t, newBest: first && st.done > 1 };
    sfx.win(); go('over');
  }
  function doHint() {
    const P = S_.P;
    if (P.phase !== 'solve' || P.pz.solved) return;
    hintStep(P); sfx.hint();
  }

  // ---- Watch and Learn ---------------------------------------------------------------------------------------------------------------------
  // THINK (the question and a nudge, 2-10 s) -> REVEAL (2 s, the right card glows) -> ACT (it plays the answer, one move a second)
  function autoTick(dt) {
    const a = S_.auto, P = S_.P;
    if (a.paused || a.done || !P) return;
    const say_ = S_.say;
    if (say_ && say_.n < say_.text.length) return;   // the storyteller is still speaking
    if (P.phase === 'solve') {
      const pz = P.pz;
      if (!a.phase || a.phase === 'read') { a.phase = 'think'; a.timer = THINK_STEPS[S_.prefs.thinkIdx]; P.hintStage = 1; P.hintText = puzzleOf(P).hint; return; }
      if (a.phase === 'think') { a.timer -= dt; if (a.timer <= 0) { a.phase = 'reveal'; a.timer = 2; P.hintStage = 2; } return; }
      if (a.phase === 'reveal') { a.timer -= dt; if (a.timer <= 0) { a.phase = 'act'; a.gap = 0; } return; }
      if (a.phase === 'act') {
        a.gap -= dt; if (a.gap > 0) return;
        const res = autoAct(P);
        if (res) { afterAction(res.r); a.gap = 1.0; }
        if (!res || pz.solved) { a.phase = 'wait'; a.timer = 2.2; P.hintStage = 0; P.hintText = null; }
        return;
      }
      if (a.phase === 'wait') { a.timer -= dt; if (a.timer <= 0) { advance(P); talk(); S_.scrollY = 0; a.phase = null; } return; }
      return;
    }
    // narration phases: give the player time to read, then turn the page
    if (a.phase !== 'readwait') { a.phase = 'readwait'; a.timer = 1.4 + wordsOf(say_ ? say_.text : '') * 0.12; return; }
    a.timer -= dt;
    if (a.timer > 0) return;
    if (P.phase === 'moral') { a.done = true; a.phase = null; sfx.win(); confetti(70); S_.say = null; say('That is the whole tale. Tap Exit when you are ready.', 6); return; }
    advance(P); talk(); S_.scrollY = 0; a.phase = null;
  }

  // ---- input -------------------------------------------------------------------------------------------------------------------------------
  let gesture = null;
  function getTap(p, scrollRect) {
    if (!scrollRect) { gesture = null; return p.pressed ? { x: p.x, y: p.y } : null; }
    if (p.pressed) gesture = { x0: p.x, y0: p.y, s0: S_.scrollY, moved: false, inBody: inRect(scrollRect, p.x, p.y) };
    let tap = null;
    if (gesture) {
      if (p.down && gesture.inBody) {
        const dy = p.y - gesture.y0;
        if (Math.abs(dy) > 12) gesture.moved = true;
        if (gesture.moved) S_.scrollY = clamp(gesture.s0 - dy, 0, metrics.max);
      }
      if (p.released || !p.down) { if (!gesture.moved) tap = { x: gesture.x0, y: gesture.y0 }; gesture = null; }
    }
    return tap;
  }
  function hitBtn(id, r, tap) { if (inRect(r, tap.x, tap.y)) { flash(id); return true; } return false; }
  function hitAt(tap) { const ty = tap.y + S_.scrollY; for (let i = hits.length - 1; i >= 0; i--) if (inRect(hits[i].r, tap.x, ty)) return hits[i]; return null; }
  function act(h) {
    const P = S_.P; if (!h || P.phase !== 'solve' || P.pz.solved) return;
    let r = null;
    if (h.id === 'opt') r = tapChoose(P, h.k);
    else if (h.id === 'step') r = tapOrder(P, h.k);
    else if (h.id === 'ml') r = tapMatchLeft(P, h.k);
    else if (h.id === 'mr') r = tapMatchRight(P, h.k);
    else if (h.id === 'tool') r = tapTrap(P, h.k);
    if (r && r.select) sfx.tap(); else afterAction(r);
  }

  function updatePlay(dt, tap, input) {
    const P = S_.P, l = L(), k = input.keys.pressed, fz = frozen();
    if (!fz) {
      if (!S_.auto.on && P.phase !== 'over') { P.t += dt; S_.saveAcc += dt; }
      if (S_.auto.on) autoTick(dt);
      const pz = P.pz; if (pz) { if (pz.shakeT > 0) pz.shakeT = Math.max(0, pz.shakeT - dt); if (pz.flashT > 0) pz.flashT = Math.max(0, pz.flashT - dt); }
      if (S_.say && S_.say.n < S_.say.text.length) S_.say.n = Math.min(S_.say.text.length, S_.say.n + dt * TYPE_SPEED);
    }
    // keyboard
    if (!S_.auto.on && !S_.paused && P.phase !== 'over') {
      if (k.has('Enter') || k.has('Space')) cont();
      if (k.has('KeyH')) doHint();
      if (P.phase === 'solve' && !P.pz.solved) {
        const list = P.pz.kind === 'match' ? hits.filter((h) => h.id === (P.pz.sel < 0 ? 'ml' : 'mr')) : hits;
        for (let n = 1; n <= 6; n++) if (k.has('Digit' + n) && list[n - 1]) act(list[n - 1]);
      }
    }
    if (k.has('KeyP') || k.has('Escape')) { if (S_.auto.on) S_.auto.paused = !S_.auto.paused; else if (P.phase !== 'over') { S_.paused = !S_.paused; if (S_.paused) persistSession(); } }
    if (!tap) return;
    if (S_.paused) {
      const pl = pauseLayout(l.col);
      if (hitBtn('resume', pl.resume, tap)) S_.paused = false;
      else if (hitBtn('restart', pl.restart, tap)) restartTale();
      else if (hitBtn('psettings', pl.settings, tap)) { S_.back = 'play'; go('settings'); }
      else if (hitBtn('pmenu', pl.menu, tap)) { persistSession(); S_.paused = false; go('title'); }
      return;
    }
    if (S_.auto.on) {
      if (hitBtn('aexit', l.rail.exit, tap)) { S_.auto.on = false; S_.P = null; S_.say = null; go('title'); }
      else if (hitBtn('apause', l.rail.pause, tap)) S_.auto.paused = !S_.auto.paused;
      else if (hitBtn('adec', l.rail.dec, tap)) { if (S_.prefs.thinkIdx > 0) { S_.prefs.thinkIdx -= 1; savePrefs(); } }
      else if (hitBtn('ainc', l.rail.inc, tap)) { if (S_.prefs.thinkIdx < THINK_STEPS.length - 1) { S_.prefs.thinkIdx += 1; savePrefs(); } }
      return;
    }
    if (hitBtn('pause', l.pause, tap)) { S_.paused = true; persistSession(); return; }
    if (P.phase === 'solve') {
      if (inRect(l.btnHint, tap.x, tap.y)) { flash('hint'); doHint(); return; }
      if (inRect(l.btnMain, tap.x, tap.y)) { flash('main'); cont(); return; }
      if (inRect(l.body, tap.x, tap.y)) act(hitAt(tap));
    } else {
      if (inRect(l.tools, tap.x, tap.y)) { flash('main'); cont(); return; }
      if (inRect(l.body, tap.x, tap.y) && S_.say && S_.say.n < S_.say.text.length) S_.say.n = S_.say.text.length;
    }
  }

  function changeSetting(i, kk) {
    const id = SETTINGS[i].id, p = S_.prefs;
    switch (id) {
      case 'look': p.look = LOOK_IDS[kk]; setLook(p.look); break;
      case 'hand': p.hand = kk === 1 ? 'right' : 'left'; break;
      case 'sound': p.sound = kk === 0; audio.setMuted?.(!p.sound); break;
      case 'music': p.music = kk === 0; break;
      case 'calm': p.calm = kk === 1; S_.calm = p.calm; break;
      case 'restore': monetization.restore().then(() => say('Purchases restored.', 2)).catch(() => {}); return;
      default: break;
    }
    savePrefs(); sfx.tap();
  }
  function textScale(dir) { const n = clamp(S_.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (n !== S_.prefs.textIdx) { S_.prefs.textIdx = n; S_.scrollY = 0; savePrefs(); } }

  function updateScene(dt, input) {
    const p = input.pointer, scrolling = ['tales', 'gallery', 'doc', 'settings', 'over', 'play'].includes(S_.scene);
    const tap = getTap(p, scrolling ? metrics.rect : null);
    if (scrolling) {
      if (wheelInput.dy) { S_.scrollY = clamp(S_.scrollY + wheelInput.dy, 0, metrics.max); wheelInput.dy = 0; }
      const kk = input.keys.pressed;
      if (kk.has('ArrowDown')) S_.scrollY = clamp(S_.scrollY + 80, 0, metrics.max);
      if (kk.has('ArrowUp')) S_.scrollY = clamp(S_.scrollY - 80, 0, metrics.max);
      S_.scrollY = clamp(S_.scrollY, 0, metrics.max);
    }
    const sc = S_.scene, w = meta.width, h = meta.height;
    if (sc === 'play') return updatePlay(dt, tap, input);
    if (sc === 'title') {
      if (!tap) { if (input.keys.pressed.has('Enter') || input.keys.pressed.has('Space')) startTale(S_.prefs.next); return; }
      const t = titleLayout(w, h, !!S_.saved), B = t.buttons;
      for (const id of Object.keys(B)) if (hitBtn(id, B[id], tap)) {
        sfx.tap();
        if (id === 'continue') resumeSaved();
        else if (id === 'tales') go('tales');
        else if (id === 'gallery') go('gallery');
        else if (id === 'learn') startAuto();
        else if (id === 'howto' || id === 'rules' || id === 'about') { S_.doc = { kind: id, page: 0, tale: 0 }; go('doc'); }
        else if (id === 'settings') { S_.back = 'title'; go('settings'); }
        return;
      }
      if (Math.abs(tap.x - t.brand.x) < 260 && Math.abs(tap.y - t.brand.y) < 26) env.openArcforgeHome?.();
      return;
    }
    if (sc === 'tales') {
      const NL = talesLayout(w, h, TALES.length, TEXT_SCALES[S_.prefs.textIdx]);
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', NL.back, tap)) { go('title'); return; }
      if (hitBtn('tdec', NL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', NL.textInc, tap)) return textScale(1);
      if (inRect(NL.body, tap.x, tap.y)) { const hh = hitAt(tap); if (hh && hh.id === 'tale') { sfx.tap(); startTale(hh.k); } }
      return;
    }
    if (sc === 'gallery') {
      const GL = galleryLayout(w, h, TALES.length);
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', GL.back, tap)) { go('title'); return; }
      if (hitBtn('tdec', GL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', GL.textInc, tap)) return textScale(1);
      if (inRect(GL.body, tap.x, tap.y)) { const hh = hitAt(tap); if (hh && hh.id === 'story') { sfx.tap(); S_.doc = { kind: 'story', page: 0, tale: hh.k }; S_.back = 'gallery'; go('doc'); } }
      return;
    }
    if (sc === 'doc') {
      const DL = docLayout(w, h), n = docOf(S_).pages.length, leave = () => go(S_.doc.kind === 'story' ? 'gallery' : 'title');
      if (input.keys.pressed.has('Escape')) { leave(); return; }
      if (input.keys.pressed.has('ArrowRight') && S_.doc.page < n - 1) { S_.doc.page += 1; S_.scrollY = 0; }
      if (input.keys.pressed.has('ArrowLeft') && S_.doc.page > 0) { S_.doc.page -= 1; S_.scrollY = 0; }
      if (!tap) return;
      if (hitBtn('back', DL.menu, tap)) leave();
      else if (hitBtn('prev', DL.prev, tap) && S_.doc.page > 0) { S_.doc.page -= 1; S_.scrollY = 0; }
      else if (hitBtn('next', DL.next, tap) && S_.doc.page < n - 1) { S_.doc.page += 1; S_.scrollY = 0; }
      else if (hitBtn('tdec', DL.textDec, tap)) textScale(-1);
      else if (hitBtn('tinc', DL.textInc, tap)) textScale(1);
      return;
    }
    if (sc === 'settings') {
      const SL = settingsLayout(w, h, TEXT_SCALES[S_.prefs.textIdx], SETTINGS.length);
      const leave = () => { if (S_.back === 'play' && S_.P) { S_.scene = 'play'; S_.sceneT = 1; S_.scrollY = 0; } else go('title'); };
      if (input.keys.pressed.has('Escape')) { leave(); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) return leave();
      if (hitBtn('tdec', SL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', SL.textInc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) {
        const ty = tap.y + S_.scrollY;
        SETTINGS.forEach((row, i) => {
          const g = SL.rows[i], n = row.opts.length, cw = (g.ctrl.w - 8 * (n - 1)) / n;
          for (let kk = 0; kk < n; kk++) { const r = { x: g.ctrl.x + kk * (cw + 8), y: g.ctrl.y, w: cw, h: g.ctrl.h }; if (inRect(r, tap.x, ty)) { flash('set' + i + '.' + kk); changeSetting(i, kk); } }
        });
      }
      return;
    }
    if (sc === 'over') {
      const O = overLayout(w, h, TEXT_SCALES[S_.prefs.textIdx]);
      if (!tap) return;
      const R0 = S_.result;
      if (hitBtn('next', O.btns.next, tap)) startTale(R0.tale + 1 < TALES.length ? R0.tale + 1 : R0.tale);
      else if (hitBtn('menu', O.btns.menu, tap)) go('title');
      else if (hitBtn('share', O.btns.share, tap)) env.share(`Anansi Tales: I told "${TALES[R0.tale].title}" with ${R0.stars} star${R0.stars === 1 ? '' : 's'}.`);
      return;
    }
    if (sc === 'demo-limit' && tap) go('title');
  }

  return {
    update(dt, input) {
      S_.t += dt; S_.sceneT += dt;
      if (S_.flash) { S_.flash.t += dt; if (S_.flash.t > 0.25) S_.flash = null; }
      if (S_.msg) { S_.msg.t += dt; if (S_.msg.t > S_.msg.hold) S_.msg = null; }
      const fz = frozen();
      if (!fz) {
        S_.at += dt;
        musicTick(dt);
        if (S_.cheer > 0) S_.cheer -= dt;
        for (const q of S_.sfx) q.t -= dt;
        const due = S_.sfx.filter((q) => q.t <= 0); if (due.length) { S_.sfx = S_.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
        for (const c of S_.confetti) { c.t += dt; c.x += c.vx * dt * 0.4; c.y += c.vy * dt * 0.5; c.vy += 1.4 * dt; c.a += c.va * dt; }
        S_.confetti = S_.confetti.filter((c) => c.t < c.life);
        // the eyes glance around, and the painted layers lean towards the pointer
        const pt = input.pointer, tx = clamp((pt.x / Math.max(1, meta.width) - 0.5) * 2, -1, 1);
        S_.px += (tx - S_.px) * (1 - Math.exp(-dt * 3));
        S_.look = { x: Math.sin(S_.at * 0.6) * 0.7, y: S_.scene === 'play' && S_.P && S_.P.phase === 'solve' ? 0.5 : Math.sin(S_.at * 0.4) * 0.2 };
      }
      // the kit's preview pill sits top centre; in play it tucks beside the header
      if (S_.scene === 'play') { const l = L(); meta.previewBadge = { x: l.pause.x - 14, y: l.pause.y + 18, align: 'right' }; } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { render(ctx, S_, view ?? meta); },
    getState: () => S_,
    // Counts real play only: a tale in progress. Menus, Rules, Gallery, settings, Watch and Learn, pause and results are free.
    isPreviewExempt() { return !(S_.scene === 'play' && !S_.auto.on && !S_.paused && S_.P && !S_.P.done); },
    // Tester/screenshot hooks (only wired up in dev: see main.js).
    dev: {
      go: (scene, extra) => { Object.assign(S_, extra ?? {}); go(scene); },
      start: (i, beat = 0, phase = 'tell') => {
        startTale(i); const P = S_.P; if (!P) return;
        if (phase !== 'intro') { P.beat = beat; P.phase = phase; startBeat(P); if (phase === 'after') P.pz.solved = true; talk(); }
        if (S_.say) S_.say.n = 1e9;
      },
      auto: () => startAuto(),
      autoAt: (i, beat) => { const P = newSession({ seed: 77, tale: i }); P.beat = beat; P.phase = 'solve'; startBeat(P); begin(P, true); S_.say = null; S_.auto.phase = 'read'; },
      wrong: () => {
        const P = S_.P, pz = P.pz, def = puzzleOf(P);
        if (pz.kind === 'choose') { const t = nextTarget(P); act({ id: 'opt', k: pz.order.findIndex((o) => o !== t.opt && !pz.out.includes(o)) }); }
        else if (pz.kind === 'order') act({ id: 'step', k: pz.deck.find((s) => s !== pz.placed.length && !pz.placed.includes(s)) });
        else if (pz.kind === 'trap') act({ id: 'tool', k: def.tools.findIndex((t) => !t.sets) });
        else { act({ id: 'ml', k: pz.L[0] }); act({ id: 'mr', k: pz.R.find((r) => r !== pz.L[0]) }); }
      },
      hint: () => doHint(), cont: () => cont(),
      solve: () => { const P = S_.P; let n = 0; while (P.pz && !P.pz.solved && n++ < 20) afterAction(autoAct(P)?.r); },
      doc: (kind, page = 0, tale = 0) => { S_.doc = { kind, page, tale }; go('doc'); },
      layout: () => { const l = L(); return { mode: l.mode, scene: l.scene, col: l.col, body: l.body, tools: l.tools, btnHint: l.btnHint, btnMain: l.btnMain, pause: l.pause, rail: l.rail, w: meta.width, h: meta.height }; },
      finish: () => { const P = S_.P; P.phase = 'moral'; P.pz = null; talk(); if (S_.say) S_.say.n = 1e9; cont(); },
      skipOver: () => { S_.sceneT = 2; },
      say: () => { if (S_.say) S_.say.n = 1e9; },
      hits: () => hits.map((h) => ({ id: h.id, k: h.k, r: h.r })),
      view: () => ({ scrollY: S_.scrollY, w: meta.width, h: meta.height, scene: S_.scene, phase: S_.P && S_.P.phase, solved: !!(S_.P && S_.P.pz && S_.P.pz.solved), auto: S_.auto, paused: S_.paused, miss: S_.P && S_.P.misses, hints: S_.P && S_.P.hints, bodyRect: metrics.rect, max: metrics.max }),
      act: (id, k) => act({ id, k }),
    },
  };
}
export { fmtTime, DOCS };
