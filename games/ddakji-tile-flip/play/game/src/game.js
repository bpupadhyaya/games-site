// Ddakji: state and flow. Physics lives in sim.js, the replay of a throw in anim.js, the opponent in ai.js, drawing in view.js,
// art.js and menus.js, the fold workshop in fold.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, fold, collection, settings, play (also Watch & Learn), result, howto/about/rules, demolimit.
// Taking a throw: drag on the floor to place the strike spot, set Strength and Twist, press Throw.
import { resolveThrow, tileMass, MAT, clamp, THICK } from './sim.js';
import { beginFlight, stepAnim } from './anim.js';
import { plan, describe } from './ai.js';
import { PROFILES } from './profiles.js';
import { PATTERNS, stepFx } from './art.js';
import { createFold, foldReset, foldPress, foldMove, foldRelease, foldUpdate } from './fold.js';
import { inRect, TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, sliderValue } from './layout.js';
import { renderPlay, layoutOf, camFor, nameOf, patOf } from './view.js';
import {
  renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderFold, renderCollection,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, setupPinRects, lockupZone, foldStage, collectionHit, patName,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export { meta };
const DEMO_EXCHANGES = 4;
const MAX_THROWS = 10;
const AIM_LIM = { x0: -2.3, x1: 2.3, y0: MAT.y0 + 0.35, y1: MAT.y1 - 0.35 };

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork(), aiRng = rng.fork(), thrRng = rng.fork(), layRng = rng.fork();
  const blankTable = () => ({ target: null, rest: null, fly: null, ex: null, held: null, fx: [], t: 0 });
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, guide: true, textIdx: 0, thinkIdx: 1 },
    record: { wins: [0, 0, 0, 0, 0, 0], flips: 0, played: 0, streak: 0, best: 0, demoExchanges: 0, crisp: 0.6, owned: [true, false, false, false, false, false, false, false, false, false, false, false] },
    pat: 0, setup: { mode: 'ai', opp: 0, goal: 2 }, setupMsg: '', ui: { scroll: 0, drag: null }, refScroll: 0,
    att: { ...blankTable(), wait: 1.2, phase: 'wait', n: 0, throws: 0 },
    ...blankTable(),
    pops: [], shake: 0, m: null, aim: { x: 0, y: 1.9, s: 0.7, w: 0 }, humanTurn: false, hint: null, alts: null, showAim: false, pass: null, passFrom: undefined, think: null,
    toast: '', toastT: 0, banner: null, defaultInfo: '', slideDrag: null, drag: null, fold: createFold(), foldBack: 'title', collSel: -1, collBack: 'title', newUnlocks: [], saved: null,
    restoreMsg: '', loaded: false, aimAnim: null, vt: 0,
  };
  syncSize();

  // ---- persistence -----------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', { ...state.record, pat: state.pat }); };
  const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  function validSnapshot(sn) {
    try {
      if (!sn || sn.v !== 1 || !sn.cfg || !(sn.cfg.mode === 'ai' || sn.cfg.mode === 'two')) return null;
      const c = sn.cfg;
      if (!num(c.opp, 0, PROFILES.length - 1) || !(c.goal === 2 || c.goal === 3) || !num(sn.turn, 0, 1) || !num(sn.exchanges, 0, 99)) return null;
      if (!Array.isArray(sn.scores) || sn.scores.length !== 2 || !sn.scores.every((v) => num(v, 0, c.goal - 1))) return null;
      return sn;
    } catch { return null; }
  }
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('match', null)]).then(([s, r, mt]) => {
    if (s) Object.assign(state.settings, s);
    if (!state.saved) state.saved = validSnapshot(mt);
    if (r) { Object.assign(state.record, r); if (typeof r.pat === 'number') state.pat = r.pat; }
    const rec = state.record;
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(rec.wins) || rec.wins.length < 6) rec.wins = [0, 0, 0, 0, 0, 0];
    if (!Array.isArray(rec.owned) || rec.owned.length < 12) rec.owned = [true, ...new Array(11).fill(false)];
    rec.owned[0] = true; rec.crisp = clamp(Number(rec.crisp) || 0.6, 0, 1);
    if (!rec.owned[state.pat]) state.pat = 0;
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });
  const clearSaved = () => { if (state.saved) { state.saved = null; storage.set('match', null); } };
  const persistMatch = () => {
    const m = state.m;
    if (m && m.cfg.mode !== 'watch' && !m.over) { state.saved = { v: 1, cfg: { mode: m.cfg.mode, opp: m.cfg.opp, goal: m.cfg.goal, p2pat: m.cfg.p2pat }, scores: m.scores.slice(), turn: m.turn, exchanges: m.exchanges }; storage.set('match', state.saved); }
  };

  // ---- sound -----------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    whoosh: (s = 0.5) => tone({ freq: 220 + s * 380, to: 70, dur: 0.22, type: 'sawtooth', vol: 0.03 }),
    slap: (s = 0.5) => {
      tone({ freq: 150 + fx.next() * 40, to: 50, dur: 0.14, type: 'sine', vol: 0.12 + 0.12 * s });
      tone({ freq: 1900 + fx.next() * 500, to: 700, dur: 0.05, type: 'square', vol: 0.02 + 0.045 * s });
      tone({ freq: 420 + fx.next() * 100, to: 200, dur: 0.1, type: 'triangle', vol: 0.05 + 0.08 * s });
    },
    flutter: () => tone({ freq: 700, to: 1500, dur: 0.18, type: 'triangle', vol: 0.035 }),
    land: () => { tone({ freq: 110, to: 55, dur: 0.16, type: 'sine', vol: 0.14 }); tone({ freq: 1200 + fx.next() * 300, to: 600, dur: 0.05, type: 'square', vol: 0.03 }); },
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 230, to: 140, dur: 0.2, type: 'sawtooth', vol: 0.05 }),
    snap: () => { tone({ freq: 1400, to: 900, dur: 0.05, type: 'square', vol: 0.03 }); tone({ freq: 330, to: 200, dur: 0.1, type: 'triangle', vol: 0.06 }); },
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.19, i), dur: 0.22, type: 'sine', vol: 0.09 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- effects -------------------------------------------------------------------------------------
  const MAX_FX = 90;
  const addFx = (list, q) => { if (list.length < MAX_FX) list.push(q); };
  const impactFx = (tb, x, y, s, pat) => {
    const bg = (PATTERNS[pat] ?? PATTERNS[0]).bg;
    addFx(tb.fx, { kind: 2, x, y, z: 0, vx: 0, vy: 0, vz: 0, t: 0, max: 0.55, size: 1.5 + s * 1.6 });
    for (let i = 0; i < 4 + Math.round(s * 5); i++) { const a = fx.next() * Math.PI * 2, v = 0.5 + fx.next() * 1.4 * (0.5 + s); addFx(tb.fx, { kind: 0, x, y, z: 0.05, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 0.2 + fx.next() * 0.4, t: 0, max: 0.5 + fx.next() * 0.4, size: 0.5 + fx.next() * 0.6 }); }
    for (let i = 0; i < 3 + Math.round(s * 5); i++) { const a = fx.next() * Math.PI * 2, v = 0.8 + fx.next() * 1.8; addFx(tb.fx, { kind: 1, x, y, z: 0.1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 1 + fx.next() * 2, t: 0, max: 0.6 + fx.next() * 0.5, size: 0.14 + fx.next() * 0.14, col: i % 2 ? bg : '#f4ead0', rot: fx.next() * 6, spin: (fx.next() - 0.5) * 12 }); }
  };
  const confetti = (tb, x, y, n, pats) => {
    for (let i = 0; i < n; i++) { const a = fx.next() * Math.PI * 2, v = 1 + fx.next() * 2.2, bg = (PATTERNS[pats[i % pats.length]] ?? PATTERNS[0]).bg; addFx(tb.fx, { kind: 3, x, y, z: 0.3, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 2 + fx.next() * 3, t: 0, max: 1 + fx.next() * 0.8, size: 0.18 + fx.next() * 0.16, col: i % 3 === 0 ? '#f6c35a' : bg, rot: fx.next() * 6, spin: (fx.next() - 0.5) * 14 }); }
  };
  const banner = (text, sub, col, top) => { state.banner = { text, sub, col, top, t: 0, max: 1.6 }; };

  // ---- sides, masses ----------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const isAI = (side) => mode() === 'watch' || (mode() === 'ai' && side === 1);
  const profOf = (side) => (mode() === 'watch' ? PROFILES[side === 0 ? state.m.cfg.watchA : state.m.cfg.opp] : PROFILES[state.m.cfg.opp]);
  const massOf = (side) => (isAI(side) ? profOf(side).mass : side === 0 ? tileMass(state.record.crisp) : 1);
  const tgtSim = () => ({ x: state.target.x, y: state.target.y, yaw: state.target.yaw, mass: state.target.mass });

  // ---- unlocks ---------------------------------------------------------------------------------
  const grant = (pat) => {
    const rec = state.record;
    if (rec.owned[pat]) return;
    rec.owned[pat] = true; state.newUnlocks.push(pat); sfx.win();
    toast(`New pattern: ${patName(pat)}`, 3.2);
  };
  const checkMilestones = () => {
    const rec = state.record;
    if (rec.flips >= 1) grant(2);
    if (rec.flips >= 10) grant(7);
    if (rec.flips >= 30) grant(8);
    if (rec.crisp >= 0.9) grant(9);
    if (rec.streak >= 3) grant(11);
  };

  // ---- match flow --------------------------------------------------------------------------------
  const layTarget = (owner) => {
    state.target = { x: layRng.range(-0.8, 0.8), y: layRng.range(2.6, 3.4), yaw: layRng.range(-0.25, 0.25), z: 0, theta: 0, lift: null, pat: patOf(state, owner), mass: massOf(owner), owner, alpha: 1 };
    state.rest = null; state.fly = null; state.ex = null;
  };
  const newExchange = (first) => {
    const m = state.m;
    m.turn = first; m.throws = 0; m.phase = 'aim'; m.exchanges++;
    layTarget(1 - first);
    state.fx.length = 0; state.pops.length = 0; state.banner = null;
    persistMatch();
    beginTurn();
  };
  const beginTurn = () => {
    const m = state.m, side = m.turn;
    m.phase = 'aim'; state.humanTurn = !isAI(side); state.think = null; state.hint = null; state.alts = null; state.aimAnim = null; state.drag = null; state.slideDrag = null; state.showAim = false;
    state.held = { pat: patOf(state, side), mass: massOf(side) };
    const t = state.target;
    state.aim = { x: clamp(t.x, AIM_LIM.x0, AIM_LIM.x1), y: clamp(t.y - 1.15, AIM_LIM.y0, AIM_LIM.y1), s: state.humanTurn ? 0.7 : 0.6, w: 0 };
    state.pass = (m.cfg.mode === 'two' && state.humanTurn && state.passFrom !== undefined && state.passFrom !== side) ? { side, t: 0 } : null;
    state.passFrom = side;
    if (state.humanTurn && !state.pass) toast(mode() === 'two' ? `${nameOf(state, side)}: your throw` : 'Your throw: place the ghost tile beside theirs', 3);
    else if (!state.humanTurn && mode() !== 'watch') toast(`${nameOf(state, side)} is thinking…`, 2.2);
    state.defaultInfo = state.humanTurn ? 'Drag on the floor to aim. Strength and Twist below.' : '';
  };
  const startMatch = (cfg) => {
    const c = { mode: 'ai', opp: 0, goal: 2, first: aiRng.int(2), watchA: 3, p2pat: 3, ...cfg };
    if (c.mode === 'two') c.p2pat = [3, 4, 1, 6, 10, 5].find((p) => p !== state.pat) ?? 3;
    if (state.demo && c.mode !== 'watch' && state.record.demoExchanges >= DEMO_EXCHANGES) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.m = { cfg: c, goal: c.goal, scores: cfg.scores ? cfg.scores.slice() : [0, 0], turn: c.first, phase: 'aim', throws: 0, exchanges: cfg.exchanges ?? 0, totalThrows: 0, over: null };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.passFrom = undefined; state.newUnlocks = [];
    newExchange(c.first);
  };
  const resumeMatch = () => {
    const sn = state.saved; if (!sn) return;
    if (state.demo && state.record.demoExchanges >= DEMO_EXCHANGES) { clearSaved(); state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    startMatch({ ...sn.cfg, first: sn.turn, scores: sn.scores, exchanges: sn.exchanges });
  };
  const startWatch = () => {
    const picks = [0, 1, 2, 3, 4, 5];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, goal: 2 });
  };

  const releaseThrow = () => {
    const m = state.m, side = m.turn;
    if (m.phase !== 'aim') return;
    const prof = isAI(side) ? profOf(side) : null;
    const out = resolveThrow(state.aim, tgtSim(), state.held.mass, thrRng, prof ? prof.tremor : 0);
    beginFlight(state, out, state.held);
    m.phase = 'fly'; m.throws++; m.totalThrows++;
    state.humanTurn = false; state.hint = null; state.alts = null; state.drag = null; state.slideDrag = null; state.think = null; state.showAim = false;
    state.defaultInfo = '';
    sfx.whoosh(state.aim.s);
  };

  const verdict = (out) => {
    const m = state.m, side = m.turn;
    state.vt = 0; m.phase = 'verdict'; m.flip = !!out.flipped;
    if (out.flipped) {
      banner('FLIPPED!', `${nameOf(state, side)} wins the tile`, '#f0a832', '#fff3c4');
      confetti(state, state.target.x, state.target.y, 18, [patOf(state, 0), patOf(state, 1)]);
      state.shake = 0.6; sfx.win();
      if (!isAI(side) && mode() === 'ai') state.record.flips++;
      toast(`${nameOf(state, side)} flips the tile`, 2.4);
    } else {
      const k = out.kind;
      if (k === 'wobble') banner('So close!', 'It wobbled but stayed down', '#f0c25a', '#fff3c4');
      else if (k === 'pinned') banner('Pinned', 'Landed on top of it', '#e8a070', '#ffe3cc');
      else if (k === 'miss') banner('Too far', 'No wind reached it', '#e8a070', '#ffe3cc');
      else banner('Not enough', 'Barely stirred', '#d8b080', '#fff0d8');
      sfx.no();
    }
  };
  const finishFlip = () => {
    const m = state.m, side = m.turn;
    m.scores[side]++; m.lastLoser = 1 - side; m.phase = 'score'; m.st = 0;
    if (mode() === 'ai' && side === 0) checkMilestones();
    if (m.scores[side] >= m.goal) matchOver(side);
  };
  const matchOver = (win) => {
    const m = state.m, rec = state.record;
    m.over = { win };
    if (m.cfg.mode === 'ai') {
      rec.played++;
      if (win === 0) {
        rec.wins[m.cfg.opp]++; rec.streak++; rec.best = Math.max(rec.best, rec.streak);
        grant(PROFILES[m.cfg.opp].pat);
        if (m.scores[1] === 0 && m.goal === 3) grant(11);
      } else rec.streak = 0;
      checkMilestones();
    }
    clearSaved(); save();
  };
  const afterScore = () => {
    const m = state.m;
    if (m.over) { state.scene = 'result'; state.ui.scroll = 0; return; }
    if (m.cfg.mode !== 'watch') state.record.demoExchanges++;
    if (state.demo && m.cfg.mode !== 'watch' && state.record.demoExchanges >= DEMO_EXCHANGES) { clearSaved(); save(); state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    save(); newExchange(m.lastLoser);
  };
  const swapTiles = () => {
    const m = state.m, r = state.rest, side = m.turn;
    // the old target is picked up; the tile just thrown becomes the new target and the other side throws
    state.target = { x: r.x, y: r.y, yaw: r.yaw, z: 0, theta: 0, lift: null, pat: r.pat, mass: r.mass, owner: side, alpha: 1 };
    state.rest = null; state.ex = null;
    m.turn = 1 - side;
    if (m.throws >= MAX_THROWS) { toast('No flip yet: the tiles are laid again', 2.6); newExchange(m.turn); return; }
    beginTurn();
  };

  // ---- the opponent ----------------------------------------------------------------------------------
  const watchThink = () => THINK_STEPS[state.settings.thinkIdx];
  const updateAI = (dt) => {
    const m = state.m;
    if (m.phase !== 'aim' || state.humanTurn || state.paused) return;
    const side = m.turn, prof = profOf(side), watch = mode() === 'watch';
    if (!state.think) {
      const dur = watch ? watchThink() : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur, phase: 'think', plan: plan(tgtSim(), state.held.mass, prof, aiRng, {}), from: { ...state.aim } };
      if (watch) toast(`${nameOf(state, side)} is thinking…`, dur);
    }
    const th = state.think; th.t += dt;
    if (th.phase === 'think' && th.t >= th.dur) {
      th.phase = watch ? 'reveal' : 'move'; th.t = 0; th.dur = watch ? 2 : 0.8; state.showAim = true;
      if (watch) { state.alts = th.plan.alts; toast(`${nameOf(state, side)}: ${describe(th.plan, state.target)}`, 2.1); }
      th.from = { ...state.aim };
    } else if (th.phase === 'reveal' || th.phase === 'move') {
      const k = Math.min(1, th.t / (th.phase === 'move' ? th.dur : 0.7)), e = 1 - Math.pow(1 - k, 3), p = th.plan;
      state.aim = { x: th.from.x + (p.x - th.from.x) * e, y: th.from.y + (p.y - th.from.y) * e, s: th.from.s + (p.s - th.from.s) * e, w: th.from.w + (p.w - th.from.w) * e };
      if (th.t >= th.dur) { state.aim = { x: p.x, y: p.y, s: p.s, w: p.w }; releaseThrow(); }
    }
  };

  // ---- hint ------------------------------------------------------------------------------------------
  const requestHint = () => {
    const m = state.m;
    if (m.phase !== 'aim' || !state.humanTurn || state.aimAnim) return;
    const pl = plan(tgtSim(), state.held.mass, PROFILES[5], aiRng, { perfect: true });
    state.hint = pl; state.alts = pl.alts.slice(0, 2);
    state.aimAnim = { from: { ...state.aim }, to: { x: pl.x, y: pl.y, s: pl.s, w: pl.w }, t: 0 };
    toast(`Think: ${describe(pl, state.target)}`, 4.2);
  };

  // ---- pause -------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leaveMatch = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.think = null; state.drag = null; state.slideDrag = null; };

  // ---- the play scene ----------------------------------------------------------------------------------
  const setAimFromFloor = (fp, jump) => {
    if (jump) { state.aim.x = clamp(fp.x, AIM_LIM.x0, AIM_LIM.x1); state.aim.y = clamp(fp.y, AIM_LIM.y0, AIM_LIM.y1); }
    else { state.aim.x = clamp(state.aim.x + (fp.x - state.drag.lx), AIM_LIM.x0, AIM_LIM.x1); state.aim.y = clamp(state.aim.y + (fp.y - state.drag.ly), AIM_LIM.y0, AIM_LIM.y1); }
    state.drag.lx = fp.x; state.drag.ly = fp.y;
  };
  const handleEvents = (tb, evs, live) => {
    for (const e of evs) {
      if (e.type === 'impact') {
        impactFx(tb, e.out.land.x, e.out.land.y, e.out.aim.s, tb.ex.held.pat);
        if (live) { state.shake = Math.max(state.shake, 0.25 + e.out.aim.s * 0.6); sfx.slap(e.out.aim.s); }
      } else if (e.type === 'lift') {
        if (live) sfx.flutter();
        addFx(tb.fx, { kind: 0, x: tb.target.x, y: tb.target.y, z: 0.1, vx: e.out.nl.x * 0.5, vy: e.out.nl.y * 0.5, vz: 0.3, t: 0, max: 0.6, size: 0.7 });
      } else if (e.type === 'settle') {
        impactFx(tb, e.out.after.x, e.out.after.y, 0.35, tb.target.pat);
        if (live) { sfx.land(); state.shake = Math.max(state.shake, 0.3); }
      }
    }
  };
  const devFlip = () => { const m = state.m; m.scores[0] = m.goal - 1; m.turn = 0; m.phase = 'verdict'; m.flip = true; finishFlip(); };

  const updatePlay = (dt, input) => {
    const m = state.m, ptr = input.pointer, keys = input.keys, watch = m.cfg.mode === 'watch';
    const L = layoutOf(state);
    if (config.dev && keys.pressed.has('KeyK') && !watch) { devFlip(); return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else state.paused = !state.paused; }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
      return;
    }
    const barHidden = m.phase === 'score' || m.phase === 'over';
    if (watch) {
      if (ptr.pressed && !barHidden) {
        const D = L.demo;
        if (inRect(D.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(D.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${watchThink()} s`, 1.6); }
        else if (inRect(D.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${watchThink()} s`, 1.6); }
        else if (inRect(D.exit, ptr.x, ptr.y)) { leaveMatch(); return; }
      }
    } else if (ptr.pressed && !barHidden && inRect(L.menu, ptr.x, ptr.y)) { openPause(); return; }

    const can = state.humanTurn && m.phase === 'aim' && !state.paused;
    if (state.pass) {
      state.pass.t += dt;
      if (ptr.pressed && state.pass.t > 0.3) { state.pass = null; state.defaultInfo = 'Drag on the floor to aim. Strength and Twist below.'; sfx.tick(); }
    } else if (can && !state.aimAnim) {
      const camNow = camFor(state).cam;
      if (ptr.pressed) {
        if (inRect(L.strength, ptr.x, ptr.y)) { state.slideDrag = 's'; state.aim.s = clamp(sliderValue(L.strength, ptr.x, false), 0.02, 1); state.hint = null; }
        else if (inRect(L.twist, ptr.x, ptr.y)) { state.slideDrag = 'w'; state.aim.w = sliderValue(L.twist, ptr.x, true); if (Math.abs(state.aim.w) < 0.06) state.aim.w = 0; state.hint = null; }
        else if (inRect(L.hint, ptr.x, ptr.y)) { requestHint(); sfx.tick(); }
        else if (inRect(L.throw, ptr.x, ptr.y)) { releaseThrow(); }
        else if (inRect(camNow.zone, ptr.x, ptr.y)) {
          const fp = camNow.unproj(ptr.x, ptr.y);
          if (fp) { state.drag = { lx: fp.x, ly: fp.y }; if (Math.hypot(fp.x - state.aim.x, fp.y - state.aim.y) >= 1.2) setAimFromFloor(fp, true); state.hint = null; state.alts = null; }
        }
      }
      if (state.slideDrag) {
        if (ptr.down) {
          if (state.slideDrag === 's') state.aim.s = clamp(sliderValue(L.strength, ptr.x, false), 0.02, 1);
          else { state.aim.w = sliderValue(L.twist, ptr.x, true); if (Math.abs(state.aim.w) < 0.06) state.aim.w = 0; }
        } else state.slideDrag = null;
      }
      if (state.drag) {
        if (ptr.down) { const fp = camNow.unproj(ptr.x, ptr.y); if (fp) setAimFromFloor(fp, false); } else state.drag = null;
      }
      const a = state.aim, st = 0.035;
      if (keys.down.has('ArrowLeft')) a.x = clamp(a.x - st, AIM_LIM.x0, AIM_LIM.x1);
      if (keys.down.has('ArrowRight')) a.x = clamp(a.x + st, AIM_LIM.x0, AIM_LIM.x1);
      if (keys.down.has('ArrowUp')) a.y = clamp(a.y + st, AIM_LIM.y0, AIM_LIM.y1);
      if (keys.down.has('ArrowDown')) a.y = clamp(a.y - st, AIM_LIM.y0, AIM_LIM.y1);
      if (keys.down.has('KeyW')) a.s = clamp(a.s + 0.01, 0.02, 1);
      if (keys.down.has('KeyS')) a.s = clamp(a.s - 0.01, 0.02, 1);
      if (keys.down.has('KeyE')) a.w = clamp(a.w + 0.02, -1, 1);
      if (keys.down.has('KeyQ')) a.w = clamp(a.w - 0.02, -1, 1);
      if (keys.pressed.has('KeyH')) requestHint();
      if (keys.pressed.has('Space')) releaseThrow();
    } else if (state.drag && !can) state.drag = null;
    if (state.paused) return;

    if (state.aimAnim) {
      const an = state.aimAnim; an.t += dt;
      const k = Math.min(1, an.t / 0.6), e = 1 - Math.pow(1 - k, 3);
      state.aim = { x: an.from.x + (an.to.x - an.from.x) * e, y: an.from.y + (an.to.y - an.from.y) * e, s: an.from.s + (an.to.s - an.from.s) * e, w: an.from.w + (an.to.w - an.from.w) * e };
      if (k >= 1) state.aimAnim = null;
    }
    updateAI(dt);
    if (m.phase === 'fly') {
      const evs = stepAnim(state, dt);
      handleEvents(state, evs, true);
      for (const e of evs) if (e.type === 'done') verdict(e.out);
    }
    if (m.phase === 'verdict') {
      state.vt += dt;
      if (state.vt > (m.flip ? 1.5 : 1.25)) { if (m.flip) finishFlip(); else { m.phase = 'swap'; state.vt = 0; } }
    }
    if (m.phase === 'swap') {
      state.vt += dt; const k = Math.min(1, state.vt / 0.5);
      if (state.target) { state.target.alpha = 1 - k; state.target.z = k * 0.9; }
      if (state.rest && state.rest.atop) state.rest.z = THICK * (1 - k);
      if (k >= 1) swapTiles();
    }
    if (m.phase === 'score') {
      m.st += dt;
      if ((ptr.pressed && m.st > 0.9) || (watch && m.st > 2.4) || m.st > 5) afterScore();
    }
    stepFx(state.fx, dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.max) state.banner = null; }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.4);
  };

  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'p-guide') { state.settings.guide = !state.settings.guide; save(); }
    else if (id === 'quit') leaveMatch();
  }

  // ---- the title-screen demo: two tiles trading slaps behind the menus ----------------------------------
  const attLay = () => {
    const a = state.att;
    a.target = { x: layRng.range(-0.7, 0.7), y: layRng.range(2.6, 3.3), yaw: layRng.range(-0.2, 0.2), z: 0, theta: 0, lift: null, pat: [3, 1, 4, 6, 10, 5][a.n % 6], mass: 1, owner: 0, alpha: 1 };
    a.rest = null; a.fly = null; a.ex = null; a.throws = 0;
  };
  const updateAttract = (dt) => {
    const a = state.att; a.t += dt;
    if (!a.target) attLay();
    stepFx(a.fx, dt);
    if (a.phase === 'wait') {
      a.wait -= dt;
      if (a.wait <= 0) {
        a.held = { pat: [0, 2, 7, 9, 11, 8][a.n % 6], mass: 1 };
        const t = a.target, tg = { x: t.x, y: t.y, yaw: t.yaw, mass: 1 };
        const pl = plan(tg, 1, PROFILES[a.n % 3 === 0 ? 2 : 4], aiRng, {});
        const out = resolveThrow({ x: pl.x, y: pl.y, s: pl.s, w: pl.w }, tg, 1, thrRng, 0.06);
        beginFlight(a, out, a.held); a.phase = 'fly'; a.n++;
      }
    } else if (a.phase === 'fly') {
      const evs = stepAnim(a, dt);
      handleEvents(a, evs, false);
      for (const e of evs) if (e.type === 'done') { a.phase = 'rest'; a.wait = 1.1; a.flipped = e.out.flipped; }
    } else if (a.phase === 'rest') {
      a.wait -= dt;
      if (a.wait <= 0) {
        if (a.flipped || a.throws >= 2) attLay();
        else { a.throws++; const r = a.rest; a.target = { x: r.x, y: r.y, yaw: r.yaw, z: 0, theta: 0, lift: null, pat: r.pat, mass: 1, owner: 0, alpha: 1 }; a.rest = null; a.ex = null; }
        a.phase = 'wait'; a.wait = 1.6;
      }
    }
  };

  // ---- menus ------------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  }
  const openFold = (backTo) => { foldReset(state.fold); state.foldBack = backTo; state.scene = 'fold'; state.ui.scroll = 0; };
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'resume') resumeMatch();
    else if (id === 'play') { state.setup.mode = 'ai'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'two') { state.setup.mode = 'two'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'fold') openFold('title');
    else if (id === 'collection') { state.collBack = 'title'; state.collSel = state.pat; state.scene = 'collection'; state.ui.scroll = 0; }
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id === 'len2') s.goal = 2;
    else if (id === 'len3') s.goal = 3;
    else if (id === 'tilepick') { state.collBack = 'setup'; state.collSel = state.pat; state.scene = 'collection'; state.ui.scroll = 0; }
    else if (id === 'foldnew') openFold('setup');
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, goal: s.goal });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-guide') st.guide = !st.guide;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.m.cfg;
    if (id === 'again') startMatch({ ...cfg, first: aiRng.int(2), scores: undefined, exchanges: 0 });
    else if (id === 'new') { state.setup.mode = cfg.mode === 'watch' ? 'ai' : cfg.mode; state.scene = 'setup'; state.ui.scroll = 0; }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
    else if (id === 'collection') { state.collBack = 'result'; state.collSel = state.newUnlocks[0] ?? state.pat; state.scene = 'collection'; state.ui.scroll = 0; }
  };
  const handleFold = (id) => {
    const f = state.fold;
    if (!id) return;
    sfx.tick();
    if (id === 'fold-show') { f.show = !f.show; f.showT = 0; f.p = 0; f.drag = null; }
    else if (id === 'fold-back') { state.scene = state.foldBack; state.ui.scroll = 0; }
    else if (id === 'fold-again') foldReset(f);
    else if (id === 'fold-use') { state.record.crisp = f.result; checkMilestones(); save(); state.scene = state.foldBack; state.ui.scroll = 0; }
  };

  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key);
    { const m0 = flowMeta(); state.ui.scroll = clamp(state.ui.scroll, 0, m0.lay ? Math.max(0, m0.lay.contentH - (m0.bottom - m0.top)) : 0); }
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta(), scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    ensureLayout(state, 'setup');
    const pins = setupPinRects(state);
    if (ptr.pressed && (inRect(pins.start, ptr.x, ptr.y) || inRect(pins.back, ptr.x, ptr.y))) { handleSetup(inRect(pins.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };
  const updateCollection = (dt, input) => {
    const ptr = input.pointer;
    ensureLayout(state, 'collection');
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      if (d.moved < 10) {
        const i = collectionHit(ptr.x, ptr.y);
        if (i >= 0) {
          if (state.collSel === i && state.record.owned[i]) { state.pat = i; save(); sfx.snap(); } else { state.collSel = i; sfx.tick(); }
        } else if (hitScreen(ptr.x, ptr.y, state.ui.scroll) === 'back') { state.scene = state.collBack; state.ui.scroll = 0; sfx.tick(); }
      }
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    state.ui.scroll = clamp(state.ui.scroll, 0, max);
    if (input.keys.pressed.has('Escape')) { state.scene = state.collBack; state.ui.scroll = 0; }
  };
  const updateFold = (dt, input) => {
    const ptr = input.pointer, f = state.fold;
    ensureLayout(state, 'fold');
    { const m0 = flowMeta(); state.ui.scroll = clamp(state.ui.scroll, 0, m0.lay ? Math.max(0, m0.lay.contentH - (m0.bottom - m0.top)) : 0); }
    const s = foldStage(state), toStage = (x, y) => ({ x: ((x - (s.x + s.s / 2)) / s.s) * 480, y: ((y - (s.y + s.s / 2)) / s.s) * 480 });
    if (ptr.pressed) {
      if (inRect({ x: s.x, y: s.y, w: s.s, h: s.s }, ptr.x, ptr.y) && !f.done) { if (f.show) { f.show = false; f.p = 0; } const p = toStage(ptr.x, ptr.y); foldPress(f, p.x, p.y); state.ui.drag = null; }
      else state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    }
    if (f.drag && ptr.down) { const p = toStage(ptr.x, ptr.y); foldMove(f, p.x, p.y); }
    if (f.drag && ptr.released) { const sc = foldRelease(f); if (sc !== null) sfx.snap(); }
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta(), scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handleFold(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handleFold(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const r = foldUpdate(f, dt, !!f.drag && ptr.down);
    if (r === 'done') sfx.win(); else if (r === 'step') sfx.chime(f.step);
    if (input.keys.pressed.has('Escape')) handleFold('fold-back');
  };

  let refDrag = null, wheelHooked = false;
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys, RL = refLayout(), set = (v) => { state.refScroll = clamp(v, 0, REF.max); };
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

  resetMenus();

  // Store screenshots (main.js calls this only for ?shot=1&scene=...): put the game in a named moment and run it forward a little.
  const IDLE = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const advance = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, IDLE); };
  const shotScene = (name) => {
    const rec = state.record;
    rec.owned = [true, true, true, false, true, true, false, true, false, true, false, false]; rec.wins = [3, 2, 1, 0, 0, 0]; state.pat = 0;
    advance(30);
    if (name === 'title') { advance(150); return; }
    if (name === 'aim' || name === 'flip' || name === 'watch') {
      startMatch(name === 'watch' ? { mode: 'watch', watchA: 4, opp: 2, goal: 2, first: 0 } : { mode: 'ai', opp: 2, goal: 3, first: 0 });
      state.toastT = 0; state.defaultInfo = '';
      if (name === 'watch') { state.settings.thinkIdx = 0; for (let i = 0; i < 60 * 3.6 && !(state.m.phase === 'fly'); i++) advance(1); advance(24); return; }
      const pl = plan(tgtSim(), state.held.mass, PROFILES[5], aiRng, { perfect: true });
      if (name === 'aim') { state.aim = { x: pl.x, y: pl.y, s: pl.s, w: pl.w }; state.m.scores = [1, 1]; advance(20); return; }
      for (let tries = 0; tries < 40; tries++) {
        state.aim = { x: pl.x, y: pl.y, s: pl.s, w: pl.w }; releaseThrow();
        if (state.ex.out.flipped) break;
        newExchange(0); const p2 = plan(tgtSim(), state.held.mass, PROFILES[5], aiRng, { perfect: true }); pl.x = p2.x; pl.y = p2.y; pl.s = p2.s; pl.w = p2.w;
      }
      state.m.scores = [1, 1];
      advance(Math.round(60 * (state.ex.out.T + 0.34)));
      return;
    }
    if (name === 'fold') { state.scene = 'fold'; const f = state.fold; foldReset(f); f.step = 5; f.p = 0.55; f.crisp = [0.95, 0.9, 0.97, 0.92, 0.95]; return; }
    if (name === 'collection') { state.scene = 'collection'; state.collSel = 4; state.collBack = 'title'; advance(2); }
  };

  const api = {
    // Watch & Learn, the Fold Workshop and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused || !!state.pass,
    update(dt, input) {
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          const mt = flowMeta();
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'setup', 'settings', 'result', 'demolimit', 'collection', 'fold'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0);
        });
      }
      syncSize();
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'collection': updateCollection(dt, input); break;
        case 'fold': updateFold(dt, input); break;
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
        case 'collection': renderCollection(ctx, state); break;
        case 'fold': renderFold(ctx, state); break;
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
    lockupZone: () => lockupZone(),
    shotScene,
  };
  return api;
}
