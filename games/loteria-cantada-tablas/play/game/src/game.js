// Lotería Cantada: state and flow. Drawing lives in view.js; the rules engine in rules.js. This is the only
// file that mutates `state` (apart from view.js caching the reference-page count). Deterministic:
// randomness from env.rng, time from dt only.
//
// How a round plays: a card is called every few seconds; TAP the matching picture on your tabla to drop a
// bean (while that call is still "open"); press ¡LOTERÍA! when your pattern is complete. Computer players
// react with human-like delays. Watch & Learn plays a whole round itself: THINK -> REVEAL -> ACT.
import {
  inRect, TEXT_SCALES, THINK_STEPS, AUTO_REVEAL_SECS, AUTO_ACT_SECS, SETUP_KEYS, DUO_SETUP_KEYS, cellAt, cellRect, layoutFor,
} from './layout.js';
import {
  SCORE, HINTS_PER_ROUND, LOCKOUT_SECS, PATTERNS, CONCRETE, PACES, SKILLS, STYLES, byId,
  newPool, dealTabla, emptyMarks, isComplete, impossible, completedSet, markable, tapOutcome, refreshDead, cpuHear, cpuClaimDelay, winPoints,
} from './rules.js';
import { DECK_SIZE } from './cards.js';
import { THEME_IDS } from './art.js';
import { t as tr } from './strings.js';
import { render } from './view.js';

// `meta.width/height` are updated live by the kit on every resize (fluid viewport: the short side is always 720 units).
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
const DEMO_ROUNDS = 3;
const SHOWCASE_SEED_MIN = 777000; // reserved seeds that open a staged screen for store screenshots

export function createGame(env) {
  const { rng, storage, audio, config } = env;
  const state = {
    scene: 'menu', t: 0, lang: 'es', theme: 'fiesta', sound: true, textIdx: 0,
    cfg: { pattern: 'linea', pace: 'fiesta', opps: 2, skill: 'normal', style: 'classic' },
    mode: 'solo', score: 0, best: 0, roundNo: 0, demoRounds: 0, demoAuto: 0,
    coach: false, pick: null, round: null, caller: null, page: 0, pageCount: 1, returnScene: null,
    paused: false, toast: null, parts: [], thinkIdx: 1, resetDone: 0, frozen: false, showcaseInit: false,
  };
  let sfx = [], lastPointer = null;
  const lay = () => layoutFor(meta.width, meta.height);
  const lay2 = (v) => layoutFor(v?.width ?? meta.width, v?.height ?? meta.height);

  // ---- persistence ------------------------------------------------------------------------------------------
  const savePrefs = () => storage.set('prefs', { lang: state.lang, theme: state.theme, sound: state.sound, textIdx: state.textIdx, cfg: state.cfg, thinkIdx: state.thinkIdx, coach: state.coach });
  const saveStats = () => storage.set('stats', { best: state.best, score: state.score, roundNo: state.roundNo });
  const saveDemo = () => storage.set('demo', { rounds: state.demoRounds, auto: state.demoAuto });
  storage.get('prefs', null).then((p) => {
    if (!p) return;
    const clampI = (v, n, d) => Math.min(Math.max(Number.isInteger(v) ? v : d, 0), n - 1);
    state.lang = p.lang === 'en' ? 'en' : 'es';
    state.theme = THEME_IDS.includes(p.theme) ? p.theme : 'fiesta'; state.sound = p.sound !== false;
    state.textIdx = clampI(p.textIdx, TEXT_SCALES.length, 0); state.thinkIdx = clampI(p.thinkIdx, THINK_STEPS.length, 1);
    if (p.cfg) {
      const c = state.cfg;
      if (PATTERNS.some((x) => x.id === p.cfg.pattern)) c.pattern = p.cfg.pattern;
      if (PACES.some((x) => x.id === p.cfg.pace)) c.pace = p.cfg.pace;
      if ([1, 2, 3].includes(p.cfg.opps)) c.opps = p.cfg.opps;
      if (SKILLS.some((x) => x.id === p.cfg.skill)) c.skill = p.cfg.skill;
      if (STYLES.some((x) => x.id === p.cfg.style)) c.style = p.cfg.style;
    }
    state.coach = p.coach === true;
    audio.setMuted(!state.sound);
  });
  storage.get('stats', null).then((s) => { if (s) { state.best = s.best | 0; state.score = s.score | 0; state.roundNo = s.roundNo | 0; } });
  storage.get('demo', null).then((d) => { if (d) { state.demoRounds = d.rounds | 0; state.demoAuto = d.auto | 0; } });

  // ---- small helpers -----------------------------------------------------------------------------------------
  const L = () => state.lang;
  const say = (text, kind = 'info', secs = 1.6) => { state.toast = { text, kind, t: 0, max: secs }; };
  const play = (o, delay = 0) => { if (!state.sound) return; if (delay > 0) sfx.push({ at: state.t + delay, o }); else audio.tone(o); };
  const sound = (name, extra = 0) => {
    if (name === 'ok') play({ freq: 680, to: 880, dur: 0.09, type: 'sine', vol: 0.13 });
    else if (name === 'bean') { play({ freq: 240, to: 110, dur: 0.09, type: 'triangle', vol: 0.3 }); play({ freq: 520, to: 300, dur: 0.07, type: 'square', vol: 0.04 }, 0.05); }
    else if (name === 'wrong') play({ freq: 170, to: 100, dur: 0.18, type: 'sawtooth', vol: 0.12 });
    else if (name === 'call') { const f = [392, 440, 494, 587, 659, 740][extra % 6]; play({ freq: f, dur: 0.22, type: 'triangle', vol: 0.2 }); play({ freq: f * 1.5, dur: 0.3, type: 'sine', vol: 0.12 }, 0.09); }
    else if (name === 'win') [523, 659, 784, 1046, 1318].forEach((f, k) => play({ freq: f, dur: 0.3, type: 'triangle', vol: 0.2 }, k * 0.11));
    else if (name === 'lose') [392, 330, 262].forEach((f, k) => play({ freq: f, dur: 0.34, type: 'triangle', vol: 0.17 }, k * 0.18));
    else if (name === 'lotto') { play({ freq: 880, to: 1320, dur: 0.18, type: 'square', vol: 0.08 }); play({ freq: 660, dur: 0.25, type: 'triangle', vol: 0.2 }, 0.08); }
  };
  const confetti = (x, y, n, big = false) => {
    const cols = ['#ff4f81', '#ffb52e', '#2fd0b4', '#8a6cff', '#ff7a2e', '#fff3dc'];
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2), v = rng.range(80, big ? 520 : 260);
      state.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (big ? 260 : 100), rot: rng.range(0, 6.28), vr: rng.range(-8, 8), t: 0, max: rng.range(0.9, big ? 2.6 : 1.4), c: cols[i % cols.length], s: rng.range(8, 16), kind: i % 3 === 0 ? 'petal' : 'conf' });
    }
  };
  const sparkle = (x, y, n) => {
    const cols = ['#ffd24a', '#fff3dc', '#ff9ad0', '#7af0c8'];
    for (let i = 0; i < n; i++) { const a = rng.range(0, Math.PI * 2), v = rng.range(60, 190); state.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, rot: rng.range(0, 6.28), vr: rng.range(-6, 6), t: 0, max: rng.range(0.45, 0.9), c: cols[i % cols.length], s: rng.range(5, 9), kind: 'petal' }); }
  };
  // About / How to Play / Rules are one continuous scrolling reader: drag, wheel, arrow / page keys.
  let wheelHooked = false, refDrag = null;
  const REF_SCENES = new Set(['about', 'howto', 'rules']);
  function refInput(input) {
    const p = input.pointer, k = input.keys.pressed, set = (v) => { state.refScroll = Math.max(0, Math.min(state.refMax || 0, v)); };
    const d = lay().d, q = d.to(p.x, p.y), pn = d.panel;
    if (p.pressed && !state.paused && q.x >= pn.x && q.x <= pn.x + pn.w && q.y >= pn.y + 90 && q.y <= pn.y + pn.maxH) refDrag = { y0: q.y, s0: state.refScroll || 0 };
    if (refDrag) { if (p.down) set(refDrag.s0 - (q.y - refDrag.y0)); else refDrag = null; }
    if (k.has('ArrowDown')) set((state.refScroll || 0) + 70); if (k.has('ArrowUp')) set((state.refScroll || 0) - 70);
    if (k.has('PageDown') || k.has('Space')) set((state.refScroll || 0) + (state.refView || 400) * 0.9); if (k.has('PageUp')) set((state.refScroll || 0) - (state.refView || 400) * 0.9);
    if (k.has('Home')) set(0); if (k.has('End')) set(1e9);
  }
  const go = (scene) => { state.scene = scene; state.paused = false; state.page = 0; state.refScroll = 0; state.toast = null; };

  // ---- rounds ----------------------------------------------------------------------------------------------------
  const mkPlayer = (kind, name, tabla, skill = 'normal') => ({ kind, name, tabla, marks: emptyMarks(), dead: Array(16).fill(false), beanT: Array(16).fill(9), lock: 0, stats: { beans: 0, wrong: 0, falses: 0 }, hints: HINTS_PER_ROUND, hintCell: -1, hintT: 0, flash: null, pending: [], claimAt: -1, skill });
  function makeRound(mode, pool, tablas, cfg) {
    const pat = cfg.pattern === 'sorpresa' ? rng.pick(CONCRETE).id : cfg.pattern;
    const pace = byId(PACES, cfg.pace);
    const players = [];
    if (mode === 'duo') players.push(mkPlayer('human', 0, tablas[0]), mkPlayer('human', 1, tablas[1]));
    else {
      players.push(mkPlayer('human', 0, tablas[0]));
      const names = rng.shuffle([0, 1, 2]);
      for (let i = 0; i < cfg.opps; i++) players.push(mkPlayer('cpu', names[i], dealTabla(rng, pool), cfg.skill));
    }
    return {
      mode, pool, pattern: pat, patternCfg: cfg.pattern, paceId: pace.id, secs: mode === 'auto' ? 5 : pace.secs, window: mode === 'auto' ? 1 : pace.window, style: mode === 'auto' ? 'classic' : cfg.style,
      idx: -1, called: [], callT: 0, timer: 1.8, clock: 0, players, status: 'running', winner: -1, winSet: null, endT: 0, deckDone: false, endAt: 0,
      hintName: -1, impossibleT: 0, ff: false, result: null, num: state.roundNo + 1, auto: null,
    };
  }
  function callNext(r) {
    if (r.idx + 1 >= r.pool.length) { r.deckDone = true; r.endAt = r.mode === 'auto' ? 0.4 : r.secs * r.window * 0.9 + 1; r.timer = 1e9; return false; }
    r.idx++; const id = r.pool[r.idx]; r.called.push(id); r.callT = 0;
    for (const p of r.players) refreshDead(p.tabla, p.marks, p.dead, r.called, r.window);
    if (r.mode !== 'auto') for (const p of r.players) if (p.kind === 'cpu') cpuHear(rng, p, id, r.clock);
    sound('call', id);
    { const L = lay(); if (r.mode === 'duo') sparkle(L.w / 2, L.h / 2, 10); else { const c = (r.mode === 'auto' ? L.auto : L.play).card; sparkle(c.x + c.w / 2, c.y + c.h / 2, 12); } }
    return true;
  }
  function startRound(mode, tablas, pool) {
    if (config.demo && mode !== 'auto' && state.demoRounds >= DEMO_ROUNDS) { go('demolimit'); return; }
    if (config.demo && mode === 'auto' && state.demoAuto >= 1) { go('demolimit'); return; }
    state.mode = mode; state.parts = [];
    const r = makeRound(mode, pool, tablas, mode === 'auto' ? { pattern: 'linea', pace: 'fiesta', opps: 2, skill: 'normal', style: 'classic' } : state.cfg);
    state.round = r;
    if (mode === 'auto') { r.auto = { phase: 'intro', timer: 1.2, target: -1, win: -1 }; state.demoAuto++; saveDemo(); go('auto'); }
    else { state.demoRounds++; saveDemo(); go(mode === 'duo' ? 'duo' : 'play'); }
    state.roundNo++; r.num = state.roundNo; saveStats();
    if (mode === 'solo' && !state.coach) { state.coach = true; savePrefs(); say(tr(L(), 'tip'), 'info', 5); }
  }
  function endRound(r, status, winner = -1) {
    if (r.status !== 'running') return;
    r.status = status; r.winner = winner; r.endT = 0;
    const calls = r.called.length;
    r.result = r.players.map((p, i) => {
      if (p.kind !== 'human') return null;
      const bonus = status === 'won' && winner === i ? winPoints(calls) : 0;
      const total = p.stats.beans * SCORE.bean + p.stats.wrong * SCORE.wrong + p.stats.falses * SCORE.falseClaim + bonus;
      return { beans: p.stats.beans, wrong: p.stats.wrong, falses: p.stats.falses, bonus, total };
    });
    if (status === 'won') {
      r.winSet = completedSet(r.players[winner].marks, r.pattern);
      const humanWon = r.players[winner].kind === 'human';
      sound(humanWon ? 'win' : 'lose'); confetti(meta.width / 2, meta.height * 0.3, humanWon ? 90 : 20, true);
    } else sound('lose');
    if (r.mode === 'solo' && r.result[0]) { state.score += r.result[0].total; state.best = Math.max(state.best, r.result[0].total); saveStats(); }
  }
  function tapCell(r, pi, cell) {
    const p = r.players[pi];
    if (r.status !== 'running' || cell < 0 || r.idx < 0) return;
    const out = tapOutcome(p.tabla, p.marks, cell, r.called, r.window);
    if (out === 'already') return;
    if (out === 'bean') {
      p.marks[cell] = true; p.beanT[cell] = 0; p.stats.beans++; p.flash = { cell, t: 0, kind: 'ok' };
      sound('bean'); if (p.hintCell === cell) p.hintCell = -1;
      { const L = lay(), cr = cellRect(r.mode === 'duo' ? L.duo.tabla : L.play.tabla, cell); let q = { x: cr.x + cr.w / 2, y: cr.y + cr.h / 2 }; if (r.mode === 'duo' && pi === 1) q = L.duo.rot(q.x, q.y); sparkle(q.x, q.y, 8); }
      if (isComplete(p.marks, r.pattern)) { say(tr(L(), 'complete'), 'good', 2.2); sound('ok'); }
    } else if (out === 'wrong') {
      p.stats.wrong++; p.flash = { cell, t: 0, kind: 'wrong' }; sound('wrong'); say(tr(L(), 'wrongTap'), 'warn');
    } else { p.flash = { cell, t: 0, kind: 'wrong' }; say(tr(L(), 'tooLate'), 'warn'); sound('wrong'); }
  }
  function claim(r, pi) {
    const p = r.players[pi];
    if (r.status !== 'running' || p.lock > 0) return;
    if (isComplete(p.marks, r.pattern)) { sound('lotto'); endRound(r, 'won', pi); }
    else { p.stats.falses++; p.lock = LOCKOUT_SECS; sound('wrong'); say(tr(L(), 'falseClaim'), 'warn', 2); }
  }
  function useHint(r, pi) {
    const p = r.players[pi];
    if (r.status !== 'running' || p.hints <= 0 || r.idx < 0) return;
    p.hints--;
    const open = markable(r.called, r.window);
    let cell = -1;
    for (const id of open) { const c = p.tabla.indexOf(id); if (c >= 0 && !p.marks[c]) { cell = c; break; } }
    p.hintCell = cell; p.hintT = 3.2; r.hintName = r.called[r.idx];
    say(cell >= 0 ? tr(L(), 'onTabla') : tr(L(), 'notOn'), cell >= 0 ? 'good' : 'info', 2);
    sound('ok');
  }

  // ---- the running round -------------------------------------------------------------------------------------------
  function stepPlayers(r, dt) {
    for (const p of r.players) {
      p.lock = Math.max(0, p.lock - dt);
      for (let i = 0; i < 16; i++) if (p.beanT[i] < 9) p.beanT[i] += dt;
      if (p.flash) { p.flash.t += dt; if (p.flash.t > 0.5) p.flash = null; }
      if (p.hintT > 0) { p.hintT -= dt; if (p.hintT <= 0) p.hintCell = -1; }
    }
  }
  function stepRound(r, dt0) {
    const human = r.players[0];
    r.ff = r.mode === 'solo' && r.status === 'running' && r.idx >= 0 && impossible(human.marks, human.dead, r.pattern) && r.players.some((p) => p.kind === 'cpu' && !impossible(p.marks, p.dead, r.pattern));
    const dt = r.ff ? dt0 * 3 : dt0;
    stepPlayers(r, dt0);
    if (r.status !== 'running') { r.endT += dt0; return; }
    r.clock += dt; r.callT += dt;
    if (!r.deckDone) { r.timer -= dt; if (r.timer <= 0) { callNext(r); if (!r.deckDone) r.timer += r.secs; } }
    else { r.endAt -= dt; if (r.endAt <= 0) { endRound(r, 'draw'); return; } }
    for (let i = 1; i < r.players.length; i++) {
      const p = r.players[i];
      for (let k = p.pending.length - 1; k >= 0; k--) {
        const it = p.pending[k];
        if (it.at > r.clock) continue;
        p.pending.splice(k, 1);
        if (!p.marks[it.cell] && markable(r.called, r.window).includes(p.tabla[it.cell])) {
          p.marks[it.cell] = true; p.beanT[it.cell] = 0; p.stats.beans++;
          if (p.claimAt < 0 && isComplete(p.marks, r.pattern)) p.claimAt = r.clock + cpuClaimDelay(rng, p);
        }
      }
      if (p.claimAt >= 0 && r.clock >= p.claimAt && r.status === 'running') { endRound(r, 'won', i); return; }
    }
    if (r.status === 'running' && r.players.every((p) => impossible(p.marks, p.dead, r.pattern))) { r.impossibleT += dt; if (r.impossibleT > 1.6) endRound(r, 'draw'); }
  }

  // ---- watch & learn ---------------------------------------------------------------------------------------------------
  function autoNextCall() {
    const r = state.round, a = r.auto;
    if (!callNext(r)) { endRound(r, 'draw'); return; }
    a.target = r.players[0].tabla.indexOf(r.called[r.idx]); a.phase = 'think'; a.timer = THINK_STEPS[state.thinkIdx];
  }
  function autoAct() {
    const r = state.round, a = r.auto, id = r.called[r.idx], me = r.players[0];
    if (a.target >= 0 && !me.marks[a.target]) { me.marks[a.target] = true; me.beanT[a.target] = 0; me.stats.beans++; sound('bean'); }
    const done = [];
    for (let i = 1; i < r.players.length; i++) {
      const p = r.players[i], c = p.tabla.indexOf(id), sk = byId(SKILLS, p.skill);
      if (c >= 0 && !p.marks[c] && !rng.chance(sk.miss)) { p.marks[c] = true; p.beanT[c] = 0; p.stats.beans++; }
      if (isComplete(p.marks, r.pattern)) done.push(i);
    }
    if (isComplete(me.marks, r.pattern) && (!done.length || rng.chance(0.6))) a.win = 0; else if (done.length) a.win = rng.pick(done);
    a.phase = 'act'; a.timer = AUTO_ACT_SECS;
  }
  function autoStep(dt) {
    const r = state.round, a = r.auto;
    stepPlayers(r, dt);
    if (r.status !== 'running') { r.endT += dt; return; }
    r.callT += dt; a.timer -= dt;
    if (a.timer > 0) return;
    if (a.phase === 'intro') autoNextCall();
    else if (a.phase === 'think') { a.phase = 'reveal'; a.timer = AUTO_REVEAL_SECS; sound('ok'); }
    else if (a.phase === 'reveal') autoAct();
    else if (a.phase === 'act') { if (a.win >= 0) { a.phase = 'claim'; a.timer = 2.2; sound('lotto'); } else autoNextCall(); }
    else if (a.phase === 'claim') endRound(r, 'won', a.win);
  }

  // ---- caller mode ---------------------------------------------------------------------------------------------------------
  const CALLER_SECS = [5, 8, 12];
  function newCaller() {
    state.caller = { deck: rng.shuffle(Array.from({ length: DECK_SIZE }, (_, i) => i)), idx: -1, auto: false, speedIdx: 1, timer: 0, flipT: 9 };
    go('caller');
  }
  function callerNext() {
    const c = state.caller;
    if (c.idx + 1 >= c.deck.length) { c.auto = false; say(tr(L(), 'callerDone'), 'info', 2); return; }
    c.idx++; c.flipT = 0; c.timer = CALLER_SECS[c.speedIdx]; sound('call', c.deck[c.idx]);
  }

  // ---- starting things --------------------------------------------------------------------------------------------------------
  function dealPick(first) {
    const pool = first || !state.pick ? newPool(rng) : state.pick.pool;
    state.pick = { pool, tablas: [0, 1, 2].map(() => dealTabla(rng, pool)), sel: -1, t: 0 };
  }
  const startPick = () => { dealPick(true); go('pick'); };
  function startDuo() { const pool = newPool(rng); startRound('duo', [dealTabla(rng, pool), dealTabla(rng, pool)], pool); }
  function startAuto() { const pool = newPool(rng); startRound('auto', [dealTabla(rng, pool)], pool); }

  // ---- input ----------------------------------------------------------------------------------------------------------------------
  const hit = (r, x, y) => inRect(r, x, y);
  const cyc = (list, cur, d) => list[(list.indexOf(cur) + d + list.length) % list.length];
  const setupKeys = () => (state.mode === 'duo' ? DUO_SETUP_KEYS : SETUP_KEYS);
  function adjust(key, d) {
    const c = state.cfg;
    if (key === 'pattern') c.pattern = cyc(PATTERNS.map((p) => p.id), c.pattern, d);
    else if (key === 'pace') c.pace = cyc(PACES.map((p) => p.id), c.pace, d);
    else if (key === 'opps') c.opps = Math.min(3, Math.max(1, c.opps + d));
    else if (key === 'skill') c.skill = cyc(SKILLS.map((p) => p.id), c.skill, d);
    else if (key === 'style') c.style = cyc(STYLES.map((p) => p.id), c.style, d);
    else if (key === 'theme') state.theme = cyc(THEME_IDS, state.theme, d);
    savePrefs(); sound('ok');
  }
  function backFromRef() { const s = state.returnScene; state.returnScene = null; if (s) { state.scene = s; state.page = 0; state.refScroll = 0; } else go('menu'); }

  function tap(x0, y0) {
    const sc = state.scene;
    if (state.frozen) return;
    if (sc === 'play') return playTap(x0, y0);
    if (sc === 'duo') return duoTap(x0, y0);
    if (sc === 'auto') return autoTap(x0, y0);
    const L = lay(), d = L.d, { x, y } = d.to(x0, y0);          // every other screen is a design screen
    if (sc === 'menu') {
      const m = L.menuRows(TEXT_SCALES[state.textIdx] ?? 1);
      if (hit(L.lockTap(m), x0, y0)) { env.openArcforgeHome?.(); return; }
      if (hit(d.sound, x, y)) { state.sound = !state.sound; audio.setMuted(!state.sound); savePrefs(); sound('ok'); }
      else if (hit(m.play, x, y)) { state.mode = 'solo'; go('setup'); sound('ok'); }
      else if (hit(m.duo, x, y)) { state.mode = 'duo'; go('setup'); sound('ok'); }
      else if (hit(m.caller, x, y)) { newCaller(); sound('ok'); }
      else if (hit(m.watch, x, y)) startAuto();
      else if (hit(m.howto, x, y)) { go('howto'); sound('ok'); }
      else if (hit(m.rules, x, y)) { go('rules'); sound('ok'); }
      else if (hit(m.about, x, y)) { go('about'); sound('ok'); }
      else if (hit(m.es, x, y)) { state.lang = 'es'; savePrefs(); sound('ok'); }
      else if (hit(m.en, x, y)) { state.lang = 'en'; savePrefs(); sound('ok'); }
      else if (hit(m.settings, x, y)) { go('settings'); sound('ok'); }
    } else if (sc === 'setup') {
      const rows = L.setupRows(setupKeys());
      if (hit(d.back, x, y)) { go('menu'); sound('ok'); return; }
      for (const k of setupKeys()) if (hit(rows[k], x, y)) { adjust(k, x < rows[k].x + rows[k].w / 2 ? -1 : 1); return; }
      if (hit(rows.start, x, y)) { sound('ok'); if (state.mode === 'duo') startDuo(); else startPick(); }
    } else if (sc === 'pick') {
      const P = d.pick;
      if (hit(d.back, x, y)) { go('setup'); sound('ok'); return; }
      for (let i = 0; i < 3; i++) if (hit(P.slots[i], x, y)) { state.pick.sel = i; sound('ok'); return; }
      if (hit(P.deal, x, y)) { dealPick(false); sound('call', 3); return; }
      if (hit(P.play, x, y) && state.pick.sel >= 0) startRound('solo', [state.pick.tablas[state.pick.sel]], state.pick.pool);
    } else if (sc === 'caller') {
      const c = state.caller, C = d.caller;
      if (hit(C.menu, x, y)) { go('menu'); sound('ok'); }
      else if (hit(C.next, x, y)) callerNext();
      else if (hit(C.prev, x, y)) { if (c.idx > 0) { c.idx--; c.flipT = 0; c.timer = CALLER_SECS[c.speedIdx]; sound('ok'); } }
      else if (hit(C.auto, x, y)) { c.auto = !c.auto; c.timer = CALLER_SECS[c.speedIdx]; if (c.auto && c.idx < 0) callerNext(); sound('ok'); }
      else if (hit(C.reshuffle, x, y)) { newCaller(); sound('call', 1); }
      else if (hit(C.speed, x, y)) { c.speedIdx = (c.speedIdx + 1) % CALLER_SECS.length; c.timer = CALLER_SECS[c.speedIdx]; sound('ok'); }
    } else if (sc === 'about' || sc === 'howto' || sc === 'rules') {
      if (hit(d.textDec, x, y) && state.textIdx > 0) { state.textIdx--; state.refScroll = 0; savePrefs(); sound('ok'); }
      else if (hit(d.textInc, x, y) && state.textIdx < TEXT_SCALES.length - 1) { state.textIdx++; state.refScroll = 0; savePrefs(); sound('ok'); }
      else if (hit(d.refBack, x, y) || hit(d.refNext, x, y)) { backFromRef(); sound('ok'); }   // one continuous reader: Back and Done both leave
    } else if (sc === 'settings') {
      const rows = d.settings;
      if (hit(d.back, x, y)) { go('menu'); sound('ok'); return; }
      const left = (r) => x < r.x + r.w / 2;
      if (hit(rows.lang, x, y)) { state.lang = left(rows.lang) ? 'es' : 'en'; savePrefs(); sound('ok'); }
      else if (hit(rows.sound, x, y)) { state.sound = !state.sound; audio.setMuted(!state.sound); savePrefs(); sound('ok'); }
      else if (hit(rows.text, x, y)) { state.textIdx = Math.min(TEXT_SCALES.length - 1, Math.max(0, state.textIdx + (left(rows.text) ? -1 : 1))); savePrefs(); sound('ok'); }
      else if (hit(rows.theme, x, y)) adjust('theme', left(rows.theme) ? -1 : 1);
      else if (hit(rows.reset, x, y)) { state.best = 0; state.score = 0; saveStats(); state.resetDone = 2; sound('ok'); }
    } else if (sc === 'demolimit') { if (hit(d.demo.back, x, y)) go('menu'); }
  }
  // Pause panel and result panel for solo / duo rounds (design screens). Returns true when the tap was consumed.
  function overlayTap(x0, y0, r) {
    const d = lay().d, { x, y } = d.to(x0, y0);
    if (state.paused) {
      const P = d.pause;
      if (hit(P.resume, x, y)) { state.paused = false; sound('ok'); }
      else if (hit(P.rules, x, y)) { state.returnScene = state.scene; state.scene = 'rules'; state.page = 0; state.refScroll = 0; sound('ok'); }
      else if (hit(P.menu, x, y)) { go('menu'); sound('ok'); }
      return true;
    }
    if (r.status !== 'running') {
      if (r.endT > 1.2) {
        const RS = d.result;
        if (hit(RS.again, x, y)) { if (r.mode === 'duo') startDuo(); else startPick(); }
        else if (hit(RS.menu, x, y)) { go('menu'); sound('ok'); }
        else if (hit(RS.rules, x, y)) { state.returnScene = state.scene; state.scene = 'rules'; state.page = 0; state.refScroll = 0; sound('ok'); }
      }
      return true;
    }
    return false;
  }
  function playTap(x, y) {
    const r = state.round, P = lay().play;
    if (overlayTap(x, y, r)) return;
    if (hit(P.head.pause, x, y)) { state.paused = true; sound('ok'); return; }
    if (hit(P.bar.hint, x, y)) { useHint(r, 0); return; }
    if (hit(P.bar.claim, x, y)) { claim(r, 0); return; }
    const c = cellAt(P.tabla, x, y); if (c >= 0) tapCell(r, 0, c);
  }
  function duoTap(x, y) {
    const r = state.round, D = lay().duo;
    if (overlayTap(x, y, r)) return;
    if (hit(D.pause, x, y)) { state.paused = true; sound('ok'); return; }
    const bottom = y > D.cy;
    let px = x, py = y;
    if (!bottom) { const q = D.rot(x, y); px = q.x; py = q.y; }
    if (py < D.band.y + D.band.h) return;
    const pi = bottom ? 0 : 1;
    if (hit(D.claim, px, py)) { claim(r, pi); return; }
    const c = cellAt(D.tabla, px, py); if (c >= 0) tapCell(r, pi, c);
  }
  function autoTap(x, y) {
    const r = state.round, a = r.auto, B = lay().auto.bar;
    if (r.status !== 'running') {
      if (r.endT > 1.2) { const RS = lay().d.result, q = lay().d.to(x, y); if (hit(RS.again, q.x, q.y)) startAuto(); else if (hit(RS.menu, q.x, q.y)) { go('menu'); sound('ok'); } }
      return;
    }
    if (hit(B.exit, x, y)) { go('menu'); sound('ok'); }
    else if (hit(B.pause, x, y)) { state.paused = !state.paused; sound('ok'); }
    else if (state.paused) return;
    else if (hit(B.dec, x, y)) { if (state.thinkIdx > 0) { state.thinkIdx--; savePrefs(); sound('ok'); } }
    else if (hit(B.inc, x, y)) { if (state.thinkIdx < THINK_STEPS.length - 1) { state.thinkIdx++; savePrefs(); sound('ok'); } }
    else if (hit(B.speed, x, y)) { if (a.phase !== 'intro') a.timer = Math.min(a.timer, 0.01); }
  }
  function keyboard(keys) {
    const sc = state.scene, r = state.round;
    if (keys.pressed.has('Escape')) { if (sc === 'play' || sc === 'duo') state.paused = !state.paused; else if (sc !== 'menu') go('menu'); return; }
    if (keys.pressed.has('KeyP') && (sc === 'play' || sc === 'duo' || sc === 'auto')) { state.paused = !state.paused; return; }
    if (sc !== 'play' || state.paused || !r || r.status !== 'running') return;
    if (keys.pressed.has('Space')) claim(r, 0);
    if (keys.pressed.has('KeyH')) useHint(r, 0);
    const grid = [['Digit1', 'Digit2', 'Digit3', 'Digit4'], ['KeyQ', 'KeyW', 'KeyE', 'KeyR'], ['KeyA', 'KeyS', 'KeyD', 'KeyF'], ['KeyZ', 'KeyX', 'KeyC', 'KeyV']];
    grid.forEach((row, ri) => row.forEach((code, ci) => { if (keys.pressed.has(code)) tapCell(r, 0, ri * 4 + ci); }));
  }

  // ---- showcase: staged screens for store screenshots, opened by a reserved seed range --------------------------------
  function showcase(n) {
    state.frozen = true; state.lang = 'en';
    if (n === 1) return;
    if (n === 2) { state.mode = 'solo'; dealPick(true); state.pick.sel = 1; state.scene = 'pick'; return; }
    if (n === 5) { newCaller(); for (let k = 0; k < 6; k++) callerNext(); state.caller.flipT = 9; return; }
    const pool = newPool(rng);
    if (n === 6) {
      startAuto(); state.frozen = true; const r = state.round;
      for (let i = 0; i < 4000 && !(r.idx >= 5 && r.auto.phase === 'reveal'); i++) autoStep(0.1);
      r.auto.timer = 1.2; state.paused = false; return;
    }
    const r = makeRound('solo', pool, [dealTabla(rng, pool)], { pattern: 'linea', pace: 'fiesta', opps: 2, skill: 'normal', style: 'classic' });
    state.round = r; state.scene = n === 7 ? 'duo' : 'play'; state.roundNo = 4; r.num = 4;
    const me = r.players[0];
    for (let k = 0; k < 13; k++) callNext(r);
    for (let k = 0; k < r.called.length; k++) {
      const id = r.called[k], c = me.tabla.indexOf(id);
      if (c >= 0 && rng.chance(0.8)) { me.marks[c] = true; }
      for (let i = 1; i < r.players.length; i++) { const p = r.players[i], ci = p.tabla.indexOf(id); if (ci >= 0 && rng.chance(0.75)) p.marks[ci] = true; }
    }
    for (const p of r.players) refreshDead(p.tabla, p.marks, p.dead, r.called, r.window);
    me.stats.beans = me.marks.filter(Boolean).length;
    r.callT = 4.2; r.timer = 2.4; r.clock = 60;
    if (n === 4) {
      for (const i of [0, 1, 2, 3]) { me.marks[i] = true; me.dead[i] = false; }
      me.stats.beans = me.marks.filter(Boolean).length;
      endRound(r, 'won', 0); r.endT = 5; state.parts = [];
    }
    if (n === 7) { r.mode = 'duo'; r.players = [mkPlayer('human', 0, dealTabla(rng, pool)), mkPlayer('human', 1, dealTabla(rng, pool))]; for (const p of r.players) { r.called.forEach((id) => { const c = p.tabla.indexOf(id); if (c >= 0 && rng.chance(0.6)) p.marks[c] = true; }); refreshDead(p.tabla, p.marks, p.dead, r.called, r.window); } }
  }

  const api = {
    update(dt, input) {
      lastPointer = input.pointer;
      { const L0 = lay(), ip = input.pointer; state.lkDown = state.scene === 'menu' && !!ip.down && hit(L0.lockTap(L0.menuRows(TEXT_SCALES[state.textIdx] ?? 1)), ip.x, ip.y); }
      if (!wheelHooked && input.onWheel) { wheelHooked = true; input.onWheel(({ dy }) => { if (REF_SCENES.has(state.scene)) state.refScroll = Math.max(0, Math.min(state.refMax || 0, (state.refScroll || 0) + dy)); }); }
      if (REF_SCENES.has(state.scene)) refInput(input);
      if (!state.showcaseInit) { state.showcaseInit = true; if (config.seed >= SHOWCASE_SEED_MIN && config.seed < SHOWCASE_SEED_MIN + 100) showcase(config.seed - SHOWCASE_SEED_MIN + 1); }
      // Pause freezes EVERYTHING (timers, the auto-play loop, animations): only the pause controls are read.
      if (state.paused) {
        const k = input.keys;
        if (k.pressed.has('KeyP') || k.pressed.has('Escape')) state.paused = false;
        else if (input.pointer.pressed && !state.frozen) { if (state.scene === 'auto') autoTap(input.pointer.x, input.pointer.y); else tap(input.pointer.x, input.pointer.y); }
        return;
      }
      state.t += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.max) state.toast = null; }
      if (state.resetDone > 0) state.resetDone -= dt;
      for (const s of sfx) if (s.at <= state.t) audio.tone(s.o);
      sfx = sfx.filter((s) => s.at > state.t);
      for (const p of state.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; p.vx *= 0.995; p.rot += p.vr * dt; }
      state.parts = state.parts.filter((p) => p.t < p.max);
      if (input.pointer.pressed) tap(input.pointer.x, input.pointer.y);
      keyboard(input.keys);
      const r = state.round;
      if ((state.scene === 'play' || state.scene === 'duo') && r && !state.paused && !state.frozen) stepRound(r, dt);
      else if (state.scene === 'auto' && r && !state.paused && !state.frozen) autoStep(dt);
      else if (state.scene === 'pick' && state.pick) state.pick.t += dt;
      else if (state.scene === 'caller') {
        const c = state.caller; c.flipT += dt;
        if (c.auto) { c.timer -= dt; if (c.timer <= 0) callerNext(); }
      }
    },
    render(ctx, view) { render(ctx, state, lastPointer, lay2(view)); },
    getState() { return state; },
    // Only real play counts against the free preview: a running, unpaused solo/duo round or Caller mode.
    // Menus, setup, Rules/About/How to play, Settings, Watch & Learn, paused and finished rounds, and the
    // staged store-screenshot scenes are all free.
    isPreviewExempt() {
      if (state.frozen || state.paused) return true;
      const sc = state.scene, r = state.round;
      if (sc === 'play' || sc === 'duo') return !r || r.status !== 'running';
      return sc !== 'caller';
    },
  };
  return api;
}
