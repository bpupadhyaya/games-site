// Oche Darts 501: state and flow. Rules live in engine.js, the opponents in ai.js, the throw model in aim.js, drawing in
// view.js / menus.js / art.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto / about / rules, demolimit.
// Throwing: touch and hold in the play area, the aim point sways (tightens, then tires), release to throw.
import { W, H, BOARD, PX_PER_MM, AIM, THINK_BTN, MENU_BTN, WATCH, inRect, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, TEXT_SCALES, THINK_STEPS, REVEAL_SECS, SETUP_PINS } from './layout.js';
import { hitAt, wireDistance, newMatch, applyDart, closeVisit, nextTurn, winLeg, startNextLeg, dartsLeft, suggest, bestRoute, targetByLabel } from './engine.js';
import { PROFILES, skillTable, chooseAim, explain, throwAt, newVisitBias, newForm, gauss } from './ai.js';
import { ASSIST, swayAmp, swayOffset, spreadSigma, steadiness, tired } from './aim.js';
import { renderPlay } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, hitScreen, flowMeta, pageCount, ensureLayout } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export const meta = { width: W, height: H };
const DEMO_LEG_CAP = 2;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_PARTS = 170;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const hand = rng.fork();
  const aiR = rng.fork();
  const rn = () => aiR.next();
  const hn = () => hand.next();
  let shotMode = false;
  try { shotMode = /[?&]shot=/.test(globalThis.location.search); } catch { shotMode = false; }
  const shotSeed = config.seed | 0;

  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, assist: 1, coach: true, textIdx: 0, thinkIdx: 1 },
    record: { wins: [0, 0, 0, 0, 0], played: 0, legs: 0, hi: 0, c180: 0, bestOut: 0, demoLegs: 0, thrown: 0 },
    setup: { mode: 'ai', opp: 0, start: 501, legs: 2 }, setupMsg: '', restoreMsg: '',
    ui: { scroll: 0, drag: null }, page: 0, resume: null, loaded: false,
    m: null, phase: 'ready', pt: 0, humanTurn: false, aim: null, reticle: null, flight: null, darts: [], parts: [], pops: [],
    banner: null, flash: null, hint: null, think: null, shake: null, toast: '', toastT: 0, bustShake: 0, lastVisit: [undefined, undefined],
    coachRoute: null, pickup: false, att: { darts: [], wait: 1.4, n: 0, parts: [] }, kb: { x: 360, y: BOARD.cy }, shot: false, ai: { form: [1, 1], bias: [[0, 0], [0, 0]] },
  };
  let tables = [null, null];

  // ---- persistence ---------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  const saveResume = () => {
    const m = state.m;
    if (!m || m.cfg.mode === 'watch' || m.over) return;
    state.resume = { cfg: m.cfg, rem: m.rem, legsWon: m.legsWon, starter: m.starter, turn: m.turn, legNo: m.legNo, stats: m.stats };
    storage.set('resume', state.resume);
  };
  const clearResume = () => { state.resume = null; storage.remove('resume'); };
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('resume', null)]).then(([s, r, res]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const st = state.settings;
    st.textIdx = clamp(st.textIdx | 0, 0, TEXT_SCALES.length - 1);
    st.thinkIdx = clamp(st.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    st.assist = clamp(st.assist | 0, 0, ASSIST.length - 1);
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 5) state.record.wins = [0, 0, 0, 0, 0];
    if (res && res.cfg && Array.isArray(res.rem) && Array.isArray(res.stats) && res.cfg.mode !== 'watch' && !shotMode) state.resume = res;
    state.loaded = true;
    audio.setMuted?.(!st.sound);
  }).catch(() => { state.loaded = true; });

  // ---- sound ---------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    whoosh: () => tone({ freq: 760, to: 180, dur: 0.22, type: 'sawtooth', vol: 0.03 }),
    thud: (v = 1) => { tone({ freq: 140, to: 52, dur: 0.15, type: 'sine', vol: 0.3 * v }); tone({ freq: 1500, to: 520, dur: 0.035, type: 'square', vol: 0.05 * v }); },
    ting: () => { tone({ freq: 2500, to: 2200, dur: 0.4, type: 'sine', vol: 0.07 }); tone({ freq: 3330, to: 3000, dur: 0.28, type: 'sine', vol: 0.04 }); },
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.12 }),
    bust: () => { tone({ freq: 320, to: 80, dur: 0.45, type: 'sawtooth', vol: 0.07 }); tone({ freq: 160, to: 55, dur: 0.5, type: 'square', vol: 0.04 }); },
    big: () => [0, 4, 7, 12, 16].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.22 + i * 0.04, type: 'triangle', vol: 0.1 })),
    win: () => [0, 2, 4, 7, 9, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.3 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.2) => { state.toast = text; state.toastT = secs; };

  // ---- particles and pops ----------------------------------------------------------------------------
  const addPart = (p) => { if (state.parts.length < MAX_PARTS) state.parts.push({ t: 0, vx: 0, vy: 0, ...p }); };
  const dust = (x, y, n) => { for (let i = 0; i < n; i++) addPart({ k: 'dust', x, y, vx: (fx.next() - 0.5) * 120, vy: (fx.next() - 0.7) * 90, size: 2 + fx.next() * 3, max: 0.45 + fx.next() * 0.45, col: fx.next() < 0.5 ? '#d9c48c' : '#9b7a46' }); };
  const sparks = (x, y, n) => { for (let i = 0; i < n; i++) addPart({ k: 'spark', x, y, vx: (fx.next() - 0.5) * 420, vy: (fx.next() - 0.7) * 420, size: 1, max: 0.25 + fx.next() * 0.2 }); };
  const confetti = (n) => { const cols = ['#e9c15f', '#c5322c', '#2f8f55', '#2f86c9', '#f6f1e3']; for (let i = 0; i < n; i++) addPart({ k: 'conf', x: fx.next() * W, y: -20 - fx.next() * 200, vx: (fx.next() - 0.5) * 140, vy: 160 + fx.next() * 220, size: 5 + fx.next() * 5, rot: fx.next() * TAU, spin: (fx.next() - 0.5) * 12, max: 2.6 + fx.next() * 1.2, col: cols[fx.int(cols.length)] }); };
  const stepParts = (dt) => {
    for (const p of state.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.k === 'dust') { p.vy += 120 * dt; p.vx *= 0.97; } else if (p.k === 'spark') p.vy += 500 * dt; }
    state.parts = state.parts.filter((p) => p.t < p.max);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t <= 1.1);
  };

  // ---- who is who ------------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const isAI = (side) => mode() === 'watch' || (mode() === 'ai' && side === 1);
  const profOf = (side) => (mode() === 'watch' ? PROFILES[side === 0 ? state.m.cfg.watchA : state.m.cfg.opp] : PROFILES[state.m.cfg.opp]);
  const tableFor = (side) => (tables[side] ??= skillTable(profOf(side).sigma, state.m.cfg.start));
  const sideNameOf = (side) => {
    const c = state.m.cfg;
    if (c.mode === 'two') return side === 0 ? 'Player 1' : 'Player 2';
    if (c.mode === 'watch') return PROFILES[side === 0 ? c.watchA : c.opp].name;
    return side === 0 ? 'You' : PROFILES[c.opp].name;
  };
  const verb = (name, plural, singular) => (name === 'You' ? plural : singular);

  // ---- match flow ------------------------------------------------------------------------------------
  const showBanner = (text, sub = '', kind = '', dur = 1.6, size = 78, y = 600) => { state.banner = { text, sub, kind, t: 0, dur, size, y }; };
  const resetVisuals = () => { state.aim = null; state.reticle = null; state.flight = null; state.darts = []; state.hint = null; state.think = null; state.flash = null; state.pops = []; };
  const newForms = (m) => { state.ai.form = [newForm(PROFILES[m.cfg.watchA ?? 0], rn), newForm(PROFILES[m.cfg.opp ?? 0], rn)]; };

  const beginLeg = () => {
    const m = state.m;
    resetVisuals(); tables = [null, null]; newForms(m);
    state.phase = 'intro'; state.pt = 0; state.humanTurn = false;
    showBanner(`Leg ${m.legNo}`, `${sideNameOf(m.turn)} ${verb(sideNameOf(m.turn), 'throw', 'throws')} first`, '', 1.5, 84);
  };
  const computeCoach = () => {
    const m = state.m, rem = m.rem[m.turn], dl = dartsLeft(m);
    const r = rem <= 170 ? bestRoute(rem, dl) : null;
    state.coachRoute = r ? r.map((t) => t.label) : null;
  };
  const beginTurn = () => {
    const m = state.m, side = m.turn;
    state.phase = 'ready'; state.pt = 0; state.aim = null; state.reticle = null; state.hint = null; state.think = null; state.pickup = false;
    state.humanTurn = !isAI(side);
    if (!state.humanTurn) state.ai.bias[side] = newVisitBias(profOf(side), rn);
    computeCoach();
  };
  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoLegs >= DEMO_LEG_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const first = cfg.first ?? (cfg.mode === 'ai' ? aiR.int(2) : aiR.int(2));
    state.m = newMatch({ start: 501, legs: 2, mode: 'ai', opp: 0, watchA: 3, ...cfg, first });
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.lastVisit = [undefined, undefined]; state.parts = []; state.banner = null;
    beginLeg();
  };
  const startWatch = () => {
    const picks = [1, 2, 3, 4];
    const a = picks.splice(aiR.int(picks.length), 1)[0], b = picks[aiR.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, start: 301, legs: 1, first: aiR.int(2) });
  };
  const resumeMatch = () => {
    const r = state.resume;
    if (!r) return;
    const m = newMatch({ ...r.cfg });
    m.rem = [...r.rem]; m.legsWon = [...r.legsWon]; m.starter = r.starter; m.turn = r.turn; m.legNo = r.legNo;
    m.stats = r.stats.map((s) => ({ ...s }));
    m.visit.startRem = m.rem[m.turn];
    state.m = m; state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.lastVisit = [undefined, undefined]; state.parts = [];
    resetVisuals(); tables = [null, null]; newForms(m);
    state.phase = 'intro'; state.pt = 0; state.humanTurn = false;
    showBanner('Welcome back', `Leg ${m.legNo}, ${sideNameOf(m.turn)} to throw`, '', 1.5, 64);
  };

  // ---- throwing ------------------------------------------------------------------------------------------
  const launchDart = (side, lx, ly) => {
    const ex = clamp(lx, 12, W - 12), ey = clamp(ly, 150, 1010);
    const mx = (ex - BOARD.cx) / PX_PER_MM, my = (ey - BOARD.cy) / PX_PER_MM;
    const hit = hitAt(mx, my);
    let bounced = false, why = '';
    if (Math.hypot(mx, my) > 214) { bounced = true; why = 'Wide'; }
    else if (hit.value > 0 && wireDistance(mx, my) < 0.8 && fx.next() < 0.3) { bounced = true; why = 'Wire'; }
    else {
      for (const d of state.darts) {
        if (!d.fall && Math.hypot(d.x - ex, d.y - ey) < 7 && fx.next() < 0.38) { bounced = true; why = 'Deflected'; break; }
      }
    }
    state.flight = { sx: 360 + (fx.next() - 0.5) * 50, sy: 1150, ex, ey, t: 0, dur: 0.26, hit, bounced, why, side };
    state.phase = 'flying'; state.pt = 0; state.aim = null; state.reticle = null; state.hint = null; state.think = null;
    sfx.whoosh();
    if (!isAI(side)) state.record.thrown = (state.record.thrown | 0) + 1;
  };

  const impact = () => {
    const f = state.flight, m = state.m;
    state.flight = null;
    const hit = f.hit;
    let res;
    if (f.bounced) {
      state.darts.push({ x: f.ex, y: f.ey, age: 0, side: f.side, amp: 0, ph: 0, fall: { vx: (fx.next() - 0.5) * 220, vy: -90 - fx.next() * 80, rot: (fx.next() - 0.5) * 8, age: 0 } });
      res = applyDart(m, { label: 'Out', value: 0, mult: 0, seg: 0, bounced: true });
      sfx.ting(); sparks(f.ex, f.ey, 8);
      state.pops.push({ x: f.ex, y: f.ey, text: f.why === 'Wide' ? 'Wide!' : 'Bounced out!', sub: '', col: '#ffb4a0', t: 0 });
      state.shake = { t: 0, amp: 1.5 };
    } else {
      state.darts.push({ x: f.ex, y: f.ey, age: 0, side: f.side, amp: 0.2 + fx.next() * 0.08, ph: fx.next() * TAU, label: hit.label });
      res = applyDart(m, { label: hit.label, value: hit.value, mult: hit.mult, seg: hit.seg, bounced: false });
      const big = hit.mult === 3 || hit.label === 'Bull';
      sfx.thud(hit.value === 0 ? 0.6 : 1);
      dust(f.ex, f.ey, 5 + (big ? 4 : 0));
      if (hit.value > 0) sparks(f.ex, f.ey, hit.mult >= 2 ? 6 : 2);
      state.shake = { t: 0, amp: big ? 3.4 : 2.4 };
      if (hit.value > 0) {
        state.flash = { label: hit.label, t: 0 };
        state.pops.push({ x: f.ex, y: f.ey, text: hit.label === 'Bull' ? 'BULL' : hit.label, sub: `${hit.value}`, col: hit.mult === 3 ? '#8fe8ff' : hit.mult === 2 ? '#ffd36a' : '#fff1cf', t: 0, big });
        if (hit.mult >= 2) sfx.chime(hit.mult);
      } else state.pops.push({ x: f.ex, y: f.ey, text: 'Miss', sub: '', col: '#ffb4a0', t: 0 });
    }
    state.phase = 'settle'; state.pt = 0; state.coachRoute = null;
    if (res.kind === 'bust') { showBanner('BUST', res.why, 'bust', 1.5, 92, 620); sfx.bust(); state.bustShake = 0.7; state.shake = { t: 0, amp: 5 }; }
    else if (res.kind === 'leg') { confetti(70); sfx.big(); }
  };

  const doRelease = () => {
    const a = state.aim, k = ASSIST[state.settings.assist].k;
    const A = swayAmp(a.t, k), off = swayOffset(a.t, A, a.ph);
    const sig = spreadSigma(A, k, a.speed);
    const lx = a.bx + off.x + gauss(hn) * sig * 0.9, ly = a.by + off.y + gauss(hn) * sig * 1.1;
    launchDart(state.m.turn, lx, ly);
  };
  const cancelAim = () => { state.aim = null; state.reticle = null; state.phase = 'ready'; };
  const beginAim = (fxp, fyp, kb) => {
    state.aim = { t: 0, fx: fxp, fy: fyp, bx: clamp(fxp, 24, W - 24), by: clamp(fyp + (kb ? 0 : AIM.offsetY), AIM.top + 10, 1010), ph: [hn() * TAU, hn() * TAU, hn() * TAU, hn() * TAU], speed: 0, cancel: false, kb: !!kb, lx: fxp, ly: fyp };
    state.phase = 'aiming';
  };
  const updateAimPose = () => {
    const a = state.aim, k = ASSIST[state.settings.assist].k;
    const A = swayAmp(a.t, k), off = swayOffset(a.t, A, a.ph);
    state.reticle = { x: a.bx + off.x, y: a.by + off.y, sigma: spreadSigma(A, k, a.speed), steady: steadiness(a.t, k), tired: tired(a.t), fx: a.kb ? undefined : a.fx, fy: a.fy };
  };
  const requestHint = () => {
    const m = state.m;
    if (!state.humanTurn || state.phase !== 'ready') return;
    const s = suggest(m.rem[m.turn], dartsLeft(m));
    state.hint = { kind: s.kind, route: s.route.map((t) => t.label), text: s.text };
    sfx.tick();
  };

  // ---- computer players ----------------------------------------------------------------------------------
  const updateThink = (dt) => {
    const m = state.m, side = m.turn, prof = profOf(side), watch = mode() === 'watch';
    if (!state.think) {
      const rem = m.rem[side], dl = dartsLeft(m);
      const aim = chooseAim(tableFor(side), rem, dl, m.visit.startRem, rn, prof.wobble);
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiR.next() * (prof.think[1] - prof.think[0]);
      const t = aim.target;
      const land = throwAt(t, prof, { form: state.ai.form[side] ?? 1, pressure: t.dbl && t.value === rem, bias: state.ai.bias[side] }, rn);
      const ang = aiR.next() * TAU, dist = 55 + aiR.next() * 40;
      const tx = BOARD.cx + t.at[0] * PX_PER_MM, ty = BOARD.cy + t.at[1] * PX_PER_MM;
      state.think = {
        t: 0, dur, phase: 'think', aim: t.label, alts: aim.alts.map((a) => a.target.label), text: explain(rem, dl, aim), tx, ty,
        x0: tx + Math.cos(ang) * dist, y0: ty + Math.sin(ang) * dist, lx: BOARD.cx + land.x * PX_PER_MM, ly: BOARD.cy + land.y * PX_PER_MM,
        sigma: prof.sigma * PX_PER_MM * 0.6, actDur: watch ? 1.1 : 0.85,
      };
    }
    const th = state.think;
    th.t += dt;
    if (th.phase === 'think' && th.t >= th.dur) {
      if (watch) { th.phase = 'reveal'; th.t = 0; th.dur = REVEAL_SECS; sfx.tick(); } else { th.phase = 'act'; th.t = 0; th.dur = th.actDur; }
    } else if (th.phase === 'reveal' && th.t >= th.dur) { th.phase = 'act'; th.t = 0; th.dur = th.actDur; }
    else if (th.phase === 'act') {
      const k = clamp(th.t / th.dur, 0, 1), e = 1 - Math.pow(1 - k, 3), jit = (1 - e) * 10;
      state.reticle = { x: th.x0 + (th.tx - th.x0) * e + Math.sin(th.t * 17) * jit, y: th.y0 + (th.ty - th.y0) * e + Math.cos(th.t * 13) * jit, sigma: th.sigma * (1.4 - 0.4 * e), steady: e, tired: false };
      if (th.t >= th.dur) launchDart(side, th.lx, th.ly);
    }
  };

  // ---- visit / leg / match endings ---------------------------------------------------------------------------
  const beginVisitEnd = () => {
    const m = state.m, r = closeVisit(m), who = sideNameOf(r.side);
    state.lastVisit[r.side] = r.bust ? 0 : r.pts;
    state.phase = 'visitEnd'; state.pt = 0; state.pickup = true; state.humanTurn = false;
    if (r.bust) { /* the bust banner is already up */ }
    else if (r.pts === 180) { showBanner('ONE HUNDRED AND EIGHTY!', who, 'big', 2.4, 52, 600); sfx.big(); confetti(40); }
    else if (r.pts >= 140) { showBanner(`${r.pts}`, `${who}: massive visit`, 'big', 1.8, 96); sfx.big(); }
    else if (r.pts >= 100) { showBanner(`${r.pts}`, `${who}: a ton or more`, 'big', 1.7, 96); sfx.chime(2); }
    else if (r.pts === 0) showBanner('No score', who, '', 1.2, 64);
    else showBanner(`${r.pts}`, who, '', 1.3, 96);
    if (r.pts === 180 && !isAI(r.side)) state.record.c180++;
  };
  const collectDarts = () => { for (const d of state.darts) if (!d.fall) d.leave = 0.0001; state.phase = 'collect'; state.pt = 0; };
  const endVisitNext = () => { nextTurn(state.m); state.darts = []; state.flash = null; beginTurn(); saveResume(); };
  const beginLegEnd = () => {
    const m = state.m, winner = m.turn;
    const matchWon = winLeg(m);
    state.phase = 'legEnd'; state.pt = 0; state.humanTurn = false; state.pickup = false; state.hint = null; state.think = null;
    if (m.cfg.mode !== 'watch') { if (!isAI(winner)) state.record.legs++; state.record.demoLegs++; }
    const name = sideNameOf(winner);
    if (matchWon) showBanner('GAME SHOT!', `${name} ${verb(name, 'win', 'wins')} the match ${m.legsWon[0]} to ${m.legsWon[1]}`, 'big', 60, 78, 600);
    else showBanner('GAME SHOT!', `${name} ${verb(name, 'take', 'takes')} leg ${m.legNo}`, 'big', 60, 78, 600);
    sfx.win(); save();
  };
  const finishMatch = () => {
    const m = state.m;
    state.scene = 'result'; state.ui.scroll = 0; state.page = 0; state.banner = null;
    clearResume();
    if (m.cfg.mode === 'ai') {
      state.record.played++;
      if (m.over.win === 0) state.record.wins[m.cfg.opp] = (state.record.wins[m.cfg.opp] | 0) + 1;
    }
    if (m.cfg.mode !== 'watch') {
      state.record.hi = Math.max(state.record.hi, m.stats[0].hi);
      state.record.bestOut = Math.max(state.record.bestOut, m.stats[0].bestOut);
    }
    save();
  };
  const afterLegEnd = () => {
    const m = state.m;
    if (m.over) { finishMatch(); return; }
    if (state.demo && m.cfg.mode !== 'watch' && state.record.demoLegs >= DEMO_LEG_CAP) { save(); state.scene = 'demolimit'; state.ui.scroll = 0; clearResume(); return; }
    startNextLeg(m);
    beginLeg(); saveResume();
  };

  // ---- the play scene ------------------------------------------------------------------------------------------
  const openPause = () => { if (state.scene !== 'play' || mode() === 'watch') return; state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leaveMatch = () => { saveResume(); state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.think = null; state.aim = null; state.reticle = null; state.banner = null; };

  const stepVisuals = (dt) => {
    stepParts(dt);
    for (const d of state.darts) { d.age += dt; if (d.fall) d.fall.age += dt; if (d.leave) d.leave += dt; }
    state.darts = state.darts.filter((d) => !(d.fall && d.fall.age > 0.7));
    if (state.shake) { state.shake.t += dt; if (state.shake.t > 0.5) state.shake = null; }
    if (state.flash) { state.flash.t += dt; if (state.flash.t > 0.5) state.flash = null; }
    if (state.toastT > 0) state.toastT -= dt;
    if (state.bustShake > 0) state.bustShake = Math.max(0, state.bustShake - dt);
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.dur) state.banner = null; }
  };

  const updatePlay = (dt, input) => {
    const { m } = state, ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch';
    if (config.dev && keys.pressed.has('KeyK') && !state.paused && !watch) { m.legsWon[0] = m.cfg.legs - 1; m.rem[0] = 2; m.turn = 0; m.visit = { darts: [], startRem: 2, total: 0, bust: false, done: false, won: false }; beginTurn(); }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else state.paused = !state.paused; }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
      return;
    }
    if (watch) {
      if (ptr.pressed) {
        if (inRect(WATCH.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(WATCH.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); }
        else if (inRect(WATCH.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); }
        else if (inRect(WATCH.exit, ptr.x, ptr.y)) { leaveMatch(); return; }
      }
    } else if (ptr.pressed && inRect(MENU_BTN, ptr.x, ptr.y)) { openPause(); return; }
    // Everything below is frozen while paused: timers, animations, the computer's thinking, the dart in flight.
    if (state.paused) return;
    stepVisuals(dt);
    state.pt += dt;
    const phase = state.phase;
    if (phase === 'intro') {
      if (state.pt >= 1.5 || (ptr.pressed && state.pt > 0.4)) { state.banner = null; beginTurn(); }
    } else if (phase === 'ready') {
      if (state.humanTurn) {
        if (ptr.pressed) {
          if (inRect(THINK_BTN, ptr.x, ptr.y)) requestHint();
          else if (ptr.y >= AIM.top && ptr.y <= AIM.bottom) beginAim(ptr.x, ptr.y, false);
        } else if (keys.pressed.has('KeyH')) requestHint();
        else if (keys.pressed.has('Space')) beginAim(state.kb.x, state.kb.y, true);
      } else updateThink(dt);
    } else if (phase === 'aiming') {
      const a = state.aim;
      if (!a) { state.phase = 'ready'; return; }
      a.t += dt;
      if (a.kb) {
        const sp = 300 * dt;
        if (keys.down.has('ArrowLeft')) a.bx -= sp;
        if (keys.down.has('ArrowRight')) a.bx += sp;
        if (keys.down.has('ArrowUp')) a.by -= sp;
        if (keys.down.has('ArrowDown')) a.by += sp;
        a.bx = clamp(a.bx, 24, W - 24); a.by = clamp(a.by, AIM.top + 10, 1010); state.kb.x = a.bx; state.kb.y = a.by;
        a.speed = 0;
        updateAimPose();
        if (keys.pressed.has('Space') && a.t > AIM.minHold) doRelease();
      } else {
        if (ptr.down) {
          a.speed = a.speed * 0.75 + (Math.hypot(ptr.x - a.lx, ptr.y - a.ly) / Math.max(dt, 1e-3)) * 0.25;
          a.lx = a.fx = ptr.x; a.ly = a.fy = ptr.y;
          a.bx = clamp(ptr.x, 24, W - 24); a.by = clamp(ptr.y + AIM.offsetY, AIM.top + 10, 1010);
          a.cancel = ptr.y > AIM.bottom;
        } else a.speed *= 0.5;
        updateAimPose();
        if (ptr.released) {
          if (a.cancel) { cancelAim(); toast('Throw cancelled', 1.2); }
          else if (a.t < AIM.minHold) { cancelAim(); toast('Hold to aim, then let go', 1.6); }
          else doRelease();
        } else if (!ptr.down) cancelAim();
      }
    } else if (phase === 'flying') {
      const f = state.flight;
      if (!f) { state.phase = 'settle'; return; }
      f.t += dt;
      if (f.t >= f.dur) impact();
    } else if (phase === 'settle') {
      if (state.pt >= (m.visit.bust ? 1.1 : 0.7)) {
        if (m.visit.won) beginLegEnd();
        else if (m.visit.done) beginVisitEnd();
        else beginTurn();
      }
    } else if (phase === 'visitEnd') {
      if (state.pt >= 1.7 || (ptr.pressed && state.pt > 0.45)) { state.banner = null; collectDarts(); }
    } else if (phase === 'collect') {
      if (state.pt >= 0.5) endVisitNext();
    } else if (phase === 'legEnd') {
      if ((watch && state.pt > 5) || (ptr.pressed && state.pt > 1.4)) { state.banner = null; afterLegEnd(); }
    }
  };

  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'p-coach') { state.settings.coach = !state.settings.coach; save(); }
    else if (id === 'quit') leaveMatch();
  }

  // ---- menus --------------------------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) {
      const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top));
      state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max);
    }
  }
  const handleTitle = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'play') { state.setup.mode = 'ai'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'two') { state.setup.mode = 'two'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'continue') resumeMatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That opponent is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id === 'st501') s.start = 501;
    else if (id === 'st301') s.start = 301;
    else if (id.startsWith('legs')) s.legs = Number(id.slice(4));
    else if (id.startsWith('as')) { state.settings.assist = Number(id.slice(2)); save(); }
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, start: s.start, legs: s.legs });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-coach') st.coach = !st.coach;
    else if (id.startsWith('as')) st.assist = Number(id.slice(2));
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
    const cfg = state.m.cfg;
    if (id === 'again') { if (cfg.mode === 'watch') startWatch(); else startMatch({ ...cfg, first: undefined }); }
    else if (id === 'new') { state.setup.mode = cfg.mode === 'watch' ? 'ai' : cfg.mode; state.scene = 'setup'; state.ui.scroll = 0; }
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
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('KeyO') && state.setup.mode === 'ai') state.setup.opp = (state.setup.opp + 1) % (state.demo ? 2 : PROFILES.length);
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) {
      handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back');
      return;
    }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys, n = pageCount();
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

  // ---- the attract board behind the title and menus ---------------------------------------------------------------------
  const updateAttract = (dt) => {
    const a = state.att;
    a.wait -= dt;
    for (const d of a.darts) d.age += dt;
    for (const p of a.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; }
    a.parts = a.parts.filter((p) => p.t < p.max);
    if (a.wait <= 0) {
      a.wait = 2.6;
      if (a.darts.length >= 5) a.darts = a.darts.slice(2);
      const picks = [[0, -103], [0, 0], [30, -103], [-28, -103], [0, -135], [-90, -50], [60, 70]];
      const p = picks[a.n++ % picks.length];
      const x = p[0] + (fx.next() - 0.5) * 18, y = p[1] + (fx.next() - 0.5) * 18;
      a.darts.push({ x, y, age: 0, side: a.n % 2, amp: 0.22, ph: fx.next() * TAU });
      for (let i = 0; i < 4; i++) a.parts.push({ k: 'dust', x, y, vx: (fx.next() - 0.5) * 60, vy: (fx.next() - 0.7) * 60, size: 1.5 + fx.next() * 2, t: 0, max: 0.5 + fx.next() * 0.4, col: '#d9c48c' });
      sfx.thud(0.5);
    }
  };

  // ---- shot presets (store screenshots): ?shot=1&seed=N picks a fixed, deterministic screen -------------------------------
  const presetMatch = (cfg, rems, legsWon, stats) => {
    startMatch({ first: 0, ...cfg });
    const m = state.m;
    m.rem = rems; m.legsWon = legsWon; m.visit.startRem = rems[m.turn];
    m.stats = stats.map((s) => ({ darts: 0, points: 0, visits: 0, hi: 0, c180: 0, c100: 0, bestOut: 0, legsWon: 0, bounce: 0, busts: 0, dblTried: 0, dblHit: 0, ...s }));
    state.banner = null; state.phase = 'ready'; state.humanTurn = !isAI(m.turn); state.ai.form = [1, 1];
    computeCoach();
  };
  const stick = (label, side = 0, dx = 0, dy = 0) => {
    const t = targetByLabel(label);
    state.darts.push({ x: BOARD.cx + t.at[0] * PX_PER_MM + dx, y: BOARD.cy + t.at[1] * PX_PER_MM + dy, age: 2, side, amp: 0, ph: 0, label });
  };
  const holdAim = (fxp, fyp, t, ph) => {
    state.aim = { t, fx: fxp, fy: fyp, bx: fxp, by: fyp + AIM.offsetY, ph, speed: 0, cancel: false, kb: false, lx: fxp, ly: fyp };
    state.phase = 'aiming'; updateAimPose();
  };
  const applyPresetResult = () => {
    presetMatch({ mode: 'ai', opp: 2, start: 501, legs: 2 }, [0, 166], [2, 1], [{ darts: 52, points: 1002, visits: 18, hi: 140, c100: 3, bestOut: 64, dblTried: 9, dblHit: 3 }, { darts: 55, points: 835, visits: 19, hi: 100, c100: 1, dblTried: 7, dblHit: 1 }]);
    state.m.over = { win: 0 }; state.scene = 'result';
  };
  const applyPreset = () => {
    state.shot = true;
    const n = ((shotSeed % 100) + 100) % 100;
    if (n === 1) {
      state.att.darts = [[0, -103, 0], [32, -103, 1], [0, -2, 0], [-26, -135, 1], [-60, -75, 0]].map(([x, y, s]) => ({ x, y, age: 3, side: s, amp: 0, ph: 0 }));
      state.scene = 'title'; return;
    }
    if (n === 2) {
      presetMatch({ mode: 'ai', opp: 2, start: 501, legs: 2 }, [141, 167], [0, 0], [{ darts: 18, points: 360, visits: 6, hi: 100, c100: 1 }, { darts: 18, points: 334, visits: 6, hi: 85 }]);
      state.m.visit.darts = [{ label: 'T20', value: 60, mult: 3, seg: 20 }, { label: '20', value: 20, mult: 1, seg: 20 }]; state.m.visit.startRem = 221;
      stick('T20', 0, 2, 1); stick('20', 0, -3, 12);
      state.coachRoute = ['T20', 'T19', 'D12'];
      holdAim(396, 470, 1.7, [0.4, 1.2, 2.1, 0.7]); return;
    }
    if (n === 3) {
      presetMatch({ mode: 'ai', opp: 3, start: 501, legs: 3 }, [321, 188], [1, 1], [{ darts: 27, points: 540, visits: 9, hi: 140, c100: 2, c180: 1 }, { darts: 30, points: 692, visits: 10, hi: 120, c100: 3 }]);
      state.m.visit.darts = [{ label: 'T20', value: 60, mult: 3, seg: 20 }, { label: 'T20', value: 60, mult: 3, seg: 20 }, { label: 'T20', value: 60, mult: 3, seg: 20 }];
      state.m.visit.startRem = 501; state.m.visit.done = true;
      stick('T20', 0, -4, 2); stick('T20', 0, 1, -2); stick('T20', 0, 5, 3);
      state.phase = 'visitEnd'; state.pt = 0.4; state.pickup = true; state.humanTurn = false; state.lastVisit = [180, 100];
      showBanner('ONE HUNDRED AND EIGHTY!', 'You', 'big', 99, 52, 600); state.banner.t = 0.5; return;
    }
    if (n === 4) {
      presetMatch({ mode: 'watch', watchA: 4, opp: 2, start: 301, legs: 1 }, [96, 141], [0, 0], [{ darts: 21, points: 205, visits: 7, hi: 85 }, { darts: 21, points: 160, visits: 7, hi: 60 }]);
      state.m.turn = 0; state.m.visit.darts = [{ label: 'T20', value: 60, mult: 3, seg: 20 }]; state.m.visit.startRem = 156; state.humanTurn = false;
      stick('T20', 0, 2, 2);
      const t = targetByLabel('T18');
      state.think = { t: 0.8, dur: 2, phase: 'reveal', aim: 'T18', alts: ['T18', '18', 'T20'], text: '96 left: 2 darts to finish, T18 then D18.', tx: BOARD.cx + t.at[0] * PX_PER_MM, ty: BOARD.cy + t.at[1] * PX_PER_MM, x0: 0, y0: 0, lx: 0, ly: 0, sigma: 8, actDur: 1 };
      return;
    }
    if (n === 5) {
      presetMatch({ mode: 'ai', opp: 1, start: 501, legs: 2 }, [40, 112], [1, 0], [{ darts: 30, points: 461, visits: 10, hi: 100, c100: 1 }, { darts: 27, points: 389, visits: 9, hi: 85 }]);
      state.hint = { kind: 'finish', route: ['D20'], text: 'D20' }; state.lastVisit = [60, 41]; return;
    }
    if (n === 6) {
      presetMatch({ mode: 'ai', opp: 2, start: 501, legs: 2 }, [0, 166], [2, 1], [
        { darts: 52, points: 1002, visits: 18, hi: 140, c100: 3, bestOut: 64, dblTried: 9, dblHit: 3, legsWon: 2 },
        { darts: 55, points: 835, visits: 19, hi: 100, c100: 1, dblTried: 7, dblHit: 1, legsWon: 1 }]);
      state.m.over = { win: 0 }; state.m.legNo = 3; state.record.wins = [1, 0, 1, 0, 0]; state.record.played = 3;
      state.scene = 'result'; state.ui.scroll = 0; return;
    }
    if (n === 7) { state.back = 'title'; state.scene = 'rules'; state.page = 1; return; }
    if (n === 8) { state.back = 'title'; state.scene = 'howto'; state.page = 0; return; }
    if (n === 9) { state.scene = 'setup'; return; }
    if (n === 10) { state.scene = 'settings'; return; }
    if (n === 11) { state.back = 'title'; state.scene = 'about'; return; }
    if (n === 12) {
      presetMatch({ mode: 'ai', opp: 4, start: 501, legs: 2 }, [32, 76], [0, 0], [{ darts: 36, points: 469, visits: 12, hi: 134, c100: 2 }, { darts: 36, points: 425, visits: 12, hi: 100, c100: 1 }]);
      state.lastVisit = [95, 60]; state.hint = { kind: 'finish', route: ['D16'], text: 'D16' };
      holdAim(356, 700, 1.5, [0.9, 0.2, 1.6, 2.3]); return;
    }
    if (n === 13) {
      presetMatch({ mode: 'ai', opp: 2, start: 501, legs: 2 }, [64, 201], [0, 0], [{ darts: 30, points: 437, visits: 10, hi: 100 }, { darts: 30, points: 300, visits: 10, hi: 80 }]);
      state.m.visit.darts = [{ label: 'T20', value: 60, mult: 3, seg: 20 }, { label: '19', value: 19, mult: 1, seg: 19 }, { label: '20', value: 20, mult: 1, seg: 20, busted: true }];
      state.m.visit.startRem = 143; state.m.visit.bust = true; state.m.visit.done = true;
      stick('T20', 0, 3, 0); stick('19', 0, 0, 10); stick('20', 0, -8, 18);
      showBanner('BUST', 'Over the score', 'bust', 99, 92, 620); state.banner.t = 0.4;
      state.phase = 'settle'; return;
    }
    if (n >= 15 && n <= 19) {
      state.settings.textIdx = 4;
      if (n === 15) { state.back = 'title'; state.scene = 'rules'; state.page = 3; }
      else if (n === 16) state.scene = 'title';
      else if (n === 17) { applyPresetResult(); }
      else if (n === 18) state.scene = 'settings';
      else state.scene = 'setup';
      return;
    }
    if (n === 14) {
      state.scene = 'play'; presetMatch({ mode: 'two', start: 501, legs: 3 }, [227, 301], [1, 0], [{ darts: 30, points: 400, visits: 10, hi: 100 }, { darts: 27, points: 200, visits: 9, hi: 60 }]);
      state.pauseMenu = true; state.paused = true;
    }
  };

  // ---- the object the kit and the shell see --------------------------------------------------------------------------
  const game = {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused,
    update(dt, input) {
      setPress(input.pointer);
      if (state.shot) { state.t += dt; return; }
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
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
        case 'settings': renderSettings(ctx, state); break;
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
  };
  if (shotMode) applyPreset();
  return game;
}
