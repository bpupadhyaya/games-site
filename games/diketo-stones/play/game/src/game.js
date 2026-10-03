// Diketo: Stones. State and flow. Rules and physics live in sim.js, the computer players in ai.js, drawing in
// view.js / art.js / menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, lessons, lessonintro, settings, play (also Learn and Watch & Learn), result, howto/about/rules, demolimit.
// A match is a series of turns. A turn is a series of tosses until a fault. One toss has phases:
//   ready (hold the pad) -> charge -> air (tap the stones, tap CATCH) -> resolve.
// The computer plays the same phases through `ai`. Watch & Learn adds the beat: THINK (frozen) -> REVEAL (frozen) -> ACT.
import {
  W, H, HOME, PIT, R, CHARGE_SECS, H_MIN, WIN_EARLY, WIN_LATE, TAP_REACT, TAP_GAP,
  MODES, winScale, clamp, dist, legTime, airtime, landing, newRoll, planLegs, handAt, catchResult, applyToss, dropSpots, freshPlayer, playerDone,
  slotPos, stageCount, pitRadius,
} from './sim.js';
import { LEVELS, HINT, tossCtx, rankPlans, aiToss, preTime } from './ai.js';
import { inRect, playLayout, toWorld, TEXT_DEC, TEXT_INC, CLOSE_BTN, TEXT_SCALES, THINK_STEPS, SETUP_PINS } from './layout.js';
import { renderPlay, hintMeta } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderLessons, renderLessonIntro, hitScreen, flowMeta, readerMax, readerPage, ensureLayout } from './menus.js';
import { LESSONS, DEMO_LESSONS } from './lessons.js';
import { pagesFor, tx } from './content.js';
import { explainPlan } from './explain.js';
import { setPress } from './ui.js';

export const meta = { width: W, height: H };
export const DEMO_MATCH_CAP = 2;
const REVEAL_SECS = 2;
const HINT_SECS = 9;
const MAX_PARTS = 160;
const MATCH_VERSION = 1;
const STEP = 1 / 60;

export function createGame(env) {
  const nowMs = () => (env.clock ? env.clock() : 0);   // display clock from the shell; absent in headless runs (alpha stays 1)
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork(), aiRng = rng.fork(), rollRng = rng.fork(), spotRng = rng.fork(), attRng = rng.fork();
  const shotSeed = config.seed >= 800001 && config.seed <= 800060 && typeof location !== 'undefined' && /[?&]shot=1/.test(location.search) ? config.seed - 800000 : 0;
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, freeze: false, shot: !!shotSeed,
    settings: { sound: true, calm: false, textIdx: 0, thinkIdx: 1 },
    record: { played: 0, wins: [0, 0, 0, 0, 0], streak: 0, bestStreak: 0, demoMatches: 0, lessons: LESSONS.map(() => false) },
    setup: { opp: 'cpu', lvl: 1, len: 'quick' }, setupMsg: '', restoreMsg: '',
    ui: { scroll: 0, drag: null, hscroll: 0, hdrag: null }, page: 0, lessonSel: 0,
    match: null, rd: null, att: null, saved: null, toast: '', toastT: 0, loaded: false,
  };
  // wall-clock drawing helpers stay out of the enumerable state (hashes and saves never see them)
  for (const k of ['alpha', 'updAt']) Object.defineProperty(state, k, { value: undefined, writable: true, enumerable: false });
  let savedSnap = null;
  const T = (key, vars) => tx(key, vars);

  // ---- persistence ---------------------------------------------------------------------------------
  const saveSettings = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  const metaOf = (s) => { const total = stageCount(s.cfg.len); const cpu = s.cfg.mode === 'cpu'; return { label: `You: stage ${Math.min(s.ps[0].stage, total)} of ${total}`, progress: `${cpu ? LEVELS[s.cfg.lvl].name : 'Player 2'}: stage ${Math.min(s.ps[1].stage, total)} of ${total}` }; };
  const validPlayer = (p, n) => p && Array.isArray(p.pit) && Array.isArray(p.ground) && p.pit.length + p.ground.length === n && (p.dir === 'out' || p.dir === 'in') && Number.isFinite(p.stage) && Number.isFinite(p.done);
  const validSnap = (d) => d && d.v === MATCH_VERSION && d.cfg && (d.cfg.mode === 'cpu' || d.cfg.mode === 'pass') && MODES[d.cfg.len] && Array.isArray(d.ps) && d.ps.length === 2 && validPlayer(d.ps[0], MODES[d.cfg.len].n) && validPlayer(d.ps[1], MODES[d.cfg.len].n);
  // A match in progress is saved at the start of every toss and when the pause menu opens. Resume always opens paused.
  const persistMatch = () => {
    const m = state.match, rd = state.rd;
    if (state.shot || !m || !rd || (m.cfg.mode !== 'cpu' && m.cfg.mode !== 'pass') || m.over || state.scene !== 'play') return;
    if (!['ready', 'charge'].includes(rd.phase)) return;
    const snap = { v: MATCH_VERSION, cfg: { ...m.cfg }, ps: JSON.parse(JSON.stringify(m.ps)), turn: m.turn, turns: m.turns, stats: JSON.parse(JSON.stringify(m.stats)) };
    for (const p of snap.ps) p.ground = p.ground.map((g) => ({ id: g.id, x: g.x, y: g.y, rot: g.rot }));
    savedSnap = JSON.parse(JSON.stringify(snap));
    state.saved = metaOf(savedSnap);
    storage.set('match', snap);
  };
  const clearSave = () => { savedSnap = null; state.saved = null; storage.remove('match'); };
  const resumeMatch = () => {
    if (!savedSnap) return;
    const sn = JSON.parse(JSON.stringify(savedSnap));
    state.match = { cfg: sn.cfg, ps: sn.ps, turn: sn.turn, turns: sn.turns, stats: sn.stats, over: null, learnWins: 0 };
    state.scene = 'play'; state.ui.scroll = 0; state.toastT = 0; state.paused = false; state.pauseMenu = false;
    newTurnState(sn.turn);
    beginReady();
    openPause();
  };

  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('match', null)]).then(([s, r, d]) => {
    if (state.shot) { state.loaded = true; return; }
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    if (validSnap(d)) { savedSnap = d; state.saved = metaOf(d); }
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(state.record.lessons) || state.record.lessons.length !== LESSONS.length) state.record.lessons = LESSONS.map((_, i) => !!(state.record.lessons ?? [])[i]);
    if (!Array.isArray(state.record.wins) || state.record.wins.length !== 5) state.record.wins = [0, 0, 0, 0, 0];
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound -----------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 210, to: 130, dur: 0.22, type: 'sawtooth', vol: 0.05 }),
    clack: (v = 1) => { tone({ freq: 1500 + fx.next() * 500, to: 700, dur: 0.05, type: 'triangle', vol: 0.07 * v }); tone({ freq: 240 + fx.next() * 60, dur: 0.07, type: 'sine', vol: 0.06 * v }); },
    toss: () => tone({ freq: 300, to: 900, dur: 0.22, type: 'sine', vol: 0.06 }),
    scoop: () => tone({ freq: 520 + fx.next() * 120, to: 880, dur: 0.07, type: 'triangle', vol: 0.06 }),
    catchOk: (q) => { tone({ freq: 880, dur: 0.1, type: 'triangle', vol: 0.09 }); if (q >= 1) tone({ freq: 1320, dur: 0.16, type: 'triangle', vol: 0.07 }); if (q >= 2) tone({ freq: 1760, dur: 0.22, type: 'sine', vol: 0.06 }); },
    fault: () => { tone({ freq: 200, to: 110, dur: 0.3, type: 'sawtooth', vol: 0.07 }); tone({ freq: 90, dur: 0.2, type: 'sine', vol: 0.1 }); },
    clear: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.09 })),
    win: () => [0, 2, 4, 7, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
    lose: () => [0, -3, -7].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.3 + i * 0.05, type: 'triangle', vol: 0.08 })),
    charge: (h) => tone({ freq: 200 + h * 500, dur: 0.05, type: 'sine', vol: 0.03 }),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- particles (localized only: dust and rings, nothing moves the yard) ---------------------------------------
  const burst = (rd, x, y, n, power = 1, kind = 'spark') => {
    for (let i = 0; i < n && rd.parts.length < MAX_PARTS; i++) {
      const a = fx.next() * Math.PI * 2, sp = (40 + fx.next() * 200) * power;
      rd.parts.push({ kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, t: 0, max: 0.35 + fx.next() * 0.4, size: kind === 'dust' ? 18 + fx.next() * 14 : 7 + fx.next() * 8, rot: fx.next() * 3, col: '#fff3c4' });
    }
  };
  const stepParts = (parts, dt) => {
    for (const p of parts) { p.t += dt; p.x += (p.vx ?? 0) * dt; p.y += (p.vy ?? 0) * dt; if (p.kind === 'spark') p.vy += 260 * dt; if (p.kind === 'dust') { p.vx *= 0.95; p.vy *= 0.95; } }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };
  const ring = (rd, x, y, size, col) => rd.parts.push({ kind: 'ring', x, y, vx: 0, vy: 0, t: 0, max: 0.55, size, col });
  const floatText = (rd, text, x, y, col = '#fff6e2') => rd.floats.push({ text, x, y, t: 0, max: 1.3, col });

  // ---- who plays ---------------------------------------------------------------------------------------
  const isWatch = () => !!state.match && state.match.cfg.mode === 'watch';
  const isLearn = () => !!state.match && state.match.cfg.mode === 'learn';
  const modeOf = () => state.match.cfg.len;
  const actorIsAI = () => {
    const m = state.match;
    if (!m) return false;
    return m.cfg.mode === 'watch' || (m.cfg.mode === 'cpu' && m.turn === 1);
  };
  const levelOf = (who) => {
    const c = state.match.cfg;
    return LEVELS[c.mode === 'watch' ? (who === 0 ? c.lvlA : c.lvl) : c.lvl];
  };
  const nameOf = (who) => {
    const c = state.match.cfg;
    if (c.mode === 'learn') return T('you');
    if (c.mode === 'watch') return levelOf(who).name;
    if (c.mode === 'pass') return T(who === 0 ? 'p1' : 'p2');
    return who === 0 ? T('you') : LEVELS[c.lvl].name;
  };
  const lessonId = () => LESSONS[state.match.cfg.lesson].id;

  function newTurnState(who) {
    state.rd = {
      who, phase: 'ready', pt: 0, charge: 0, chargeH: H_MIN, h: 0.5, roll: null, L: { ...HOME }, T: 1, ctx: null, taps: [], ev: null, taken: null, spots: null,
      et: 0, etPrev: 0, det: 0, res: null, resAt: null, catchAt: null, eps: null, event: null, parts: [], floats: [], trail: [], flash: 0,
      hint: null, beat: null, ai: null, banner: null, bannerT: 0, resDur: 1, pv: null, dir: 'out', swipe: false, keyCharge: false, lastC: -1, picked: [], dropped: false,
    };
  }
  const setPhaseKeep = (p) => { state.rd.phase = p; state.rd.pt = 0; };

  function startMatch(cfg) {
    if (state.demo && (cfg.mode === 'cpu' || cfg.mode === 'pass') && state.record.demoMatches >= DEMO_MATCH_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const learn = cfg.mode === 'learn';
    const len = learn ? LESSONS[cfg.lesson].mode : (cfg.len ?? 'quick');
    state.match = {
      cfg: { mode: 'cpu', lvl: 1, ...cfg, len }, ps: [learn ? LESSONS[cfg.lesson].player() : freshPlayer(len), freshPlayer(len)], turn: 0, turns: 0,
      stats: { tosses: [0, 0], faults: [0, 0] }, over: null, learnWins: 0,
    };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    if (state.demo && (cfg.mode === 'cpu' || cfg.mode === 'pass')) { state.record.demoMatches++; saveSettings(); }
    startTurn(cfg.mode === 'cpu' ? (state.record.played + (cfg.flip | 0)) % 2 : 0);   // the first turn alternates, so neither side always starts
  }
  function startTurn(who) {
    const m = state.match;
    m.turn = who;
    newTurnState(who);
    const rd = state.rd;
    if (m.cfg.mode !== 'learn') { rd.banner = { kind: 'turn', text: T('turnStart', { name: nameOf(who) }) }; rd.bannerT = 1.3; }
    beginReady();
  }

  // ---- getting ready to toss -----------------------------------------------------------------------------------
  const heightFor = (charge) => clamp(H_MIN + (1 - H_MIN) * clamp(charge / CHARGE_SECS, 0, 1), H_MIN, 1);
  function previewNeed(ctx) {
    // the route if the player simply goes for the stones nearest the hand first, at a steady tap pace, landing at the resting spot
    const left = ctx.stones.slice(), near = [];
    let px = HOME.x, py = HOME.y;
    if (ctx.sweep) near.push(...left);
    else while (near.length < ctx.take && left.length) { left.sort((a, b) => dist(px, py, a.x, a.y) - dist(px, py, b.x, b.y)); const s = left.shift(); near.push(s); px = s.x; py = s.y; }
    const pre = preTime(ctx, near, TAP_REACT, TAP_GAP);
    return pre.ready + legTime(dist(pre.px, pre.py, HOME.x, HOME.y));
  }
  function beginReady() {
    const rd = state.rd, m = state.match, p = m.ps[rd.who];
    rd.phase = 'ready'; rd.pt = 0; rd.charge = 0; rd.chargeH = H_MIN; rd.taps = []; rd.ev = null; rd.taken = null; rd.res = null; rd.resAt = null; rd.catchAt = null; rd.eps = null;
    rd.trail = []; rd.hint = null; rd.ai = null; rd.beat = null; rd.swipe = false; rd.dir = p.dir; rd.event = null; rd.picked = []; rd.dropped = false; rd.et = 0; rd.etPrev = 0;
    rd.ctx = tossCtx(modeOf(), p, HOME);
    rd.pv = { need: previewNeed(rd.ctx) };
    if (isWatch()) startBeat();
    persistMatch();
  }

  function releaseToss(h) {
    const rd = state.rd, m = state.match, p = m.ps[rd.who];
    rd.h = h; rd.roll = newRoll(rollRng); rd.L = landing(h, rd.roll); rd.T = airtime(h);
    rd.ctx = tossCtx(modeOf(), p, rd.L); rd.dir = p.dir;
    rd.spots = p.dir === 'out' ? dropSpots(spotRng, rd.ctx.take, p.ground) : null;
    rd.taps = []; rd.ev = planLegs(rd.ctx, []); rd.taken = null; rd.et = 0; rd.etPrev = 0; rd.res = null; rd.resAt = null; rd.catchAt = null; rd.eps = null; rd.hint = null; rd.trail = []; rd.picked = []; rd.dropped = false;
    m.stats.tosses[rd.who]++;
    sfx.toss();
    setPhaseKeep('air');
  }

  // ---- the air: taps pick stones, the hand follows --------------------------------------------------------------
  const winOf = () => winScale(state.rd.h);
  const originOf = (id) => { const rd = state.rd, p = state.match.ps[rd.who]; const g = p.ground.find((q) => q.id === id); return g ? { x: g.x, y: g.y } : slotPos(id, p.pit.length + p.ground.length); };
  function refreshTaken() {
    const rd = state.rd;
    rd.taken = rd.ev.picks.map((pk, i) => {
      const to = rd.dir === 'in' ? slotPos(pk.id, MODES[modeOf()].n) : rd.spots[i];
      return { id: pk.id, tPick: pk.t, from: originOf(pk.id), to, rot: rd.dir === 'out' ? rd.spots[i].rot : 0 };
    });
  }
  // The stone under a point (a sweep: anywhere on the group or in the hole). Returns an id or null.
  function hitStone(wp) {
    const rd = state.rd, ctx = rd.ctx;
    if (!ctx || !ctx.stones.length) return null;
    if (ctx.sweep) {
      if (ctx.dir === 'out') return dist(wp.x, wp.y, PIT.x, PIT.y) <= pitRadius(MODES[modeOf()].n) + 14 ? ctx.stones[0].id : null;
      const cx = ctx.stones.reduce((a, s) => a + s.x, 0) / ctx.stones.length, cy = ctx.stones.reduce((a, s) => a + s.y, 0) / ctx.stones.length;
      const near = ctx.stones.some((s) => dist(wp.x, wp.y, s.x, s.y) <= R * 2.2);
      return near || dist(wp.x, wp.y, cx, cy) <= 70 ? ctx.stones[0].id : null;
    }
    let best = null, bd = R * 2.2;
    for (const s of ctx.stones) { const d = dist(wp.x, wp.y, s.x, s.y); if (d < bd) { bd = d; best = s; } }
    return best ? best.id : null;
  }
  function addTap(id) {
    const rd = state.rd;
    if (rd.phase !== 'air' || rd.res) return false;
    if (rd.taps.some((q) => q.id === id)) return false;
    if (!rd.ctx.sweep && rd.taps.length >= rd.ctx.take) return false;
    if (rd.ctx.sweep && rd.taps.length >= 1) return false;
    rd.taps.push({ t: rd.et, id });
    rd.ev = planLegs(rd.ctx, rd.taps);
    refreshTaken();
    sfx.tick();
    return true;
  }
  function tryCatch() {
    const rd = state.rd;
    if (rd.phase !== 'air' || rd.res) return;
    const eps = rd.et - rd.T;
    if (eps < -WIN_EARLY * winOf()) return;               // too early: the tap is simply ignored
    rd.eps = eps; rd.catchAt = Math.max(rd.et, rd.ev.complete ? rd.ev.tBack : rd.et);
    finishAir(catchResult(rd.ev, rd.T, rd.h, eps));
  }
  function finishAir(res) {
    const rd = state.rd, m = state.match, ev = rd.ev;
    rd.res = res; rd.resAt = rd.et;
    const hp = handAt(ev, rd.catchAt ?? rd.et);
    if (res.ok) {
      sfx.catchOk(res.quality);
      burst(rd, hp.x, hp.y, 10 + res.quality * 8, 1 + res.quality * 0.4);
      if (res.quality >= 2) ring(rd, hp.x, hp.y, 130, '#fff3c4');
      floatText(rd, res.quality >= 2 ? T('perfect') : res.quality === 1 ? T('good') : T('caught'), hp.x, hp.y - 70, res.quality >= 2 ? '#ffe28a' : '#fff6e2');
      rd.event = applyToss(modeOf(), m.ps[rd.who], ev.picks.map((q) => q.id), rd.spots);
    } else {
      sfx.fault();
      rd.flash = state.settings.calm ? 0 : 0.4;
      if (!state.settings.calm) ring(rd, hp.x, hp.y, 90, '#ff8a76');
      floatText(rd, T(`fail_${res.why}`), hp.x, Math.min(hp.y, 600) - 60, '#ffb09a');
      m.stats.faults[rd.who]++;
    }
    setPhaseKeep('resolve');
    rd.resDur = res.ok ? Math.max(0.9, rd.T - rd.et + 0.65) : Math.max(1.2, rd.T - rd.et + 0.9);
  }
  function afterResolve() {
    const rd = state.rd, m = state.match, mode = modeOf();
    if (!rd.res.ok) { turnOver(); return; }
    const p = m.ps[rd.who];
    if (playerDone(mode, p)) { sfx.clear(); endMatch(rd.who); return; }
    if (isLearn()) {
      m.learnWins++;
      if (m.learnWins >= LESSONS[m.cfg.lesson].goal) { sfx.clear(); setPhaseKeep('lessonclear'); return; }
      beginReady(); return;
    }
    if (rd.event) {
      sfx.clear();
      rd.banner = rd.event === 'stage' ? { kind: 'clear', text: T('stageClear', { n: p.stage - 1 }) } : { kind: 'clear', text: T('halfDone') };
      rd.bannerT = 1.4;
      for (let i = 0; i < 10; i++) burst(rd, 120 + fx.next() * 420, 140 + fx.next() * 260, 1, 0.4, 'dust');
      setPhaseKeep('stageclear');
      return;
    }
    beginReady();
  }

  // ---- ending a turn and the match -----------------------------------------------------------------------------
  function turnOver() {
    const rd = state.rd;
    if (isLearn()) {
      state.match.learnWins = 0;
      rd.banner = { kind: 'retry', text: T('tryAgain') }; rd.bannerT = 1.4;
      setPhaseKeep('learnretry');
      return;
    }
    rd.banner = { kind: 'end', text: T('turnFault', { name: nameOf(rd.who) }) }; rd.bannerT = 2.2;
    setPhaseKeep('turnend');
  }
  function afterTurnEnd() {
    const m = state.match;
    if (m.turn === 1) m.turns++;
    startTurn(1 - m.turn);
  }
  function endMatch(winner) {
    const m = state.match;
    m.over = { win: winner };
    state.scene = 'result'; state.ui.scroll = 0;
    if (m.cfg.mode === 'cpu' || m.cfg.mode === 'pass') clearSave();
    if (m.cfg.mode === 'cpu') {
      state.record.played++;
      if (winner === 0) { state.record.wins[m.cfg.lvl]++; state.record.streak++; state.record.bestStreak = Math.max(state.record.bestStreak, state.record.streak); } else state.record.streak = 0;
    }
    saveSettings();
    if (m.cfg.mode !== 'watch') (winner === 0 || m.cfg.mode === 'pass' ? sfx.win : sfx.lose)();
  }

  // ---- hints (the Think button) ------------------------------------------------------------------------------
  function requestHint() {
    const rd = state.rd;
    if (!rd || actorIsAI() || !['ready', 'charge'].includes(rd.phase)) return;
    const ctx = rd.ctx;
    const ranked = rankPlans(ctx, HINT);
    const plan = ranked[0];
    rd.hint = { kind: 'plan', plan, text: explainPlan(ctx, plan), t: 0 }; state.ui.hscroll = 0;
  }
  const hintAllowed = () => !!state.rd && ['ready', 'charge'].includes(state.rd.phase);

  // ---- the computer's hand (and Watch & Learn's beats) -------------------------------------------------------------
  function startBeat() {
    const rd = state.rd;
    if (!isWatch()) return;
    rd.beat = { phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx], reason: '' };
  }
  function prepareAi() {
    const rd = state.rd, lvl = levelOf(rd.who);
    const a = aiToss(rd.ctx, lvl, aiRng);
    rd.ai = { t: 0, ...a, sweep: rd.ctx.sweep, reason: explainPlan(rd.ctx, a.plan), done: 0 };
  }
  function aiTick(dt) {
    const rd = state.rd;
    if (!rd.ai && rd.phase === 'ready') prepareAi();
    const a = rd.ai;
    if (!a) return;
    if (rd.beat && rd.beat.phase !== 'act') {
      const b = rd.beat;
      b.t += dt;
      if (b.phase === 'think') { if (b.t >= b.dur) { b.phase = 'reveal'; b.t = 0; b.dur = REVEAL_SECS; sfx.tick(); b.reason = a.reason; state.ui.hscroll = 0; } }
      else if (b.t >= b.dur) { b.phase = 'act'; b.t = 0; sfx.tick(); }
      return;
    }
    a.t += dt;
    if (rd.phase === 'ready') {
      if (a.t > 0.45) {
        if (!a.charging) { a.charging = true; a.c0 = a.t; a.cTarget = (a.h - H_MIN) / (1 - H_MIN) * CHARGE_SECS; }
        rd.charge = Math.min(a.cTarget, a.t - a.c0); rd.chargeH = heightFor(rd.charge);
        if (Math.floor(rd.charge * 20) !== rd.lastC) { rd.lastC = Math.floor(rd.charge * 20); sfx.charge(rd.chargeH); }
        if (rd.charge >= a.cTarget - 1e-6) { const keep = rd.ai; releaseToss(a.h); rd.ai = keep; rd.ai.t = 0; }
      }
    } else if (rd.phase === 'air') {
      while (a.done < a.taps.length && rd.et >= a.taps[a.done].t) { addTap(a.taps[a.done].id); a.done++; }
      if (!rd.res && rd.et >= rd.T + a.eps) tryCatch();
    }
  }

  // ---- the play scene ---------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; persistMatch(); };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leaveMatch = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.rd = null; };
  const inWorldView = (L, y) => y >= L.hudBottom && y < L.barTop;
  const padHit = (L, x, y) => inRect(L.pad, x, y);
  const buttonHit = (L, x, y) => inRect(L.think, x, y) || inRect(L.pause, x, y) || y < L.hudBottom || (isWatch() && (inRect(L.watch.dec, x, y) || inRect(L.watch.inc, x, y) || inRect(L.watch.exit, x, y) || inRect(L.watch.pause, x, y)));
  const chargeTick = (rd, dt) => {
    rd.charge = Math.min(CHARGE_SECS, rd.charge + dt); rd.chargeH = heightFor(rd.charge);
    if (Math.floor(rd.charge * 20) !== rd.lastC) { rd.lastC = Math.floor(rd.charge * 20); sfx.charge(rd.chargeH); }
  };
  function trail(rd) {
    if (rd.ev) { const hp = handAt(rd.ev, rd.et); rd.trail.push({ x: hp.x, y: hp.y }); if (rd.trail.length > 14) rd.trail.shift(); }
  }

  const updatePlay = (dt, input) => {
    const keys = input.keys;
    const ptr = state.shot ? { x: 0, y: 0, down: false, pressed: false, released: false } : input.pointer;
    const L = playLayout(state.settings.textIdx);
    const rd = state.rd, m = state.match;
    if (!rd || !m) { state.scene = 'title'; return; }
    if (!state.shot && (keys.pressed.has('KeyP') || keys.pressed.has('Escape'))) { if (state.pauseMenu) closePause(); else if (!isWatch()) openPause(); else state.paused = !state.paused; }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
      return;
    }
    const wp = toWorld(L.view, ptr.x, ptr.y);
    const ai = actorIsAI();
    // ---- buttons (always live)
    if (ptr.pressed) {
      if (isWatch()) {
        if (inRect(L.watch.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(L.watch.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); saveSettings(); }
        else if (inRect(L.watch.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); saveSettings(); }
        else if (inRect(L.watch.exit, ptr.x, ptr.y)) { leaveMatch(); return; }
      } else {
        if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
        if (inRect(L.think, ptr.x, ptr.y)) { if (hintAllowed() && !ai) { requestHint(); sfx.tick(); } else sfx.no(); }
      }
    }
    if (state.paused) return;
    if (keys.pressed.has('KeyH') && !ai && hintAllowed()) requestHint();
    // a long Think / reveal card scrolls: drag on it, or use the arrow keys
    const hm = hintMeta();
    if ((rd.hint || (rd.beat && rd.beat.phase === 'reveal')) && hm.max > 0) {
      if (ptr.pressed && inRect(hm.rect, ptr.x, ptr.y)) state.ui.hdrag = { y0: ptr.y, s0: state.ui.hscroll };
      if (state.ui.hdrag && ptr.down) { state.ui.hscroll = clamp(state.ui.hdrag.s0 - (ptr.y - state.ui.hdrag.y0), 0, hm.max); if (rd.hint) rd.hint.t = 0; }
      if (!ptr.down) state.ui.hdrag = null;
      if (keys.down.has('ArrowDown')) state.ui.hscroll = clamp(state.ui.hscroll + 12, 0, hm.max);
      if (keys.down.has('ArrowUp')) state.ui.hscroll = clamp(state.ui.hscroll - 12, 0, hm.max);
    }
    if (state.ui.hdrag) ptr.pressed = false;
    // ---- human input per phase
    const human = !ai && !state.shot;
    if (human && rd.banner && rd.banner.kind === 'turn' && ptr.pressed && rd.bannerT < 0.9) rd.bannerT = 0;
    if (human) {
      switch (rd.phase) {
        case 'ready': {
          const startKey = keys.pressed.has('Space');
          if ((ptr.pressed && padHit(L, ptr.x, ptr.y)) || startKey) { rd.phase = 'charge'; rd.pt = 0; rd.charge = 0; rd.chargeH = H_MIN; rd.keyCharge = startKey; rd.hint = null; }
          break;
        }
        case 'charge': {
          chargeTick(rd, dt);
          // the kit has one pointer: a stray second finger lifting elsewhere looks like a release. A release off the pad is
          // ignored; if no real release comes by full charge the aim is simply cancelled (no surprise toss)
          const stray = !rd.keyCharge && !ptr.down && !padHit(L, ptr.x, ptr.y);
          if (stray && rd.charge >= CHARGE_SECS) { rd.phase = 'ready'; rd.charge = 0; rd.chargeH = H_MIN; rd.pt = 0; break; }
          const held = rd.keyCharge ? keys.down.has('Space') : ptr.down || stray;
          if (!held) releaseToss(heightFor(rd.charge));
          break;
        }
        case 'air': {
          const inView = inWorldView(L, ptr.y) && !buttonHit(L, ptr.x, ptr.y);
          if (ptr.pressed && inView) rd.swipe = true;
          if (!ptr.down) rd.swipe = false;
          if (rd.swipe && ptr.down) { const id = hitStone(wp); if (id !== null) addTap(id); }
          if ((ptr.pressed && padHit(L, ptr.x, ptr.y)) || keys.pressed.has('Space')) tryCatch();
          break;
        }
        default: break;
      }
    }
    // ---- everything below is frozen while paused or while a shot is staged
    if (state.freeze) return;
    if (state.toastT > 0) state.toastT -= dt;
    if (rd.flash > 0) rd.flash = Math.max(0, rd.flash - dt * 1.4);
    if (rd.bannerT > 0) rd.bannerT -= dt;
    if (rd.hint) { rd.hint.t += dt; if (rd.hint.t > HINT_SECS) rd.hint = null; }
    rd.pt += dt;
    stepParts(rd.parts, dt);
    for (const f of rd.floats) f.t += dt;
    rd.floats = rd.floats.filter((f) => f.t < f.max);
    for (const p of m.ps) for (const g of p.ground) if (g.fly) { g.fly.t += dt; if (g.fly.t >= g.fly.dur) delete g.fly; }
    // the computer waits for the turn banner
    const waiting = rd.banner && rd.banner.kind === 'turn' && rd.bannerT > 0;
    if (ai && !waiting && ['ready', 'air'].includes(rd.phase)) aiTick(dt);
    switch (rd.phase) {
      case 'air': updateAir(dt); break;
      case 'resolve': rd.etPrev = rd.et; rd.et += dt; trail(rd); if (rd.pt >= rd.resDur) afterResolve(); break;
      case 'stageclear': if (rd.pt >= 1.5) beginReady(); break;
      case 'turnend': if (rd.pt >= 2.2 || (human && ptr.pressed && rd.pt > 0.6 && !buttonHit(L, ptr.x, ptr.y))) afterTurnEnd(); break;
      case 'learnretry': if (rd.pt >= 1.4) beginReady(); break;
      case 'lessonclear':
        if (rd.pt >= 1.5) { state.record.lessons[m.cfg.lesson] = true; saveSettings(); state.scene = 'result'; state.ui.scroll = 0; m.over = { win: 0, lesson: true }; }
        break;
      default: break;
    }
  };
  function updateAir(dt) {
    const rd = state.rd, ev = rd.ev;
    rd.etPrev = rd.et; rd.et += dt; trail(rd);
    const prev = rd.etPrev;
    for (const pk of ev.picks) {
      if (prev < pk.t && rd.et >= pk.t && !rd.picked.includes(pk.id)) {
        rd.picked.push(pk.id); sfx.scoop();
        const o = originOf(pk.id); burst(rd, o.x, o.y, 4, 0.5, 'dust');
      }
    }
    if (ev.tDrop !== null && !rd.dropped && rd.et >= ev.tDrop) {
      rd.dropped = true; sfx.clack();
      if (rd.dir === 'in') burst(rd, PIT.x, PIT.y, 8, 0.6, 'dust');
      else rd.taken.forEach((tk) => burst(rd, tk.to.x, tk.to.y, 3, 0.4, 'dust'));
    }
    if (!rd.res && rd.et > rd.T + WIN_LATE * winOf()) finishAir(catchResult(ev, rd.T, rd.h, null));
  }

  // ---- menus --------------------------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag;
    const mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  }
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); saveSettings(); }
    else if (id === 'p-calm') { state.settings.calm = !state.settings.calm; saveSettings(); }
    else if (id === 'p-txt-dec') { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.ui.scroll = 0; saveSettings(); }
    else if (id === 'p-txt-inc') { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.ui.scroll = 0; saveSettings(); }
    else if (id === 'quit') leaveMatch();
  }
  const handleTitle = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'continue') resumeMatch();
    else if (id === 'play') { state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'learn') { state.scene = 'lessons'; state.ui.scroll = 0; }
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
  };
  function startWatch() {
    const pairs = [[2, 3], [3, 4], [1, 3], [2, 4]];
    const p = pairs[aiRng.int(pairs.length)];
    startMatch({ mode: 'watch', lvlA: p[0], lvl: p[1], len: 'quick' });
  }
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id === 'opp-cpu') s.opp = 'cpu';
    else if (id === 'opp-pass') s.opp = 'pass';
    else if (id.startsWith('lvl')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = T('inFull'); return; } s.lvl = i; state.setupMsg = ''; }
    else if (id === 'len-quick') s.len = 'quick';
    else if (id === 'len-full') s.len = 'full';
    else if (id === 'start') startMatch({ mode: s.opp, lvl: s.lvl, len: s.len });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleLessons = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; return; }
    if (id.startsWith('les')) {
      const i = Number(id.slice(3));
      if (state.demo && i >= DEMO_LESSONS) { toast(T('inFull'), 2); return; }
      state.lessonSel = i; state.scene = 'lessonintro'; state.ui.scroll = 0;
    }
  };
  const handleLessonIntro = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'start') startMatch({ mode: 'learn', lesson: state.lessonSel });
    else if (id === 'back') { state.scene = 'lessons'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-calm') st.calm = !st.calm;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      state.restoreMsg = T('restoring');
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? T('restored') : T('noPurchase'); }).catch(() => { state.restoreMsg = T('storeDown'); });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    saveSettings();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.match.cfg;
    if (id === 'again') startMatch({ ...cfg });
    else if (id === 'next') { const n = Math.min(LESSONS.length - 1, cfg.lesson + 1); if (state.demo && n >= DEMO_LESSONS) { state.scene = 'lessons'; state.ui.scroll = 0; } else { state.lessonSel = n; state.scene = 'lessonintro'; state.ui.scroll = 0; } }
    else if (id === 'new') { if (cfg.mode === 'watch') startWatch(); else if (cfg.mode === 'learn') { state.scene = 'lessons'; state.ui.scroll = 0; } else { state.scene = 'setup'; state.ui.scroll = 0; } }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };

  let wheelQ = 0;
  const neutral = { x: 0, y: 0, down: false, pressed: false, released: false };
  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = state.shot ? neutral : input.pointer;
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
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); saveSettings(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); saveSettings(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };
  const updatePinned = (dt, input, handler, key) => {
    const ptr = state.shot ? neutral : input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handler('start'); return; }
    if (k.pressed.has('Escape')) { handler('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) { handler(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handler, key);
  };
  const updatePages = (input) => {
    const ptr = state.shot ? neutral : input.pointer, keys = input.keys;
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.page = 0; state.ui.scroll = 0; state.ui.drag = null; };
    const max = readerMax(), step = readerPage() * 0.85;
    if (ptr.pressed) {
      if (inRect(CLOSE_BTN, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.ui.scroll = 0; saveSettings(); }
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.ui.scroll = 0; saveSettings(); }
      else state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
    }
    if (state.ui.drag && ptr.down) { const d = state.ui.drag; d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
    if (ptr.released) state.ui.drag = null;
    if (keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 16, 0, max);
    if (keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 16, 0, max);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) state.ui.scroll = clamp(state.ui.scroll + step, 0, max);
    if (keys.pressed.has('PageUp')) state.ui.scroll = clamp(state.ui.scroll - step, 0, max);
    if (keys.pressed.has('Home')) state.ui.scroll = 0;
    if (keys.pressed.has('End')) state.ui.scroll = max;
    if (keys.pressed.has('Equal') || keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.ui.scroll = 0; saveSettings(); }
    if (keys.pressed.has('Minus') || keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.ui.scroll = 0; saveSettings(); }
    if (keys.pressed.has('Escape')) close();
  };

  // mouse wheel / trackpad: scrolls whatever scrolls on this screen (readers, flow screens, pause sheet, Think / reveal cards)
  function applyWheel(dy) {
    const rd = state.rd;
    if (state.scene === 'play') {
      if (state.pauseMenu) { const mt = flowMeta(); if (mt.key === 'pause' && mt.lay) state.ui.scroll = clamp(state.ui.scroll + dy, 0, Math.max(0, mt.lay.contentH - (mt.bottom - mt.top))); return; }
      const hm = hintMeta();
      if (rd && (rd.hint || (rd.beat && rd.beat.phase === 'reveal')) && hm.max > 0) { state.ui.hscroll = clamp((state.ui.hscroll || 0) + dy, 0, hm.max); if (rd.hint) rd.hint.t = 0; }
      return;
    }
    if (state.scene === 'howto' || state.scene === 'about' || state.scene === 'rules') { state.ui.scroll = clamp(state.ui.scroll + dy, 0, readerMax()); return; }
    const mt = flowMeta();
    if (mt.lay) state.ui.scroll = clamp(state.ui.scroll + dy, 0, Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)));
  }

  // ---- the yard behind the title: a computer hand playing stage 1 over and over -----------------------------------------
  function startAttract() {
    const mode = 'quick';
    let p = state.att ? state.att.p : freshPlayer(mode);
    if (playerDone(mode, p) || p.stage > 2) p = freshPlayer(mode);
    let pick = null;
    for (let tries = 0; tries < 8 && !pick; tries++) {
      const probe = tossCtx(mode, p);
      const a = aiToss(probe, LEVELS[4], attRng);
      const h = clamp(Math.max(a.h, 0.5), H_MIN, 1), roll = newRoll(attRng), L = landing(h, roll), T0 = airtime(h);
      const ctx = { ...probe, L }, ev = planLegs(ctx, a.taps);
      if (ev.complete && ev.tBack <= T0 - 0.08) pick = { ctx, ev, h, roll, L, T0, taps: a.taps };
    }
    if (!pick) { state.att = null; startAttract(); return; }
    const spots = p.dir === 'out' ? dropSpots(attRng, pick.ctx.take, p.ground) : null;
    const rd = {
      who: 0, phase: 'ready', ctx: pick.ctx, ev: pick.ev, h: pick.h, roll: pick.roll, L: pick.L, T: pick.T0, taps: [], dir: p.dir, et: -0.9, etPrev: -0.9, det: -0.9,
      res: null, resAt: null, catchAt: null, trail: [], parts: [], floats: [], hint: null, beat: null, ai: null, charge: 0, chargeH: 0.5, spots, picked: [], taken: null, dropped: false,
    };
    rd.taken = pick.ev.picks.map((pk, i) => ({ id: pk.id, tPick: pk.t, from: (p.ground.find((q) => q.id === pk.id) ?? slotPos(pk.id, MODES[mode].n)), to: p.dir === 'in' ? slotPos(pk.id, MODES[mode].n) : spots[i], rot: spots ? spots[i].rot : 0 }));
    state.att = { p, rd, taps: pick.taps, spots, done: 0, mode };
  }
  function updateAttract(dt) {
    const a = state.att;
    if (!a) return;
    const rd = a.rd;
    rd.etPrev = rd.et; rd.et += dt;
    if (rd.et >= 0 && rd.phase === 'ready') rd.phase = 'air';
    if (rd.phase === 'air') {
      while (a.done < a.taps.length && rd.et >= a.taps[a.done].t) { rd.taps.push(a.taps[a.done]); a.done++; }
      const hp = handAt(rd.ev, rd.et);
      rd.trail.push({ x: hp.x, y: hp.y }); if (rd.trail.length > 14) rd.trail.shift();
      for (const pk of rd.ev.picks) if (rd.etPrev < pk.t && rd.et >= pk.t) { const o = rd.taken.find((q) => q.id === pk.id).from; burst(rd, o.x, o.y, 3, 0.4, 'dust'); }
      if (!rd.res && rd.et >= rd.T) { rd.res = { ok: true }; rd.resAt = rd.et; rd.catchAt = Math.max(rd.et, rd.ev.tBack); burst(rd, hp.x, hp.y, 10, 1); applyToss(a.mode, a.p, rd.ev.picks.map((q) => q.id), a.spots); }
    }
    stepParts(rd.parts, dt);
    if (rd.et > rd.T + 1.1) startAttract();
  }
  startAttract();

  // ---- staged moments for store screenshots (?shot=1&seed=800001..) --------------------------------------------------------
  function stageShot(n) {
    const go = (cfg, setup) => { startMatch({ mode: 'cpu', lvl: 2, len: 'quick', ...cfg }); state.rd.banner = null; state.rd.bannerT = 0; if (setup) setup(state.rd, state.match.ps[0]); state.freeze = true; };
    const scatterPlayer = (p, dir, nOut) => {
      p.dir = dir; p.done = dir === 'in' ? 0 : nOut;
      const n = MODES[modeOf()].n, ids = Array.from({ length: n }, (_, i) => i);
      const outIds = ids.slice(0, dir === 'in' ? n : nOut), spots = dropSpots(spotRng.fork(), outIds.length, []);
      p.ground = outIds.map((id, i) => ({ id, x: spots[i].x, y: spots[i].y, rot: spots[i].rot })); p.pit = ids.filter((id) => !outIds.includes(id));
    };
    const launch = (rd, h, rollA, rollU, tapIds, frac) => {
      releaseToss(h); rd.roll = { ang: rollA, u: rollU }; rd.L = landing(h, rd.roll); rd.ctx = tossCtx(modeOf(), state.match.ps[rd.who], rd.L);
      if (rd.dir === 'out') rd.spots = dropSpots(spotRng.fork(), rd.ctx.take, state.match.ps[rd.who].ground);
      rd.ev = planLegs(rd.ctx, []);
      tapIds.forEach((id, i) => { rd.taps.push({ t: 0.2 + i * 0.12, id }); });
      rd.ev = planLegs(rd.ctx, rd.taps); refreshTaken();
      rd.et = rd.T * frac; rd.etPrev = rd.et;
      for (let k = 14; k > 0; k--) { const hp = handAt(rd.ev, rd.et - k * 0.02); rd.trail.push({ x: hp.x, y: hp.y }); }
    };
    if (n === 1) state.scene = 'title';
    else if (n === 2) go({}, () => {});
    else if (n === 3) go({}, (rd, p) => { p.stage = 2; scatterPlayer(p, 'in', 0); beginReady(); requestHint(); });
    else if (n === 4) go({}, (rd, p) => { p.stage = 2; scatterPlayer(p, 'in', 0); beginReady(); const ids = rankPlans(rd.ctx, HINT)[0].ids; launch(rd, 0.7, 1.0, 0.7, ids, 0.5); });
    else if (n === 5) go({}, (rd, p) => { p.stage = 4; scatterPlayer(p, 'in', 0); p.ground = p.ground.map((g, i) => { const a = i * 1.05 + 0.4; return { ...g, x: PIT.x + Math.cos(a) * 190, y: PIT.y + Math.sin(a) * 190 + 20 }; }); beginReady(); launch(rd, 0.62, 2.0, 0.6, [p.ground[0].id], 0.36); });
    else if (n === 6) go({ mode: 'watch', lvlA: 3, lvl: 4 }, (rd, p) => { p.stage = 3; scatterPlayer(p, 'in', 0); beginReady(); prepareAi(); rd.beat = { phase: 'reveal', t: 0.8, dur: 2, reason: rd.ai.reason }; });
    else if (n === 7) state.scene = 'setup';
    else if (n === 8) go({}, (rd, p) => { p.stage = 3; scatterPlayer(p, 'in', 0); beginReady(); rd.phase = 'charge'; rd.charge = 0.62; rd.chargeH = heightFor(0.62); });
    else if (n === 9) go({}, (rd, p) => { p.stage = 3; scatterPlayer(p, 'in', 0); beginReady(); launch(rd, 0.4, 1.0, 0.8, p.ground.slice(0, 3).map((g) => g.id), 1.05); finishAir(catchResult(rd.ev, rd.T, rd.h, null)); rd.et = rd.T + 0.15; rd.etPrev = rd.et; rd.pt = 0.3; });
    else if (n === 10) { go({}, () => {}); state.match.turns = 5; state.match.stats = { tosses: [31, 26], faults: [6, 8] }; state.match.over = { win: 0 }; state.scene = 'result'; }
    else if (n === 11) { state.scene = 'lessonintro'; state.lessonSel = 3; }
    else if (n === 12) go({}, (rd, p) => { p.stage = 2; scatterPlayer(p, 'out', 4); beginReady(); });
    else if (n === 13) { state.scene = 'about'; state.back = 'title'; }
    else if (n === 14) { state.settings.textIdx = 4; go({}, (rd, p) => { p.stage = 2; scatterPlayer(p, 'in', 0); beginReady(); requestHint(); }); }
    else if (n === 15) { state.settings.textIdx = 4; state.scene = 'title'; }
    else if (n === 16) { state.settings.textIdx = 4; state.scene = 'rules'; state.back = 'title'; state.ui.scroll = 1200; }
    else if (n === 17) { state.scene = 'rules'; state.back = 'title'; state.ui.scroll = 1800; }
    else if (n === 18) { state.settings.textIdx = 4; go({}, () => {}); state.paused = true; state.pauseMenu = true; }
    else if (n === 19) { state.settings.textIdx = 4; state.scene = 'setup'; }
    else if (n === 20) { state.settings.textIdx = 4; state.scene = 'settings'; }
    else if (n === 22) go({ mode: 'watch', lvlA: 4, lvl: 3 }, (rd, p) => { p.stage = 2; scatterPlayer(p, 'in', 0); beginReady(); prepareAi(); rd.beat = null; launch(rd, rd.ai.h, 1.4, 0.6, rd.ai.plan.ids, 0.42); });
    else if (n === 23) go({ len: 'full' }, () => {});
    else if (n === 24) { state.settings.textIdx = 4; state.scene = 'lessons'; }
    else if (n === 25) { state.settings.textIdx = 4; state.scene = 'lessonintro'; state.lessonSel = 3; }
    else if (n === 26) { state.settings.textIdx = 4; go({}, () => {}); state.match.turns = 5; state.match.stats = { tosses: [31, 26], faults: [6, 8] }; state.match.over = { win: 1 }; state.scene = 'result'; }
    else if (n === 27) { state.settings.textIdx = 4; state.scene = 'about'; state.back = 'title'; }
    else if (n === 28) { state.settings.textIdx = 4; state.scene = 'howto'; state.back = 'title'; state.ui.scroll = 600; }
    else if (n === 29) { state.settings.textIdx = 4; state.demo = true; state.scene = 'demolimit'; }
    else if (n === 30) { state.settings.textIdx = 4; go({}, (rd, p) => { p.stage = 3; scatterPlayer(p, 'in', 0); beginReady(); launch(rd, 0.7, 1.0, 0.7, rankPlans(rd.ctx, HINT)[0].ids, 0.5); }); }
    else if (n === 31) { go({}, (rd, p) => { p.stage = 3; scatterPlayer(p, 'in', 0); beginReady(); launch(rd, 0.4, 1.0, 0.8, p.ground.slice(0, 3).map((g) => g.id), 1.05); finishAir(catchResult(rd.ev, rd.T, rd.h, null)); rd.phase = 'turnend'; rd.banner = { kind: 'end', text: T('turnFault', { name: nameOf(0) }) }; rd.bannerT = 2; }); }
    else if (n === 21) go({ len: 'full' }, (rd, p) => { p.stage = 4; scatterPlayer(p, 'in', 0); beginReady(); launch(rd, 0.75, 4.0, 0.5, rankPlans(rd.ctx, HINT)[0].ids, 0.45); });
  }
  if (shotSeed) {
    stageShot(shotSeed);
    // review aid: ?zoom=0..4 and ?page=N override the staged text size and reader page
    const q = (k) => { const m = new RegExp(`[?&]${k}=([a-z0-9]+)`).exec(location.search); return m ? m[1] : null; };
    if (q('zoom')) state.settings.textIdx = clamp(Number(q('zoom')) | 0, 0, 4);
    if (q('page')) state.ui.scroll = (Number(q('page')) | 0) * 700;
    if (q('view')) { const v = q('view'); state.scene = v; state.back = 'title'; }
  }

  // ---- the object the kit drives --------------------------------------------------------------------------------------------
  return {
    // Watch & Learn, Learn and every menu are free; only real play counts against the free preview (a paused match,
    // the computer's own turn and the banners between turns do not).
    isPreviewExempt: () => {
      if (state.scene !== 'play' || !state.match || !state.rd) return true;
      const c = state.match.cfg.mode;
      if (c === 'watch' || c === 'learn') return true;
      if (state.paused) return true;
      if (state.rd.phase === 'ready') return true;      // idling before a toss is free: only charge, air and resolve count
      if (c === 'cpu' && state.match.turn === 1) return true;
      return ['turnend', 'stageclear'].includes(state.rd.phase);
    },
    update(dt, input0) {
      const input = state.shot ? { pointer: neutral, keys: { down: new Set(), pressed: new Set() } } : input0;
      setPress(input.pointer);
      state.updAt = nowMs(); state.alpha = 1;
      if (wheelQ !== 0) { applyWheel(wheelQ); wheelQ = 0; }
      const frozen = state.paused && state.scene === 'play';
      if (!frozen) state.t += dt;
      if (state.att && state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updatePinned(dt, input, handleSetup, 'setup'); break;
        case 'lessons': updateFlowScene(dt, input, handleLessons, 'lessons'); break;
        case 'lessonintro': updatePinned(dt, input, handleLessonIntro, 'lessonintro'); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      state.alpha = env.clock && state.updAt !== undefined ? Math.max(0, Math.min(1, (nowMs() - state.updAt) / (STEP * 1000))) : 1;
      if (state.att) { const r = state.att.rd; r.det = r.etPrev + (r.et - r.etPrev) * state.alpha; }
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'lessons': renderLessons(ctx, state); break;
        case 'lessonintro': renderLessonIntro(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'result': renderResult(ctx, state, { nameOf }); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, pagesFor('howto'), T('howtoTitle')); break;
        case 'about': renderPages(ctx, state, pagesFor('about'), T('aboutTitle')); break;
        case 'rules': renderPages(ctx, state, pagesFor('rules'), T('rulesTitle')); break;
        case 'play':
          if (state.match && state.rd) renderPlay(ctx, state, { levelOf, nameOf, actorIsAI, isWatch, isLearn, lessonId, lessonIndex: () => state.match.cfg.lesson, take: () => (state.rd.ctx ? state.rd.ctx.take : 1) });
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    wheel(dy) { if (Number.isFinite(dy)) wheelQ = clamp(wheelQ + dy, -4000, 4000); },
    getState: () => state,
  };
}
