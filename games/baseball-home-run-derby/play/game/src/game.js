// Moonshot Baseball: flow and input. Drawing lives in view.js / scene2d.js, the round in engine.js, physics in ball.js, the bracket in derby.js.
// This file is the only one that mutates `state`.
//
// Batting: HOLD and DRAG to aim (right/left = which part of the field, up = lift), LIFT your finger to swing. A flick or a plain tap also works.
import { createRng } from '../kit/rng.js';
import { W, H, PARK_KEYS, PITCHES, clamp, DT, FIELD } from './core.js';
import { createRound, stepRound, swing, skipResult, planSwing } from './engine.js';
import { aimFromDrag, DEFAULT_AIM, makePitch } from './ball.js';
import { newBracket, settleYou, settleSwingOff, finishRound, youMatch, ROUND_NAMES } from './derby.js';
import { TEXT_SCALES, inRect, setPress } from './ui.js';
import { renderScene } from './view.js';
import { LY, syncLayout, host } from './layout.js';
import { cameraFor, project } from './cam.js';

export const meta = { width: W, height: H, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };

const THINK_STEPS = [2, 5, 8, 10];
const DEMO_ROUNDS = 2;
const ASSISTS = [1.25, 1, 0.85];
const hid = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true });

export function createGame(env) {
  const { rng, storage, audio, config, monetization } = env;
  const freshV = () => ({ parts: [], flash: 0, cut: 0, seed: 7, t: 0, crowd: 0, fw: [] });
  const state = {
    scene: 'title', t: 0, tick: 0,
    prefs: { sound: true, hand: 1, assist: 1, textIdx: 0, thinkIdx: 1, level: 1, park: 'harbor', guide: true, coach: 0 },
    ui: { scroll: 0, drag: null },
    setup: null, r: null, br: null, recap: null, results: null, v: freshV(), paused: false,
    think: { open: false, lines: [] },
    auto: { phase: 'idle', timer: 0, total: 0, lines: [], fullLines: [], decision: '', speed: 1, revealing: false, key: '', plan: null },
    touch: { down: false, sx: 0, sy: 0, cur: null, t0: 0 },
    records: {}, demoPlayed: 0, kind: 'quick', lastStart: null,
  };
  hid(state, 'env', env);
  hid(state, '_ui', { hits: [], footer: [], view: { x: 0, y: 0, w: W, h: H }, maxS: 0, bar: null, thumb: null });
  syncLayout(meta.width, meta.height);
  let Rn = null;
  const sfxq = [];
  let seenEv = 0;

  // ---- persistence -------------------------------------------------------------------------------------------------------------
  const savePrefs = () => storage.set('prefs', state.prefs);
  storage.get('prefs', null).then((p) => {
    if (!p) return;
    const pf = state.prefs;
    pf.sound = p.sound ?? true; pf.hand = p.hand === -1 ? -1 : 1; pf.assist = clamp(p.assist ?? 1, 0, 2); pf.textIdx = clamp(p.textIdx ?? 0, 0, TEXT_SCALES.length - 1);
    pf.thinkIdx = clamp(p.thinkIdx ?? 1, 0, 3); pf.level = clamp(p.level ?? 1, 0, 2); pf.park = PARK_KEYS.includes(p.park) ? p.park : 'harbor'; pf.guide = p.guide !== false; pf.coach = clamp(Number(p.coach) || 0, 0, 99);
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
      case 'release': tone({ freq: 240, to: 120, dur: 0.16, type: 'sine', vol: 0.1 }); tone({ freq: 900, to: 300, dur: 0.1, type: 'sawtooth', vol: 0.03 }); break;
      case 'swish': tone({ freq: 900, to: 220, dur: 0.16, type: 'sawtooth', vol: 0.08 }); break;
      case 'crack': tone({ freq: 2400, to: 320, dur: 0.05, type: 'square', vol: 0.18 * (0.4 + q * 0.6) }); tone({ freq: 150, to: 70, dur: 0.12, type: 'triangle', vol: 0.34 * (0.5 + q * 0.5) }); tone({ freq: 1300, to: 500, dur: 0.05, type: 'sawtooth', vol: 0.1 }, 0.01); break;
      case 'thud': tone({ freq: 190, to: 100, dur: 0.1, type: 'triangle', vol: 0.25 }); break;
      case 'roar': for (let k = 0; k < 7; k++) tone({ freq: 130 + k * 47, to: 170 + k * 40, dur: 1.4 + k * 0.05, type: 'sawtooth', vol: 0.022 }, k * 0.03); for (let k = 0; k < 8; k++) tone({ freq: 1800 + (k * 311) % 900, to: 900, dur: 0.04, type: 'square', vol: 0.03 }, 0.2 + k * 0.09); break;
      case 'cheer': for (let k = 0; k < 4; k++) tone({ freq: 150 + k * 60, to: 200 + k * 50, dur: 0.7, type: 'sawtooth', vol: 0.016 }, k * 0.03); break;
      case 'groan': tone({ freq: 220, to: 120, dur: 0.6, type: 'sawtooth', vol: 0.03 }); tone({ freq: 160, to: 90, dur: 0.6, type: 'sawtooth', vol: 0.025 }, 0.05); break;
      case 'whistle': tone({ freq: 500, to: 2400, dur: 0.7, type: 'sine', vol: 0.05 }); tone({ freq: 2400, to: 400, dur: 0.15, type: 'square', vol: 0.05 }, 0.7); break;
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
  const camNow = () => (env.view3d && env.view3d.active && env.view3d.cam) || cameraFor(state.r, LY.w / LY.h, state.r?.batter.hand ?? 1);

  // ---- starting rounds ----------------------------------------------------------------------------------------------------------------
  const streams = (kind) => {
    if (kind === 'daily') { const g = createRng(config.day * 7 + 3); return { p: g.fork(), h: g.fork(), a: g.fork() }; }
    return { p: rng.fork(), h: rng.fork(), a: rng.fork() };
  };

  function beginRound(kind, o = {}) {
    const isAuto = kind === 'auto';
    if (!isAuto && config.demo && !o.swingOff && state.demoPlayed >= DEMO_ROUNDS) { go('demolimit'); return; }
    if (!isAuto && config.demo && !o.swingOff) { state.demoPlayed += 1; storage.set('demoPlayed', state.demoPlayed); }
    if (!o.keepStreams || !Rn) Rn = streams(kind);
    const pf = state.prefs;
    state.kind = kind; state.lastStart = { kind, o };
    state.r = createRound({
      mode: kind, park: o.park ?? pf.park, level: o.level ?? pf.level, round: o.round ?? 2, label: o.label ?? (kind === 'daily' ? 'Daily round' : kind === 'auto' ? 'Auto Play' : 'Quick round'),
      batter: o.batter ?? { ...FIELD[0], name: 'You', hand: pf.hand, pow: 1, con: 1, skin: 'tan', hair: 'brown', trim: '#ffcf4a' }, swingOff: !!o.swingOff, assist: ASSISTS[pf.assist], auto: isAuto,
    }, Rn);
    state.v = freshV(); state.touch = { down: false, sx: 0, sy: 0, cur: null, t0: 0 };
    state.think = { open: false, lines: [] }; state.paused = false; state.results = null;
    state.auto = { phase: 'idle', timer: 0, total: 0, lines: [], fullLines: [], decision: '', speed: 1, revealing: false, key: '', plan: null };
    seenEv = state.r.evId;
    state.scene = isAuto ? 'auto' : 'play'; state.ui.scroll = 0;
    if (!isAuto) monetization.track('round_start', { kind });
  }

  const go = (scene) => { state.scene = scene; state.ui.scroll = 0; state.paused = false; state.think.open = false; sfx('ui'); };

  const goSetup = (mode) => {
    const pf = state.prefs;
    state.setup = { mode, title: mode === 'bracket' ? 'The Bracket' : mode === 'daily' ? 'Daily Round' : 'Quick Round', blurb: mode === 'bracket' ? 'Quarter-final, semi-final, final. Win all three.' : mode === 'daily' ? 'Everyone gets the same pitches today.' : 'One round: hit as many home runs as you can before the outs run out.', level: pf.level, park: config.demo ? 'lantern' : pf.park };
    go('setup');
  };

  function startFromSetup() {
    const su = state.setup, pf = state.prefs;
    pf.level = su.level; pf.park = su.park; savePrefs();
    if (su.mode === 'bracket') {
      Rn = streams('bracket');
      state.br = newBracket(Rn, su.level, su.park);
      go('bracket');
    } else beginRound(su.mode, { level: su.level, park: su.park, round: 2 });
  }

  function startBracketRound() {
    const b = state.br;
    beginRound('bracket', { level: b.level, park: b.park, round: b.rd, label: ROUND_NAMES[b.rd], keepStreams: true });
  }

  // ---- end of a round ------------------------------------------------------------------------------------------------------------------------
  const summary = (r) => ({ name: r.batter.name, hr: r.hr, score: r.score, longest: r.longest, totalDist: Math.round(r.totalDist), spot: r.spotHits, moon: r.moonshots, hrList: r.hrList.slice(), pitches: r.pitches });

  function afterRound() {
    const r = state.r, rec = state.records;
    const sum = summary(r);
    if (state.scene === 'auto') {
      state.results = { headline: 'Auto Play finished', sub: `The computer hit ${r.hr} home runs.`, hr: r.hr, score: r.score, longest: r.longest, spot: r.spotHits, moon: r.moonshots, pitches: r.pitches, perfect: r.stats.perfect, good: r.stats.good, best: null, mode: 'auto' };
      go('results'); return;
    }
    rec.bestHr = Math.max(rec.bestHr ?? 0, r.hr); rec.bestDist = Math.max(rec.bestDist ?? 0, r.longest); rec.played = (rec.played ?? 0) + 1;
    monetization.track('round_end', { kind: state.kind, hr: r.hr, score: r.score });
    if (state.kind === 'bracket') {
      const b = state.br;
      if (r.swingOff) {
        const opp = settleSwingOff(Rn, b, r.score);
        const m = youMatch(b);
        state.recap = { headline: m.winner === 0 ? 'You win the swing-off!' : 'You lose the swing-off', sub: `${r.score} to ${opp.score} in three swings.`, you: m.sa, opp: m.sb, tie: false, win: m.winner === 0 };
      } else {
        const { tie, opp } = settleYou(Rn, b, sum);
        const m = youMatch(b);
        state.recap = { headline: tie ? 'All square!' : m.winner === 0 ? 'You move on!' : 'Knocked out', sub: `${sum.score} to ${opp.score}`, you: sum, opp, tie, win: m.winner === 0 };
      }
      saveRecords(); sfx(state.recap.win ? 'win' : state.recap.tie ? 'cheer' : 'lose');
      go('recap'); return;
    }
    if (state.kind === 'daily') { rec.dailyScore = Math.max(rec.dailyDay === config.day ? rec.dailyScore ?? 0 : 0, r.score); rec.dailyDay = config.day; }
    state.results = { headline: r.hr >= 8 ? 'Monster round!' : r.hr >= 4 ? 'Nice round!' : r.hr >= 1 ? 'Round over' : 'No luck this time', sub: `${r.hr} home runs, ${r.score} points.`, hr: r.hr, score: r.score, longest: r.longest, spot: r.spotHits, moon: r.moonshots, pitches: r.pitches, perfect: r.stats.perfect, good: r.stats.good, best: rec.bestHr, mode: state.kind };
    saveRecords(); sfx(r.hr >= 4 ? 'win' : 'lose');
    go('results');
  }

  function afterRecap() {
    const rc = state.recap, b = state.br;
    if (rc.tie) { beginRound('bracket', { level: b.level, park: b.park, round: b.rd, label: 'Swing-off', swingOff: true, keepStreams: true }); return; }
    finishRound(Rn, b);
    const rec = state.records, r = state.r;
    if (b.over) {
      if (b.champion) { rec.titles = (rec.titles ?? 0) + 1; rec.bestRound = 'Champion'; } else if (rec.bestRound !== 'Champion') { const idx = ROUND_NAMES.indexOf(rec.bestRound); if (b.outRound > idx) rec.bestRound = ROUND_NAMES[b.outRound]; }
      saveRecords();
      state.results = { headline: b.champion ? 'CHAMPION!' : `Out in the ${ROUND_NAMES[b.outRound].toLowerCase()}`, sub: b.champion ? 'You won the bracket.' : 'Better luck next time.', hr: r.hr, score: r.score, longest: r.longest, spot: r.spotHits, moon: r.moonshots, pitches: r.pitches, perfect: r.stats.perfect, good: r.stats.good, best: null, mode: 'bracket' };
      sfx(b.champion ? 'win' : 'lose'); go('results');
    } else go('bracket');
  }

  // ---- hints -----------------------------------------------------------------------------------------------------------------------------------
  function hintLines(r) {
    const p = r.pitch, T = PITCHES[p.type], lines = [];
    lines.push(`${T.name}: ${T.tell}`);
    lines.push(p.h < 0.62 ? 'It will cross low: drag a bit higher for a steeper swing.' : p.h > 0.92 ? 'It will cross high: a flatter swing is safest.' : 'It will cross about belt high: a medium lift is right.');
    const inside = -r.batter.hand * p.P.x;
    lines.push(inside > 0.1 ? 'It is on the inside half, so it tends to be pulled: aim a little the other way.' : inside < -0.1 ? 'It is on the outer half: it tends to go the other way, so aim toward your pull side.' : 'It is over the middle of the plate.');
    const names = ['far left', 'left', 'centre', 'right', 'far right'];
    lines.push(`The ${names[r.spot]} stands are lit: a home run there counts double. Lift when the ball reaches the glowing mark on the timing bar.`);
    return lines;
  }
  function openThink() {
    const r = state.r;
    if (r.hints <= 0 || state.think.open || !['ready', 'windup'].includes(r.phase)) return;
    r.hints -= 1; state.think = { open: true, lines: hintLines(r) }; sfx('ui');
  }

  // ---- engine events -> sound and particles -------------------------------------------------------------------------------------------------
  function processEvents() {
    const r = state.r, v = state.v;
    for (const e of r.events) {
      if (e.id <= seenEv) continue;
      seenEv = e.id;
      switch (e.k) {
        case 'release': sfx('release'); break;
        case 'whiff': sfx('swish'); break;
        case 'contact': {
          sfx('crack', e.q);
          const cam = camNow(), p = project(cam, LY.w, LY.h, r.hit.bp, {});
          if (p.ok) { flashAt(p.x, p.y, 110 + 150 * e.q); ring(p.x, p.y, '#fff4c8', 10); burst(p.x, p.y, 14, '#ffe08a', 460); }
          v.flash = 0.25 + 0.2 * e.q;
          break;
        }
        case 'homerun': sfx('roar'); sfx('whistle'); v.crowd = 1; for (let k = 0; k < (e.moon ? 7 : 4); k++) v.fw.push({ at: v.t + 0.5 + k * 0.28, x: LY.w * (0.15 + 0.7 * vr()), y: LY.h * (0.1 + 0.25 * vr()), c: ['#ffd34d', '#ff6b57', '#7fd0ff', '#ffffff', '#b58cff'][k % 5] }); confetti(LY.cx, LY.h * 0.3, e.moon ? 90 : 55, ['#ffd34d', '#ff6b57', '#2ec4b6', '#fff4dc']); break;
        case 'out': sfx(e.kind === 'foul' ? 'thud' : 'groan'); break;
        default: break;
      }
    }
  }

  function updateView(dt) {
    const v = state.v; v.t += dt;
    v.flash *= 0.86; if (v.flash < 0.01) v.flash = 0;
    v.crowd = Math.max(0, v.crowd - dt * 0.35);
    for (let i = v.fw.length - 1; i >= 0; i--) { const f = v.fw[i]; if (v.t >= f.at) { v.fw.splice(i, 1); spawn(34, (j) => { const a = (j / 34) * 6.283, sp = 260 + 90 * vr(); return { kind: 'dot', x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3 + vr() * 2.5, life: 1.1, max: 1.1, color: f.c, g: 160 }; }); ring(f.x, f.y, f.c, 5); sfx('cheer'); } }
    for (const q of v.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g ?? 0) * dt; q.life -= dt; if (q.grow) q.r += q.grow * dt; if (q.rot != null) q.rot += dt * 8; }
    v.parts = v.parts.filter((q) => q.life > 0);
    const r = state.r;
    if (r.phase === 'ready' && r.pt < 0.25 && r.pitches > 0) v.cut = 1 - r.pt / 0.25; else v.cut = Math.max(0, v.cut - dt * 6);
  }

  // ---- batting input -------------------------------------------------------------------------------------------------------------------------
  const kb = { s: 0, l: 0 };
  function batInput(input) {
    const r = state.r, p = input.pointer, tc = state.touch, tick = state.tick;
    const kd = input.keys.down;
    const dirx = (kd.has('ArrowRight') ? 1 : 0) - (kd.has('ArrowLeft') ? 1 : 0), diry = (kd.has('ArrowUp') ? 1 : 0) - (kd.has('ArrowDown') ? 1 : 0);
    if (dirx || diry) { kb.s = clamp(kb.s + dirx * 0.03, -1, 1); kb.l = clamp(kb.l + diry * 0.5, -20, 18); r.aim = { s: kb.s, loft: clamp(DEFAULT_AIM.loft + kb.l, 6, 44), active: true }; }
    if (input.keys.pressed.has('Space') || input.keys.pressed.has('Enter')) {
      if (r.phase === 'pitch' && !r.sw) swing(r, Rn, { s: kb.s, loft: clamp(DEFAULT_AIM.loft + kb.l, 6, 44) });
      else if (r.phase === 'result') skipResult(r, Rn);
      r.aim.active = false;
    }
    if (p.pressed) {
      if (r.phase === 'result' || r.phase === 'flight') skipResult(r, Rn);
      tc.down = !(inRect(LY.pause, p.x, p.y) || inRect(LY.think, p.x, p.y));
      tc.sx = p.x; tc.sy = p.y; tc.cur = [p.x, p.y]; tc.t0 = tick;
    }
    if (tc.down) {
      tc.cur = [p.x, p.y];
      const dx = p.x - tc.sx, dy = p.y - tc.sy;
      if (Math.hypot(dx, dy) > 14) r.aim = { ...aimFromDrag(dx, dy), active: true }; else r.aim = { ...DEFAULT_AIM, active: true };
      if (p.released) {
        tc.down = false;
        const a = Math.hypot(dx, dy) > 14 ? aimFromDrag(dx, dy) : DEFAULT_AIM;
        if (r.phase === 'pitch' && !r.sw) swing(r, Rn, a);
        r.aim = { s: 0, loft: DEFAULT_AIM.loft, active: false };
      }
    }
  }

  // ---- play update ----------------------------------------------------------------------------------------------------------------------------
  function stepEngine(dt) {
    stepRound(state.r, Rn, dt);
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
      if (r.pt > 1.4 || (p.pressed && r.pt > 0.5)) afterRound();
      return;
    }
    batInput(input);
    stepEngine(dt);
    updateView(dt);
    if (r.phase === 'result' && r.pt < 0.02) { state.prefs.coach = Math.min(99, state.prefs.coach + 1); if (state.prefs.coach % 3 === 0) savePrefs(); }
  }

  // ---- auto play ------------------------------------------------------------------------------------------------------------------------------
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
    if (r.phase === 'end') { stepRound(r, Rn, dt); updateView(dt); if (r.pt > 1.4) afterRound(); return; }
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
      const key = `${r.pitches}:${r.log.length}`;
      if (a.key !== key) {
        a.key = key; r.hold = true;
        const plan = planSwing(r, Rn, 0.86, 0.95);
        a.plan = plan;
        a.phase = 'think'; a.total = THINK_STEPS[state.prefs.thinkIdx]; a.timer = a.total; a.revealing = false;
        a.fullLines = plan.reasons.slice();
        const aimWord = Math.abs(plan.aim.s) < 0.15 ? 'up the middle' : plan.aim.s > 0 ? 'to the right side' : 'to the left side';
        a.decision = plan.swing ? `Decision: swing, aim ${aimWord}, ${plan.aim.loft > 30 ? 'high' : plan.aim.loft > 20 ? 'with medium lift' : 'on a line'}.` : 'Decision: let this one go.';
        a.lines = a.fullLines.slice(0, 1);
      }
    }
    if (r.phase === 'pitch' && a.plan && a.plan.swing && !r.sw && r.pt >= a.plan.ts) { swing(r, Rn, a.plan.aim); r.aim.active = false; }
    if ((r.phase === 'windup' || r.phase === 'pitch') && a.plan && !r.sw) r.aim = { s: a.plan.aim.s, loft: a.plan.aim.loft, active: a.plan.swing };
  }

  // ---- UI scenes -------------------------------------------------------------------------------------------------------------------------------
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
        if (state.scene === 'title') { beginRound('quick', { level: state.prefs.level, round: 2, park: config.demo ? 'lantern' : state.prefs.park }); return; }
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
      if (sc === 'setup') go('modes'); else if (['modes', 'settings', 'howto', 'about', 'rules'].includes(sc)) go('title');
      return;
    }
    switch (sc) {
      case 'title':
        if (id === 'play') go('modes');
        else if (id === 'auto') beginRound('auto', { level: pf.level, round: 2, park: config.demo ? 'lantern' : pf.park });
        else if (['howto', 'rules', 'about', 'settings'].includes(id)) go(id);
        break;
      case 'modes': {
        if (!id.startsWith('mode:')) break;
        const k = id.slice(5);
        if (config.demo && k !== 'quick') { sfx('lose'); break; }
        goSetup(k); break;
      }
      case 'setup': {
        const su = state.setup;
        if (id.startsWith('level:')) su.level = Number(id.slice(6));
        else if (id.startsWith('park:')) su.park = id.slice(5);
        else if (id === 'start') startFromSetup();
        break;
      }
      case 'settings':
        if (id === 'set:sound') { pf.sound = !pf.sound; audio.setMuted(!pf.sound); }
        else if (id === 'set:hand') pf.hand = -pf.hand;
        else if (id === 'set:assist') pf.assist = (pf.assist + 1) % 3;
        else if (id === 'set:guide') pf.guide = !pf.guide;
        else if (id === 'set:think') pf.thinkIdx = (pf.thinkIdx + 1) % 4;
        else if (id === 'set:restore') monetization.restore();
        savePrefs(); break;
      case 'howto': case 'about': case 'rules':
        if (id === 'back') go('title'); break;
      case 'bracket':
        if (id === 'next') startBracketRound(); else if (id === 'quit') go('title'); break;
      case 'recap':
        if (id === 'next') afterRecap(); break;
      case 'results':
        if (id === 'again') { if (state.results.mode === 'bracket') goSetup('bracket'); else { const l = state.lastStart; beginRound(l.kind, l.o); } }
        else if (id === 'menu') go('title');
        break;
      case 'demolimit':
        if (id === 'auto') beginRound('auto', { level: pf.level, round: 2, park: 'lantern' }); else if (id === 'menu') go('title'); break;
      default: break;
    }
  }

  const noInput = () => ({ pointer: { pressed: false, released: false, down: false, x: 0, y: 0 }, keys: { pressed: new Set(), down: new Set() } });
  return {
    update(dt, input) {
      host.zoom = Math.min(2, TEXT_SCALES[clamp(state.prefs.textIdx, 0, TEXT_SCALES.length - 1)]);
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
    render(ctx, view) { host.zoom = Math.min(2, TEXT_SCALES[clamp(state.prefs.textIdx, 0, TEXT_SCALES.length - 1)]); syncLayout(view?.width ?? meta.width, view?.height ?? meta.height); renderScene(ctx, state); },
    getState: () => state,
    // Auto Play, the menus and recaps are free; only real batting uses up the free preview. Pause and the Think card do not either.
    isPreviewExempt: () => state.scene !== 'play' || state.paused || state.think.open || (state.r && state.r.phase === 'end'),
    debug: {
      state,
      freeze: (b) => { state.freeze = b; },
      go: (s) => { state.scene = s; state.ui.scroll = 0; },
      start: (kind, o) => beginRound(kind, o),
      engine: () => ({ r: state.r, R: Rn }),
      setPrefs: (o) => Object.assign(state.prefs, o),
      steps: (n) => { for (let i = 0; i < n; i++) { if (state.scene === 'auto') updateAuto(DT, noInput()); else if (state.scene === 'play' && !state.paused) { stepEngine(DT); updateView(DT); } } },
      swingNow: (aim) => swing(state.r, Rn, aim ?? DEFAULT_AIM),
      setPitch: (type, x, y, spot) => { const r = state.r; r.pitch = makePitch(type, { x, y }, { x: -0.45, y: 1.95, hand: 1 }); if (spot != null) r.spot = spot; },
      afterRound, openThink,
      setup: (mode) => goSetup(mode),
      bracket: () => { Rn = streams('bracket'); state.br = newBracket(Rn, state.prefs.level, state.prefs.park); go('bracket'); },
      results: (o) => { state.results = o; go('results'); },
      recap: (o) => { state.recap = o; go('recap'); },
    },
  };
}
