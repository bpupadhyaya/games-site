// Morra: state and flow. Drawing is in view.js / playview.js / docview.js; the rules and the rivals are in engine.js.
//
// Time model: every timer is the sum of the dt values handed to update() (deterministic, pausable).
// A round: pick (choose throw + call; Watch and Learn: think then reveal) -> count (uno, due, tre) -> show (hands open, verdict) -> next.
import {
  RIVALS, TARGETS, DEFAULT_TARGET, AUTO_TARGET, THINK_TIMES, REVEAL_SECONDS, COUNT_BEATS, BEAT_SECONDS, SHOW_SECONDS,
  judge, legalCall, rivalChoose, coach, newMem, record, tellOf, tellsOf,
} from './engine.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects } from './layout.js';
import { burst, stepParticles } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { RULES } from './content.js';
import { handGeom } from './playview.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const DEMO_DUELS = 3;
const COUNT_TOTAL = COUNT_BEATS * BEAT_SECONDS + 0.2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const IDLE = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
const CALL_KEYS = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'];

export function createGame(env) {
  const { rng, storage, config, audio } = env;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title',
    prefs: { sound: true, words: true, targetIdx: 1, thinkIdx: 1, calm: false, hand: 0, textIdx: 0 },
    best: {}, life: { throws: [0, 0, 0, 0, 0, 0], guesses: [0, 0, 0, 0, 0, 0], rounds: 0 }, demoRuns: 0, pl: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    restoreMsg: '', restoreBusy: false, owned: false, toast: null, dev: config.dev === true, demo: config.demo === true,
  };
  let lastScene = state.scene, drag = null;

  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); state.prefs.textIdx = clamp(state.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); applyPrefs(); } });
  storage.get('best', null).then((v) => { if (v) state.best = v; });
  storage.get('life', null).then((v) => { if (v && Array.isArray(v.throws)) state.life = v; });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const mon = env.monetization;
  state.owned = !!mon?.owns?.('unlock_game');
  mon?.onChange?.(() => { state.owned = !!mon.owns('unlock_game'); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();

  const lay = () => layoutFor(meta.width, meta.height);
  const go = (scene) => { state.scene = scene; if (scene !== 'play' && scene !== 'result') state.pl = null; };
  const say = (text, hold = 2.2) => { state.toast = { text, t: 0, hold }; };
  const tone = (o) => { if (state.prefs.sound) audio.tone(o); };
  const target = () => TARGETS[clamp(state.prefs.targetIdx, 0, TARGETS.length - 1)];

  // ---- a duel ------------------------------------------------------------------------------------------------------------------------------
  function newDuel(mode, rivalIdx) {
    const rival = RIVALS[rivalIdx];
    const pl = {
      mode, rivalIdx, rival: rival.id, target: mode === 'auto' ? AUTO_TARGET : target(), mem: newMem(), score: { you: 0, rival: 0 },
      round: 0, phase: 'pick', phaseT: 0, pick: { throw: null, call: null }, ai: { throw: 0, call: 0 }, res: null,
      pre: null, coachWhy: '', hint: null, hintT: 0, hints: 0, tell: null, rounds: [],
      paused: false, over: false, frozen: false, cheat: false, parts: [], shake: 0, beatDone: -1, winner: null,
    };
    startRound(pl);
    return pl;
  }

  function startRound(pl) {
    pl.round += 1; pl.phase = 'pick'; pl.phaseT = 0; pl.pick = { throw: null, call: null }; pl.res = null; pl.hint = null; pl.hintT = 0; pl.beatDone = -1; pl.tell = null;
    const rival = RIVALS[pl.rivalIdx];
    pl.ai = rivalChoose(rival, pl.mem, rng, pl.mode === 'play' ? state.life : null);
    if (pl.mode === 'auto' || pl.cheat) {
      const c = coach(rival, pl.mem, rng);
      pl.coach = { throw: c.throw, call: c.call }; pl.coachWhy = c.why;
      pl.hintTop = c.top;
    }
    pl.pre = pl.mode === 'auto' ? { kind: 'think', t: 0, dur: THINK_TIMES[state.prefs.thinkIdx] } : null;
  }

  function startPlay(mode, idx = state.sel) {
    if (config.demo && mode !== 'auto' && (idx > 0 || state.demoRuns >= DEMO_DUELS)) { go('demo-limit'); return; }
    if (config.demo && mode !== 'auto') { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    state.sel = idx;
    state.pl = newDuel(mode, idx); state.result = null;
    state.scene = 'play'; state.sceneT = 0;
    env.monetization.track?.('duel_start', { rival: RIVALS[idx].id, mode });
  }
  const pausePlay = () => { const pl = state.pl; if (pl && !pl.over) pl.paused = true; };
  const resumePlay = () => { const pl = state.pl; if (pl) pl.paused = false; };

  function commit(pl) {
    pl.phase = 'count'; pl.phaseT = 0; pl.beatDone = -1; pl.hint = null; pl.hintT = 0;
    tone({ freq: 220, to: 160, dur: 0.08, type: 'triangle', vol: 0.1 });
  }

  function reveal(pl, G) {
    const rival = RIVALS[pl.rivalIdx];
    const pThrow = pl.pick.throw, pCall = pl.pick.call;
    const res = judge(pThrow, pCall, pl.ai.throw, pl.ai.call);
    res.pThrow = pThrow; res.pCall = pCall; res.oThrow = pl.ai.throw; res.oCall = pl.ai.call;
    pl.res = res; pl.phase = 'show'; pl.phaseT = 0;
    record(pl.mem, pThrow, pCall, pl.ai.throw, pl.ai.call);
    if (res.who === 'you') pl.score.you += 1; else if (res.who === 'rival') pl.score.rival += 1;
    pl.rounds.push({ p: pThrow, o: pl.ai.throw, who: res.who });
    pl.tell = tellOf(pl.mem, rival, res);
    if (pl.mode === 'play') {
      state.life.throws[pThrow] += 1; state.life.guesses[clamp(pCall - pThrow, 0, 5)] += 1; state.life.rounds += 1;
      storage.set('life', state.life);
    }
    // the sound and the sparks of the reveal
    tone({ freq: 660, dur: 0.12, type: 'triangle', vol: 0.12 });
    if (res.who === 'you') {
      tone({ freq: 523, dur: 0.14, type: 'triangle', vol: 0.12 }); tone({ freq: 784, to: 988, dur: 0.3, type: 'sine', vol: 0.12 });
      if (!state.prefs.calm) { const gm = G ?? handGeom(lay().play.stage); burst(pl.parts, rng, gm.cx, (gm.tipR + gm.tipY) / 2, 26, '#ffd45a', 1); }
    } else if (res.who === 'rival') {
      tone({ freq: 330, to: 200, dur: 0.3, type: 'sawtooth', vol: 0.07 });
      pl.shake = state.prefs.calm ? 0 : 0.3;
    } else tone({ freq: 440, dur: 0.06, type: 'sine', vol: 0.06 });
  }

  function endOfShow(pl) {
    if (pl.score.you >= pl.target || pl.score.rival >= pl.target) {
      pl.winner = pl.score.you >= pl.target ? 'you' : 'rival';
      if (pl.mode === 'auto') { pl.over = true; return; }
      finishDuel(pl);
    } else startRound(pl);
  }

  function finishDuel(pl) {
    const rival = RIVALS[pl.rivalIdx], tells = tellsOf(pl.mem), id = rival.id, old = state.best[id] ?? { wins: 0, played: 0 };
    const freq = (arr) => [0, 1, 2, 3, 4, 5].map((i) => arr.filter((v) => v === i).length);
    const res = {
      winner: pl.winner, you: pl.score.you, rival: pl.score.rival, rounds: pl.rounds.length, rivalId: id, rivalName: rival.name,
      freqYou: freq(pl.mem.pt), freqRival: freq(pl.mem.ot), lines: tells.lines.length ? tells.lines : ['Play a few more rounds and the table will tell you what it notices.'],
      hints: pl.hints, newBest: false,
    };
    if (pl.winner === 'you') { res.newBest = !old.wins; }
    state.best[id] = { wins: old.wins + (pl.winner === 'you' ? 1 : 0), played: old.played + 1 };
    storage.set('best', state.best);
    env.monetization.track?.('duel_end', { rival: id, winner: pl.winner });
    state.result = res; state.scene = 'result'; state.sceneT = 0; pl.over = true; pl.paused = false;
  }

  function stepAnim(pl, dt) {
    stepParticles(pl.parts, dt);
    if (pl.shake > 0) pl.shake = Math.max(0, pl.shake - dt);
    if (pl.hintT > 0) pl.hintT = Math.max(0, pl.hintT - dt);
  }

  // ---- per-tick play update ---------------------------------------------------------------------------------------------------------------
  function updatePlay(dt, input) {
    const pl = state.pl, L = lay().play, p = input.pointer, keys = input.keys.pressed;
    const tap = p.pressed ? { x: p.x, y: p.y } : null;
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    if (keys.has('Escape') || (tap && inRect(L.pause, tap.x, tap.y))) { pausePlay(); return; }
    if (pl.frozen) { stepAnim(pl, dt); return; }
    stepAnim(pl, dt);
    pl.phaseT += dt;
    if (pl.phase === 'pick') {
      if (pl.mode === 'play' && !pl.cheat) pickInput(pl, L, tap, keys);
      else autoPick(pl, dt);
    } else if (pl.phase === 'count') {
      const beat = Math.min(COUNT_BEATS - 1, Math.floor(pl.phaseT / BEAT_SECONDS));
      while (pl.beatDone < beat) { pl.beatDone += 1; tone({ freq: 150 - pl.beatDone * 10, to: 80, dur: 0.12, type: 'triangle', vol: 0.18 }); }
      if (pl.phaseT >= COUNT_TOTAL) reveal(pl);
    } else if (pl.phase === 'show') {
      const skip = (tap && inRect(L.go, tap.x, tap.y)) || keys.has('Space') || keys.has('Enter');
      if (pl.phaseT >= SHOW_SECONDS || (skip && pl.phaseT > 0.45)) endOfShow(pl);
    }
  }

  function setThrow(pl, o) {
    pl.pick.throw = o;
    if (pl.pick.call !== null && !legalCall(o, pl.pick.call)) pl.pick.call = null;
    tone({ freq: 440 + o * 60, dur: 0.05, type: 'sine', vol: 0.08 });
  }
  function setCall(pl, c) {
    if (pl.pick.throw === null || !legalCall(pl.pick.throw, c)) return;
    pl.pick.call = c; tone({ freq: 360 + c * 40, dur: 0.05, type: 'triangle', vol: 0.08 });
  }
  function useHint(pl) {
    const c = coach(RIVALS[pl.rivalIdx], pl.mem, rng, state.life);
    pl.hint = c; pl.hintT = 7; pl.hints += 1;
  }
  function pickInput(pl, L, tap, keys) {
    for (let i = 0; i <= 5; i++) if (keys.has(`Digit${i}`) || keys.has(`Numpad${i}`)) setThrow(pl, i);
    CALL_KEYS.forEach((k, i) => { if (keys.has(k)) setCall(pl, i); });
    if (keys.has('Minus') || keys.has('NumpadSubtract')) setCall(pl, 10);
    if (keys.has('KeyH')) useHint(pl);
    if (tap) {
      if (inRect(L.hint, tap.x, tap.y)) useHint(pl);
      L.throws.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) setThrow(pl, i); });
      L.calls.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) setCall(pl, i); });
    }
    const ready = pl.pick.throw !== null && pl.pick.call !== null;
    if (ready && ((tap && inRect(L.go, tap.x, tap.y)) || keys.has('Enter') || keys.has('Space'))) commit(pl);
  }
  // Watch and Learn (and the dev/test player): the coach thinks, shows its choice for 2 s with the reason, then throws.
  function autoPick(pl, dt) {
    if (pl.mode === 'auto' && pl.pre) {
      pl.pre.t += dt;
      if (pl.pre.kind === 'think' && pl.pre.t >= pl.pre.dur) {
        pl.pre = { kind: 'reveal', t: 0, dur: REVEAL_SECONDS };
        pl.pick = { throw: pl.coach.throw, call: pl.coach.call };
      } else if (pl.pre.kind === 'reveal' && pl.pre.t >= pl.pre.dur) { pl.pre = null; commit(pl); }
    } else if (pl.cheat) {
      pl.pick = { throw: pl.coach.throw, call: pl.coach.call }; commit(pl);
    }
  }

  function pauseItems(pl) {
    return pl.over ? ['again', 'next', 'exit'] : pl.mode === 'auto' ? ['resume', 'think', 'quit'] : ['resume', 'restart', 'quit'];
  }
  function updatePauseMenu(tap, input) {
    const pl = state.pl, items = pauseItems(pl), M = menuRects(lay(), items.length);
    if (input.keys.pressed.has('Escape') && !pl.over) { resumePlay(); return; }
    if (!tap) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tap.x, tap.y)) return;
      if (it === 'resume') resumePlay();
      else if (it === 'restart') startPlay(pl.mode, state.sel);
      else if (it === 'again') startPlay('auto', state.sel);
      else if (it === 'think') { state.prefs.thinkIdx = (state.prefs.thinkIdx + 1) % THINK_TIMES.length; savePrefs(); say(`Think time ${THINK_TIMES[state.prefs.thinkIdx]} s`); }
      else if (it === 'next') { state.sel = (state.sel + 1) % RIVALS.length; startPlay('auto', state.sel); }
      else go('title');
    });
  }

  // ---- menus and documents ---------------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs, cyc = (v, n) => (v + 1) % n;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'words') p.words = !p.words;
    else if (id === 'target') p.targetIdx = cyc(p.targetIdx, TARGETS.length);
    else if (id === 'think') p.thinkIdx = cyc(p.thinkIdx, THINK_TIMES.length);
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'hand') p.hand = cyc(p.hand ?? 0, 4);
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') { restorePurchase(); return; }
    savePrefs();
  }
  function restorePurchase() {
    if (state.restoreBusy || state.owned || !mon) return;
    state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
    Promise.resolve(mon.restore()).then(() => {
      state.owned = mon.owns('unlock_game');
      state.restoreMsg = state.owned ? 'Purchase restored' : 'No earlier purchase found';
    }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
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
    if (hit(T.play)) go('rivals');
    else if (hit(T.auto)) startPlay('auto', state.sel);
    else if (hit(T.how)) openDoc('howto', 'title');
    else if (hit(T.rules)) openDoc('rules', 'title');
    else if (hit(T.about)) openDoc('about', 'title');
    else if (hit(T.settings)) openDoc('settings', 'title');
    else if (tap.y > T.credit.y - 90 && Math.abs(tap.x - T.credit.x) < 190) env.openArcforgeHome?.();
  }
  function updateRivals(tap) {
    if (!tap) return;
    const G = lay().rivals;
    if (inRect(G.back, tap.x, tap.y)) { go('title'); return; }
    G.cards.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) startPlay('play', i); });
  }
  function updateResult(tap) {
    if (!tap) return;
    const Rr = lay().result;
    if (inRect(Rr.again, tap.x, tap.y)) startPlay('play', state.sel);
    else if (inRect(Rr.rivals, tap.x, tap.y)) go('rivals');
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
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'rivals') updateRivals(tap);
      else if (sc === 'play') updatePlay(dt, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, { pauseItems }); },
    getState: () => state,
    autoPause() { if (state.scene === 'play') pausePlay(); },
    // Everything except a real duel is free: menus, Rules, Watch and Learn, results, pause.
    isPreviewExempt() {
      const pl = state.pl;
      return !(state.scene === 'play' && pl && pl.mode !== 'auto' && !pl.paused && !pl.over);
    },
    // Tester tools (?dev=1 and ?shot=1): jump to a screen and fast-forward with the coach playing your side.
    dev: {
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.sel !== undefined) state.sel = o.sel;
        const sc = o.scene ?? 'title';
        if (sc === 'play') {
          startPlay(o.mode ?? 'play', state.sel);
          const pl = state.pl;
          if (!pl) return;
          if (o.rounds) {
            pl.cheat = true; startRoundCheat(pl);
            for (let i = 0; i < 60 * 900 && state.scene === 'play' && !(pl.round > o.rounds); i++) api.update(1 / 60, IDLE);
            pl.cheat = false;
          }
          if (state.scene !== 'play') return;
          if (o.throw !== undefined) setThrow(pl, o.throw);
          if (o.call !== undefined) setCall(pl, o.call);
          if (o.phase === 'count') { if (pl.pick.throw === null) { pl.pick = { throw: pl.coach?.throw ?? 2, call: pl.coach?.call ?? 5 }; } commit(pl); pl.phaseT = o.at ?? 0.8; pl.frozen = !!o.hold; }
          else if (o.phase === 'show') {
            if (pl.pick.throw === null) pl.pick = { throw: o.p ?? 3, call: o.c ?? 7 };
            if (o.o !== undefined) { pl.ai = { throw: o.o, call: o.oc ?? o.o + 2 }; }
            commit(pl); reveal(pl, null); pl.phaseT = o.at ?? 1.0; pl.frozen = !!o.hold;
          } else if (o.hint) useHint(pl);
          if (o.advance) for (let i = 0; i < o.advance * 60; i++) api.update(1 / 60, IDLE);
          if (o.pause) pausePlay();
        } else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startPlay('play', state.sel); state.pl.cheat = true; startRoundCheat(state.pl);
          for (let i = 0; i < 60 * 1200 && state.scene === 'play'; i++) api.update(1 / 60, IDLE);
        } else { state.scene = sc; state.sceneT = 0; }
      },
    },
  };
  // the dev/test coach needs its choice for the round already in progress
  function startRoundCheat(pl) {
    const c = coach(RIVALS[pl.rivalIdx], pl.mem, rng);
    pl.coach = { throw: c.throw, call: c.call }; pl.coachWhy = c.why;
  }
  return api;
}
