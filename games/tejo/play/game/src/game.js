// GAME CONTRACT (docs/GAME-CONTRACT.md): export meta + createGame(env) -> { update, render, getState }.
// Tejo (Turmequé): slide to place a target mark on the clay box, lift to throw a steel disc, score the ring, the paper mechas and the closest disc.
// State machine: title / setup / settings / howto / about / rules / play / result / demolimit. Play phases:
//   intro -> aim (human) | think -> [reveal] -> act (computer) -> fly -> settle -> ... -> bonus -> roundEnd -> intro | over
import {
  newBoard, refreshMechas, resolveThrow, applyThrow, roundBonus, chooseTarget, explain, LEVELS, TARGETS, DISCS_EACH, HUMAN_SIGMA,
  TREMOR_START, TREMOR_MAX, POINTS, RING, mecha,
} from './sim.js';
import { FR, topSafe, setFrame, TEXT_SCALES, THINK_STEPS, REVEAL_SECS, playLayout, readerLayout, inRect } from './layout.js';
import { emit, stepFx, TEAM, P, FLAG } from './art.js';
import { setPress } from './ui.js';
import { renderTitle, renderFlow, renderModal, renderReader, hitFlow, flowMax, readerState, sideNames, flowRects } from './menus.js';
import { renderPlay, T_FLY, isHuman, hintRects, baseSigma } from './view.js';
import { pressLockup } from './brand.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };

const SU = 0.22, SV = 0.30;                 // cm of target mark per unit of thumb travel (sideways, up/down)
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const easeIO = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
const NOINPUT = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() }, wheel: { dx: 0, dy: 0 } };
const DEMO_MATCHES = 2;

export function createGame(env) {
  const { rng, storage, monetization, audio, config } = env;
  let shotMode = false;
  try { shotMode = /[?&]shot=/.test(globalThis.location.search); } catch { shotMode = false; }

  const state = {
    scene: 'title', t: 0, shot: false, demo: !!config.demo, layKey: '',
    settings: { textIdx: 0, thinkIdx: 1, sound: true, guide: true },
    record: { played: 0, wins: 0, rings: 0, pops: 0, monas: 0, practiceBest: 0, demoGames: 0 },
    setup: { mode: 'ai', opp: 1, target: 1 },
    ui: { scroll: 0, drag: null, page: 0, back: 'title' },
    m: null, resume: null, prevBest: 0,
    fx: [], floats: [], shake: 0, paused: false, pauseMenu: false, hint: null,
    evs: [], evId: 0,   // presenter feed: { id, type, ... }; the sim never reads it
    owned: !!monetization.owns?.('unlock_game'), restoreMsg: '', restoreBusy: false,
  };
  monetization.onChange?.(() => { state.owned = !!monetization.owns('unlock_game'); });
  const frand = () => rng.next();
  const note = (o) => { state.evs.push({ id: ++state.evId, ...o }); if (state.evs.length > 48) state.evs.shift(); };

  // ---- saving ------------------------------------------------------------------------------------------------------------------
  const saveSettings = () => storage.set('settings', state.settings);
  const saveRecord = () => storage.set('record', state.record);
  const snapshot = (m) => ({ cfg: m.cfg, board: m.board, score: m.score, round: m.round, rounds: m.rounds, perRound: m.perRound, left: m.left, first: m.first, k: m.k, stats: m.stats, target: m.target, lastAim: m.lastAim });
  const saveResume = () => { const m = state.m; if (m && m.cfg.mode !== 'watch' && m.ph !== 'over') { state.resume = JSON.parse(JSON.stringify(snapshot(m))); storage.set('resume', state.resume); } };
  const clearResume = () => { state.resume = null; storage.remove('resume'); };
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('resume', null)]).then(([s, r, res]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    if (res && res.cfg && res.board && res.score && !shotMode) state.resume = res;
    audio.setMuted(!state.settings.sound);
  });

  // ---- sound -------------------------------------------------------------------------------------------------------------------
  let budget = 0;
  const tone = (o) => { if (budget < 4) { budget++; audio.tone(o); } };
  const sfx = {
    whoosh: () => tone({ freq: 380, to: 120, dur: 0.35, type: 'sine', vol: 0.08 }),
    thud: () => { tone({ freq: 130, to: 45, dur: 0.22, type: 'sine', vol: 0.34 }); tone({ freq: 260, to: 90, dur: 0.08, type: 'triangle', vol: 0.12 }); },
    clink: () => { tone({ freq: 1900, to: 1500, dur: 0.1, type: 'triangle', vol: 0.12 }); tone({ freq: 2500, to: 2100, dur: 0.07, type: 'sine', vol: 0.08 }); },
    pop: () => { tone({ freq: 1200, to: 90, dur: 0.12, type: 'square', vol: 0.16 }); tone({ freq: 700, to: 60, dur: 0.18, type: 'sawtooth', vol: 0.08 }); },
    ring: () => { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.14 + i * 0.03, type: 'triangle', vol: 0.12 })); },
    miss: () => tone({ freq: 160, to: 80, dur: 0.25, type: 'sine', vol: 0.12 }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'square', vol: 0.05 }),
    win: () => [523, 659, 784, 1047].forEach((f) => tone({ freq: f, dur: 0.2, type: 'triangle', vol: 0.12 })),
  };

  // ---- match setup ---------------------------------------------------------------------------------------------------------------
  const sideAt = (m, k) => (m.cfg.mode === 'solo' ? 0 : (m.first + k) % 2);
  const throwsPerRound = (m) => (m.cfg.mode === 'solo' ? m.perRound : m.perRound * 2);
  const newMatch = (cfg, from = null) => {
    const solo = cfg.mode === 'solo';
    const m = from ? { ...from } : {
      cfg, board: newBoard(), score: [0, 0], round: 1, rounds: solo ? 3 : 0, perRound: solo ? 4 : DISCS_EACH, left: solo ? [4, 0] : [DISCS_EACH, DISCS_EACH],
      first: solo ? 0 : rng.int(2), k: 0, target: solo ? 0 : TARGETS[cfg.target] ?? TARGETS[1],
      stats: { rings: [0, 0], pops: [0, 0], monas: [0, 0], throws: [0, 0] }, lastAim: [{ u: 50, v: 50 }, { u: 50, v: 50 }],
    };
    Object.assign(m, { cfg, ph: 'intro', pt: 0, turn: sideAt(m, m.k), aimShown: null, drag: null, hold: 0, fl: null, plan: null, banner: null, bonus: null, bonusDone: false, winner: -1, pendingWin: -1, thinkDur: 1 });
    m.aim = { ...m.lastAim[m.turn] };
    for (const d of m.board.discs) { d.du = d.u; d.dv = d.v; }
    return m;
  };
  const startMatch = (cfg, from = null) => {
    if (state.demo && cfg.mode !== 'watch' && !from && state.record.demoGames >= DEMO_MATCHES) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.prevBest = state.record.practiceBest;
    state.m = newMatch(cfg, from);
    state.scene = 'play'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false; state.hint = null; state.fx = []; state.floats = []; state.shake = 0;
    if (!from && state.demo && cfg.mode !== 'watch') { state.record.demoGames++; saveRecord(); }
    if (cfg.mode !== 'watch') monetization.track('match_start', { mode: cfg.mode });
  };

  // ---- a turn --------------------------------------------------------------------------------------------------------------------
  const levelOf = (m, side) => (m.cfg.mode === 'watch' ? m.cfg.watch[side] : m.cfg.opp);
  const beginTurn = () => {
    const m = state.m;
    m.turn = sideAt(m, m.k);
    m.aim = { ...m.lastAim[m.turn] }; m.aimShown = null; m.drag = null; m.hold = 0; m.fl = null; state.hint = null; m.plan = null;
    if (isHuman(m, m.turn)) { m.ph = 'aim'; m.pt = 0; return; }
    const lv = LEVELS[levelOf(m, m.turn)], watch = m.cfg.mode === 'watch';
    const res = chooseTarget(m.board, m.turn, lv.sigma, rng.int(1 << 30), { quality: lv.search, samples: watch ? 16 : 12, detail: true });
    const pick = res.best;
    m.plan = { u: pick.u, v: pick.v, text: explain(pick, m.board), top: res.top.slice(0, 4).map((c) => ({ u: c.u, v: c.v })), from: { ...m.aim } };
    m.thinkDur = watch ? THINK_STEPS[state.settings.thinkIdx] : lv.think[0] + frand() * (lv.think[1] - lv.think[0]);
    m.ph = 'think'; m.pt = 0;
  };

  const floatAt = (x, y, text, col, o = {}) => state.floats.push({ x, y, text, col, t: 0, life: o.life ?? 1.2, size: o.size ?? 40, big: !!o.big });
  const banner = (text, sub, col) => { state.m.banner = { text, sub, col, t: 0, life: 1.5 }; };

  const release = (aim) => {
    const m = state.m, side = m.turn;
    const a = { u: clamp(aim.u, -8, 108), v: clamp(aim.v, -8, 112) };
    const res = resolveThrow(m.board, side, a, baseSigma(state, side), rng.int(1 << 30));
    const ev = [{ t: T_FLY, type: 'land' }];
    res.pops.forEach((p) => ev.push({ t: T_FLY + 0.1 + (0.5 * p.at) / Math.max(1, res.path.length - 1), type: 'pop', i: p.i, u: p.u, v: p.v }));
    if (res.ring) ev.push({ t: T_FLY + 0.2, type: 'ring' });
    ev.push({ t: T_FLY + 1.0, type: 'end' });
    ev.sort((x, y) => x.t - y.t);
    m.fl = { res, t: 0, ev, i: 0, id: 0 };
    m.left[side]--; m.k++; m.stats.throws[side]++;
    m.lastAim[side] = { u: clamp(a.u, 4, 96), v: clamp(a.v, 4, 96) };
    m.ph = 'fly'; m.pt = 0; m.drag = null; m.aimShown = null; state.hint = null;
    note({ type: 'throw', side });
    sfx.whoosh();
  };

  const award = (side, pts) => {
    const m = state.m;
    m.score[side] += pts;
    if (m.cfg.mode !== 'solo' && m.pendingWin < 0 && m.score[side] >= m.target) m.pendingWin = side;
  };
  const humanRec = (m, side) => (m.cfg.mode === 'ai' || m.cfg.mode === 'solo') && side === 0;

  const runEvent = (e) => {
    const m = state.m, fl = m.fl, res = fl.res, R = playLayout().board, side = res.side;
    const pt = (u, v) => P(R, u, v);
    if (e.type === 'land') {
      const lp = pt(res.land.u, res.land.v), status = res.status;
      fl.id = applyThrow(m.board, { ...res, pops: [] });
      note({ type: 'land', side, u: res.land.u, v: res.land.v, status, kick: res.kick, ring: res.ring, shove: res.pushes.length > 0 });
      const nd = m.board.discs.find((d) => d.id === fl.id);
      if (nd) { nd.du = res.land.u; nd.dv = res.land.v; }
      if (status === 'short' || status === 'long' || status === 'side') {
        sfx.miss(); floatAt(lp.x, clamp(lp.y, 140, FR.h - 150), 'Miss', '#ff9d8a', { size: 36 });
        emit(state.fx, 'dust', lp.x, clamp(lp.y, 140, FR.h - 150), 6, frand, { speed: 80, size: 16, life: 0.7 });
      } else {
        sfx.thud(); state.shake = 1;
        emit(state.fx, 'dust', lp.x, lp.y, 8, frand, { speed: 90, size: 14, life: 0.7 });
        emit(state.fx, 'crumb', lp.x, lp.y, 14, frand, { speed: 280, size: 7, life: 0.8, cols: ['#c8643a', '#9a4526', '#e08a58'] });
        if (res.kick) { sfx.clink(); const c = pt(RING.u, RING.v); emit(state.fx, 'spark', c.x, c.y, 10, frand, { speed: 220, size: 9, life: 0.45, cols: ['#fff0b0', '#ffd24a'] }); }
        if (status === 'off') floatAt(lp.x, lp.y - 40, 'Off the box', '#ff9d8a', { size: 34 });
      }
      for (const p of res.pushes) if (p.off) { const q = pt(p.to.u, p.to.v); emit(state.fx, 'crumb', q.x, q.y, 6, frand, { speed: 160, size: 6, cols: ['#c8643a'] }); }
      if (res.pushes.length) floatAt(lp.x + 40, lp.y + 30, 'Shove', '#d9e4ff', { size: 28 });
    } else if (e.type === 'pop') {
      const p = pt(e.u, e.v);
      m.board.mechas[e.i] = false; award(side, POINTS.pop);
      note({ type: 'pop', side, i: e.i, u: e.u, v: e.v });
      if (humanRec(m, side)) state.record.pops++;
      m.stats.pops[side]++;
      sfx.pop(); state.shake = Math.max(state.shake, 0.8);
      emit(state.fx, 'paper', p.x, p.y, 34, frand, { speed: 380, size: 12, life: 1.4, up: 160, cols: FLAG.concat(['#ffffff', '#ff8a3d']) });
      emit(state.fx, 'spark', p.x, p.y, 12, frand, { speed: 300, size: 10, life: 0.35, cols: ['#fff6c8', '#ffd24a'] });
      floatAt(p.x, p.y - 20, `+${POINTS.pop}`, '#ffe08a', { size: 44 });
      if (!res.ring && !m.banner) banner(res.pops.length > 1 ? 'DOUBLE POP!' : 'POP!', `+${res.pops.length * POINTS.pop}`, '#ffe08a');
    } else if (e.type === 'ring') {
      const c = pt(RING.u, RING.v);
      award(side, POINTS.ring); m.stats.rings[side]++;
      if (humanRec(m, side)) state.record.rings++;
      const mono = res.pops.length > 0;
      note({ type: 'ring', side, mono });
      if (mono) { m.stats.monas[side]++; if (humanRec(m, side)) state.record.monas++; }
      sfx.ring(); state.shake = 1;
      emit(state.fx, 'paper', c.x, c.y, 50, frand, { speed: 440, size: 12, life: 1.5, up: 200, cols: FLAG.concat(['#ffffff']) });
      emit(state.fx, 'spark', c.x, c.y, 16, frand, { speed: 280, size: 12, life: 0.5, cols: ['#fff6c8', '#ffd24a'] });
      floatAt(c.x, c.y - 30, `+${POINTS.ring}`, '#ffe08a', { size: 56, big: true });
      banner(mono ? 'MOÑONA!' : 'RING!', `+${res.points}`, mono ? '#9fe0ff' : '#ffe08a');
    } else if (e.type === 'end') {
      if (!res.ring && res.pops.length === 0 && !m.banner && res.status === 'box' && res.pushes.length === 0) { /* a quiet landing */ }
      m.ph = 'settle'; m.pt = 0;
    }
  };

  const finishMatch = () => {
    const m = state.m, r = state.record;
    m.ph = 'over'; m.pt = 0;
    if (m.cfg.mode === 'solo') { m.winner = 0; r.practiceBest = Math.max(r.practiceBest, m.score[0]); }
    else m.winner = m.pendingWin >= 0 ? m.pendingWin : m.score[0] === m.score[1] ? -1 : m.score[0] > m.score[1] ? 0 : 1;
    if (m.cfg.mode !== 'watch') {
      r.played++; if (m.cfg.mode === 'ai' && m.winner === 0) r.wins++;
      saveRecord(); clearResume();
      monetization.track('match_end', { mode: m.cfg.mode, score: m.score[0] });
    }
    sfx.win();
  };

  // ---- input helpers ---------------------------------------------------------------------------------------------------------------
  const openPause = () => { const m = state.m; if (state.scene !== 'play' || !m || m.ph === 'over') return; state.paused = true; if (m.cfg.mode !== 'watch') { state.pauseMenu = true; state.ui.scroll = 0; m.drag = null; m.aimShown = null; } };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const toTitle = () => { saveResume(); state.scene = 'title'; state.m = null; state.paused = false; state.pauseMenu = false; state.hint = null; state.ui.scroll = 0; };
  const openReader = (scene, back) => { state.scene = scene; state.ui.back = back; state.ui.page = 0; state.ui.scroll = 0; state.ui.drag = null; };
  const think = () => {
    const m = state.m;
    if (!m || m.ph !== 'aim' || !isHuman(m, m.turn)) return;
    const r = chooseTarget(m.board, m.turn, HUMAN_SIGMA, rng.int(1 << 30), { quality: 1, samples: 24, detail: true });
    state.hint = { u: r.best.u, v: r.best.v, text: explain(r.best, m.board) };
  };

  // scrolling lists: drag to scroll, wheel, tap to choose. Returns the tapped id (or null).
  const scrollPointer = (ptr, input, max, hit) => {
    const ui = state.ui;
    if (input.wheel && input.wheel.dy) ui.scroll = clamp(ui.scroll + input.wheel.dy, 0, max);
    if (ptr.pressed) ui.drag = { y0: ptr.y, s0: ui.scroll, x0: ptr.x, moved: false };
    if (ui.drag && ptr.down) {
      if (Math.abs(ptr.y - ui.drag.y0) > 10) ui.drag.moved = true;
      if (ui.drag.moved) ui.scroll = clamp(ui.drag.s0 - (ptr.y - ui.drag.y0), 0, max);
    }
    if (ptr.released && ui.drag) {
      const d = ui.drag; ui.drag = null;
      if (!d.moved) return hit(d.x0, d.y0);
    }
    return null;
  };

  const onTitle = (id) => {
    if (id === 'ai' || id === 'two') { state.setup.mode = id; state.scene = 'setup'; state.ui.scroll = 0; }
    else if (id === 'solo') startMatch({ mode: 'solo' });
    else if (id === 'watch') startMatch({ mode: 'watch', watch: [3, 2], opp: 2, target: 1 });
    else if (id === 'resume' && state.resume) startMatch(state.resume.cfg, JSON.parse(JSON.stringify(state.resume)));
    else if (id === 'howto' || id === 'rules' || id === 'about') openReader(id, 'title');
    else if (id === 'settings') { state.scene = 'settings'; state.ui.back = 'title'; state.ui.scroll = 0; }
    else if (id === 'arcforge') { pressLockup(); env.openArcforgeHome?.(); }
  };
  const onSetup = (id) => {
    const s = state.setup;
    if (/^lv\d$/.test(id)) s.opp = Number(id[2]);
    else if (/^tg\d$/.test(id)) s.target = Number(id[2]);
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, target: s.target });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const onSettings = (id) => {
    const st = state.settings;
    if (id === 'dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'sound') { st.sound = !st.sound; audio.setMuted(!st.sound); }
    else if (id === 'guide') st.guide = !st.guide;
    else if (id === 'think') st.thinkIdx = (st.thinkIdx + 1) % THINK_STEPS.length;
    else if (id === 'restore' && !state.restoreBusy && !state.owned) {
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
      Promise.resolve(monetization.restore()).then(() => {
        state.owned = !!monetization.owns('unlock_game');
        state.restoreMsg = state.owned ? 'Purchase restored' : 'No earlier purchase found';
      }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
    }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
    saveSettings();
  };
  const onResult = (id) => {
    if (id === 'again') startMatch(state.m.cfg);
    else if (id === 'menu') { state.scene = 'title'; state.m = null; state.ui.scroll = 0; }
    else if (id === 'arcforge') { pressLockup(); env.openArcforgeHome?.(); }
  };
  const onPause = (id) => {
    if (id === 'resume') closePause();
    else if (id === 'rules') { state.pauseMenu = false; openReader('rules', 'play'); }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted(!state.settings.sound); saveSettings(); }
    else if (id === 'quit') toTitle();
  };

  const updateFlow = (scene, input, handler) => {
    const id = scrollPointer(input.pointer, input, flowMax(state, scene), (x, y) => hitFlow(state, scene, x, y, state.ui.scroll));
    if (id) handler(id);
    if (input.keys.pressed.has('Escape') && (scene === 'setup' || scene === 'settings')) { state.scene = 'title'; state.ui.scroll = 0; }
  };

  const updateReader = (input) => {
    const ptr = input.pointer, scene = state.scene, rs = readerState(state, scene), L = rs.L;
    const id = scrollPointer(ptr, input, rs.max, (x, y) => {
      if (inRect(L.dec, x, y)) return 'dec'; if (inRect(L.inc, x, y)) return 'inc'; if (inRect(L.back, x, y)) return 'back'; if (inRect(L.next, x, y)) return 'next';
      return null;
    });
    const n = rs.doc.list.length;
    const goBack = () => { if (state.ui.back === 'play') { state.scene = 'play'; state.pauseMenu = true; } else state.scene = 'title'; state.ui.scroll = 0; };
    if (id === 'dec' || id === 'inc') { state.settings.textIdx = clamp(state.settings.textIdx + (id === 'inc' ? 1 : -1), 0, TEXT_SCALES.length - 1); state.ui.scroll = 0; saveSettings(); }
    else if (id === 'back') { if (state.ui.page === 0) goBack(); else { state.ui.page--; state.ui.scroll = 0; } }
    else if (id === 'next') { if (state.ui.page >= n - 1) goBack(); else { state.ui.page++; state.ui.scroll = 0; } }
    if (input.keys.pressed.has('Escape')) goBack();
    if (input.keys.pressed.has('ArrowRight')) { state.ui.page = Math.min(n - 1, state.ui.page + 1); state.ui.scroll = 0; }
    if (input.keys.pressed.has('ArrowLeft')) { state.ui.page = Math.max(0, state.ui.page - 1); state.ui.scroll = 0; }
  };

  // ---- play ------------------------------------------------------------------------------------------------------------------------
  const updateAmbient = (dt) => {
    stepFx(state.fx, dt);
    for (const f of state.floats) f.t += dt;
    state.floats = state.floats.filter((f) => f.t < f.life);
    state.shake = Math.max(0, state.shake - dt * 3.2);
    const m = state.m;
    if (m) {
      if (m.banner) { m.banner.t += dt; if (m.banner.t > m.banner.life) m.banner = null; }
      const k = 1 - Math.exp(-13 * dt);
      for (const d of m.board.discs) { if (d.du === undefined) { d.du = d.u; d.dv = d.v; } d.du += (d.u - d.du) * k; d.dv += (d.v - d.dv) * k; }
    }
  };

  const updatePlay = (dt, input) => {
    const m = state.m, ptr = input.pointer, L = playLayout();
    const watch = m.cfg.mode === 'watch';
    if (input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyP')) { if (state.paused) { if (watch) state.paused = false; else closePause(); } else openPause(); }
    if (state.pauseMenu) {
      const id = scrollPointer(ptr, input, flowMax(state, 'pause'), (x, y) => hitFlow(state, 'pause', x, y, state.ui.scroll));
      if (id) onPause(id);
      return;
    }
    let hit = null;
    if (ptr.pressed) {
      if (inRect(L.think, ptr.x, ptr.y)) hit = 'think';
      else if (inRect(L.pause, ptr.x, ptr.y)) hit = 'pause';
      else if (state.hint && L.sheet && inRect(hintRects(L).use, ptr.x, ptr.y)) hit = 'use';
    }
    if (hit === 'pause') { if (watch) { state.scene = 'title'; state.m = null; state.paused = false; return; } openPause(); return; }
    if (hit === 'think') { if (watch) state.paused = !state.paused; else if (state.hint) state.hint = null; else think(); return; }
    if (hit === 'use' && state.hint) { m.aim = { u: state.hint.u, v: state.hint.v }; m.aimShown = null; state.hint = null; return; }
    if (state.paused) return;

    updateAmbient(dt);
    m.pt += dt;
    switch (m.ph) {
      case 'intro':
        if (m.pt >= 1.0) beginTurn();
        break;
      case 'aim': {
        if (ptr.pressed && !hit && ptr.y > L.hud.y + L.hud.h * 0.4) { m.drag = { px: ptr.x, py: ptr.y, u0: m.aim.u, v0: m.aim.v, moved: 0 }; m.hold = 0; }
        if (m.drag && ptr.down) {
          const d = m.drag;
          m.hold += dt;
          m.aim.u = clamp(d.u0 + (ptr.x - d.px) * SU, -8, 108);
          m.aim.v = clamp(d.v0 - (ptr.y - d.py) * SV, -8, 112);
          d.moved = Math.max(d.moved, Math.hypot(ptr.x - d.px, ptr.y - d.py));
          const f = clamp((m.hold - TREMOR_START) / 2.5, 0, 1) * TREMOR_MAX;
          m.aimShown = f > 0 ? { u: m.aim.u + f * (Math.sin(m.hold * 21) * 0.6 + Math.sin(m.hold * 13.3 + 1) * 0.4), v: m.aim.v + f * (Math.sin(m.hold * 17.7 + 2) * 0.6 + Math.sin(m.hold * 29) * 0.4) } : null;
          if (state.hint && d.moved > 8) state.hint = null;
        }
        if (m.drag && ptr.released) {
          const d = m.drag; m.drag = null;
          if (d.moved >= 12) { release(m.aimShown || m.aim); break; }
          m.aim.u = d.u0; m.aim.v = d.v0; m.aimShown = null; m.hold = 0;
        }
        const kd = input.keys.down;
        if (!m.drag) {
          if (kd.has('ArrowLeft')) m.aim.u = clamp(m.aim.u - 16 * dt, -8, 108);
          if (kd.has('ArrowRight')) m.aim.u = clamp(m.aim.u + 16 * dt, -8, 108);
          if (kd.has('ArrowUp')) m.aim.v = clamp(m.aim.v + 20 * dt, -8, 112);
          if (kd.has('ArrowDown')) m.aim.v = clamp(m.aim.v - 20 * dt, -8, 112);
          if (input.keys.pressed.has('Space')) { release(m.aim); break; }
          if (input.keys.pressed.has('KeyT')) { if (state.hint) state.hint = null; else think(); }
        }
        break;
      }
      case 'think':
        if (m.pt >= m.thinkDur) { m.ph = watch ? 'reveal' : 'act'; m.pt = 0; if (watch) sfx.tick(); }
        break;
      case 'reveal':
        if (m.pt >= REVEAL_SECS) { m.ph = 'act'; m.pt = 0; }
        break;
      case 'act': {
        const f = easeIO(m.pt / 0.9), pl = m.plan;
        m.aim = { u: pl.from.u + (pl.u - pl.from.u) * f, v: pl.from.v + (pl.v - pl.from.v) * f };
        if (m.pt >= 1.0) release(m.aim);
        break;
      }
      case 'fly': {
        const fl = m.fl;
        fl.t += dt;
        while (fl.i < fl.ev.length && fl.t >= fl.ev[fl.i].t) runEvent(fl.ev[fl.i++]);
        break;
      }
      case 'settle':
        if (m.pt >= 0.45) {
          if (m.pendingWin >= 0) { finishMatch(); break; }
          if (m.k >= throwsPerRound(m)) { m.ph = 'bonus'; m.pt = 0; m.bonus = roundBonus(m.board); m.bonusDone = false; }
          else { saveResume(); beginTurn(); }
        }
        break;
      case 'bonus':
        if (!m.bonusDone && m.pt >= 0.5) {
          m.bonusDone = true;
          if (m.bonus) {
            award(m.bonus.side, POINTS.mano);
            const d = m.board.discs.find((q) => q.id === m.bonus.id), p = d ? P(L.board, d.u, d.v) : { x: FR.w / 2, y: FR.h / 2 };
            floatAt(p.x, p.y - 30, `+${POINTS.mano}`, TEAM[m.bonus.side].light, { size: 46 });
            banner('CLOSEST', `${sideNames(m.cfg)[m.bonus.side] || 'You'} +${POINTS.mano}`, TEAM[m.bonus.side].light);
            sfx.tick();
          }
        }
        if (m.pt >= 1.9) {
          if (m.pendingWin >= 0 || (m.cfg.mode === 'solo' && m.round >= m.rounds)) finishMatch();
          else { m.ph = 'roundEnd'; m.pt = 0; }
        }
        break;
      case 'roundEnd':
        if (m.pt >= 0.3) {
          m.round++; m.k = 0; m.first = m.cfg.mode === 'solo' ? 0 : 1 - m.first;
          m.board.discs = []; refreshMechas(m.board); m.board.nextId = 1; note({ type: 'reset' });
          m.left = m.cfg.mode === 'solo' ? [m.perRound, 0] : [m.perRound, m.perRound];
          m.bonus = null; m.ph = 'intro'; m.pt = 0; m.turn = sideAt(m, 0);
          state.floats = [];
          saveResume();
        }
        break;
      case 'over':
        if (m.pt >= 1.4) { state.scene = 'result'; state.ui.scroll = 0; state.paused = false; }
        break;
      default: break;
    }
  };

  // ---- store screenshots: ?shot=1&seed=N picks a fixed screen -------------------------------------------------------------------
  const boardWith = (list) => { const b = newBoard(); list.forEach((d, i) => b.discs.push({ id: i + 1, side: d[0], u: d[1], v: d[2], du: d[1], dv: d[2] })); b.nextId = list.length + 1; return b; };
  const applyPreset = () => {
    const n = Number(config.seed) || 1;
    state.shot = true;
    const play = (cfg, discs, o = {}) => {
      startMatch(cfg);
      const m = state.m;
      m.board = boardWith(discs); m.score = o.score || [8, 6]; m.round = o.round || 2; m.ph = o.ph || 'aim'; m.pt = 0; m.k = discs.length; m.first = 0;
      m.left = o.left || [3 - Math.ceil(discs.length / 2), 3 - Math.floor(discs.length / 2)]; m.turn = o.turn ?? 0; m.aim = o.aim || { u: 47, v: 50 };
      m.board.mechas = o.mechas || [true, true];
      if (o.hold) { m.drag = { px: 0, py: 0, u0: 0, v0: 0, moved: 20 }; m.hold = o.hold; const f = clamp((o.hold - TREMOR_START) / 2.5, 0, 1) * TREMOR_MAX; m.aimShown = { u: m.aim.u + f * 0.6, v: m.aim.v - f * 0.5 }; }
      state.paused = false;
    };
    const set = [[0, 41, 44], [1, 58, 60], [0, 62, 41], [1, 33, 61]];
    if (n === 1) { state.scene = 'title'; return; }
    if (n === 2) { play({ mode: 'ai', opp: 2, target: 1 }, set.slice(0, 3), { aim: { u: 49, v: 46 } }); return; }
    if (n === 3) {
      play({ mode: 'ai', opp: 2, target: 1 }, set, { aim: { u: 50, v: 54 }, score: [9, 8], mechas: [false, true] });
      state.m.banner = { text: 'POP!', sub: '+3', col: '#ffe08a', t: 0.4, life: 1.5 };
      const p = P(playLayout().board, mecha(0).u, mecha(0).v); emit(state.fx, 'paper', p.x, p.y, 40, frand, { speed: 300, size: 12, life: 2, cols: FLAG });
      for (const f of state.fx) f.life = 0.35;
      state.floats.push({ x: p.x, y: p.y - 20, text: '+3', col: '#ffe08a', t: 0.2, life: 1.2, size: 44, big: false });
      return;
    }
    if (n === 4) { play({ mode: 'ai', opp: 3, target: 1 }, set.slice(0, 2), { aim: { u: 50, v: 54 }, hold: 3.2 }); return; }
    if (n === 5) { play({ mode: 'ai', opp: 2, target: 1 }, set.slice(0, 3), { aim: { u: 47, v: 49 } }); state.hint = { u: 50, v: 48, text: 'Aim at the paper mechas on the near side of the ring. In 24 test throws: 8% dropped in the ring, 71% popped a mecha. About 3.0 points per throw.' }; return; }
    if (n === 6) { play({ mode: 'ai', opp: 1, target: 1 }, set, { score: [21, 15] }); state.m.winner = 0; state.m.stats = { rings: [2, 1], pops: [4, 2], monas: [1, 0], throws: [18, 18] }; state.scene = 'result'; return; }
    if (n >= 7 && n <= 9) { state.scene = ['rules', 'howto', 'about'][n - 7]; state.ui.page = n === 7 ? 3 : 0; state.ui.back = 'title'; return; }
    if (n === 10) { play({ mode: 'watch', watch: [3, 2], opp: 2, target: 1 }, set.slice(0, 3), { turn: 1, ph: 'reveal' }); state.m.plan = { u: 52, v: 50, from: { u: 50, v: 50 }, text: 'Aim at the paper mechas on the near side of the ring. In 14 test throws: 14% dropped in the ring, 64% popped a mecha. About 2.9 points per throw.', top: [{ u: 52, v: 50 }, { u: 46, v: 58 }, { u: 56, v: 60 }, { u: 60, v: 46 }] }; return; }
    if (n === 11) { state.scene = 'settings'; return; }
    if (n === 12) { state.scene = 'setup'; return; }
    if (n === 13) { state.settings.textIdx = 4; state.scene = 'rules'; state.ui.page = 3; return; }
    if (n === 14) { play({ mode: 'solo' }, set.slice(0, 2), { left: [2, 0], score: [9, 0], aim: { u: 52, v: 52 } }); return; }
    if (n === 15) { play({ mode: 'ai', opp: 2, target: 1 }, set, { aim: { u: 50, v: 54 } }); state.pauseMenu = true; state.paused = true; return; }
    play({ mode: 'ai', opp: 2, target: 1 }, set.slice(0, 2));
  };

  // ---- the object the kit and the shell see ----------------------------------------------------------------------------------------
  const game = {
    // Only live action uses up the free preview: a disc in the air, a computer throw in motion, or a thumb on the screen.
    // Menus, rules, settings, hints, Watch & Learn, pause and results are free. A tester build (config.dev) never uses it up.
    isPreviewExempt: () => {
      if (config.dev) return true;
      const m = state.m;
      if (state.scene !== 'play' || !m || m.cfg.mode === 'watch') return true;
      if (state.paused || state.pauseMenu || state.hint) return true;
      return !(m.ph === 'fly' || m.ph === 'act' || (m.ph === 'aim' && m.drag));
    },
    update(dt, input) {
      if (state.shot) input = NOINPUT;
      setFrame(meta.width, meta.height);
      config.textScale = TEXT_SCALES[state.settings.textIdx];
      // The kit's preview pill: top centre (the band above the score panel) in portrait, under the score panel on the left in landscape.
      {
        const pl = playLayout();
        globalThis.__previewBadge = !FR.land ? null : state.scene === 'play' ? { x: pl.hud.x, y: pl.hud.y + pl.hud.h + 12, align: 'left' } : { x: FR.l + Math.max(FR.back, 0) + 16, y: topSafe(), align: 'left' };
      }
      if (state.layKey !== FR.key) {
        if (state.layKey && state.m) { state.m.drag = null; state.m.aimShown = null; state.ui.drag = null; }
        state.layKey = FR.key;
      }
      budget = 0;
      setPress(input.pointer);
      if (state.shot) { state.t += dt; return; }
      if (!(state.paused && state.scene === 'play')) state.t += dt;
      switch (state.scene) {
        case 'title': updateFlow('title', input, onTitle); break;
        case 'setup': updateFlow('setup', input, onSetup); break;
        case 'settings': updateFlow('settings', input, onSettings); break;
        case 'result': updateFlow('result', input, onResult); break;
        case 'demolimit': updateFlow('demolimit', input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }); break;
        case 'howto': case 'about': case 'rules': updateReader(input); break;
        case 'play': if (state.m) updatePlay(dt, input); else state.scene = 'title'; break;
        default: break;
      }
    },
    render(ctx) {
      setFrame(meta.width, meta.height);
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderFlow(ctx, state, 'setup'); break;
        case 'settings': renderFlow(ctx, state, 'settings'); break;
        case 'result': renderFlow(ctx, state, 'result', 0.78); break;
        case 'demolimit': renderFlow(ctx, state, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': renderReader(ctx, state, state.scene); break;
        case 'play':
          if (state.m) { renderPlay(ctx, state); if (state.pauseMenu) renderModal(ctx, state, 'pause'); }
          break;
        default: break;
      }
    },
    getState: () => state,
    // Every tappable rectangle of the current screen (layout checks in the headless-browser matrix). No gameplay use.
    getRects() {
      const out = [], sc = state.scene;
      if (sc === 'play') {
        const L = playLayout();
        if (state.pauseMenu) out.push(...flowRects(state, 'pause', state.ui.scroll));
        else out.push({ id: 'think', ...L.think }, { id: 'pause', ...L.pause });
      } else if (sc === 'howto' || sc === 'about' || sc === 'rules') {
        const L = readerLayout(); out.push({ id: 'dec', ...L.dec }, { id: 'inc', ...L.inc }, { id: 'back', ...L.back }, { id: 'next', ...L.next });
      } else out.push(...flowRects(state, sc, state.ui.scroll));
      return { frame: { w: FR.w, h: FR.h, land: FR.land, ins: { t: FR.t, r: FR.r, b: FR.b, l: FR.l } }, rects: out, scene: sc, ph: state.m ? state.m.ph : null };
    },
  };
  if (shotMode) applyPreset();
  return game;
}
