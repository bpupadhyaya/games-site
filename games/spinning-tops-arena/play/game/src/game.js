// Spinning Tops Arena: state and flow. Physics lives in sim.js, the rivals in ai.js, drawing in view.js / art.js /
// menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, workshop, settings, play (also Watch & Learn and lessons), result, learn, lessonbrief,
// howto/about/rules, demolimit.
// A match is a set of rounds. A round is one pair of tops in one dish. Phases: intro -> aim -> timing (-> pass -> aim ->
// timing for a second human) -> run -> over -> between. Watch & Learn runs the same round in beats: THINK -> REVEAL -> ACT.
import { W, H, ARENA, ARENAS, ARENA_IDS, K, STEP, newWorld, stepWorld, clamp, legal, BODIES, TIPS, predictPath, launchSpot } from './sim.js';
import { PROFILES, COACH, createPlanner, executeLaunch, rivalBuild, tryLaunch } from './ai.js';
import { lookOf, toScreen, prebake } from './art.js';
import { inRect, playLayout, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, TEXT_SCALES, THINK_STEPS, SETUP_PINS } from './layout.js';
import { renderPlay, drawBanner, preTops, aimAnchor, sceneOf, passButton, drawScene } from './view.js';
import { renderTitle, renderSetup, renderWorkshop, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderLearn, renderBrief, hitScreen, flowMeta, pageCount, ensureLayout } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { LESSONS } from './lessons.js';
import { GAUGE, timingQuality } from './timing.js';
import { setPress } from './ui.js';

export const meta = { width: W, height: H };
const DEMO_ROUND_CAP = 3;
const REVEAL_SECS = 2;
const HINT_SECS = 7;
const MAX_PARTS = 160;
const MIN_PULL = 0.12;
const INTRO_SECS = 1.0;
const OVER_SECS = 2.6;
const DUEL_VERSION = 1;
const bearing = (side) => (side === 0 ? -Math.PI / 2 : Math.PI / 2);

const DEFAULT_BUILDS = () => [{ body: 'pear', tip: 'pebble', ballast: 'std', hand: 1 }, { body: 'dome', tip: 'pebble', ballast: 'std', hand: -1 }];
const validBuild = (b) => b && b.body in BODIES && b.tip in TIPS && ['light', 'std', 'heavy'].includes(b.ballast) && legal(b) && (b.hand === 1 || b.hand === -1);
const watchLooks = [0, 1, 2, 3, 4];

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();
  const gaugeRng = rng.fork();
  const wantsShot = typeof location !== 'undefined' && /[?&]shot=1/.test(location.search);
  const shotSeed = wantsShot && config.seed >= 900001 && config.seed <= 900020 ? config.seed - 900000 : 0;
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, shot: false,
    settings: { sound: true, calm: false, textIdx: 0, thinkIdx: 1 },
    record: { wins: [0, 0, 0, 0, 0], played: 0, streak: 0, best: 0, demoRounds: 0, outs: 0, lessons: [false, false, false, false, false] },
    setup: { mode: 'ai', opp: 0, arena: 'shallow', rounds: 3 }, setupMsg: '', restoreMsg: '',
    builds: DEFAULT_BUILDS(), looks: [0, 1], wsIdx: 0, matchupText: '', lessonIdx: 0, lessonPending: null, lessonOk: false, lessonLaunch: null,
    ui: { scroll: 0, drag: null }, page: 0,
    att: null, match: null, w: null, pre: null, ph: 'intro', phT: 0, banner: null,
    side: 0, aim: { drag: false, ang: -Math.PI / 2, pow: 0, fx: 0, fy: 0, path: null, lx: 0, ly: 0 }, aims: [null, null], timing: null, speed: 1,
    parts: [], trails: [[], []], flash: 0, toast: '', toastT: 0, hint: null, hintBusy: false, wl: null,
    bigT: 0, saved: null, arenaName: '', loaded: false,
  };
  let hintPlanner = null, rivalPlanner = null, rivalLaunch = null, planners = null, saveT = 0, savedSnap = null, whirrT = 0, trailT = 0, dustT = 0, pathT = 0, attSeq = 0;

  // ---- persistence ---------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  const savePrefs = () => storage.set('prefs', { builds: state.builds, looks: state.looks, setup: state.setup });
  const metaOf = (snap) => ({ title: snap.cfg.mode === 'friend' ? 'Two Players' : `vs ${snap.cfg.names[1]}`, round: snap.round, wins: [...snap.wins], rounds: snap.cfg.rounds });
  const validSnap = (d) => d && d.v === DUEL_VERSION && d.cfg && (d.cfg.mode === 'ai' || d.cfg.mode === 'friend') && Array.isArray(d.wins) && Array.isArray(d.cfg.builds) && d.cfg.builds.length === 2 && d.cfg.builds.every(validBuild) && d.cfg.arena in ARENAS && Array.isArray(d.cfg.names) && Array.isArray(d.cfg.looks) && (d.cfg.mode === 'friend' || PROFILES[d.cfg.opp]) && (!d.w || (Array.isArray(d.w.tops) && d.w.tops.length === 2 && !d.w.over));
  const persistMatch = () => {
    const m = state.match;
    if (!m || state.scene !== 'play' || (m.cfg.mode !== 'ai' && m.cfg.mode !== 'friend') || m.over) return;
    const run = state.w && !state.w.over && state.ph === 'run';
    const snap = { v: DUEL_VERSION, cfg: JSON.parse(JSON.stringify(m.cfg)), round: m.round, wins: [...m.wins], stats: { ...m.stats }, w: run ? JSON.parse(JSON.stringify({ ...state.w, ev: [] })) : null };
    savedSnap = snap;
    state.saved = metaOf(snap);
    saveT = 0;
    storage.set('match', snap);
  };
  const clearMatch = () => { savedSnap = null; state.saved = null; storage.remove('match'); };
  const resumeMatch = () => {
    if (!savedSnap) return;
    const snap = JSON.parse(JSON.stringify(savedSnap));
    state.match = { cfg: snap.cfg, round: snap.round, wins: snap.wins, stats: snap.stats ?? { outs: 0, best: 0 }, over: null };
    state.scene = 'play'; state.ui.scroll = 0; state.ui.drag = null;
    prepRound(false);
    if (snap.w) { state.w = snap.w; state.w.ev = []; state.pre = null; state.ph = 'run'; state.phT = 0; } else state.ph = 'aim';
    openPause();
  };

  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('match', null), storage.get('prefs', null)]).then(([s, r, d, p]) => {
    if (s) Object.assign(state.settings, s);
    if (r) { Object.assign(state.record, r); if (!Array.isArray(state.record.lessons)) state.record.lessons = [false, false, false, false, false]; }
    if (p && Array.isArray(p.builds) && p.builds.length === 2 && p.builds.every(validBuild)) { state.builds = p.builds; if (Array.isArray(p.looks)) state.looks = [clamp(p.looks[0] | 0, 0, 5), clamp(p.looks[1] | 0, 0, 5)]; if (p.setup) Object.assign(state.setup, p.setup); }
    if (validSnap(d)) { savedSnap = d; state.saved = metaOf(d); }
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!(state.setup.arena in ARENAS)) state.setup.arena = 'shallow';
    if (!(state.setup.opp >= 0 && state.setup.opp < PROFILES.length)) state.setup.opp = 0;
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
    prebake(state.setup.arena);
  });

  // ---- sound ---------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 220, to: 140, dur: 0.2, type: 'sawtooth', vol: 0.05 }),
    launch: () => { tone({ freq: 260, to: 900, dur: 0.22, type: 'triangle', vol: 0.09 }); tone({ freq: 120, to: 60, dur: 0.25, type: 'sine', vol: 0.1 }); },
    whip: (q) => tone({ freq: 700 + q * 500, to: 300, dur: 0.12, type: 'square', vol: 0.05 }),
    perfect: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 660 * Math.pow(2, n / 12), dur: 0.14 + i * 0.03, type: 'triangle', vol: 0.07 })),
    hit: (f) => { const v = clamp(f / 500, 0.2, 1); tone({ freq: 240 + 80 * (1 - v), to: 90, dur: 0.1, type: 'sine', vol: 0.1 + 0.12 * v }); tone({ freq: 1900, to: 300, dur: 0.05, type: 'square', vol: 0.03 + 0.05 * v }); },
    wall: (f) => tone({ freq: 140, to: 70, dur: 0.12, type: 'sine', vol: 0.06 + 0.06 * clamp(f / 400, 0, 1) }),
    out: () => { tone({ freq: 700, to: 120, dur: 0.5, type: 'sawtooth', vol: 0.07 }); tone({ freq: 90, to: 50, dur: 0.4, type: 'sine', vol: 0.14 }); },
    fall: () => { tone({ freq: 180, to: 60, dur: 0.35, type: 'triangle', vol: 0.09 }); tone({ freq: 400, to: 200, dur: 0.05, type: 'square', vol: 0.03 }); },
    whirr: (v) => tone({ freq: 110 + 330 * v, dur: 0.2, type: 'triangle', vol: 0.004 + 0.009 * v }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
    lose: () => [0, -3, -7].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.3 + i * 0.05, type: 'triangle', vol: 0.08 })),
    go: () => tone({ freq: 880, dur: 0.2, type: 'triangle', vol: 0.1 }),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- particles, trails -------------------------------------------------------------------------------
  const room = (parts, n) => parts.length + n <= MAX_PARTS;
  const spark = (parts, x, y, n, power = 1) => {
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) {
      const a = fx.next() * Math.PI * 2, sp = (80 + fx.next() * 300) * power;
      parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 60, t: 0, max: 0.25 + fx.next() * 0.35, size: 1 });
    }
  };
  const dust = (parts, x, y, n, size = 18) => {
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) parts.push({ kind: 'dust', x: x + (fx.next() - 0.5) * 20, y: y + (fx.next() - 0.5) * 8, vx: (fx.next() - 0.5) * 50, vy: -10 - fx.next() * 25, t: 0, max: 0.6 + fx.next() * 0.5, size: size * (0.7 + fx.next() * 0.6) });
  };
  const chips = (parts, x, y, n) => {
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) {
      const a = fx.next() * Math.PI * 2, sp = 120 + fx.next() * 200;
      parts.push({ kind: 'chip', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 120, rot: fx.next() * 6, vr: (fx.next() - 0.5) * 14, t: 0, max: 0.7 + fx.next() * 0.5, size: 3 + fx.next() * 3, col: i % 2 ? '#e3b878' : '#c4472b' });
    }
  };
  const stepParts = (parts, dt) => {
    for (const p of parts) {
      p.t += dt; p.x += (p.vx ?? 0) * dt; p.y += (p.vy ?? 0) * dt;
      if (p.kind === 'spark' || p.kind === 'chip') p.vy += 520 * dt;
      if (p.kind === 'chip') p.rot += (p.vr ?? 3) * dt;
      if (p.kind === 'dust') { p.vx *= 0.97; p.vy *= 0.97; }
    }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };
  const pushTrail = (trails, w) => {
    w.tops.forEach((t, i) => {
      const tr = trails[i];
      if (t.st === 0 && Math.hypot(t.vx, t.vy) > 50) { const s = toScreen(t.x, t.y); tr.push({ x: s.x, y: s.y }); if (tr.length > 26) tr.shift(); } else if (tr.length) tr.shift();
    });
  };

  // one sim step's events become sparks, sounds (the dish never moves)
  const handleEvents = (w, parts, audible = true) => {
    for (const e of w.ev) {
      const s = toScreen(e.x, e.y);
      if (e.t === 'hit') {
        spark(parts, s.x, s.y - 14, 8 + Math.min(22, Math.round(e.f / 25)), 0.6 + clamp(e.f / 500, 0, 1));
        chips(parts, s.x, s.y - 14, e.f > 150 ? 4 : 1);
        dust(parts, s.x, s.y, 2, 14);
        if (e.f > 120 && room(parts, 1)) parts.push({ kind: 'ring', x: s.x, y: s.y - 6, vx: 0, vy: 0, t: 0, max: 0.45, size: 60 + e.f * 0.15 });
        if (audible) {
          sfx.hit(e.f);
          if (e.f > 220) state.bigT = 0.9;
        }
      } else if (e.t === 'wall') {
        spark(parts, s.x, s.y - 10, 4, 0.5); dust(parts, s.x, s.y, 2, 12);
        if (audible) sfx.wall(e.f);
      } else if (e.t === 'out') {
        spark(parts, s.x, s.y - 20, 26, 1.5); dust(parts, s.x, s.y, 5, 22);
        if (audible) { sfx.out(); if (!state.settings.calm) state.flash = 0.45; }
      } else if (e.t === 'down') {
        dust(parts, s.x, s.y, 4, 16);
        if (audible && e.why !== 'out') sfx.fall();
      }
    }
    w.ev.length = 0;
  };

  // ---- the duel behind the title ---------------------------------------------------------------------------
  const ATT = [[1, 0, 'shallow'], [2, 3, 'bowl'], [4, 1, 'plate'], [3, 2, 'shallow']];
  const startAttract = () => {
    const [a, b, arena] = ATT[attSeq % ATT.length]; attSeq++;
    const pa = PROFILES[a], pb = PROFILES[b];
    const ba = pa.build ?? { body: 'pear', tip: 'steel', ballast: 'std', hand: 1 }, bb = pb.build ?? { body: 'disc', tip: 'pebble', ballast: 'heavy', hand: -1 };
    const la = { ang: bearing(0) + (fx.next() - 0.5) * 0.7, pow: 0.55 + fx.next() * 0.3, q: 0.95 }, lb = { ang: bearing(1) + (fx.next() - 0.5) * 0.7, pow: 0.55 + fx.next() * 0.3, q: 0.95 };
    const w = newWorld(arena, [ba, bb], [la, lb]);
    state.att = { w, arena, looks: [lookOf(a), lookOf(b + 3)], parts: [], wait: 0 };
    prebake(arena);
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    const w = a.w;
    if (w.over) { a.wait += dt; if (a.wait > 3.2) startAttract(); }
    let sdt = dt;
    if (w.slow > 0) { sdt = dt * K.SLOW; w.slow = Math.max(0, w.slow - dt); }
    if (!w.over && w.t > 45) w.over = { winner: 0, loser: 1, why: 'time', t: w.t };
    else if (!w.over || w.slow > 0 || a.wait < 1.5) stepWorld(w, sdt);
    handleEvents(w, a.parts, false);
    stepParts(a.parts, dt);
  };

  // ---- match flow ---------------------------------------------------------------------------------------
  const isWatch = () => state.match && state.match.cfg.mode === 'watch';
  const isLesson = () => state.match && state.match.cfg.mode === 'lesson';

  const prepRound = (persist = true) => {
    const m = state.match, c = m.cfg;
    state.w = null; state.pre = preTops(m); state.ph = 'intro'; state.phT = 0; state.banner = null;
    state.parts = []; state.trails = [[], []]; state.aims = [null, null]; state.side = 0; state.timing = null; state.speed = 1;
    state.aim = { drag: false, ang: bearing(0), pow: 0, fx: 0, fy: 0, path: null, lx: 0, ly: 0 };
    state.hint = null; state.hintBusy = false; hintPlanner = null; state.flash = 0; state.toastT = 0; state.bigT = 0;
    planners = null; rivalPlanner = null; rivalLaunch = null; state.wl = null;
    state.arenaName = ARENAS[c.arena].name;
    prebake(c.arena);
    if (c.mode === 'ai') rivalPlanner = createPlanner(c.arena, 1, c.builds[1], c.builds[0], PROFILES[c.opp], aiRng.fork());
    else if (c.mode === 'lesson') { const sc = c.script; rivalLaunch = { ang: bearing(1) + (sc.off ?? 0), pow: sc.pow, q: sc.q }; }
    if (c.mode === 'watch') beginBeat();
    if (persist && (c.mode === 'ai' || c.mode === 'friend')) persistMatch();
  };
  const startRound = () => {
    const m = state.match;
    if (state.demo && m.cfg.mode !== 'watch' && m.cfg.mode !== 'lesson') {
      if (state.record.demoRounds >= DEMO_ROUND_CAP) { clearMatch(); state.scene = 'demolimit'; state.ui.scroll = 0; return; }
      state.record.demoRounds++; save();
    }
    prepRound(true);
  };

  const makeCfg = (mode) => {
    const s = state.setup, arena = s.arena;
    if (mode === 'ai') {
      const hb = state.builds[0];
      return { mode, opp: s.opp, arena, rounds: s.rounds, builds: [{ ...hb }, rivalBuild(s.opp, arena, hb)], looks: [state.looks[0], s.opp === 0 ? 1 : s.opp + 1 > 5 ? 0 : s.opp + 1], names: ['You', PROFILES[s.opp].name], lesson: null, script: null };
    }
    return { mode, opp: -1, arena, rounds: s.rounds, builds: [{ ...state.builds[0] }, { ...state.builds[1] }], looks: [state.looks[0], state.looks[1] === state.looks[0] ? (state.looks[0] + 1) % 6 : state.looks[1]], names: ['Player 1', 'Player 2'], lesson: null, script: null };
  };
  const startMatch = (cfg) => {
    state.match = { cfg, round: 1, wins: [0, 0], stats: { outs: 0, best: 0 }, over: null };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    startRound();
  };
  const startWatch = () => {
    const picks = [0, 1, 2, 3, 4];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    const arena = ARENA_IDS[aiRng.int(ARENA_IDS.length)];
    const neutral = { body: 'pear', tip: 'steel', ballast: 'std', hand: 1 };
    const bB = b < 4 ? rivalBuild(b, arena, neutral) : rivalBuild(b, arena, a < 4 ? rivalBuild(a, arena, neutral) : neutral);
    const bA = rivalBuild(a, arena, bB);
    startMatch({ mode: 'watch', opp: b, watchA: a, arena, rounds: 3, builds: [{ ...bA }, { ...bB }], looks: [watchLooks[a], watchLooks[b] === watchLooks[a] ? (watchLooks[a] + 1) % 6 : watchLooks[b]], names: [PROFILES[a].name, PROFILES[b].name], lesson: null, script: null });
  };
  const startLesson = (idx) => {
    const l = LESSONS[idx];
    state.lessonIdx = idx;
    const mine = l.pickBuild ? { ...state.builds[0] } : { ...l.build };
    startMatch({ mode: 'lesson', opp: -1, arena: l.arena, rounds: 1, builds: [mine, { ...l.rival.build }], looks: [state.looks[0], 1], names: ['You', l.rival.name], lesson: idx, script: l.rival.launch });
  };

  // ---- aim and timing --------------------------------------------------------------------------------
  const updatePath = () => {
    const a = state.aim, c = state.match.cfg;
    if (a.pow < MIN_PULL) { a.path = null; return; }
    a.path = predictPath(state.side, c.builds[state.side], { ang: a.ang, pow: a.pow, q: 0.97 }, c.arena);
  };
  const aimFromPointer = (x, y, L) => {
    const a = state.aim, an = aimAnchor(state.side), pm = L.pullMax[state.side];
    let dx = x - an.x, dy = y - an.y;
    const len = Math.hypot(dx, dy);
    if (len > pm) { dx *= pm / len; dy *= pm / len; }
    a.fx = an.x + dx; a.fy = an.y + dy;
    a.pow = clamp(Math.hypot(dx, dy) / pm, 0, 1);
    if (Math.hypot(dx, dy) > 6) a.ang = Math.atan2(-dy / ARENA.sy, -dx);
  };
  const beginTiming = () => {
    state.ph = 'timing'; state.phT = 0;
    state.timing = { t: 0, n: 0.5, phi: gaugeRng.next(), locked: false, q: 1, lockT: 0 };
    state.hint = null; sfx.tick();
  };
  const lockTiming = (q) => {
    const tm = state.timing;
    tm.locked = true; tm.q = q; tm.lockT = 0;
    if (q >= 0.999) { sfx.perfect(); const an = aimAnchor(state.side); spark(state.parts, an.x, an.y - 20, 18, 0.9); if (room(state.parts, 1)) state.parts.push({ kind: 'ring', x: an.x, y: an.y - 10, vx: 0, vy: 0, t: 0, max: 0.6, size: 90 }); } else sfx.whip(q);
  };
  const commitAim = () => {
    const a = state.aim, tm = state.timing, m = state.match;
    state.aims[state.side] = { ang: a.ang, pow: a.pow, q: tm.q };
    if (m.cfg.mode === 'friend' && state.side === 0) {
      state.side = 1; state.ph = 'pass'; state.phT = 0; state.timing = null; state.hint = null;
      state.aim = { drag: false, ang: bearing(1), pow: 0, fx: 0, fy: 0, path: null, lx: 0, ly: 0 };
      return;
    }
    if (m.cfg.mode === 'ai' || m.cfg.mode === 'lesson') state.ph = 'waitrival'; else doLaunch();
  };
  function doLaunch() {
    const m = state.match, c = m.cfg;
    if (c.mode === 'ai' || c.mode === 'lesson') state.aims[1] = rivalLaunch ?? state.aims[1];
    const w = newWorld(c.arena, c.builds, [state.aims[0], state.aims[1]]);
    state.w = w; state.pre = null; state.ph = 'run'; state.phT = 0; state.timing = null; state.hint = null; state.hintBusy = false; hintPlanner = null;
    state.trails = [[], []]; state.speed = 1; state.bigT = 0; whirrT = 0; trailT = 0; dustT = 0;
    for (let s = 0; s < 2; s++) { const sp = launchSpot(s), p = toScreen(sp.x, sp.y); dust(state.parts, p.x, p.y, 5, 20); spark(state.parts, p.x, p.y - 10, 4, 0.5); }
    sfx.launch();
    if (c.mode === 'lesson') state.lessonLaunch = { ...state.aims[0] };
    persistMatch();
  }

  // ---- Think (the coach) --------------------------------------------------------------------------------
  const requestHint = () => {
    if (state.hintBusy || state.ph !== 'aim' || state.aim.drag) return;
    const c = state.match.cfg, side = state.side;
    state.hintBusy = true;
    hintPlanner = createPlanner(c.arena, side, c.builds[side], c.builds[1 - side], COACH, aiRng.fork(), c.mode === 'lesson' && rivalLaunch ? { opps: [rivalLaunch] } : {});
  };
  const updateHint = (dt) => {
    if (hintPlanner) {
      hintPlanner.step(5);
      if (hintPlanner.done) {
        const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
        if (state.ph === 'aim') {
          const c = state.match.cfg;
          const path = predictPath(state.side, c.builds[state.side], { ang: r.launch.ang, pow: r.launch.pow, q: 0.97 }, c.arena);
          state.hint = { launch: r.launch, reason: r.reason, path, t: 0, dur: HINT_SECS };
        }
      }
    }
    if (state.hint) { state.hint.t += dt; if (state.hint.t > state.hint.dur + 0.1) state.hint = null; }
  };

  // ---- Watch & Learn: Think -> Reveal -> Act ----------------------------------------------------------
  function beginBeat() {
    const m = state.match, c = m.cfg;
    const profs = [PROFILES[c.watchA], PROFILES[c.opp]];
    planners = [0, 1].map((s) => createPlanner(c.arena, s, c.builds[s], c.builds[1 - s], profs[s], aiRng.fork()));
    state.wl = { phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx], plans: [null, null], show: [], beat: (state.wl?.beat ?? 0) + 1, profs };
  }
  const updateWatch = (dt) => {
    const wl = state.wl, c = state.match.cfg;
    if (!wl || wl.phase === 'act') return;
    wl.t += dt;
    if (wl.phase === 'think') {
      let ready = true;
      planners.forEach((p, i) => { if (!p.done) p.step(4); if (p.done) wl.plans[i] = p.result; else ready = false; });
      if (wl.plans[0] && wl.plans[1] && !wl.show.length) wl.show = [0, 1].flatMap((s) => wl.plans[s].all.slice(0, 12).reverse().map((q) => ({ side: s, ang: q.ang, pow: q.pow })));
      if (wl.t >= wl.dur && ready) {
        wl.phase = 'reveal'; wl.t = 0; wl.dur = REVEAL_SECS; sfx.tick();
        [0, 1].forEach((s) => { const r = wl.plans[s]; r.path = predictPath(s, c.builds[s], { ang: r.launch.ang, pow: r.launch.pow, q: 0.97 }, c.arena); });
      }
    } else if (wl.phase === 'reveal' && wl.t >= wl.dur) {
      wl.phase = 'act'; wl.t = 0; wl.dur = 1;
      state.aims = [0, 1].map((s) => executeLaunch(wl.plans[s].launch, wl.profs[s], aiRng));
      doLaunch(); sfx.go();
    }
  };

  // ---- the play scene ----------------------------------------------------------------------------
  function openPause() { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; persistMatch(); }
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leaveMatch = () => { state.scene = isLesson() ? 'learn' : 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; planners = null; hintPlanner = null; rivalPlanner = null; state.hintBusy = false; state.wl = null; state.hint = null; };

  const onOver = () => {
    const m = state.match, w = state.w, o = w.over;
    state.ph = 'over'; state.phT = 0;
    state.flash = state.settings.calm ? 0 : Math.max(state.flash, 0.3);
    const winner = o.winner;
    m.wins[winner]++;
    if ((m.cfg.mode === 'ai' || m.cfg.mode === 'friend') && winner === 0) { m.stats.best = Math.max(m.stats.best, w.t); if (o.why === 'out') m.stats.outs++; }
    if (m.cfg.mode !== 'watch' && m.cfg.mode !== 'lesson') { if (winner === 0 || m.cfg.mode === 'friend') sfx.win(); else sfx.lose(); }
    const need = m.cfg.rounds === 1 ? 1 : 2;
    if (m.wins[winner] >= need) m.over = { win: winner };
    const nm = m.cfg.names, why = o.why;
    let title, line;
    const wn = nm[winner], ln = nm[o.loser];
    if (m.cfg.mode === 'ai' || m.cfg.mode === 'lesson') {
      if (winner === 0) { title = why === 'out' ? 'Ring out!' : why === 'wobble' ? 'Tipped over!' : why === 'time' ? 'You win on spin' : 'They spun out'; line = why === 'out' ? 'Your top knocked theirs over the rim.' : why === 'wobble' ? 'Their top wobbled and fell while yours kept spinning.' : why === 'time' ? 'Time ran out and your top had more spin.' : 'Their top ran out of spin first.'; }
      else { title = why === 'out' ? 'Knocked out' : why === 'wobble' ? 'Your top fell' : why === 'time' ? 'They win on spin' : 'Your top spun out'; line = why === 'out' ? 'Your top went over the rim. A softer launch or a heavier top stays in the dish.' : why === 'wobble' ? 'Your spin ran down and it wobbled over. A perfect whip or a stamina build lasts longer.' : why === 'time' ? 'Time ran out and their top had more spin.' : 'Your top ran out of spin first.'; }
    } else {
      title = `${wn} wins the round`;
      line = why === 'out' ? `${ln}'s top went over the rim.` : why === 'wobble' ? `${ln}'s top wobbled and tipped over.` : why === 'time' ? `Time ran out. ${wn} had more spin.` : `${ln}'s top ran out of spin.`;
    }
    let win = winner === 0 || (m.cfg.mode !== 'ai' && m.cfg.mode !== 'lesson');
    let last = !!m.over, lessonNext;
    if (m.cfg.mode === 'lesson') {
      const l = LESSONS[m.cfg.lesson];
      const ok = l.judge({ win: winner === 0, why, launch: state.lessonLaunch ?? { pow: 0, q: 0 } });
      state.lessonOk = ok;
      title = ok ? 'Lesson complete' : 'Not quite yet';
      line = ok ? l.okText : l.failText;
      win = ok; last = true; lessonNext = ok ? (m.cfg.lesson < LESSONS.length - 1 ? 'Next lesson' : 'Back to lessons') : 'Try again';
      if (ok && !state.record.lessons[m.cfg.lesson]) { state.record.lessons[m.cfg.lesson] = true; save(); }
    }
    state.banner = { title, line, score: m.cfg.rounds === 3 ? `Rounds ${m.wins[0]} - ${m.wins[1]}` : m.cfg.mode === 'lesson' ? LESSONS[m.cfg.lesson].title : 'Quick duel', win, last, lessonNext, auto: m.cfg.mode === 'watch' };
  };

  const afterBanner = () => {
    const m = state.match;
    if (m.cfg.mode === 'lesson') {
      const idx = m.cfg.lesson;
      if (!state.lessonOk) { startLesson(idx); return; }
      if (idx < LESSONS.length - 1) { state.lessonIdx = idx + 1; state.scene = 'lessonbrief'; } else state.scene = 'learn';
      state.ui.scroll = 0;
      return;
    }
    if (m.over) {
      state.scene = 'result'; state.ui.scroll = 0;
      if (m.cfg.mode === 'ai' || m.cfg.mode === 'friend') clearMatch();
      if (m.cfg.mode === 'ai') {
        state.record.played++; state.record.outs += m.stats.outs;
        if (m.over.win === 0) { state.record.wins[m.cfg.opp]++; state.record.streak++; state.record.best = Math.max(state.record.best, state.record.streak); } else state.record.streak = 0;
      }
      save();
      if (state.demo && m.cfg.mode !== 'watch' && state.record.demoRounds >= DEMO_ROUND_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; }
    } else { save(); m.round++; startRound(); }
  };

  const stepRun = (dt) => {
    const w = state.w;
    const reps = state.speed === 2 && !w.over ? 2 : 1;
    for (let r = 0; r < reps; r++) {
      let sdt = dt;
      if (w.slow > 0) { sdt = dt * K.SLOW; w.slow = Math.max(0, w.slow - dt); }
      stepWorld(w, sdt);
      handleEvents(w, state.parts);
    }
    trailT += dt;
    if (trailT >= 0.03) { trailT = 0; pushTrail(state.trails, w); }
    dustT -= dt; whirrT -= dt;
    if (dustT <= 0) { dustT = 0.09; for (const t of w.tops) if (t.st === 0 && Math.hypot(t.vx, t.vy) > 120 && room(state.parts, 1)) { const s = toScreen(t.x, t.y); dust(state.parts, s.x, s.y, 1, 10); } }
    if (whirrT <= 0 && !w.over) { whirrT = 0.3; const v = Math.max(...w.tops.map((t) => (t.st === 0 ? t.w / (t.w0 || 1) : 0))); sfx.whirr(v); }
    if (state.bigT > 0) state.bigT -= dt;
    if (!w.over) { saveT += dt; if (saveT >= 1.2 && !isWatch()) persistMatch(); }
  };

  const updatePlay = (dt, input) => {
    const ptr = input.pointer, keys = input.keys, m = state.match;
    const watch = m.cfg.mode === 'watch';
    const L = playLayout(state.settings.textIdx);
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
    if (watch) {
      if (ptr.pressed) {
        if (inRect(L.watch.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(L.watch.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); }
        else if (inRect(L.watch.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); }
        else if (inRect(L.watch.exit, ptr.x, ptr.y)) { leaveMatch(); return; }
      }
    } else if (state.ph === 'between') {
      if (ptr.pressed && state.phT > 0.6) { sfx.tick(); afterBanner(); return; }
    } else if (state.ph === 'pass') {
      if (ptr.pressed && inRect(passButton(state), ptr.x, ptr.y)) { sfx.tick(); state.ph = 'aim'; state.phT = 0; }
      if (keys.pressed.has('Enter') || keys.pressed.has('Space')) { state.ph = 'aim'; state.phT = 0; }
    } else if (state.ph === 'aim') {
      const a = state.aim;
      if (ptr.pressed) {
        if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
        if (inRect(L.tools[0], ptr.x, ptr.y)) { requestHint(); sfx.tick(); } else if (ptr.y > L.field.y && ptr.y < L.barTop) { a.drag = true; a.lx = ptr.x; a.ly = ptr.y; a.px = ptr.x; a.py = ptr.y; a.moved = 0; state.hint = null; }
      }
      if (a.drag && ptr.down) {
        // a stray second touch can make the pointer jump: ignore a jump of more than a thumb's reach in one tick
        if (ptr.pressed || Math.hypot(ptr.x - a.lx, ptr.y - a.ly) < 330) { a.lx = ptr.x; a.ly = ptr.y; a.moved = Math.max(a.moved, Math.hypot(ptr.x - a.px, ptr.y - a.py)); aimFromPointer(ptr.x, ptr.y, L); }
        pathT -= dt; if (pathT <= 0) { pathT = 0.05; updatePath(); }
      }
      if (a.drag && !ptr.down) {
        a.drag = false;
        updatePath();
        if (a.pow >= MIN_PULL && a.moved >= 20) beginTiming(); else { a.pow = 0; a.path = null; toast('Pull back further, then let go', 2); }
      }
      if (!a.drag) {
        const sgn = state.side === 0 ? 1 : -1;
        let ch = false;
        if (keys.down.has('ArrowLeft') || keys.down.has('KeyA')) { a.ang -= 0.025 * sgn; ch = true; }
        if (keys.down.has('ArrowRight') || keys.down.has('KeyD')) { a.ang += 0.025 * sgn; ch = true; }
        if (keys.down.has('ArrowUp') || keys.down.has('KeyW')) { a.pow = clamp(a.pow + 0.015, 0, 1); ch = true; }
        if (keys.down.has('ArrowDown') || keys.down.has('KeyS')) { a.pow = clamp(a.pow - 0.015, 0, 1); ch = true; }
        if (ch) { a.fx = undefined; updatePath(); }
        if ((keys.pressed.has('Enter') || keys.pressed.has('Space')) && a.pow >= MIN_PULL) beginTiming();
        if (keys.pressed.has('KeyH')) requestHint();
      }
    } else if (state.ph === 'timing') {
      const tm = state.timing;
      if (ptr.pressed) {
        if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
        if (inRect(L.tools[0], ptr.x, ptr.y)) { state.ph = 'aim'; state.timing = null; sfx.tick(); return; }
        if (!tm.locked && state.phT > 0.25) lockTiming(timingQuality(tm.n));
      }
      if ((keys.pressed.has('Space') || keys.pressed.has('Enter')) && !tm.locked && state.phT > 0.25) lockTiming(timingQuality(tm.n));
    } else if (state.ph === 'run' || state.ph === 'over') {
      if (ptr.pressed) {
        if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
        if (inRect(L.tools[1], ptr.x, ptr.y) && !state.w.over) { state.speed = state.speed === 1 ? 2 : 1; sfx.tick(); }
      }
      if (keys.pressed.has('KeyX')) state.speed = state.speed === 1 ? 2 : 1;
    }
    // everything below is frozen while paused (clocks, searches, in-flight animation)
    if (state.paused) return;
    if (state.toastT > 0) state.toastT -= dt;
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.4);
    stepParts(state.parts, dt);
    state.phT += dt;
    if (!watch) {
      updateHint(dt);
      if (rivalPlanner && !rivalPlanner.done) rivalPlanner.step(3);
      if (rivalPlanner && rivalPlanner.done && !rivalLaunch) rivalLaunch = executeLaunch(rivalPlanner.result.launch, PROFILES[m.cfg.opp], aiRng);
    }
    if (state.ph === 'intro' && state.phT >= INTRO_SECS) {
      state.ph = 'aim'; state.phT = 0;
      if (!watch) sfx.go();
    }
    if (watch && state.ph === 'aim') updateWatch(dt);
    if (state.ph === 'timing') {
      const tm = state.timing;
      tm.t += dt;
      if (!tm.locked) {
        const x = tm.t / GAUGE.period + tm.phi;
        tm.n = 1 - Math.abs(2 * (x - Math.floor(x)) - 1);
        if (tm.t > GAUGE.timeout) lockTiming(GAUGE.floor);
      } else { tm.lockT += dt; if (tm.lockT > 0.6) commitAim(); }
    }
    if (state.ph === 'waitrival') {
      if (rivalPlanner && !rivalPlanner.done) rivalPlanner.step(40);
      if (!rivalLaunch && rivalPlanner && rivalPlanner.done) rivalLaunch = executeLaunch(rivalPlanner.result.launch, PROFILES[m.cfg.opp], aiRng);
      if (rivalLaunch) doLaunch();
    }
    if (state.ph === 'run' || state.ph === 'over') {
      stepRun(dt);
      if (state.ph === 'run' && state.w.over) onOver();
      if (state.ph === 'over' && state.phT > OVER_SECS) { state.ph = 'between'; state.phT = 0; }
    }
    if (state.ph === 'between' && watch && state.phT > 4.5) afterBanner();
  };

  // ---- menus ------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag;
    const mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) {
      const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top));
      state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max);
    }
  }
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'p-calm') { state.settings.calm = !state.settings.calm; save(); }
    else if (id === 'p-txt-dec') { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.ui.scroll = 0; save(); }
    else if (id === 'p-txt-inc') { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.ui.scroll = 0; save(); }
    else if (id === 'quit') leaveMatch();
  }

  const refreshMatchup = () => {
    const s = state.setup;
    if (s.mode !== 'ai' || state.lessonPending != null || state.scene !== 'workshop') { state.matchupText = ''; return; }
    const hb = state.builds[0];
    const prof = PROFILES[s.opp];
    if (s.opp === 4) { state.matchupText = `${prof.name} picks a top after seeing yours.`; return; }
    const rb = rivalBuild(s.opp, s.arena, hb);
    let wins = 0, n = 0;
    for (const off of [0, 0.22, -0.22]) for (const pow of [0.62, 0.85]) {
      const r = tryLaunch(s.arena, 0, hb, rb, { ang: bearing(0) + off, pow, q: 0.95 }, { ang: bearing(1), pow: 0.78, q: 0.9 }, 40);
      if (r.won > 0) wins++; n++;
    }
    const word = wins >= 5 ? 'a good match for you' : wins >= 3 ? 'an even match' : 'a hard match for you';
    state.matchupText = `Against ${prof.name} (${BODIES[rb.body].name}, ${TIPS[rb.tip].name}): you won ${wins} of ${n} trial launches here, ${word}.`;
  };
  const openWorkshop = (idx) => { state.scene = 'workshop'; state.wsIdx = idx; state.ui.scroll = 0; state.setupMsg = ''; refreshMatchup(); };

  const handleTitle = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'continue') resumeMatch();
    else if (id === 'play') { state.setup.mode = 'ai'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'friend') { state.setup.mode = 'friend'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'learn') { state.scene = 'learn'; state.ui.scroll = 0; }
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id.startsWith('arena')) { const p = id.slice(5); if (state.demo && p === 'plate') { state.setupMsg = 'That dish is in the full game.'; return; } s.arena = p; state.setupMsg = ''; prebake(p); }
    else if (id === 'len3') s.rounds = 3;
    else if (id === 'len1') s.rounds = 1;
    else if (id === 'start') { savePrefs(); openWorkshop(0); }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleWorkshop = (id) => {
    if (!id) return;
    const p = state.wsIdx, b = state.builds[p];
    sfx.tick();
    if (id.startsWith('body:')) { b.body = id.slice(5); while (!legal(b)) b.ballast = b.ballast === 'heavy' ? 'std' : 'light'; }
    else if (id.startsWith('tip:')) b.tip = id.slice(4);
    else if (id.startsWith('ballast:')) { const v = id.slice(8); if (legal({ ...b, ballast: v })) b.ballast = v; else { state.setupMsg = 'Over the weight limit for this body.'; sfx.no(); return; } }
    else if (id.startsWith('hand:')) b.hand = Number(id.slice(5));
    else if (id === 'paint') state.looks[p] = (state.looks[p] + 1) % 6;
    state.setupMsg = '';
    refreshMatchup();
    savePrefs();
  };
  const workshopNext = () => {
    const s = state.setup;
    savePrefs();
    if (state.lessonPending != null) { const i = state.lessonPending; state.lessonPending = null; startLesson(i); return; }
    if (s.mode === 'friend' && state.wsIdx === 0) { openWorkshop(1); return; }
    if (state.demo && state.record.demoRounds >= DEMO_ROUND_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    startMatch(makeCfg(s.mode));
  };
  const workshopBack = () => {
    state.ui.scroll = 0;
    if (state.lessonPending != null) { state.lessonPending = null; state.scene = 'lessonbrief'; return; }
    if (state.setup.mode === 'friend' && state.wsIdx === 1) { openWorkshop(0); return; }
    state.scene = 'setup';
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
      state.restoreMsg = 'Checking with the store...';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.match.cfg;
    if (id === 'again') { if (cfg.mode === 'watch') startWatch(); else startMatch({ ...cfg, builds: cfg.builds.map((b) => ({ ...b })) }); }
    else if (id === 'new') { if (cfg.mode === 'watch') startWatch(); else { state.scene = 'setup'; state.ui.scroll = 0; } }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleLearn = (id) => {
    if (id && id.startsWith('lesson')) { sfx.tick(); state.lessonIdx = Number(id.slice(6)); state.scene = 'lessonbrief'; state.ui.scroll = 0; }
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
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };

  const pinnedScene = (dt, input, handler, key, pins) => {
    const ptr = input.pointer, k = input.keys;
    if (key) ensureLayout(state, key);
    if (k.pressed.has('Enter')) { pins.go(); return; }
    if (k.pressed.has('Escape')) { pins.back(); return; }
    if (ptr.pressed && inRect(SETUP_PINS.start, ptr.x, ptr.y)) { pins.go(); return; }
    if (ptr.pressed && !pins.single && inRect(SETUP_PINS.back, ptr.x, ptr.y)) { pins.back(); return; }
    updateFlowScene(dt, input, handler, key);
  };

  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const n = pageCount();
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.page = 0; };
    const next = () => { if (state.page >= n - 1) close(); else state.page++; };
    const prev = () => { if (state.page <= 0) close(); else state.page--; };
    if (ptr.pressed) {
      if (inRect(REF_NEXT, ptr.x, ptr.y)) next();
      else if (inRect(REF_BACK, ptr.x, ptr.y)) prev();
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    }
    if (keys.pressed.has('ArrowRight')) next();
    if (keys.pressed.has('ArrowLeft')) prev();
    if (keys.pressed.has('Escape')) close();
  };

  // ---- store screenshots: real staged moments (`?shot=1&seed=9000NN`) -----------------------------------
  const stageRun = (cfg, launches, secs, toOver = false, untilHit = 0) => {
    state.match = { cfg, round: 1, wins: [0, 0], stats: { outs: 0, best: 0 }, over: null };
    state.scene = 'play'; prepRound(false);
    const w = newWorld(cfg.arena, cfg.builds, launches);
    state.w = w; state.pre = null; state.ph = 'run';
    let hitAt = -1;
    for (let i = 0; i < Math.round(secs * 60); i++) {
      stepWorld(w, STEP);
      if (untilHit && w.hits > 0 && hitAt < 0) hitAt = i;
      if (hitAt >= 0 && i - hitAt >= untilHit) break;
      if (i % 2 === 0) pushTrail(state.trails, w);
      handleEvents(w, state.parts, true);
      stepParts(state.parts, STEP);
      if (w.over && !toOver) break;
    }
    if (w.over) { state.ph = 'over'; state.phT = 0.5; }
  };
  const stageShot = (n) => {
    state.shot = true; state.settings.sound = false; audio.setMuted?.(true);
    const bs = [{ body: 'pear', tip: 'steel', ballast: 'std', hand: 1 }, { body: 'disc', tip: 'pebble', ballast: 'heavy', hand: -1 }];
    const cfg = (arena = 'shallow') => ({ mode: 'ai', opp: 2, arena, rounds: 3, builds: [{ ...bs[0] }, { ...bs[1] }], looks: [0, 3], names: ['You', 'Siti'], lesson: null, script: null });
    const L = (a0, p0, a1, p1) => [{ ang: bearing(0) + a0, pow: p0, q: 1 }, { ang: bearing(1) + a1, pow: p1, q: 0.97 }];
    if (n === 1) { stageRun(cfg(), L(0.12, 0.62, -0.1, 0.6), 2.1); state.match.wins = [1, 0]; }
    else if (n === 2) {
      state.match = { cfg: cfg(), round: 2, wins: [1, 0], stats: { outs: 0, best: 0 }, over: null }; state.scene = 'play'; prepRound(false); state.ph = 'aim';
      const an = aimAnchor(0), a = state.aim;
      a.drag = true; a.fx = an.x + 40; a.fy = an.y + 160; a.pow = 0.7; a.ang = bearing(0) - 0.16;
      updatePath();
      const c = state.match.cfg;
      state.hint = { launch: { ang: bearing(0) + 0.05, pow: 0.74 }, reason: 'A firm straight launch: the hit should push their top over the rim.', path: predictPath(0, c.builds[0], { ang: bearing(0) + 0.05, pow: 0.74, q: 0.97 }, c.arena), t: 0, dur: 999 };
    } else if (n === 3) { state.scene = 'workshop'; state.wsIdx = 0; state.builds[0] = { body: 'disc', tip: 'steel', ballast: 'light', hand: 1 }; state.setup.opp = 2; state.setup.mode = 'ai'; refreshMatchup(); }
    else if (n === 4) stageRun({ ...cfg('plate'), builds: [{ ...bs[1] }, { body: 'spire', tip: 'steel', ballast: 'light', hand: 1 }], looks: [4, 1], names: ['You', 'Dimas'] }, L(0.05, 0.78, 0.0, 0.78), 5.5);
    else if (n === 5) stageRun(cfg(), L(0.05, 0.55, 0.02, 0.5), 11.5);
    else if (n === 6) state.scene = 'title';
    else if (n === 11) stageRun(cfg(), L(0.12, 0.62, -0.1, 0.6), 0.05);
    else if (n === 12) { stageRun({ ...cfg(), builds: [{ body: 'pear', tip: 'steel', ballast: 'std', hand: 1 }, { body: 'dome', tip: 'steel', ballast: 'std', hand: -1 }], names: ['You', 'Haruto'], looks: [0, 4] }, L(0.0, 0.8, 0.0, 0.8), 3, false, 5); state.match.wins = [0, 1]; }
    else if (n === 7) {
      startWatch(); state.settings.thinkIdx = 0;
      const idle = { pointer: { pressed: false, down: false, released: false, x: 0, y: 0 }, keys: { down: new Set(), pressed: new Set() } };
      for (let i = 0; i < 1500; i++) { updatePlay(1 / 60, idle); if (state.wl && state.wl.phase === 'reveal' && state.wl.t > 0.3) break; }
    } else if (n === 8) { state.scene = 'rules'; state.back = 'title'; state.page = 3; }
    else if (n === 9) state.scene = 'setup';
    else if (n === 10) {
      const c2 = { ...cfg('plate'), builds: [{ ...bs[1] }, { ...bs[0] }], looks: [4, 1], names: ['You', 'Haruto'] };
      let found = null;
      for (const a of [0.2, -0.2, 0.35, -0.35, 0.1, -0.1, 0.5]) for (const p of [1, 0.9, 0.8]) {
        if (found) break;
        const w = newWorld('plate', c2.builds, L(a, p, 0, 0.75));
        for (let i = 0; i < 1800 && !w.over; i++) stepWorld(w, STEP);
        if (w.over && w.over.why === 'out' && w.over.winner === 0) found = [a, p, w.t];
      }
      const f = found ?? [0.2, 1, 3];
      stageRun(c2, L(f[0], f[1], 0, 0.75), f[2] + 0.35, true);
    }
    state.paused = false;
  };
  startAttract();
  if (shotSeed) stageShot(shotSeed);

  return {
    // Watch & Learn, lessons and every menu are free; only real play counts against the free preview (a paused match,
    // the round summary between rounds and the pass-the-device card do not).
    isPreviewExempt: () => state.shot || !(state.scene === 'play' && state.match && state.match.cfg.mode !== 'watch' && state.match.cfg.mode !== 'lesson') || state.paused || state.ph === 'between' || state.ph === 'pass',
    update(dt, input) {
      setPress(input.pointer);
      if (state.shot) { state.t += dt; return; }
      const frozen = state.paused && (state.scene === 'play' || state.back === 'play');
      if (!frozen) state.t += dt;
      if (state.att && state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': pinnedScene(dt, input, handleSetup, 'setup', { go: () => handleSetup('start'), back: () => handleSetup('back') }); break;
        case 'workshop': pinnedScene(dt, input, handleWorkshop, 'workshop', { go: workshopNext, back: workshopBack }); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'learn': pinnedScene(dt, input, handleLearn, 'learn', { single: true, go: () => { state.scene = 'title'; state.ui.scroll = 0; }, back: () => { state.scene = 'title'; state.ui.scroll = 0; } }); break;
        case 'lessonbrief': pinnedScene(dt, input, () => {}, 'lessonbrief', { go: () => { if (LESSONS[state.lessonIdx].pickBuild) { state.lessonPending = state.lessonIdx; state.setup.mode = 'ai'; openWorkshop(0); } else startLesson(state.lessonIdx); }, back: () => { state.scene = 'learn'; state.ui.scroll = 0; } }); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'workshop': renderWorkshop(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'learn': renderLearn(ctx, state); break;
        case 'lessonbrief': renderBrief(ctx, state); break;
        case 'result': renderResult(ctx, state, (c) => { if (state.w) drawScene(c, sceneOf(state)); }); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.match) { renderPlay(ctx, state); if (state.ph === 'between' && state.banner) drawBanner(ctx, state); }
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
  };
}
