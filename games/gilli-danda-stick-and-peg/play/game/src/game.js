// Gilli-Danda: flow and input. Drawing lives in view.js / scene2d.js, the innings in engine.js. This file is the only one that mutates `state`.
//
// Play: drag to aim, press the big pad to TAP (flip the peg) and press it again to SWING. Keyboard: Left/Right aim, Space or Enter is the pad.
import { createRng } from '../kit/rng.js';
import { W, H, FIELD_KEYS, FIRST, SKINS, HAIRS, TEAMS, clamp, DT, AIM_MAX, DEG } from './core.js';
import { createRound, stepRound, tapNow, swingNow, skipResult, planChance, scan, describeAz, idealPress, penPos, READY_T } from './engine.js';
import { TEXT_SCALES, inRect, setPress } from './ui.js';
import { renderScene } from './view.js';
import { LY, syncLayout, host } from './layout.js';
import { cameraFor, project } from './cam.js';

export const meta = { width: W, height: H, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };

const THINK_STEPS = [2, 5, 8, 10];
const DEMO_ROUNDS = 2;
const RIVAL_SKILL = [0.42, 0.6, 0.78];
const GOLD = '#ffc83d', TEAL = '#35c4a4';
const hid = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true });

export function createGame(env) {
  const { rng, storage, audio, config, monetization } = env;
  const freshV = () => ({ parts: [], flash: 0, cut: 0, seed: 7, t: 0 });
  const state = {
    scene: 'title', t: 0, tick: 0,
    prefs: { sound: true, assist: 1, textIdx: 0, thinkIdx: 1, level: 1, field: 'lane', guide: true, coach: 0, padLeft: false, lefty: false },
    ui: { scroll: 0, drag: null },
    setup: null, r: null, match: null, recap: null, results: null, v: freshV(), paused: false, fast: false,
    think: { open: false, lines: [], az: null },
    auto: { phase: 'idle', timer: 0, total: 0, lines: [], fullLines: [], decision: '', speed: 1, revealing: false, key: '', plan: null },
    touch: { mode: null, sx: 0, az0: 0, pad: false },
    records: {}, demoPlayed: 0, kind: 'solo', lastStart: null,
  };
  hid(state, 'env', env);
  hid(state, '_ui', { hits: [], footer: [], view: { x: 0, y: 0, w: W, h: H }, maxS: 0, bar: null, thumb: null });
  syncLayout(meta.width, meta.height);
  let Rn = null, plan = null, seenEv = 0, lastCount = 0;
  const sfxq = [];

  // ---- persistence -------------------------------------------------------------------------------------------------------------
  const savePrefs = () => storage.set('prefs', state.prefs);
  storage.get('prefs', null).then((p) => {
    if (!p) return;
    const pf = state.prefs;
    pf.sound = p.sound ?? true; pf.assist = clamp(p.assist ?? 1, 0, 2); pf.textIdx = clamp(p.textIdx ?? 0, 0, TEXT_SCALES.length - 1);
    pf.thinkIdx = clamp(p.thinkIdx ?? 1, 0, 3); pf.level = clamp(p.level ?? 1, 0, 2); pf.field = FIELD_KEYS.includes(p.field) ? p.field : 'lane'; pf.guide = p.guide !== false;
    pf.coach = clamp(Number(p.coach) || 0, 0, 99); pf.padLeft = !!p.padLeft; pf.lefty = !!p.lefty;
    audio.setMuted(!pf.sound);
  });
  storage.get('records', {}).then((r) => { if (r && typeof r === 'object') state.records = r; });
  storage.get('demoPlayed', 0).then((n) => { state.demoPlayed = Math.max(state.demoPlayed, Number(n) || 0); });
  const saveRecords = () => storage.set('records', state.records);

  // ---- sound ------------------------------------------------------------------------------------------------------------------------
  const tone = (o, delay = 0) => { if (!state.prefs.sound) return; if (delay > 0) sfxq.push({ at: state.t + delay, o }); else audio.tone(o); };
  const sfx = (name, q = 1) => {
    switch (name) {
      case 'ui': tone({ freq: 520, to: 700, dur: 0.07, type: 'triangle', vol: 0.12 }); break;
      case 'knock': tone({ freq: 420, to: 150, dur: 0.09, type: 'triangle', vol: 0.28 }); tone({ freq: 1500, to: 600, dur: 0.03, type: 'square', vol: 0.06 }); break;
      case 'ping': tone({ freq: 1240, to: 1480, dur: 0.18, type: 'sine', vol: 0.1 }, 0.04); break;
      case 'swish': tone({ freq: 900, to: 220, dur: 0.16, type: 'sawtooth', vol: 0.07 }); break;
      case 'crack': tone({ freq: 2100, to: 300, dur: 0.05, type: 'square', vol: 0.16 * (0.4 + q * 0.6) }); tone({ freq: 170, to: 80, dur: 0.12, type: 'triangle', vol: 0.34 * (0.5 + q * 0.5) }); tone({ freq: 1100, to: 450, dur: 0.05, type: 'sawtooth', vol: 0.08 }, 0.01); break;
      case 'thud': tone({ freq: 190, to: 90, dur: 0.12, type: 'triangle', vol: 0.25 }); break;
      case 'tick': tone({ freq: 880, to: 940, dur: 0.04, type: 'triangle', vol: 0.07 }); break;
      case 'cheer': for (let k = 0; k < 5; k++) tone({ freq: 160 + k * 55, to: 210 + k * 45, dur: 0.9, type: 'sawtooth', vol: 0.016 }, k * 0.03); for (let k = 0; k < 6; k++) tone({ freq: 1800 + (k * 311) % 900, to: 900, dur: 0.04, type: 'square', vol: 0.025 }, 0.1 + k * 0.08); break;
      case 'groan': tone({ freq: 220, to: 120, dur: 0.6, type: 'sawtooth', vol: 0.03 }); tone({ freq: 160, to: 90, dur: 0.6, type: 'sawtooth', vol: 0.025 }, 0.05); break;
      case 'oh': tone({ freq: 300, to: 520, dur: 0.3, type: 'sine', vol: 0.05 }); break;
      case 'win': [523, 659, 784, 1046].forEach((f, k) => tone({ freq: f, dur: 0.3, type: 'sine', vol: 0.16 }, k * 0.14)); break;
      case 'lose': [392, 330, 262].forEach((f, k) => tone({ freq: f, dur: 0.34, type: 'triangle', vol: 0.16 }, k * 0.18)); break;
      default: break;
    }
  };
  const playSfxQueue = () => { for (let i = sfxq.length - 1; i >= 0; i--) if (sfxq[i].at <= state.t) { audio.tone(sfxq[i].o); sfxq.splice(i, 1); } };

  // ---- view-state helpers (screen-space particles) ---------------------------------------------------------------------------------
  const vr = () => { const v = state.v; v.seed = (Math.imul(v.seed, 1664525) + 1013904223) >>> 0; return v.seed / 4294967296; };
  const spawn = (n, f) => { for (let i = 0; i < n; i++) state.v.parts.push(f(i)); };
  const confetti = (cx, cy, n, colors) => spawn(n, () => ({ kind: 'confetti', x: cx + (vr() - 0.5) * 120, y: cy, vx: (vr() - 0.5) * 560, vy: -240 - vr() * 520, r: 4 + vr() * 5, life: 1.8, max: 1.8, color: colors[Math.floor(vr() * colors.length)], rot: vr() * 6, g: 900 }));
  const burst = (x, y, n, color, sp = 300) => spawn(n, () => { const a = vr() * 6.283, s = sp * (0.3 + vr()); return { kind: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 3 + vr() * 4, life: 0.7, max: 0.7, color, g: 360 }; });
  const ring = (x, y, color, w = 6) => state.v.parts.push({ kind: 'ring', x, y, vx: 0, vy: 0, r: 8, life: 0.5, max: 0.5, color, w, g: 0, grow: 460 });
  const flashAt = (x, y, r) => state.v.parts.push({ kind: 'flash', x, y, vx: 0, vy: 0, r, life: 0.25, max: 0.25, g: 0 });
  const dust = (x, y, n = 10) => spawn(n, () => ({ kind: 'dot', x: x + (vr() - 0.5) * 30, y, vx: (vr() - 0.5) * 140, vy: -60 - vr() * 120, r: 5 + vr() * 6, life: 0.9, max: 0.9, color: 'rgba(214,176,128,0.7)', g: 40 }));
  const camNow = () => (env.view3d && env.view3d.active && env.view3d.cam) || cameraFor(state.r, LY.w / LY.h);
  const proj = (p) => project(camNow(), LY.w, LY.h, p, {});

  // ---- starting rounds ----------------------------------------------------------------------------------------------------------------
  const streams = (kind) => {
    if (kind === 'daily') { const g = createRng((config.day ?? 0) * 7 + 3); return { p: g.fork(), f: g.fork(), a: g.fork(), h: g.fork() }; }
    return { p: rng.fork(), f: rng.fork(), a: rng.fork(), h: rng.fork() };
  };
  const youStriker = () => ({ name: 'You', skin: 'tan', hair: 'black', top: TEAMS[0].top, trim: TEAMS[0].trim, cap: TEAMS[0].cap, pants: TEAMS[0].pants, female: false, you: true, left: !!state.prefs.lefty });
  const makeTeam = (def, R, withYou) => {
    const names = R.h.shuffle(FIRST).slice(0, 3);
    const strikers = names.map((nm, i) => ({ name: nm, skin: R.h.pick(SKINS), hair: R.h.pick(HAIRS), top: def.top, trim: def.trim, cap: def.cap, pants: def.pants, female: i === 1 }));
    if (withYou) strikers[0] = youStriker();
    return { key: def.key, name: def.name, strikers };
  };

  function beginRound(kind, o = {}) {
    const isAuto = kind === 'auto';
    if (kind === 'solo' && config.demo && state.demoPlayed >= DEMO_ROUNDS) { go('demolimit'); return; }
    if (kind === 'solo' && config.demo) { state.demoPlayed += 1; storage.set('demoPlayed', state.demoPlayed); }
    if (!o.keepStreams || !Rn) Rn = streams(kind);
    const pf = state.prefs;
    state.kind = kind; state.lastStart = { kind, o };
    const day = config.day ?? 0;
    const field = kind === 'daily' ? FIELD_KEYS[day % 3] : (o.field ?? pf.field);
    const level = kind === 'daily' ? 1 : (o.level ?? pf.level);
    state.r = createRound({
      mode: kind, field, level, label: o.label ?? (kind === 'daily' ? 'Daily Challenge' : kind === 'auto' ? 'Auto Play' : 'Distance Challenge'),
      striker: o.striker ?? (isAuto ? { name: 'Computer', skin: 'brown', hair: 'black', top: TEAMS[0].top, trim: TEAMS[0].trim, cap: TEAMS[0].cap, pants: TEAMS[0].pants, female: false } : youStriker()),
      chances: o.chances ?? 6, outEnds: !!o.outEnds, bot: o.bot ?? null, assistIdx: pf.assist, auto: isAuto, hints: o.hints ?? 3,
    }, Rn);
    plan = null;
    state.v = freshV(); state.touch = { mode: null, sx: 0, az0: 0, pad: false };
    state.think = { open: false, lines: [], az: null }; state.paused = false; state.results = null; state.fast = false;
    state.auto = { phase: 'idle', timer: 0, total: 0, lines: [], fullLines: [], decision: '', speed: 1, revealing: false, key: '', plan: null };
    seenEv = state.r.evId; lastCount = 0;
    state.scene = isAuto ? 'auto' : 'play'; state.ui.scroll = 0;
    if (!isAuto && !o.bot) monetization.track('round_start', { kind });
  }

  const go = (scene) => { state.scene = scene; state.ui.scroll = 0; state.paused = false; state.think.open = false; sfx('ui'); };

  const goSetup = (mode) => {
    const pf = state.prefs;
    state.setup = {
      mode, title: mode === 'match' ? 'Team Match' : mode === 'daily' ? 'Daily Challenge' : 'Distance Challenge',
      blurb: mode === 'match' ? 'Three strikers a side. A catch puts a striker out.' : mode === 'daily' ? 'Everyone gets the same field and flips today.' : 'Six chances. Hit it as far as you can.',
      level: pf.level, field: config.demo ? 'lamp' : pf.field,
    };
    if (mode === 'daily') { beginRound('daily', {}); return; }
    go('setup');
  };

  const newMatch = (level, field) => ({ level, field, teams: [makeTeam(TEAMS[0], Rn, true), makeTeam(TEAMS[1 + level], Rn, false)], inn: 0, si: 0, totals: [0, 0], lines: [[null, null, null], [null, null, null]], decider: false, best: [0, 0] });

  function startFromSetup() {
    const su = state.setup, pf = state.prefs;
    pf.level = su.level; pf.field = su.field; savePrefs();
    if (su.mode === 'match') {
      Rn = streams('match');
      state.match = newMatch(su.level, su.field);
      go('lineup');
    } else beginRound(su.mode, { level: su.level, field: su.field });
  }

  // ---- team match flow ---------------------------------------------------------------------------------------------------------------------
  function matchStriker() {
    const m = state.match, side = m.inn % 2, team = m.teams[side];
    let idx = m.si;
    if (m.decider) idx = team.strikers.reduce((b, s, i) => ((m.lines[side][i] ?? 0) > (m.lines[side][b] ?? 0) ? i : b), 0);
    const rival = side === 1;
    beginRound('match', {
      striker: team.strikers[idx], chances: m.decider ? 1 : 3, outEnds: true, bot: rival ? RIVAL_SKILL[m.level] : null, level: m.level, field: m.field, keepStreams: true,
      label: m.decider ? 'Decider' : team.name,
    });
  }

  function afterMatchRound() {
    const m = state.match, r = state.r, side = m.inn % 2;
    m.totals[side] += r.score;
    if (m.decider) m.best[side] = Math.max(m.best[side], r.score); else { m.lines[side][m.si] = r.score; m.best[side] = Math.max(m.best[side], r.best); }
    m.si += 1;
    if (!m.decider && m.si < 3) { matchStriker(); return; }
    // the side has finished batting
    const rows = m.decider ? [{ label: m.teams[side].name, value: `${r.score} dandas` }] : m.teams[side].strikers.map((s, i) => ({ label: s.name, value: `${m.lines[side][i]} dandas` }));
    if (!m.decider) rows.push({ label: `${m.teams[side].name} total`, value: `${m.totals[side]} dandas`, color: GOLD });
    if (m.inn === 0) {
      state.recap = { headline: `${m.teams[0].name} score ${m.totals[0]}`, sub: `${m.teams[1].name} need ${m.totals[0] + 1} to win.`, rows, cta: `${m.teams[1].name} bat`, then: 'rival' };
    } else if (m.inn === 1) {
      const [a, b] = m.totals;
      if (a === b) state.recap = { headline: 'All square!', sub: `${a} dandas each.`, rows, note: 'One deciding chance for each side\'s best striker.', cta: 'Decider', then: 'decider' };
      else { finishMatch(); return; }
    } else if (m.inn === 2) {
      state.recap = { headline: `${m.teams[0].name}: ${r.score}`, sub: `${m.teams[1].name} to reply.`, rows, cta: 'Their chance', then: 'decider2' };
    } else { finishMatch(); return; }
    sfx('cheer'); go('recap');
  }

  function afterRecap() {
    const m = state.match, then = state.recap.then;
    if (then === 'rival') { m.inn = 1; m.si = 0; matchStriker(); }
    else if (then === 'decider') { m.decider = true; m.inn = 2; m.si = 0; matchStriker(); }
    else if (then === 'decider2') { m.inn = 3; m.si = 0; matchStriker(); }
  }

  function finishMatch() {
    const m = state.match, rec = state.records;
    const [a, b] = m.totals, win = a > b, draw = a === b;
    rec.matches = (rec.matches ?? 0) + 1; if (win) rec.wins = (rec.wins ?? 0) + 1; rec.bestTotal = Math.max(rec.bestTotal ?? 0, a);
    saveRecords();
    const rows = [
      { label: m.teams[0].name, value: `${a} dandas`, color: GOLD }, { label: m.teams[1].name, value: `${b} dandas` },
      { label: 'Your side\'s longest hit', value: `${m.best[0]} dandas` },
    ];
    state.results = { headline: win ? 'You win!' : draw ? 'A draw' : 'Rivals win', sub: `${m.teams[0].name} ${a}, ${m.teams[1].name} ${b}`, rows, mode: 'match' };
    sfx(win ? 'win' : 'lose'); monetization.track('match_end', { win, a, b });
    go('results');
  }

  // ---- end of a round ------------------------------------------------------------------------------------------------------------------------
  function afterRound() {
    const r = state.r, rec = state.records;
    if (state.kind === 'match') { afterMatchRound(); return; }
    const rows = [
      { label: 'Total', value: `${r.score} dandas`, color: GOLD }, { label: 'Longest hit', value: `${r.best} dandas` },
      { label: 'Times caught', value: String(r.stats.catches) }, { label: 'Perfect flips', value: String(r.stats.perfectTap) }, { label: 'Perfect strikes', value: String(r.stats.perfectSwing) },
      { label: 'Misses', value: String(r.stats.tapMiss + r.stats.whiffs) },
    ];
    if (state.scene === 'auto') {
      state.results = { headline: 'Auto Play finished', sub: `The computer scored ${r.score} dandas.`, rows, mode: 'auto' };
      go('results'); return;
    }
    rec.bestTotal = Math.max(rec.bestTotal ?? 0, r.score); rec.bestDl = Math.max(rec.bestDl ?? 0, r.best); rec.played = (rec.played ?? 0) + 1;
    if (state.kind === 'daily') { rec.dailyScore = Math.max(rec.dailyDay === config.day ? rec.dailyScore ?? 0 : 0, r.score); rec.dailyDay = config.day; }
    rows.push({ label: 'Your best total', value: `${rec.bestTotal} dandas`, color: TEAL });
    state.results = { headline: r.score >= 180 ? 'Mighty hitting!' : r.score >= 110 ? 'Well played!' : 'Round over', sub: `${r.score} dandas in ${r.n} chances.`, rows, mode: state.kind };
    saveRecords(); monetization.track('round_end', { kind: state.kind, score: r.score }); sfx(r.score >= 110 ? 'win' : 'lose');
    go('results');
  }

  // ---- hints -----------------------------------------------------------------------------------------------------------------------------------
  function hintLines(r) {
    const sc = scan(r), open = sc.filter((s) => !s.caught).sort((a, b) => b.dl - a.dl), best = open[0];
    const lines = [];
    const near = r.fielders.map((f) => Math.hypot(f.x, f.z)).sort((a, b) => a - b)[0];
    lines.push(`${r.fielders.length} fielders are out there; the closest is about ${Math.round(near)} metres from the hole.`);
    const caught = sc.filter((s) => s.caught).length;
    lines.push(caught ? `If you struck it cleanly, ${caught} of the ${sc.length} directions I checked would be caught.` : 'A clean strike would not be caught in any direction I checked, so just go for distance.');
    if (best) lines.push(`The best open line is ${describeAz(best.az)}: about ${best.dl} dandas. Drag until the gold knob sits on the green marker.`);
    else lines.push('Every line is covered. Aim for the gap furthest from the fielders and keep the strike low and hard.');
    lines.push('Catch the gilli a little low and it flies high and hangs (easy to catch); a little high and it skims in flat and fast. Press as the ring closes.');
    return { lines, az: best ? best.az : null };
  }
  function openThink() {
    const r = state.r;
    if (r.hints <= 0 || state.think.open || r.bot || !['ready', 'tap'].includes(r.phase)) return;
    r.hints -= 1; const h = hintLines(r); state.think = { open: true, lines: h.lines, az: h.az }; sfx('ui');
  }

  // ---- engine events -> sound and particles ---------------------------------------------------------------------------------------------------
  function processEvents() {
    const r = state.r, v = state.v;
    for (const e of r.events) {
      if (e.id <= seenEv) continue;
      seenEv = e.id;
      switch (e.k) {
        case 'ready': state.think.az = null; if (r.n > 0 && !r.bot && state.scene === 'play') state.prefs.coach = Math.min(99, state.prefs.coach + 1); break;
        case 'flip': {
          sfx('knock'); if (e.kind === 'perfect') sfx('ping');
          const p = proj([0.05, 0.05, 0]); if (p.ok) { dust(p.x, p.y, 8); ring(p.x, p.y, '#ffe9a8', 5); }
          break;
        }
        case 'tapmiss': sfx('thud'); break;
        case 'swing': sfx('swish'); break;
        case 'whiff': sfx(e.why === 'late' ? 'thud' : 'swish'); break;
        case 'contact': {
          sfx('crack', e.q);
          const sp = r.sw.pos, p = proj([sp[0], sp[1], sp[2]]);
          if (p.ok) { flashAt(p.x, p.y, 90 + 150 * e.q); ring(p.x, p.y, '#fff4c8', 9); burst(p.x, p.y, 12, '#ffe08a', 420); }
          v.flash = 0.22 + 0.2 * e.q;
          break;
        }
        case 'catch': sfx('cheer'); sfx('groan'); v.cut = 0; break;
        case 'drop': sfx('oh'); break;
        case 'land': {
          sfx('thud'); const f = r.fly, p = proj([f.land.x, 0.05, f.land.z]);
          if (p.ok) dust(p.x, p.y, 12);
          if (e.dl >= 30) { sfx('cheer'); confetti(LY.cx, LY.h * 0.3, e.dl >= 42 ? 80 : 36, ['#ffd34d', '#ff8a3d', '#2fae8c', '#fff4dc']); }
          break;
        }
        default: break;
      }
    }
  }

  function updateView(dt) {
    const v = state.v; v.t += dt;
    v.flash *= 0.86; if (v.flash < 0.01) v.flash = 0;
    for (const q of v.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g ?? 0) * dt; q.life -= dt; if (q.grow) q.r += q.grow * dt; if (q.rot != null) q.rot += dt * 8; }
    v.parts = v.parts.filter((q) => q.life > 0);
    const r = state.r;
    if (r.phase === 'ready' && r.pt < 0.25 && r.n > 0) v.cut = 1 - r.pt / 0.25; else v.cut = Math.max(0, v.cut - dt * 6);
    // the measuring count ticks
    if (r.phase === 'result' && r.res && r.res.kind === 'hit') {
      const c = Math.floor(r.res.dl * clamp(r.pt / 1.1, 0, 1));
      if (c !== lastCount && c % 2 === 0) sfx('tick');
      lastCount = c;
    } else lastCount = 0;
  }

  // ---- play input --------------------------------------------------------------------------------------------------------------------------------
  function padPress() {
    const r = state.r;
    switch (r.phase) {
      case 'ready': if (r.pt > 0.3) r.pt = READY_T; break;
      case 'tap': tapNow(r, Rn); break;
      case 'flip': swingNow(r, Rn); break;
      case 'result': skipResult(r, Rn); break;
      default: break;
    }
  }

  function playInput(input) {
    const r = state.r, p = input.pointer, tc = state.touch;
    const kd = input.keys.down;
    const dirx = (kd.has('ArrowRight') ? 1 : 0) - (kd.has('ArrowLeft') ? 1 : 0);
    if (dirx && !r.sw && ['ready', 'tap', 'flip'].includes(r.phase)) r.az = clamp(r.az + dirx * 0.025, -1, 1);
    if (input.keys.pressed.has('Space') || input.keys.pressed.has('Enter')) padPress();
    if (p.pressed) {
      if (inRect(LY.pad, p.x, p.y)) { tc.mode = 'pad'; tc.pad = true; padPress(); }
      else if (!(inRect(LY.pause, p.x, p.y) || inRect(LY.think, p.x, p.y))) {
        if (r.phase === 'result' || r.phase === 'fly') { skipResult(r, Rn); tc.mode = null; }
        else {
          tc.mode = 'aim';
          if (inRect(LY.fan, p.x, p.y) && !r.sw && ['ready', 'tap', 'flip'].includes(r.phase)) { const F = LY.fan, ang = Math.atan2(p.x - (F.x + F.w / 2), (F.y + F.h - 10) - p.y); r.az = clamp(ang / (AIM_MAX * DEG), -1, 1); }
          tc.sx = p.x; tc.az0 = r.az;
        }
      }
    }
    if (tc.mode === 'aim' && p.down && !r.sw && ['ready', 'tap', 'flip'].includes(r.phase)) r.az = clamp(tc.az0 + (p.x - tc.sx) / LY.aimR, -1, 1);
    if (p.released) { tc.mode = null; tc.pad = false; }
  }

  // ---- computer striker (rival innings) ---------------------------------------------------------------------------------------------------------
  function botDrive(skill) {
    const r = state.r;
    if (r.phase === 'ready' && !plan) { plan = planChance(r, Rn, skill, skill * 0.9 + 0.05); r.az = plan.az; }
    if (r.phase === 'tap' && plan && r.pt >= plan.tapAt) tapNow(r, Rn);
    if (r.phase === 'flip' && plan && !r.sw && r.fp >= idealPress(r.flip) + plan.swEr) swingNow(r, Rn, plan.az);
    if (r.phase === 'result') plan = null;
  }

  // ---- play update -----------------------------------------------------------------------------------------------------------------------------------
  const slow = (r) => (r.phase === 'swing' ? 0.55 : r.phase === 'fly' && r.ft < 0.45 && r.sw && r.sw.q > 0.6 ? 0.6 : 1);
  function stepEngine(dt) {
    const r = state.r;
    stepRound(r, Rn, dt * slow(r));
    processEvents();
  }

  function updatePlay(dt, input) {
    const r = state.r, p = input.pointer;
    if (state.paused) {
      if (p.pressed) {
        const PM = LY.pauseMenu;
        if (inRect(PM.resume, p.x, p.y) || inRect(LY.pause, p.x, p.y)) { state.paused = false; sfx('ui'); }
        else if (inRect(PM.sound, p.x, p.y)) { state.prefs.sound = !state.prefs.sound; audio.setMuted(!state.prefs.sound); savePrefs(); }
        else if (inRect(PM.quit, p.x, p.y)) { state.paused = false; go('title'); }
      }
      if (input.keys.pressed.has('KeyP')) state.paused = false;
      return;
    }
    if (state.think.open) {
      if (p.pressed && inRect(LY.thinkCard.btn, p.x, p.y)) { state.think.open = false; sfx('ui'); }
      if (input.keys.pressed.has('KeyT') || input.keys.pressed.has('Escape')) state.think.open = false;
      return;
    }
    if (p.pressed && inRect(LY.pause, p.x, p.y)) { state.paused = true; sfx('ui'); return; }
    if (p.pressed && inRect(LY.think, p.x, p.y)) { openThink(); return; }
    if (input.keys.pressed.has('KeyP')) { state.paused = true; return; }
    if (input.keys.pressed.has('KeyT')) openThink();
    if (r.phase === 'end') {
      stepRound(r, Rn, dt); updateView(dt);
      if (r.pt > 1.5 || (p.pressed && r.pt > 0.6)) afterRound();
      return;
    }
    if (r.bot) {
      if (p.pressed && inRect(LY.skip, p.x, p.y)) { state.fast = !state.fast; sfx('ui'); }
      if (input.keys.pressed.has('KeyF')) state.fast = !state.fast;
      for (let s = 0; s < (state.fast ? 4 : 1); s++) {
        botDrive(r.bot); stepEngine(dt); updateView(dt);
        if (r.phase === 'end') break;
      }
      return;
    }
    playInput(input);
    stepEngine(dt);
    updateView(dt);
  }

  // ---- auto play -------------------------------------------------------------------------------------------------------------------------------------
  function updateAuto(dt, input) {
    const r = state.r, a = state.auto, p = input.pointer;
    if (state.paused) {
      if (p.pressed && (inRect(LY.auto.pause, p.x, p.y) || inRect(LY.pause, p.x, p.y))) { state.paused = false; sfx('ui'); }
      if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Space')) state.paused = false;
      return;
    }
    if (p.pressed) {
      const A = LY.auto;
      if (inRect(A.pause, p.x, p.y) || inRect(LY.pause, p.x, p.y)) { state.paused = true; sfx('ui'); return; }
      if (inRect(A.speed, p.x, p.y)) { a.speed = a.speed >= 4 ? 1 : a.speed * 2; sfx('ui'); }
      else if (inRect(A.dec, p.x, p.y)) { state.prefs.thinkIdx = clamp(state.prefs.thinkIdx - 1, 0, 3); savePrefs(); sfx('ui'); }
      else if (inRect(A.inc, p.x, p.y)) { state.prefs.thinkIdx = clamp(state.prefs.thinkIdx + 1, 0, 3); savePrefs(); sfx('ui'); }
      else if (inRect(A.exit, p.x, p.y)) { go('title'); return; }
    }
    if (input.keys.pressed.has('KeyP')) { state.paused = true; return; }
    if (r.phase === 'end') { stepRound(r, Rn, dt); updateView(dt); if (r.pt > 1.5) afterRound(); return; }
    for (let s = 0; s < a.speed; s++) { autoStep(DT); if (state.scene !== 'auto') return; }
    updateView(dt);
  }

  function autoStep(dt) {
    const r = state.r, a = state.auto;
    if (a.phase === 'think' || a.phase === 'reveal') {
      a.timer -= dt;
      if (a.phase === 'think') {
        const all = a.fullLines, frac = clamp(1 - a.timer / a.total, 0, 1);
        a.lines = all.slice(0, Math.max(1, Math.min(all.length, Math.ceil(frac * all.length * 1.05))));
      }
      if (a.timer <= 0) {
        if (a.phase === 'think') { a.phase = 'reveal'; a.revealing = true; a.total = 2; a.timer = 2; a.lines = a.fullLines.concat([a.decision]); }
        else { a.phase = 'act'; a.revealing = false; a.lines = a.fullLines.concat([a.decision]); r.hold = false; }
      }
      return;
    }
    stepEngine(dt);
    if (r.phase === 'ready') {
      const key = `${r.n}:${r.hits.length}`;
      if (a.key !== key) {
        a.key = key; r.hold = true;
        plan = planChance(r, Rn, 0.86, 0.9);
        a.plan = plan;
        a.phase = 'think'; a.total = THINK_STEPS[state.prefs.thinkIdx]; a.timer = a.total; a.revealing = false;
        a.fullLines = plan.reasons.slice();
        a.decision = `Decision: aim ${describeAz(plan.az)}, press on the gold, swing as the ring closes.`;
        a.lines = a.fullLines.slice(0, 1);
        r.az = plan.az;
      }
    }
    if (r.phase === 'tap' && plan && r.pt >= plan.tapAt) tapNow(r, Rn);
    if (r.phase === 'flip' && plan && !r.sw && r.fp >= idealPress(r.flip) + plan.swEr) swingNow(r, Rn, plan.az);
  }

  // ---- UI scenes -------------------------------------------------------------------------------------------------------------------------------------
  function uiInput(input) {
    const p = input.pointer, ui = state.ui, U = state._ui;
    if (wheelInput.dy) { ui.scroll = clamp(ui.scroll + wheelInput.dy, 0, U.maxS); wheelInput.dy = 0; }
    if (p.pressed) {
      const bar = U.bar;
      const onBar = !!(bar && U.thumb && U.maxS > 0 && p.x >= bar.x - 16 && p.x <= bar.x + bar.w + 16 && p.y >= bar.y && p.y <= bar.y + bar.h);
      ui.drag = { y0: p.y, s0: ui.scroll, moved: onBar, x0: p.x, sb: onBar };
    }
    if (ui.drag && p.down) {
      if (ui.drag.sb) { const t = U.thumb, bar = U.bar; ui.scroll = clamp((p.y - bar.y - t.h / 2) / Math.max(1, bar.h - t.h), 0, 1) * U.maxS; }
      else { const dy = p.y - ui.drag.y0; if (Math.abs(dy) > 12) ui.drag.moved = true; if (ui.drag.moved) ui.scroll = clamp(ui.drag.s0 - dy, 0, U.maxS); }
    }
    for (const k of input.keys.pressed) {
      if (k === 'ArrowDown') ui.scroll = clamp(ui.scroll + 80, 0, U.maxS);
      if (k === 'ArrowUp') ui.scroll = clamp(ui.scroll - 80, 0, U.maxS);
      if (k === 'PageDown') ui.scroll = clamp(ui.scroll + U.view.h * 0.9, 0, U.maxS);
      if (k === 'PageUp') ui.scroll = clamp(ui.scroll - U.view.h * 0.9, 0, U.maxS);
      if (k === 'Home') ui.scroll = 0;
      if (k === 'End') ui.scroll = U.maxS;
      if (k === 'Escape') uiTap('back');
      if (k === 'Enter' || k === 'Space') {
        if (state.scene === 'title') { beginRound('solo', { level: state.prefs.level, field: config.demo ? 'lamp' : state.prefs.field }); return; }
        const prim = U.footer.find((f) => ['start', 'next', 'again'].includes(f.id)); if (prim) uiTap(prim.id);
      }
    }
    if (p.released && ui.drag) {
      const d = ui.drag; ui.drag = null;
      if (d.moved) return;
      const x = p.x, y = p.y;
      if (inRect(LY.zoom.dec, x, y)) { state.prefs.textIdx = clamp(state.prefs.textIdx - 1, 0, TEXT_SCALES.length - 1); savePrefs(); return; }
      if (inRect(LY.zoom.inc, x, y)) { state.prefs.textIdx = clamp(state.prefs.textIdx + 1, 0, TEXT_SCALES.length - 1); savePrefs(); return; }
      if (U.lockTap && state.scene === 'title' && inRect(U.lockTap, x, y)) { state.lockDown = state.t + 0.25; env.openArcforgeHome?.(); return; }
      for (const f of U.footer) if (inRect(f.rect, x, y)) { uiTap(f.id); return; }
      if (y >= U.view.y && y <= U.view.y + U.view.h) for (const h of U.hits) if (inRect(h.rect, x, y)) { uiTap(h.id); return; }
    }
  }

  function uiTap(id) {
    const sc = state.scene, pf = state.prefs;
    sfx('ui');
    if (id === 'back') {
      if (sc === 'setup') go('modes'); else if (['modes', 'settings', 'howto', 'about', 'rules', 'lineup'].includes(sc)) go('title');
      return;
    }
    switch (sc) {
      case 'title':
        if (id === 'play') go('modes');
        else if (id === 'auto') beginRound('auto', { level: pf.level, field: config.demo ? 'lamp' : pf.field });
        else if (['howto', 'rules', 'about', 'settings'].includes(id)) go(id);
        break;
      case 'modes': {
        if (!id.startsWith('mode:')) break;
        const k = id.slice(5);
        if (config.demo && k !== 'solo') { sfx('lose'); break; }
        goSetup(k); break;
      }
      case 'setup': {
        const su = state.setup;
        if (id.startsWith('level:')) su.level = Number(id.slice(6));
        else if (id.startsWith('field:')) su.field = id.slice(6);
        else if (id === 'start') startFromSetup();
        break;
      }
      case 'lineup': if (id === 'next') matchStriker(); break;
      case 'settings':
        if (id === 'set:sound') { pf.sound = !pf.sound; audio.setMuted(!pf.sound); }
        else if (id === 'set:assist') pf.assist = (pf.assist + 1) % 3;
        else if (id === 'set:guide') pf.guide = !pf.guide;
        else if (id === 'set:pad') pf.padLeft = !pf.padLeft;
        else if (id === 'set:hand') pf.lefty = !pf.lefty;
        else if (id === 'set:think') pf.thinkIdx = (pf.thinkIdx + 1) % 4;
        else if (id === 'set:restore') monetization.restore();
        savePrefs(); break;
      case 'recap': if (id === 'next') afterRecap(); break;
      case 'results':
        if (id === 'again') { if (state.results.mode === 'match') goSetup('match'); else { const l = state.lastStart; beginRound(l.kind === 'auto' ? 'solo' : l.kind, l.o); } }
        else if (id === 'menu') go('title');
        break;
      case 'demolimit':
        if (id === 'auto') beginRound('auto', { level: pf.level, field: 'lamp' }); else if (id === 'menu') go('title'); break;
      default: break;
    }
  }

  const noInput = () => ({ pointer: { pressed: false, released: false, down: false, x: 0, y: 0 }, keys: { pressed: new Set(), down: new Set() } });
  return {
    update(dt, input) {
      host.zoom = Math.min(2, TEXT_SCALES[clamp(state.prefs.textIdx, 0, TEXT_SCALES.length - 1)]); host.padLeft = state.prefs.padLeft;
      syncLayout(meta.width, meta.height);
      if (state.freeze) return;
      state.tick += 1;
      setPress(input.pointer.down ? input.pointer.x : null, input.pointer.y);
      const sc = state.scene;
      if (!state.paused) state.t += dt;
      playSfxQueue();
      if (sc === 'play') updatePlay(dt, input);
      else if (sc === 'auto') updateAuto(dt, input);
      else uiInput(input);
    },
    render(ctx, view) { host.zoom = Math.min(2, TEXT_SCALES[clamp(state.prefs.textIdx, 0, TEXT_SCALES.length - 1)]); host.padLeft = state.prefs.padLeft; syncLayout(view?.width ?? meta.width, view?.height ?? meta.height); renderScene(ctx, state); },
    getState: () => state,
    // Auto Play, the menus, the rival's innings and recaps are free; only real striking uses up the free preview. Pause and the Think card do not either.
    isPreviewExempt: () => state.scene !== 'play' || state.paused || state.think.open || !!(state.r && (state.r.bot || state.r.phase === 'end')),
    debug: {
      state,
      freeze: (b) => { state.freeze = b; },
      go: (s) => { state.scene = s; state.ui.scroll = 0; },
      start: (kind, o) => beginRound(kind, o),
      engine: () => ({ r: state.r, R: Rn }),
      setPrefs: (o) => Object.assign(state.prefs, o),
      steps: (n) => { for (let i = 0; i < n; i++) { if (state.scene === 'auto') updateAuto(DT, noInput()); else if (state.scene === 'play' && !state.paused) { const r = state.r; if (r.bot) botDrive(r.bot); stepEngine(DT); updateView(DT); } } },
      tap: () => tapNow(state.r, Rn),
      swing: (az) => swingNow(state.r, Rn, az ?? null),
      pend: () => penPos(state.r),
      idealPress: () => idealPress(state.r.flip),
      afterRound, openThink, afterRecap,
      setup: (mode) => goSetup(mode),
      lineup: (level = 1, field = 'lane') => { Rn = streams('match'); state.match = newMatch(level, field); go('lineup'); },
      matchStart: matchStriker,
      results: (o) => { state.results = o; go('results'); },
      recap: (o) => { state.recap = o; go('recap'); },
      angle: (a) => { state.r.az = clamp(a, -1, 1); },
    },
  };
}
