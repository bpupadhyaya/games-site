// Neolttwigi: state and flow. The seesaw itself is sim.js (pure and deterministic); drawing is in view.js / playview.js / docview.js.
//
// Timing model: round time `r.t` is the sum of the dt values handed to update() (deterministic, pausable). A press or release is
// judged against the contact time on that clock. Think / Reveal in Watch and Learn and the Learn hint stop the clock.
import {
  LEVELS, newRound, step, edge, forecast, summary, starsOf, COUNT_IN, LAG, PHRASE, THINK_CHOICES, REVEAL_SECONDS, DEMO_RUNS, girlsAt,
} from './sim.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects } from './layout.js';
import { burst, puff, stepParticles, boardPoints } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { rulesPages } from './content.js';
import { camFor } from './playview.js';
import { TILT } from './mini.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SOLO_KEYS = ['Space', 'Enter', 'KeyA', 'KeyL', 'ArrowDown', 'KeyZ'];
const DUEL_KEYS = [['Space', 'KeyA', 'KeyZ'], ['Enter', 'KeyL', 'KeyM']];

export function createGame(env) {
  const { rng, storage, config } = env;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title', twoNext: false,
    prefs: { sound: true, thinkIdx: 1, calm: false, textIdx: 0 },
    best: {}, demoRuns: 0, pl: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true,
  };
  let lastScene = state.scene, drag = null;
  const roundRng = rng.fork();
  const multi = { seen: false, sides: new Map(), q: [] };

  storage.get('prefs', null).then((v) => {
    if (!v) return;
    Object.assign(state.prefs, v);
    state.prefs.textIdx = clamp(state.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.prefs.thinkIdx = clamp(state.prefs.thinkIdx | 0, 0, THINK_CHOICES.length - 1);
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

  // ---- a round ---------------------------------------------------------------------------------------------------------------------
  function newPlay(ri, mode, bothBots = false) {
    const lvl = LEVELS[ri];
    const r = newRound({ lvl, mode: mode === 'auto' || bothBots ? 'auto' : mode === 'duel' ? 'duel' : 'solo', learn: mode === 'learn', rng: roundRng.fork() });
    return {
      r, ri, mode, paused: false, over: false, clock: 0, parts: [], puffs: [], banner: null, hint: null,
      humans: [mode === 'solo' || mode === 'learn' || mode === 'duel', mode === 'duel'],
      auto: mode === 'auto' ? { phase: 'think', timer: THINK_CHOICES[state.prefs.thinkIdx], plan: [], lastThink: 0 } : null,
      anim: { tilt: 0, tiltV: 0, target: 0, crouch: [0, 0], land: [0, 0], need: 3.6, prevT: 0, sq: 0, sqV: 0, flex: 0, flexV: 0, gasp: 0, cheer: 0, gust: 0, shake: 0, shakeV: 0 },
      logSeen: 0, starsSeen: 0, keyHeld: [false, false], ptr: null, countBeat: -1,
    };
  }
  function startPlay(mode, ri = state.sel, bothBots = false) {
    const limited = config.demo && mode !== 'auto';
    if (limited && (ri > 0 || state.demoRuns >= DEMO_RUNS)) { go('demo-limit'); return; }
    if (limited) { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    state.sel = ri; state.twoNext = false;
    const pl = newPlay(ri, mode, bothBots); state.pl = pl; state.result = null;
    if (pl.auto) pl.auto.plan = forecast(pl.r, PHRASE);
    multi.q.length = 0;
    state.scene = 'play'; state.sceneT = 0;
    env.monetization.track?.('round_start', { course: LEVELS[ri].id, mode });
  }
  const pausePlay = () => {
    const pl = state.pl;
    if (pl && !pl.paused && !pl.over) { pl.paused = true; pl.r.held = [false, false]; pl.ptr = null; pl.keyHeld = [false, false]; multi.q.length = 0; }
  };
  const resumePlay = () => { const pl = state.pl; if (pl) pl.paused = false; };

  // ---- animation and effects -----------------------------------------------------------------------------------------------------
  const smoothU = (x) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
  function stepAnim(pl, dt) {
    const an = pl.anim, r = pl.r, g = girlsAt(r), amp = TILT;
    if (g[0].air && !g[1].air) an.target = amp;
    else if (g[1].air && !g[0].air) an.target = -amp;
    else if (r.lastContact && r.t >= r.lastContact.t - 0.02 && r.t < r.lastContact.t + LAG + 0.3) an.target = r.lastContact.lander === 0 ? -amp : amp;
    else if (r.t < COUNT_IN) an.target = 0;
    an.tiltV += ((an.target - an.tilt) * 380 - an.tiltV * 26) * dt;
    an.tilt += an.tiltV * dt;
    for (let p = 0; p < 2; p++) {
      const want = !g[p].air && r.held[p] && !r.done ? 1 : 0;
      an.crouch[p] += clamp(want - an.crouch[p], -12 * dt, 7 * dt);
      an.land[p] = Math.max(0, an.land[p] - dt * 4);
    }
    for (const f of r.flights) if (f.t1 > an.prevT && f.t1 <= r.t) {
      an.land[f.who] = 1;
      // the landing loads the board: the bale squashes, the plank bends and the tree shivers, all in proportion to the fall
      const hh = clamp(f.H / Math.max(0.5, r.lvl.hMax), 0.1, 1);
      an.sqV += 0.55 * hh; an.flexV += 1.6 * hh; an.shakeV += 0.9 * hh;
      pl.puffs.push({ who: f.who, hh });
    }
    // damped springs: squash (slow, heavy), flex (quick and lively), tree
    for (const [k, kv, w2, c] of [['sq', 'sqV', 520, 22], ['flex', 'flexV', 2600, 24], ['shake', 'shakeV', 140, 5]]) {
      const n = Math.max(1, Math.ceil(dt / 0.004)), h2 = dt / n;
      for (let i = 0; i < n; i++) { an[kv] += (-an[k] * w2 - an[kv] * c) * h2; an[k] += an[kv] * h2; }
    }
    an.sq = clamp(an.sq, -0.02, 0.14); an.flex = clamp(an.flex, -0.12, 0.2);
    // the crowd and the air react to the girl who is in flight (heights relative to the course limit)
    {
      const af = g[0].air ? g[0] : g[1].air ? g[1] : null;
      const hn = af ? clamp(af.H / Math.max(0.5, r.lvl.hMax), 0, 1) : 0;
      const wantGasp = af ? (af.u < 0.55 ? smoothU(af.u / 0.55) * hn * 1.15 : 0) : 0;
      const wantCheer = af ? (af.u >= 0.45 ? hn * 1.15 * smoothU((af.u - 0.45) / 0.3) : 0) : an.cheer * 0.0;
      an.gasp += (clamp(wantGasp, 0, 1) - an.gasp) * Math.min(1, dt * 9);
      an.cheer += (clamp(wantCheer, 0, 1) - an.cheer) * Math.min(1, dt * (wantCheer > an.cheer ? 7 : 1.1));   // the cheer lingers after touch-down
      const wantGust = af ? hn * (af.u < 0.5 ? 1 : 0.45) * 1.1 : 0;
      an.gust += (clamp(wantGust, 0, 1) - an.gust) * Math.min(1, dt * (wantGust > an.gust ? 6 : 1.6));
    }
    an.prevT = r.t;
    const needT = Math.max(3.6, r.maxApex + 2.3);
    an.need += (needT - an.need) * Math.min(1, dt * 1.6);
    for (const q of pl.puffs.splice(0)) {
      // a puff of dust at her feet, a few straw flecks off the bale, petals shaken from the tree are handled in the picture
      const stage = lay().play.stage, cam = camFor(stage, pl), pt = boardPoints(cam, an.tilt)[q.who === 0 ? 'left' : 'right'];
      puff(pl.parts, rng, pt.x, pt.y - 0.03 * cam.s, state.prefs.calm ? 2 : 3 + Math.round(5 * q.hh), '#e8d2a6', cam.s / 150, q.who === 0 ? -1 : 1);
      if (q.hh > 0.25) burst(pl.parts, rng, cam.pivotX, cam.groundY - 0.4 * cam.s, Math.round(4 * q.hh), '#e6c25c', 0.45, 1);
    }
    stepParticles(pl.parts, dt);
    if (pl.banner) { pl.banner.t += dt; if (pl.banner.t > 1.7) pl.banner = null; }
  }
  function endPoint(pl, p) {
    const stage = lay().play.stage, cam = camFor(stage, pl);
    return boardPoints(cam, p === 0 ? TILT : -TILT)[p === 0 ? 'left' : 'right'];
  }
  function reactToLog(pl) {
    const r = pl.r;
    while (pl.logSeen < r.log.length) {
      const e = r.log[pl.logSeen++];
      const best = [e.sJ, e.rJ].includes('miss') ? 'miss' : [e.sJ, e.rJ].every((g) => g === 'perfect') ? 'perfect' : [e.sJ, e.rJ].includes('good') ? 'good' : 'great';
      const pt = endPoint(pl, e.lander), calm = state.prefs.calm;
      if (best === 'miss') {
        burst(pl.parts, rng, pt.x, pt.y, 8, '#c8a57a', 0.5, 0);
        tone({ freq: 150, to: 80, dur: 0.22, type: 'sawtooth', vol: 0.09 });
      } else {
        burst(pl.parts, rng, pt.x, pt.y, calm ? 5 : best === 'perfect' ? 20 : 10, best === 'perfect' ? '#ffe9a8' : '#fff4e0', 0.9, 1);
        const f = 0.8 + Math.min(e.ho, 3) * 0.16;
        tone({ freq: 520 * f, to: 780 * f, dur: 0.16, type: 'sine', vol: 0.15 });
        if (best === 'perfect') tone({ freq: 1040 * f, dur: 0.12, type: 'triangle', vol: 0.06 });
      }
      tone({ freq: 140, to: 62, dur: 0.16, type: 'sine', vol: 0.26 });
      if (r.perfectRun > 0 && r.perfectRun % 4 === 0) pl.banner = { text: `IN HARMONY x${r.perfectRun}`, t: 0 };
    }
    const n = starsOf(r.maxApex, r.lvl);
    if (n > pl.starsSeen) { pl.starsSeen = n; pl.banner = { text: `${n} STAR${n > 1 ? 'S' : ''}`, t: 0 }; tone({ freq: 660, to: 1320, dur: 0.4, type: 'triangle', vol: 0.14 }); }
    if (r.done && r.endReason === 'slip' && !pl.slipShown) { pl.slipShown = true; pl.banner = { text: 'THE BOARD SLIPPED', t: 0 }; }
  }

  // ---- input -----------------------------------------------------------------------------------------------------------------------
  function applyEdges(pl, input, tap) {
    const r = pl.r, k = input.keys, p = input.pointer, L = lay().play;
    const act = (who, down) => {
      if (!pl.humans[who]) return;
      edge(r, who, down);
      tone(down ? { freq: 300, to: 220, dur: 0.05, type: 'triangle', vol: 0.07 } : { freq: 420, to: 560, dur: 0.05, type: 'triangle', vol: 0.06 });
    };
    // keyboard
    const sets = pl.mode === 'duel' ? DUEL_KEYS : [SOLO_KEYS, []];
    for (let who = 0; who < 2; who++) {
      const now = sets[who].some((c) => k.down.has(c));
      if (now && !pl.keyHeld[who]) act(who, true);
      else if (!now && pl.keyHeld[who]) act(who, false);
      pl.keyHeld[who] = now;
    }
    // two fingers (main.js forwards every touch); otherwise one pointer picks the girl by the side it starts on
    if (pl.mode === 'duel' && multi.seen) {
      for (const e of multi.q.splice(0)) act(e.p, e.down);
      return;
    }
    multi.q.length = 0;
    if (tap && !inRect(L.pause, tap.x, tap.y) && !inRect(L.hint, tap.x, tap.y)) {
      const who = pl.mode === 'duel' ? (tap.x < lay().w / 2 ? 0 : 1) : 0;
      pl.ptr = { who }; act(who, true);
    }
    if (pl.ptr && !p.down) { act(pl.ptr.who, false); pl.ptr = null; }
  }

  function beginThink(pl) {
    pl.auto.phase = 'think'; pl.auto.timer = THINK_CHOICES[state.prefs.thinkIdx];
    pl.auto.plan = forecast(pl.r, PHRASE);
    pl.auto.lastThink = pl.r.contacts;
  }
  function showHint(pl) {
    if (pl.mode !== 'learn' || pl.hint || pl.r.done) return;
    pl.hint = { timer: REVEAL_SECONDS + 0.5, plan: forecast(pl.r, 3) };
  }

  function updatePlay(dt, tap, input) {
    const pl = state.pl, L = lay().play, r = pl.r;
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    const kp = input.keys.pressed;
    if (tap) {
      if (inRect(L.pause, tap.x, tap.y)) { pausePlay(); return; }
      if (pl.mode === 'learn' && inRect(L.hint, tap.x, tap.y)) { showHint(pl); return; }
    }
    if (kp.has('Escape') || kp.has('KeyP')) { pausePlay(); return; }
    if (kp.has('KeyH')) showHint(pl);
    pl.clock += dt;
    stepAnim(pl, dt);
    // Learn hint: the clock stands still while the next contacts are listed
    if (pl.hint) { pl.hint.timer -= dt; if (pl.hint.timer <= 0) pl.hint = null; return; }
    // Watch and Learn: Think then Reveal before each phrase, with the clock stopped
    if (pl.auto && pl.auto.phase !== 'act') {
      const a = pl.auto; a.timer -= dt;
      if (a.timer <= 0) {
        if (a.phase === 'think') { a.phase = 'reveal'; a.timer = REVEAL_SECONDS; a.plan = forecast(r, PHRASE); }
        else a.phase = 'act';
      }
      return;
    }
    if (pl.auto && !r.done && r.contacts > 0 && r.contacts % PHRASE === 0 && pl.auto.lastThink !== r.contacts && r.t + dt >= r.ev.t0) { beginThink(pl); return; }
    // the count-in clicks
    if (r.t < COUNT_IN) {
      const b = Math.floor(r.t / (COUNT_IN / 3));
      if (b !== pl.countBeat) { pl.countBeat = b; tone({ freq: 440 + b * 110, dur: 0.07, type: 'triangle', vol: 0.12 }); }
    }
    step(r, dt);
    applyEdges(pl, input, tap);
    reactToLog(pl);
    if (r.done && r.t >= r.endAt) finishRun();
  }

  function finishRun() {
    const pl = state.pl, r = pl.r, sm = summary(r), id = LEVELS[pl.ri].id, old = state.best[id] ?? {};
    const res = { ri: pl.ri, mode: pl.mode, ...sm, newBest: false };
    if (pl.mode === 'solo' && r.endReason !== 'slip') {
      res.newBest = !old.apex || sm.maxApex > old.apex;
      state.best[id] = { apex: Math.max(old.apex || 0, sm.maxApex), stars: Math.max(old.stars || 0, sm.stars), score: Math.max(old.score || 0, sm.score[0]) };
      storage.set('best', state.best);
    }
    env.monetization.track?.('round_end', { course: id, mode: pl.mode, stars: sm.stars });
    pl.over = true; state.result = res; state.scene = 'result'; state.sceneT = 0;
  }

  function pauseItems(pl) { return pl.over ? ['again', 'next', 'exit'] : ['resume', 'restart', 'quit']; }
  function updatePauseMenu(tap, input) {
    const pl = state.pl, items = pauseItems(pl), M = menuRects(lay(), items.length, 96);
    if ((input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyP')) && !pl.over) { resumePlay(); return; }
    if (!tap) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tap.x, tap.y)) return;
      if (it === 'resume') resumePlay();
      else if (it === 'restart' || it === 'again') startPlay(pl.mode, pl.ri);
      else go('levels');
    });
  }

  // ---- menus and documents -------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs, cyc = (v, n) => (v + 1) % n;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'think') p.thinkIdx = cyc(p.thinkIdx, THINK_CHOICES.length);
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') {
      const say = (text) => { state.toast = { text, t: 0, hold: 2.6 }; };
      say('Checking purchases...');
      Promise.resolve(env.monetization?.restore?.()).then(() => say(env.monetization?.owns?.('unlock_game') ? 'Purchase restored.' : 'No earlier purchase found.')).catch(() => say('Could not reach the store.'));
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

  function updateTitle(tap) {
    if (!tap) return;
    const T = lay().title, hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(T.play)) { state.twoNext = false; go('levels'); }
    else if (hit(T.auto)) startPlay('auto', 0);
    else if (hit(T.two)) { state.twoNext = true; go('levels'); }
    else if (hit(T.how)) openDoc('howto', 'title');
    else if (hit(T.rules)) openDoc('rules', 'title');
    else if (hit(T.about)) openDoc('about', 'title');
    else if (hit(T.settings)) openDoc('settings', 'title');
    else if (tap.y > T.credit.y - 60 && Math.abs(tap.x - T.credit.x) < 200) env.openArcforgeHome?.();
  }
  function updateLevels(tap) {
    if (!tap) return;
    const G = lay().levels;
    if (inRect(G.back, tap.x, tap.y)) { state.twoNext = false; go('title'); return; }
    G.cards.forEach((r, i) => {
      if (!inRect(r, tap.x, tap.y)) return;
      state.sel = i;
      if (state.twoNext) startPlay('duel', i); else go('detail');
    });
  }
  function updateDetail(tap) {
    if (!tap) return;
    const D = lay().detail;
    if (inRect(D.back, tap.x, tap.y)) go('levels');
    else if (inRect(D.perform, tap.x, tap.y)) startPlay('solo');
    else if (inRect(D.learn, tap.x, tap.y)) startPlay('learn');
    else if (inRect(D.two, tap.x, tap.y)) startPlay('duel');
    else if (inRect(D.watch, tap.x, tap.y)) startPlay('auto');
  }
  function updateResult(tap) {
    if (!tap) return;
    const Rr = lay().result;
    if (inRect(Rr.again, tap.x, tap.y)) startPlay(state.result.mode, state.result.ri);
    else if (inRect(Rr.routines, tap.x, tap.y)) go('levels');
    else if (inRect(Rr.menu, tap.x, tap.y)) go('title');
    else if (tap.y > Rr.more.y - 30 && tap.y < Rr.more.y + 14) env.openArcforgeHome?.();
  }

  // ---- the object the kit and main.js see ------------------------------------------------------------------------------------------
  const idleInput = () => ({ pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } });
  const api = {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'levels') updateLevels(tap);
      else if (sc === 'detail') updateDetail(tap);
      else if (sc === 'play') updatePlay(dt, tap, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems); },
    getState: () => state,
    // Called by main.js when the app goes to the background.
    autoPause() { if (state.scene === 'play') pausePlay(); },
    // Extra fingers (two-player play): main.js forwards every touch with its id and its position in virtual units.
    multi(type, id, x, y) {
      const pl = state.pl;
      if (state.scene !== 'play' || !pl || pl.mode !== 'duel' || pl.paused || pl.over) return;
      const L = lay().play;
      if (type === 'down') {
        if (inRect(L.pause, x, y)) return;
        const who = x < lay().w / 2 ? 0 : 1;
        multi.seen = true; multi.sides.set(id, who); multi.q.push({ p: who, down: true });
      } else if (type === 'up') {
        const who = multi.sides.get(id);
        if (who === undefined) return;
        multi.sides.delete(id); multi.q.push({ p: who, down: false });
      }
    },
    // Everything except real play is free: menus, Rules, Watch and Learn, results, pause.
    isPreviewExempt() {
      const pl = state.pl;
      return !(state.scene === 'play' && pl && pl.mode !== 'auto' && !pl.paused && !pl.over);
    },
    // Tester tools (?dev=1): jump to a screen and fast-forward.
    dev: {
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.level !== undefined) state.sel = o.level;
        const sc = o.scene ?? 'title';
        if (sc === 'play') startPlay(o.mode ?? 'solo', state.sel, !!o.play);
        else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startPlay('solo', state.sel, true);
          const idle = idleInput();
          for (let i = 0; i < 60 * 240 && state.scene === 'play'; i++) api.update(1 / 60, idle);
          if (state.result) state.result.newBest = true;
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.pause && state.pl) pausePlay();
        if (o.advance) { const idle = idleInput(); for (let i = 0; i < o.advance * 60; i++) api.update(1 / 60, idle); }
      },
    },
  };
  return api;
}
