// Computer players: positioning by role, carrier decisions (kick, handball, run, shoot), marking contests, tackles, set shots,
// the Think hints. Deterministic: only the seeded stream S.rngA. Five levels (consts.LEVELS) change reaction time, aim,
// marking, tackling, speed and decision quality; the hints use the same evaluation the computer players use, so every
// reason shown to a player is the real reason.
import { HW, HL, ZG, GHW, BHW, G, JOG, SPRINT, ATTR, JUMP_APEX, MARK_STAND, ROLE_NAME } from './consts.js';
import { clamp, hyp, erf, normal, lerp } from './util.js';
import { GOAL_SIGMA, dirOf, goalZ, inside, clampPitch, faceVec, kickSolve, kickSigma, goalChance, pressureOf, nearestOpp, predictBall } from './model.js';

const SQ2 = Math.SQRT2;
const mate = (S, p) => S.s.players.filter((m) => m.team === p.team && m.id !== p.id);
const opps = (S, p) => S.s.players.filter((m) => m.team !== p.team);
const uOf = (team, z) => (z * dirOf(team)) / ZG;                   // progress along the attack axis, -1 own goal .. +1 their goal
const posValue = (team, x, z, pr = 0) => 0.8 * uOf(team, z) + 3.4 * goalChance(x, z, team, 0.7, pr);
const speedOf = (S, p) => (p.human ? 1 : S.lvP(p).speed) * ATTR[p.slot].speed * SPRINT;
const timeTo = (S, p, x, z) => hyp(p.x - x, p.z - z) / (speedOf(S, p) * 0.92);

function steer(p, tx, tz, frac = 1, sprint = true) {
  const dx = tx - p.x, dz = tz - p.z, d = hyp(dx, dz);
  const I = p.in;
  if (d < 0.3) { I.mx = I.mz = 0; I.sprint = false; return; }
  const k = clamp(d / 1.6, 0, 1) * frac;
  I.mx = dx / d * k; I.mz = dz / d * k; I.sprint = sprint && d > 3 && frac > 0.8;
}

// ------------------------------------------------------------------------------------------- carrier evaluation
export function evalCarrier(S, p, o = {}) {
  const s = S.s, team = p.team, d = dirOf(team), L = S.lvP(p), aim = p.human ? 0.74 : L.aim;
  const pr = o.noPressure ? 0 : pressureOf(s.players, p), moving = clamp(hyp(p.vx, p.vz) / SPRINT, 0, 1);
  const opts = [];
  const gz = goalZ(team), Dg = hyp(p.x, gz - p.z);
  if (Dg <= 46 && (gz - p.z) * d > 1) {
    const sig = kickSigma(aim, Dg, pr, o.noPressure ? 0 : moving) * GOAL_SIGMA * (o.set ? 0.62 : 1), sd = Math.max(0.2, Dg * Math.tan(sig));
    const reach = Dg < 36 ? 1 : clamp(1 - (Dg - 36) / 12, 0.1, 1);
    const pg = erf(GHW / (sd * SQ2)) * reach, pin = erf(BHW / (sd * SQ2)) * reach, pb = Math.max(0, pin - pg) * 0.5 + (1 - reach) * 0.3;
    opts.push({ kind: 'kick', type: 'goal', tgt: { type: 'goal', id: -1, x: 0, z: gz, D: Dg }, pg, pb, ev: 6 * pg + 0.3 * pb - 1.6 * (1 - pg - pb), label: 'Kick for goal', D: Dg });
  }
  for (const t of S.targetsFor(p, 'kick')) {
    if (t.type !== 'mate') continue;
    const m = s.players[t.id];
    const sig = kickSigma(aim, t.D, pr, moving), lat = t.D * Math.tan(sig);
    const T = kickSolve(t.D).T, reachT = timeTo(S, m, t.x, t.z);
    const oppD = nearestOpp(s.players, m, team, t.x, t.z).d;
    let pa = erf(2.4 / (lat * SQ2)); if (reachT > T + 0.5) pa *= 0.45;
    const pcon = clamp(0.36 + 0.6 * clamp(oppD / 7, 0, 1), 0.2, 0.97);
    // the lane: an opponent standing near the middle of the flight path can intercept a low kick
    let lane = 1;
    for (const o2 of opps(S, p)) { const dd = distToSeg(o2.x, o2.z, p.x, p.z, t.x, t.z); if (dd < 2.2 && t.D < 24) lane *= 0.8; }
    const pc = pa * pcon * lane * (t.D > 40 ? 0.9 : 1);
    const v = posValue(team, t.x, t.z, clamp((3.6 - oppD) / 2.4, 0, 1));
    const ev = pc * v + (1 - pc) * (-0.45 * v - 0.12) - 0.04 * (t.D / 30) + (m.human ? 0.45 : 0);     // teammates look for the player who is running a role
    opts.push({ kind: 'kick', type: 'mate', tgt: t, pc, oppD, ev, label: `Kick to ${nameOf(S, m)}`, D: t.D, id: m.id });
  }
  for (const t of S.targetsFor(p, 'handball')) {
    const m = s.players[t.id];
    const oppD = nearestOpp(s.players, m, team, m.x, m.z).d;
    const pc = clamp(0.93 - 0.2 * clamp(1 - oppD / 5, 0, 1) - 0.06 * clamp(t.D / 15, 0, 1), 0.5, 0.95);
    const v = posValue(team, m.x + m.vx * 0.5, m.z + m.vz * 0.5, clamp((3.6 - oppD) / 2.4, 0, 1));
    const ev = pc * v + (1 - pc) * (-0.35) - 0.12 - 0.8 * (1 - pr) + (m.human ? 0.3 : 0);
    opts.push({ kind: 'handball', type: 'mate', tgt: t, pc, oppD, ev, label: `Handball to ${nameOf(S, m)}`, D: t.D, id: m.id });
  }
  // run on
  const fd = { x: Math.sin(p.face), z: Math.cos(p.face) };
  let clear = 1;
  for (const o2 of opps(S, p)) { const rx = o2.x - p.x, rz = o2.z - p.z, rd = hyp(rx, rz); if (rd < 6 && (rx * fd.x + rz * fd.z) / (rd || 1) > 0.5) clear = Math.min(clear, rd / 6); }
  const vRun = posValue(team, p.x + fd.x * 6, p.z + fd.z * 6) * clear - 0.1 * pr - 0.02;
  opts.push({ kind: 'run', ev: vRun, label: 'Run on', D: 0 });
  opts.sort((a, b) => b.ev - a.ev);
  return { opts, pressure: pr };
}
const distToSeg = (px, pz, ax, az, bx, bz) => { const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1, t = clamp(((px - ax) * vx + (pz - az) * vz) / l2, 0, 1); return hyp(px - (ax + vx * t), pz - (az + vz * t)); };
const nameOf = (S, m) => `${ROLE_SHORT[m.role]} ${m.num}`;
const ROLE_SHORT = { ruck: 'Ruck', mid: 'Mid', fwd: 'Forward', def: 'Defender' };

function noisyPick(S, p, opts) {
  const L = S.lvP(p), sd = (1 - L.iq) * 0.7 + 0.03;
  let best = null, bs = -1e9;
  for (const o of opts.slice(0, 4)) { const sc = o.ev + normal(S.rngA) * sd; if (sc > bs) { bs = sc; best = o; } }
  return best;
}
function describe(S, p, o, ev) {
  const s = S.s;
  if (o.kind === 'run') return { summary: 'Run on', reason: `No safe pass is better than running: the way ahead is ${ev.pressure < 0.3 ? 'open' : 'only partly open'} and no teammate is both free and further up the ground.` };
  if (o.type === 'goal') return { summary: 'Kick for goal', reason: `${Math.round(o.D)} m from the goal, about ${Math.round(o.pg * 100)} in 100 for a goal${ev.pressure > 0.45 ? ' even with a defender closing' : ', with no one at your heels'}. A behind is worth one point and is never a turnover of the whole game, so shooting beats passing here.` };
  const m = s.players[o.id];
  const how = o.kind === 'handball' ? 'A handball is quick and safe when a defender is near.' : 'A kick moves the ball a long way.';
  return { summary: o.label, reason: `${o.label}: about ${Math.round(o.pc * 100)} in 100 to reach them cleanly, ${Math.round(o.D)} m away, nearest defender to them ${Math.round(o.oppD)} m. ${how}` };
}
export function chooseDisposal(S, p, o = {}) {
  const ev = evalCarrier(S, p, o);
  const pick = noisyPick(S, p, ev.opts);
  const d = describe(S, p, pick, ev);
  return { ...pick, ...d, options: ev.opts.slice(0, 3), pressure: ev.pressure };
}

// ------------------------------------------------------------------------------------------- set shots
export function setshotChoice(S, p) {
  const s = S.s, set = s.set;
  const ev = evalCarrier(S, p, { noPressure: true, set: true });
  // goal when the chance is decent, else the best pass; kick-ins prefer safe passes
  let pick = ev.opts.find((o) => o.kind === 'kick' && o.type === 'goal' && o.pg >= 0.22 && (set.kind !== 'kickin'));
  if (!pick) pick = ev.opts.find((o) => o.kind === 'kick' && o.type !== 'goal') || ev.opts.find((o) => o.kind === 'kick');
  if (!pick) { const gz = goalZ(p.team); pick = { kind: 'kick', type: 'free', tgt: { type: 'free', id: -1, x: clamp(p.x * 0.5, -HW + 3, HW - 3), z: clamp(p.z + dirOf(p.team) * 26, -ZG + 3, ZG - 3), D: 26 }, ev: 0, label: 'Kick long' }; void gz; }
  const d = describe(S, p, pick, ev);
  const mq = 0.45 + S.lvP(p).aim * 0.5 + normal(S.rngA) * 0.12;
  s.set.mq = clamp(mq, 0.1, 1);
  return { ...pick, ...d, hold: { summary: d.summary, reason: d.reason, options: ev.opts.slice(0, 3).map(optView), choice: optView(pick) } };
}
const optView = (o) => ({ label: o.label, kind: o.kind, type: o.type, tx: o.tgt ? o.tgt.x : 0, tz: o.tgt ? o.tgt.z : 0, ev: Math.round(o.ev * 100) / 100 });

// ------------------------------------------------------------------------------------------- positioning
function oppInSpace(S, p, x, z) { return nearestOpp(S.s.players, p, p.team, x, z).d; }
function leadSpot(S, p, c) {
  // a forward leads into open space ahead of the carrier; committed for a short time so he does not jitter
  const e = p.ex, s = S.s, d = dirOf(p.team);
  if (e.lead && s.t < e.lead.until) return e.lead;
  const pref = (p.slot === 3 ? -1 : 1) * (p.team === 0 ? 1 : -1) * 5;
  let best = null, bs = -1e9;
  for (const dz of [6, 10, 15, 20]) for (const x of [-10, -6, -2, 2, 6, 10]) {
    const z = clamp(c.z + d * dz, -ZG + 6, ZG - 4) , q = { x: clamp(x, -HW + 4, HW - 4), z };
    if (!inside(q.x, q.z, 2.5)) continue;
    const open = Math.min(9, oppInSpace(S, p, q.x, q.z));
    const sc = open * 1.0 + uOf(p.team, q.z) * 4 - Math.abs(q.x - pref * 1.4) * 0.12 - hyp(q.x - p.x, q.z - p.z) * 0.07 - Math.abs(q.x - c.x) * 0.02 + (S.rngA.next() - 0.5) * 0.6;
    if (sc > bs) { bs = sc; best = q; }
  }
  e.lead = { x: best.x, z: best.z, until: s.t + 0.9 };
  return e.lead;
}
export function positionTarget(S, p) {
  const s = S.s, B = s.ball, team = p.team, d = dirOf(team), P = s.players;
  const h = B.owner >= 0 ? P[B.owner] : null;
  const role = p.role;
  // mine has the ball
  if (h && h.team === team) {
    const c = h;
    if (role === 'fwd') { const q = leadSpot(S, p, c); return { x: q.x, z: q.z, frac: 1 }; }
    if (role === 'mid') { const side = (p.slot === 1 ? -1 : 1) * (team === 0 ? 1 : -1); return { x: clamp(c.x + side * 7, -HW + 3, HW - 3), z: clamp(c.z - d * 2 + d * (p.slot === 1 ? 1 : 3), -ZG + 4, ZG - 4), frac: 1 }; }
    if (role === 'ruck') return { x: clamp(c.x * 0.4, -8, 8), z: clamp(c.z - d * 13, -ZG + 4, ZG - 4), frac: 0.9 };
    return { x: clamp(c.x * 0.5, -9, 9), z: clamp(c.z - d * 22, -ZG + 4, ZG - 8), frac: 0.8 };
  }
  // they have the ball (or it is a set shot of theirs): mark
  if (h && h.team !== team) return markTarget(S, p, h);
  // ball in the air or loose
  const bx = B.x + B.vx * 0.25, bz = B.z + B.vz * 0.25;
  const myTeamLast = B.lastTeam === team;
  const rank = chaseRank(S, p, bx, bz);
  if (rank < 2 && B.kind !== 'kick') return { x: bx, z: bz, frac: 1, chase: true };
  if (role === 'fwd') return { x: clamp(bx * 0.4 + (p.slot === 3 ? -6 : 6) * (team === 0 ? 1 : -1), -HW + 4, HW - 4), z: clamp(d * Math.max(2, uOf(team, bz) * ZG + 8), -ZG + 4, ZG - 4), frac: 0.8 };
  if (role === 'mid') return { x: clamp(bx + (p.slot === 1 ? -6 : 6) * (team === 0 ? 1 : -1), -HW + 3, HW - 3), z: clamp(bz - d * (myTeamLast ? 3 : 6), -ZG + 4, ZG - 4), frac: 0.8 };
  if (role === 'ruck') return { x: clamp(bx * 0.5, -9, 9), z: clamp(bz - d * 9, -ZG + 4, ZG - 4), frac: 0.8 };
  return { x: clamp(bx * 0.4, -9, 9), z: clamp(bz - d * 16, -ZG + 4, ZG - 8), frac: 0.8 };
}
function chaseRank(S, p, x, z) {
  const t0 = timeTo(S, p, x, z); let r = 0;
  for (const m of S.s.players) if (m.team === p.team && m.id !== p.id && !m.human && timeTo(S, m, x, z) < t0 - 0.02) r++;
  if (S.humanSlot >= 0 && p.team === 0) { const hp = S.s.players[S.humanSlot]; if (hp.id !== p.id && timeTo(S, hp, x, z) < t0 - 0.02) r++; }
  return r;
}
function markTarget(S, p, h) {
  const s = S.s, P = s.players, team = p.team, d = dirOf(team);
  // the nearest of my team to the carrier presses; the rest hold their opponent goal side
  const t0 = timeTo(S, p, h.x, h.z);
  let rank = 0;
  for (const m of P) if (m.team === team && m.id !== p.id && !m.human && timeTo(S, m, h.x, h.z) < t0 - 0.02) rank++;
  if (S.humanSlot >= 0 && team === 0) { const hp = P[S.humanSlot]; if (hp.id !== p.id && timeTo(S, hp, h.x, h.z) < t0 - 0.02) rank++; }
  if (rank === 0 || (rank === 1 && hyp(p.x - h.x, p.z - h.z) < 5 && S.lvP(p).press > 0.8)) return { x: h.x + h.vx * 0.28, z: h.z + h.vz * 0.28, frac: 1, press: true, tgt: h };
  const pair = { 0: 4, 1: 1, 2: 2, 3: 5, 4: 0, 5: 3 }[p.slot];
  const o = P[(1 - team) * 6 + pair];
  if (!o || o.id === h.id) return { x: h.x, z: h.z - d * 6, frac: 0.9 };
  const own = { x: 0, z: -d * ZG }, vx = own.x - o.x, vz = own.z - o.z, vl = hyp(vx, vz) || 1;
  const gap = p.role === 'mid' ? 2.6 : 3.2;
  let q = { x: o.x + vx / vl * gap, z: o.z + vz / vl * gap };
  if (p.role === 'fwd') { q.z = d > 0 ? Math.min(q.z, 8) : Math.max(q.z, -8); q.z = clamp(q.z, -ZG + 4, ZG - 4); }
  return { x: q.x, z: q.z, frac: 0.95 };
}

// ------------------------------------------------------------------------------------------- the air: intercept and marking
export function landing(S) {
  const s = S.s, B = s.ball;
  if (S.memoTick === s.tick && S.memoAir) return S.memoAir;
  const pred = predictBall(B, 150, 1 / 30);
  let hit = null;
  for (const q of pred) if (q.y <= 2.1 && (q.t > 0.1 || B.vy < 0)) { hit = q; break; }
  if (!hit && pred.length) hit = pred[pred.length - 1];
  S.memoTick = s.tick; S.memoAir = hit ? { x: hit.x, z: hit.z, y: hit.y, t: hit.t } : null;
  return S.memoAir;
}
function airLogic(S, p) {
  const s = S.s, B = s.ball, L = S.lvP(p);
  const I = landing(S); if (!I) return false;
  const d = hyp(p.x - I.x, p.z - I.z), tNeed = d / (speedOf(S, p) * 0.9);
  const inB = inside(I.x, I.z, 0.5);
  const mine = B.kteam === p.team;
  // who contests: the intended receiver and the two closest of the other side
  let contest = false;
  if (mine) contest = (B.tgtId === p.id) || (B.tgtId < 0 && rankToward(S, p, I) === 0);
  else contest = rankToward(S, p, I) < 2 && d < 14;
  if (!contest || !inB) return false;
  steer(p, I.x, I.z, 1, true);
  // jump timing: the hands must be up when the ball arrives
  if (d < 2.2 && p.jt < 0 && p.cool.jump <= 0 && !p.act) {
    const off = p.ex.jumpOff ?? (p.ex.jumpOff = (S.rngA.next() - 0.5) * 0.34 * (1.3 - L.mark));
    if (I.t <= JUMP_APEX + 0.02 + off && B.y < 3.6) S.startJump(p, !mine && B.kind === 'kick' && (p.role === 'def' || S.rngA.next() < 0.5));
  }
  return true;
}
function rankToward(S, p, I) {
  const t0 = timeTo(S, p, I.x, I.z); let r = 0;
  for (const m of S.s.players) if (m.team === p.team && m.id !== p.id && (S.s.humanSlot < 0 || !(m.human && false)) && timeTo(S, m, I.x, I.z) < t0 - 0.02) r++;
  return r;
}

// ------------------------------------------------------------------------------------------- the step
export function aiStep(S, p, dt) {
  const s = S.s, B = s.ball, L = S.lvP(p), I = p.in;
  if (s.phase !== 'play' && s.phase !== 'setshot') return;
  if (p.human || p.ex.frozen) return;
  if (s.phase === 'setshot' && s.set && s.set.id === p.id) return;                 // the taker is handled by the sim
  const a = p.act;
  if (a && a.kind !== 'jump') {
    if (p.st === 'tackled' && B.owner === p.id && !a.decided && s.t - a.t0 > 0.18 + (1 - L.react) * 0.2) {
      a.decided = true;
      const ev = evalCarrier(S, p, {}); const hb = ev.opts.filter((o) => o.kind === 'handball').sort((x, y) => y.ev - x.ev)[0];
      if (hb && hb.pc > 0.55) S.startHandball(p, hb.tgt);
    }
    return;
  }
  const h = B.owner >= 0 ? s.players[B.owner] : null;
  p.think -= dt;
  // carrier
  if (h && h.id === p.id) {
    if (p.think > 0 && p.ex.run) { steerCarrier(S, p); return; }
    p.think = L.react * 0.5 + 0.05;
    if (p.hold < 0.12 + (1 - L.react) * 0.2) { steerCarrier(S, p); return; }
    const ch = chooseDisposal(S, p);
    const under = pressureOf(s.players, p);
    const waited = p.hold;
    const runOk = ch.kind === 'run' && waited < 3.2 && under < 0.8;
    if (runOk) { p.ex.run = true; steerCarrier(S, p); return; }
    p.ex.run = false;
    let c2 = ch;
    if (ch.kind === 'run') c2 = ev2(S, p) || ch;
    if (S.cfg.watch && !s.hold && s.t - s.holdAt > 3.5 && c2.kind !== 'run') {
      s.hold = { id: p.id, team: p.team, t0: s.t, summary: c2.summary, reason: c2.reason, options: c2.options.map(optView), choice: c2 };
      return;
    }
    S.execChoice(p, c2);
    return;
  }
  const L2 = landing; void L2;
  // the ball is in the air towards a contest
  const airborne = B.owner < 0 && B.kind !== 'held' && B.kind !== 'none' && B.y > 0.3 && (B.kind === 'kick' || B.kind === 'handball' || B.kind === 'tap' || B.kind === 'loose' || B.kind === 'ballup' || B.kind === 'drop');
  if (B.kind === 'ballup' && B.owner < 0) {
    // ball-up: the ruck jumps at it; the others wait round the circle
    const I2 = landing(S);
    if (p.role === 'ruck' && I2) {
      steer(p, B.x, B.z, 1, true);
      if (p.jt < 0 && p.cool.jump <= 0 && !p.act && hyp(p.x - B.x, p.z - B.z) < 2.0) {
        const off = p.ex.jumpOff2 ?? (p.ex.jumpOff2 = (S.rngA.next() - 0.5) * 0.4 * (1.3 - L.mark));
        if (I2.t <= JUMP_APEX + 0.05 + off + 0.15 || B.y < 3.2 && B.vy < 0) S.startJump(p, false);
      }
      return;
    }
  } else if (airborne && B.kind === 'kick') { if (airLogic(S, p)) return; }
  else if (airborne && (B.kind === 'handball' || B.kind === 'tap')) {
    // a handball or tap in flight: the nearest of the receiving side goes to it
    const I3 = landing(S);
    if (I3 && rankToward(S, p, I3) === 0 && hyp(p.x - I3.x, p.z - I3.z) < 12) { steer(p, I3.x, I3.z, 1, true); return; }
  }
  // tackles
  if (h && h.team !== p.team && p.cool.tackle <= 0 && p.st === 'free') {
    const d = hyp(h.x - p.x, h.z - p.z);
    if (d < 2.0 && h.st !== 'kick' || (d < 2.0 && h.act && h.act.kind === 'kick' && !h.act.released)) {
      if (S.rngA.next() < 0.18 + 0.5 * L.press) { S.startTackle(p, h); return; }
    }
  }
  // positioning, re-chosen every think tick
  if (p.think <= 0 || !p.ex.pos) { p.think = L.react * 0.6 + S.rngA.next() * 0.12; p.ex.pos = positionTarget(S, p); }
  const t = p.ex.pos;
  if (t.press && h) { t.x = h.x + h.vx * 0.28; t.z = h.z + h.vz * 0.28; }
  if (t.chase) { t.x = B.x + B.vx * 0.25; t.z = B.z + B.vz * 0.25; }
  steer(p, t.x, t.z, t.frac ?? 1, true);
  // standing a mark: back off
  if (s.phase === 'setshot' && p.ex.stand) { p.ex.stand = false; }
}
function ev2(S, p) { const ev = evalCarrier(S, p, {}); const o = ev.opts.find((x) => x.kind !== 'run'); return o ? { ...o, ...describe(S, p, o, ev), options: ev.opts.slice(0, 3) } : null; }
function steerCarrier(S, p) {
  const s = S.s, d = dirOf(p.team), P = s.players;
  let rx = 0, rz = 0;
  for (const o of P) if (o.team !== p.team) { const dx = p.x - o.x, dz = p.z - o.z, dd = hyp(dx, dz); if (dd < 7 && dd > 0.1) { const w = (7 - dd) / dd / dd; rx += dx * w; rz += dz * w; } }
  let tx = p.x * 0.7 * 0 + clamp(p.x * 0.5, -6, 6), tz = p.z + d * 10;
  const vx = (tx - p.x), vz = (tz - p.z), vl = hyp(vx, vz) || 1;
  let mx = vx / vl + rx * 0.9, mz = vz / vl + rz * 0.9;
  const ml = hyp(mx, mz) || 1; mx /= ml; mz /= ml;
  p.in.mx = mx; p.in.mz = mz; p.in.sprint = pressureOf(P, p) > 0.2;
  // do not run out of bounds
  if (!inside(p.x + mx * 3, p.z + mz * 3, 1.5)) { p.in.mx = -p.x * 0.05; p.in.mz = d * 0.5; }
}

// ------------------------------------------------------------------------------------------- hints for the human player
export function hintFor(S, p) {
  const s = S.s, B = s.ball, role = p.role;
  const h = B.owner >= 0 ? s.players[B.owner] : null;
  const out = (summary, reason, extra = {}) => ({ summary, reason, ...extra });
  if (s.phase === 'ballup' || (B.kind === 'ballup' && B.owner < 0)) {
    if (role === 'ruck') return out('Jump and tap it', 'The ball is going up. Press TAP as it comes back down to reach it with your hand, and push the stick towards a midfielder to steer the tap.');
    return out('Stay close to the contest', 'The rucks fight for the ball in the air. Stand a few metres away, ready to pick up the tap, and run to the ball as soon as it lands.');
  }
  if (s.phase === 'setshot' && s.set && s.set.id === p.id) {
    const ev = evalCarrier(S, p, { noPressure: true });
    const o = ev.opts.find((x) => x.kind === 'kick') || ev.opts[0];
    const d = describe(S, p, o, ev);
    return out(d.summary, `${d.reason} Nobody can tackle you until you play on. Press KICK when the bar is in the middle for a straighter kick.`, { tx: o.tgt ? o.tgt.x : p.x, tz: o.tgt ? o.tgt.z : p.z, id: o.id ?? -1 });
  }
  if (h && h.id === p.id) {
    const ev = evalCarrier(S, p, {});
    const o = ev.opts[0];
    const d = describe(S, p, o, ev);
    if (p.st === 'tackled') { const hb = ev.opts.find((x) => x.kind === 'handball'); return out('Handball now', hb ? `You are tackled: a handball to ${nameOf(S, s.players[hb.id])} gets the ball away before the umpire calls holding the ball.` : 'You are tackled and nobody is close: the umpire will pay holding the ball.', hb ? { tx: hb.tgt.x, tz: hb.tgt.z, id: hb.id } : {}); }
    return out(d.summary, d.reason, o.tgt ? { tx: o.tgt.x, tz: o.tgt.z, id: o.id ?? -1 } : {});
  }
  if (h && h.team !== p.team) {
    const dd = hyp(h.x - p.x, h.z - p.z);
    const ch = S.tackleChance(p, h);
    if (dd < 2.8) return out('Tackle now', `${nameOf(S, h)} has the ball ${dd.toFixed(1)} m away. A tackle from ${ch >= 0.6 ? 'this angle' : 'here'} works about ${Math.round(ch * 100)} times in 100; get the ball carrier to stop and the umpire pays a free kick for holding the ball if he cannot dispose.`, { tx: h.x, tz: h.z, id: h.id });
    return out('Close him down', `${nameOf(S, h)} has the ball ${Math.round(dd)} m away. Run at him: a defender within about 2 m can tackle, and every second he holds the ball with you at his heels his kick gets worse.`, { tx: h.x, tz: h.z, id: h.id });
  }
  if (h && h.team === p.team) {
    if (role === 'fwd') { const q = leadSpot(S, p, h); return out('Lead into space', `Run to the open space marked on the ground, ${Math.round(hyp(q.x - p.x, q.z - p.z))} m away: the nearest defender there is ${Math.round(nearestOpp(s.players, p, p.team, q.x, q.z).d)} m from it, so a kick to that spot gives you a mark.`, { tx: q.x, tz: q.z }); }
    if (role === 'mid') { const t = positionTarget(S, p); return out('Support the carrier', `Run to the spot beside ${nameOf(S, h)} (${Math.round(hyp(t.x - p.x, t.z - p.z))} m away) so he has a short handball option when a tackler arrives.`, { tx: t.x, tz: t.z }); }
    if (role === 'def') { const t = positionTarget(S, p); return out('Hold your zone', 'Stay back near your own goal between the ball and their forwards. If the play turns over you are the last line.', { tx: t.x, tz: t.z }); }
    const t = positionTarget(S, p); return out('Follow the play from behind', 'As the ruck/back you trail the play about 13 m behind the ball, ready to cover if it turns over.', { tx: t.x, tz: t.z });
  }
  // loose or in the air
  if (B.owner < 0 && (B.kind === 'kick' || B.kind === 'handball' || B.kind === 'tap' || B.kind === 'loose') && B.y > 0.3) {
    const I = landing(S);
    if (I) { const own = B.kteam === p.team; return out(own ? 'Get under the ball' : 'Spoil or mark', `The ball will come down about ${Math.round(hyp(p.x - I.x, p.z - I.z))} m from you in ${I.t.toFixed(1)} s. Run to the ring on the ground and press ${own ? 'MARK' : 'MARK or SPOIL'} when it is about a third of a second away; hold it too early and you come down before the ball.`, { tx: I.x, tz: I.z }); }
  }
  const dd = hyp(B.x - p.x, B.z - p.z);
  return out('Chase the loose ball', `The ball is loose ${Math.round(dd)} m away. Run over it to pick it up: ${chaseRank(S, p, B.x, B.z) === 0 ? 'you are the nearest of your side' : 'a teammate is nearer, so run to support'}.`, { tx: B.x, tz: B.z });
}
export { ROLE_NAME, lerp };
