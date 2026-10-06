// Gonggi: Five Stones. State and flow. Rules and physics live in sim.js, the computer players in ai.js, drawing in
// view.js / art.js / menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, lessons, lessonintro, settings, play (also Learn and Watch & Learn), result, howto/about/rules, demolimit.
// A match is a series of turns. A turn runs the stages in order (scatter + hold, then toss rounds, then kkeokki) until a
// fault. One round has phases: plan -> charge -> exec -> resolve. The computer plays the same phases through `ai`.
// Watch & Learn adds the beat: THINK (frozen) -> REVEAL (frozen) -> ACT.
import {
  HOME, R, FIELD, STAGES, KKEOKKI, CHARGE_SECS, H_MIN, WIN_EARLY, WIN_LATE, FLICK_T, KK,
  winScale, clamp, dist, hasScatter, scatterStones, clusterAt, clampSpot, newRoll, evaluateRound, needTime, catchResult,
  kkToss, kkCatch, kkBest, flickKept, handAt,
} from './sim.js';
import { LEVELS, PERFECT, planRound, rankPlans, chooseHold, scatterChoice, executeHeight, executeEps, kkHeight, kkTap } from './ai.js';
import { inRect, playLayout, toWorld, TEXT_SCALES, THINK_STEPS, setupPins, refLayout, setScreen } from './layout.js';
import { renderPlay } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderLessons, renderLessonIntro, hitScreen, flowMeta, READER, refCloseRect, ensureLayout, lockupZone } from './menus.js';
import { LESSONS, DEMO_LESSONS } from './lessons.js';
import { pagesFor, tx } from './content.js';
import { explainScatter, explainHold, explainPlan, explainKkCharge, explainKkTap } from './explain.js';
import { setPress } from './ui.js';

// Fluid layout (kit 1.7.1): the short side is always 720 units; meta.width/height follow the real screen and are live.
export const wheelInput = { dy: 0 };
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
export const DEMO_MATCH_CAP = 2;
const REVEAL_SECS = 2;
const HINT_SECS = 9;
const MAX_PARTS = 160;
const MATCH_VERSION = 1;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork(), aiRng = rng.fork(), rollRng = rng.fork(), scatRng = rng.fork();
  const shotSeed = config.seed >= 800001 && config.seed <= 800060 && typeof location !== 'undefined' && /[?&]shot=1/.test(location.search) ? config.seed - 800000 : 0;
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, freeze: false, shot: !!shotSeed,
    settings: { lang: 'en', sound: true, calm: false, textIdx: 0, thinkIdx: 1 },
    record: { played: 0, wins: [0, 0, 0, 0, 0], streak: 0, bestStreak: 0, kkBest: 0, demoMatches: 0, lessons: [false, false, false, false, false, false] },
    setup: { opp: 'cpu', lvl: 1, target: 10 }, setupMsg: '', restoreMsg: '',
    ui: { scroll: 0, drag: null }, page: 0, lessonSel: 0,
    match: null, rd: null, att: null, saved: null, toast: '', toastT: 0, loaded: false,
  };
  let savedSnap = null;
  const lang = () => state.settings.lang;
  const T = (key, vars) => tx(lang(), key, vars);

  // ---- persistence ---------------------------------------------------------------------------------
  const saveSettings = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  const metaOf = (s) => ({ mode: s.cfg.mode, lvl: s.cfg.lvl, scores: [...s.scores], target: s.cfg.target, stage: s.stage[s.turn], turns: s.turns });
  const validSnap = (d) => d && d.v === MATCH_VERSION && d.cfg && (d.cfg.mode === 'cpu' || d.cfg.mode === 'pass') && Array.isArray(d.scores) && Array.isArray(d.stage) && d.rd && Array.isArray(d.rd.five) && Array.isArray(d.rd.mat);
  // A match in progress is saved when each round is planned and when the pause menu opens. Resume always opens paused.
  const persistMatch = () => {
    const m = state.match, rd = state.rd;
    if (state.shot || !m || !rd || (m.cfg.mode !== 'cpu' && m.cfg.mode !== 'pass') || m.over || state.scene !== 'play') return;
    const ph = ['scatter', 'hold', 'plan', 'kcharge'].includes(rd.phase) ? rd.phase : rd.phase === 'charge' ? 'plan' : null;
    if (!ph) return;
    const snap = { v: MATCH_VERSION, cfg: { ...m.cfg }, scores: [...m.scores], stage: [...m.stage], turn: m.turn, turns: m.turns, stats: JSON.parse(JSON.stringify(m.stats)),
      rd: { phase: ph, stage: rd.stage, ri: rd.ri, five: rd.five.map((s) => ({ id: s.id, x: s.x, y: s.y, rot: s.rot })), mat: rd.mat.map((s) => ({ id: s.id, x: s.x, y: s.y, rot: s.rot })), hold: rd.hold, held: [...rd.held] } };
    savedSnap = JSON.parse(JSON.stringify(snap));
    state.saved = metaOf(savedSnap);
    storage.set('match', snap);
  };
  const clearSave = () => { savedSnap = null; state.saved = null; storage.remove('match'); };
  const resumeMatch = () => {
    if (!savedSnap) return;
    const sn = JSON.parse(JSON.stringify(savedSnap));
    state.match = { cfg: sn.cfg, scores: sn.scores, stage: sn.stage, turn: sn.turn, turns: sn.turns, stats: sn.stats, over: null };
    state.scene = 'play'; state.ui.scroll = 0; state.toastT = 0; state.paused = false; state.pauseMenu = false;
    newTurnState(sn.turn);
    const rd = state.rd, r = sn.rd;
    rd.stage = r.stage; rd.ri = r.ri; rd.five = r.five; rd.mat = r.mat; rd.hold = r.hold; rd.held = r.held; rd.banner = null; rd.bannerT = 0;
    const ph = r.phase === 'plan' && !r.mat.length && r.stage !== 4 ? 'scatter' : r.phase;
    setPhase(ph);
    if (rd.phase === 'plan') beginPlan(true);
    openPause();
  };

  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('match', null)]).then(([s, r, d]) => {
    if (state.shot) { state.loaded = true; return; }
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    if (validSnap(d)) { savedSnap = d; state.saved = metaOf(d); }
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (state.settings.lang !== 'ko') state.settings.lang = 'en';
    if (!Array.isArray(state.record.lessons) || state.record.lessons.length !== LESSONS.length) state.record.lessons = LESSONS.map((_, i) => !!(state.record.lessons ?? [])[i]);
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

  // ---- particles ---------------------------------------------------------------------------------------
  const burst = (rd, x, y, n, power = 1, kind = 'spark') => {
    for (let i = 0; i < n && rd.parts.length < MAX_PARTS; i++) {
      const a = fx.next() * Math.PI * 2, sp = (40 + fx.next() * 200) * power;
      rd.parts.push({ kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, t: 0, max: 0.35 + fx.next() * 0.4, size: kind === 'dust' ? 18 + fx.next() * 14 : 7 + fx.next() * 8, rot: fx.next() * 3, col: kind === 'petal' ? ['#f08a6a', '#f6d27a', '#f3e6c8', '#e58aa0'][i % 4] : '#fff3c4' });
    }
  };
  const stepParts = (parts, dt) => {
    for (const p of parts) { p.t += dt; p.x += (p.vx ?? 0) * dt; p.y += (p.vy ?? 0) * dt; if (p.kind === 'spark' || p.kind === 'petal') p.vy += 260 * dt; if (p.kind === 'dust') { p.vx *= 0.95; p.vy *= 0.95; } if (p.kind === 'petal') p.rot += 3 * dt; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };
  const ring = (rd, x, y, size, col) => rd.parts.push({ kind: 'ring', x, y, vx: 0, vy: 0, t: 0, max: 0.55, size, col });
  const floatText = (rd, text, x, y, col = '#fff6e2') => rd.floats.push({ text, x, y, t: 0, max: 1.3, col });

  // ---- who plays ---------------------------------------------------------------------------------------
  const isWatch = () => !!state.match && state.match.cfg.mode === 'watch';
  const isLearn = () => !!state.match && state.match.cfg.mode === 'learn';
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
    if (c.mode === 'watch') { const lv = levelOf(who); return lang() === 'ko' ? lv.ko : lv.name; }
    if (c.mode === 'pass') return T(who === 0 ? 'p1' : 'p2');
    if (who === 0) return T('you');
    const lv = LEVELS[c.lvl]; return lang() === 'ko' ? lv.ko : lv.name;
  };

  function newTurnState(who) {
    state.rd = {
      who, phase: 'scatter', pt: 0, stage: state.match.stage[who], ri: 0, five: [], mat: [], hold: 0, held: [], sel: [], spot: null, charge: 0, h: 0.5,
      roll: null, ev: null, et: 0, res: null, eps: null, catchAt: null, picked: [], parts: [], floats: [], trail: [], flash: 0,
      sc: null, drag: null, hint: null, beat: null, ai: null, kk: null, kh: null, kres: null, banner: null, turnPoints: 0, fails: 0, bannerT: 0, pv: null, holdFly: null, lastC: -1, keyCharge: false, kept: null,
    };
  }
  function setPhase(p) {
    const rd = state.rd;
    rd.phase = p; rd.pt = 0; rd.hint = null; rd.ai = null; rd.beat = null; rd.drag = null; rd.sc = null;
    if (p === 'scatter' || p === 'hold' || p === 'plan' || p === 'kcharge') { if (isWatch()) startBeat(); persistMatch(); }
  }
  // phases that must not persist, restart the beat or touch the computer's plan
  function setPhaseKeep(p) { const rd = state.rd; rd.phase = p; rd.pt = 0; rd.hint = null; }

  function startMatch(cfg) {
    if (state.demo && (cfg.mode === 'cpu' || cfg.mode === 'pass') && state.record.demoMatches >= DEMO_MATCH_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const stage = cfg.mode === 'learn' ? LESSONS[cfg.lesson].stage : 1;
    state.match = { cfg: { mode: 'cpu', lvl: 1, target: 10, ...cfg }, scores: [0, 0], stage: [stage, 1], turn: 0, turns: 0, stats: { kk: [0, 0], best: [1, 1], faults: [0, 0], clears: [0, 0] }, over: null };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    if (state.demo && (cfg.mode === 'cpu' || cfg.mode === 'pass')) { state.record.demoMatches++; saveSettings(); }
    startTurn(0);
  }
  function startTurn(who) {
    const m = state.match;
    m.turn = who;
    newTurnState(who);
    const rd = state.rd;
    if (m.cfg.mode !== 'learn') { rd.banner = { kind: 'turn', text: T('turnStart', { name: nameOf(who) }) }; rd.bannerT = 1.3; }
    beginStage();
  }
  function beginStage() {
    const rd = state.rd, m = state.match;
    rd.stage = m.stage[rd.who]; rd.ri = 0; rd.mat = []; rd.five = []; rd.sel = []; rd.spot = null; rd.held = [0, 1, 2, 3, 4]; rd.hold = 0; rd.picked = [];
    m.stats.best[rd.who] = Math.max(m.stats.best[rd.who], rd.stage);
    if (rd.stage === KKEOKKI) setPhase('kcharge');
    else if (hasScatter(rd.stage)) setPhase('scatter');
    else { setPhase('plan'); beginPlan(); }
  }

  // ---- scatter and hold --------------------------------------------------------------------------------
  function doScatter(sc) {
    const rd = state.rd, m = state.match;
    const cx = clamp(sc.cx, FIELD.x0 + 40, FIELD.x1 - 40), cy = clamp(sc.cy, FIELD.y0 + 40, FIELD.y1 - 40);
    const les = isLearn() ? LESSONS[m.cfg.lesson] : null;
    const five = les && les.fixed ? les.fixed.map((s) => ({ ...s })) : scatterStones(scatRng, cx, cy, clamp(sc.spread, 70, 260));
    five.forEach((s, i) => { s.fly = { t: -0.07 * i, dur: 0.5 + fx.next() * 0.18, x0: HOME.x, y0: HOME.y - 20, sp: (fx.next() - 0.5) * 9 }; });
    rd.five = five; rd.mat = five; rd.held = []; rd.sc = null; rd.drag = null;
    sfx.toss();
    setPhaseKeep('scattering');
  }
  function doHold(id) {
    const rd = state.rd;
    rd.hold = id; rd.held = [id];
    const s = rd.five.find((x) => x.id === id);
    rd.holdFly = { id, x: s.x, y: s.y, rot: s.rot, t: 0 };
    rd.mat = rd.five.filter((x) => x.id !== id);
    sfx.scoop();
    rd.ri = 0; setPhase('plan'); beginPlan();
  }

  // ---- planning a round -----------------------------------------------------------------------------------
  const roundDef = () => STAGES[state.rd.stage - 1].rounds[state.rd.ri];
  function beginPlan(keep) {
    const rd = state.rd;
    if (!keep) { rd.sel = []; rd.spot = null; }
    rd.charge = 0; rd.ev = null; rd.res = null; rd.eps = null; rd.et = 0; rd.catchAt = null; rd.picked = []; rd.pv = null;
    rd.phase = 'plan';
    updatePreview();
  }
  const planOf = (h) => ({ targets: state.rd.sel, spot: state.rd.spot, h });
  const planComplete = () => {
    const rd = state.rd, rdef = roundDef();
    if (rdef.kind === 'take') return rd.sel.length === rdef.take;
    if (rdef.kind === 'set') return !!rd.spot;
    return true;
  };
  function updatePreview() {
    const rd = state.rd, rdef = roundDef();
    if (!rdef) return;
    if (rdef.kind === 'set' && !rd.spot) { rd.pv = null; return; }
    const partial = rdef.kind === 'take' && rd.sel.length < rdef.take;
    const def = partial ? { kind: 'take', take: rd.sel.length } : rdef;
    const plan = planOf(0.6);
    const ev = evaluateRound(rd.mat, def, plan, { ang: 0, u: 0 });
    rd.pv = { ev, need: needTime(rd.mat, def, plan), clip: !!ev.fault, partial };
  }
  function selectStone(id) {
    const rd = state.rd, rdef = roundDef();
    if (rdef.kind !== 'take') return;
    const i = rd.sel.indexOf(id);
    if (i >= 0) rd.sel.splice(i, 1);
    else if (rd.sel.length < rdef.take) rd.sel.push(id);
    else { sfx.no(); return; }
    sfx.tick(); rd.hint = null; updatePreview();
  }
  function setSpot(x, y) { const rd = state.rd; rd.spot = clampSpot(x, y); sfx.tick(); rd.hint = null; updatePreview(); }
  const heightFor = (charge) => clamp(H_MIN + (1 - H_MIN) * clamp(charge / CHARGE_SECS, 0, 1), H_MIN, 1);

  function releaseToss(h) {
    const rd = state.rd, rdef = roundDef();
    rd.h = h; rd.roll = newRoll(rollRng);
    rd.ev = evaluateRound(rd.mat, rdef, planOf(h), rd.roll);
    rd.et = 0; rd.res = null; rd.eps = null; rd.catchAt = null; rd.picked = []; rd.hint = null; rd.trail = [];
    sfx.toss();
    setPhaseKeep('exec');
  }

  // ---- exec: the stone is in the air, the hand works, the player catches ------------------------------------
  const winOf = () => winScale(state.rd.ev.h);
  function tryCatch(eps) {
    const rd = state.rd, ev = rd.ev;
    if (rd.res || ev.fault) return;
    if (eps < -WIN_EARLY * winOf()) return;               // too early: the tap is simply ignored
    rd.eps = eps; rd.catchAt = Math.max(rd.et, ev.tBack);
    finishExec(catchResult(ev, eps));
  }
  function finishExec(res) {
    const rd = state.rd, m = state.match, ev = rd.ev;
    rd.res = res;
    const hp = handAt(ev, rd.catchAt ?? rd.et);
    if (res.ok) {
      sfx.catchOk(res.quality);
      burst(rd, hp.x, hp.y, 10 + res.quality * 8, 1 + res.quality * 0.4);
      if (res.quality >= 2) ring(rd, hp.x, hp.y, 130, '#fff3c4');
      floatText(rd, res.quality >= 2 ? T('perfect') : res.quality === 1 ? T('good') : T('caught'), hp.x, hp.y - 70, res.quality >= 2 ? '#ffe28a' : '#fff6e2');
      applySuccess();
    } else {
      sfx.fault();
      rd.flash = state.settings.calm ? 0 : 0.4;
      const at = res.why === 'clip' ? ev.fault : hp;
      if (!state.settings.calm) ring(rd, at.x, at.y, 90, '#ff8a76');
      floatText(rd, T(`fail_${res.why}`), at.x, Math.min(at.y, 600) - 60, '#ffb09a');
      m.stats.faults[rd.who]++;
      rd.fails++;
    }
    setPhaseKeep('resolve');
    rd.resDur = res.ok ? Math.max(0.9, ev.T - rd.et + 0.65) : Math.max(1.2, ev.T - rd.et + 0.9);
  }
  function applySuccess() {
    const rd = state.rd, rdef = roundDef();
    if (rdef.kind === 'take') { rd.held.push(...rd.sel); rd.mat = rd.mat.filter((s) => !rd.sel.includes(s.id)); }
    else if (rdef.kind === 'set') { rd.mat = clusterAt(rd.spot.x, rd.spot.y, [1, 2, 3, 4]); rd.mat.forEach((s) => { s.drop = { t: 0 }; }); rd.held = [0]; }
    else { rd.held.push(...rd.mat.map((s) => s.id)); rd.mat = []; }
  }
  function afterResolve() {
    const rd = state.rd, m = state.match;
    if (!rd.res.ok) { turnOver('fault'); return; }
    const rounds = STAGES[rd.stage - 1].rounds;
    if (rd.ri + 1 < rounds.length) { rd.ri++; setPhase('plan'); beginPlan(); return; }
    m.stats.clears[rd.who]++;
    sfx.clear();
    for (let i = 0; i < 24; i++) burst(rd, 120 + fx.next() * 420, 100 + fx.next() * 200, 1, 0.5, 'petal');
    rd.banner = { kind: 'clear', text: T('stageClear', { n: rd.stage }) }; rd.bannerT = 1.5;
    m.stage[rd.who] = m.stage[rd.who] + 1;
    if (isLearn()) { setPhaseKeep('lessonclear'); return; }
    setPhaseKeep('stageclear');
  }

  // ---- kkeokki -----------------------------------------------------------------------------------------------
  function kTossNow(h) {
    const rd = state.rd;
    rd.h = h; rd.kk = kkToss(h, rollRng); rd.et = 0; rd.kh = null; rd.kres = null; rd.hint = null; rd.trail = [];
    sfx.toss();
    setPhaseKeep('kflight');
  }
  function kCatch(tx_, ty_) {
    const rd = state.rd;
    if (rd.kres) return;
    const r = kkCatch(rd.kk, rd.et, tx_, ty_);
    const n = r.caught.length;
    rd.kres = { ...r, x: tx_, y: ty_, tau: rd.et, n };
    if (n) { sfx.catchOk(n >= 4 ? 2 : 1); burst(rd, tx_, ty_, 8 + n * 4, 1.1); ring(rd, tx_, ty_, KK.Rb + 30, '#fff3c4'); } else sfx.fault();
    floatText(rd, n ? T('kkCaught', { n }) : T('kkNone'), tx_, ty_ - 80, n ? '#ffe28a' : '#ffb09a');
    rd.kh = null;
    setPhaseKeep('kcatch');
  }
  function kFlickStart() {
    const rd = state.rd;
    rd.et = 0; rd.eps = null; rd.kept = null; sfx.toss();
    setPhaseKeep('kflick');
  }
  function kFlickTap(eps) {
    const rd = state.rd;
    rd.eps = eps; rd.kept = flickKept(rd.kres.n, eps);
    sfx.catchOk(rd.kept >= rd.kres.n ? 2 : 1);
    burst(rd, rd.kres.x, rd.kres.y, 10, 1);
    floatText(rd, rd.kept ? T('kkKept', { n: rd.kept }) : T('kkNone'), rd.kres.x, rd.kres.y - 80, rd.kept ? '#ffe28a' : '#ffb09a');
    setPhaseKeep('kresult');
  }
  function afterKk(points) {
    const rd = state.rd, m = state.match;
    m.stats.kk[rd.who] = Math.max(m.stats.kk[rd.who], points);
    if (isLearn()) {
      if (points > 0) { m.stage[rd.who] = KKEOKKI + 1; setPhaseKeep('lessonclear'); } else learnRetry();
      return;
    }
    m.scores[rd.who] += points; rd.turnPoints = points;
    if (rd.who === 0 && m.cfg.mode !== 'watch') state.record.kkBest = Math.max(state.record.kkBest, points);
    m.stage[rd.who] = 1;
    turnOver('kk');
  }

  // ---- ending a turn and the match ---------------------------------------------------------------------------
  function learnRetry() {
    const rd = state.rd;
    rd.banner = { kind: 'retry', text: T('tryAgain') }; rd.bannerT = 1.4;
    setPhaseKeep('learnretry');
  }
  function turnOver(why) {
    const rd = state.rd;
    if (isLearn()) { learnRetry(); return; }
    const pts = rd.turnPoints;
    rd.banner = { kind: 'end', text: why === 'kk' ? T(pts ? 'turnKk' : 'turnKk0', { n: pts, name: nameOf(rd.who) }) : T('turnFault', { name: nameOf(rd.who), stage: rd.stage }) };
    rd.bannerT = 2.2;
    setPhaseKeep('turnend');
  }
  function afterTurnEnd() {
    const m = state.match;
    if (m.turn === 1) {
      m.turns++;
      const hit = m.scores[0] >= m.cfg.target || m.scores[1] >= m.cfg.target;
      if (hit && m.scores[0] !== m.scores[1]) { endMatch(m.scores[0] > m.scores[1] ? 0 : 1); return; }
    }
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
    if (!rd || actorIsAI()) return;
    const L = lang();
    if (rd.phase === 'scatter') { rd.hint = { kind: 'scatter', cx: HOME.x, cy: 360, spread: 150, text: explainScatter(L), t: 0 }; return; }
    if (rd.phase === 'hold') { const ch = chooseHold(rd.five, rd.stage, PERFECT, aiRng); rd.hint = { kind: 'hold', id: ch.id, text: explainHold(L, rd.five, ch), t: 0 }; return; }
    if (rd.phase === 'plan') {
      const rdef = roundDef();
      const ranked = rankPlans(rd.mat, rdef, PERFECT);
      rd.hint = { kind: 'plan', plan: ranked[0], text: explainPlan(L, rd.mat, rdef, ranked[0], ranked), t: 0 };
      return;
    }
    if (rd.phase === 'kcharge') { rd.hint = { kind: 'kcharge', h: PERFECT.hold, text: explainKkCharge(L), t: 0 }; return; }
    if (rd.phase === 'kflight') { const b = kkBest(rd.kk); rd.hint = { kind: 'kflight', best: b, text: explainKkTap(L, b), t: 0 }; }
  }
  const hintAllowed = () => { const p = state.rd && state.rd.phase; return ['scatter', 'hold', 'plan', 'kcharge', 'kflight'].includes(p); };

  // ---- the computer's hand (and Watch & Learn's beats) ------------------------------------------------------------
  function startBeat() {
    const rd = state.rd;
    if (!isWatch()) return;
    const think = THINK_STEPS[state.settings.thinkIdx];
    rd.beat = { phase: 'think', t: 0, dur: rd.phase === 'scatter' || rd.phase === 'hold' ? Math.max(1.5, think * 0.6) : think, reason: '' };
  }
  function prepareAi() {
    const rd = state.rd, lvl = levelOf(rd.who);
    const a = { t: 0 };
    rd.ai = a;
    if (rd.phase === 'scatter') { a.sc = scatterChoice(lvl, aiRng, rd.stage); a.reason = explainScatter(lang()); }
    else if (rd.phase === 'hold') { const ch = chooseHold(rd.five, rd.stage, lvl, aiRng); a.hold = ch.id; a.reason = explainHold(lang(), rd.five, ch); }
    else if (rd.phase === 'plan') {
      const rdef = roundDef();
      const ranked = rankPlans(rd.mat, rdef, PERFECT);
      const plan = planRound(rd.mat, rdef, lvl, aiRng);
      a.plan = plan; a.h = executeHeight(plan.h, lvl, aiRng); a.reason = explainPlan(lang(), rd.mat, rdef, plan, ranked);
      const seen = new Set();
      a.cands = ranked.filter((r) => { const k = r.targets ? r.targets.join() : r.spot ? `${r.spot.x}` : 'x'; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 4);
    } else if (rd.phase === 'kcharge') { a.h = kkHeight(lvl, aiRng); a.reason = explainKkCharge(lang()); }
  }
  function aiTick(dt) {
    const rd = state.rd;
    const lvl = levelOf(rd.who);
    if (!rd.ai && ['scatter', 'hold', 'plan', 'kcharge'].includes(rd.phase)) prepareAi();
    const a = rd.ai;
    if (!a) return;
    // Watch & Learn: think, then reveal, then act
    if (rd.beat && rd.beat.phase !== 'act') {
      const b = rd.beat;
      b.t += dt;
      if (b.phase === 'think') {
        if (b.t >= b.dur) {
          b.phase = 'reveal'; b.t = 0; b.dur = REVEAL_SECS; sfx.tick(); b.reason = a.reason;
          if (rd.phase === 'plan') { rd.sel = a.plan.targets ? [...a.plan.targets] : []; rd.spot = a.plan.spot ?? null; updatePreview(); }
          if (rd.phase === 'scatter') rd.sc = { ...a.sc };
        }
      } else if (b.t >= b.dur) { b.phase = 'act'; b.t = 0; sfx.tick(); }
      return;
    }
    a.t += dt;
    switch (rd.phase) {
      case 'scatter':
        if (a.t > 0.4) rd.sc = { ...a.sc };
        if (a.t > 1.2) doScatter(a.sc);
        break;
      case 'hold':
        if (a.t > 0.8) doHold(a.hold);
        break;
      case 'plan': {
        const rdef = roundDef();
        const sec = 0.45;
        if (!rd.beat) {
          if (rdef.kind === 'take') { const n = Math.min(rdef.take, Math.floor(a.t / sec)); while (rd.sel.length < n) { rd.sel.push(a.plan.targets[rd.sel.length]); sfx.tick(); updatePreview(); } }
          else if (rdef.kind === 'set' && !rd.spot && a.t > 0.5) { rd.spot = a.plan.spot; sfx.tick(); updatePreview(); }
        }
        const tPick = rd.beat ? 0.2 : (rdef.kind === 'take' ? rdef.take * sec + 0.35 : 0.9);
        if (a.t > tPick) {
          if (!a.charging) { a.charging = true; a.c0 = a.t; a.cTarget = (a.h - H_MIN) / (1 - H_MIN) * CHARGE_SECS; }
          rd.charge = Math.min(a.cTarget, a.t - a.c0);
          if (Math.floor(rd.charge * 20) !== a.lastC) { a.lastC = Math.floor(rd.charge * 20); sfx.charge(heightFor(rd.charge)); }
          if (rd.charge >= a.cTarget - 1e-6) {
            const eps = executeEps(a.h, lvl, aiRng);
            releaseToss(heightFor(rd.charge));
            rd.ai = { t: 0, eps };
          }
        }
        break;
      }
      case 'exec': {
        const ev = rd.ev;
        if (rd.ai && !rd.res && !ev.fault && rd.et >= Math.max(ev.T + rd.ai.eps, ev.tBack)) tryCatch(rd.et - ev.T);
        break;
      }
      case 'kcharge':
        if (a.t > 0.5) {
          if (!a.charging) { a.charging = true; a.c0 = a.t; a.cTarget = (a.h - H_MIN) / (1 - H_MIN) * CHARGE_SECS; }
          rd.charge = Math.min(a.cTarget, a.t - a.c0);
          if (rd.charge >= a.cTarget - 1e-6) { kTossNow(heightFor(rd.charge)); rd.ai = { t: 0, tap: kkTap(rd.kk, lvl, aiRng), hx: HOME.x, hy: HOME.y - 100 }; }
        }
        break;
      case 'kflight': {
        const k = rd.ai;
        if (k && k.tap) {
          const tp = k.tap;
          const lead = clamp((rd.et - 0.15) / Math.max(0.2, tp.t - 0.15), 0, 1);
          rd.kh = { x: k.hx + (tp.x - k.hx) * lead, y: k.hy + (tp.y - k.hy) * lead, down: true };
          if (rd.et >= tp.t) kCatch(tp.x, tp.y);
        }
        break;
      }
      case 'kflick': {
        if (!a.flick) a.flick = { eps: (aiRng.next() + aiRng.next() - 1) * lvl.flickT * 1.7 };
        if (rd.et >= FLICK_T + a.flick.eps) kFlickTap(rd.et - FLICK_T);
        break;
      }
      default: break;
    }
  }

  // ---- the play scene ---------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; persistMatch(); };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leaveMatch = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.rd = null; };
  const inWorldView = (L, x, y) => inRect(L.world, x, y);
  const padHit = (L, x, y) => inRect(L.pad, x, y);
  const buttonHit = (L, x, y) => inRect(L.think, x, y) || inRect(L.clear, x, y) || inRect(L.pause, x, y) || inRect(L.hudRect, x, y) || (isWatch() && (inRect(L.watch.dec, x, y) || inRect(L.watch.inc, x, y) || inRect(L.watch.exit, x, y) || inRect(L.watch.pause, x, y)));
  const nearest = (list, wp) => { let best = null, bd = R * 1.9; for (const s of list) { const d = dist(wp.x, wp.y, s.x, s.y); if (d < bd) { bd = d; best = s; } } return best; };
  const chargeTick = (rd, dt, held) => {
    rd.charge = Math.min(CHARGE_SECS, rd.charge + dt);
    if (Math.floor(rd.charge * 20) !== rd.lastC) { rd.lastC = Math.floor(rd.charge * 20); sfx.charge(heightFor(rd.charge)); }
    return held;
  };

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
        if (inRect(L.clear, ptr.x, ptr.y) && !ai && rd.phase === 'plan') { rd.sel = []; rd.spot = null; rd.hint = null; updatePreview(); sfx.tick(); }
      }
    }
    if (state.paused) return;
    if (keys.pressed.has('KeyH') && !ai && hintAllowed()) requestHint();
    // ---- human input per phase
    const human = !ai && !state.shot;
    const sceneTap = ptr.pressed && !buttonHit(L, ptr.x, ptr.y);
    if (human && rd.banner && rd.banner.kind === 'turn' && ptr.pressed && rd.bannerT < 0.9) rd.bannerT = 0;
    if (human) {
      switch (rd.phase) {
        case 'scatter': {
          if (sceneTap && inWorldView(L, ptr.x, ptr.y)) { rd.drag = { cx: clamp(wp.x, FIELD.x0 + 40, FIELD.x1 - 40), cy: clamp(wp.y, FIELD.y0 + 40, FIELD.y1 - 40) }; rd.sc = { cx: rd.drag.cx, cy: rd.drag.cy, spread: 150 }; }
          if (rd.drag && ptr.down) { const d = dist(wp.x, wp.y, rd.drag.cx, rd.drag.cy); rd.sc.spread = d < 26 ? 150 : clamp(d, 80, 260); }
          if (rd.drag && (ptr.released || !ptr.down)) { const sc = rd.sc; rd.drag = null; doScatter(sc); }
          else if (!rd.drag && (keys.pressed.has('Enter') || keys.pressed.has('Space'))) doScatter({ cx: HOME.x, cy: 360, spread: 150 });
          break;
        }
        case 'hold':
          if (sceneTap && inWorldView(L, ptr.x, ptr.y)) { const b = nearest(rd.five, wp); if (b) doHold(b.id); }
          break;
        case 'plan': {
          const rdef = roundDef();
          if (sceneTap && inWorldView(L, ptr.x, ptr.y)) {
            if (rdef.kind === 'take') { const b = nearest(rd.mat, wp); if (b) selectStone(b.id); }
            else if (rdef.kind === 'set') setSpot(wp.x, wp.y);
          }
          const startKey = keys.pressed.has('Space');
          if ((ptr.pressed && padHit(L, ptr.x, ptr.y)) || startKey) {
            if (planComplete()) { rd.phase = 'charge'; rd.pt = 0; rd.charge = 0; rd.keyCharge = startKey; rd.hint = null; }
            else { sfx.no(); toast(T('needPlan'), 1.8); }
          }
          break;
        }
        case 'charge': {
          const held = chargeTick(rd, dt, rd.keyCharge ? keys.down.has('Space') : ptr.down);
          if (!held) releaseToss(heightFor(rd.charge));
          break;
        }
        case 'exec':
          if ((ptr.pressed && !buttonHit(L, ptr.x, ptr.y)) || keys.pressed.has('Space')) tryCatch(rd.et - rd.ev.T);
          break;
        case 'kcharge':
          if ((ptr.pressed && padHit(L, ptr.x, ptr.y)) || keys.pressed.has('Space')) { rd.phase = 'kcharging'; rd.charge = 0; rd.keyCharge = keys.pressed.has('Space'); rd.hint = null; }
          break;
        case 'kcharging': {
          const held = chargeTick(rd, dt, rd.keyCharge ? keys.down.has('Space') : ptr.down);
          if (!held) kTossNow(heightFor(rd.charge));
          break;
        }
        case 'kflight': {
          if (ptr.pressed && !buttonHit(L, ptr.x, ptr.y)) rd.kh = { x: wp.x, y: wp.y, down: true };
          if (rd.kh && ptr.down) { rd.kh.x = wp.x; rd.kh.y = wp.y; }
          if (rd.kh && (ptr.released || !ptr.down)) kCatch(rd.kh.x, rd.kh.y);
          else if (keys.pressed.has('Space')) kCatch(rd.kh ? rd.kh.x : HOME.x, rd.kh ? rd.kh.y : HOME.y - 100);
          break;
        }
        case 'kflick':
          if ((ptr.pressed && !buttonHit(L, ptr.x, ptr.y)) || keys.pressed.has('Space')) kFlickTap(rd.et - FLICK_T);
          break;
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
    for (const s of rd.mat) {
      if (s.fly) { s.fly.t += dt; if (s.fly.t >= s.fly.dur) { burst(rd, s.x, s.y, 3, 0.35, 'dust'); sfx.clack(0.6); delete s.fly; } }
      if (s.drop) { s.drop.t += dt; if (s.drop.t > 0.4) delete s.drop; }
      if (s.knock) s.knock.t += dt;
    }
    if (rd.holdFly) { rd.holdFly.t += dt; if (rd.holdFly.t > 0.35) rd.holdFly = null; }
    // the computer waits for the turn banner
    const waiting = rd.banner && rd.banner.kind === 'turn' && rd.bannerT > 0;
    if (ai && !waiting && ['scatter', 'hold', 'plan', 'exec', 'kcharge', 'kflight', 'kflick'].includes(rd.phase)) aiTick(dt);
    switch (rd.phase) {
      case 'scattering': if (rd.mat.every((s) => !s.fly)) setPhase('hold'); break;
      case 'exec': updateExec(dt); break;
      case 'resolve': rd.et += dt; trail(rd); if (rd.pt >= rd.resDur) afterResolve(); break;
      case 'kflight': {
        rd.et += dt; trail(rd);
        const tMax = Math.max(...rd.kk.stones.map((s) => s.T)) + 0.12;
        if (rd.et > tMax && !rd.kres) kCatch(rd.kh ? rd.kh.x : HOME.x, rd.kh ? rd.kh.y : HOME.y - 100);
        break;
      }
      case 'kcatch':
        rd.et += dt;
        if (rd.pt >= 1.15) { if (rd.kres.n > 0) { kFlickStart(); if (ai) rd.ai = { t: 0 }; } else afterKk(0); }
        break;
      case 'kflick':
        rd.et += dt;
        if (rd.et > FLICK_T + 0.3 && rd.eps === null) { rd.kept = 0; floatText(rd, T('kkNone'), rd.kres.x, rd.kres.y - 80, '#ffb09a'); sfx.fault(); setPhaseKeep('kresult'); }
        break;
      case 'kresult': rd.et += dt; if (rd.pt >= 1.2) afterKk(rd.kept ?? 0); break;
      case 'stageclear': if (rd.pt >= 1.5) beginStage(); break;
      case 'turnend': if (rd.pt >= 2.2 || (human && ptr.pressed && rd.pt > 0.6 && !buttonHit(L, ptr.x, ptr.y))) afterTurnEnd(); break;
      case 'learnretry': if (rd.pt >= 1.4) { m.stage[rd.who] = LESSONS[m.cfg.lesson].stage; beginStage(); } break;
      case 'lessonclear':
        if (rd.pt >= 1.5) { state.record.lessons[m.cfg.lesson] = true; saveSettings(); state.scene = 'result'; state.ui.scroll = 0; m.over = { win: 0, lesson: true }; }
        break;
      default: break;
    }
  };
  function trail(rd) {
    if (rd.ev) { const hp = handAt(rd.ev, rd.et); rd.trail.push({ x: hp.x, y: hp.y }); if (rd.trail.length > 14) rd.trail.shift(); }
  }
  function updateExec(dt) {
    const rd = state.rd, ev = rd.ev;
    rd.et += dt; trail(rd);
    const prev = rd.et - dt;
    for (const p of ev.picks) if (prev < p.t && rd.et >= p.t) { sfx.scoop(); const s = rd.mat.find((x) => x.id === p.id); if (s) { burst(rd, s.x, s.y, 4, 0.5, 'dust'); rd.picked.push(p.id); } }
    if (ev.cluster && prev < ev.cluster.t && rd.et >= ev.cluster.t) { sfx.clack(); burst(rd, ev.cluster.x, ev.cluster.y, 8, 0.6, 'dust'); }
    if (ev.fault && !rd.res && rd.et >= ev.fault.t + 0.05) {
      const fs = rd.mat.find((s) => s.id === ev.fault.id);
      if (fs) { fs.knock = { t: 0 }; burst(rd, fs.x, fs.y, 12, 1, 'dust'); ring(rd, fs.x, fs.y, 90, '#ff9a86'); }
      rd.catchAt = rd.et;
      finishExec({ ok: false, why: 'clip', quality: 0 });
      return;
    }
    if (!rd.res && rd.et > ev.T + WIN_LATE * winOf()) finishExec(catchResult(ev, null));
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
  const setLang = (l) => { state.settings.lang = l; state.ui.scroll = 0; state.page = 0; saveSettings(); };
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'continue') resumeMatch();
    else if (id === 'play') { state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'learn') { state.scene = 'lessons'; state.ui.scroll = 0; }
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'lang:en') setLang('en');
    else if (id === 'lang:ko') setLang('ko');
  };
  function startWatch() {
    const pairs = [[2, 3], [3, 4], [1, 3], [2, 4]];
    const p = pairs[aiRng.int(pairs.length)];
    startMatch({ mode: 'watch', lvlA: p[0], lvl: p[1], target: 5 });
  }
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id === 'opp-cpu') s.opp = 'cpu';
    else if (id === 'opp-pass') s.opp = 'pass';
    else if (id.startsWith('lvl')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = T('inFull'); return; } s.lvl = i; state.setupMsg = ''; }
    else if (id.startsWith('tgt')) s.target = Number(id.slice(3));
    else if (id === 'start') startMatch({ mode: s.opp, lvl: s.lvl, target: s.target });
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
    if (id === 'start') startMatch({ mode: 'learn', lesson: state.lessonSel, target: 99 });
    else if (id === 'back') { state.scene = 'lessons'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-calm') st.calm = !st.calm;
    else if (id === 'lang:en') setLang('en');
    else if (id === 'lang:ko') setLang('ko');
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
    if (wheelInput.dy) { state.ui.scroll = clamp(state.ui.scroll + wheelInput.dy, 0, max); wheelInput.dy = 0; }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };
  const updatePinned = (dt, input, handler, key) => {
    const ptr = state.shot ? neutral : input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handler('start'); return; }
    if (k.pressed.has('Escape')) { handler('back'); return; }
    const P = setupPins();
    if (ptr.pressed && (inRect(P.start, ptr.x, ptr.y) || inRect(P.back, ptr.x, ptr.y))) { handler(inRect(P.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handler, key);
  };
  const updatePages = (input) => {
    const ptr = state.shot ? neutral : input.pointer, keys = input.keys;
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.page = 0; state.ui.scroll = 0; state.ui.drag = null; };
    const setScroll = (v) => { state.ui.scroll = clamp(v, 0, READER.max); };
    const RL = refLayout();
    if (ptr.pressed) {
      if (inRect(refCloseRect(), ptr.x, ptr.y)) { close(); return; }
      else if (inRect(RL.dec, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); saveSettings(); }
      else if (inRect(RL.inc, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); saveSettings(); }
      else if (ptr.y >= READER.y0 && ptr.y <= READER.y1) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll };
    }
    if (state.ui.drag && ptr.down) setScroll(state.ui.drag.s0 - (ptr.y - state.ui.drag.y0));
    if (ptr.released) state.ui.drag = null;
    if (wheelInput.dy) { setScroll(state.ui.scroll + wheelInput.dy); wheelInput.dy = 0; }
    const step = 70, pgs = Math.max(100, READER.view - 80);
    if (keys.pressed.has('ArrowDown')) setScroll(state.ui.scroll + step);
    if (keys.pressed.has('ArrowUp')) setScroll(state.ui.scroll - step);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) setScroll(state.ui.scroll + pgs);
    if (keys.pressed.has('PageUp')) setScroll(state.ui.scroll - pgs);
    if (keys.pressed.has('Home')) setScroll(0);
    if (keys.pressed.has('End')) setScroll(READER.max);
    if (keys.pressed.has('Escape') || keys.pressed.has('Enter')) close();
  };

  // ---- the attract mat behind the title: a computer hand playing stage 1 over and over ----------------------------------
  function startAttract() {
    const five = scatterStones(scatRng.fork(), HOME.x + (fx.next() - 0.5) * 60, 340, 170);
    const hold = fx.int(5);
    const mat = five.filter((s) => s.id !== hold);
    const rdef = STAGES[0].rounds[0];
    const plan = planRound(mat, rdef, LEVELS[3], aiRng.fork());
    const ev = evaluateRound(mat, rdef, { targets: plan.targets, h: Math.max(0.55, plan.h) }, newRoll(rollRng.fork()));
    state.att = { mat, hold, ev, et: -0.8, trail: [], parts: [], picked: [], floats: [] };
  }
  function updateAttract(dt) {
    const a = state.att;
    if (!a) return;
    a.et += dt;
    if (a.et > 0 && a.et < a.ev.T + 0.3) { const hp = handAt(a.ev, a.et); a.trail.push({ x: hp.x, y: hp.y }); if (a.trail.length > 14) a.trail.shift(); } else if (a.trail.length) a.trail.shift();
    const prev = a.et - dt;
    for (const p of a.ev.picks) if (prev < p.t && a.et >= p.t) { const s = a.mat.find((x) => x.id === p.id); a.picked.push(p.id); if (s) burst(a, s.x, s.y, 3, 0.4, 'dust'); }
    if (prev < a.ev.T && a.et >= a.ev.T && !a.ev.fault) { const hp = handAt(a.ev, a.et); burst(a, hp.x, hp.y, 10, 1); }
    stepParts(a.parts, dt);
    if (a.et > a.ev.T + 1.6) startAttract();
  }
  startAttract();

  // ---- staged moments for store screenshots (?shot=1&seed=800001..) --------------------------------------------------------
  function stageShot(n) {
    const cfgBase = { mode: 'cpu', lvl: 2, target: 10 };
    const go = (cfg, setup) => { startMatch(cfg); state.rd.banner = null; state.rd.bannerT = 0; if (setup) setup(state.rd); state.freeze = true; };
    const withMat = (rd, stage, ri, c) => {
      rd.stage = stage; state.match.stage[0] = stage; rd.ri = ri;
      const five = scatterStones(scatRng.fork(), c?.cx ?? 330, c?.cy ?? 360, c?.spread ?? 160);
      rd.five = five; rd.hold = 2; rd.mat = five.filter((s) => s.id !== 2); rd.held = [2];
      rd.phase = 'plan'; beginPlan();
    };
    state.settings.lang = 'en';
    if (n === 1) state.scene = 'title';
    else if (n === 2) go(cfgBase, (rd) => { withMat(rd, 2, 0); rd.sel = rankPlans(rd.mat, STAGES[1].rounds[0], PERFECT)[0].targets; updatePreview(); });
    else if (n === 3) go(cfgBase, (rd) => { withMat(rd, 3, 0); rd.sel = rankPlans(rd.mat, STAGES[2].rounds[0], PERFECT)[0].targets; updatePreview(); requestHint(); });
    else if (n === 4) go(cfgBase, (rd) => {
      withMat(rd, 1, 1);
      const rdef = STAGES[0].rounds[1]; const best = rankPlans(rd.mat, rdef, PERFECT)[0];
      rd.sel = best.targets; rd.h = 0.7; rd.roll = { ang: 1.0, u: 0.7 };
      rd.ev = evaluateRound(rd.mat, rdef, { targets: rd.sel, h: 0.7 }, rd.roll); rd.et = rd.ev.T * 0.52; rd.picked = [rd.sel[0]]; rd.phase = 'exec';
      for (let k = 0; k < 14; k++) { const hp = handAt(rd.ev, rd.et - (14 - k) * 0.02); rd.trail.push({ x: hp.x, y: hp.y }); }
    });
    else if (n === 5) go(cfgBase, (rd) => {
      rd.stage = 5; state.match.stage[0] = 5; rd.held = [0, 1, 2, 3, 4]; rd.phase = 'kflight'; rd.et = 0.62;
      rd.kk = kkToss(0.55, rollRng.fork()); const b = kkBest(rd.kk); rd.kh = { x: b.x, y: b.y, down: true };
    });
    else if (n === 6) go({ mode: 'watch', lvlA: 3, lvl: 4, target: 5 }, (rd) => {
      withMat(rd, 2, 0); const ranked = rankPlans(rd.mat, STAGES[1].rounds[0], PERFECT); rd.sel = ranked[0].targets; updatePreview();
      rd.beat = { phase: 'reveal', t: 0.8, dur: 2, reason: explainPlan('en', rd.mat, STAGES[1].rounds[0], ranked[0], ranked) }; rd.ai = { t: 0, plan: ranked[0], h: ranked[0].h };
    });
    else if (n === 7) state.scene = 'setup';
    else if (n === 8) go(cfgBase, (rd) => { withMat(rd, 4, 0); rd.mat = []; rd.hold = 0; rd.held = [0, 1, 2, 3, 4]; rd.spot = clampSpot(200, 440); beginPlan(true); });
    else if (n === 9) go(cfgBase, (rd) => {
      rd.stage = 5; state.match.stage[0] = 5; rd.held = [0, 1, 2, 3, 4]; rd.phase = 'kcatch'; rd.pt = 0.5;
      const toss = kkToss(0.55, rollRng.fork()); rd.kk = toss; const b = kkBest(toss);
      rd.kres = { ...kkCatch(toss, b.t, b.x, b.y), x: b.x, y: b.y, tau: b.t }; rd.kres.n = rd.kres.caught.length; rd.et = b.t + 0.45;
      burst(rd, b.x, b.y, 18, 1.1); ring(rd, b.x, b.y, KK.Rb + 30, '#fff3c4'); floatText(rd, T('kkCaught', { n: rd.kres.n }), b.x, b.y - 80, '#ffe28a'); rd.floats[0].t = 0.2;
    });
    else if (n === 10) { state.settings.lang = 'ko'; state.scene = 'title'; }
    else if (n === 11) { state.scene = 'lessonintro'; state.lessonSel = 2; }
    else if (n === 12) go(cfgBase, (rd) => { withMat(rd, 1, 0, { cx: 330, cy: 340, spread: 170 }); rd.mat = rd.five; rd.held = []; rd.hold = -1; rd.phase = 'hold'; });
    else if (n === 13) { state.scene = 'about'; state.back = 'title'; }
    else if (n === 15) { state.settings.textIdx = 4; go(cfgBase, (rd) => { withMat(rd, 3, 0); rd.sel = rankPlans(rd.mat, STAGES[2].rounds[0], PERFECT)[0].targets; updatePreview(); }); }
    else if (n === 16) { state.settings.textIdx = 4; state.scene = 'title'; }
    else if (n === 17) { state.settings.textIdx = 4; state.scene = 'rules'; state.back = 'title'; state.ui.scroll = 1500; }
    else if (n === 18) { state.scene = 'rules'; state.back = 'title'; state.ui.scroll = 5000; }
    else if (n === 19) { go(cfgBase, () => {}); state.match.scores = [10, 7]; state.match.turns = 6; state.match.stats.kk = [4, 3]; state.match.over = { win: 0 }; state.scene = 'result'; }
    else if (n === 20) { state.settings.textIdx = 4; go(cfgBase, (rd) => { withMat(rd, 2, 0); }); state.paused = true; state.pauseMenu = true; }
    else if (n === 21) { state.settings.lang = 'ko'; state.scene = 'rules'; state.back = 'title'; state.ui.scroll = 3000; }
    else if (n === 22) { state.settings.textIdx = 4; state.scene = 'settings'; }
    else if (n === 23) { state.settings.textIdx = 4; state.scene = 'setup'; }
    else if (n === 24) go(cfgBase, (rd) => { // a fault: the route brushes a stone
      withMat(rd, 3, 0, { cx: 330, cy: 380, spread: 90 });
      const rdef = STAGES[2].rounds[0]; const ids = rd.mat.map((s) => s.id).slice(0, 3); rd.sel = ids; rd.h = 0.7; rd.roll = { ang: 1, u: 0.5 };
      rd.ev = evaluateRound(rd.mat, rdef, { targets: ids, h: 0.7 }, rd.roll); rd.phase = 'exec';
      if (rd.ev.fault) { rd.et = rd.ev.fault.t + 0.15; const fs = rd.mat.find((s) => s.id === rd.ev.fault.id); fs.knock = { t: 0.2 }; rd.res = { ok: false, why: 'clip' }; rd.phase = 'resolve'; rd.resDur = 2; floatText(rd, T('fail_clip'), rd.ev.fault.x, rd.ev.fault.y - 60, '#ffb09a'); rd.floats[0].t = 0.3; }
    });
    else if (n === 25) go(cfgBase, (rd) => { rd.stage = 1; rd.phase = 'scattering'; const five = scatterStones(scatRng.fork(), 330, 360, 170); five.forEach((s, i) => { s.fly = { t: 0.2 - 0.05 * i, dur: 0.6, x0: HOME.x, y0: HOME.y - 20, sp: 3 }; }); rd.five = five; rd.mat = five; rd.held = []; });
    else if (n === 26) go(cfgBase, (rd) => { rd.stage = 5; state.match.stage[0] = 5; rd.phase = 'kflick'; rd.et = 0.3; const toss = kkToss(0.55, rollRng.fork()); rd.kk = toss; const b = kkBest(toss); rd.kres = { ...kkCatch(toss, b.t, b.x, b.y), x: b.x, y: b.y, tau: b.t }; rd.kres.n = rd.kres.caught.length; rd.eps = null; });
    else if (n === 27) go(cfgBase, (rd) => { withMat(rd, 1, 0); rd.phase = 'charge'; rd.charge = 0.6; rd.sel = [rd.mat[0].id]; updatePreview(); });
    else if (n === 14) { state.settings.lang = 'ko'; go(cfgBase, (rd) => { withMat(rd, 2, 0); rd.sel = rankPlans(rd.mat, STAGES[1].rounds[0], PERFECT)[0].targets; updatePreview(); }); }
  }
  if (shotSeed) stageShot(shotSeed);

  // ---- the object the kit drives --------------------------------------------------------------------------------------------
  return {
    // Watch & Learn, Learn and every menu are free; only real play counts against the free preview (a paused match,
    // the computer's own turn and the banners between turns do not).
    isPreviewExempt: () => {
      if (state.scene !== 'play' || !state.match || !state.rd) return true;
      const c = state.match.cfg.mode;
      if (c === 'watch' || c === 'learn') return true;
      if (state.paused) return true;
      if (c === 'cpu' && state.match.turn === 1) return true;
      return ['turnend', 'stageclear'].includes(state.rd.phase);
    },
    update(dt, input0) {
      setScreen(meta.width, meta.height);
      const input = state.shot ? { pointer: neutral, keys: { down: new Set(), pressed: new Set() } } : input0;
      setPress(input.pointer);
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
      wheelInput.dy = 0;
    },
    render(ctx) {
      setScreen(meta.width, meta.height);
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'lessons': renderLessons(ctx, state); break;
        case 'lessonintro': renderLessonIntro(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'result': renderResult(ctx, state, { nameOf }); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, pagesFor(lang(), 'howto'), T('howtoTitle')); break;
        case 'about': renderPages(ctx, state, pagesFor(lang(), 'about'), T('aboutTitle')); break;
        case 'rules': renderPages(ctx, state, pagesFor(lang(), 'rules'), T('rulesTitle')); break;
        case 'play':
          if (state.match && state.rd) renderPlay(ctx, state, { levelOf, nameOf, roundDef, heightFor, actorIsAI, isWatch, isLearn, planComplete });
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    lockupZone: () => lockupZone(),
  };
}
