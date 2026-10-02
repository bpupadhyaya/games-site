// Golden Hour Cricket: flow and input. Drawing lives in view.js / scene.js / art.js, the match in engine.js,
// physics in ball.js, fielding in field.js, brains in ai.js. This file is the only one that mutates `state`.
//
// Batting: SWIPE (direction = shot direction, speed = power, the moment it starts = timing); TAP = block.
// Bowling: pick a type, drag the ring on the pitch map, FLICK up to bowl. RUN button when the ball is live.
import { W, H, THEMES, LEVELS, clamp, lerp, DEG, DT } from './core.js';
import { MODES, createMatch, stepMatch, batSwing, callRun, bowlNow, popEvents, resumeAfterOverbreak, nextInnings, resolveFrozen, strikerOf, ballPos, requiredRate, runRate, bowlerOf } from './engine.js';
import { readyHint, runAdvice, planDelivery, localRng } from './ai.js';
import { deliveryPos, TYPES, TYPE_KEYS } from './ball.js';
import { PRESET_KEYS } from './field.js';
import { TEXT_SCALES, inRect, setPress } from './ui.js';
import { renderScene, sceneSpec, R as VR, PITCHMAP, fromMap, TYPE_CHIPS, FIELD_CHIPS, GO } from './view.js';
import { makeProj, toScreen, dropLayers } from './scene.js';

export const meta = { width: W, height: H };

const THINK_STEPS = [2, 5, 8, 10];
const DEMO_MATCHES = 2;
const hid = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true });

export function createGame(env) {
  const { rng, storage, audio, config, monetization } = env;
  const freshV = () => ({ trail: [], otrail: [], parts: [], shake: 0, flash: 0, swingT: -1, sinceSwing: 9, stumpsBroken: 0, stumpsAnim: null, view: 'delivery', t: 0, seed: 7 });
  const state = {
    scene: 'title', t: 0, tick: 0,
    prefs: { sound: true, hand: 1, assist: 1, textIdx: 0, thinkIdx: 1, level: 1, theme: 'stadium', overs: 5, coach: 0 },
    ui: { scroll: 0, pageIdx: 0, pageN: 1, drag: null },
    setup: null, m: null, v: freshV(), paused: false,
    think: { open: false, lines: [], plan: null },
    auto: { phase: 'idle', kind: 'ball', timer: 0, total: 0, lines: [], fullLines: [], decision: '', speed: 1, revealing: false, key: '', act: null },
    touch: { down: false, path: [], mode: null, committed: false, fired: false, aimDeg: null },
    results: null, replay: null, records: {}, demoPlayed: 0, modeKey: 'chase5', lastMode: null,
  };
  hid(state, 'env', env);
  hid(state, '_ui', { hits: [], footer: [], view: { x: 0, y: 0, w: W, h: H }, pages: null, maxS: 0 });
  let Rn = null; // the match rng streams (not part of the serializable state)
  const sfxq = [];

  // ---- persistence -----------------------------------------------------------------------------------------------
  const savePrefs = () => storage.set('prefs', state.prefs);
  storage.get('prefs', null).then((p) => {
    if (!p) return;
    const pf = state.prefs;
    pf.sound = p.sound ?? true; pf.hand = p.hand === -1 ? -1 : 1; pf.assist = clamp(p.assist ?? 1, 0, 2); pf.textIdx = clamp(p.textIdx ?? 0, 0, TEXT_SCALES.length - 1);
    pf.thinkIdx = clamp(p.thinkIdx ?? 1, 0, 3); pf.level = clamp(p.level ?? 1, 0, 3); pf.theme = ['stadium', 'backyard', 'beach'].includes(p.theme) ? p.theme : 'stadium'; pf.overs = [5, 10, 20].includes(p.overs) ? p.overs : 5; pf.coach = clamp(Number(p.coach) || 0, 0, 99);
    audio.setMuted(!pf.sound);
  });
  storage.get('records', {}).then((r) => { if (r && typeof r === 'object') state.records = r; });
  storage.get('demoPlayed', 0).then((n) => { state.demoPlayed = Math.max(state.demoPlayed, Number(n) || 0); });

  // ---- sound ---------------------------------------------------------------------------------------------------------
  const tone = (o, delay = 0) => { if (!state.prefs.sound) return; if (delay > 0) sfxq.push({ at: state.t + delay, o }); else audio.tone(o); };
  const sfx = (name, q = 1) => {
    switch (name) {
      case 'ui': tone({ freq: 520, to: 700, dur: 0.07, type: 'triangle', vol: 0.12 }); break;
      case 'release': tone({ freq: 300, to: 180, dur: 0.12, type: 'sine', vol: 0.1 }); break;
      case 'bounce': tone({ freq: 160, to: 90, dur: 0.07, type: 'triangle', vol: 0.22 }); break;
      case 'swish': tone({ freq: 900, to: 260, dur: 0.14, type: 'sawtooth', vol: 0.07 }); break;
      case 'crack': tone({ freq: 2200, to: 300, dur: 0.05, type: 'square', vol: 0.2 * (0.4 + q * 0.6) }); tone({ freq: 140, to: 70, dur: 0.1, type: 'triangle', vol: 0.3 }); tone({ freq: 1200, to: 500, dur: 0.04, type: 'sawtooth', vol: 0.1 }, 0.01); break;
      case 'thud': tone({ freq: 200, to: 110, dur: 0.1, type: 'triangle', vol: 0.25 }); break;
      case 'stumps': for (let k = 0; k < 6; k++) tone({ freq: 700 + k * 230, to: 260, dur: 0.1, type: 'square', vol: 0.07 }, k * 0.025); tone({ freq: 110, to: 60, dur: 0.25, type: 'triangle', vol: 0.3 }); break;
      case 'run': tone({ freq: 440, to: 520, dur: 0.06, type: 'triangle', vol: 0.1 }); break;
      case 'throw': tone({ freq: 700, to: 300, dur: 0.1, type: 'sine', vol: 0.1 }); break;
      case 'roar': for (let k = 0; k < 7; k++) tone({ freq: 130 + k * 47, to: 170 + k * 40, dur: 1.1 + k * 0.05, type: 'sawtooth', vol: 0.022 }, k * 0.03); for (let k = 0; k < 8; k++) tone({ freq: 1800 + (k * 311) % 900, to: 900, dur: 0.04, type: 'square', vol: 0.03 }, 0.2 + k * 0.09); break;
      case 'cheer': for (let k = 0; k < 5; k++) tone({ freq: 150 + k * 60, to: 200 + k * 50, dur: 0.7, type: 'sawtooth', vol: 0.018 }, k * 0.03); break;
      case 'groan': tone({ freq: 220, to: 120, dur: 0.6, type: 'sawtooth', vol: 0.035 }); tone({ freq: 160, to: 90, dur: 0.6, type: 'sawtooth', vol: 0.03 }, 0.05); break;
      case 'win': [523, 659, 784, 1046].forEach((f, k) => tone({ freq: f, dur: 0.3, type: 'sine', vol: 0.16 }, k * 0.14)); break;
      case 'lose': [392, 330, 262].forEach((f, k) => tone({ freq: f, dur: 0.34, type: 'triangle', vol: 0.16 }, k * 0.18)); break;
      default: break;
    }
  };
  const playSfxQueue = () => { for (let i = sfxq.length - 1; i >= 0; i--) if (sfxq[i].at <= state.t) { audio.tone(sfxq[i].o); sfxq.splice(i, 1); } };

  // ---- view-state helpers ------------------------------------------------------------------------------------------
  const vr = () => { const v = state.v; v.seed = (Math.imul(v.seed, 1664525) + 1013904223) >>> 0; return v.seed / 4294967296; };
  const spawn = (n, f) => { for (let i = 0; i < n; i++) state.v.parts.push(f(i)); };
  const confetti = (cx, cy, n, colors) => spawn(n, () => ({ kind: 'confetti', x: cx + (vr() - 0.5) * 80, y: cy, vx: (vr() - 0.5) * 520, vy: -200 - vr() * 520, r: 4 + vr() * 5, life: 1.6, max: 1.6, color: colors[Math.floor(vr() * colors.length)], rot: vr() * 6, g: 900 }));
  const burst = (x, y, n, color, sp = 300) => spawn(n, () => { const a = vr() * 6.283, s = sp * (0.3 + vr()); return { kind: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 3 + vr() * 4, life: 0.6, max: 0.6, color, g: 400 }; });
  const ring = (x, y, color, w = 6) => state.v.parts.push({ kind: 'ring', x, y, vx: 0, vy: 0, r: 8, life: 0.45, max: 0.45, color, w, g: 0, grow: 420 });
  const flashAt = (x, y, r) => state.v.parts.push({ kind: 'flash', x, y, vx: 0, vy: 0, r, life: 0.22, max: 0.22, g: 0 });

  const crowdFlash = (n) => spawn(n, () => ({ kind: 'dot', x: 40 + vr() * 640, y: 120 + vr() * 1000, vx: 0, vy: 0, r: 4 + vr() * 4, life: 0.25 + vr() * 0.5, max: 0.75, color: '#ffffff', g: 0 }));

  // ---- starting matches -----------------------------------------------------------------------------------------------
  const mkStreams = (modeKey) => {
    if (modeKey === 'daily') { const d = config.day * 7 + 3; return { m: localRng(d), f: localRng(d + 1), a: localRng(d + 2) }; }
    return { m: rng.fork(), f: rng.fork(), a: rng.fork() };
  };

  const startMatch = (modeKey, opts = {}) => {
    const isAuto = modeKey === 'auto';
    if (!isAuto && config.demo && state.demoPlayed >= DEMO_MATCHES) { go('demolimit'); return; }
    if (!isAuto && config.demo) { state.demoPlayed += 1; storage.set('demoPlayed', state.demoPlayed); }
    Rn = mkStreams(modeKey);
    const pf = state.prefs;
    const mode = MODES[modeKey];
    state.m = createMatch({ mode: modeKey, level: opts.level ?? pf.level, theme: opts.theme ?? (mode.theme ?? pf.theme), hand: pf.hand, assist: pf.assist }, Rn);
    state.modeKey = modeKey; state.lastMode = { modeKey, opts };
    state.v = freshV(); state.touch = { down: false, path: [], mode: null, committed: false, fired: false, aimDeg: null };
    state.think = { open: false, lines: [], plan: null }; state.paused = false; state.results = null; state.replay = null;
    state.auto = { phase: 'idle', kind: 'ball', timer: 0, total: 0, lines: [], fullLines: [], decision: '', speed: 1, revealing: false, key: '', act: null };
    state.scene = isAuto ? 'auto' : 'play';
    state.ui.scroll = 0;
    lastView = 'delivery';
  };

  const go = (scene) => { state.scene = scene; state.ui.scroll = 0; state.ui.pageIdx = 0; state.paused = false; state.think.open = false; sfx('ui'); };

  const goSetup = (family, modeKey) => {
    const mode = MODES[modeKey];
    const pf = state.prefs;
    const blurbs = {
      chase: 'Bat second against a target with real scoring: runs, wickets, wides and no-balls.',
      full5: 'Bowl five overs and then chase the total you gave away.', super: 'One over, two wickets, a tight target.', daily: 'Everyone gets the same target today.',
      yard: 'Tennis ball, bin wicket and the garden fence.', tippy: 'Touch the ball at all and you must run.', ohob: 'A one-handed catch after one bounce is out.', sixout: 'Over the fence scores 6, but you are out.',
    };
    state.setup = {
      family, mode: modeKey, title: family === 'chase' ? 'Premium Chase' : mode.name, blurb: blurbs[family] ?? '', level: pf.level, overs: pf.overs, theme: mode.theme ?? pf.theme, fixedTheme: !!mode.theme,
    };
    go('setup');
  };

  // ---- results -----------------------------------------------------------------------------------------------------
  const finishMatch = () => {
    const m = state.m, i = m.inn;
    const rk = state.modeKey;
    const won = m.result === 'won';
    if (state.scene === 'auto') {
      state.results = buildResults(m, { auto: true });
      go('results');
      return;
    }
    const rec = state.records[rk] ?? { best: 0, wins: 0, played: 0 };
    rec.played += 1; if (won) rec.wins += 1; rec.best = Math.max(rec.best, i.runs);
    state.records[rk] = rec; storage.set('records', state.records);
    state.results = buildResults(m, {});
    state.results.best = rec.best;
    monetization.track('match_end', { mode: rk, result: m.result, runs: i.runs });
    sfx(won ? 'win' : 'lose');
    if (won && m.winShot && m.winShot.track?.length > 12) startReplay(m.winShot);
    else go('results');
  };

  const buildResults = (m, o) => {
    const i = m.inn;
    const head = o.auto ? 'Auto Play finished' : m.result === 'won' ? 'You won!' : m.result === 'tied' ? 'Tied!' : 'Not this time';
    const sub = m.result === 'won' ? (i.target != null ? `Chased ${i.target} with ${i.maxBalls - i.balls} balls to spare and ${i.maxWk - i.wk} wickets in hand.` : '') : m.result === 'tied' ? 'One run short of the target: a tie.' : (i.target != null ? `You needed ${i.target} and finished on ${i.runs}.` : '');
    return {
      headline: head, sub: o.auto ? `The computer ${m.result === 'won' ? 'chased the target' : 'fell short'}.` : sub, runs: i.runs, wk: i.wk, overs: `${Math.floor(i.balls / 6)}.${i.balls % 6}`, rr: runRate(m).toFixed(2), target: i.target, fours: i.fours, sixes: i.sixes,
      best: state.records[state.modeKey]?.best ?? i.runs, canReplay: !!(m.winShot && m.winShot.track?.length > 12 && !o.auto),
      card: i.batters.slice(0, Math.min(i.batters.length, i.nextBat)).map((b) => ({ name: b.name, out: !!b.out, line: `${b.runs} (${b.balls})${b.f4 || b.f6 ? `  ${b.f4}x4 ${b.f6}x6` : ''}${b.out ? `  ${b.out}` : '  not out'}` })),
    };
  };

  const startReplay = (ws) => {
    const track = ws.track;
    state.replay = { p: track, n: track.length / 3, i: 0, shot: ws.shot, cheered: false };
    state.v.otrail = []; state.v.parts = []; state.v.flash = 0.4;
    state.scene = 'replay';
  };

  // ---- batting input -----------------------------------------------------------------------------------------------
  const aimAngle = (dx, dy, hand) => Math.atan2(dx * hand, -dy) / DEG;

  function beginSwing(angle, power, t, already) {
    const m = state.m;
    if (batSwing(m, Rn, { kind: 'swing', angle, power, t })) state.v.swingT = already;
  }

  function batInput(input) {
    const p = input.pointer, tc = state.touch, m = state.m, tick = state.tick;
    const flight = m.phase === 'flight';
    const kd = input.keys.down;
    if (input.keys.pressed.size && flight && !m.sw) {
      const k = input.keys.pressed;
      const dirx = (kd.has('ArrowRight') ? 1 : 0) - (kd.has('ArrowLeft') ? 1 : 0), diry = (kd.has('ArrowUp') ? 1 : 0) - (kd.has('ArrowDown') ? 1 : 0);
      if ([...k].some((c) => c.startsWith('Arrow'))) {
        const ang = Math.atan2(dirx * m.hand, diry) / DEG;
        beginSwing(ang, kd.has('ShiftLeft') || kd.has('ShiftRight') ? 0.95 : 0.55, m.ft, 0);
      } else if (k.has('Space')) { batSwing(m, Rn, { kind: 'block', angle: 0, power: 0 }); state.v.swingT = 0; }
    }
    if (p.pressed) {
      tc.down = true; tc.sx = p.x; tc.sy = p.y; tc.path = [[p.x, p.y]]; tc.committed = false; tc.fired = false; tc.t0 = tick; tc.mv = -1; tc.ok = false; tc.mode = 'bat';
      tc.consumed = inRect(VR.pause, p.x, p.y) || inRect(VR.think, p.x, p.y) || (!!m.live && inRect(VR.run, p.x, p.y));
      tc.aimDeg = null;
    }
    if (tc.down) {
      if (!p.pressed) tc.path.push([p.x, p.y]);
      if (tc.path.length > 40) tc.path.shift();
      const dx = p.x - tc.sx, dy = p.y - tc.sy, dist = Math.hypot(dx, dy);
      if (tc.mv < 0 && dist >= 6) tc.mv = tick;
      tc.aimDeg = !tc.consumed && dist > 16 ? aimAngle(dx, dy, m.hand) : null;
      if (!tc.consumed && !tc.committed && dist >= 40) { tc.committed = true; tc.commitTick = tick; tc.ok = flight && !m.sw; tc.commitFt = m.ft; }
      if (tc.committed && tc.ok && !tc.fired && (tick - tc.commitTick >= 3 || p.released)) {
        tc.fired = true;
        const secs = Math.max(2, tick - tc.mv + 1) / 60;
        let len = 0; for (let k = 1; k < tc.path.length; k++) len += Math.hypot(tc.path[k][0] - tc.path[k - 1][0], tc.path[k][1] - tc.path[k - 1][1]);
        const speed = Math.max(len, dist) / secs;
        const power = clamp((speed - 700) / 3600, 0.06, 1);
        beginSwing(aimAngle(dx, dy, m.hand), power, tc.commitFt, (tick - tc.commitTick) / 60);
      }
    }
    if (p.released) {
      if (tc.down && !tc.consumed && !tc.committed && flight && !m.sw && tick - tc.t0 < 26 && Math.hypot(p.x - tc.sx, p.y - tc.sy) < 36) {
        batSwing(m, Rn, { kind: 'block', angle: 0, power: 0 });
        state.v.swingT = 0;
      }
      tc.down = false; tc.aimDeg = null; tc.path = [];
    }
  }

  function runInput(input) {
    const p = input.pointer, m = state.m;
    if (p.pressed && inRect(VR.run, p.x, p.y)) { if (callRun(m)) sfx('run'); }
    if (input.keys.pressed.has('Space')) callRun(m);
  }

  // ---- bowling input ---------------------------------------------------------------------------------------------------
  function pickType(k) {
    const a = state.m.aim; a.type = k;
    const mid = { pace: 4.0, inswing: 3.0, outswing: 3.0, offspin: 3.6, legspin: 3.6, bouncer: 7.5, yorker: 0.8, slower: 3.8, fulltoss: -1.8 };
    if (mid[k] != null) a.tz = mid[k];
    sfx('ui');
  }

  function bowlInput(input) {
    const p = input.pointer, tc = state.touch, m = state.m, tick = state.tick;
    const a = m.aim;
    if (m.phase !== 'aim') return;
    for (const k of input.keys.pressed) {
      if (k === 'ArrowLeft') a.tx = clamp(a.tx - 0.1 * m.hand, -1.6, 1.6);
      if (k === 'ArrowRight') a.tx = clamp(a.tx + 0.1 * m.hand, -1.6, 1.6);
      if (k === 'ArrowUp') a.tz = clamp(a.tz + 0.35, -0.5, 9.5);
      if (k === 'ArrowDown') a.tz = clamp(a.tz - 0.35, -0.5, 9.5);
      if (/^Digit[1-9]$/.test(k)) { const t = TYPE_CHIPS[Number(k.slice(5)) - 1]; if (t) pickType(t.k); }
      if (k === 'Space') { a.pace = 0.5; bowlNow(m, Rn, a); sfx('release'); }
    }
    if (p.pressed) {
      tc.down = true; tc.sx = p.x; tc.sy = p.y; tc.path = [[p.x, p.y]]; tc.t0 = tick; tc.mode = null;
      const chip = TYPE_CHIPS.find((c) => inRect(c.rect, p.x, p.y));
      if (chip) { pickType(chip.k); tc.mode = 'chip'; }
      else if (inRect({ x: PITCHMAP.x - 20, y: PITCHMAP.y - 20, w: PITCHMAP.w + 40, h: PITCHMAP.h + 40 }, p.x, p.y)) tc.mode = 'aim';
      else if (!inRect(VR.pause, p.x, p.y) && !inRect(VR.think, p.x, p.y)) tc.mode = 'flick';
    }
    if (tc.down) {
      if (!p.pressed) tc.path.push([p.x, p.y]);
      if (tc.path.length > 40) tc.path.shift();
      if (tc.mode === 'aim') { const [x, z] = fromMap(p.x, p.y); a.tx = clamp(x * m.hand, -1.6, 1.6); a.tz = clamp(z, -0.5, 9.5); }
    }
    if (p.released) {
      if (tc.down && tc.mode === 'flick') {
        const dy = tc.sy - p.y, dist = Math.hypot(p.x - tc.sx, p.y - tc.sy);
        const secs = Math.max(2, tick - tc.t0) / 60;
        if (dy > 120 && dist > 140) {
          a.pace = clamp((dist / secs - 900) / 3400, 0, 1);
          bowlNow(m, Rn, a); sfx('release');
        }
      }
      tc.down = false; tc.path = []; tc.mode = null;
    }
  }

  function fieldPickInput(input) {
    const p = input.pointer, m = state.m;
    if (!p.pressed) return;
    for (const c of FIELD_CHIPS) if (inRect(c.rect, p.x, p.y)) { m.fieldPick = c.k; sfx('ui'); }
    if (inRect(GO, p.x, p.y)) { resumeAfterOverbreak(m, Rn, m.fieldPick); sfx('ui'); }
  }

  // ---- think ---------------------------------------------------------------------------------------------------------------
  function openThink() {
    const m = state.m;
    if (m.hints <= 0 || state.think.open) return;
    let lines = [], plan = null;
    if (m.inn.role === 'bat') {
      if (m.phase === 'ready' || m.phase === 'runup' || m.phase === 'flight') { const h = readyHint(m); if (h) { lines = h.reasons; plan = h.plan; } }
      else if (m.phase === 'live' && m.live && !m.live.dead) { const adv = runAdvice(m, 0.25); if (adv) lines = [adv.text]; }
      else return;
    } else if (m.phase === 'aim') {
      const pl = planDelivery(m, { kind: 'pace', name: 'You' }, localRng(11));
      const T = TYPES[pl.spec.type];
      lines = [`Try a ${T.name.toLowerCase()}: ${T.cue.toLowerCase()}.`, `Aim near ${pl.spec.bz < 1.6 ? 'the toes (yorker)' : pl.spec.bz < 3.4 ? 'a full length' : pl.spec.bz < 5 ? 'a good length' : 'short'}, ${pl.spec.bx < 0.1 ? 'on the stumps' : 'just outside off'}.`, pl.why || 'Mix it up: change pace and length so the batter cannot settle.'];
    } else return;
    m.hints -= 1;
    state.think = { open: true, lines, plan };
    sfx('ui');
  }

  // ---- engine events -> sound, particles, shake ----------------------------------------------------------------------
  function processEvents() {
    const m = state.m, v = state.v;
    for (const e of popEvents(m)) {
      switch (e.k) {
        case 'release': sfx('release'); break;
        case 'bounce': { sfx('bounce'); const d = m.d; if (d && d.bounceT > 0) { const bp = deliveryPos(d, d.bounceT); const P = makeProj(m.hand); const [sx, sy] = P(bp[0], 0, bp[2]); spawn(7, () => ({ kind: 'grass', x: sx + (vr() - 0.5) * 20, y: sy, vx: (vr() - 0.5) * 140, vy: -40 - vr() * 90, r: 3 + vr() * 3, life: 0.5, max: 0.5, color: m.theme === 'beach' ? '#e6cf96' : '#cdbb8a', rot: vr() * 3, g: 260 })); } break; }
        case 'swing': if (!e.hit) sfx('swish'); break;
        case 'crack': {
          sfx('crack', e.q);
          const d = m.d;
          const P = makeProj(m.hand);
          const [sx, sy] = P(d.xc, d.yc, 0.4);
          flashAt(sx, sy, 160 + 140 * e.q); ring(sx, sy, '#fff4c8', 10); burst(sx, sy, 16, '#ffe08a', 520);
          v.flash = 0.35;
          break;
        }
        case 'ground': { if (!m.live) break; const bp = ballPos(m); const [x, y] = toScreen(m.theme, bp[0] * m.hand, bp[2]); spawn(3, () => ({ kind: 'grass', x, y, vx: (vr() - 0.5) * 120, vy: -60 - vr() * 80, r: 3 + vr() * 2, life: 0.4, max: 0.4, color: '#6fbf4a', rot: vr() * 3, g: 300 })); sfx('thud'); break; }
        case 'six': sfx('roar'); confetti(360, 420, 60, ['#ffd34d', '#ff6b57', '#2ec4b6', '#fff4dc']); v.flash = 0.2; crowdFlash(26); break;
        case 'four': sfx('cheer'); confetti(360, 440, 28, ['#2ec4b6', '#8be07a', '#fff4dc']); crowdFlash(12); break;
        case 'caught': sfx('groan'); burst(360, 500, 14, '#ff9a8a', 260); break;
        case 'stumps': sfx('stumps'); v.stumpsAnim = 0; break;
        case 'wicket': sfx('groan'); v.flash = 0.3; break;
        case 'result': if (state.scene === 'play' && m.inn.role === 'bat') { state.prefs.coach = Math.min(99, (state.prefs.coach ?? 0) + 1); if (state.prefs.coach % 3 === 0) savePrefs(); } break;
        case 'run': sfx('run'); break;
        case 'throw': sfx('throw'); break;
        case 'dropped': sfx('groan'); break;
        case 'overend': sfx('cheer'); break;
        default: break;
      }
    }
  }

  // ---- per-tick play update -------------------------------------------------------------------------------------------
  function updateView(dt) {
    const m = state.m, v = state.v;
    v.t += dt;
    v.shake *= 0.9; if (v.shake < 0.1) v.shake = 0;
    v.flash *= 0.84; if (v.flash < 0.01) v.flash = 0;
    for (const q of v.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g ?? 0) * dt; q.life -= dt; if (q.grow) q.r += q.grow * dt; if (q.rot != null) q.rot += dt * 8; }
    v.parts = v.parts.filter((q) => q.life > 0);
    if (v.swingT >= 0) v.swingT += dt;
    v.sinceSwing += dt;
    if (m.sw && v.swingT < 0) { v.swingT = 0; v.sinceSwing = 0; }
    if (m.sw && v.sinceSwing > 5) v.sinceSwing = 0;
    if (v.stumpsAnim != null) { v.stumpsAnim += dt; v.stumpsBroken = clamp(v.stumpsAnim / 0.45, 0, 1); }
    if ((m.phase === 'flight' || m.phase === 'contact') && m.d) {
      const pos = deliveryPos(m.d, clamp(m.phase === 'flight' ? m.ft : (m.sw?.t ?? m.ft) + 0.05, 0, m.d.n / 60 - 0.02));
      v.trail.push([pos[0], pos[1], pos[2]]); if (v.trail.length > 12) v.trail.shift();
    } else if (m.phase === 'ready' || m.phase === 'runup' || m.phase === 'aim') { v.trail = []; v.otrail = []; v.swingT = -1; v.stumpsAnim = null; v.stumpsBroken = 0; v.sinceSwing = 9; }
    if (m.live && (m.phase === 'live' || m.phase === 'contact')) {
      const bp = ballPos(m);
      v.otrail.push([bp[0] * m.hand, bp[1], bp[2]]); if (v.otrail.length > 16) v.otrail.shift();
    }
    if (m.phase === 'result' && m.live && v.otrail.length) v.otrail.shift();
  }

  function stepEngine(dt) {
    stepMatch(state.m, Rn, dt);
    processEvents();
  }

  function afterInnings() {
    const m = state.m;
    if (m.phase !== 'inningsEnd') return;
    if (m.pt < 1.0) { m.pt += DT; return; }
    if (state.scene === 'auto') { finishMatch(); return; }
    if (m.over) { finishMatch(); return; }
    const i = m.inn;
    state.results = { headline: 'Innings break', sub: `Your side set a target of ${i.runs + 1}.`, runs: i.runs, wk: i.wk, overs: `${Math.floor(i.balls / 6)}.${i.balls % 6}`, target: i.runs + 1, rr: runRate(m).toFixed(2), fours: i.fours, sixes: i.sixes, best: 0, card: [] };
    go('break');
  }

  let lastView = 'delivery';
  function transitionFx() {
    const m = state.m, v = state.v;
    const now = (m.live && (m.phase === 'live' || m.phase === 'result')) ? 'overhead' : 'delivery';
    if (now !== lastView) { lastView = now; v.flash = Math.max(v.flash, 0.5); }
  }

  function updatePlay(dt, input) {
    const m = state.m, p = input.pointer;
    if (state.paused) {
      if (p.pressed) {
        if (inRect({ x: 160, y: 430, w: 400, h: 96 }, p.x, p.y) || inRect(VR.pause, p.x, p.y)) { state.paused = false; sfx('ui'); }
        else if (inRect({ x: 160, y: 550, w: 400, h: 96 }, p.x, p.y)) { state.prefs.sound = !state.prefs.sound; audio.setMuted(!state.prefs.sound); savePrefs(); }
        else if (inRect({ x: 160, y: 670, w: 400, h: 96 }, p.x, p.y)) { state.paused = false; go('title'); }
      }
      if (input.keys.pressed.has('KeyP')) state.paused = false;
      return;
    }
    if (state.think.open) {
      if (p.pressed && inRect({ x: 200, y: 1040, w: 320, h: 70 }, p.x, p.y)) { state.think.open = false; sfx('ui'); }
      if (input.keys.pressed.has('KeyT') || input.keys.pressed.has('Escape')) state.think.open = false;
      return;
    }
    if (p.pressed && inRect(VR.pause, p.x, p.y)) { state.paused = true; sfx('ui'); return; }
    if (p.pressed && inRect(VR.think, p.x, p.y)) { openThink(); return; }
    if (input.keys.pressed.has('KeyP')) { state.paused = true; return; }
    if (input.keys.pressed.has('KeyT')) openThink();
    if (m.phase === 'inningsEnd') { afterInnings(); updateView(dt); return; }
    if (m.inn.role === 'bat') {
      batInput(input);
      if (m.phase === 'live') runInput(input);
    } else {
      if (m.phase === 'aim') bowlInput(input);
      if (m.phase === 'overbreak' && m.hold) fieldPickInput(input);
    }
    stepEngine(dt);
    updateView(dt);
    transitionFx();
  }

  // ---- auto play ---------------------------------------------------------------------------------------------------------
  function updateAuto(dt, input) {
    const m = state.m, a = state.auto, p = input.pointer;
    if (state.paused) {
      if (p.pressed && inRect(VR.autoPause, p.x, p.y)) { state.paused = false; sfx('ui'); }
      if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Space')) state.paused = false;
      return;
    }
    if (p.pressed) {
      if (inRect(VR.autoPause, p.x, p.y)) { state.paused = true; sfx('ui'); return; }
      if (inRect(VR.speed, p.x, p.y)) { a.speed = a.speed >= 4 ? 1 : a.speed * 2; sfx('ui'); }
      else if (inRect(VR.autoThinkDec, p.x, p.y)) { state.prefs.thinkIdx = clamp(state.prefs.thinkIdx - 1, 0, 3); savePrefs(); sfx('ui'); }
      else if (inRect(VR.autoThinkInc, p.x, p.y)) { state.prefs.thinkIdx = clamp(state.prefs.thinkIdx + 1, 0, 3); savePrefs(); sfx('ui'); }
      else if (inRect({ x: 18, y: 1130, w: 96, h: 56 }, p.x, p.y)) { go('title'); return; }
    }
    if (input.keys.pressed.has('KeyP')) { state.paused = true; return; }
    if (m.phase === 'inningsEnd') { afterInnings(); updateView(dt); return; }
    for (let s = 0; s < a.speed; s++) {
      autoStep(DT);
      if (state.scene !== 'auto') return;
    }
    updateView(dt);
    transitionFx();
  }

  function autoStep(dt) {
    const m = state.m, a = state.auto;
    if (a.phase === 'think' || a.phase === 'reveal') {
      a.timer -= dt;
      if (a.phase === 'think') {
        const all = a.fullLines;
        const frac = clamp(1 - a.timer / a.total, 0, 1);
        const n = Math.max(1, Math.min(all.length, Math.ceil(frac * all.length * 1.05)));
        a.lines = all.slice(0, n);
      }
      if (a.timer <= 0) {
        if (a.phase === 'think') {
          a.phase = 'reveal'; a.revealing = true; a.total = 2; a.timer = 2;
          a.lines = a.fullLines.concat([a.decision]);
        } else {
          a.phase = 'act'; a.revealing = false;
          a.lines = a.fullLines.concat([a.decision]);
          if (a.kind === 'ball') m.hold = false; else resolveFrozen(m, a.act);
        }
      }
      return; // everything else is frozen while thinking and revealing
    }
    stepEngine(dt);
    if (m.phase === 'ready') {
      const key = `${m.innNo}:${m.inn.balls}:${m.inn.log.length}`;
      if (a.key !== key) {
        a.key = key; m.hold = true;
        a.kind = 'ball'; a.phase = 'think'; a.total = THINK_STEPS[state.prefs.thinkIdx]; a.timer = a.total; a.revealing = false;
        const pl = m.aiPlan;
        a.fullLines = pl ? pl.reasons.slice() : ['Reading the bowler.'];
        a.decision = pl && pl.kind === 'swing' ? `Decision: ${Math.abs(pl.angle) < 15 ? 'straight' : pl.angle > 0 ? 'toward the off side' : 'toward the leg side'}, ${pl.power > 0.75 ? 'hard and in the air' : pl.power > 0.45 ? 'firm along the ground' : 'a soft push'}.` : pl && pl.kind === 'block' ? 'Decision: defend.' : 'Decision: leave it.';
        a.lines = a.fullLines.slice(0, 1);
      }
    }
    if (m.live && m.live.frozen && a.phase !== 'think' && a.phase !== 'reveal') {
      const f = m.live.frozen;
      a.kind = 'run'; a.phase = 'think'; a.total = THINK_STEPS[state.prefs.thinkIdx]; a.timer = a.total; a.revealing = false;
      a.fullLines = [f.adv.text];
      a.act = f.adv.act;
      a.decision = f.adv.act === 'run' ? 'Decision: RUN.' : 'Decision: HOLD, the throw would beat us.';
      a.lines = a.fullLines.slice(0, 1);
    }
  }

  // ---- UI scenes ---------------------------------------------------------------------------------------------------------
  function uiInput(input) {
    const p = input.pointer, ui = state.ui, U = state._ui;
    if (p.pressed) { ui.drag = { y0: p.y, s0: ui.scroll, moved: false, x0: p.x }; }
    const paged = state.scene === 'howto' || state.scene === 'about' || state.scene === 'rules';
    if (ui.drag && p.down) {
      const dy = p.y - ui.drag.y0;
      if (Math.abs(dy) > 12) ui.drag.moved = true;
      if (ui.drag.moved && !paged) ui.scroll = clamp(ui.drag.s0 - dy, 0, U.maxS);
    }
    for (const k of input.keys.pressed) {
      if (k === 'ArrowDown') ui.scroll = clamp(ui.scroll + 80, 0, U.maxS);
      if (k === 'ArrowUp') ui.scroll = clamp(ui.scroll - 80, 0, U.maxS);
      if (k === 'Escape') uiTap('back');
      if (k === 'Enter' || k === 'Space') {
        // keyboard shortcut: Enter / Space on the title starts a quick chase straight away
        if (state.scene === 'title') { startMatch(`chase${state.prefs.overs}`, { level: state.prefs.level }); return; }
        const prim = U.footer.find((f) => ['start', 'next', 'again', 'bat'].includes(f.id)); if (prim) uiTap(prim.id);
      }
    }
    if (p.released && ui.drag) {
      const d = ui.drag; ui.drag = null;
      if (d.moved) {
        if (paged && Math.abs(p.y - d.y0) > 70 && U.view.y <= d.y0 && d.y0 <= U.view.y + U.view.h) uiTap(p.y < d.y0 ? 'next' : 'prev');
        return;
      }
      const x = p.x, y = p.y;
      if (inRect(VR.zoomDec, x, y)) { state.prefs.textIdx = clamp(state.prefs.textIdx - 1, 0, TEXT_SCALES.length - 1); savePrefs(); return; }
      if (inRect(VR.zoomInc, x, y)) { state.prefs.textIdx = clamp(state.prefs.textIdx + 1, 0, TEXT_SCALES.length - 1); savePrefs(); return; }
      for (const f of U.footer) if (inRect(f.rect, x, y)) { uiTap(f.id); return; }
      if (y >= U.view.y && y <= U.view.y + U.view.h) for (const h of U.hits) if (inRect(h.rect, x, y)) { uiTap(h.id); return; }
    }
  }

  function uiTap(id) {
    const sc = state.scene, pf = state.prefs;
    sfx('ui');
    if (id === 'back') {
      if (sc === 'setup') go('modes'); else if (sc === 'modes' || sc === 'settings') go('title');
      return;
    }
    switch (sc) {
      case 'title':
        if (id === 'play') go('modes');
        else if (id === 'auto') startMatch('auto', { level: pf.level });
        else if (id === 'howto' || id === 'rules' || id === 'about' || id === 'settings') go(id);
        break;
      case 'modes': {
        if (!id.startsWith('mode:')) break;
        const k = id.slice(5);
        if (config.demo && !['chase', 'yard'].includes(k)) { sfx('lose'); break; }
        if (k === 'chase') goSetup('chase', `chase${pf.overs}`);
        else goSetup(k, k);
        break;
      }
      case 'setup': {
        const su = state.setup;
        if (id.startsWith('overs:')) { su.overs = Number(id.slice(6)); su.mode = `chase${su.overs}`; pf.overs = su.overs; savePrefs(); }
        else if (id.startsWith('level:')) { su.level = Number(id.slice(6)); pf.level = su.level; savePrefs(); }
        else if (id.startsWith('theme:')) { su.theme = id.slice(6); pf.theme = su.theme; savePrefs(); }
        else if (id === 'start') startMatch(su.mode, { level: su.level, theme: su.theme });
        break;
      }
      case 'settings':
        if (id === 'set:sound') { pf.sound = !pf.sound; audio.setMuted(!pf.sound); }
        else if (id === 'set:hand') { pf.hand = -pf.hand; dropLayers(); }
        else if (id === 'set:assist') pf.assist = (pf.assist + 1) % 3;
        else if (id === 'set:think') pf.thinkIdx = (pf.thinkIdx + 1) % 4;
        else if (id === 'set:restore') monetization.restore();
        savePrefs();
        break;
      case 'howto': case 'about': case 'rules': {
        const U = state._ui, pages = U.pages ?? [0];
        const idx = state.ui.pageIdx;
        if (id === 'next') { if (idx >= pages.length - 1) go('title'); else state.ui.scroll = clamp(pages[idx + 1], 0, U.maxS); }
        else if (id === 'prev' || id === 'back') { if (idx <= 0) go('title'); else state.ui.scroll = clamp(pages[idx - 1], 0, U.maxS); }
        break;
      }
      case 'results':
        if (id === 'again') { const lm = state.lastMode; if (lm) startMatch(lm.modeKey, lm.opts); else go('modes'); }
        else if (id === 'menu') go('title');
        else if (id === 'replay' && state.m?.winShot) startReplay(state.m.winShot);
        break;
      case 'break':
        if (id === 'bat') { nextInnings(state.m, Rn); state.v = freshV(); state.scene = 'play'; state.ui.scroll = 0; lastView = 'delivery'; }
        break;
      case 'demolimit':
        if (id === 'auto') startMatch('auto', { level: pf.level }); else if (id === 'menu') go('title');
        break;
      default: break;
    }
  }

  function updateReplay(dt, input) {
    const r = state.replay;
    if (!r) { go('results'); return; }
    r.i += dt * 60 * 0.45;
    const k = Math.min(Math.floor(r.i), r.n - 1);
    state.v.otrail.push([r.p[k * 3] * state.m.hand, r.p[k * 3 + 1], r.p[k * 3 + 2]]);
    if (state.v.otrail.length > 16) state.v.otrail.shift();
    if (!r.cheered && r.i >= r.n - 4) { r.cheered = true; confetti(360, 500, 70, ['#ffd34d', '#ff6b57', '#2ec4b6', '#fff4dc']); sfx('roar'); }
    updateView(dt);
    const p = input.pointer;
    if (r.i >= r.n + 40 || (p.pressed && inRect({ x: 160, y: 1130, w: 400, h: 100 }, p.x, p.y)) || input.keys.pressed.has('Space')) { state.replay = null; go('results'); }
  }

  // ---- main update ------------------------------------------------------------------------------------------------------
  const noInput = () => ({ pointer: { pressed: false, released: false, down: false, x: 0, y: 0 }, keys: { pressed: new Set(), down: new Set() } });
  return {
    update(dt, input) {
      state.tick += 1;
      setPress(input.pointer.down ? input.pointer.x : null, input.pointer.y);
      const sc = state.scene;
      if (!state.paused) state.t += dt;
      playSfxQueue();
      if (sc === 'play') updatePlay(dt, input);
      else if (sc === 'auto') updateAuto(dt, input);
      else if (sc === 'replay') updateReplay(dt, input);
      else uiInput(input);
    },
    render(ctx) { renderScene(ctx, state); },
    getState: () => state,
    // Auto Play, the menus and replays are free; only real matches use up the free preview time.
    // Pause, the Think card and the innings break do not use up preview time either.
    isPreviewExempt: () => state.scene !== 'play' || state.paused || state.think.open || (state.m && state.m.phase === 'inningsEnd'),
    // Tester hooks (only meaningful with ?dev=1 / the Developer toggle).
    debug: {
      state,
      go: (s) => { state.scene = s; state.ui.scroll = 0; },
      start: (mode, opts) => startMatch(mode, opts),
      engine: () => ({ m: state.m, R: Rn }),
      setPrefs: (o) => Object.assign(state.prefs, o),
      steps: (n) => { for (let i = 0; i < n; i++) { if (state.scene === 'auto') updateAuto(DT, noInput()); else if (state.scene === 'play' && !state.paused) { stepEngine(DT); updateView(DT); transitionFx(); } } },
      afterInnings,
    },
  };
}
