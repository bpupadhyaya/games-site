// Otedama: state and flow. Drawing is in view.js / playview.js / docview.js; the rules as data are in pattern.js.
//
// Timing model: song time `pl.t` (seconds, starts negative for the count-in) is the sum of the dt values handed to update()
// (deterministic, pausable). Every catch and clap has a time on that clock; a tap is judged by the tick it is seen on.
// Think/Reveal in Watch and Learn and the Learn hint stop the clock, so bags hang in the air until it runs again.
import {
  PATTERNS, buildPattern, beatSeconds, COUNT_IN, JUDGE, TIMING, LEARN_WINDOW, LEARN_SPEED, SCORE, WEIGHT, FLOW, comboMult, starsOf, gradeFromErr,
  THINK_CHOICES, REVEAL_SECONDS, PHRASE, DEMO_RUNS, FREE_FABRICS, zoneOf, HAND_NAMES,
} from './pattern.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects, stageCam } from './layout.js';
import { burst, stepParticles } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render, ownedFabrics } from './view.js';
import { rulesPages } from './content.js';
import { GRADE_TEXT, GRADE_COL } from './playview.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const KEY_ZONE = { KeyA: 0, ArrowLeft: 0, KeyD: 1, ArrowRight: 1, Space: 2, ArrowDown: 2, KeyS: 2 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SCALE = [293.66, 329.63, 392, 440, 493.88];      // a pentatonic scale: the catches play a tune that climbs with the chain

export function createGame(env) {
  const { rng, storage, config } = env;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title',
    prefs: { sound: true, timingIdx: 1, thinkIdx: 2, song: true, calm: false, textIdx: 0 },
    best: {}, demoRuns: 0, pl: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, restoreMsg: '', dev: config.dev === true, demo: config.demo === true,
  };
  let lastScene = state.scene, drag = null;
  const autoRng = rng.fork();

  storage.get('prefs', null).then((v) => {
    if (!v) return;
    Object.assign(state.prefs, v);
    state.prefs.textIdx = clamp(state.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.prefs.thinkIdx = clamp(state.prefs.thinkIdx | 0, 0, THINK_CHOICES.length - 1);
    state.prefs.timingIdx = clamp(state.prefs.timingIdx | 0, 0, TIMING.length - 1);
    applyPrefs();
  });
  storage.get('best', null).then((v) => { if (v) state.best = v; });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();
  const lay = () => layoutFor(meta.width, meta.height);
  const go = (scene) => { state.scene = scene; if (scene !== 'play' && scene !== 'result') state.pl = null; };
  const tone = (o) => { if (state.prefs.sound) env.audio.tone?.(o); };

  // ---- a play ------------------------------------------------------------------------------------------------------------------------
  function newPlay(ri, mode) {
    const cfg = PATTERNS[ri], speed = mode === 'learn' ? LEARN_SPEED : 1, beatDur = beatSeconds(cfg.bpm, speed);
    const pat = buildPattern(ri), events = pat.events;
    for (const e of events) {
      e.t = e.b * beatDur;
      // the virtual juggler's plan (Watch and Learn): small human errors, an occasional late one
      const late = autoRng.chance(0.08);
      e.auto = { err: late ? autoRng.range(0.07, 0.1) * (autoRng.chance(0.5) ? 1 : -1) : autoRng.range(-0.035, 0.035) };
    }
    const lastB = events.reduce((m, e) => Math.max(m, e.b), 0);
    const k = TIMING[state.prefs.timingIdx].k * (mode === 'learn' ? LEARN_WINDOW : 1);
    const pl = {
      mode, ri, speed, beatDur, events, t: -COUNT_IN * beatDur, clock: 0, k: mode === 'auto' ? 1 : k,
      endT: (lastB + 1.4) * beatDur, paused: false, over: false, failed: false,
      score: 0, chain: 0, maxChain: 0, flow: FLOW.start, counts: { perfect: 0, great: 0, good: 0, miss: 0 }, accSum: 0, strays: 0,
      parts: [], pops: [], pulse: 0, shake: 0, banner: null, beatIdx: -99, press: [0, 0], clapT: 0, songT: 9, songWord: null,
      hint: null, reveal: null, bot: mode === 'auto' ? 'human' : null, lastZone: -1, lastTapAt: -9,
      fabrics: ownedFabrics(state.best),
      auto: mode === 'auto' ? { phase: 'think', timer: THINK_CHOICES[state.prefs.thinkIdx], phrase: 0, names: [] } : null,
    };
    Object.defineProperty(pl, 'pat', { value: pat, enumerable: false });
    return pl;
  }
  const phraseCount = (pl) => Math.ceil(pl.events.length / PHRASE);
  const phraseEvents = (pl, p) => pl.events.slice(p * PHRASE, (p + 1) * PHRASE);
  const evName = (e) => (e.kind === 'clap' ? 'Clap' : HAND_NAMES[e.hand]);
  const phraseTrigger = (pl, p) => (p === 0 ? -1e9 : phraseEvents(pl, p)[0].t - pl.beatDur * 1.0);
  function beginThink(pl, p) {
    pl.auto.phase = 'think'; pl.auto.phrase = p; pl.auto.timer = THINK_CHOICES[state.prefs.thinkIdx];
    pl.auto.names = phraseEvents(pl, p).map(evName);
    pl.reveal = null;
  }
  function startPlay(mode, ri = state.sel) {
    const limited = config.demo && mode !== 'auto';
    if (limited && (ri > 0 || state.demoRuns >= DEMO_RUNS)) { go('demo-limit'); return; }
    if (limited) { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    state.sel = ri;
    const pl = newPlay(ri, mode); state.pl = pl; state.result = null;
    if (pl.auto) beginThink(pl, 0);
    state.scene = 'play'; state.sceneT = 0;
    env.monetization.track?.('pattern_start', { pattern: PATTERNS[ri].id, mode });
  }
  const pausePlay = () => { const pl = state.pl; if (pl && !pl.paused && !pl.over) pl.paused = true; };
  const resumePlay = () => { const pl = state.pl; if (pl) pl.paused = false; };

  // ---- judging -----------------------------------------------------------------------------------------------------------------------
  function fx(pl, grade, ev) {
    const c = stageCam(lay().play.stage), hx = ev.kind === 'clap' ? c.xC : ev.hand === 0 ? c.xL : c.xR, hy = ev.kind === 'clap' ? c.handY - c.bag * 1.5 : c.handY - c.bag * 0.3;
    const calm = state.prefs.calm;
    if (grade !== 'miss' && grade !== 'stray') {
      burst(pl.parts, rng, hx, hy, calm ? 5 : grade === 'perfect' ? 18 : 10, grade === 'perfect' ? '#ffe9a8' : '#d9c28a', 0.9, 1);
    } else if (grade === 'miss') burst(pl.parts, rng, hx, c.floorY, 7, '#c8a57a', 0.5, 0);
    pl.pops.push({ text: GRADE_TEXT[grade] ?? grade.toUpperCase(), col: GRADE_COL[grade] ?? '#fff', size: grade === 'perfect' ? 54 : 46, age: 0, hand: ev.kind === 'clap' ? 2 : ev.hand });
    if (pl.pops.length > 4) pl.pops.shift();
  }
  function judgeEv(pl, ev, grade, err) {
    if (ev.j) return;
    ev.j = grade; ev.tj = pl.t; ev.err = err;
    const mult = comboMult(pl.chain);
    if (grade === 'miss') {
      pl.counts.miss += 1; pl.chain = 0; pl.shake = ev.kind === 'catch' ? 0.5 : 0.2;
      if (pl.mode === 'perform') pl.flow = Math.max(0, pl.flow + FLOW.miss);
      tone({ freq: 190, to: 110, dur: 0.2, type: 'sawtooth', vol: 0.09 });
    } else {
      pl.score += SCORE[grade] * mult; pl.chain += 1; pl.maxChain = Math.max(pl.maxChain, pl.chain);
      pl.counts[grade] += 1; pl.accSum += WEIGHT[grade];
      pl.flow = Math.min(1, pl.flow + FLOW[grade]);
      pl.songWord = (pl.chain - 1) % 10; pl.songT = 0;
      if (pl.chain > 0 && pl.chain % 8 === 0) pl.banner = { text: `CHAIN x${pl.chain}`, t: 0 };
      const f = grade === 'perfect' ? 1 : grade === 'great' ? 0.9 : 0.8, deg = pl.songWord;
      if (ev.kind === 'clap') {
        pl.clapT = 1;
        tone({ freq: 1900, to: 900, dur: 0.06, type: 'square', vol: 0.07 });
        tone({ freq: 330, to: 220, dur: 0.12, type: 'triangle', vol: 0.12 });
      } else {
        tone({ freq: SCALE[deg % 5] * (deg >= 5 ? 2 : 1), dur: 0.22, type: 'triangle', vol: 0.12 + 0.05 * f });
        tone({ freq: 90, to: 60, dur: 0.06, type: 'sine', vol: 0.1 });       // the soft thud of a bean bag
      }
    }
    fx(pl, grade, ev);
    if (pl.mode === 'perform' && pl.flow <= 0 && !pl.failed) { pl.failed = true; pl.banner = { text: 'THE FLOW BROKE', t: 0 }; }
  }
  const outer = (pl) => JUDGE.good * pl.k;
  const evZone = (e) => (e.kind === 'clap' ? 2 : e.hand);
  function tap(pl, zone, t) {
    if (zone === 2) pl.clapT = Math.max(pl.clapT, 0.6); else pl.press[zone] = 1;
    let best = null;
    for (const e of pl.events) {
      if (e.t - t > outer(pl)) break;
      if (e.j || evZone(e) !== zone) continue;
      const err = Math.abs(e.t - t);
      if (err <= outer(pl) && (!best || err < Math.abs(best.t - t))) best = e;
    }
    if (!best) {
      pl.strays += 1; pl.pops.push({ text: GRADE_TEXT.stray, col: GRADE_COL.stray, size: 34, age: 0, hand: zone });
      if (pl.pops.length > 4) pl.pops.shift();
      if (pl.mode === 'perform') pl.flow = Math.max(0, pl.flow + FLOW.stray);
      tone({ freq: 140, dur: 0.05, type: 'triangle', vol: 0.05 });
      return;
    }
    const err = t - best.t;
    judgeEv(pl, best, gradeFromErr(err, pl.k) ?? 'miss', err);
  }

  // the virtual juggler (Watch and Learn, and the dev "play" toggle)
  function botStep(pl) {
    for (const e of pl.events) {
      if (e.j) continue;
      const at = e.t + (pl.bot === 'perfect' ? 0 : e.auto.err);
      if (pl.t < at) break;
      if (e.kind === 'clap') pl.clapT = 1; else pl.press[e.hand] = 1;
      judgeEv(pl, e, gradeFromErr(at - e.t, pl.k) ?? 'miss', at - e.t);
    }
  }

  function stepAnim(pl, dt) {
    pl.pulse = Math.max(0, pl.pulse - dt * 4); pl.shake = Math.max(0, pl.shake - dt * 3);
    pl.press[0] = Math.max(0, pl.press[0] - dt * 6); pl.press[1] = Math.max(0, pl.press[1] - dt * 6);
    pl.clapT = Math.max(0, pl.clapT - dt * 3.2); pl.songT += dt;
    for (const p of pl.pops) p.age += dt;
    pl.pops = pl.pops.filter((p) => p.age < 0.85);
    stepParticles(pl.parts, dt);
    if (pl.banner) { pl.banner.t += dt; if (pl.banner.t > 1.5) pl.banner = null; }
  }

  function showHint(pl) {
    if (pl.mode !== 'learn' || pl.hint) return;
    const next = pl.events.filter((e) => !e.j).slice(0, 4);
    if (!next.length) return;
    pl.hint = { timer: REVEAL_SECONDS + 0.5, names: next.map(evName) };
    pl.reveal = next.map((e) => e.i);
  }

  function updatePlay(dt, tapAt, input) {
    const pl = state.pl, L = lay().play;
    if (pl.paused || pl.over) { updatePauseMenu(tapAt, input); return; }
    const k = input.keys.pressed;
    if (tapAt) {
      if (inRect(L.pause, tapAt.x, tapAt.y)) { pausePlay(); return; }
      if (pl.mode === 'learn' && inRect(L.hint, tapAt.x, tapAt.y)) { showHint(pl); return; }
    }
    if (k.has('Escape') || k.has('KeyP')) { pausePlay(); return; }
    if (k.has('KeyH')) showHint(pl);
    pl.clock += dt;
    stepAnim(pl, dt);
    // Learn hint: the clock stands still while the next catches are lit
    if (pl.hint) { pl.hint.timer -= dt; if (pl.hint.timer <= 0) { pl.hint = null; pl.reveal = null; } return; }
    // Watch and Learn: Think then Reveal before each phrase, with the clock stopped
    if (pl.auto && pl.auto.phase !== 'act') {
      const a = pl.auto; a.timer -= dt;
      if (a.timer <= 0) {
        if (a.phase === 'think') { a.phase = 'reveal'; a.timer = REVEAL_SECONDS; pl.reveal = phraseEvents(pl, a.phrase).map((e) => e.i); }
        else { a.phase = 'act'; pl.reveal = null; }
      }
      return;
    }
    if (pl.auto) {
      const np = pl.auto.phrase + 1;
      if (np < phraseCount(pl) && pl.t + dt >= phraseTrigger(pl, np) && phraseEvents(pl, np - 1).every((e) => e.j)) { beginThink(pl, np); return; }
    }
    pl.t += dt;
    const bi = Math.floor(pl.t / pl.beatDur);
    if (bi !== pl.beatIdx) {
      pl.beatIdx = bi; pl.pulse = bi % 4 === 0 ? 1 : 0.6;
      if (pl.t < 0 || pl.mode === 'learn') tone(bi % 4 === 0 ? { freq: 520, dur: 0.07, type: 'triangle', vol: 0.1 } : { freq: 760, dur: 0.045, type: 'triangle', vol: 0.05 });
    }
    if (pl.bot) botStep(pl);
    else playerInput(pl, input, tapAt);
    for (const e of pl.events) { if (e.t > pl.t + 1) break; if (!e.j && e.t + outer(pl) < pl.t) judgeEv(pl, e, 'miss', 0); }
    if (pl.failed && pl.banner && pl.banner.t > 1.2) { finishRun(); return; }
    if (pl.t >= pl.endT && pl.events.every((e) => e.j)) finishRun();
  }

  function playerInput(pl, input, tapAt) {
    const p = input.pointer, L = lay().play, S = L.stage;
    const zoneAt = (x) => zoneOf(clamp((x - S.x) / S.w, 0, 1));
    for (const code of input.keys.pressed) if (KEY_ZONE[code] !== undefined) tap(pl, KEY_ZONE[code], pl.t);
    const onUi = (q) => inRect(L.pause, q.x, q.y) || inRect(L.hint, q.x, q.y);
    if (tapAt && !onUi(tapAt)) { const z = zoneAt(tapAt.x); pl.lastZone = z; pl.lastTapAt = pl.clock; tap(pl, z, pl.t); }
    else if (p.down && !p.pressed && !onUi(p)) {
      // a second finger landing while the first is still down arrives as a jump of the pointer into another zone
      const z = zoneAt(p.x);
      if (pl.lastZone >= 0 && z !== pl.lastZone && pl.clock - pl.lastTapAt > 0.08) { pl.lastZone = z; pl.lastTapAt = pl.clock; tap(pl, z, pl.t); }
    }
    if (p.released) pl.lastZone = -1;
  }

  function finishRun() {
    const pl = state.pl;
    const n = pl.events.length, acc = pl.accSum / n;
    const stars = pl.failed ? 0 : starsOf(acc);
    const id = PATTERNS[pl.ri].id, old = state.best[id] ?? {};
    const res = { ri: pl.ri, mode: pl.mode, score: pl.score, acc, stars, maxChain: pl.maxChain, counts: { ...pl.counts }, failed: pl.failed, newBest: false, newFabric: null };
    if (pl.mode === 'perform') {
      res.newBest = !pl.failed && (!old.score || pl.score > old.score);
      if (stars >= 1 && pl.ri >= FREE_FABRICS && !(old.stars >= 1)) res.newFabric = pl.ri;
      state.best[id] = { ...old, score: Math.max(old.score || 0, pl.failed ? 0 : pl.score), acc: Math.max(old.acc || 0, pl.failed ? 0 : acc), stars: Math.max(old.stars || 0, stars), chain: Math.max(old.chain || 0, pl.maxChain) };
      storage.set('best', state.best);
    }
    env.monetization.track?.('pattern_end', { pattern: id, mode: pl.mode, stars });
    pl.over = true; state.result = res; state.scene = 'result'; state.sceneT = 0;
  }

  function pauseItems(pl) { return pl.over ? ['again', 'next', 'exit'] : ['resume', 'restart', 'quit']; }
  function updatePauseMenu(tapAt, input) {
    const pl = state.pl, items = pauseItems(pl), M = menuRects(lay(), items.length, 96);
    if ((input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyP')) && !pl.over) { resumePlay(); return; }
    if (!tapAt) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tapAt.x, tapAt.y)) return;
      if (it === 'resume') resumePlay();
      else if (it === 'restart' || it === 'again') startPlay(pl.mode, pl.ri);
      else go('routines');
    });
  }

  // ---- menus and documents -----------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs, cyc = (v, n) => (v + 1) % n;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'timing') p.timingIdx = cyc(p.timingIdx, TIMING.length);
    else if (id === 'think') p.thinkIdx = cyc(p.thinkIdx, THINK_CHOICES.length);
    else if (id === 'song') p.song = !p.song;
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') {
      state.restoreMsg = 'Checking your purchases...';
      Promise.resolve(env.monetization.restore?.()).then(
        () => { state.restoreMsg = env.monetization.owns?.('unlock_game') ? 'Full game unlocked. Thank you!' : 'No earlier purchase was found.'; },
        () => { state.restoreMsg = 'Could not reach the store. Try again later.'; });
      return;
    }
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
    const pages = rulesPages().length;
    if (id === 'prev') { if (state.rulesPage > 0) { state.rulesPage -= 1; state.docScroll = 0; } return; }
    if (id === 'next') { if (state.rulesPage < pages - 1) { state.rulesPage += 1; state.docScroll = 0; } else go(state.backTo); return; }
    if (id.startsWith('set:')) settingsAction(id.slice(4));
  }

  function updateTitle(tapAt) {
    if (!tapAt) return;
    const T = lay().title, hit = (r) => inRect(r, tapAt.x, tapAt.y);
    if (hit(T.play)) go('routines');
    else if (hit(T.auto)) startPlay('auto', 0);
    else if (hit(T.how)) openDoc('howto', 'title');
    else if (hit(T.rules)) openDoc('rules', 'title');
    else if (hit(T.about)) openDoc('about', 'title');
    else if (hit(T.settings)) openDoc('settings', 'title');
    else if (tapAt.y > T.credit.y - T.credit.h - 12 && Math.abs(tapAt.x - T.credit.x) < 130) env.openArcforgeHome?.();
  }
  function updatePatterns(tapAt) {
    if (!tapAt) return;
    const G = lay().routines;
    if (inRect(G.back, tapAt.x, tapAt.y)) { go('title'); return; }
    G.cards.forEach((r, i) => { if (inRect(r, tapAt.x, tapAt.y)) { state.sel = i; go('detail'); } });
  }
  function updateDetail(tapAt) {
    if (!tapAt) return;
    const D = lay().detail;
    if (inRect(D.back, tapAt.x, tapAt.y)) go('routines');
    else if (inRect(D.learn, tapAt.x, tapAt.y)) startPlay('learn');
    else if (inRect(D.perform, tapAt.x, tapAt.y)) startPlay('perform');
    else if (inRect(D.watch, tapAt.x, tapAt.y)) startPlay('auto');
  }
  function updateResult(tapAt) {
    if (!tapAt) return;
    const Rr = lay().result;
    if (inRect(Rr.again, tapAt.x, tapAt.y)) startPlay(state.result.mode, state.result.ri);
    else if (inRect(Rr.routines, tapAt.x, tapAt.y)) go('routines');
    else if (inRect(Rr.menu, tapAt.x, tapAt.y)) go('title');
    else if (tapAt.y > Rr.more.y - 30 && tapAt.y < Rr.more.y + 14) env.openArcforgeHome?.();
  }

  // ---- the object the kit and main.js see --------------------------------------------------------------------------------------------
  const api = {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tapAt = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'title') updateTitle(tapAt);
      else if (sc === 'routines') updatePatterns(tapAt);
      else if (sc === 'detail') updateDetail(tapAt);
      else if (sc === 'play') updatePlay(dt, tapAt, input);
      else if (sc === 'result') updateResult(tapAt);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tapAt) go('title');
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems); },
    getState: () => state,
    // Called by main.js when the app goes to the background.
    autoPause() { if (state.scene === 'play') pausePlay(); },
    // Everything except real play is free: menus, Rules, Watch and Learn, results, pause.
    isPreviewExempt() {
      const pl = state.pl;
      return !(state.scene === 'play' && pl && pl.mode !== 'auto' && !pl.paused && !pl.over);
    },
    // Tester tools (?dev=1): jump to a screen and fast-forward.
    dev: {
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.routine !== undefined) state.sel = o.routine;
        const sc = o.scene ?? 'title';
        if (sc === 'play') { startPlay(o.mode ?? 'perform', state.sel); if (o.play && state.pl) state.pl.bot = 'perfect'; }
        else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startPlay('perform', state.sel); const pl = state.pl;
          pl.accSum = pl.events.length * 0.9; pl.score = 41250; pl.maxChain = 17; pl.counts = { perfect: 19, great: 12, good: 4, miss: 1 };
          finishRun(); state.result.newBest = true; if (state.sel >= FREE_FABRICS) state.result.newFabric = state.sel;
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.pause && state.pl) pausePlay();
        if (o.advance) {
          const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
          for (let i = 0; i < o.advance * 60; i++) api.update(1 / 60, idle);
        }
      },
    },
  };
  return api;
}
