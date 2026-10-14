// Gorodki (town skittles). State and flow. Physics lives in sim.js, the figures in figures.js, the computer players and hints in ai.js,
// drawing in view.js, art.js and menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup (duel), ladder, settings, play (figure ladder, duels and Watch & Learn), result, howto/about/rules, demolimit.
// A figure is a turn per player: up to the figure's number of bats, in real time at 60 fixed steps a second.
import { DT, createTown, throwBat, stepTown, MAX_THROWS, AIM, STYLES, WIND_T } from './sim.js';
import { FIGURES, figurePins } from './figures.js';
import { RIVALS, choose, scatterFor, advise, HUMAN_K } from './ai.js';
import { W, H, clamp, inRect, REF_CLOSE, TEXT_DEC, TEXT_INC, TEXT_SCALES, THINK_STEPS, SETUP_PINS, setSize, sizeKey } from './layout.js';
import { renderPlay, layoutFor, camFor } from './view.js';
import { readerGeo, setupPinsGeo, host } from './layout.js';
import {
  renderTitle, renderSetup, renderSettings, renderLadder, renderResult, renderPause, renderReason, renderFigRes, renderPages, renderDemoLimit,
  hitScreen, flowMeta, readerMax, ensureReader, ensureLayout, resetMenus,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { GL } from './glbridge.js';
import { setPress } from './ui.js';
import { pressLockup } from './brand.js';

export const meta = { width: W, height: H, fluid: { short: 720 } };
export const DEMO_FIG_CAP = 6;
export const DEMO_LADDER_CAP = 3;
const SHOT_MODE = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();
const POOLS = [8, 11, 15, 15];   // how much of the ladder each rival plays in a duel
const FIGURES_PER_DUEL = 5;
const starsFor = (bats, used) => clamp(bats - used + 1, 1, 3);

// About, plus the third-party credits of the 3D layer when it is in use (web/vendor3d/LICENSES.md, shown whole, as its terms ask).
let aboutKey = '', aboutCache = ABOUT;
const aboutList = () => {
  const txt = GL.licenses || '';
  if (!GL.on || !txt) return ABOUT;
  if (aboutKey === txt) return aboutCache;
  aboutKey = txt;
  const from = txt.indexOf('## '), body = from >= 0 ? txt.slice(from) : txt;
  const paras = body.split(/\n\s*\n/).map((t) => t.replace(/^#+\s*/, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  aboutCache = [...ABOUT, { title: 'Credits: the 3D people and village', p: paras }];
  return aboutCache;
};

export function createGame(env) {
  const textScale = () => TEXT_SCALES[state.settings.textIdx];
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork();
  const aiRng = rng.fork();
  const humanRng = rng.fork();
  const listRng = rng.fork();
  const newFx = () => ({ parts: [], rings: [], pops: [] });
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, dev: !!config.dev,
    settings: { sound: true, haptics: true, textIdx: 0, thinkIdx: 1, guide: 0 },
    record: { ladder: new Array(FIGURES.length).fill(0), played: 0, wins: [0, 0, 0, 0], demoFigs: 0 },
    setup: { rival: 1 }, setupMsg: '',
    ui: { scroll: 0, drag: null },
    m: null, turn: null, w: null, fig: FIGURES[0], figTotal: 0, names: { you: 'You', rival: 'Mitya', a: 'Mitya', b: 'Old Pavel' },
    aim: { x: 0, z: 0.2, style: 'drive' }, humanTurnAim: false, drag: null, hint: null, hintT: 0, hl: null, thinkBusy: false,
    plans: null, think: null, card: null, aimShow: 0, banner: null, fx: newFx(), toast: '', toastT: 0, att: null,
    figRes: null, reasonOpen: false, loaded: false, restoreMsg: '', shotMode: null, figDone: false,
  };

  // ---- persistence ---------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) {
      Object.assign(state.record, r);
      const ld = state.record.ladder;
      state.record.ladder = Array.isArray(ld) ? FIGURES.map((_, i) => clamp(ld[i] | 0, 0, 3)) : new Array(FIGURES.length).fill(0);
      const wn = state.record.wins;
      state.record.wins = Array.isArray(wn) && wn.length >= 4 ? wn.slice(0, 4).map((v) => v | 0) : [0, 0, 0, 0];
      state.record.demoFigs = state.record.demoFigs | 0;
    }
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    state.settings.guide = clamp(state.settings.guide | 0, 0, 2);
    state.settings.haptics = state.settings.haptics !== false;
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ---------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    whoosh: () => { tone({ freq: 640, to: 220, dur: 0.22, type: 'sawtooth', vol: 0.014 }); tone({ freq: 180, to: 110, dur: 0.14, type: 'sine', vol: 0.025 }); },
    thud: (v) => tone({ freq: 140 + fxRng.next() * 20, to: 60, dur: 0.12, type: 'sine', vol: 0.04 + Math.min(0.05, v * 0.006) }),
    knock: (v) => {
      const q = Math.min(1, v / 7);
      tone({ freq: 260 + fxRng.next() * 60, to: 120, dur: 0.1, type: 'triangle', vol: 0.07 + 0.06 * q });
      tone({ freq: 1500 + fxRng.next() * 300, to: 900, dur: 0.04, type: 'square', vol: 0.02 + 0.02 * q });
    },
    clack: (v) => tone({ freq: 700 + fxRng.next() * 300, to: 420, dur: 0.05, type: 'triangle', vol: 0.025 + Math.min(0.03, v * 0.008) }),
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    out: () => { tone({ freq: 587, dur: 0.1, type: 'triangle', vol: 0.06 }); tone({ freq: 880, dur: 0.14, type: 'triangle', vol: 0.05 }); },
    clear: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.2 + i * 0.05, type: 'triangle', vol: 0.09 })),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const buzz = (ms) => { if (state.turn && state.turn.who === 'you' && state.settings.haptics && typeof env.haptic === 'function') env.haptic(ms); };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };

  // ---- effects ---------------------------------------------------------------------------------------------------
  const MAX_PARTS = 140;
  const puff = (fx, x, z, n, big = 1) => {
    for (let i = 0; i < n && fx.parts.length < MAX_PARTS; i++) fx.parts.push({ kind: 'snow', x: x + (fxRng.next() - 0.5) * 0.2, y: 0.05 + fxRng.next() * 0.1, z: z + (fxRng.next() - 0.5) * 0.2, vx: (fxRng.next() - 0.5) * 0.9, vy: 0.4 + fxRng.next() * 0.6, vz: (fxRng.next() - 0.5) * 0.9, t: 0, max: 0.5 + fxRng.next() * 0.4, r0: 0.05 * big, r1: (0.16 + fxRng.next() * 0.12) * big });
  };
  const chips = (fx, x, z, n) => {
    for (let i = 0; i < n && fx.parts.length < MAX_PARTS; i++) { const a = fxRng.next() * Math.PI * 2, s = 0.8 + fxRng.next() * 1.8; fx.parts.push({ kind: 'chip', x, y: 0.15, z, vx: Math.cos(a) * s, vy: 0.8 + fxRng.next() * 1.6, vz: Math.sin(a) * s, t: 0, max: 0.4 + fxRng.next() * 0.3 }); }
  };
  const ring = (fx, x, z, r0, r1, col, a = 0.8, max = 0.6, lw = 3) => fx.rings.push({ x, z, r0, r1, col, a, max, t: 0, lw });
  const pop = (fx, x, z, text, col, size = 30) => { fx.pops.push({ x, z, text, col, size, t: 0, max: 1.3 }); if (fx.pops.length > 6) fx.pops.shift(); };
  const stepFx = (fx, dt) => {
    if (dt <= 0) return;
    for (const q of fx.parts) { q.t += dt; q.x += q.vx * dt; q.z += q.vz * dt; q.y += q.vy * dt; if (q.kind === 'chip') q.vy -= 9 * dt; q.vx *= 0.97; q.vz *= 0.97; }
    for (let i = fx.parts.length - 1; i >= 0; i--) if (fx.parts[i].t >= fx.parts[i].max) fx.parts.splice(i, 1);
    for (const r of fx.rings) r.t += dt;
    fx.rings = fx.rings.filter((r) => r.t < r.max);
    for (const p of fx.pops) p.t += dt;
    fx.pops = fx.pops.filter((p) => p.t < p.max);
  };
  function handleEvents(w, fx, ev, live) {
    for (const e of ev) {
      if (e.k === 'launch') { if (live) sfx.whoosh(); }
      else if (e.k === 'land') { puff(fx, e.x, e.z, 4, 1); ring(fx, e.x, e.z, 0.1, 0.5, '#ffffff', 0.6, 0.45, 2.5); if (live) { sfx.thud(e.v); buzz(12); } }
      else if (e.k === 'hit') { chips(fx, e.x, e.z, 3); puff(fx, e.x, e.z, 2, 0.8); if (live) { sfx.knock(e.v); buzz(e.v > 4 ? 30 : 16); } }
      else if (e.k === 'knock') { if (live) sfx.clack(e.v); }
      else if (e.k === 'wall') { puff(fx, e.x, e.z, 2, 0.9); if (live) sfx.thud(Math.min(4, e.v)); }
    }
  }

  // ---- the green behind the menus -----------------------------------------------------------------------------------------
  const ATT_PLANS = [['drive', 0, 0.0], ['sweep', 0, 0.15], ['smash', 0.1, 0.0], ['drive', -0.35, 0.2], ['sweep', 0, -0.2], ['drive', 0.3, 0.1]];
  function startAttract(k = 0) {
    const idx = [1, 3, 5, 7, 9, 11, 13, 4][k % 8];
    state.att = { w: createTown(figurePins(idx)), fx: newFx(), wait: 0, k, n: 0, pend: null, windT: 0 };
  }
  function updateAttract() {
    const a = state.att;
    if (!a) return;
    const w = a.w;
    if (w.phase === 'aim') {
      a.wait += DT;
      if (a.wait > 1.4 && !a.pend) { const [style, x, z] = ATT_PLANS[(a.k + a.n) % ATT_PLANS.length]; a.pend = { style, x, z }; a.windT = 0; }
      if (a.pend) {
        a.windT += DT;
        if (a.windT >= WIND_T) { throwBat(w, a.pend.style, { x: a.pend.x, z: a.pend.z }, { dx: 0, dz: 0, dth: 0 }); a.pend = null; a.n++; a.wait = 0; }
      }
    } else if (w.phase === 'done') {
      a.wait += DT;
      if (a.wait > 1.6) { if (w.pins.every((p) => p.out) || a.n >= 3) startAttract(a.k + 1); else { w.phase = 'aim'; a.wait = 0; } }
    }
    const ev = stepTown(w);
    handleEvents(w, a.fx, ev, false);
    for (const p of w.pins) if (p.out && p.outT === undefined) p.outT = state.t;
    stepFx(a.fx, DT);
  }

  // ---- matches and turns ----------------------------------------------------------------------------------------------------
  const demoFull = () => state.demo && state.record.demoFigs >= DEMO_FIG_CAP;
  const pickDuelList = (rival) => {
    const pool = []; for (let i = 0; i < POOLS[rival]; i++) pool.push(i);
    return listRng.shuffle(pool).slice(0, FIGURES_PER_DUEL).sort((a, b) => a - b);
  };
  function startLadder(idx) {
    if (demoFull()) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.m = { mode: 'ladder', figure: idx, over: null, res: [], pts: { you: 0, rival: 0 } };
    state.names = { ...state.names, you: 'You' };
    beginFigure(idx, ['you']);
  }
  function startDuel(rival) {
    if (demoFull()) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const list = pickDuelList(rival);
    state.m = { mode: 'duel', rival, list, i: 0, extra: false, pts: { you: 0, rival: 0 }, res: [], over: null };
    state.names = { ...state.names, you: 'You', rival: RIVALS[rival].name };
    beginFigure(list[0], ['you', 'rival']);
  }
  function startWatch() {
    const pool = [0, 1, 2, 3]; const a = pool.splice(aiRng.int(pool.length), 1)[0], b = pool[aiRng.int(pool.length)];
    const list = [aiRng.int(8), 6 + aiRng.int(6)];
    state.m = { mode: 'watch', a, b, list, i: 0, over: null, res: [], pts: { you: 0, rival: 0 } };
    state.names = { ...state.names, a: RIVALS[a].name, b: RIVALS[b].name };
    beginFigure(list[0], ['a', 'b']);
  }
  function beginFigure(idx, order) {
    state.fig = FIGURES[idx]; state.figIdx = idx;
    state.order = order; state.turnK = 0; state.figResult = {};
    state.figDone = false;
    startTurn(0);
  }
  const whoName = (who) => (who === 'you' ? 'You' : who === 'rival' ? state.names.rival : who === 'a' ? state.names.a : state.names.b);
  const rivalFor = (who) => (who === 'rival' ? RIVALS[state.m.rival] : who === 'a' ? RIVALS[state.m.a] : RIVALS[state.m.b]);
  function startTurn(k) {
    const who = state.order[k];
    state.turnK = k;
    state.w = createTown(figurePins(state.figIdx));
    state.figTotal = state.w.pins.length;
    state.turn = { k, who, name: whoName(who), used: 0, bats: state.fig.bats, cleared: false, ph: 'ready', t: 0, plan: null };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.reasonOpen = false; state.ui.scroll = 0;
    state.figRes = null; state.hint = null; state.hl = null; state.plans = null; state.think = null; state.card = null; state.drag = null; state.aimShow = 0;
    state.humanTurnAim = false; state.fx = newFx();
    const human = who === 'you';
    state.aim = { x: 0, z: 0.1, style: state.aim ? state.aim.style : 'drive' };
    state.banner = { text: human ? `${state.fig.name}: your turn` : `${state.turn.name}: ${state.fig.name}`, col: human ? '#ffe08a' : '#cfe6ff', t: 1.2, max: 1.2 };
    state.toast = ''; state.toastT = 0;
    if (human && state.m.mode === 'ladder') toast(state.fig.tip, 5);
  }

  // ---- throwing -----------------------------------------------------------------------------------------------------------------
  // A throw is two steps: the thrower winds up for WIND_T seconds (the arm goes back, the bat is still in the hand), then the bat leaves
  // the hand and the physics runs. The wind-up is part of the turn clock, so it pauses with the game.
  function launch(style, x, z, k) {
    const tl = state.turn;
    tl.used++; tl.ph = 'wind'; tl.t = 0; tl.pend = { style, x, z, k };
    state.hint = null; state.hl = null; state.humanTurnAim = false; state.plans = null; state.aimShow = 0; state.card = null; state.think = null;
  }
  function releaseBat() {
    const w = state.w, tl = state.turn, p = tl.pend;
    const noise = scatterFor(tl.who === 'you' ? humanRng : aiRng, p.style, p.k);
    throwBat(w, p.style, { x: p.x, z: p.z }, noise);
    tl.ph = 'fly'; tl.t = 0; tl.pend = null;
  }
  function humanThrow() {
    const tl = state.turn;
    if (!tl || tl.who !== 'you' || tl.ph !== 'aim' || state.paused) return;
    launch(state.aim.style, state.aim.x, state.aim.z, HUMAN_K);
  }
  function requestHint() {
    const tl = state.turn;
    if (!tl || tl.who !== 'you' || tl.ph !== 'aim') return;
    const adv = advise(state.w);
    state.aim = { x: adv.x, z: adv.z, style: adv.style };
    state.hint = { title: `Hint: ${STYLES[adv.style].name}`, text: adv.text.text, first: adv.first };
    state.hintT = 14; state.hl = adv.first;
    sfx.tick();
  }

  // ---- the turn state machine -----------------------------------------------------------------------------------------------------
  function afterThrow() {
    const tl = state.turn, w = state.w;
    const left = w.pins.filter((p) => !p.out).length;
    const gone = w.outNow.length;
    for (const p of w.pins) if (p.out && p.outT === undefined) p.outT = state.t;
    if (gone > 0) { sfx.out(); const c = w.pins.find((p) => p.id === w.outNow[0]); if (c) pop(state.fx, c.x, c.z, `${gone} out`, '#9dffb8', 32); }
    else toast('Nothing left the square', 1.8);
    tl.ph = 'after'; tl.t = 0;
    if (left === 0) { tl.cleared = true; sfx.clear(); }
  }
  function endTurn() {
    const tl = state.turn;
    state.figResult[tl.who] = tl.cleared ? tl.used : null;
    if (state.turnK + 1 < state.order.length) { startTurn(state.turnK + 1); return; }
    finishFigure();
  }
  const cost = (v) => (v === null || v === undefined ? 99 : v);
  function finishFigure() {
    const m = state.m, f = state.fig, r = state.figResult ?? {};
    state.record.demoFigs = (state.record.demoFigs | 0) + 1;
    state.figDone = true;
    if (m.mode === 'ladder') {
      const used = r.you === undefined ? null : r.you;
      let title, text, good = true, buttons;
      if (used !== null) {
        const st = starsFor(f.bats, used);
        state.record.ladder[m.figure] = Math.max(state.record.ladder[m.figure] | 0, st);
        state.record.played++;
        title = `Cleared in ${used} bat${used === 1 ? '' : 's'}`;
        text = `${f.name}: ${'★'.repeat(st)}${'☆'.repeat(3 - st)}. You had ${f.bats} bats.`;
        const next = m.figure + 1 < FIGURES.length;
        buttons = [];
        if (next) buttons.push({ id: 'fig-next', label: `Next: ${FIGURES[m.figure + 1].name}` });
        buttons.push({ id: 'fig-again', label: 'Play it again' }, { id: 'fig-menu', label: 'Figure ladder' });
      } else {
        good = false; title = 'Not this time';
        text = `Pins were still in the square after all ${f.bats} bats. ${f.tip}`;
        buttons = [{ id: 'fig-again', label: 'Try again' }, { id: 'fig-menu', label: 'Figure ladder' }];
      }
      state.figRes = { title, text, score: '', good, buttons };
      save();
    } else if (m.mode === 'duel') {
      const you = r.you === undefined ? null : r.you, rv = r.rival === undefined ? null : r.rival;
      m.res.push({ name: f.name, you, rival: rv });
      let line;
      if (cost(you) < cost(rv)) { m.pts.you++; line = 'You take the figure.'; } else if (cost(you) > cost(rv)) { m.pts.rival++; line = `${state.names.rival} takes the figure.`; } else line = cost(you) === 99 ? 'Neither of you cleared it.' : 'Level: nobody scores.';
      const wt = (v) => (v === null ? 'not cleared' : `${v} bat${v === 1 ? '' : 's'}`);
      const more = m.i + 1 < m.list.length;
      const level = m.pts.you === m.pts.rival;
      const needExtra = !more && !m.extra && level;
      const decided = !more && !needExtra;
      if (decided) {
        const win = m.pts.you > m.pts.rival, draw = m.pts.you === m.pts.rival;
        m.over = { win, draw, extra: m.extra };
        state.record.played++;
        if (win) state.record.wins[m.rival]++;
      }
      state.figRes = {
        title: line, good: cost(you) <= cost(rv) && cost(you) < 99,
        text: `${f.name}: you ${wt(you)}, ${state.names.rival} ${wt(rv)}.`,
        score: `Score: you ${m.pts.you}, ${state.names.rival} ${m.pts.rival}${needExtra ? '. Level after five figures: one extra figure decides it.' : ''}`,
        buttons: [{ id: decided ? 'fig-result' : 'fig-next', label: decided ? 'See the result' : needExtra ? 'Extra figure' : `Figure ${m.i + 2}` }],
      };
      state.nextExtra = needExtra;
      save();
    } else {
      const a = r.a === undefined ? null : r.a, b = r.b === undefined ? null : r.b;
      const wt = (v) => (v === null ? 'did not clear it' : `cleared it in ${v} bat${v === 1 ? '' : 's'}`);
      state.figRes = {
        title: 'Figure over', good: true,
        text: `${f.name}: ${state.names.a} ${wt(a)}; ${state.names.b} ${wt(b)}.`, score: '',
        buttons: [{ id: 'fig-next', label: 'Another figure' }, { id: 'fig-menu', label: 'Back to the menu' }],
      };
    }
    state.scene = 'play'; state.ui.scroll = 0;
  }
  function figNext() {
    const m = state.m;
    state.figRes = null;
    if (m.mode === 'ladder') {
      if (demoFull()) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
      const n = m.figure + 1;
      if (n < FIGURES.length) { m.figure = n; beginFigure(n, ['you']); } else { state.scene = 'ladder'; state.ui.scroll = 0; }
      return;
    }
    if (m.mode === 'duel') {
      if (demoFull()) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
      if (state.nextExtra) {
        m.extra = true;
        const pool = []; for (let i = 0; i < POOLS[m.rival]; i++) if (!m.list.includes(i)) pool.push(i);
        m.list.push(pool.length ? listRng.pick(pool) : listRng.int(POOLS[m.rival]));
      }
      m.i++;
      beginFigure(m.list[m.i], m.i % 2 === 0 ? ['you', 'rival'] : ['rival', 'you']);
      return;
    }
    m.i++;
    if (m.i >= m.list.length) m.list.push(aiRng.int(FIGURES.length));
    beginFigure(m.list[m.i], m.i % 2 === 0 ? ['a', 'b'] : ['b', 'a']);
  }

  // The human's controls and the computer player's timing for the current turn.
  function tickTurn(dt, input, lay, cam) {
    const tl = state.turn, w = state.w, m = state.m;
    if (!tl) return;
    const human = tl.who === 'you';
    if (tl.ph === 'ready') {
      tl.t += dt;
      if (tl.t >= 1.0) { tl.ph = human ? 'aim' : 'plan'; tl.t = 0; }
    }
    if (tl.ph === 'aim') {
      state.humanTurnAim = human; humanInput(dt, input, lay, cam);
    } else if (tl.ph === 'plan') {
      // a computer player reads the figure with the same physics (the work is done now; the pause that follows is for the player)
      const rv = rivalFor(tl.who);
      const ch = choose(w, rv, aiRng);
      tl.plan = ch; tl.rival = rv; tl.t = 0;
      tl.from = { x: state.aim.x, z: state.aim.z };
      if (m.mode === 'watch') {
        state.plans = [];
        for (const q of ch.plans) { if (state.plans.length >= 3) break; if (state.plans.every((o) => Math.hypot(o.x - q.x, o.z - q.z) > 0.3)) state.plans.push(q); }
        state.think = { phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx] };
        state.card = { title: `${tl.name} studies the ${state.fig.name}`, text: '', reveal: false };
        tl.ph = 'wthink';
      } else { tl.ph = 'move'; tl.dur = rv.think; state.aimShow = 1; }
    } else if (tl.ph === 'move') {
      tl.t += dt;
      const k = Math.min(1, tl.t / tl.dur), e = k * k * (3 - 2 * k), p = tl.plan;
      state.aim.x = tl.from.x + (p.x - tl.from.x) * e; state.aim.z = tl.from.z + (p.z - tl.from.z) * e; state.aim.style = p.style;
      if (tl.t >= tl.dur + 0.35) launch(p.style, p.x, p.z, tl.rival.scatter);
    } else if (tl.ph === 'wthink' || tl.ph === 'wreveal') {
      const th = state.think; th.t += dt; const p = tl.plan;
      if (tl.ph === 'wthink' && th.t >= th.dur) {
        tl.ph = 'wreveal'; th.phase = 'reveal'; th.t = 0; th.dur = 2;
        state.card = { title: `${tl.name} picks: ${STYLES[p.style].name}`, text: describePlan(p), reveal: true };
        state.aim = { x: p.x, z: p.z, style: p.style }; state.aimShow = 1; state.hl = p.first;
        state.plans = [p];
      } else if (tl.ph === 'wreveal' && th.t >= th.dur) {
        launch(p.style, p.x, p.z, tl.rival.scatter);
      }
    } else if (tl.ph === 'wind') {
      tl.t += dt;
      if (tl.t >= WIND_T) releaseBat();
    } else if (tl.ph === 'fly') {
      const ev = stepTown(w);
      handleEvents(w, state.fx, ev, true);
      if (w.phase === 'done') afterThrow();
    } else if (tl.ph === 'after') {
      tl.t += dt;
      if (tl.t > (tl.cleared ? 1.5 : 0.9)) {
        const left = w.pins.filter((p) => !p.out).length;
        if (tl.cleared || tl.used >= tl.bats || left === 0) {
          if (!tl.cleared && left > 0 && tl.who === 'you') toast('Out of bats', 1.6);
          endTurn();
        } else {
          w.phase = 'aim'; tl.ph = human ? 'aim' : 'plan'; tl.t = 0; state.hint = null;
        }
      }
    }
  }
  function describePlan(p) {
    const S = STYLES[p.style];
    const total = state.w.pins.filter((q) => !q.out).length;
    const exp = Math.round(p.out);
    const side = p.style === 'sweep' ? 'The sweep is wide, so it brushes the whole row' : p.style === 'drive' ? 'The drive is narrow and firm, so the line has to be right' : 'The smash is hard, so pins fly far and knock others out';
    return `${S.name}: ${side}. The planner expects about ${exp} of ${total} pins out${exp >= total ? ': the whole figure' : ''}. The ring is the landing point; the bat slides on from there.`;
  }

  // ---- the human's controls ---------------------------------------------------------------------------------------------------------
  function humanInput(dt, input, lay, cam) {
    const ptr = input.pointer, keys = input.keys;
    const bar = lay.bar.rects, hudPause = lay.hud.pause;
    const onUi = (x, y) => inRect(hudPause, x, y) || Object.values(bar).some((r) => inRect(r, x, y)) || y < lay.regionTop || y > lay.regionBottom || (lay.mode === 'wide' && !inRect(lay.region, x, y));
    if (ptr.pressed) {
      if (!inRect(hudPause, ptr.x, ptr.y)) {
        for (const [rid, r] of Object.entries(bar)) {
          if (!inRect(r, ptr.x, ptr.y)) continue;
          sfx.tick();
          if (rid === 'sweep' || rid === 'drive' || rid === 'smash') state.aim.style = rid;
          else if (rid === 'style') { const ids = ['sweep', 'drive', 'smash']; state.aim.style = ids[(ids.indexOf(state.aim.style) + 1) % 3]; }
          else if (rid === 'think') requestHint();
          else if (rid === 'throw') humanThrow();
        }
      }
      if (!onUi(ptr.x, ptr.y)) state.drag = { lx: ptr.x, ly: ptr.y };
    }
    if (state.drag) {
      if (!ptr.down) state.drag = null;
      else if (Math.hypot(ptr.x - state.drag.lx, ptr.y - state.drag.ly) <= 320) {
        state.drag.lx = ptr.x; state.drag.ly = ptr.y;
        const g = cam.groundAt(ptr.x, ptr.y - 56);
        state.aim.x = clamp(g.x, AIM.x0, AIM.x1); state.aim.z = clamp(g.z, AIM.z0, AIM.z1);
        if (state.hint) { state.hint = null; state.hl = null; }
      }
    }
    const k = 0.025;
    if (keys.down.has('ArrowLeft')) state.aim.x = clamp(state.aim.x - k, AIM.x0, AIM.x1);
    if (keys.down.has('ArrowRight')) state.aim.x = clamp(state.aim.x + k, AIM.x0, AIM.x1);
    if (keys.down.has('ArrowUp')) state.aim.z = clamp(state.aim.z + k, AIM.z0, AIM.z1);
    if (keys.down.has('ArrowDown')) state.aim.z = clamp(state.aim.z - k, AIM.z0, AIM.z1);
    if (keys.pressed.has('Space') || keys.pressed.has('Enter')) humanThrow();
    if (keys.pressed.has('Digit1')) state.aim.style = 'sweep';
    if (keys.pressed.has('Digit2')) state.aim.style = 'drive';
    if (keys.pressed.has('Digit3')) state.aim.style = 'smash';
    if (keys.pressed.has('KeyQ')) { const ids = ['sweep', 'drive', 'smash']; state.aim.style = ids[(ids.indexOf(state.aim.style) + 1) % 3]; }
    if (keys.pressed.has('KeyH')) requestHint();
    void dt;
  }

  // ---- the play scene --------------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leaveMatch = () => {
    const ladder = state.m && state.m.mode === 'ladder';
    state.scene = ladder ? 'ladder' : 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.think = null; state.drag = null; state.card = null; state.hint = null; state.figRes = null; state.reasonOpen = false; state.turn = null; state.plans = null; state.humanTurnAim = false;
  };
  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) {
      const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top));
      state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max);
    }
  }
  function modalInput(ptr, key, handler) {
    ensureLayout(state, key);
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      if (d.moved < 10 && flowMeta().key === key) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
    }
  }
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    const st = state.settings;
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.ui.scroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.ui.scroll = 0; }
    else if (id === 'p-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); save(); }
    else if (id === 'p-guide') { st.guide = (st.guide + 1) % 3; save(); }
    else if (id === 'p-txtdec') { st.textIdx = Math.max(0, st.textIdx - 1); save(); resetMenus(); }
    else if (id === 'p-txtinc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); save(); resetMenus(); }
    else if (id === 'quit') leaveMatch();
  }
  function handleFigTap(id) {
    if (!id) return;
    sfx.tick();
    const m = state.m;
    if (id === 'fig-next') figNext();
    else if (id === 'fig-again') { state.figRes = null; beginFigure(m.mode === 'ladder' ? m.figure : state.figIdx, ['you']); }
    else if (id === 'fig-menu') leaveMatch();
    else if (id === 'fig-result') { state.figRes = null; if (m.over && m.over.win) sfx.win(); state.scene = 'result'; state.ui.scroll = 0; }
  }

  function updatePlay(dt, input) {
    const m = state.m, ptr = input.pointer, keys = input.keys;
    const lay = layoutFor(state);
    const cam = camFor(state, lay);
    state.cam = { lay };
    if (state.figRes) { modalInput(ptr, 'figres', handleFigTap); return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) {
      if (state.pauseMenu) closePause(); else if (state.reasonOpen) state.reasonOpen = false; else if (m.mode === 'watch') state.paused = !state.paused; else openPause();
    }
    if (state.pauseMenu) { modalInput(ptr, 'pause', handlePauseTap); return; }
    if (state.reasonOpen) { modalInput(ptr, 'reason', (id) => { if (id === 'reason-close') { state.reasonOpen = false; sfx.tick(); } }); return; }
    if (ptr.pressed && state.cardRect && inRect(state.cardRect, ptr.x, ptr.y)) { state.reasonOpen = true; state.ui.scroll = 0; sfx.tick(); return; }
    if (ptr.pressed) {
      if (inRect(lay.hud.pause, ptr.x, ptr.y)) { if (m.mode === 'watch') state.paused = !state.paused; else openPause(); sfx.tick(); return; }
      if (m.mode === 'watch') {
        const b = lay.bar.rects;
        if (inRect(b.wpause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(b.wdec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(b.winc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(b.wexit, ptr.x, ptr.y)) { leaveMatch(); return; }
      }
    }
    if (state.paused) return;
    // everything below is the live turn; nothing advances while paused (timers, planning, the bat in the air, effects)
    if (state.toastT > 0) state.toastT -= dt;
    if (state.hintT > 0) { state.hintT -= dt; if (state.hintT <= 0) { state.hint = null; state.hl = null; } }
    if (state.banner && state.banner.t > 0) state.banner.t -= dt;
    tickTurn(dt, input, lay, cam);
    stepFx(state.fx, dt);
  }

  // ---- menus ------------------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { pressLockup(); env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'ladder') { state.scene = 'ladder'; state.ui.scroll = 0; }
    else if (id === 'duel') { state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.ui.scroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    sfx.tick();
    if (id.startsWith('lvl')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } state.setup.rival = i; state.setupMsg = ''; }
    else if (id === 'start') startDuel(state.setup.rival);
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleLadder = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
    else if (id.startsWith('fig')) { const i = Number(id.slice(3)); if (state.demo && i >= DEMO_LADDER_CAP) return; if (!(state.dev || i === 0 || state.record.ladder[i - 1] > 0)) { sfx.tick(); return; } startLadder(i); }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-guide') st.guide = (st.guide + 1) % 3;
    else if (id === 'set-haptics') { st.haptics = !st.haptics; if (st.haptics && typeof env.haptic === 'function') env.haptic(25); }
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      if (monetization.owns('unlock_game')) { state.restoreMsg = 'Full game unlocked.'; save(); return; }
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'again') startDuel(state.m.rival);
    else if (id === 'new') { state.setup.rival = state.m.rival; state.scene = 'setup'; state.ui.scroll = 0; }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };

  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key);
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
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); resetMenus(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); resetMenus(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) { handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };
  const updatePages = (input, list, header) => {
    const ptr = input.pointer, keys = input.keys;
    ensureReader(state, list, header);
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.ui.scroll = 0; state.ui.drag = null; };
    const setSz = (d) => { state.settings.textIdx = clamp(state.settings.textIdx + d, 0, TEXT_SCALES.length - 1); state.ui.scroll = 0; save(); };
    if (ptr.pressed) {
      if (inRect(REF_CLOSE, ptr.x, ptr.y)) { close(); return; }
      if (inRect(TEXT_DEC, ptr.x, ptr.y)) { setSz(-1); return; }
      if (inRect(TEXT_INC, ptr.x, ptr.y)) { setSz(1); return; }
      state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
    }
    const max = readerMax();
    if (state.ui.drag && ptr.down) { const d = state.ui.drag; d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
    if (!ptr.down) state.ui.drag = null;
    if (keys.down.has('ArrowDown')) state.ui.scroll += 16;
    if (keys.down.has('ArrowUp')) state.ui.scroll -= 16;
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) state.ui.scroll += 700;
    if (keys.pressed.has('PageUp')) state.ui.scroll -= 700;
    if (keys.pressed.has('Home')) state.ui.scroll = 0;
    if (keys.pressed.has('End')) state.ui.scroll = max;
    if (keys.pressed.has('Equal') || keys.pressed.has('NumpadAdd')) setSz(1);
    if (keys.pressed.has('Minus') || keys.pressed.has('NumpadSubtract')) setSz(-1);
    if (keys.pressed.has('Escape')) { close(); return; }
    state.ui.scroll = clamp(state.ui.scroll, 0, max);
  };

  // ---- showcase (store screenshots: ?shot=1 plays a scripted, real position instead of the random player) -------------------------
  const BLANK = () => ({ pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } });
  function setupShowcase(kind) {
    state.shotMode = { kind, tick: 0 };
    if (kind === 4) { startWatch(); state.settings.thinkIdx = 0; return; }
    if (kind === 3) { state.setup.rival = 1; startDuel(1); }
    else startLadder([5, 8, 9][kind] ?? 5);
    state.turn.ph = 'aim'; state.banner = null; state.toastT = 0;
  }
  function showcaseStep() {
    const sm = state.shotMode, k = sm.kind;
    sm.tick++;
    if (!state.turn || k === 4) return;
    if (k === 0 || k === 3) { if (sm.tick === 2 && state.turn.ph === 'aim') requestHint(); return; }
    if (sm.tick === 3 && state.turn.ph === 'aim') { const adv = advise(state.w); state.aim = { x: adv.x, z: adv.z, style: adv.style }; launch(adv.style, adv.x, adv.z, 0); }
  }

  let lastSize = '';
  const syncSize = () => {
    setSize(meta.width, meta.height);
    const k = sizeKey();
    if (k === lastSize) return;
    if (lastSize) { state.drag = null; state.ui.drag = null; resetMenus(); }
    lastSize = k;
  };
  syncSize();
  for (const k of ['cardRect', 'cardFull', 'cam', 'figIdx', 'order', 'turnK', 'figResult', 'nextExtra', 'devHold']) Object.defineProperty(state, k, { value: undefined, writable: true, enumerable: false });
  startAttract(0);
  resetMenus();
  if (SHOT_MODE) {
    setupShowcase((Number(config.seed) | 0) % 5);
    const q = (kk) => { try { const mm = new RegExp(`[?&]${kk}=([a-z0-9]+)`).exec(globalThis.location.search); return mm ? mm[1] : null; } catch { return null; } };
    if (q('zoom')) state.settings.textIdx = clamp(Number(q('zoom')) | 0, 0, 4);
    const v = q('view');
    if (v) {
      state.shotMode = v === 'pause' ? state.shotMode : null;
      if (v === 'pause') openPause();
      else if (v === 'figres') { state.figResult = { you: 2, rival: 3 }; finishFigure(); }
      else if (v === 'result') {
        state.m = { mode: 'duel', rival: 1, list: [0, 1, 2, 3, 4], i: 4, pts: { you: 3, rival: 2 }, res: [{ name: 'Gate', you: 2, rival: 3 }, { name: 'Cannon', you: 2, rival: 2 }, { name: 'Tongs', you: 1, rival: 3 }, { name: 'Fork', you: null, rival: 2 }, { name: 'Sickle', you: 2, rival: null }], over: { win: true, draw: false, extra: false } };
        state.names.rival = 'Varya'; state.scene = 'result';
      } else if (v === 'rules' || v === 'about' || v === 'howto') { state.scene = v; state.back = 'title'; state.ui.scroll = Number(q('scroll')) | 0; }
      else if (v === 'watch') { startWatch(); state.shotMode = null; }
      else state.scene = v;
    }
    const adv = Number(q('ticks')) | 0;   // review aid: play this many fixed steps before the first frame
    if (adv > 0 && state.scene === 'play') {
      const blank = BLANK();
      for (let i = 0; i < adv; i++) { state.t += DT; if (state.shotMode) showcaseStep(); updatePlay(DT, blank); }
    }
  }

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused turn does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.mode !== 'watch' && state.turn && !state.figRes) || state.paused || state.reasonOpen,
    // Review aid (?dev=1): freeze the clock and step the play scene by whole fixed steps, so a throw can be inspected frame by frame.
    devHold(on = true) { state.devHold = !!on; },
    devThrow(style, x = 0, z = 0.9) { const tl = state.turn; if (tl && tl.who === 'you' && tl.ph === 'aim') { state.aim.style = style; launch(style, x, z, 0); } },
    devStep(n = 1) { const blank = BLANK(); for (let i = 0; i < n; i++) { state.t += DT; if (state.shotMode) showcaseStep(); updatePlay(DT, blank); } },
    update(dt, input) {
      if (state.devHold) return;
      syncSize();
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') updateAttract();
      if (state.shotMode) {
        showcaseStep();
        if (state.scene === 'play') updatePlay(dt, BLANK());
        return;
      }
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'ladder': updateFlowScene(dt, input, handleLadder, 'ladder'); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': updatePages(input, HOWTO, 'How to Play'); break;
        case 'about': updatePages(input, aboutList(), 'About'); break;
        case 'rules': updatePages(input, RULES, 'Rules'); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      syncSize();
      // the kit canvas is transparent (the 3D town is drawn behind it): clear the last frame, and paint the flat backdrop when there is no 3D
      ctx.clearRect(0, 0, W, H);
      if (!GL.on) { ctx.fillStyle = '#16243a'; ctx.fillRect(0, 0, W, H); }
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'ladder': renderLadder(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, aboutList(), 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.m && state.w) renderPlay(ctx, state);
          if (state.pauseMenu) renderPause(ctx, state);
          else if (state.reasonOpen) renderReason(ctx, state);
          else if (state.figRes) renderFigRes(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    // Check scripts only: every tappable rectangle on the screen right now (ui: true) plus the big areas (ui: false).
    debugRects() {
      const out = [], add = (n, r, ui = true) => { if (r) out.push({ n, x: r.x, y: r.y, w: r.w, h: r.h, ui }); };
      const mt = flowMeta();
      const flow = () => { if (mt.lay) for (const it of mt.lay.items) if (it.w.t === 'btn') { const y = mt.top + it.y - state.ui.scroll; if (y >= mt.top - 1 && y + it.h <= mt.bottom + 1) add(`btn:${it.w.id}`, { x: it.x, y, w: it.wd, h: it.h }); } };
      if (state.scene === 'play' && state.m && state.w) {
        const lay = layoutFor(state);
        add('pause', lay.hud.pause); for (const [id, r] of Object.entries(lay.bar.rects)) add(`bar:${id}`, r);
        add('town', lay.region, false); if (lay.cards) { add('leftCard', lay.cards.left, false); add('rightCard', lay.cards.right, false); }
        if (state.pauseMenu || state.reasonOpen || state.figRes) { out.length = 0; flow(); }
      } else if (state.scene === 'howto' || state.scene === 'about' || state.scene === 'rules') {
        const g = readerGeo(); add('textDec', g.textDec); add('textInc', g.textInc); add('close', g.close); add('panel', g.panel, false);
      } else { flow(); if (state.scene === 'setup') { const p = setupPinsGeo(); add('start', p.start); add('back', p.back); } }
      return out;
    },
    debugHost: () => ({ ...host }),
    wheel(dy) {
      const reader = state.scene === 'howto' || state.scene === 'about' || state.scene === 'rules';
      const mt = flowMeta();
      const max = reader ? readerMax() : mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
      state.ui.scroll = clamp(state.ui.scroll + dy, 0, max);
    },
  };
}
export { MAX_THROWS };
