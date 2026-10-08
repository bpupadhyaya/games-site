// The race simulation: pure, deterministic, no DOM and no clock. The drum beat schedule, tap judging, crew sync, stamina,
// Surge, the boat's physics, streams, flotsam, slipstream, lane clashes and the rival crews. Units: metres and seconds.
// The 3D presenter only reads this state (via game.js) and never writes back.
import { clamp, lerp, smooth, laneX, NLANES, HALF_W, HALF_LEN, WINDOWS, TIER_Q, spm } from './common.js';
import { THEMES, crewById, CREWS } from './crews.js';

// ---- tuning --------------------------------------------------------------------------------------------------------
export const J_FULL = 0.66;        // speed gained by one full-power stroke (m/s)
const DRAG2 = 0.0092, DRAG1 = 0.03, STEER_DRAG = 0.008;
const STROKE_DELAY = 0.02, STROKE_LEN = 0.4, STROKE_AREA = (STROKE_LEN * 2) / Math.PI;
const ENERGY_COST = 0.0105;
const SURGE_SECONDS = 5, SURGE_POWER = 1.28, SURGE_ENERGY = 0.1;
const STEER_SPEED = 3.2;
const COUNT_BEAT = 0.6;

const KIND_COST = { start: 1.2, cruise: 1, up: 1.35, settle: 0.6, sprint: 1.6 };
const KIND_PERIOD = { start: null, cruise: 1, up: 0.87, settle: 1.1, sprint: 0.84 };

export function createRace(cfg, rng) {
  const crng = rng.fork(), rrng = rng.fork(), arng = rng.fork();
  const theme = THEMES[cfg.theme] ?? THEMES.town;
  const drum = cfg.mode === 'drum';
  const w = {
    mode: drum ? 'drum' : 'race', t: -3.0, phase: 'count', len: cfg.len, P0: cfg.P0, theme: theme.id, drift: theme.drift, winName: cfg.window ?? 'normal',
    offset: cfg.offset ?? 0, boats: [], beats: [], bi: 0, evId: 0, events: [], streams: [], flotsam: [], sprintFrom: null, nextI: -3,
    surge: { meter: 0, on: 0 }, streak: 0, call: null, banner: null, result: null, finishAt: null, auto: !!cfg.auto, autoSteer: null,
    stats: { perfect: 0, great: 0, good: 0, ragged: 0, miss: 0, stray: 0, maxStreak: 0, clashes: 0, bumps: 0, draftT: 0, streamT: 0, taps: 0, surges: 0 },
    drumMode: null, moments: {}, tut: !!cfg.tut,
  };
  w.win = WINDOWS[w.winName] ?? WINDOWS.normal;
  const emit = (type, o = {}) => { w.events.push({ id: ++w.evId, type, t: w.t, ...o }); if (w.events.length > 60) w.events.splice(0, w.events.length - 60); };

  // ---- boats ---------------------------------------------------------------------------------------------------------
  const lanes = [0, 1, 2, 3];
  const myLane = cfg.lane ?? rrng.int(NLANES);
  const others = rrng.shuffle(lanes.filter((l) => l !== myLane));
  const rivalIds = cfg.rivals ?? ['jade-heron', 'red-carp', 'bamboo-hawks'];
  const level = cfg.level ?? 4;
  const mk = (id, name, hue, lane, mine, crew) => ({
    id, name, hue, lane, mine, x: laneX(lane), vx: 0, z: -HALF_LEN - 1.2, v: 0, yaw: 0, S: 0.45, Sd: 0.45, E: 1, cur: 0, draft: 0, plan: crew?.plan ?? 'steady',
    skill: crew?.skill ?? 0, sT0: -9, sT1: -8.4, sKind: 'start', pw: 0, finished: false, finishT: null, place: null, cool: 0, bump: 0, base: 0.5, mood: 0, moodT: 0,
    tx: laneX(lane), blocker: false, stumbleAt: [], rI: 0, spread: 0,
  });
  w.boats.push(mk('me', cfg.name ?? 'You', 5, myLane, true, null));
  const nR = Math.min(rivalIds.length, others.length, cfg.nRivals ?? 3);
  for (let k = 0; k < nR; k++) {
    const crew = crewById(rivalIds[k]);
    const b = mk(crew.id, crew.name, crew.hue, others[k], false, crew);
    b.base = clamp(0.42 + 0.05 * level + crew.skill + (rrng.next() - 0.5) * 0.05, 0.3, 0.97);
    b.S = b.Sd = b.base; b.blocker = k === 0 && level > 3.5; b.moodT = rrng.range(4, 9);
    b.sT0 = -9; b.sT1 = rrng.range(0.02, 0.3);
    w.boats.push(b);
  }
  const me = w.boats[0];

  // ---- the river: streams and flotsam ------------------------------------------------------------------------------
  {
    const diff = clamp(cfg.hazard ?? (0.3 + level * 0.07), 0.2, 1);
    let z = 60 + crng.range(0, 25);
    while (z < w.len - 90) {
      const len = crng.range(45, 75), lane = crng.int(NLANES);
      w.streams.push({ z0: z, z1: z + len, x: laneX(lane) + crng.range(-1.2, 1.2), w: 4.6, k: 1.15 });
      z += len + crng.range(35, 85);
    }
    z = 48 + crng.range(0, 20);
    const kinds = ['log', 'mat', 'buoy'];
    while (z < w.len - 60) {
      w.flotsam.push({ x: crng.range(-10, 10), z, r: 0.9, kind: kinds[crng.int(3)], hit: false, spin: 0 });
      z += crng.range(30, 62) / (0.6 + diff * 0.7);
    }
    if (cfg.course) { w.streams = cfg.course.streams; w.flotsam = cfg.course.flotsam; }
  }

  // ---- drummer mode set-up -------------------------------------------------------------------------------------------
  if (drum) {
    const segs = cfg.chart.segs.map(([n, lo, hi, label]) => ({ n, lo, hi, label }));
    w.drumMode = { segs, seg: 0, taps: 0, lastTap: null, iv: [], tempo: 0, cons: 1, band: 1, spm: 0, lift: null, liftsHit: 0, liftsTotal: 0, liftDue: 6, segStartT: 0, guide: [] };
  }

  // ---- the beat schedule ---------------------------------------------------------------------------------------------
  const upWindow = (i) => (w.len >= 380 && i >= 24 && i < 35) || (w.len >= 520 && i >= 58 && i < 69);
  const settleWindow = (i) => (w.len >= 380 && i >= 35 && i < 41) || (w.len >= 520 && i >= 69 && i < 75);
  const kindOf = (i) => (i < 8 ? 'start' : w.sprintFrom !== null && i >= w.sprintFrom ? 'sprint' : upWindow(i) ? 'up' : settleWindow(i) ? 'settle' : 'cruise');
  const periodAfter = (i, kind) => (kind === 'start' ? lerp(0.58, w.P0 * 0.97, i / 8) : w.P0 * KIND_PERIOD[kind]);
  function genBeats() {
    if (drum) return;
    const last = w.beats.length ? w.beats[w.beats.length - 1] : null;
    let i = last ? last.i + 1 : -3;
    let t = last ? last.t + last.period : -3 * COUNT_BEAT - 0.0;
    if (!last) t = -COUNT_BEAT * 3;
    if (w.sprintFrom === null && me.z + HALF_LEN >= w.len - 170 && w.phase === 'race') w.sprintFrom = i + 2;
    while (t < w.t + 3.4) {
      if (i < 0) { w.beats.push({ i, t, period: COUNT_BEAT, kind: 'count', judged: true, q: null, err: 0, said: false }); }
      else {
        if (w.sprintFrom === null && me.z + HALF_LEN >= w.len - 170 && w.phase === 'race') w.sprintFrom = i + 2;
        const kind = kindOf(i), p = periodAfter(i, kind);
        const b = { i, t, period: p, kind, judged: false, q: null, err: 0, said: false, autoAt: w.auto ? t + arng.range(-0.035, 0.035) * (arng.chance(0.18) ? 1.7 : 1) : 0, autoDone: false };
        w.beats.push(b);
      }
      t += w.beats[w.beats.length - 1].period; i += 1;
    }
  }
  const bandFor = () => { const d = w.drumMode; return d.segs[Math.min(d.seg, d.segs.length - 1)]; };

  // ---- scoring a beat ------------------------------------------------------------------------------------------------
  const S_TARGET = { perfect: 1.02, great: 0.9, good: 0.68, ragged: 0.38, miss: 0.05 };
  const D_M = { perfect: 0.09, great: 0.06, good: 0.03, ragged: 0, miss: -0.12 };
  function applyTier(tier, kind, o = {}) {
    const q = TIER_Q[tier];
    me.S = clamp(me.S + (S_TARGET[tier] - me.S) * 0.15, 0.05, 1);
    me.E = clamp(me.E - ENERGY_COST * (KIND_COST[kind] ?? 1) * (1.4 - 0.7 * q) * (w.surge.on > 0 ? 0.6 : 1) + (kind === 'settle' ? 0.004 : 0), 0, 1);
    if (w.surge.on <= 0) w.surge.meter = clamp(w.surge.meter + D_M[tier], 0, 1);
    if (tier === 'miss') w.streak = 0; else if (tier !== 'ragged') { w.streak += 1; w.stats.maxStreak = Math.max(w.stats.maxStreak, w.streak); } else w.streak = 0;
    w.stats[tier] += 1;
  }
  function onTapRace(now) {
    const t = now - w.offset;
    let best = null, be = 1e9;
    for (const b of w.beats) { if (b.judged) continue; const e = Math.abs(t - b.t); if (e < be && e <= w.win[3]) { be = e; best = b; } }
    w.stats.taps += 1;
    if (!best) { w.stats.stray += 1; me.S = clamp(me.S - 0.02, 0.05, 1); emit('stray'); return; }
    const tier = be <= w.win[0] ? 'perfect' : be <= w.win[1] ? 'great' : be <= w.win[2] ? 'good' : 'ragged';
    best.judged = true; best.q = tier; best.err = t - best.t;
    applyTier(tier, best.kind);
    emit('tap', { tier, err: best.err, i: best.i });
  }
  function missCheck() {
    const tt = w.t - w.offset;
    for (const b of w.beats) {
      if (b.judged || tt <= b.t + w.win[3]) continue;
      b.judged = true; b.q = 'miss';
      applyTier('miss', b.kind);
      emit('miss', { i: b.i });
    }
  }

  // ---- drummer mode: the player's taps ARE the crew's strokes -------------------------------------------------------
  function onTapDrum(now) {
    const d = w.drumMode, t = now - w.offset;
    w.stats.taps += 1;
    if (w.phase === 'count' && t < -0.4) return;
    const seg = bandFor();
    if (d.lift && t - d.lift.t0 > 0.07 && t - d.lift.t0 < 0.34 && !d.lift.second) {
      d.lift.second = true; d.liftsHit += 1; me.S = clamp(me.S + 0.08, 0.05, 1); me.sT0 = t + 0.02; me.sT1 = t + 0.02 + (d.tempo || w.P0); me.sBig = 1.5;
      emit('lift', { ok: true }); w.surge.meter = clamp(w.surge.meter + 0.2, 0, 1); return;
    }
    if (d.lastTap !== null && t - d.lastTap < 0.3 * (d.tempo || 0.75) && !d.lift) { w.stats.stray += 1; me.S = clamp(me.S - 0.02, 0.05, 1); emit('stray'); return; }
    if (d.lift && !d.lift.second && t - d.lift.t0 >= 0.34) { d.lift = null; me.S = clamp(me.S - 0.05, 0.05, 1); emit('lift', { ok: false }); }
    const iv = d.lastTap === null ? null : t - d.lastTap;
    d.lastTap = t;
    d.taps += 1; d.segTaps = (d.segTaps ?? 0) + 1;
    let tier = 'good';
    if (iv !== null && iv < 2.2) {
      const prev = d.iv.length ? d.iv[d.iv.length - 1] : iv;
      const dev = Math.abs(iv - prev) / prev;
      d.cons = clamp(1 - dev / 0.16, 0, 1);
      d.spm = 60 / iv;
      const dist = d.spm < seg.lo ? seg.lo - d.spm : d.spm > seg.hi ? d.spm - seg.hi : 0;
      d.band = clamp(1 - dist / 12, 0, 1);
      const q = d.cons * 0.55 + d.band * 0.45;
      tier = q >= 0.88 ? 'perfect' : q >= 0.7 ? 'great' : q >= 0.5 ? 'good' : 'ragged';
      d.iv.push(iv); if (d.iv.length > 4) d.iv.shift();
      d.tempo = d.tempo ? lerp(d.tempo, iv, 0.5) : iv;
    }
    applyTier(tier, seg.label === 'PUSH' || seg.label === 'SPRINT' ? 'up' : 'cruise');
    emit('tap', { tier, err: 0, spm: Math.round(d.spm), cons: d.cons, band: d.band });
    me.sT0 = t + 0.02; me.sT1 = t + 0.02 + clamp(d.tempo || 0.8, 0.45, 1.3); me.sKind = 'cruise'; me.sBig = 1;
    w.nextDrumStroke = me.sT1;
    if (d.segTaps >= seg.n && d.seg < d.segs.length) { d.seg += 1; d.segTaps = 0; d.segStartT = w.t; if (d.seg < d.segs.length) emit('segment', { label: d.segs[d.seg].label, seg: d.seg }); }
    d.liftDue -= 1;
    if (d.liftDue <= 0 && !d.lift && w.phase === 'race') { d.lift = { t0: t + 0.0, second: false }; d.liftsTotal += 1; d.liftDue = 9; emit('call', { kind: 'lift' }); }
  }
  function drumTick(dt) {
    const d = w.drumMode, tt = w.t - w.offset;
    // count-in: ghost beats so the player can feel the first tempo
    while (d.guide.length < 4 && w.t <= 0) { d.guide.push(-2.4 + d.guide.length * 0.8); }
    for (let k = 0; k < d.guide.length; k++) { const g = d.guide[k]; if (g !== null && w.t >= g) { emit('beat', { i: -4 + k, kind: 'count', count: true }); d.guide[k] = null; } }
    if (d.lift && !d.lift.second && tt - d.lift.t0 >= 0.34) { d.lift = null; me.S = clamp(me.S - 0.05, 0.05, 1); emit('lift', { ok: false }); }
    if (d.lastTap !== null && w.phase === 'race') {
      const exp = d.tempo || 0.8;
      if (tt - d.lastTap > exp * 1.7 + 0.2) {
        // the crew falters and strokes weakly at the old tempo until the drummer finds the beat again
        d.lastTap = tt - exp; d.cons = 0; d.iv = [];
        me.S = clamp(me.S - 0.12, 0.05, 1); w.streak = 0; w.stats.miss += 1; w.surge.meter = clamp(w.surge.meter - 0.12, 0, 1);
        me.sT0 = w.t + 0.02; me.sT1 = me.sT0 + exp; me.sBig = 0.45; emit('miss', { i: -1 });
      }
    }
    if (d.lastTap === null && w.phase === 'race' && w.t > 4) { me.S = clamp(me.S - 0.05 * dt, 0.05, 1); }
  }

  // ---- steering decisions shared by the coach and the rivals ---------------------------------------------------------
  function streamAt(x, z) { for (const s of w.streams) if (z >= s.z0 && z <= s.z1 && Math.abs(x - s.x) < s.w / 2) return s; return null; }
  function bestLine(b, wide) {
    const cands = [];
    if (wide) for (let l = 0; l < NLANES; l++) cands.push(laneX(l));
    else { cands.push(laneX(b.lane), laneX(b.lane) - 2.2, laneX(b.lane) + 2.2); }
    for (const s of w.streams) if (s.z1 > b.z + HALF_LEN && s.z0 < b.z + 70 && (wide || Math.abs(s.x - laneX(b.lane)) < 4.5)) cands.push(s.x);
    let best = b.tx, bs = -1e9;
    for (const c of cands) {
      if (Math.abs(c) > HALF_W - 1.4) continue;
      let sc = -0.07 * Math.abs(c - b.x);
      for (const s of w.streams) {
        if (Math.abs(c - s.x) < s.w / 2 - 0.5) { const a = Math.max(b.z + HALF_LEN, s.z0), z1 = Math.min(s.z1, b.z + 90); if (z1 > a) sc += 0.9 * clamp((z1 - a) / 50, 0, 1); }
      }
      for (const f of w.flotsam) {
        if (f.hit) continue;
        const dz = f.z - (b.z + HALF_LEN);
        if (dz > -2 && dz < 62 && Math.abs(f.x - c) < 1.9) sc -= 3.2 * (1 - dz / 80);
      }
      for (const o of w.boats) {
        if (o === b) continue;
        const dz = o.z - b.z;
        const near = Math.min(Math.abs(o.x - c), Math.abs(o.tx - c));
        if (Math.abs(dz) < 13.5 && near < 2.4) sc -= 1.8;
        else if (dz >= 13.5 && dz < 26 && Math.abs(o.x - c) < 1.4) sc += 0.6 * (b.mine || wide ? 1 : 0.4);
      }
      if (sc > bs + (c === b.tx ? -0.3 : 0)) { bs = sc; best = c; }
    }
    return best;
  }

  // ---- ticking -------------------------------------------------------------------------------------------------------
  function planFactor(b, prog) {
    switch (b.plan) {
      case 'fast': return prog < 0.28 ? 0.1 : prog > 0.62 ? -0.07 : 0;
      case 'late': return prog < 0.4 ? -0.07 : prog > 0.72 ? 0.12 : 0;
      case 'erratic': return b.mood;
      default: return 0;
    }
  }
  function currentFor(b) {
    const s = streamAt(b.x, b.z + 1);
    return s ? s.k : 0;
  }
  function stepBoat(b, dt, pw, steerCmd) {
    const F = J_FULL * pw * (w.t >= b.sT0 + STROKE_DELAY && w.t < b.sT0 + STROKE_DELAY + STROKE_LEN ? Math.sin((Math.PI * (w.t - b.sT0 - STROKE_DELAY)) / STROKE_LEN) / STROKE_AREA : 0);
    const dec = DRAG2 * b.v * b.v + DRAG1 * b.v + STEER_DRAG * Math.abs(b.vx) * b.v;
    b.v = Math.max(0, b.v + (F - dec) * dt);
    b.cur += (currentFor(b) - b.cur) * Math.min(1, 3 * dt);
    b.z += (b.v + b.cur) * dt;
    const drift = w.drift * Math.sin(b.z * 0.021 + 1.3) * 0.5;
    b.vx += (steerCmd * STEER_SPEED + drift - b.vx) * Math.min(1, 4 * dt);
    b.x += b.vx * dt;
    if (b.x > HALF_W - 0.9) { b.x = HALF_W - 0.9; b.vx = Math.min(b.vx, 0) - 0.2; b.v *= 1 - 0.3 * dt; }
    if (b.x < -HALF_W + 0.9) { b.x = -HALF_W + 0.9; b.vx = Math.max(b.vx, 0) + 0.2; b.v *= 1 - 0.3 * dt; }
    b.yaw += (Math.atan2(b.vx, Math.max(b.v, 3)) - b.yaw) * Math.min(1, 6 * dt);
    b.cool = Math.max(0, b.cool - dt); b.bump = Math.max(0, b.bump - dt);
  }
  function powerOf(b, bonus = 1) {
    return (0.28 + 0.72 * b.S) * (0.72 + 0.28 * clamp(b.E / 0.35, 0, 1)) * bonus * (1 + b.draft);
  }

  function update(dt, ctl) {
    ctl = ctl || {};
    w.t += dt;
    if (w.phase === 'count' && w.t >= 0) { w.phase = 'race'; emit('start'); }
    // beats
    genBeats();
    if (!drum) {
      for (const b of w.beats) {
        if (b.said || w.t < b.t) continue;
        b.said = true;
        emit('beat', { i: b.i, kind: b.kind, count: b.i < 0 });
        if (b.i >= 0 && w.phase !== 'count') { me.sT0 = b.t; me.sT1 = b.t + b.period; me.sKind = b.kind; me.sBig = 1; }
      }
    } else drumTick(dt);
    // auto tapping (Watch & Learn coach)
    let steer = ctl.steer ?? 0, wantSurge = !!ctl.surge, taps = ctl.taps ?? 0;
    if (w.auto && w.phase !== 'done') {
      for (const b of w.beats) if (!b.autoDone && b.autoAt && w.t >= b.autoAt + w.offset) { b.autoDone = true; taps += 1; }
      if (drum) taps = 0;
      if (w.t > 0 && w.t - (w.autoSteerT ?? -9) > 0.35) { w.autoSteerT = w.t; me.tx = bestLine(me, true); }
      steer = clamp((me.tx - me.x) / 1.6, -1, 1);
      wantSurge = w.surge.meter >= 1 && w.surge.on <= 0 && (me.z > w.len * 0.5 || me.E < 0.6);
    }
    // player input
    if (w.phase === 'race' || w.phase === 'finish' || (w.phase === 'count' && w.t > -0.3)) {
      for (let k = 0; k < taps; k++) (drum ? onTapDrum : onTapRace)(w.t - (ctl.tapAges?.[k] ?? 0));
      if (wantSurge && w.surge.meter >= 1 && w.surge.on <= 0) { w.surge.on = SURGE_SECONDS; w.surge.meter = 1; me.E = clamp(me.E - SURGE_ENERGY, 0, 1); w.stats.surges += 1; emit('surge'); }
    }
    if (!drum) missCheck();
    if (w.surge.on > 0) { w.surge.on = Math.max(0, w.surge.on - dt); w.surge.meter = w.surge.on / SURGE_SECONDS; if (w.surge.on === 0) w.surge.meter = 0; }
    me.Sd += (me.S - me.Sd) * Math.min(1, 6 * dt);
    me.spread = clamp(1 - me.Sd, 0, 1);

    // the player's boat
    if (w.phase === 'race' || w.phase === 'finish') {
      // slipstream
      for (const b of w.boats) {
        let d = 0;
        for (const o of w.boats) { if (o === b) continue; const gap = o.z - b.z - BOAT_LEN_GAP; if (gap > 0 && gap < 20 && Math.abs(o.x - b.x) < 1.5 && o.v > 2) d = Math.max(d, 0.06 * (1 - gap / 20)); }
        b.draft += (d - b.draft) * Math.min(1, 4 * dt);
      }
      if (me.draft > 0.01) w.stats.draftT += dt;
      if (me.cur > 0.3) w.stats.streamT += dt;
      const fin = me.finished ? clamp(1 - (w.t - me.finishT) / 3, 0.25, 1) : 1;
      if (drum) {
        // nobody is tapping the beat: strokes are scheduled by the drummer's taps (onTapDrum) with their tempo
        if (w.t - (w.autoSteerT ?? -9) > 0.4) { w.autoSteerT = w.t; me.tx = bestLine(me, false); }
        stepBoat(me, dt, powerOf(me, (w.surge.on > 0 ? SURGE_POWER : 1) * (me.sBig ?? 1)) * fin, clamp((me.tx - me.x) / 2, -1, 1) * 0.8);
      } else {
        stepBoat(me, dt, powerOf(me, w.surge.on > 0 ? SURGE_POWER : 1) * fin, steer);
      }
      boundaryHazards(me, true);
    }
    // rivals
    for (let k = 1; k < w.boats.length; k++) stepRival(w.boats[k], dt, k);
    clashes(dt);
    // finish line
    for (const b of w.boats) {
      if (!b.finished && b.z + HALF_LEN >= w.len) {
        b.finished = true; b.finishT = w.t - (b.z + HALF_LEN - w.len) / Math.max(b.v, 2);
        emit('finish', { id: b.id, mine: b.mine });
        if (b.mine) { w.phase = 'finish'; w.finishAt = w.t; }
      }
    }
    if (w.phase === 'finish' && (w.boats.every((b) => b.finished) || w.t - w.finishAt > 6)) endRace();
    if (w.t > 400 && w.phase !== 'done') endRace();
    w.call = callInfo();
    // the course moves on: drop beats long gone
    while (w.beats.length > 8 && w.beats[0].judged && w.beats[0].t < w.t - 1.2) w.beats.shift();
    watchMoments();
  }
  const BOAT_LEN_GAP = HALF_LEN * 2;

  function boundaryHazards(b, isMe) {
    for (const f of w.flotsam) {
      if (f.hit) continue;
      const bow = b.z + HALF_LEN;
      if (Math.abs(f.x - b.x) < 1.0 + f.r * 0.4 && f.z > b.z - HALF_LEN && f.z < bow + 0.4) {
        f.hit = true; f.spin = 1;
        b.v *= 0.66; b.bump = 0.6;
        if (isMe) { me.S = clamp(me.S - 0.12, 0.05, 1); w.streak = 0; w.stats.bumps += 1; w.surge.meter = clamp(w.surge.meter - (w.surge.on > 0 ? 0 : 0.15), 0, 1); emit('bump', { x: f.x, z: f.z, kind: f.kind }); }
      }
    }
  }
  function stepRival(b, dt, k) {
    if (w.phase === 'count') return;
    const prog = clamp((b.z + HALF_LEN) / w.len, 0, 1);
    b.moodT -= dt;
    if (b.moodT <= 0) { b.moodT = rrng.range(5, 10); b.mood = rrng.range(-0.1, 0.12); }
    // the rival's own drummer: strokes at the race tempo for its stage of the race
    if (w.t >= b.sT1) {
      const kind = prog > 0.72 && w.len - b.z < 175 ? 'sprint' : b.rI >= 24 && b.rI < 35 && w.len >= 380 ? 'up' : b.rI >= 35 && b.rI < 41 && w.len >= 380 ? 'settle' : b.rI < 8 ? 'start' : 'cruise';
      const per = kind === 'start' ? lerp(0.58, w.P0 * 0.97, b.rI / 8) : w.P0 * KIND_PERIOD[kind];
      b.sT0 = Math.max(w.t, b.sT1); b.sT1 = b.sT0 + per * (1 + (rrng.next() - 0.5) * 0.04); b.sKind = kind; b.rI += 1;
      b.E = clamp(b.E - ENERGY_COST * (KIND_COST[kind] ?? 1) * 0.9 * (1.1 - b.base * 0.35) + (kind === 'settle' ? 0.004 : 0), 0, 1);
    }
    // sync follows the crew's plan; trailing crews dig in near the line
    let target = b.base + planFactor(b, prog);
    const gapAhead = me.z - b.z;
    if (prog > 0.8 && gapAhead > 0 && gapAhead < 14) target += 0.1;
    if (b.stumble > 0) { b.stumble -= dt; target -= 0.25; }
    b.S += (target - b.S) * Math.min(1, 0.6 * dt);
    b.S = clamp(b.S, 0.25, 1);
    const rubber = clamp(1 + 0.00045 * (me.z - b.z), 0.97, 1.03);
    let pw = powerOf(b, rubber * (b.finished ? clamp(1 - (w.t - b.finishT) / 3, 0.25, 1) : 1));
    pw *= 1 - 0.08 * (b.finished ? 0 : prog * prog * (1 - b.base));
    // steering: stay in lane, dodge flotsam, block a boat that is closing from behind
    if (w.t - (b.autoSteerT ?? -9) > 0.5) {
      b.autoSteerT = w.t;
      let t = bestLine(b, false);
      if (b.blocker && me.z < b.z - 4 && me.z > b.z - 26) t = clamp(me.x, laneX(b.lane) - 3.5, laneX(b.lane) + 3.5);
      b.tx = t;
    }
    stepBoat(b, dt, pw, clamp((b.tx - b.x) / 2.0, -1, 1) * 0.7);
    boundaryHazards(b, false);
    // rivals can blunder into debris now and then
    if (b.bump > 0.55) b.stumble = 1.2;
  }
  function clashes() {
    for (let i = 0; i < w.boats.length; i++) for (let j = i + 1; j < w.boats.length; j++) {
      const a = w.boats[i], c = w.boats[j];
      const dz = Math.abs(a.z - c.z), dx = c.x - a.x;
      if (dz < 11.4 && Math.abs(dx) < 1.55) {
        const s = dx === 0 ? (i % 2 ? 1 : -1) : Math.sign(dx), push = (1.55 - Math.abs(dx)) * 0.5;
        a.x -= s * push; c.x += s * push; a.vx -= s * 0.6; c.vx += s * 0.6;
        if (a.cool <= 0 && c.cool <= 0) {
          a.v *= 0.9; c.v *= 0.9; a.cool = c.cool = 0.8;
          if (a.mine || c.mine) { me.S = clamp(me.S - 0.06, 0.05, 1); w.stats.clashes += 1; w.streak = 0; emit('clash', { x: (a.x + c.x) / 2, z: (a.z + c.z) / 2 }); }
        }
      }
    }
  }
  function callInfo() {
    if (drum) {
      const d = w.drumMode, s = bandFor();
      return { label: s.label, lo: s.lo, hi: s.hi, lift: !!d.lift && !d.lift.second };
    }
    // next tempo change in the upcoming beats
    let prev = null;
    for (const b of w.beats) {
      if (b.i < 0 || b.t < w.t - 0.1) { if (b.i >= 0) prev = b.kind; continue; }
      if (prev === null) prev = b.kind;
      if (b.kind !== prev && (b.kind === 'up' || b.kind === 'settle' || b.kind === 'sprint')) return { kind: b.kind, inBeats: Math.max(1, Math.round((b.t - w.t) / b.period)), spm: spm(b.period) };
      prev = b.kind;
    }
    const cur = w.beats.find((b) => b.i >= 0 && b.t >= w.t - 0.1);
    return cur ? { kind: null, now: cur.kind, spm: spm(cur.period) } : null;
  }

  // Watch & Learn moments: things the coach explains, each raised once
  function watchMoments() {
    if (!w.auto) return null;
    const m = w.moments, set = (id) => { if (m[id]) return false; m[id] = true; w.moment = { id, t: w.t }; return true; };
    if (w.phase === 'count' && w.t > -2.6) return set('start');
    if (w.phase !== 'race') return null;
    const c = w.call;
    if (c && c.inBeats && c.inBeats <= 4 && c.kind === 'up') return set('up');
    if (c && c.inBeats && c.inBeats <= 4 && c.kind === 'settle') return set('settle');
    if (c && c.inBeats && c.inBeats <= 3 && c.kind === 'sprint') return set('sprint');
    for (const f of w.flotsam) { const dz = f.z - (me.z + HALF_LEN); if (!f.hit && dz > 22 && dz < 50 && Math.abs(f.x - me.x) < 4) return set('flotsam'); }
    for (const s of w.streams) { if (s.z0 - (me.z + HALF_LEN) > 15 && s.z0 - (me.z + HALF_LEN) < 45 && !streamAt(me.x, me.z)) return set('stream'); }
    if (me.draft > 0.03) return set('draft');
    if (w.surge.meter >= 1 && w.surge.on <= 0) return set('surge');
    return null;
  }

  function endRace() {
    if (w.phase === 'done') return;
    w.phase = 'done';
    const rows = w.boats.map((b) => ({ id: b.id, name: b.name, hue: b.hue, mine: b.mine, finished: b.finished, time: b.finished ? b.finishT : w.t + (w.len - (b.z + HALF_LEN)) / Math.max(b.v, 3) }));
    rows.sort((a, b) => a.time - b.time);
    rows.forEach((r, i) => { r.place = i; const bt = w.boats.find((x) => x.id === r.id); bt.place = i; });
    const s = w.stats, hits = s.perfect + s.great + s.good + s.ragged, total = hits + s.miss;
    w.result = { order: rows, place: me.place, time: me.finishT ?? rows.find((r) => r.mine).time, stats: { ...s }, accuracy: total ? Math.round(((s.perfect + 0.8 * s.great + 0.55 * s.good + 0.25 * s.ragged) / total) * 100) : 0, S: me.S, lifts: w.drumMode ? { hit: w.drumMode.liftsHit, total: w.drumMode.liftsTotal } : null };
    emit('done');
  }

  // set the start order so lane 0 starts level (staggering would be unfair)
  for (const b of w.boats) b.z = -HALF_LEN - 1.2;
  genBeats();
  return { w, update, bestLine, streamAt, endRace };
}

// A scripted perfect-timing player for tests and tuning (feeds the same control object the touch layer does).
export function perfectTapper(sim, jitter = 0) {
  return (ctl) => {
    const w = sim.w;
    for (const b of w.beats) if (!b.judged && b.i >= 0 && !b.tapped && w.t >= b.t + w.offset + jitter) { b.tapped = true; ctl.taps = (ctl.taps ?? 0) + 1; }
    return ctl;
  };
}
export { CREWS };
