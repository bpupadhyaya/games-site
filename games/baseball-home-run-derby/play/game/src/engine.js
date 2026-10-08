// The round engine: one batter, one pitcher, pitches until the outs run out. Pure and deterministic (all randomness from the streams in R,
// all time from dt). The presenter and the HUD only read the round object `r`; game.js is the only writer besides this file.
//
// Phases:  ready (pitcher steps on, spotlight shows) -> windup -> pitch (ball in flight to the plate) -> [swing] -> flight (batted ball)
//          -> result (banner) -> next ready, or end. A swing is accepted any time the ball is in the air; the bat meets the ball LEAD seconds
//          after the trigger, wherever the ball is by then (the verdict comes from how far that is from the ideal moment).
import { PITCHES, PITCH_KEYS, LEVELS, ZONE, DT, clamp, lerp, DEG, smooth, FOUL_DEG, sectorCentre, SECTORS, MOONSHOT_M, PARKS } from './core.js';
import { makePitch, pitchPos, resolveSwing, flyBall, describeOutcome, DEFAULT_AIM, LEAD, reqLoft } from './ball.js';

export const READY_T = 1.15;
export const WINDUP_T = 1.5;
export const TAKE_T = 0.16;           // seconds after the ball passes the contact plane before an un-swung pitch is called
export const MIN_SWING_T = -0.02;     // a trigger earlier than this (before release) is ignored
const RESULT_T = { homerun: 2.6, other: 1.5 };

/** Allowed pitch types for a bracket round (0 quarter-final .. 2 final) at a level; quick rounds pass round = 2. */
export function mixFor(level, round) {
  const L = LEVELS[level] ?? LEVELS[1];
  const allowed = round <= 0 ? ['fastball', 'change', ...(level >= 1 ? ['sinker'] : [])] : round === 1 ? ['fastball', 'change', 'sinker', 'curve'] : PITCH_KEYS;
  const m = L.mix.filter(([k]) => allowed.includes(k));
  return m.length ? m : [['fastball', 1]];
}

export function createRound(o, R) {
  const level = clamp(o.level ?? 1, 0, LEVELS.length - 1);
  const L = LEVELS[level];
  const r = {
    id: o.id ?? 0, mode: o.mode ?? 'quick', park: o.park ?? 'harbor', level, round: o.round ?? 2, label: o.label ?? 'Quick round',
    batter: { name: o.batter?.name ?? 'You', hand: o.batter?.hand ?? 1, pow: o.batter?.pow ?? 1, con: o.batter?.con ?? 1, skin: o.batter?.skin ?? 'tan', hair: o.batter?.hair ?? 'brown', trim: o.batter?.trim ?? '#ffcf4a' },
    swingOff: !!o.swingOff, limit: o.swingOff ? 3 : 0,
    outsMax: o.outsMax ?? L.outs, outs: 0, hr: 0, score: 0, spotHits: 0, totalDist: 0, longest: 0, moonshots: 0, refunds: 0, pitches: 0, streak: 0, bestStreak: 0,
    win: L.win, assist: o.assist ?? 1,
    clock: 0, phase: 'ready', pt: 0, hold: false, over: false,
    pitch: null, spot: 0, aim: { s: 0, loft: DEFAULT_AIM.loft, active: false }, sw: null, hit: null, fly: null, ft: 0, slow: 1, stop: 0,
    res: null, log: [], hrList: [], events: [], evId: 0, hints: 3, stats: { perfect: 0, good: 0, ok: 0, weak: 0, whiff: 0, taken: 0, foul: 0 },
    auto: !!o.auto,
  };
  startPitch(r, R);
  return r;
}

function emit(r, k, extra = {}) { r.events.push({ id: ++r.evId, k, t: r.clock, ...extra }); if (r.events.length > 24) r.events.shift(); }

function pickWeighted(R, list) {
  let tot = 0; for (const [, w] of list) tot += w;
  let x = R.p.next() * tot;
  for (const [k, w] of list) { x -= w; if (x <= 0) return k; }
  return list[0][0];
}

/** Generate the next pitch and the spotlight (called when a pitch cycle begins). */
export function startPitch(r, R) {
  const type = pickWeighted(R, mixFor(r.level, r.round));
  // location: a 3x3 grid biased to the middle at low rounds, with jitter; the final round also uses the edges
  const edge = r.round >= 2 ? 0.55 : r.round === 1 ? 0.4 : 0.25;
  const gx = R.p.pick([-1, 0, 0, 1]) * (0.12 + edge * 0.06) + (R.p.next() - 0.5) * 0.07;
  const gy = R.p.pick([-1, 0, 0, 1]) * (0.2 + edge * 0.08) + (R.p.next() - 0.5) * 0.08;
  const tgt = { x: clamp(gx, ZONE.x0 + 0.02, ZONE.x1 - 0.02), y: clamp(0.76 + gy, ZONE.y0 + 0.03, ZONE.y1 - 0.03) };
  const rel = { x: -0.45 + (R.p.next() - 0.5) * 0.06, y: 1.95 + (R.p.next() - 0.5) * 0.06, hand: 1 };
  r.pitch = makePitch(type, tgt, rel);
  r.spot = R.p.int(SECTORS);
  r.phase = 'ready'; r.pt = 0; r.sw = null; r.hit = null; r.fly = null; r.ft = 0; r.slow = 1; r.stop = 0; r.res = null; r.aim.active = false;
  emit(r, 'ready', { type, spot: r.spot });
}

/** The player (or the computer) pulls the trigger. `ts` is implicit: the current pitch time. Returns true if the swing was accepted. */
export function swing(r, R, aim) {
  if (r.phase !== 'pitch' || r.sw) return false;
  const ts = r.pt;
  if (ts < MIN_SWING_T) return false;
  const a = aim ?? DEFAULT_AIM;
  const res = resolveSwing(r.pitch, ts, a, { hand: r.batter.hand, win: r.win * (r.assist ?? 1), pow: r.batter.pow }, R.h);
  r.sw = { ts, tc: res.tc, aim: { s: a.s, loft: a.loft }, res: summarise(res), bp: res.bp.map((x) => Math.round(x * 1000) / 1000) };
  r._res = res;
  emit(r, 'swing', { tc: res.tc, grade: res.grade });
  return true;
}
function summarise(res) { return { kind: res.kind, grade: res.grade, dt: Math.round(res.dt * 1000) / 1000, qt: Math.round((res.qt ?? 0) * 100) / 100, ql: res.ql != null ? Math.round(res.ql * 100) / 100 : null, why: res.why ?? null }; }

/** Advance by dt (real seconds). Returns nothing; read r. */
export function stepRound(r, R, dt) {
  if (r.over) return;
  r.clock += dt;
  switch (r.phase) {
    case 'ready':
      r.pt += dt;
      if (r.pt >= READY_T && !r.hold) { r.phase = 'windup'; r.pt = 0; emit(r, 'windup'); }
      break;
    case 'windup':
      r.pt += dt;
      if (r.pt >= WINDUP_T) { r.phase = 'pitch'; r.pt = 0; r.pitches += 1; emit(r, 'release', { type: r.pitch.type }); }
      break;
    case 'pitch': {
      r.pt += dt;
      const T = r.pitch.T;
      if (r.sw && r.pt >= r.sw.tc) contact(r, R);
      else if (!r.sw && r.pt >= T + TAKE_T) finishPitch(r, R, { kind: 'taken' });
      break;
    }
    case 'flight': {
      if (r.stop > 0) { r.stop -= dt; break; }          // hit-stop: a few frames of impact
      const sc = slowAt(r);
      r.slow = sc;
      r.ft += dt * sc;
      r.pt += dt;
      if (r.ft >= flightEnd(r)) finishPitch(r, R, { kind: 'ball' });
      break;
    }
    case 'result':
      r.pt += dt;
      if (r.pt >= (r.res && r.res.hr ? RESULT_T.homerun : RESULT_T.other)) nextPitch(r, R);
      break;
    case 'end': r.pt += dt; break;
    default: break;
  }
}

/** Time-scale of the batted-ball flight (slow motion on the big ones). */
function slowAt(r) {
  const f = r.fly;
  if (!f || !f.slowmo) return 1;
  const ft = r.ft;
  if (ft < 0.55) return 0.28;
  if (ft < 1.25) return lerp(0.28, 1, smooth((ft - 0.55) / 0.7));
  return 1;
}
function flightEnd(r) {
  const f = r.fly;
  if (f.hr) return f.fenceT + 0.9;
  if (f.kind === 'wall') return f.fenceT + 1.0;
  if (f.kind === 'foul') return Math.min(f.landT ?? 2, 3.2) + 0.4;
  return Math.min((f.landT ?? 1) + 0.9, 5.5);
}

function contact(r, R) {
  const res = r._res;
  r._res = null;
  if (res.kind === 'whiff') {
    emit(r, 'whiff', { why: res.why });
    finishPitch(r, R, { kind: 'whiff', why: res.why });
    return;
  }
  const fly = flyBall(res, r.park);
  r.hit = { v: Math.round(res.v * 10) / 10, launch: Math.round(res.launch * 10) / 10, spray: Math.round(res.spray * 10) / 10, grade: res.grade, q: Math.round(res.q * 100) / 100, bp: res.bp.map((x) => Math.round(x * 1000) / 1000), tc: res.tc };
  fly.slowmo = (fly.hr && (fly.dist >= 108 || res.grade === 'perfect')) || (res.grade === 'perfect' && res.v > 42);
  r.fly = fly;
  r.phase = 'flight'; r.pt = 0; r.ft = 0; r.slow = 1; r.stop = fly.slowmo ? 0.1 : 0.04;
  emit(r, 'contact', { grade: res.grade, v: r.hit.v, kind: fly.kind, dist: fly.dist, q: res.q });
}

function finishPitch(r, R, o) {
  const f = r.fly, res = { kind: o.kind, text: '', sub: '', hr: false, out: true, pts: 0, dist: 0, spot: false };
  if (o.kind === 'taken') { res.text = 'TAKEN'; res.sub = 'The pitch went by. That is an out.'; r.stats.taken += 1; }
  else if (o.kind === 'whiff') { res.text = o.why === 'early' ? 'TOO EARLY' : 'TOO LATE'; res.sub = 'Swing and a miss.'; r.stats.whiff += 1; }
  else {
    r.stats[r.sw.res.grade] = (r.stats[r.sw.res.grade] ?? 0) + 1;
    if (f.hr) {
      res.hr = true; res.out = false; res.dist = f.dist; res.text = 'HOME RUN'; res.sub = `${Math.round(f.dist)} m`;
      res.spot = f.spot === r.spot; res.pts = res.spot ? 2 : 1;
      if (f.moonshot) res.moon = true;
    } else { res.text = describeOutcome(f); res.dist = f.dist; res.sub = f.kind === 'foul' ? 'Foul ball is an out in the contest.' : `${Math.round(f.dist)} m`; if (f.kind === 'foul') r.stats.foul += 1; }
  }
  r.res = res; r.phase = 'result'; r.pt = 0; r.ftEnd = r.ft;
  if (res.hr) {
    r.hr += 1; r.score += res.pts; r.totalDist += res.dist; r.longest = Math.max(r.longest, res.dist); r.streak += 1; r.bestStreak = Math.max(r.bestStreak, r.streak);
    if (res.spot) r.spotHits += 1;
    r.hrList.push({ d: res.dist, s: res.spot ? 1 : 0, g: r.sw.res.grade });
    if (res.moon) { r.moonshots += 1; if (!r.swingOff && r.outs > 0) { r.outs -= 1; r.refunds += 1; res.refund = true; } }
    emit(r, 'homerun', { dist: res.dist, spot: res.spot, moon: !!res.moon, pts: res.pts });
  } else {
    r.streak = 0;
    if (!r.swingOff) r.outs += 1;
    emit(r, 'out', { kind: o.kind === 'ball' ? f.kind : o.kind, dist: res.dist });
  }
  r.log.push({ n: r.pitches, type: r.pitch.type, k: res.hr ? 'hr' : res.kind === 'ball' ? f.kind : res.kind, d: res.dist, g: r.sw ? r.sw.res.grade : null });
  if (r.log.length > 60) r.log.shift();
  if (isOver(r)) r.willEnd = true;
}

function isOver(r) {
  if (r.swingOff) return r.pitches >= r.limit;
  return r.outs >= r.outsMax || r.pitches >= 60;
}

function nextPitch(r, R) {
  if (r.willEnd) { r.phase = 'end'; r.pt = 0; r.over = true; r.willEnd = false; emit(r, 'end'); return; }
  startPitch(r, R);
}

/** Skip the rest of the banner (used by taps once the result is readable). */
export function skipResult(r, R) {
  if (r.phase === 'result' && r.pt > 0.7) { r.pt = 99; stepRound(r, R, 0); }
  else if (r.phase === 'flight' && r.ft > 2.2 && !r.auto) { r.ft = flightEnd(r); stepRound(r, R, 0); }
}

// ---- the batted ball as seen now ---------------------------------------------------------------------------------------------
/** Ball position (sim metres) for the HUD / 3D / fallback. Returns null when there is no ball to draw. */
export function ballNow(r) {
  const p = r.pitch;
  if (!p) return null;
  const out = [0, 0, 0];
  if (r.phase === 'pitch' || r.phase === 'windup') {
    if (r.phase === 'windup') return null;
    if (r.sw && r._res !== undefined && r.sw.res.kind === 'hit' && r.pt > r.sw.tc) return null;
    pitchPos(p, r.pt, out);
    return out;
  }
  if (r.phase === 'flight' && r.fly) {
    const f = r.fly, k = clamp(r.ft * 60, 0, f.n - 1), i = Math.floor(k), a = k - i, i2 = Math.min(f.n - 1, i + 1);
    for (let c = 0; c < 3; c++) out[c] = lerp(f.traj[i * 3 + c], f.traj[i2 * 3 + c], a);
    return out;
  }
  if (r.phase === 'result' && r.fly && r.res && r.res.kind === 'ball') {
    const f = r.fly, i = f.n - 1; return [f.traj[i * 3], f.traj[i * 3 + 1], f.traj[i * 3 + 2]];
  }
  return null;
}

// ---- round facts ----------------------------------------------------------------------------------------------------------------
export const outsLeft = (r) => r.outsMax - r.outs;
export function roundSummary(r) {
  return { name: r.batter.name, hr: r.hr, score: r.score, longest: r.longest, totalDist: Math.round(r.totalDist), pitches: r.pitches, outs: r.outs, spot: r.spotHits, moon: r.moonshots, bestStreak: r.bestStreak, hrList: r.hrList.slice() };
}

// ---- the computer batter (opponents, Auto Play) ----------------------------------------------------------------------------------
/** A swing plan for the current pitch: { swing, ts, aim, reasons[] }. skill 0..1, con 0..1. Uses only streams in R.a. */
export function planSwing(r, R, skill, con = 1) {
  const p = r.pitch, s = clamp(skill, 0.05, 1);
  const sigma = lerp(0.12, 0.03, clamp(s * (0.45 + 0.55 * con), 0, 1));
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += R.a.next(); return (u - 2) * 1.73; };
  const idealTs = p.T - LEAD;
  let err = gauss() * sigma;
  const take = R.a.next() < (1 - s) * 0.06;
  const ts = idealTs + err;
  // aim: toward the lit sector most of the time, otherwise pull side; allow for the bias the computer expects from its own error
  const goSpot = R.a.next() < 0.3 + 0.5 * s;
  const tgtAng = goSpot ? sectorCentre(r.spot) : (r.batter.hand > 0 ? -22 : 22);
  const noise = (1.2 - s) * 24 * gauss() * 0.5;
  const inside = -r.batter.hand * p.P.x;
  const pullSign = r.batter.hand > 0 ? -1 : 1;
  const bias = pullSign * (inside * 38);
  const sAim = clamp((tgtAng - bias + noise) / 42, -1, 1);
  const loft = clamp(reqLoft(p.h) + 5 + gauss() * (1 - s) * 7, 8, 42);
  const reasons = [];
  const T = PITCHES[p.type];
  reasons.push(`${T.name} coming: ${T.tell}`);
  reasons.push(p.h < 0.62 ? 'It will cross low, so a steeper swing lifts it.' : p.h > 0.92 ? 'It will cross high, so a flatter swing is safer.' : 'It will cross about belt high.');
  reasons.push(goSpot ? `The ${['far left', 'left', 'centre', 'right', 'far right'][r.spot]} stands are lit for double: aim there.` : 'No need to chase the spotlight: pull the ball for the shortest fence.');
  return { swing: !take, ts, aim: { s: sAim, loft }, reasons, err };
}

/** Headless batter turn for opponents: plays a whole round with the same physics and returns the summary (no phases, no time). */
export function simulateRound(o, R) {
  const r = createRound({ ...o, auto: true }, R);
  const L = LEVELS[r.level];
  const skill = o.skill ?? L.skill;
  let guard = 0;
  while (!r.over && guard++ < 80) {
    const plan = planSwing(r, R, skill, o.batter?.con ?? 1);
    r.pitches += 1;
    r.phase = 'pitch';
    let outcome;
    if (!plan.swing) { r.sw = null; outcome = { kind: 'taken' }; }
    else {
      r.pt = plan.ts;
      swing(r, R, plan.aim);
      const res = r._res; r._res = null;
      if (res.kind === 'whiff') outcome = { kind: 'whiff', why: res.why };
      else {
        const fly = flyBall(res, r.park);
        r.hit = { grade: res.grade }; r.fly = fly; outcome = { kind: 'ball' };
      }
    }
    finishPitch(r, R, outcome);
    if (r.willEnd) { r.over = true; r.phase = 'end'; } else startPitch(r, R);
  }
  return roundSummary(r);
}
