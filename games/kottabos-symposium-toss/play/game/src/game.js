// GAME CONTRACT (docs/GAME-CONTRACT.md): export meta + createGame(env) -> { update, render, getState }.
// Kottabos Symposium Toss: slide toward the target and lift to flick the last drops of water from a cup at a balanced bronze disc
// or at floating cups. State machine: title / ladder / setup / settings / howto / about / rules / play / result / demolimit.
// Play phases: intro -> aim (human) | think -> [reveal] -> act (computer) -> fly -> settle -> ... -> roundEnd -> intro | over
import {
  newBoard, resolveFlick, applyFlick, boardCleared, planFlick, explain, swipeToAim, cohesionOf, roundScene, suddenDeath, LADDER, LENGTHS,
  DISTANCES, AIM, SWIPE, POINTS, MAX_EXTRA, HUMAN, BASIN, stars as starsFor, standGeom,
} from './sim.js';
import { FR, setFrame, TEXT_SCALES, THINK_STEPS, REVEAL_SECS, playLayout, readerLayout, inRect } from './layout.js';
import { emit, stepFx, cameraFor, sx, sy } from './art.js';
import { setPress } from './ui.js';
import { renderTitle, renderFlow, renderModal, renderReader, hitFlow, flowMax, readerState, flowRects, DEMO_LEVELS } from './menus.js';
import { renderPlay, isHuman, hintRects, handOf, levelOf } from './view.js';
import { pressLockup } from './brand.js';
import { v3 } from './v3.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const easeIO = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
const NOINPUT = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() }, wheel: { dx: 0, dy: 0 } };
const DEMO_MATCHES = 1;
const KEY_C = 0.9;                       // keyboard flicks are clean
const defaultAim = () => ({ a: 52, v: 520 });

export function createGame(env) {
  const { rng, storage, monetization, audio, config } = env;
  let shotMode = false;
  try { shotMode = /[?&]shot=/.test(globalThis.location.search); } catch { shotMode = false; }

  const state = {
    scene: 'title', t: 0, shot: false, demo: !!config.demo, layKey: '', camZ: 0,
    settings: { textIdx: 0, thinkIdx: 1, sound: true, guide: true, dist: 1 },
    record: { played: 0, wins: 0, clang: 0, off: 0, sunk: 0, flicks: 0, stars: [], best: [], demoGames: 0 },
    setup: { mode: 'ai', opp: 1, len: 1 },
    ui: { scroll: 0, drag: null, page: 0, back: 'title' },
    m: null, resume: null, prevBest: 0,
    fx: [], floats: [], ripples: [], shake: 0, paused: false, pauseMenu: false, hint: null,
  };
  state.restoreMsg = ''; state.restoreBusy = false;
  state.owned = !!monetization.owns?.('unlock_game');
  monetization.onChange?.(() => { state.owned = !!monetization.owns('unlock_game'); });
  const frand = () => rng.next();

  // ---- saving ------------------------------------------------------------------------------------------------------------------
  const saveSettings = () => storage.set('settings', state.settings);
  const saveRecord = () => storage.set('record', state.record);
  const snapshot = (m) => ({ cfg: m.cfg, board: m.board, score: m.score, round: m.round, rounds: m.rounds, extra: m.extra, left: m.left, first: m.first, k: m.k, stats: m.stats, perRound: m.perRound });
  const saveResume = () => { const m = state.m; if (m && m.cfg.mode !== 'watch' && m.cfg.mode !== 'ladder' && m.ph !== 'over') { state.resume = JSON.parse(JSON.stringify(snapshot(m))); storage.set('resume', state.resume); } };
  const clearResume = () => { state.resume = null; storage.remove('resume'); };
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('resume', null)]).then(([s, r, res]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    if (res && res.cfg && res.board && res.score && !shotMode) state.resume = res;
    audio.setMuted(!state.settings.sound);
  });

  // ---- sound -------------------------------------------------------------------------------------------------------------------
  let budget = 0;
  const tone = (o) => { if (budget < 6) { budget++; audio.tone(o); } };
  const sfx = {
    whoosh: () => tone({ freq: 700, to: 240, dur: 0.3, type: 'sine', vol: 0.05 }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'square', vol: 0.04 }),
    hit: (f = 0.6) => tone({ freq: 900 + f * 500, to: 700, dur: 0.07, type: 'triangle', vol: 0.05 + f * 0.04 }),
    ting: () => tone({ freq: 1760, to: 1700, dur: 0.3, type: 'sine', vol: 0.05 }),
    plink: (i = 0) => tone({ freq: 640 + (i % 5) * 70, to: 460, dur: 0.12, type: 'sine', vol: 0.06 }),
    plip: () => tone({ freq: 300, to: 190, dur: 0.1, type: 'sine', vol: 0.04 }),
    splat: () => tone({ freq: 260, to: 120, dur: 0.1, type: 'triangle', vol: 0.05 }),
    clang: () => { tone({ freq: 330, to: 322, dur: 0.9, type: 'sine', vol: 0.15 }); tone({ freq: 523, to: 505, dur: 0.7, type: 'sine', vol: 0.1 }); tone({ freq: 1181, to: 1160, dur: 0.5, type: 'triangle', vol: 0.07 }); tone({ freq: 2093, dur: 0.3, type: 'sine', vol: 0.04 }); },
    clatter: () => { tone({ freq: 220, to: 110, dur: 0.12, type: 'square', vol: 0.06 }); tone({ freq: 440, to: 200, dur: 0.08, type: 'triangle', vol: 0.05 }); },
    sink: () => { tone({ freq: 560, to: 170, dur: 0.5, type: 'sine', vol: 0.09 }); tone({ freq: 300, to: 120, dur: 0.4, type: 'triangle', vol: 0.05 }); },
    chime: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.08 })),
    miss: () => tone({ freq: 190, to: 110, dur: 0.22, type: 'sine', vol: 0.07 }),
    win: () => [523, 659, 784, 1047].forEach((f) => tone({ freq: f, dur: 0.28, type: 'triangle', vol: 0.1 })),
  };

  // ---- match setup ---------------------------------------------------------------------------------------------------------------
  const solo = (m) => m.cfg.mode === 'ladder';
  const sideAt = (m, k) => (solo(m) ? 0 : (m.first + k) % 2);
  const throwsPerRound = (m) => (solo(m) ? m.perRound : m.perRound * 2);
  const newStats = () => ({ clang: [0, 0], off: [0, 0], wobble: [0, 0], sunk: [0, 0], flicks: [0, 0] });
  const sceneFor = (cfg, round, extra) => {
    if (cfg.mode === 'ladder') return LADDER[cfg.level].sc;
    if (extra > 0) { const s = suddenDeath(cfg.dist); return { ...s, flicks: 1 }; }
    return roundScene(round - 1, cfg.dist);
  };
  const newMatch = (cfg, from = null) => {
    const m = from ? { ...from } : (() => {
      const sc = sceneFor(cfg, 1, 0), sl = cfg.mode === 'ladder';
      return {
        cfg, sc, board: newBoard(sc), score: [0, 0], round: 1, rounds: sl ? 1 : LENGTHS[cfg.len ?? 1], extra: 0, perRound: sc.flicks,
        left: sl ? [sc.flicks, 0] : [sc.flicks, sc.flicks], first: sl ? 0 : rng.int(2), k: 0, stats: newStats(),
      };
    })();
    if (from) m.sc = sceneFor(m.cfg, m.round, m.extra);
    Object.assign(m, { cfg, ph: 'intro', pt: 0, turn: sideAt(m, m.k), drag: null, fl: null, plan: null, banner: null, winner: -1, thinkDur: 1, clock: 0, focus: null, lastAim: [defaultAim(), defaultAim()], starsGot: 0 });
    m.aim = { ...m.lastAim[m.turn] };
    return m;
  };
  const startMatch = (cfg, from = null) => {
    const full = !(cfg.mode === 'watch' || (cfg.mode === 'ladder' && cfg.level < DEMO_LEVELS));
    if (state.demo && full && !from && (cfg.mode === 'ladder' || state.record.demoGames >= DEMO_MATCHES)) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.prevBest = cfg.mode === 'ladder' ? (state.record.best[cfg.level] || 0) : 0;
    state.m = newMatch(cfg, from);
    state.scene = 'play'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false; state.hint = null; state.fx = []; state.floats = []; state.ripples = []; state.shake = 0; state.camZ = 0;
    if (!from && state.demo && cfg.mode !== 'watch' && cfg.mode !== 'ladder') { state.record.demoGames++; saveRecord(); }
    if (cfg.mode !== 'watch') monetization.track('match_start', { mode: cfg.mode });
  };

  // ---- a turn --------------------------------------------------------------------------------------------------------------------
  const beginTurn = () => {
    const m = state.m;
    m.turn = sideAt(m, m.k);
    m.aim = { ...m.lastAim[m.turn] }; m.drag = null; m.fl = null; state.hint = null; m.plan = null; m.focus = null;
    if (isHuman(m, m.turn)) { m.ph = 'aim'; m.pt = 0; return; }
    const lv = levelOf(m, m.turn), watch = m.cfg.mode === 'watch';
    m.thinkDur = watch ? THINK_STEPS[state.settings.thinkIdx] : lv.think[0] + frand() * (lv.think[1] - lv.think[0]);
    const tRel = m.clock + m.thinkDur + (watch ? REVEAL_SECS : 0) + 1.0;
    const hand = handOf(m, m.turn), samples = watch ? lv.samples + 2 : lv.samples;
    const res = planFlick(m.sc, m.board, hand, rng.int(1 << 30), tRel, { samples, quality: lv.quality });
    const pick = res.best;
    m.plan = { a: pick.a, v: pick.v, text: explain(pick, m.sc, hand, samples), top: res.top.map((c) => ({ a: c.a, v: c.v })), from: { ...m.aim } };
    m.ph = 'think'; m.pt = 0;
  };

  const floatAt = (x, y, text, col, o = {}) => state.floats.push({ x, y, text, col, t: 0, life: o.life ?? 1.4, size: o.size ?? 40, big: !!o.big });
  const banner = (text, sub, col) => { state.m.banner = { text, sub, col, t: 0, life: 1.7 }; };
  const camNow = () => cameraFor(playLayout().scene, state.m.sc, state.camZ, state.m.focus);
  const scr = (cam, x, y) => ({ x: sx(cam, x), y: sy(cam, y) });

  const focusFor = (sc, res) => {
    if (sc.kind === 'basin') return { x: sc.basin.x, y: BASIN.water + 8 };
    let best = 0, bn = -1;
    sc.stands.forEach((s, i) => {
      const n = res.drops.filter((d) => d.hit && d.hit.st && d.hit.st.i === i).length;
      if (n > bn) { bn = n; best = i; }
    });
    if (bn <= 0) {
      const ex = res.drops.reduce((a, d) => a + d.x, 0) / res.drops.length;
      best = 0; sc.stands.forEach((s, i) => { if (Math.abs(s.x - ex) < Math.abs(sc.stands[best].x - ex)) best = i; });
    }
    const s = sc.stands[best];
    return { x: s.x, y: s.h + 8 };
  };

  const release = (aim, c) => {
    const m = state.m, side = m.turn;
    const a = { a: clamp(aim.a, AIM.aMin, AIM.aMax), v: clamp(aim.v, AIM.vMin, AIM.vMax) };
    const hand = handOf(m, side);
    if (isHuman(m, side)) hand.c = c;
    const res = resolveFlick(m.sc, m.board, a, hand, rng.int(1 << 30), m.clock);
    const ev = res.events.map((e) => ({ ...e }));
    ev.push({ t: res.dur, type: 'end' });
    ev.sort((x, y) => x.t - y.t);
    const hits = res.events.filter((e) => e.type === 'hit' || e.type === 'ting' || e.type === 'pole' || e.type === 'plink');
    const first = hits.length ? hits[0].t : 99, last = hits.length ? hits[hits.length - 1].t : res.dur;
    m.fl = { res, t: 0, ev, i: 0, first, slow: [first - 0.12, Math.min(last + 0.45, first + 1.2)] };
    m.focus = focusFor(m.sc, res);
    m.left[side]--; m.k++; m.stats.flicks[side]++;
    m.lastAim[side] = { ...a };
    m.ph = 'fly'; m.pt = 0; m.drag = null; state.hint = null;
    m.snapC = hand.c;
    sfx.whoosh();
  };

  const humanRec = (m, side) => (m.cfg.mode === 'ai' || m.cfg.mode === 'ladder') && side === 0;

  const runEvent = (e) => {
    const m = state.m, fl = m.fl, res = fl.res, side = m.turn, cam = camNow();
    const z = cam.s;
    if (v3.on && v3.events.length < 80) v3.events.push({ ...e });
    if (e.type === 'hit') {
      const p = scr(cam, e.x, e.y);
      sfx.hit(0.6);
      emit(state.fx, 'splash', p.x, p.y, 4, frand, { speed: 160, size: Math.max(2, z * 0.7), life: 0.5, up: 120 });
    } else if (e.type === 'ting') {
      const p = scr(cam, e.x, e.y);
      sfx.ting(); emit(state.fx, 'spark', p.x, p.y, 2, frand, { speed: 90, size: 5, life: 0.35, cols: ['#fff3b8'] });
    } else if (e.type === 'pole' || e.type === 'splat') {
      const p = scr(cam, e.x, e.y); sfx.splat();
      emit(state.fx, 'splash', p.x, p.y, 3, frand, { speed: 110, size: Math.max(2, z * 0.6), life: 0.45, up: 80 });
    } else if (e.type === 'plink') {
      const p = scr(cam, e.x, e.y); sfx.plink(e.drop);
      emit(state.fx, 'splash', p.x, p.y, 3, frand, { speed: 90, size: Math.max(2, z * 0.55), life: 0.4, up: 110 });
      emit(state.fx, 'ring', p.x, p.y, 1, frand, { speed: 0, size: Math.max(6, z * 3), life: 0.45, cols: ['#d6f6ff'] });
    } else if (e.type === 'water') {
      const p = scr(cam, e.x, e.y); sfx.plip();
      state.ripples.push({ x: e.x, t: 0, life: 0.9 });
      emit(state.fx, 'splash', p.x, p.y, 2, frand, { speed: 70, size: Math.max(2, z * 0.5), life: 0.4, up: 80 });
    } else if (e.type === 'sink') {
      const p = scr(cam, e.x, e.y); sfx.sink();
      emit(state.fx, 'bubble', p.x, p.y, 8, frand, { speed: 60, size: 7, life: 1.0, up: 60 });
      emit(state.fx, 'ring', p.x, p.y, 2, frand, { speed: 0, size: Math.max(8, z * 4), life: 0.7, cols: ['#ffffff'] });
      floatAt(p.x, p.y - 24, `+${POINTS.bowl}`, '#bff3ff', { size: 46, big: true });
      state.shake = Math.max(state.shake, 0.25);
    } else if (e.type === 'clang') {
      const p = scr(cam, e.x, e.y); sfx.clang();
      emit(state.fx, 'spark', p.x, p.y, 12, frand, { speed: 260, size: 9, life: 0.55, cols: ['#fff6c8', '#ffd24a'] });
      emit(state.fx, 'ring', p.x, p.y, 3, frand, { speed: 0, size: Math.max(14, z * 6), life: 0.7, cols: ['#fff1b0', '#ffd870'] });
      banner('CLANG!', '', '#ffe08a');
      floatAt(p.x, p.y - 30, `+${POINTS.clang}`, '#ffe08a', { size: 56, big: true });
      state.shake = 0.7;
    } else if (e.type === 'floor') {
      const p = scr(cam, e.x, e.y); sfx.clatter();
      emit(state.fx, 'spark', p.x, p.y, 4, frand, { speed: 160, size: 6, life: 0.4, cols: ['#ffe9a0'] });
      banner('KNOCKED OFF', '', '#ffd0a0');
      floatAt(p.x, p.y - 30, `+${POINTS.off}`, '#ffd0a0', { size: 46, big: true });
      state.shake = 0.4;
    } else if (e.type === 'end') {
      applyFlick(m.sc, m.board, res);
      m.score[side] += res.points;
      const st = m.stats;
      let clang = 0, off = 0;
      for (const s of res.stands) { if (s.result === 'clang') { st.clang[side]++; clang++; } else if (s.result === 'off') { st.off[side]++; off++; } else if (s.result === 'wobble') st.wobble[side]++; }
      st.sunk[side] += res.sunk;
      if (humanRec(m, side)) { const r = state.record; r.clang += clang; r.off += off; r.sunk += res.sunk; r.flicks++; }
      if (res.points === 0) {
        sfx.miss();
        const cam2 = camNow(), p = scr(cam2, m.sc.D, 60);
        floatAt(clamp(p.x, 60, FR.w - 60), clamp(p.y, 200, FR.h - 260), res.wet > 0 ? 'Not enough' : 'Just water', '#ffb4a2', { size: 34 });
      } else if (res.sunk >= 2) {
        sfx.chime(); banner('DOUBLE!', `${res.sunk} cups, +${POINTS.multi * (res.sunk - 1)}`, '#bff3ff');
      } else if (res.stands.some((s) => s.result === 'wobble') && !clang && !off) {
        banner('WOBBLE', `+${POINTS.wobble}`, '#fff1c4');
      }
      if (res.stands.length > 1 && clang >= 2) { sfx.chime(); banner('DOUBLE CLANG!', `+${clang * POINTS.clang}`, '#ffe08a'); }
      m.ph = 'settle'; m.pt = 0;
    }
  };

  const roundOver = (m) => m.k >= throwsPerRound(m) || boardCleared(m.sc, m.board);

  const finishMatch = () => {
    const m = state.m, r = state.record;
    m.ph = 'over'; m.pt = 0;
    if (solo(m)) {
      let pts = m.score[0];
      if (boardCleared(m.sc, m.board)) { const bonus = POINTS.clear + Math.max(0, m.left[0]) * POINTS.spare; pts += bonus; m.score[0] = pts; m.bonus = bonus; }
      const lv = LADDER[m.cfg.level], got = starsFor(lv, pts);
      m.winner = 0; m.starsGot = got;
      const i = m.cfg.level;
      r.stars = r.stars.slice(); r.best = r.best.slice();
      while (r.stars.length < LADDER.length) r.stars.push(0);
      while (r.best.length < LADDER.length) r.best.push(0);
      r.stars[i] = Math.max(r.stars[i] || 0, got); r.best[i] = Math.max(r.best[i] || 0, pts);
      saveRecord();
    } else {
      m.winner = m.score[0] === m.score[1] ? -1 : m.score[0] > m.score[1] ? 0 : 1;
    }
    if (m.cfg.mode !== 'watch' && !solo(m)) {
      r.played++; if (m.cfg.mode === 'ai' && m.winner === 0) r.wins++;
      saveRecord(); clearResume();
      monetization.track('match_end', { mode: m.cfg.mode, score: m.score[0] });
    } else if (solo(m)) monetization.track('level_end', { level: m.cfg.level, stars: m.starsGot });
    sfx.win();
  };

  // ---- input helpers ---------------------------------------------------------------------------------------------------------------
  const openPause = () => { const m = state.m; if (state.scene !== 'play' || !m || m.ph === 'over') return; state.paused = true; if (m.cfg.mode !== 'watch') { state.pauseMenu = true; state.ui.scroll = 0; m.drag = null; } };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const toTitle = () => { saveResume(); state.scene = solo(state.m) ? 'ladder' : 'title'; state.m = null; state.paused = false; state.pauseMenu = false; state.hint = null; state.ui.scroll = 0; };
  const openReader = (scene, back) => { state.scene = scene; state.ui.back = back; state.ui.page = 0; state.ui.scroll = 0; state.ui.drag = null; };
  const think = () => {
    const m = state.m;
    if (!m || m.ph !== 'aim' || !isHuman(m, m.turn)) return;
    const hand = { c: 0.82, ta: HUMAN.ta, tv: HUMAN.tv };
    const r = planFlick(m.sc, m.board, hand, rng.int(1 << 30), m.clock + 1.2, { samples: 6, quality: 3 });
    state.hint = { a: r.best.a, v: r.best.v, text: explain(r.best, m.sc, hand, 6) };
  };

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
    else if (id === 'ladder') { state.scene = 'ladder'; state.ui.scroll = 0; }
    else if (id === 'watch') startMatch({ mode: 'watch', watch: [3, 2], len: 0, dist: state.settings.dist });
    else if (id === 'resume' && state.resume) startMatch(state.resume.cfg, JSON.parse(JSON.stringify(state.resume)));
    else if (id === 'howto' || id === 'rules' || id === 'about') openReader(id, 'title');
    else if (id === 'settings') { state.scene = 'settings'; state.ui.back = 'title'; state.ui.scroll = 0; }
    else if (id === 'arcforge') { pressLockup(); env.openArcforgeHome?.(); }
  };
  const onLadder = (id) => {
    if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; return; }
    const mm = /^lv(\d+)$/.exec(id);
    if (mm) startMatch({ mode: 'ladder', level: Number(mm[1]), dist: 1 });
  };
  const onSetup = (id) => {
    const s = state.setup;
    if (/^lv\d$/.test(id)) s.opp = Number(id[2]);
    else if (/^ln\d$/.test(id)) s.len = Number(id[2]);
    else if (/^ds\d$/.test(id)) { state.settings.dist = Number(id[2]); saveSettings(); }
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, len: s.len, dist: state.settings.dist });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const onSettings = (id) => {
    const st = state.settings;
    if (id === 'dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'sound') { st.sound = !st.sound; audio.setMuted(!st.sound); }
    else if (id === 'guide') st.guide = !st.guide;
    else if (id === 'dist') st.dist = (st.dist + 1) % DISTANCES.length;
    else if (id === 'think') st.thinkIdx = (st.thinkIdx + 1) % THINK_STEPS.length;
    else if (id === 'restore' && !state.restoreBusy) {
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
    const m = state.m;
    if (id === 'again') startMatch(m.cfg);
    else if (id === 'next') startMatch({ ...m.cfg, level: Math.min(LADDER.length - 1, m.cfg.level + 1) });
    else if (id === 'ladder') { state.scene = 'ladder'; state.m = null; state.ui.scroll = 0; }
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
    if (input.keys.pressed.has('Escape') && (scene === 'setup' || scene === 'settings' || scene === 'ladder')) { state.scene = 'title'; state.ui.scroll = 0; }
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
    for (const r of state.ripples) r.t += dt;
    state.ripples = state.ripples.filter((r) => r.t < r.life);
    state.shake = Math.max(0, state.shake - dt * 3.2);
    const m = state.m;
    if (m && m.banner) { m.banner.t += dt; if (m.banner.t > m.banner.life) m.banner = null; }
  };
  const camTarget = () => {
    const m = state.m;
    if (!m) return 0;
    if (m.ph === 'fly' && m.fl) return m.fl.t >= m.fl.first - 0.55 ? 1 : 0;
    if (m.ph === 'settle') return m.pt < 0.45 ? 1 : 0;
    return 0;
  };
  const nextRound = () => {
    const m = state.m;
    m.round++; m.k = 0; m.first = 1 - m.first;
    m.sc = sceneFor(m.cfg, m.round, m.extra);
    m.board = newBoard(m.sc); m.perRound = m.sc.flicks; m.left = [m.perRound, m.perRound];
    m.ph = 'intro'; m.pt = 0; m.turn = sideAt(m, 0); m.lastAim = [defaultAim(), defaultAim()]; m.aim = { ...m.lastAim[m.turn] };
    state.floats = []; state.ripples = [];
    saveResume();
  };

  // finger speed in units per second: the fastest 3-tick window of the last few samples
  const fingerSpeed = (pts) => {
    let best = 0;
    for (let i = 3; i < pts.length; i++) { const a = pts[i - 3], b = pts[i]; best = Math.max(best, Math.hypot(b[0] - a[0], b[1] - a[1]) * 20); }
    if (pts.length > 1 && pts.length < 4) { const a = pts[0], b = pts[pts.length - 1]; best = Math.hypot(b[0] - a[0], b[1] - a[1]) * (60 / (pts.length - 1)); }
    return best;
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
    if (hit === 'use' && state.hint) { m.aim = { a: state.hint.a, v: state.hint.v }; state.hint = null; return; }
    if (state.paused) return;

    updateAmbient(dt);
    let rate = 1;
    if (m.ph === 'fly' && m.fl && m.fl.t >= m.fl.slow[0] && m.fl.t <= m.fl.slow[1]) rate = 0.42;
    m.pt += dt;
    m.clock += dt * rate;
    switch (m.ph) {
      case 'intro':
        if (m.pt >= 0.9) beginTurn();
        break;
      case 'aim': {
        if (ptr.pressed && !hit && ptr.y > L.hud.y + L.hud.h * 0.4) { m.drag = { x0: ptr.x, y0: ptr.y, pts: [[ptr.x, ptr.y]], dist: 0, c: null, a0: { ...m.aim }, moved: false }; }
        else if (m.drag && (ptr.down || ptr.released)) {
          const d = m.drag;
          d.pts.push([ptr.x, ptr.y]); if (d.pts.length > 10) d.pts.shift();
          const dx = ptr.x - d.x0, dy = ptr.y - d.y0;
          d.dist = Math.hypot(dx, dy);
          if (d.dist >= SWIPE.min) { d.moved = true; m.aim = swipeToAim(dx, dy); if (state.hint) state.hint = null; }
          d.c = cohesionOf(fingerSpeed(d.pts));
        }
        if (m.drag && ptr.released) {
          const d = m.drag; m.drag = null;
          if (d.moved) { release(m.aim, d.c ?? 0.5); break; }
          m.aim = d.a0;
        }
        const kd = input.keys.down;
        if (!m.drag) {
          if (kd.has('ArrowUp')) m.aim.a = clamp(m.aim.a + 14 * dt, AIM.aMin, AIM.aMax);
          if (kd.has('ArrowDown')) m.aim.a = clamp(m.aim.a - 14 * dt, AIM.aMin, AIM.aMax);
          if (kd.has('ArrowRight')) m.aim.v = clamp(m.aim.v + 160 * dt, AIM.vMin, AIM.vMax);
          if (kd.has('ArrowLeft')) m.aim.v = clamp(m.aim.v - 160 * dt, AIM.vMin, AIM.vMax);
          if (input.keys.pressed.has('Space')) { release(m.aim, KEY_C); break; }
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
        m.aim = { a: pl.from.a + (pl.a - pl.from.a) * f, v: pl.from.v + (pl.v - pl.from.v) * f };
        if (m.pt >= 1.0) release({ a: pl.a, v: pl.v }, 0);
        break;
      }
      case 'fly': {
        const fl = m.fl;
        fl.t += dt * rate;
        while (fl.i < fl.ev.length && fl.t >= fl.ev[fl.i].t) runEvent(fl.ev[fl.i++]);
        break;
      }
      case 'settle':
        if (m.fl) m.fl.t += dt;
        if (m.pt >= 0.8) {
          if (roundOver(m)) { m.ph = 'roundEnd'; m.pt = 0; m.fl = null; break; }
          saveResume(); beginTurn();
        }
        break;
      case 'roundEnd':
        if (m.pt >= 0.35) {
          if (solo(m)) { finishMatch(); break; }
          if (m.round >= m.rounds + m.extra) {
            if (m.score[0] !== m.score[1] || m.extra >= MAX_EXTRA) { finishMatch(); break; }
            m.extra++;
          }
          nextRound();
        }
        break;
      case 'over':
        if (m.pt >= 1.4) { state.scene = 'result'; state.ui.scroll = 0; state.paused = false; }
        break;
      default: break;
    }
  };

  // ---- store screenshots: ?shot=1&seed=N picks a fixed screen -------------------------------------------------------------------
  const applyPreset = () => {
    const n = Number(config.seed) || 1;
    state.shot = true;
    const setFlight = (t) => {
      const m = state.m, hand = { c: 0.9, ta: 0, tv: 0 };
      const pl = planFlick(m.sc, m.board, hand, 11, m.clock, { samples: 4, quality: 3 });
      const res = resolveFlick(m.sc, m.board, pl.best, hand, 3, m.clock);
      const first = res.events.length ? res.events[0].t : 0.6;
      m.fl = { res, t: t ?? first + 0.05, ev: [], i: 0, first, slow: [0, 0] };
      m.focus = focusFor(m.sc, res); m.ph = 'fly'; m.aim = { a: pl.best.a, v: pl.best.v };
      return res;
    };
    const play = (cfg, o = {}) => {
      startMatch({ len: 1, dist: 1, ...cfg });
      const m = state.m;
      m.ph = o.ph || 'aim'; m.pt = 0; m.turn = o.turn ?? 0; m.score = o.score || [0, 0]; m.clock = o.clock ?? 1.3;
      if (cfg.mode !== 'ladder') { m.round = o.round || 2; m.left = o.left || [2, 3]; m.sc = sceneFor(m.cfg, m.round, 0); m.board = newBoard(m.sc); m.perRound = m.sc.flicks; }
      else if (o.left) m.left = o.left;
      m.aim = o.aim || { a: 50, v: 520 };
      state.paused = false; state.camZ = o.camZ || 0;
    };
    if (n === 1) { state.scene = 'title'; return; }
    if (n === 2) { play({ mode: 'ladder', level: 0 }, { score: [10, 0], left: [3, 0], aim: { a: 54, v: 470 } }); state.m.lastAim[0] = { a: 50, v: 450 }; return; }
    if (n === 3) {
      play({ mode: 'ladder', level: 0 }, { score: [20, 0] });
      const res = setFlight(); const st = res.stands[0]; const t = st.fall ? st.fall.tLand + 0.12 : res.dur * 0.7;
      state.m.fl.t = t; state.camZ = 1; state.m.ph = 'settle';
      state.m.banner = { text: 'CLANG!', sub: `+${POINTS.clang}`, col: '#ffe08a', t: 0.5, life: 1.7 };
      const cam = cameraFor(playLayout().scene, state.m.sc, 1, state.m.focus), s0 = state.m.sc.stands[0], g = standGeom(s0);
      emit(state.fx, 'spark', sx(cam, s0.x), sy(cam, g.manesY), 14, frand, { speed: 240, size: 9, life: 2, cols: ['#fff6c8', '#ffd24a'] });
      for (const f of state.fx) f.life = 0.4;
      return;
    }
    if (n === 4) { play({ mode: 'ai', opp: 2 }, { score: [12, 10], round: 3 }); setFlight(); state.m.fl.t = Math.max(0.2, state.m.fl.first - 0.18); state.camZ = 0.55; return; }
    if (n === 5) {
      play({ mode: 'ladder', level: 4 }, { score: [10, 0], left: [3, 0] }); const m = state.m;
      const r = planFlick(m.sc, m.board, { c: 0.82, ta: HUMAN.ta, tv: HUMAN.tv }, 5, m.clock + 1.2, { samples: 4, quality: 3 });
      state.hint = { a: r.best.a, v: r.best.v, text: explain(r.best, m.sc, {}, 4) };
      m.aim = { a: r.best.a - 7, v: r.best.v * 0.93 };
      return;
    }
    if (n === 6) { play({ mode: 'ladder', level: 3 }, { score: [5, 0], left: [4, 0], aim: { a: 38, v: 500 }, clock: 2.2 }); return; }
    if (n === 7) { state.scene = 'rules'; state.ui.page = 3; state.ui.back = 'title'; return; }
    if (n === 8) { state.scene = 'about'; state.ui.page = 0; state.ui.back = 'title'; return; }
    if (n === 9) { state.scene = 'howto'; state.ui.page = 0; state.ui.back = 'title'; return; }
    if (n === 10) {
      play({ mode: 'watch', watch: [3, 2], len: 0 }, { turn: 1, ph: 'reveal', round: 2, score: [10, 15] });
      const m = state.m, r = planFlick(m.sc, m.board, { c: 0.9, ta: 0.3, tv: 0.6 }, 9, m.clock + 3, { samples: 4, quality: 3 });
      m.plan = { a: r.best.a, v: r.best.v, from: { a: 50, v: 520 }, top: r.top, text: explain(r.best, m.sc, {}, 4) };
      m.aim = { a: r.best.a, v: r.best.v };
      return;
    }
    if (n === 11) { state.scene = 'ladder'; state.record.stars = [3, 2, 2, 1, 0]; state.record.best = [48, 36, 33, 22, 0]; return; }
    if (n === 12) { play({ mode: 'ladder', level: 5 }, { score: [10, 0] }); state.pauseMenu = true; state.paused = true; return; }
    if (n === 13) { play({ mode: 'ai', opp: 1 }, { score: [27, 21] }); const m = state.m; m.winner = 0; m.round = 5; m.rounds = 5; m.stats = { clang: [6, 4], off: [2, 3], wobble: [2, 1], sunk: [5, 3], flicks: [13, 13] }; state.scene = 'result'; return; }
    if (n === 14) { state.settings.textIdx = 4; state.scene = 'rules'; state.ui.page = 3; return; }
    if (n === 15) {
      play({ mode: 'ladder', level: 3 }, { score: [5, 0], left: [3, 0], clock: 3.1 });
      const m = state.m, hand = { c: 0.95, ta: 0, tv: 0 };
      const pl = planFlick(m.sc, m.board, hand, 7, m.clock, { samples: 4, quality: 3 });
      const res = resolveFlick(m.sc, m.board, pl.best, hand, 4, m.clock);
      const sink = res.events.find((e) => e.type === 'sink');
      m.fl = { res, t: sink ? sink.t + 0.1 : res.dur * 0.6, ev: [], i: 0, first: 0, slow: [0, 0] }; m.focus = focusFor(m.sc, res); m.ph = 'fly'; state.camZ = 1;
      return;
    }
    if (n === 16) { state.settings.textIdx = 0; state.scene = 'settings'; return; }
    if (n === 17) { state.scene = 'setup'; return; }
    play({ mode: 'ladder', level: 2 }, { score: [8, 0] });
  };

  // ---- the object the kit and the shell see ----------------------------------------------------------------------------------------
  const game = {
    // Only live action uses up the free preview: water in the air, a computer flick in motion, or a thumb on the screen.
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
      if (state.layKey !== FR.key) {
        if (state.layKey && state.m) { state.m.drag = null; state.ui.drag = null; }
        state.layKey = FR.key;
      }
      budget = 0;
      setPress(input.pointer);
      if (state.shot) { state.t += dt; return; }
      if (!(state.paused && state.scene === 'play')) state.t += dt;
      if (state.scene === 'play' && state.m && !state.paused) state.camZ += (camTarget() - state.camZ) * (1 - Math.exp(-4.4 * dt));
      switch (state.scene) {
        case 'title': updateFlow('title', input, onTitle); break;
        case 'ladder': updateFlow('ladder', input, onLadder); break;
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
        case 'ladder': renderFlow(ctx, state, 'ladder'); break;
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
