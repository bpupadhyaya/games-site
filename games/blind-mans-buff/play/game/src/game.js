// Blind Man's Buff: state and flow. Drawing is in view.js / docview.js; the world and its rules are in engine.js.
//
// Time model: every timer is the sum of the dt values handed to update() (deterministic, pausable).
// A round: meet the party -> seek (walk, call, reach) -> feel (name the caught guest) -> ... -> result.
// Watch and Learn: THINK (world frozen, the coach explains) -> REVEAL (its choice shown) -> ACT (a short leg of real play) -> repeat.
import { ptr as uiPtr } from './ui.js';
import {
  VENUES, THINK_TIMES, REVEAL_SECONDS, AUTO_VENUE, newWorld, stepWorld, feelMore, guess, candidatesOf, coachPlan, coachGuess, autoControl, resultOf, feltGuests,
  dist, ARENA, MARGIN,
} from './engine.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects, identifyRects } from './layout.js';
import { burst, stepParticles } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { RULES } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const DEMO_ROUNDS = 3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const IDLE = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
const GAIT_MAG = [0.3, 0.62, 1];

export function createGame(env) {
  const { rng, storage, config, audio, monetization } = env;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, modeSel: 'seek', backTo: 'title',
    prefs: { sound: true, thinkIdx: 1, calm: false, textIdx: 0 },
    best: {}, demoRuns: 0, plN: 0, pl: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true,
    owned: false, restoreMsg: '', restoreBusy: false,
  };
  state.owned = !!monetization?.owns?.('unlock_game');
  monetization?.onChange?.(() => { state.owned = !!monetization.owns('unlock_game'); });
  let lastScene = state.scene, drag = null;

  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); state.prefs.textIdx = clamp(state.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); applyPrefs(); } });
  storage.get('best', null).then((v) => { if (v) state.best = v; });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();

  const lay = () => layoutFor(meta.width, meta.height);
  const go = (scene) => { state.scene = scene; if (scene !== 'play' && scene !== 'result') state.pl = null; };
  const say = (text, hold = 2.2) => { state.toast = { text, t: 0, hold }; };
  const tone = (o) => { if (state.prefs.sound) audio.tone(o); };
  const thinkTime = () => THINK_TIMES[clamp(state.prefs.thinkIdx, 0, THINK_TIMES.length - 1)];

  // ---- a round ---------------------------------------------------------------------------------------------------------------------------
  function newRound(mode, venueIdx, auto) {
    const vi = auto ? AUTO_VENUE : venueIdx;
    state.plN += 1;
    return {
      id: state.plN, w: newWorld({ mode: auto ? 'seek' : mode, venueIdx: vi, rng, auto }), mode: auto ? 'seek' : mode, auto, venueIdx: vi,
      meet: !auto, paused: false, over: false, frozen: false, dest: null, lastTap: null, dragging: false, selected: null, gait: 1,
      hint: null, hintT: 0, pre: null, leg: null, parts: [], shake: 0, tick: 0, reachBuf: 0,
    };
  }

  function startPlay(mode, venueIdx = state.sel, auto = false) {
    if (config.demo && !auto && (venueIdx > 0 || state.demoRuns >= DEMO_ROUNDS)) { go('demo-limit'); return; }
    if (config.demo && !auto) { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    state.sel = venueIdx;
    state.pl = newRound(mode, venueIdx, auto); state.result = null;
    state.scene = 'play'; state.sceneT = 0;
    env.monetization.track?.('round_start', { venue: VENUES[state.pl.venueIdx].id, mode: state.pl.mode, auto });
  }
  const pausePlay = () => { const pl = state.pl; if (pl && !pl.over && !pl.meet) pl.paused = true; };
  const resumePlay = () => { const pl = state.pl; if (pl) pl.paused = false; };

  // One simulation step with the sounds and sparks that go with what happened.
  function simStep(pl, ctl) {
    const w = pl.w, ph = w.phase, wasReach = w.me.reach, caughtN = w.caught.length, foundN = w.guests.filter((g) => g.out).length;
    stepWorld(w, 1 / 60, rng, ctl);
    if (w.me.reach > 0 && wasReach === 0) tone({ freq: 300, to: 620, dur: 0.18, type: 'sine', vol: 0.07 });
    if (ph === 'seek' && w.phase === 'feel') {
      tone({ freq: 392, dur: 0.14, type: 'triangle', vol: 0.14 }); tone({ freq: 587, dur: 0.2, type: 'triangle', vol: 0.12 });
      if (!state.prefs.calm) { burst(pl.parts, rng, w.me.x, w.me.y, 18, '#ffd27a', 0.8); pl.shake = 0.25; }
      pl.selected = null; pl.dest = null; pl.hintT = 0;
    }
    if (w.mode === 'hide' && w.guests.filter((g) => g.out).length > foundN) tone({ freq: 240, to: 150, dur: 0.25, type: 'sawtooth', vol: 0.06 });
    if (w.caught.length > caughtN) tone({ freq: 523, dur: 0.14, type: 'triangle', vol: 0.14 });
    if (w.done === 'caught') { tone({ freq: 330, to: 180, dur: 0.4, type: 'sawtooth', vol: 0.09 }); pl.shake = 0.35; }
  }

  function finishRound(pl) {
    const w = pl.w;
    if (pl.auto) { pl.over = true; return; }
    const res = resultOf(w), key = `${pl.mode}:${VENUES[pl.venueIdx].id}`, old = state.best[key] ?? { feathers: 0, score: 0, played: 0 };
    res.mode = pl.mode; res.venueName = VENUES[pl.venueIdx].name; res.runSeconds = Math.round(w.runT);
    res.newBest = res.won && res.score > old.score;
    state.best[key] = { feathers: Math.max(old.feathers, res.feathers), score: Math.max(old.score, res.won ? res.score : 0), played: old.played + 1 };
    storage.set('best', state.best);
    env.monetization.track?.('round_end', { venue: VENUES[pl.venueIdx].id, mode: pl.mode, won: res.won, score: res.score });
    state.result = res; state.scene = 'result'; state.sceneT = 0; pl.over = true; pl.paused = false;
  }

  function stepAnim(pl, dt) {
    stepParticles(pl.parts, dt);
    if (pl.shake > 0) pl.shake = Math.max(0, pl.shake - dt);
    if (pl.hintT > 0) pl.hintT = Math.max(0, pl.hintT - dt);
  }

  // ---- hint -------------------------------------------------------------------------------------------------------------------------------
  function useHint(pl) {
    const w = pl.w;
    if (pl.auto || w.phase === 'over' || pl.meet) return;
    if (w.mode === 'seek') pl.hint = w.phase === 'feel' ? coachGuess(w) : coachPlan(w);
    else pl.hint = hideAdvice(w);
    if (pl.hintT <= 0) w.hints += 1;
    pl.hintT = 7;
  }
  function hideAdvice(w) {
    const s = w.seeker, d = dist(s, w.me), lines = [];
    if (d < 170) lines.push('The seeker is close. Stand still or tiptoe away from the line between you and it: steps are what it hears.');
    else if (w.me.noise > 0) lines.push('Your steps carry. Tiptoe is silent, and the seeker follows the loudest sound it hears.');
    else lines.push('You are quiet. Let the other guests\' claps draw the seeker away, and keep clear of its path.');
    lines.push('Use Tease only when you have somewhere to go straight after: it pulls the seeker to where you stand.');
    return { kind: 'hide', why: lines };
  }

  // ---- human controls ----------------------------------------------------------------------------------------------------------------------
  const toWorld = (A, x, y) => ({ x: clamp(((x - A.x) / A.w) * ARENA, MARGIN, ARENA - MARGIN), y: clamp(((y - A.y) / A.h) * ARENA, MARGIN, ARENA - MARGIN) });

  function updateIdentify(pl, L, tap, keys) {
    const w = pl.w, cands = candidatesOf(w), I = identifyRects(L, L.play.arena, cands.length);
    for (let i = 0; i < cands.length && i < 9; i++) if (keys.has(`Digit${i + 1}`)) pl.selected = cands[i];
    if (keys.has('KeyF')) { if (feelMore(w)) tone({ freq: 300, dur: 0.08, type: 'sine', vol: 0.08 }); }
    if (keys.has('KeyH')) useHint(pl);
    let confirm = keys.has('Enter') || keys.has('Space');
    if (tap) {
      if (inRect(L.play.hint, tap.x, tap.y)) useHint(pl);
      cands.forEach((id, i) => { if (inRect(I.cards[i], tap.x, tap.y)) { pl.selected = id; tone({ freq: 440 + i * 40, dur: 0.05, type: 'sine', vol: 0.08 }); } });
      if (inRect(I.feel, tap.x, tap.y)) { if (feelMore(w)) tone({ freq: 300, dur: 0.08, type: 'sine', vol: 0.08 }); }
      if (inRect(I.yes, tap.x, tap.y)) confirm = true;
    }
    if (confirm && pl.selected) { doGuess(pl, pl.selected); if (pl.w.done) finishRound(pl); }
  }
  function doGuess(pl, id) {
    const w = pl.w, held = w.guests.find((g) => g.id === w.hold), px = held ? held.x : w.me.x, py = held ? held.y : w.me.y;
    const r = guess(w, id, rng);
    pl.selected = null; pl.hintT = 0;
    if (r.ok) {
      tone({ freq: 523, dur: 0.14, type: 'triangle', vol: 0.14 }); tone({ freq: 659, dur: 0.14, type: 'triangle', vol: 0.12 }); tone({ freq: 784, to: 1046, dur: 0.35, type: 'sine', vol: 0.12 });
      if (!state.prefs.calm) burst(pl.parts, rng, px, py, 30, '#ffd45a', 1);
    } else {
      tone({ freq: 220, to: 140, dur: 0.35, type: 'sawtooth', vol: 0.08 });
      if (!state.prefs.calm) pl.shake = 0.3;
    }
  }

  function humanUpdate(pl, L, input) {
    const w = pl.w, P = L.play, p = input.pointer, keys = input.keys.pressed, down = input.keys.down;
    const tap = p.pressed ? { x: p.x, y: p.y } : null;
    if (w.phase === 'feel') { updateIdentify(pl, L, tap, keys); return; }
    const hide = w.mode === 'hide';
    let reach = false, clap = false;
    if (keys.has('KeyH')) useHint(pl);
    if (keys.has('KeyC')) clap = true;
    if (!hide && keys.has('Space')) reach = true;
    if (tap) {
      if (inRect(P.hint, tap.x, tap.y)) useHint(pl);
      else if (inRect(P.btnA, tap.x, tap.y)) clap = true;
      else if (inRect(P.btnB, tap.x, tap.y)) { if (hide) pl.dest = null; else reach = true; }
      else if (hide && P.gait.some((r) => inRect(r, tap.x, tap.y))) { pl.gait = P.gait.findIndex((r) => inRect(r, tap.x, tap.y)); tone({ freq: 300 + pl.gait * 90, dur: 0.05, type: 'sine', vol: 0.08 }); }
      else if (inRect(P.arena, tap.x, tap.y)) {
        const pt = toWorld(P.arena, tap.x, tap.y);
        pl.dragging = true; pl.lastTap = pt;
        const felt = hide ? [] : feltGuests(w).filter((g) => dist(g, pt) < 70);
        if (felt.length) { pl.lastTap = { x: felt[0].x, y: felt[0].y }; reach = true; }
        else if (dist(pt, w.me) < 30) pl.dest = null;
        else pl.dest = pt;
      }
    }
    if (pl.dragging && p.down && inRect(P.arena, p.x, p.y)) { const pt = toWorld(P.arena, p.x, p.y); if (dist(pt, w.me) >= 30) { pl.dest = pt; pl.lastTap = pt; } }
    if (p.released) pl.dragging = false;
    // keyboard steering
    const kx = (down.has('ArrowRight') || down.has('KeyD') ? 1 : 0) - (down.has('ArrowLeft') || down.has('KeyA') ? 1 : 0);
    const ky = (down.has('ArrowDown') || down.has('KeyS') ? 1 : 0) - (down.has('ArrowUp') || down.has('KeyW') ? 1 : 0);
    let dx = 0, dy = 0, gait = pl.gait;
    if (hide && (down.has('ShiftLeft') || down.has('ShiftRight'))) gait = 0;
    if (hide && down.has('Space')) gait = 2;
    if (kx || ky) { const m = Math.hypot(kx, ky); dx = kx / m; dy = ky / m; pl.dest = null; pl.lastTap = { x: w.me.x + dx * 100, y: w.me.y + dy * 100 }; }
    else if (pl.dest) {
      const ddx = pl.dest.x - w.me.x, ddy = pl.dest.y - w.me.y, d = Math.hypot(ddx, ddy);
      if (d < 10) pl.dest = null; else { dx = ddx / d; dy = ddy / d; }
    }
    // a Reach pressed just before the arms are free is kept for a third of a second, so a thumb slightly early still counts
    if (!hide) {
      const busy = w.me.rec > 0 || w.me.reach > 0;
      if (reach && busy) { pl.reachBuf = 0.33; reach = false; }
      else if (pl.reachBuf > 0) { pl.reachBuf = Math.max(0, pl.reachBuf - 1 / 60); if (!busy && pl.reachBuf > 0) { reach = true; pl.reachBuf = 0; } }
    }
    const mag = hide ? GAIT_MAG[gait] : 1;
    // reaching aims at the nearest warm shape if there is one, else where the last tap was
    if (reach && !hide) {
      const f = feltGuests(w).sort((a, b) => dist(a, w.me) - dist(b, w.me))[0];
      const aim = f ?? pl.lastTap;
      if (aim && dist(aim, w.me) > 6) w.me.a = Math.atan2(aim.y - w.me.y, aim.x - w.me.x);
    }
    simStep(pl, { dx: dx * mag, dy: dy * mag, reach, clap });
    if (clap && w.mode === 'seek') tone({ freq: 180, to: 120, dur: 0.07, type: 'triangle', vol: 0.12 });
    if (w.done) finishRound(pl);
  }

  // ---- Watch and Learn --------------------------------------------------------------------------------------------------------------------
  function autoUpdate(pl, dt) {
    const w = pl.w;
    if (w.done) { pl.over = true; return; }
    if (pl.pre) {
      pl.pre.t += dt;
      if (pl.pre.kind === 'think' && pl.pre.t >= pl.pre.dur) pl.pre = { ...pl.pre, kind: 'reveal', t: 0, dur: REVEAL_SECONDS };
      else if (pl.pre.kind === 'reveal' && pl.pre.t >= pl.pre.dur) {
        const plan = pl.pre.plan, where = pl.pre.where; pl.pre = null;
        if (where === 'feel') {
          if (plan.kind === 'feel') feelMore(w); else doGuess(pl, plan.id);
          if (w.done) pl.over = true;
        } else pl.leg = { plan, t: 0, tick: 0, max: plan.kind === 'walk' ? 2.6 : plan.kind === 'felt' ? 1.8 : plan.kind === 'clap' ? 0.3 : 0.9 };
      }
      return;
    }
    if (w.phase === 'feel') { pl.pre = { kind: 'think', t: 0, dur: thinkTime(), plan: coachGuess(w), where: 'feel' }; return; }
    if (pl.leg) {
      const lg = pl.leg; lg.tick += 1;
      if (lg.tick % 12 === 0) { const np = coachPlan(w); if (np.kind === 'felt' || lg.plan.kind === 'wait') lg.plan = np; }
      simStep(pl, autoControl(w, lg.plan, rng));
      lg.t += dt;
      if (lg.t >= lg.max || w.phase !== 'seek') pl.leg = null;
      if (w.done) pl.over = true;
      return;
    }
    pl.pre = { kind: 'think', t: 0, dur: thinkTime(), plan: coachPlan(w), where: 'move' };
  }

  // ---- per-tick play update ---------------------------------------------------------------------------------------------------------------
  function updatePlay(dt, input) {
    const pl = state.pl, L = lay(), P = L.play, p = input.pointer, keys = input.keys.pressed;
    const tap = p.pressed ? { x: p.x, y: p.y } : null;
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    if (keys.has('Escape') || (tap && inRect(P.pause, tap.x, tap.y))) { pausePlay(); if (!pl.meet) return; }
    stepAnim(pl, dt);
    if (pl.meet) {
      const M = L.meet;
      if ((tap && inRect(M.start, tap.x, tap.y)) || keys.has('Enter') || keys.has('Space')) { pl.meet = false; tone({ freq: 330, to: 440, dur: 0.15, type: 'triangle', vol: 0.1 }); }
      return;
    }
    if (pl.frozen) return;
    pl.tick += 1;
    if (pl.auto) autoUpdate(pl, dt); else humanUpdate(pl, L, input);
  }

  function pauseItems(pl) {
    return pl.over ? ['again', 'exit'] : pl.auto ? ['resume', 'think', 'quit'] : ['resume', 'restart', 'quit'];
  }
  function updatePauseMenu(tap, input) {
    const pl = state.pl, items = pauseItems(pl), M = menuRects(lay(), items.length);
    if (input.keys.pressed.has('Escape') && !pl.over) { resumePlay(); return; }
    if (!tap) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tap.x, tap.y)) return;
      if (it === 'resume') resumePlay();
      else if (it === 'restart') startPlay(pl.mode, state.sel, false);
      else if (it === 'again') startPlay('seek', 0, true);
      else if (it === 'think') { state.prefs.thinkIdx = (state.prefs.thinkIdx + 1) % THINK_TIMES.length; savePrefs(); say(`Think time ${thinkTime()} s`); }
      else go('title');
    });
  }

  // ---- menus and documents ---------------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs, cyc = (v, n) => (v + 1) % n;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'think') p.thinkIdx = cyc(p.thinkIdx, THINK_TIMES.length);
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') {
      if (state.restoreBusy || state.owned || !monetization?.restore) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
      Promise.resolve(monetization.restore()).then(() => {
        state.owned = !!monetization.owns('unlock_game');
        state.restoreMsg = state.owned ? 'Purchase restored' : 'No earlier purchase found';
      }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
      return;
    }
    savePrefs();
  }
  function updateDoc(input) {
    const p = input.pointer, max = docMetrics.max, view = ui.view;
    const setScroll = (v) => { state.docScroll = clamp(v, 0, max); };
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

  function updateTitle(tap) {
    if (!tap) return;
    const T = lay().title, hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(T.play)) go('venues');
    else if (hit(T.auto)) startPlay('seek', 0, true);
    else if (hit(T.how)) openDoc('howto', 'title');
    else if (hit(T.rules)) openDoc('rules', 'title');
    else if (hit(T.about)) openDoc('about', 'title');
    else if (hit(T.settings)) openDoc('settings', 'title');
    else if (tap.y > T.credit.y - 60 && Math.abs(tap.x - T.credit.x) < 190) env.openArcforgeHome?.();
  }
  function updateVenues(tap, input) {
    const G = lay().venues;
    if (input.keys.pressed.has('Escape')) { go('title'); return; }
    if (!tap) return;
    if (inRect(G.back, tap.x, tap.y)) { go('title'); return; }
    if (inRect(G.modes[0], tap.x, tap.y)) state.modeSel = 'seek';
    else if (inRect(G.modes[1], tap.x, tap.y)) state.modeSel = 'hide';
    G.cards.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) startPlay(state.modeSel, i, false); });
  }
  function updateResult(tap) {
    if (!tap) return;
    const Rr = lay().result;
    if (inRect(Rr.again, tap.x, tap.y)) startPlay(state.pl ? state.pl.mode : state.modeSel, state.sel, false);
    else if (inRect(Rr.rooms, tap.x, tap.y)) go('venues');
    else if (inRect(Rr.menu, tap.x, tap.y)) go('title');
    else if (tap.y > Rr.more.y - 30 && tap.y < Rr.more.y + 14) env.openArcforgeHome?.();
  }

  // ---- the object the kit and main.js see -------------------------------------------------------------------------------------------------
  const api = {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      uiPtr.x = p.x; uiPtr.y = p.y; uiPtr.down = !!p.down;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'venues') updateVenues(tap, input);
      else if (sc === 'play') updatePlay(dt, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, { pauseItems }); },
    getState: () => state,
    autoPause() { if (state.scene === 'play') pausePlay(); },
    // Everything except a real round in progress is free: menus, Rules, Watch and Learn, results, the party card, pause.
    isPreviewExempt() {
      const pl = state.pl;
      return !(state.scene === 'play' && pl && !pl.auto && !pl.meet && !pl.paused && !pl.over);
    },
    // For the sound presenter in main.js: what was heard, where the listener is, whether sound is on.
    cues() {
      const pl = state.scene === 'play' ? state.pl : null;
      if (!pl || pl.paused || pl.meet) return null;
      return { id: pl.id, events: pl.w.events, me: { x: pl.w.me.x, y: pl.w.me.y }, mode: pl.w.mode, floor: VENUES[pl.venueIdx]?.floor, sound: state.prefs.sound };
    },
    // Tester tools (?dev=1 and ?shot=1): jump to a screen and fast-forward with the coach playing.
    dev: {
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.sel !== undefined) state.sel = o.sel;
        if (o.modeSel) state.modeSel = o.modeSel;
        const sc = o.scene ?? 'title';
        if (sc === 'play') {
          startPlay(o.mode ?? 'seek', state.sel, !!o.auto);
          const pl = state.pl;
          if (!pl) return;
          pl.meet = !!o.meet;
          if (o.advance) fastForward(pl, o.advance * 60, null);
          if (o.phase === 'feel') fastForward(pl, 60 * 600, () => pl.w.phase === 'feel');
          if (o.clues && pl.w.phase === 'feel') for (let i = 1; i < o.clues; i++) feelMore(pl.w);
          if (o.select && pl.w.phase === 'feel') pl.selected = pl.w.hold;
          if (o.hint) useHint(pl);
          if (o.think && pl.auto) {
            for (let i = 0; i < 400 && !pl.pre; i++) api.update(1 / 60, IDLE);
            if (pl.pre && o.think === 'reveal') pl.pre = { ...pl.pre, kind: 'reveal', t: 0.2, dur: REVEAL_SECONDS };
            else if (pl.pre) pl.pre.t = Math.min(2.5, pl.pre.dur - 0.5);
          }
          pl.frozen = !!o.hold;
          if (o.pause) pausePlay();
        } else if (sc === 'result') {
          startPlay(o.mode ?? 'seek', state.sel, false); const pl = state.pl; pl.meet = false;
          fastForward(pl, 60 * 900, () => state.scene === 'result');
        } else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else { state.scene = sc; state.sceneT = 0; }
      },
    },
  };
  // The coach drives a human round (used by the dev jump and the scenario tests).
  function fastForward(pl, maxTicks, stop) {
    let plan = null, k = 0;
    for (let i = 0; i < maxTicks && state.scene === 'play' && !pl.w.done; i++) {
      if (stop && stop()) return;
      const w = pl.w;
      if (pl.auto) { api.update(1 / 60, IDLE); continue; }
      if (w.phase === 'feel') { const g = coachGuess(w); if (g.kind === 'feel') feelMore(w); else doGuess(pl, g.id); continue; }
      if (w.mode === 'seek') {
        if (k++ % 12 === 0 || !plan) plan = coachPlan(w);
        simStep(pl, autoControl(w, plan, rng));
      } else {
        const s = w.seeker, d = dist(s, w.me), a = Math.atan2(w.me.y - s.y, w.me.x - s.x);
        simStep(pl, d < 180 ? { dx: Math.cos(a) * 0.62, dy: Math.sin(a) * 0.62 } : { dx: 0, dy: 0 });
      }
      stepAnim(pl, 1 / 60);
    }
    if (pl.w.done && !pl.auto && state.scene === 'play') finishRound(pl);
  }
  return api;
}
