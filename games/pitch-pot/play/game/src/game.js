// GAME CONTRACT (docs/GAME-CONTRACT.md): export meta + createGame(env) -> { update, render, getState }.
// Pitch Pot (touhu / tuho): pull back to set angle and power, lift to pitch a bamboo arrow at a bronze vase and score the mouth,
// bounce-ins and the ears. State machine: title / setup / settings / howto / about / rules / play / result / demolimit. Play phases:
//   intro -> aim (human) | think -> [reveal] -> act (computer) -> fly -> settle -> ... -> bonus -> roundEnd -> intro | over
import {
  newBoard, resolveThrow, applyThrow, chooseThrow, explain, solveSpeed, sweepSides, pullToAim, aimToPull, LEVELS, STYLES, LENGTHS, DISTANCES,
  ARROWS_EACH, HUMAN_SIGMA, POINTS, RIM_Y, MAX_EXTRA_ROUNDS, AIM, ARROW,
} from './sim.js';
import { FR, setFrame, setSceneD, TEXT_SCALES, THINK_STEPS, REVEAL_SECS, playLayout, readerLayout, inRect } from './layout.js';
import { emit, stepFx, TEAM, cameraFor, sx, sy } from './art.js';
import { setPress } from './ui.js';
import { renderTitle, renderFlow, renderModal, renderReader, hitFlow, flowMax, readerState, sideNames, flowRects } from './menus.js';
import { renderPlay, isHuman, hintRects, baseSigma, flightFrame } from './view.js';
import { pressLockup } from './brand.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };

const K_PULL = 0.62;                        // power units per unit of thumb travel
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const easeIO = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
const NOINPUT = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() }, wheel: { dx: 0, dy: 0 } };
const DEMO_MATCHES = 2;
const arrowFromTip = (tx, ty, th, side) => ({ x: tx - Math.cos(th) * ARROW.hl, y: ty - Math.sin(th) * ARROW.hl, th, side, kind: 'mouth' });

export function createGame(env) {
  const { rng, storage, monetization, audio, config } = env;
  let shotMode = false;
  try { shotMode = /[?&]shot=/.test(globalThis.location.search); } catch { shotMode = false; }

  const state = {
    scene: 'title', t: 0, shot: false, demo: !!config.demo, layKey: '', camZ: 0,
    settings: { textIdx: 0, thinkIdx: 1, sound: true, guide: true, dist: 1 },
    record: { played: 0, wins: 0, mouth: 0, bounce: 0, ear: 0, sweeps: 0, practiceBest: 0, demoGames: 0 },
    setup: { mode: 'ai', opp: 1, style: 0, len: 1 },
    ui: { scroll: 0, drag: null, page: 0, back: 'title' },
    m: null, resume: null, prevBest: 0,
    fx: [], floats: [], shake: 0, paused: false, pauseMenu: false, hint: null, has3d: false, credits: '', hero: null,
  };
  const frand = () => rng.next();
  state.owned = !!monetization.owns?.('unlock_game');
  state.restoreMsg = ''; state.restoreBusy = false;
  monetization.onChange?.(() => { state.owned = monetization.owns('unlock_game'); });

  // ---- saving ------------------------------------------------------------------------------------------------------------------
  const saveSettings = () => storage.set('settings', state.settings);
  const saveRecord = () => storage.set('record', state.record);
  const snapshot = (m) => ({ cfg: m.cfg, D: m.D, board: m.board, score: m.score, round: m.round, rounds: m.rounds, extra: m.extra, perRound: m.perRound, left: m.left, first: m.first, k: m.k, stats: m.stats, target: m.target, lastAim: m.lastAim });
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
  const tone = (o) => { if (budget < 5) { budget++; audio.tone(o); } };
  const sfx = {
    whoosh: () => tone({ freq: 520, to: 160, dur: 0.38, type: 'sine', vol: 0.06 }),
    bronze: (f = 0.6) => { tone({ freq: 420 + f * 160, to: 380 + f * 120, dur: 0.5, type: 'sine', vol: 0.07 + f * 0.1 }); tone({ freq: 1130 + f * 300, to: 1050, dur: 0.28, type: 'triangle', vol: 0.04 + f * 0.05 }); },
    wood: (f = 0.6) => tone({ freq: 240 + f * 120, to: 110, dur: 0.07, type: 'square', vol: 0.05 + f * 0.09 }),
    floor: (f = 0.6) => { tone({ freq: 120, to: 55, dur: 0.18, type: 'sine', vol: 0.12 + f * 0.2 }); tone({ freq: 700, to: 300, dur: 0.04, type: 'square', vol: 0.04 }); },
    drop: () => { tone({ freq: 330, to: 140, dur: 0.45, type: 'sine', vol: 0.12 }); tone({ freq: 660, to: 280, dur: 0.3, type: 'triangle', vol: 0.05 }); },
    chime: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.09 })),
    ear: () => [659, 880, 1175, 1568].forEach((f, i) => tone({ freq: f, dur: 0.3, type: 'sine', vol: 0.08 })),
    miss: () => tone({ freq: 190, to: 110, dur: 0.22, type: 'sine', vol: 0.08 }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'square', vol: 0.04 }),
    win: () => [523, 659, 784, 1047].forEach((f) => tone({ freq: f, dur: 0.28, type: 'triangle', vol: 0.1 })),
  };

  // ---- match setup ---------------------------------------------------------------------------------------------------------------
  const sideAt = (m, k) => (m.cfg.mode === 'solo' ? 0 : (m.first + k) % 2);
  const throwsPerRound = (m) => (m.cfg.mode === 'solo' ? m.perRound : m.perRound * 2);
  const defaultAim = (D) => { const a = 64; return { a, v: clamp(solveSpeed(a, D, RIM_Y + 1.5) || 520, AIM.vMin + 20, AIM.vMax - 20) }; };
  const newStats = () => ({ mouth: [0, 0], bounce: [0, 0], ear: [0, 0], throws: [0, 0], inPot: [0, 0], sweeps: [0, 0] });
  const newMatch = (cfg, from = null) => {
    const solo = cfg.mode === 'solo', D = DISTANCES[cfg.dist ?? 1].d;
    const lens = LENGTHS[cfg.style === 'race' ? 'race' : 'count'];
    const m = from ? { ...from } : {
      cfg, D, board: newBoard(), score: [0, 0], round: 1, rounds: solo ? 3 : cfg.style === 'race' ? 0 : lens[cfg.len ?? 1], extra: 0, perRound: ARROWS_EACH,
      left: solo ? [ARROWS_EACH, 0] : [ARROWS_EACH, ARROWS_EACH], first: solo ? 0 : rng.int(2), k: 0,
      target: solo || cfg.style !== 'race' ? 0 : lens[cfg.len ?? 1], stats: newStats(), lastAim: [defaultAim(D), defaultAim(D)],
    };
    Object.assign(m, { cfg, ph: 'intro', pt: 0, turn: sideAt(m, m.k), drag: null, fl: null, plan: null, banner: null, bonus: null, bonusDone: false, winner: -1, pendingWin: -1, thinkDur: 1 });
    m.aim = { ...m.lastAim[m.turn] };
    return m;
  };
  const startMatch = (cfg, from = null) => {
    if (state.demo && cfg.mode !== 'watch' && !from && state.record.demoGames >= DEMO_MATCHES) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.prevBest = state.record.practiceBest;
    state.m = newMatch(cfg, from);
    state.scene = 'play'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false; state.hint = null; state.fx = []; state.floats = []; state.shake = 0; state.camZ = 0;
    if (!from && state.demo && cfg.mode !== 'watch') { state.record.demoGames++; saveRecord(); }
    if (cfg.mode !== 'watch') monetization.track('match_start', { mode: cfg.mode });
  };

  // ---- a turn --------------------------------------------------------------------------------------------------------------------
  const levelOf = (m, side) => (m.cfg.mode === 'watch' ? m.cfg.watch[side] : m.cfg.opp);
  const beginTurn = () => {
    const m = state.m;
    m.turn = sideAt(m, m.k);
    m.aim = { ...m.lastAim[m.turn] }; m.drag = null; m.fl = null; state.hint = null; m.plan = null;
    if (isHuman(m, m.turn)) { m.ph = 'aim'; m.pt = 0; return; }
    const lv = LEVELS[levelOf(m, m.turn)], watch = m.cfg.mode === 'watch';
    const res = chooseThrow(m.board, m.D, lv.sig, rng.int(1 << 30), { quality: lv.quality, samples: watch ? lv.samples + 2 : lv.samples });
    const pick = res.best;
    m.plan = { a: pick.a, v: pick.v, text: explain(pick), top: res.top.map((c) => ({ a: c.a, v: c.v })), from: { ...m.aim } };
    m.thinkDur = watch ? THINK_STEPS[state.settings.thinkIdx] : lv.think[0] + frand() * (lv.think[1] - lv.think[0]);
    m.ph = 'think'; m.pt = 0;
  };

  const floatAt = (x, y, text, col, o = {}) => state.floats.push({ x, y, text, col, t: 0, life: o.life ?? 1.4, size: o.size ?? 40, big: !!o.big });
  const banner = (text, sub, col) => { state.m.banner = { text, sub, col, t: 0, life: 1.7 }; };
  const camNow = () => cameraFor(playLayout().scene, state.m.D, state.camZ);

  const release = (aim) => {
    const m = state.m, side = m.turn;
    const a = { a: clamp(aim.a, AIM.aMin, AIM.aMax), v: clamp(aim.v, AIM.vMin, AIM.vMax) };
    const res = resolveThrow(m.board, m.D, side, a, baseSigma(state, side), rng.int(1 << 30), true);
    const ev = [];
    for (const c of res.contacts) ev.push({ t: c.t, type: 'hit', kind: c.kind, force: c.force, x: c.x, y: c.y });
    if (res.entered >= 0 && res.status !== 'miss') ev.push({ t: res.entered, type: 'enter' });
    ev.push({ t: res.dur + 0.3, type: 'end' });
    ev.sort((x, y) => x.t - y.t);
    m.fl = { res, t: 0, ev, i: 0 };
    m.left[side]--; m.k++; m.stats.throws[side]++;
    m.lastAim[side] = { ...a };
    m.ph = 'fly'; m.pt = 0; m.drag = null; state.hint = null;
    sfx.whoosh();
  };

  const award = (side, pts) => {
    const m = state.m;
    m.score[side] += pts;
    if (m.cfg.mode !== 'solo' && m.cfg.style === 'race' && m.pendingWin < 0 && m.score[side] >= m.target) m.pendingWin = side;
  };
  const humanRec = (m, side) => (m.cfg.mode === 'ai' || m.cfg.mode === 'solo') && side === 0;

  const runEvent = (e) => {
    const m = state.m, fl = m.fl, res = fl.res, side = res.side, cam = camNow();
    const pt = (x, y) => ({ x: sx(cam, x), y: sy(cam, y) });
    if (e.type === 'hit') {
      const p = pt(e.x, e.y);
      if (e.kind === 'bronze') { sfx.bronze(e.force); emit(state.fx, 'ring', p.x, p.y, 1, frand, { speed: 0, size: 6, life: 0.5, cols: ['#ffe9a8'] }); emit(state.fx, 'spark', p.x, p.y, 3, frand, { speed: 120, size: 6, life: 0.3, cols: ['#fff0b0'] }); }
      else if (e.kind === 'floor') { sfx.floor(e.force); emit(state.fx, 'mist', p.x, p.y, 2, frand, { speed: 40, size: 8, life: 0.8 }); state.shake = Math.max(state.shake, e.force * 0.5); }
      else sfx.wood(e.force);
    } else if (e.type === 'enter') {
      sfx.drop();
    } else if (e.type === 'end') {
      applyThrow(m.board, res);
      const end = pt(res.end.x, res.end.y), top = pt(m.D, RIM_Y + 6);
      if (res.status !== 'miss') {
        m.stats.inPot[side]++;
        const key = res.kind;
        m.stats[key][side]++;
        if (humanRec(m, side)) state.record[key]++;
        award(side, res.points);
        const col = res.kind === 'ear' ? '#9fe0ff' : res.kind === 'bounce' ? '#ffd98a' : '#fff1c4';
        if (res.kind === 'ear') { sfx.ear(); banner('THROUGH THE EAR!', '', col); }
        else if (res.kind === 'bounce') { sfx.chime(); banner('BOUNCE-IN!', '', col); }
        else { sfx.chime(); banner('IN THE MOUTH', '', col); }
        state.shake = 0.6;
        emit(state.fx, 'petal', top.x, top.y, 22, frand, { speed: 190, size: 8, life: 1.6, up: 160, cols: ['#ffd5d5', '#fff0e6', '#ffb7c5'] });
        emit(state.fx, 'ink', top.x, top.y, 10, frand, { speed: 160, size: 9, life: 0.9, up: 140 });
        emit(state.fx, 'spark', top.x, top.y, 12, frand, { speed: 240, size: 9, life: 0.5, cols: ['#fff6c8', '#ffd24a'] });
        floatAt(top.x, top.y - 20, `+${res.points}`, col, { size: 54, big: true });
      } else {
        sfx.miss();
        const e2 = { x: clamp(end.x, 40, FR.w - 40), y: clamp(end.y - 30, 160, FR.h - 160) };
        floatAt(e2.x, e2.y, 'Miss', '#ffb4a2', { size: 34 });
      }
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
  const openPause = () => { const m = state.m; if (state.scene !== 'play' || !m || m.ph === 'over') return; state.paused = true; if (m.cfg.mode !== 'watch') { state.pauseMenu = true; state.ui.scroll = 0; m.drag = null; } };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const toTitle = () => { saveResume(); state.scene = 'title'; state.m = null; state.paused = false; state.pauseMenu = false; state.hint = null; state.ui.scroll = 0; };
  const openReader = (scene, back) => { state.scene = scene; state.ui.back = back; state.ui.page = 0; state.ui.scroll = 0; state.ui.drag = null; };
  const think = () => {
    const m = state.m;
    if (!m || m.ph !== 'aim' || !isHuman(m, m.turn)) return;
    const r = chooseThrow(m.board, m.D, HUMAN_SIGMA, rng.int(1 << 30), { quality: 2, samples: 6 });
    state.hint = { a: r.best.a, v: r.best.v, text: explain(r.best) };
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
    else if (id === 'solo') startMatch({ mode: 'solo', style: 'count', len: 1, dist: state.settings.dist });
    else if (id === 'watch') startMatch({ mode: 'watch', watch: [3, 2], opp: 2, style: 'count', len: 0, dist: state.settings.dist });
    else if (id === 'resume' && state.resume) startMatch(state.resume.cfg, JSON.parse(JSON.stringify(state.resume)));
    else if (id === 'howto' || id === 'rules' || id === 'about') openReader(id, 'title');
    else if (id === 'settings') { state.scene = 'settings'; state.ui.back = 'title'; state.ui.scroll = 0; }
    else if (id === 'arcforge') { pressLockup(); env.openArcforgeHome?.(); }
  };
  const onSetup = (id) => {
    const s = state.setup;
    if (/^lv\d$/.test(id)) s.opp = Number(id[2]);
    else if (/^st\d$/.test(id)) s.style = Number(id[2]);
    else if (/^ln\d$/.test(id)) s.len = Number(id[2]);
    else if (/^ds\d$/.test(id)) { state.settings.dist = Number(id[2]); saveSettings(); }
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, style: STYLES[s.style].id, len: s.len, dist: state.settings.dist });
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
        state.owned = monetization.owns('unlock_game');
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
    if (m && m.banner) { m.banner.t += dt; if (m.banner.t > m.banner.life) m.banner = null; }
  };
  const camTarget = () => {
    const m = state.m;
    if (!m) return 0;
    if (m.ph === 'fly' && m.fl) { const f = flightFrame(m.fl); return f.x > m.D * 0.38 || m.fl.t >= m.fl.res.dur ? 1 : 0; }
    if (m.ph === 'settle' || (m.ph === 'bonus' && m.pt < 0.6)) return 1;
    return 0;
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
    m.pt += dt;
    switch (m.ph) {
      case 'intro':
        if (m.pt >= 0.9) beginTurn();
        break;
      case 'aim': {
        if (ptr.pressed && !hit && ptr.y > L.hud.y + L.hud.h * 0.4) { m.drag = { px: ptr.x, py: ptr.y, pull: aimToPull(m.aim.a, m.aim.v), a0: { ...m.aim }, moved: 0 }; }
        if (m.drag && ptr.down) {
          const d = m.drag;
          const px = d.pull.px + (d.px - ptr.x) * K_PULL, py = d.pull.py + (ptr.y - d.py) * K_PULL;
          const r = pullToAim(px, py);
          m.aim = { a: r.a, v: r.v };
          d.moved = Math.max(d.moved, Math.hypot(ptr.x - d.px, ptr.y - d.py));
          if (state.hint && d.moved > 8) state.hint = null;
        }
        if (m.drag && ptr.released) {
          const d = m.drag; m.drag = null;
          if (d.moved >= 12) { release(m.aim); break; }
          m.aim = d.a0;
        }
        const kd = input.keys.down;
        if (!m.drag) {
          if (kd.has('ArrowUp')) m.aim.a = clamp(m.aim.a + 14 * dt, AIM.aMin, AIM.aMax);
          if (kd.has('ArrowDown')) m.aim.a = clamp(m.aim.a - 14 * dt, AIM.aMin, AIM.aMax);
          if (kd.has('ArrowRight')) m.aim.v = clamp(m.aim.v + 160 * dt, AIM.vMin, AIM.vMax);
          if (kd.has('ArrowLeft')) m.aim.v = clamp(m.aim.v - 160 * dt, AIM.vMin, AIM.vMax);
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
        m.aim = { a: pl.from.a + (pl.a - pl.from.a) * f, v: pl.from.v + (pl.v - pl.from.v) * f };
        if (m.pt >= 1.0) release({ a: pl.a, v: pl.v });
        break;
      }
      case 'fly': {
        const fl = m.fl, res = fl.res;
        let rate = 1;
        if (fl.t < res.dur) { const f = flightFrame(fl); if (f.x > m.D - 55 && f.x < m.D + 40 && f.y < 85) rate = 0.5; }
        fl.t += dt * rate;
        while (fl.i < fl.ev.length && fl.t >= fl.ev[fl.i].t) runEvent(fl.ev[fl.i++]);
        break;
      }
      case 'settle':
        if (m.pt >= 0.55) {
          if (m.pendingWin >= 0) { finishMatch(); break; }
          if (m.k >= throwsPerRound(m)) { m.ph = 'bonus'; m.pt = 0; m.bonus = m.cfg.mode === 'solo' ? (m.stats.inPot[0] >= ARROWS_EACH ? [0] : []) : sweepSides(m.stats); m.bonusDone = false; }
          else { saveResume(); beginTurn(); }
        }
        break;
      case 'bonus':
        if (!m.bonusDone && m.pt >= 0.5) {
          m.bonusDone = true;
          if (m.bonus.length) {
            m.bonus.forEach((s) => { award(s, POINTS.sweep); m.stats.sweeps[s]++; if (humanRec(m, s)) state.record.sweeps++; });
            const names = sideNames(m.cfg);
            banner('SWEEP!', `${m.bonus.map((s) => names[s] || 'You').join(' and ')} +${POINTS.sweep}`, '#ffd98a');
            sfx.chime();
          }
        }
        if (m.pt >= 1.9) {
          if (m.pendingWin >= 0) { finishMatch(); break; }
          const solo = m.cfg.mode === 'solo', race = m.cfg.style === 'race';
          const total = m.rounds + m.extra;
          if (!race && m.round >= total) {
            if (solo || m.score[0] !== m.score[1] || m.extra >= MAX_EXTRA_ROUNDS) { finishMatch(); break; }
            m.extra++;
          }
          m.ph = 'roundEnd'; m.pt = 0;
        }
        break;
      case 'roundEnd':
        if (m.pt >= 0.3) {
          m.round++; m.k = 0; m.first = m.cfg.mode === 'solo' ? 0 : 1 - m.first;
          m.board.arrows = []; m.stats.inPot = [0, 0];
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
  const applyPreset = () => {
    const n = Number(config.seed) || 1;
    state.shot = true;
    const D = DISTANCES[1].d;
    const play = (cfg, arrows, o = {}) => {
      startMatch({ style: 'count', len: 1, dist: 1, ...cfg });
      const m = state.m;
      m.board.arrows = arrows; m.score = o.score || [8, 6]; m.round = o.round || 2; m.ph = o.ph || 'aim'; m.pt = 0; m.k = arrows.length; m.first = 0;
      m.left = o.left || [ARROWS_EACH - Math.ceil(arrows.length / 2), ARROWS_EACH - Math.floor(arrows.length / 2)]; m.turn = o.turn ?? 0; m.aim = o.aim || { a: 64, v: solveSpeed(64, D, RIM_Y + 1.5) };
      state.paused = false; state.camZ = o.camZ || 0;
    };
    const inPot = [arrowFromTip(D - 1.2, 16, -1.5, 0), arrowFromTip(D + 1.8, 24, -1.35, 1), arrowFromTip(D - 0.3, 31, -1.62, 0)];
    const onFloor = { x: D - 46, y: 0.6, th: 0.04, side: 1, kind: 'miss' };
    if (n === 1) { state.scene = 'title'; return; }
    if (n === 2) { play({ mode: 'ai', opp: 2 }, [inPot[0], onFloor], { aim: { a: 66, v: solveSpeed(66, D, RIM_Y + 1.5) } }); return; }
    if (n === 3) {
      play({ mode: 'ai', opp: 2 }, inPot, { ph: 'settle', camZ: 1, score: [9, 6] });
      state.m.banner = { text: 'BOUNCE-IN!', sub: '', col: '#ffd98a', t: 0.5, life: 1.7 };
      const cam = cameraFor(playLayout().scene, D, 1);
      emit(state.fx, 'petal', sx(cam, D), sy(cam, RIM_Y + 6), 30, frand, { speed: 200, size: 9, life: 2, cols: ['#ffd5d5', '#fff0e6', '#ffb7c5'] });
      for (const f of state.fx) { f.life = 0.35; }
      state.floats.push({ x: sx(cam, D), y: sy(cam, RIM_Y + 4), text: '+3', col: '#ffd98a', t: 0.2, life: 1.4, size: 54, big: true });
      return;
    }
    if (n === 4) {
      // an arrow in flight, close view
      play({ mode: 'ai', opp: 3 }, inPot.slice(0, 2), { ph: 'fly', camZ: 1 });
      const m = state.m, res = resolveThrow(m.board, D, 0, { a: 66, v: solveSpeed(66, D, RIM_Y + 1.5) }, { a: 0, v: 0 }, 7, true);
      let ti = res.track.findIndex((q) => q[0] > D - 24); if (ti < 0) ti = 40;
      m.fl = { res, t: ti / 60, ev: [], i: 0 };
      return;
    }
    if (n === 5) { play({ mode: 'ai', opp: 2 }, [inPot[0], onFloor], { aim: { a: 62, v: solveSpeed(62, D, RIM_Y + 1.5) } }); state.hint = { a: 68, v: solveSpeed(68, D, RIM_Y + 1.5), text: 'Aimed at the mouth, launch 68 degrees. In 30 test throws: 63% finished in the pot, 13% as bounce-ins, 7% in an ear. About 2.3 points per arrow.' }; return; }
    if (n === 6) { play({ mode: 'ai', opp: 1 }, inPot, { score: [21, 15] }); const m = state.m; m.winner = 0; m.round = 4; m.stats = { mouth: [6, 4], bounce: [3, 2], ear: [1, 0], throws: [16, 16], inPot: [0, 0], sweeps: [1, 0] }; state.scene = 'result'; return; }
    if (n >= 7 && n <= 9) { state.scene = ['rules', 'howto', 'about'][n - 7]; state.ui.page = n === 7 ? 3 : 0; state.ui.back = 'title'; return; }
    if (n === 10) { play({ mode: 'watch', watch: [3, 2], opp: 2, len: 0 }, inPot.slice(0, 2), { turn: 1, ph: 'reveal' }); const v = (a) => solveSpeed(a, D, RIM_Y + 1.5); state.m.plan = { a: 68, v: v(68), from: { a: 64, v: v(64) }, text: 'Aimed at the mouth, launch 68 degrees. In 14 test throws: 71% finished in the pot, 14% as bounce-ins. About 2.1 points per arrow.', top: [{ a: 68, v: v(68) }, { a: 60, v: v(60) }, { a: 74, v: v(74) }, { a: 56, v: v(56) }] }; return; }
    if (n === 11) { state.scene = 'settings'; return; }
    if (n === 12) { state.scene = 'setup'; return; }
    if (n === 13) { state.settings.textIdx = 4; state.scene = 'rules'; state.ui.page = 3; return; }
    if (n === 14) { play({ mode: 'solo' }, inPot.slice(0, 2), { left: [2, 0], score: [7, 0] }); return; }
    if (n === 15) { play({ mode: 'ai', opp: 2 }, inPot); state.pauseMenu = true; state.paused = true; return; }
    play({ mode: 'ai', opp: 2 }, inPot.slice(0, 1));
  };

  // ---- the object the kit and the shell see ----------------------------------------------------------------------------------------
  const game = {
    // Only live action uses up the free preview: an arrow in the air, a computer throw in motion, or a thumb on the screen.
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
      setSceneD(state.m ? state.m.D : 240);
      { // keep the preview pill clear of the scores and the message line
        const PL = playLayout();
        meta.previewBadge = state.scene !== 'play' ? null : { x: PL.hud.x, y: PL.land ? PL.hud.y + PL.hud.h + 10 : PL.hud.y + PL.hud.h + 70, align: 'left' };
      }
      config.textScale = TEXT_SCALES[state.settings.textIdx];
      if (state.layKey !== FR.key) {
        if (state.layKey && state.m) { state.m.drag = null; state.ui.drag = null; }
        state.layKey = FR.key;
      }
      budget = 0;
      setPress(input.pointer);
      if (state.shot) { state.t += dt; return; }
      if (!(state.paused && state.scene === 'play')) state.t += dt;
      // the camera eases in on the vase while an arrow is arriving, and back out for the next throw
      if (state.scene === 'play' && state.m && !state.paused) state.camZ += (camTarget() - state.camZ) * (1 - Math.exp(-4.2 * dt));
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
      ctx.clearRect(0, 0, meta.width, meta.height);
      setFrame(meta.width, meta.height);
      setSceneD(state.m ? state.m.D : 240);
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
    setHas3d(on) { state.has3d = !!on; },
    setCredits(t) { state.credits = String(t || ''); },
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
