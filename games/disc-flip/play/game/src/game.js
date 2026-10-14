// Disc-flip: state and flow. The engine is sim.js, the match rules match.js, the rivals ai.js, the stage theater.js,
// drawing view.js and menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, record, play (also Watch & Learn), result, howto/about/rules, demolimit.
// A turn: take one of your free winks (tap or just start pulling near it), choose a squidger, pull back like a catapult and let
// go. The wink hops and lands with a spread; the steadiness ring shrinks it if you release on the gold mark.
import {
  POT, SQUIDGERS, clamp, dist, freeWinks, getWink, hopDistance, powerFor, shotOdds, spread, effSpread, makeMat, takeShot,
} from './sim.js';
import { newMatch, playShot, settle } from './match.js';
import { PROFILES, planShot, wobble, describe } from './ai.js';
import { inRect, TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, toWorld, toScreen, vecToWorld, matBox, lens } from './layout.js';
import { renderPlay, layoutOf, nameOf, steadiness } from './view.js';
import {
  renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderRecord,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, setupPinRects, lockupZone,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';
import { newTheater, beginAct, stepTheater, ringFx, sparkFx, dustFx, popText } from './theater.js';

export { meta };
const DEMO_MATCH_CAP = 2;
const PULL_MIN = 14;      // world units of pull before a drag counts as a shot
const PULL_MAX = 170;
const PICK_R = 46;        // how close a press must be to one of your winks to take it

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, textIdx: 0, thinkIdx: 1, steady: true },
    record: { wins: [0, 0, 0, 0], played: 0, streak: 0, best: 0, demoMatches: 0, pots: 0, squops: 0, bombs: 0, topPots: 0 },
    setup: { mode: 'ai', opp: 0, len: 'quick' }, setupMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0,
    att: null, th: null, m: null, act: null,
    aim: { id: -1, sq: 1, angle: -Math.PI / 2, power: 0.5, ph: 0, holding: false }, showAim: false, preview: null, hint: null, hintBusy: false,
    toast: '', toastT: 0, humanTurn: false, think: null, restoreMsg: '', endT: -1, drag: null, passedMsg: '',
  };
  let previewKey = '';

  // ---- persistence ---------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 4) state.record.wins = [0, 0, 0, 0];
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ---------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    press: () => { tone({ freq: 900, to: 400, dur: 0.05, type: 'square', vol: 0.06 }); tone({ freq: 220, to: 120, dur: 0.1, type: 'triangle', vol: 0.06 }); },
    hop: (p = 0.5) => tone({ freq: 380 + 200 * p, to: 760 + 300 * p, dur: 0.25, type: 'sine', vol: 0.05 }),
    land: () => tone({ freq: 520, to: 330, dur: 0.09, type: 'triangle', vol: 0.08 }),
    squop: () => { tone({ freq: 170, to: 90, dur: 0.16, type: 'square', vol: 0.1 }); tone({ freq: 1500, to: 700, dur: 0.05, type: 'triangle', vol: 0.05 }); },
    pot: () => { tone({ freq: 700, to: 300, dur: 0.18, type: 'sine', vol: 0.1 }); tone({ freq: 1250, dur: 0.14, type: 'triangle', vol: 0.06 }); tone({ freq: 180, to: 90, dur: 0.22, type: 'sine', vol: 0.1 }); },
    bonus: () => [0, 4, 7].forEach((n, i) => tone({ freq: 660 * Math.pow(2, n / 12), dur: 0.14 + i * 0.03, type: 'triangle', vol: 0.07 })),
    bomb: () => { tone({ freq: 220, to: 50, dur: 0.5, type: 'sawtooth', vol: 0.12 }); tone({ freq: 90, dur: 0.4, type: 'square', vol: 0.08 }); },
    off: () => tone({ freq: 260, to: 140, dur: 0.3, type: 'triangle', vol: 0.07 }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    win: () => [0, 2, 4, 7, 9].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- the attract mat behind the menus -------------------------------------------------------
  const startAttract = () => {
    state.att = { ...newTheater(makeMat(5)), wait: 1.4, n: 0 };
  };
  const stepAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    stepTheater(a, dt, {
      land: (res) => {
        if (res.kind === 'pot') { a.cupGlow = 1; ringFx(a, POT.x, POT.y, 90, '#ffe9a0', 0.6); sparkFx(a, fx, POT.x, POT.y, 8); }
        else dustFx(a, fx, res.final.x, res.final.y, 5);
      },
    });
    if (a.act) return;
    a.wait -= dt;
    if (a.wait > 0) return;
    a.wait = 1.1 + fx.next() * 0.8;
    const left = a.mat.winks.filter((w) => !w.pot);
    if (a.n > 22 || left.length < 4) { a.mat = makeMat(5); a.n = 0; return; }
    const side = a.n % 2;
    a.n++;
    const prof = PROFILES[1];
    const plan = planShot(a.mat, side, prof, fx, { seed: a.n * 17 + 3, roundsLeft: 6 });
    if (!plan) return;
    const shot = wobble(plan, prof, fx);
    const snap = a.mat.winks.map((w) => ({ ...w }));
    const res = takeShot(a.mat, shot, fx);
    beginAct(a, side, shot, res, snap);
  };

  // ---- match flow ------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const isAI = (side) => mode() === 'watch' || (mode() === 'ai' && side === 1);
  const profOf = (side) => (mode() === 'watch' ? PROFILES[side === 0 ? state.m.cfg.watchA : state.m.cfg.opp] : PROFILES[state.m.cfg.opp]);

  const defaultAim = () => {
    const m = state.m, a = state.aim, side = m.turn;
    const free = freeWinks(m.mat, side);
    if (!free.length) { a.id = -1; return; }
    // the free wink nearest the cup, the smallest squidger that reaches it
    let best = free[0];
    for (const w of free) if (dist(w.x, w.y, POT.x, POT.y) < dist(best.x, best.y, POT.x, POT.y)) best = w;
    a.id = best.id;
    const d = dist(best.x, best.y, POT.x, POT.y);
    // a short shot with the Potter, a medium one with the Squidger; from far away a hop towards the cup, stopping short of it
    a.sq = d <= SQUIDGERS[0].range * 0.95 ? 0 : 1;
    a.angle = Math.atan2(POT.y - best.y, POT.x - best.x);
    a.power = powerFor(a.sq, d <= SQUIDGERS[a.sq].range * 0.95 ? d : Math.min(SQUIDGERS[a.sq].range, Math.max(60, d - 110)));
    a.ph = 0; a.holding = false;
    previewKey = '';
  };
  const beginTurn = () => {
    const m = state.m, side = m.turn;
    state.humanTurn = !isAI(side);
    state.hint = null; state.think = null; state.preview = null; state.hintBusy = false; state.drag = null;
    defaultAim();
    state.showAim = state.humanTurn;
    if (state.humanTurn) {
      toast(m.bonus ? 'Bonus shot: you potted a wink, shoot again' : mode() === 'two' ? `${nameOf(state, side)}: pull back from one of your winks` : 'Your shot: pull back from one of your winks and let go', 3);
      updatePreview();
    } else if (mode() !== 'watch') toast(`${nameOf(state, side)} is thinking…`, 1.8);
  };
  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoMatches >= DEMO_MATCH_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const m = newMatch({ mode: 'ai', opp: 0, len: 'quick', first: aiRng.int(2), watchA: 3, ...cfg }, rng);
    settle(m);
    state.m = m; state.th = newTheater(m.mat); state.act = null;
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.endT = -1;
    if (cfg.mode !== 'watch') {
      if (state.demo) state.record.demoMatches++;
      save();
    }
    beginTurn();
  };
  const startWatch = () => {
    const picks = [0, 1, 2, 3];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, len: 'quick' });
  };

  // ---- aiming ----------------------------------------------------------------------------------
  const hand = () => (state.aim.holding && state.settings.steady ? steadiness(state.aim.ph) : 1);
  function updatePreview() {
    const m = state.m, a = state.aim;
    const w = a.id >= 0 ? getWink(m.mat, a.id) : null;
    if (!w || w.pot) { state.preview = null; return; }
    const D = hopDistance(a.sq, a.power);
    const e = spread(D, effSpread(a.sq, hand()));
    const key = `${a.id}|${a.sq}|${a.angle.toFixed(3)}|${a.power.toFixed(3)}|${m.mat.winks.length}|${m.shots}`;
    let odds = state.preview ? state.preview.odds : { pot: 0, squop: 0, off: 0, bomb: 0 };
    if (key !== previewKey) { previewKey = key; odds = shotOdds(m.mat, { id: a.id, sq: a.sq, angle: a.angle, power: a.power, m: 1 }, 28, 11); }
    state.preview = { D, e, odds };
  }
  const selectWink = (id) => {
    const a = state.aim;
    if (a.id !== id) {
      a.id = id; state.hint = null;
      const w = getWink(state.m.mat, id), d = dist(w.x, w.y, POT.x, POT.y);
      a.angle = Math.atan2(POT.y - w.y, POT.x - w.x); a.power = powerFor(a.sq, Math.min(d, SQUIDGERS[a.sq].range)); previewKey = '';
      sfx.tick();
    }
    updatePreview();
  };
  const selectSquidger = (i) => {
    state.aim.sq = i; state.hint = null;
    const w = getWink(state.m.mat, state.aim.id);
    if (w) { const d = dist(w.x, w.y, POT.x, POT.y); state.aim.power = powerFor(i, Math.min(d, SQUIDGERS[i].range)); }
    previewKey = ''; updatePreview(); sfx.tick();
  };

  // ---- the act of a turn -----------------------------------------------------------------------
  const hooks = {
    press: (a) => { sfx.press(); sfx.hop(a.D / 560); },
    land: (res) => {
      const th = state.th, who = nameOf(state, res.side);
      const rec = state.record, human = mode() === 'ai' && res.side === 0;
      if (res.kind === 'pot') {
        sfx.pot(); th.cupGlow = 1; ringFx(th, POT.x, POT.y, 100, '#ffe9a0', 0.7); sparkFx(th, fx, POT.x, POT.y, 12, '#ffe08a', 170);
        popText(th, POT.x, POT.y - 20, 'Pot!', '#ffe08a', 40);
        toast(`${who} potted a wink${res.bonus ? ' and shoots again' : ''}`, 2.4);
        if (res.bonus) sfx.bonus();
        if (human) rec.pots++;
      } else if (res.kind === 'squop') {
        sfx.squop(); ringFx(th, res.final.x, res.final.y, 70, '#fff7da', 0.5); sparkFx(th, fx, res.final.x, res.final.y, 7, '#ffd35a');
        const rival = res.under.some((id) => getWink(th.mat, id)?.side !== res.side);
        popText(th, res.final.x, res.final.y - 20, 'Squop!', '#ffd35a', 34);
        toast(rival ? `${who} landed on a rival wink and froze it` : `${who} landed on one of its own winks`, 2.4);
        if (human) rec.squops++;
      } else if (res.kind === 'off') {
        sfx.off(); dustFx(th, fx, res.aim.x, res.aim.y, 6);
        popText(th, res.final.x, res.final.y - 10, 'Off the mat', '#ffb4a0', 28);
        toast(`${who}'s wink left the mat and was put back at the edge`, 2.4);
      } else if (res.kind === 'bomb') {
        sfx.bomb(); th.shake = 1; ringFx(th, res.final.x, res.final.y, 150, '#ffb89a', 0.7); ringFx(th, res.final.x, res.final.y, 90, '#fff7da', 0.5);
        sparkFx(th, fx, res.final.x, res.final.y, 14, '#ff9b7a', 220);
        popText(th, res.final.x, res.final.y - 20, 'Blast!', '#ff9b7a', 38);
        toast(`${who} blasted a pile apart`, 2.6);
        if (human) rec.bombs++;
      } else {
        sfx.land(); dustFx(th, fx, res.final.x, res.final.y, 5);
      }
    },
    scatterLand: (s) => {
      const th = state.th;
      if (s.kind === 'pot') { sfx.pot(); th.cupGlow = 1; ringFx(th, POT.x, POT.y, 90, '#ffe9a0', 0.6); popText(th, POT.x, POT.y - 20, 'Pot!', '#ffe08a', 34); }
      else if (s.kind === 'squop') sfx.squop();
      else sfx.land();
    },
  };
  const startAct = (side, shot) => {
    const m = state.m;
    const snap = m.mat.winks.map((w) => ({ ...w }));
    const passesBefore = m.passes[0] + m.passes[1];
    const res = playShot(m, shot, rng);
    state.passedMsg = m.passes[0] + m.passes[1] > passesBefore ? `${nameOf(state, 1 - side)} had no free wink and passed` : '';
    beginAct(state.th, side, shot, res, snap);
    state.act = state.th.act;
    state.humanTurn = false; state.showAim = false; state.hint = null; state.preview = null; state.think = null; state.drag = null;
    state.aim.holding = false; state.hintBusy = false;
    state.toastT = Math.min(state.toastT, 0.2);
  };
  const finishMatch = () => {
    const m = state.m, o = m.over;
    state.endT = 0; state.humanTurn = false; state.showAim = false;
    if (m.cfg.mode === 'watch') return;
    if (m.cfg.mode === 'ai') {
      const r = state.record;
      r.played++;
      if (o.win === 0) { r.wins[m.cfg.opp]++; r.streak++; r.best = Math.max(r.best, r.streak); sfx.win(); } else r.streak = 0;
      r.topPots = Math.max(r.topPots | 0, m.mat.potted[0]);
    }
    save();
  };
  const afterAct = () => {
    state.act = null;
    if (state.m.over) finishMatch(); else beginTurn();
    if (state.passedMsg && !state.m.over) toast(state.passedMsg, 2.8);
  };

  // ---- AI turn ---------------------------------------------------------------------------------
  const updateAI = (dt) => {
    const m = state.m;
    if (state.act || m.over || !isAI(m.turn) || state.paused) return;
    const prof = profOf(m.turn), watch = mode() === 'watch', side = m.turn;
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      const plan = planShot(m.mat, side, prof, aiRng, { seed: m.shots * 7 + 5, roundsLeft: m.left[side] });
      state.think = { t: 0, dur, phase: 'think', plan };
      if (watch) toast(`${nameOf(state, side)} is thinking…`, dur);
    }
    const th = state.think;
    th.t += dt;
    if (th.phase === 'think' && th.t >= th.dur) {
      if (!th.plan) { m.left[side] = Math.max(0, m.left[side] - 1); m.turn = 1 - side; settle(m); beginTurn(); return; }
      th.shot = wobble(th.plan, prof, aiRng);
      state.aim.id = th.plan.id; state.aim.sq = th.plan.sq; state.aim.angle = th.plan.angle; state.aim.power = th.plan.power; state.aim.holding = false;
      previewKey = ''; updatePreview(); state.showAim = true;
      th.phase = watch ? 'reveal' : 'aim'; th.t = 0; th.dur = watch ? 2 : 0.7;
      if (watch) { state.hint = th.plan; toast(describe(th.plan, nameOf(state, side)), 2.1); }
    } else if ((th.phase === 'reveal' || th.phase === 'aim') && th.t >= th.dur) {
      startAct(side, th.shot);
    }
  };

  // ---- hint ------------------------------------------------------------------------------------
  const requestHint = () => {
    const m = state.m;
    if (state.act || !state.humanTurn) return;
    const plan = planShot(m.mat, m.turn, PROFILES[4], aiRng, { seed: m.shots * 13 + 1, roundsLeft: m.left[m.turn] });
    if (!plan) return;
    state.aim.id = plan.id; state.aim.sq = plan.sq; state.aim.angle = plan.angle; state.aim.power = plan.power; state.aim.holding = false;
    previewKey = ''; updatePreview();
    state.hint = plan;
    toast(`Hint: ${describe(plan, 'Try')}`, 4.5);
  };

  // ---- the play scene --------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const commit = (viaRing) => {
    const m = state.m, a = state.aim, side = m.turn;
    if (!state.humanTurn || state.act || state.paused || a.id < 0) return;
    const w = getWink(m.mat, a.id);
    if (!w || w.pot || w.side !== side) return;
    startAct(side, { id: a.id, sq: a.sq, angle: a.angle, power: a.power, m: viaRing ? steadiness(a.ph, state.settings.steady) : 1 });
  };

  const updatePlay = (dt, input) => {
    const { m } = state;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch';
    const L = layoutOf(state);
    if (config.dev && keys.pressed.has('KeyK')) { m.mat.potted = [5, 2]; m.over = { win: 0, a: 5, b: 2, tie: false }; state.th.act = null; state.act = null; finishMatch(); state.scene = 'result'; state.ui.scroll = 0; return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else state.paused = !state.paused; }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) {
        const d = state.ui.drag; state.ui.drag = null;
        if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      }
      return;
    }
    if (m.over && state.endT >= 0 && !state.act) {
      state.endT += dt;
      if (state.endT > 1.6 || (ptr.pressed && state.endT > 0.5)) { state.scene = 'result'; state.ui.scroll = 0; state.endT = -1; return; }
    }
    if (watch) {
      if (ptr.pressed) {
        const D = L.demo;
        if (inRect(D.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(D.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(D.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(D.exit, ptr.x, ptr.y)) { leaveMatch(); return; }
      }
    } else if (ptr.pressed && L.btns && inRect(L.btns.menu, ptr.x, ptr.y)) { openPause(); return; }

    if (state.humanTurn && !state.paused && !state.act && !m.over && !watch) {
      const side = m.turn, a = state.aim;
      if (ptr.pressed) {
        let used = false;
        L.sqBtns.forEach((r, i) => { if (!used && inRect(r, ptr.x, ptr.y)) { selectSquidger(i); used = true; } });
        if (!used && inRect(L.btns.hint, ptr.x, ptr.y)) { requestHint(); sfx.tick(); used = true; }
        if (!used && inRect(matBox(L, 40), ptr.x, ptr.y)) {
          const p = toWorld(L, ptr.x, ptr.y);
          let near = null, nd = PICK_R;
          for (const w of freeWinks(m.mat, side)) { const d = dist(w.x, w.y, p.x, p.y); if (d < nd) { nd = d; near = w; } }
          if (near) selectWink(near.id);
          state.drag = { x0: ptr.x, y0: ptr.y, len: 0 };
        }
      }
      if (state.drag) {
        const d = state.drag;
        if (ptr.down) {
          const v = lens.on ? ((p0, p1) => ({ x: p1.x - p0.x, y: p1.y - p0.y }))(toWorld(L, d.x0, d.y0), toWorld(L, ptr.x, ptr.y)) : vecToWorld(L, ptr.x - d.x0, ptr.y - d.y0), len = Math.hypot(v.x, v.y);
          d.len = len;
          if (len >= PULL_MIN && a.id >= 0) {
            a.holding = true; a.angle = Math.atan2(-v.y, -v.x); a.power = clamp((len - PULL_MIN) / PULL_MAX, 0.04, 1);
            state.hint = null; updatePreview();
          } else a.holding = false;
        }
        if (ptr.released || !ptr.down) {
          if (a.holding && d.len >= PULL_MIN) commit(true);
          a.holding = false; a.ph = 0; state.drag = null;
        }
      }
      if (a.holding) a.ph += dt / 1.6;
      // keyboard
      const k = keys.down;
      if (!state.drag) {
        let changed = false;
        if (k.has('ArrowLeft')) { a.angle -= 0.02; changed = true; }
        if (k.has('ArrowRight')) { a.angle += 0.02; changed = true; }
        if (k.has('ArrowUp')) { a.power = clamp(a.power + 0.01, 0.04, 1); changed = true; }
        if (k.has('ArrowDown')) { a.power = clamp(a.power - 0.01, 0.04, 1); changed = true; }
        if (changed) { state.hint = null; updatePreview(); }
        const fr = freeWinks(m.mat, side);
        if (fr.length && (keys.pressed.has('KeyQ') || keys.pressed.has('KeyE'))) {
          const i = Math.max(0, fr.findIndex((w) => w.id === a.id));
          selectWink(fr[(i + (keys.pressed.has('KeyE') ? 1 : fr.length - 1)) % fr.length].id);
        }
        if (keys.pressed.has('Digit1')) selectSquidger(0);
        if (keys.pressed.has('Digit2')) selectSquidger(1);
        if (keys.pressed.has('Digit3')) selectSquidger(2);
        if (keys.pressed.has('KeyH')) requestHint();
        if (keys.pressed.has('Space') || keys.pressed.has('Enter')) commit(false);
      }
    } else if (state.drag) { state.drag = null; state.aim.holding = false; }
    if (state.paused) return;
    updateAI(dt);
    const done = stepTheater(state.th, dt, hooks);
    if (done) afterAct();
    if (state.toastT > 0) state.toastT -= dt;
  };

  const leaveMatch = () => {
    state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.think = null; state.hintBusy = false;
    state.drag = null; state.act = null; if (state.th) state.th.act = null;
  };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'quit') leaveMatch();
  }

  // ---- menus -----------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag;
    const mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) {
      const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top));
      state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max);
    }
  }
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'play') { state.setup.mode = 'ai'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'two') { state.setup.mode = 'two'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'record') { state.scene = 'record'; state.ui.scroll = 0; }
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id === 'lenq') s.len = 'quick';
    else if (id === 'lenf') s.len = 'full';
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, len: s.len });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-steady') st.steady = !st.steady;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
    }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.m.cfg;
    if (id === 'again') startMatch({ ...cfg, first: aiRng.int(2) });
    else if (id === 'new') { state.setup.mode = cfg.mode === 'watch' ? 'ai' : cfg.mode; state.scene = 'setup'; state.ui.scroll = 0; }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };

  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key);
    { const m0 = flowMeta(); state.ui.scroll = clamp(state.ui.scroll, 0, m0.lay ? Math.max(0, m0.lay.contentH - (m0.bottom - m0.top)) : 0); }
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta();
      const scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta();
    const max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };

  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('KeyO') && state.setup.mode === 'ai') state.setup.opp = (state.setup.opp + 1) % (state.demo ? 2 : 4);
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    ensureLayout(state, 'setup');
    const pins = setupPinRects(state);
    if (ptr.pressed && (inRect(pins.start, ptr.x, ptr.y) || inRect(pins.back, ptr.x, ptr.y))) {
      handleSetup(inRect(pins.start, ptr.x, ptr.y) ? 'start' : 'back');
      return;
    }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  let refDrag = null, wheelHooked = false;
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const RL = refLayout(), set = (v) => { state.refScroll = clamp(v, 0, REF.max); };
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.refScroll = 0; };
    if (ptr.pressed) {
      if (inRect(RL.next, ptr.x, ptr.y) || inRect(RL.back, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(RL.dec, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.refScroll = 0; save(); }
      else if (inRect(RL.inc, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.refScroll = 0; save(); }
      else if (inRect(RL.panel, ptr.x, ptr.y)) refDrag = { y0: ptr.y, s0: state.refScroll };
    }
    if (refDrag) { if (ptr.down) set(refDrag.s0 - (ptr.y - refDrag.y0)); else refDrag = null; }
    if (keys.pressed.has('ArrowDown')) set(state.refScroll + 70);
    if (keys.pressed.has('ArrowUp')) set(state.refScroll - 70);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) set(state.refScroll + REF.view * 0.9);
    if (keys.pressed.has('PageUp')) set(state.refScroll - REF.view * 0.9);
    if (keys.pressed.has('Home')) set(0);
    if (keys.pressed.has('End')) set(1e9);
    if (keys.pressed.has('Escape')) close();
  };

  startAttract();
  resetMenus();

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused,
    update(dt, input) {
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'setup', 'settings', 'result', 'demolimit', 'record'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, Math.max(0, flowMeta().h ?? 0));
        });
      }
      syncSize();
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') stepAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'record': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'record'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      syncSize();
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'record': renderRecord(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.m) renderPlay(ctx, state);
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    // dev tools only (window.__dft exists only with ?dev=1): start a match / jump to a scene for layout checks
    devStart: (cfg) => startMatch(cfg),
    devWink: (id) => { const w = getWink(state.m.mat, id), p = toScreen(layoutOf(state), w.x, w.y); return { x: p.x, y: p.y, k: Math.min(meta.width, meta.height) / 720 }; },
    lockupZone: () => lockupZone(),
  };
}
