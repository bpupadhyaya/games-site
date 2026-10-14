// Circle Dodgeball: state and flow. Drawing is in view.js / docview.js / art.js; the world and its rules are in engine.js.
//
// Time model: every timer is the sum of the dt values handed to update() (deterministic, pausable).
// A match: venue -> play (run, throw, pass, catch) -> short pause on the last hit -> result.
// Watch and Learn: THINK (court frozen, the coach explains) -> REVEAL (its choice shown) -> ACT (a short leg of real play) -> repeat.
import {
  VENUES, THINK_TIMES, REVEAL_SECONDS, AUTO_VENUE, CY, CX, RIM, R, newWorld, stepWorld, planFor, autoControl, resultOf,
} from './engine.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects } from './layout.js';
import { camFor, camFromGl, burst, ringFx, stepParticles, PAL } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { RULES } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const DEMO_ROUNDS = 3;
const END_BEAT = 1.5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const IDLE = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };

export function createGame(env) {
  const { rng, storage, config, audio } = env;
  const trng = rng.fork();
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, roleSel: 'dodger', backTo: 'title',
    prefs: { sound: true, thinkIdx: 1, calm: false, textIdx: 0 },
    best: {}, demoRuns: 0, plN: 0, pl: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    titleWorld: null, toast: null, dev: config.dev === true, demo: config.demo === true,
    owned: !!env.monetization?.owns?.('unlock_game'), restoreMsg: '', restoreBusy: false,
  };
  env.monetization?.onChange?.(() => { state.owned = !!env.monetization.owns('unlock_game'); });
  let lastScene = state.scene, drag = null, lastBounceT = -1, glNow = null;   // glNow: the 3D presenter's projection from the last render

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

  // ---- the living title ------------------------------------------------------------------------------------------------------------------
  function newTitleWorld() {
    const w = newWorld({ venueIdx: 0, rng: trng, auto: true });
    w.me = -1;
    state.titleWorld = { w, parts: [], seen: 0, endT: 0 };
  }
  function stepTitle(dt) {
    if (!state.titleWorld) newTitleWorld();
    const tw = state.titleWorld;
    stepWorld(tw.w, dt, trng, null);
    for (const e of tw.w.events) {
      if (e.n <= tw.seen) continue;
      tw.seen = e.n;
      if (e.kind === 'hit') burst(tw.parts, trng, e.x, e.y, 40, '#ffd23f', 0.8, 'star');
      else if (e.kind === 'catch') ringFx(tw.parts, e.x, e.y, '#ffffff', 20, 100);
    }
    stepParticles(tw.parts, dt);
    if (tw.w.phase === 'over') { tw.endT += dt; if (tw.endT > 2.5) newTitleWorld(); }
  }

  // ---- a match ---------------------------------------------------------------------------------------------------------------------------
  function startPlay(venueIdx = state.sel, role = state.roleSel, auto = false) {
    const vi = auto ? AUTO_VENUE : venueIdx;
    if (config.demo && !auto && (vi > 0 || state.demoRuns >= DEMO_ROUNDS)) { go('demo-limit'); return; }
    if (config.demo && !auto) { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    state.sel = vi;
    state.plN += 1;
    const w = newWorld({ venueIdx: vi, role: auto ? 'dodger' : role, rng, auto });
    state.pl = {
      id: state.plN, w, venueIdx: vi, role: w.role, auto, paused: false, over: false, frozen: false, dest: null, dragging: false, throwKind: 'fast',
      hint: null, hintT: 0, pre: null, leg: null, parts: [], pops: [], shake: 0, tick: 0, seen: 0, endT: 0, hints: 0,
    };
    state.result = null;
    state.scene = 'play'; state.sceneT = 0;
    env.monetization.track?.('match_start', { venue: VENUES[vi].id, role: w.role, auto });
  }
  const pausePlay = () => { const pl = state.pl; if (pl && !pl.over && pl.w.phase === 'play') pl.paused = true; };
  const resumePlay = () => { const pl = state.pl; if (pl) pl.paused = false; };

  const colFor = (p) => (p.orig === 0 ? PAL.sunLight : PAL.moonLight);
  function pop(pl, x, y, text, col) { pl.pops.push({ x, y, text, col, t: 0, life: 1 }); if (pl.pops.length > 8) pl.pops.shift(); }

  // sounds, sparks and pops for what the engine reported
  function handleEvents(pl) {
    const w = pl.w;
    for (const e of w.events) {
      if (e.n <= pl.seen) continue;
      pl.seen = e.n;
      const calm = state.prefs.calm;
      const p = e.p !== undefined && e.p !== null && e.p >= 0 ? w.ps[e.p] : null;
      if (e.kind === 'throw') tone({ freq: e.k === 'lob' ? 260 : 340, to: 150, dur: 0.14, type: 'triangle', vol: 0.1 });
      else if (e.kind === 'pass') tone({ freq: 420, to: 520, dur: 0.1, type: 'sine', vol: 0.08 });
      else if (e.kind === 'receive') tone({ freq: 560, dur: 0.06, type: 'sine', vol: 0.08 });
      else if (e.kind === 'pickup') tone({ freq: 640, to: 760, dur: 0.06, type: 'square', vol: 0.04 });
      else if (e.kind === 'stance') tone({ freq: 300, to: 420, dur: 0.1, type: 'sine', vol: 0.05 });
      else if (e.kind === 'hit') {
        tone({ freq: 150, to: 55, dur: 0.22, type: 'sawtooth', vol: 0.16 }); tone({ freq: 900, to: 300, dur: 0.07, type: 'square', vol: 0.06 });
        if (!calm) { burst(pl.parts, rng, e.x, e.y, 50, '#ffd23f', 1, 'star'); burst(pl.parts, rng, e.x, e.y, 14, '#ffffff', 0.7); pl.shake = Math.max(pl.shake, p && p.id === w.me ? 0.4 : 0.15); }
        pop(pl, e.x, e.y, 'BURNED!', p ? colFor(p) : '#fff');
      } else if (e.kind === 'catch') {
        tone({ freq: 392, dur: 0.1, type: 'triangle', vol: 0.14 }); tone({ freq: 587, dur: 0.12, type: 'triangle', vol: 0.14 }); tone({ freq: 784, dur: 0.22, type: 'triangle', vol: 0.12 });
        ringFx(pl.parts, e.x, e.y, '#ffffff', 20, 120, 0.5);
        if (!calm) burst(pl.parts, rng, e.x, e.y, 24, '#9be8ff', 0.8);
        pop(pl, e.x, e.y, 'CAUGHT!', PAL.gold);
      } else if (e.kind === 'burn') {
        pop(pl, e.x, e.y, 'BURNED!', p ? colFor(p) : '#fff');
        if (!calm) burst(pl.parts, rng, e.x, e.y, 30, '#ff9a4a', 0.9, 'star');
      } else if (e.kind === 'revive') {
        tone({ freq: 520, to: 780, dur: 0.18, type: 'sine', vol: 0.1 });
        if (!calm) burst(pl.parts, rng, e.x, e.y, 22, '#8dffb0', 0.7);
        pop(pl, e.x, e.y, 'BACK IN', '#8dffb0');
      } else if (e.kind === 'stun') pop(pl, e.x, e.y, 'DIZZY', '#cfdcff');
      else if (e.kind === 'clock') { tone({ freq: 220, to: 160, dur: 0.2, type: 'sawtooth', vol: 0.06 }); pop(pl, e.x, e.y, 'TOO SLOW', '#ff9a8a'); }
      else if (e.kind === 'thud' || e.kind === 'bounce') { if (state.t - lastBounceT > 0.12) { lastBounceT = state.t; tone({ freq: 95, to: 60, dur: 0.08, type: 'sine', vol: 0.05 }); } }
      else if (e.kind === 'end') {
        const won = e.how === 'won';
        tone({ freq: won ? 523 : 262, dur: 0.18, type: 'triangle', vol: 0.14 }); tone({ freq: won ? 659 : 220, dur: 0.18, type: 'triangle', vol: 0.12 }); tone({ freq: won ? 784 : 196, to: won ? 1046 : 150, dur: 0.4, type: 'triangle', vol: 0.12 });
      }
    }
  }

  function simStep(pl, ctl) {
    stepWorld(pl.w, 1 / 60, rng, ctl);
    handleEvents(pl);
    const w = pl.w;
    if (w.phase === 'over' && pl.endT === 0) {
      pl.endT = 0.0001;
      w.msg = w.done === 'won' ? (w.kind === 'ring' && w.role === 'dodger' ? 'Time! You held the circle' : 'Everyone is burned!') : w.done === 'draw' ? 'Time! A draw'
        : (w.kind === 'ring' && w.role === 'dodger' ? 'All dodgers are out' : 'You are out of players');
      w.msgT = 0;
    }
  }

  function finishRound(pl) {
    const w = pl.w;
    if (pl.auto) { pl.over = true; return; }
    const res = resultOf(w), v = VENUES[pl.venueIdx], key = `${v.id}:${w.kind === 'court' ? 'court' : w.role}`, old = state.best[key] ?? { stars: 0, score: 0, played: 0 };
    res.venueName = v.name; res.hints = pl.hints;
    res.newBest = res.won && res.score > old.score;
    state.best[key] = { stars: Math.max(old.stars, res.stars), score: Math.max(old.score, res.won ? res.score : 0), played: old.played + 1 };
    storage.set('best', state.best);
    env.monetization.track?.('match_end', { venue: v.id, role: w.role, won: res.won, score: res.score });
    state.result = res; state.scene = 'result'; state.sceneT = 0; pl.over = true; pl.paused = false;
  }

  function stepAnim(pl, dt) {
    stepParticles(pl.parts, dt);
    for (let i = pl.pops.length - 1; i >= 0; i--) { pl.pops[i].t += dt / pl.pops[i].life; if (pl.pops[i].t >= 1) pl.pops.splice(i, 1); }
    if (pl.shake > 0) pl.shake = Math.max(0, pl.shake - dt);
    if (pl.hintT > 0) pl.hintT = Math.max(0, pl.hintT - dt);
    if (pl.w.msg && pl.w.phase === 'over') pl.w.msgT += dt;
  }

  // ---- hint -------------------------------------------------------------------------------------------------------------------------------
  function useHint(pl) {
    const w = pl.w;
    if (pl.auto || w.phase !== 'play') return;
    pl.hint = planFor(w, w.ps[w.me], { coach: true });
    if (pl.hintT <= 0) pl.hints += 1;
    pl.hintT = 6;
  }

  // ---- human controls ----------------------------------------------------------------------------------------------------------------------
  function pickPlayer(w, cam, sx, sy, filter) {
    let best = null, bd = 1e9;
    for (const q of w.ps) {
      if (!filter(q)) continue;
      // the chest of the person on screen; the reach is generous (a thumb is wider than a player)
      const c = cam.P(q.x, q.y, (cam.gl ? 62 : 62) * q.tall), d = Math.hypot(sx - c.x, sy - c.y), r = (cam.gl ? 84 : 96) * q.tall * cam.u(q.x, q.y);
      if (d < r && d < bd) { bd = d; best = q; }
    }
    return best;
  }
  const camNow = (arena) => (glNow && glNow.on && glNow.kind === 'play' ? camFromGl(glNow, arena) : camFor(arena));
  const rimPoint = (x, y) => { const th = Math.atan2(y - CY, x - CX); return { x: CX + Math.cos(th) * RIM, y: CY + Math.sin(th) * RIM }; };

  function humanUpdate(pl, L, input) {
    const w = pl.w, P = L.play, me = w.ps[w.me], cam = camNow(P.arena);
    const p = input.pointer, keys = input.keys.pressed, down = input.keys.down;
    const tap = p.pressed ? { x: p.x, y: p.y } : null;
    const ctl = { mx: 0, my: 0 };
    const toggleKind = () => { pl.throwKind = pl.throwKind === 'fast' ? 'lob' : 'fast'; tone({ freq: 360, dur: 0.05, type: 'sine', vol: 0.07 }); };
    const foeOf = (q) => q.team !== me.team && q.st === 'in';
    const mateOf = (q) => q.team === me.team && q.id !== me.id && q.ball === null && q.stun <= 0 && !(w.kind === 'ring' && q.st === 'in');
    if (keys.has('KeyH')) useHint(pl);
    if (keys.has('KeyL')) toggleKind();
    if (keys.has('KeyC')) ctl.catch = true;
    if (keys.has('Space') && me.ball !== null) {
      const plan = planFor(w, me, { coach: true });
      const tg = plan.kind === 'throw' ? w.ps[plan.tid] : w.ps.filter(foeOf).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
      if (tg) ctl.throw = { tid: tg.id, kind: pl.throwKind, lead: 0.75, err: 0.02 };
    }
    if (tap) {
      if (inRect(P.hint, tap.x, tap.y)) useHint(pl);
      else if (inRect(P.btnA, tap.x, tap.y)) ctl.catch = true;
      else if (inRect(P.btnB, tap.x, tap.y)) toggleKind();
      else if (inRect(cam.rect, tap.x, tap.y)) {
        const { x: wx, y: wy } = cam.unproject(tap.x, tap.y);
        const canThrow = me.ball !== null && me.windT <= 0 && me.stun <= 0 && (w.kind === 'court' || me.team !== w.dodgerTeam);
        let handled = false;
        if (me.ball !== null && me.stun <= 0) {
          const foe = pickPlayer(w, cam, tap.x, tap.y, foeOf);
          const mate = foe ? null : pickPlayer(w, cam, tap.x, tap.y, mateOf);
          if (foe && canThrow) { ctl.throw = { tid: foe.id, kind: pl.throwKind, lead: 0.75, err: 0.02 }; handled = true; }
          else if (mate && canThrow) { ctl.pass = mate.id; handled = true; }
          else if (canThrow) {
            const inEnemyZone = w.kind === 'court' ? (me.team === 0 ? wy < CY - 10 : wy > CY + 10) && Math.hypot(wx - CX, wy - CY) < R + 20 : Math.hypot(wx - CX, wy - CY) < R && me.st === 'rim';
            if (inEnemyZone) { ctl.throw = { tid: null, tx: wx, ty: wy, kind: pl.throwKind, lead: 0, err: 0.02 }; handled = true; }
          }
        }
        if (!handled) {
          pl.dragging = true;
          pl.dest = me.st === 'rim' ? rimPoint(wx, wy) : { x: wx, y: wy };
        }
      }
    }
    if (pl.dragging && p.down && inRect(cam.rect, p.x, p.y) && !tap) {
      const { x: wx, y: wy } = cam.unproject(p.x, p.y);
      pl.dest = me.st === 'rim' ? rimPoint(wx, wy) : { x: wx, y: wy };
    }
    if (p.released) pl.dragging = false;
    // keyboard steering
    const kx = (down.has('ArrowRight') || down.has('KeyD') ? 1 : 0) - (down.has('ArrowLeft') || down.has('KeyA') ? 1 : 0);
    const ky = (down.has('ArrowDown') || down.has('KeyS') ? 1 : 0) - (down.has('ArrowUp') || down.has('KeyW') ? 1 : 0);
    if (kx || ky) { const m = Math.hypot(kx, ky); ctl.mx = kx / m; ctl.my = ky / m; pl.dest = null; }
    else if (pl.dest) {
      const dx = pl.dest.x - me.x, dy = pl.dest.y - me.y, d = Math.hypot(dx, dy);
      if (d < 12) pl.dest = null; else { ctl.mx = dx / d; ctl.my = dy / d; }
    }
    simStep(pl, ctl);
  }

  // ---- Watch and Learn --------------------------------------------------------------------------------------------------------------------
  const QUIET = new Set(['weave', 'rim', 'hold', 'juke']);
  function legMax(plan) {
    switch (plan.kind) {
      case 'throw': return 1.5;
      case 'pass': return 0.9;
      case 'catch': return 0.9;
      case 'dodge': return 0.8;
      case 'fetch': return 2.6;
      default: return 2.2;
    }
  }
  function autoUpdate(pl, dt) {
    const w = pl.w, me = w.ps[w.me];
    if (pl.pre) {
      pl.pre.t += dt;
      if (pl.pre.kind === 'think' && pl.pre.t >= pl.pre.dur) pl.pre = { ...pl.pre, kind: 'reveal', t: 0, dur: REVEAL_SECONDS };
      else if (pl.pre.kind === 'reveal' && pl.pre.t >= pl.pre.dur) { const plan = pl.pre.plan; pl.pre = null; pl.leg = { plan, t: 0, tick: 0, max: legMax(plan) }; }
      return;
    }
    if (pl.leg) {
      const lg = pl.leg; lg.tick += 1;
      if (lg.tick % 6 === 0) {
        const np = planFor(w, me, { coach: true });
        if ((np.kind === 'catch' || np.kind === 'dodge') && lg.plan.kind !== np.kind) lg.plan = np;
      }
      simStep(pl, autoControl(w, lg.plan));
      lg.t += dt;
      const k = lg.plan.kind;
      if (lg.t >= lg.max || (k === 'throw' && me.ball === null && lg.t > 0.5) || (k === 'fetch' && me.ball !== null) || (k === 'pass' && me.ball === null && lg.t > 0.3)) pl.leg = null;
      return;
    }
    const plan = planFor(w, me, { coach: true });
    if (QUIET.has(plan.kind)) { pl.leg = { plan, t: 0, tick: 0, max: legMax(plan) }; return; }
    pl.pre = { kind: 'think', t: 0, dur: thinkTime(), plan };
  }

  // ---- per-tick play update ---------------------------------------------------------------------------------------------------------------
  function updatePlay(dt, input) {
    const pl = state.pl, L = lay(), P = L.play, p = input.pointer, keys = input.keys.pressed;
    const tap = p.pressed ? { x: p.x, y: p.y } : null;
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    if (keys.has('Escape') || keys.has('KeyP') || (tap && inRect(P.pause, tap.x, tap.y))) { pausePlay(); if (pl.paused) return; }
    stepAnim(pl, dt);
    if (pl.frozen) return;
    pl.tick += 1;
    const w = pl.w;
    if (w.phase === 'over') {
      pl.endT += dt;
      if (pl.endT > END_BEAT) { if (pl.auto) pl.over = true; else finishRound(pl); }
      return;
    }
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
      else if (it === 'restart') startPlay(pl.venueIdx, state.roleSel, false);
      else if (it === 'again') startPlay(AUTO_VENUE, 'dodger', true);
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
      const mon = env.monetization;
      if (state.owned || state.restoreBusy || state.demo || !mon?.restore) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
      Promise.resolve(mon.restore()).then(() => {
        state.owned = !!mon.owns('unlock_game');
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
    else if (hit(T.auto)) startPlay(AUTO_VENUE, 'dodger', true);
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
    if (inRect(G.modes[0], tap.x, tap.y)) state.roleSel = 'dodger';
    else if (inRect(G.modes[1], tap.x, tap.y)) state.roleSel = 'ring';
    G.cards.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) startPlay(i, state.roleSel, false); });
  }
  function updateResult(tap) {
    if (!tap) return;
    const Rr = lay().result;
    if (inRect(Rr.again, tap.x, tap.y)) startPlay(state.sel, state.roleSel, false);
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
      if (sc === 'title') { stepTitle(dt); updateTitle(tap); }
      else if (sc === 'venues') updateVenues(tap, input);
      else if (sc === 'play') updatePlay(dt, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) {
      ctx.clearRect(0, 0, view?.width ?? meta.width, view?.height ?? meta.height);   // the 3D court shows through where nothing is painted
      glNow = view?.gl ?? null;
      if (!state.titleWorld) newTitleWorld();
      render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, { pauseItems });
    },
    getState: () => state,
    autoPause() { if (state.scene === 'play') pausePlay(); },
    // Everything except a real match in progress is free: menus, Rules, Watch and Learn, results, pause.
    isPreviewExempt() {
      const pl = state.pl;
      return !(state.scene === 'play' && pl && !pl.auto && !pl.paused && !pl.over && pl.w.phase === 'play');
    },
    // Tester tools (?dev=1 and ?shot=1): jump to a screen and fast-forward with the coach playing.
    dev: {
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.sel !== undefined) state.sel = o.sel;
        if (o.role) state.roleSel = o.role;
        const sc = o.scene ?? 'title';
        if (sc === 'play') {
          startPlay(state.sel, state.roleSel, !!o.auto);
          const pl = state.pl;
          if (!pl) return;
          if (o.advance) fastForward(pl, Math.round(o.advance * 60), null);
          if (o.until) {
            // run on (coach plays) until the next event of that kind, then a few more ticks: for looking at a throw or a hit
            let n = 0, last = pl.w.evN;
            for (let i = 0; i < 60 * 300 && pl.w.phase === 'play'; i++) {
              simStep(pl, null); stepAnim(pl, 1 / 60);
              const hit = pl.w.events.some((e) => e.n > last && e.kind === o.until);
              if (hit) { n += 1; last = pl.w.evN; if (n >= (o.nth ?? 1)) break; }
              last = Math.max(last, pl.w.evN) === pl.w.evN && !hit ? last : last;
            }
            for (let i = 0; i < (o.after ?? 0) && pl.w.phase === 'play'; i++) { simStep(pl, null); stepAnim(pl, 1 / 60); }
          }
          if (o.hint) useHint(pl);
          if (o.think && pl.auto) {
            for (let i = 0; i < 600 && !pl.pre; i++) api.update(1 / 60, IDLE);
            if (pl.pre && o.think === 'reveal') pl.pre = { ...pl.pre, kind: 'reveal', t: 0.2, dur: REVEAL_SECONDS };
            else if (pl.pre) pl.pre.t = Math.min(2.5, pl.pre.dur - 0.5);
          }
          if (o.think) { pl.pops.length = 0; pl.w.msg = null; }
          pl.frozen = !!o.hold;
          if (o.pause) pausePlay();
        } else if (sc === 'result') {
          startPlay(state.sel, state.roleSel, false); const pl = state.pl;
          fastForward(pl, 60 * 600, () => pl.w.phase === 'over');
          finishRound(pl);
        } else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else { state.scene = sc; state.sceneT = 0; }
      },
    },
  };
  // The coach plays the human's player (used by the dev jump and the scenario tests).
  function fastForward(pl, maxTicks, stop) {
    for (let i = 0; i < maxTicks && pl.w.phase === 'play'; i++) {
      if (stop && stop()) return;
      if (pl.auto) { api.update(1 / 60, IDLE); continue; }
      simStep(pl, null);
      stepAnim(pl, 1 / 60);
    }
  }
  return api;
}
