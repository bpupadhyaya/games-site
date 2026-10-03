// Computer riders: team shape by role (attacker 1, midfielder 2, back 3), a team chaser who rides onto the ball and chooses a shot
// (goal, pass or clear), strokes timed from a prediction of the contact tick, hooks and the five skill levels.
import { DT, HW, HL, GOAL_HW, V_BASE, STRIKE_MIN, STRIKE_MAX, WIND_MAX, REACH, LEVELS, MATE_LEVEL } from './consts.js';
import { clamp, wrap, hyp } from './util.js';

const NS = { pen: 0, n: 5 };       // near-side (left) approaches cost nothing extra and get five headings, so the computer riders use all three strokes
const lvOf = (r) => LEVELS[clamp((r.level || MATE_LEVEL) - 1, 0, 4)];

function goTo(r, tx, tz, frac = 1, stopR = 0.8) {
  const dx = tx - r.x, dz = tz - r.z, d = hyp(dx, dz);
  if (d < stopR) return { sx: 0, sz: 0 };
  const m = clamp(d / 5, 0.3, 1) * frac;
  return { sx: dx / d * m, sz: dz / d * m };
}
const clampField = (x, z) => [clamp(x, -HW + 1.4, HW - 1.4), clamp(z, -HL + 2.5, HL - 2.5)];

// ---- ETA of a rider to the ball (rough) ------------------------------------------------------------------------------------------
function eta(s, r) {
  const b = s.ball;
  const sp = V_BASE * (r.human ? 0.9 : lvOf(r).cap) * 0.85;
  let t = hyp(b.x - r.x, b.z - r.z) / sp;
  const px = b.x + b.vx * t * 0.7, pz = b.z + b.vz * t * 0.7;
  t = hyp(px - r.x, pz - r.z) / sp;
  const ang = Math.abs(wrap(Math.atan2(px - r.x, pz - r.z) - r.h));
  return t + ang * 0.25 * (r.v > 3 ? 1.2 : 0.6);
}

// Two-phase: both teams choose their chaser from the PREVIOUS tick's state, then commit together, so neither team sees the other's new choice first.
export function aiTeamThink(s, team, commit) {
  const T = s.ai[team];
  if (commit) { if (T.pending !== undefined) { T.chaser = T.pending; T.pending = undefined; } return; }
  if (s.tick < T.next) return;
  T.next = s.tick + 8;
  const dirZ = team === 0 ? 1 : -1, b = s.ball;
  let best = null, bt = 1e9;
  for (const r of s.riders) {
    if (r.team !== team) continue;
    let t = eta(s, r);
    const ownDist = (b.z - (-dirZ * HL)) * dirZ;
    if (r.role === 2) t += ownDist > 12 ? 1.1 : 0.15;
    if (r.role === 1) t += 0.15;
    if (r.id === T.chaser) t -= 0.45;
    if (t < bt) { bt = t; best = r; }
  }
  T.pending = best ? best.id : -1;
}

// ---- the shot a chaser plans -------------------------------------------------------------------------------------------------------
export function planShot(s, r, rng) {
  const L = lvOf(r), b = s.ball, dirZ = r.team === 0 ? 1 : -1, oppGoalZ = dirZ * HL;
  const opp = s.riders.filter((o) => o.team !== r.team), mates = s.riders.filter((o) => o.team === r.team && o.id !== r.id);
  const nearOpp = Math.min(...opp.map((o) => hyp(o.x - b.x, o.z - b.z)));
  const toGoal = (oppGoalZ - b.z) * dirZ;
  const back = opp.reduce((a, o) => (Math.abs(o.z - oppGoalZ) < Math.abs(a.z - oppGoalZ) ? o : a), opp[0]);
  const gx = back.x > 0 ? -GOAL_HW * 0.55 : GOAL_HW * 0.55;
  let plan = { kind: 'drive', ax: clamp(b.x * 0.3, -2, 2), az: oppGoalZ - dirZ * 3, power: 0.5, why: 'Nothing better is open, so drive the ball upfield toward the goal.' };
  if (toGoal < 11 && (rng.next() < 0.45 + 0.55 * L.sense || toGoal < 6.5)) {
    plan = { kind: 'goal', ax: gx, az: oppGoalZ, power: 0.75, why: `The goal is ${Math.round(toGoal)} m away and the rival back stands on the ${back.x > 0 ? 'right' : 'left'}, so shoot for the ${back.x > 0 ? 'left' : 'right'} side of the posts.` };
  } else {
    let bestM = null, bs = -1e9;
    for (const m of mates) {
      if (m.human) continue;
      const ahead = (m.z - b.z) * dirZ;
      if (ahead < 2 || ahead > 15) continue;
      const lead = { x: m.x + Math.sin(m.h) * m.v * 0.8, z: m.z + Math.cos(m.h) * m.v * 0.8 };
      const gap = Math.min(...opp.map((o) => hyp(o.x - lead.x, o.z - lead.z)));
      const sc = gap * 0.8 + ahead * 0.5 - hyp(lead.x - b.x, lead.z - b.z) * 0.1;
      if (sc > bs) { bs = sc; bestM = { m, lead, gap }; }
    }
    if (bestM && bestM.gap > 4.0 && rng.next() < 0.15 + 0.7 * L.sense) {
      const d = hyp(bestM.lead.x - b.x, bestM.lead.z - b.z);
      plan = { kind: 'pass', ax: bestM.lead.x, az: bestM.lead.z, power: clamp(0.3 + d / 30, 0.35, 0.65), to: bestM.m.id, why: `A teammate is free ahead (the nearest rival is ${Math.round(bestM.gap)} m from him): pass to where he will be.` };
    } else if (nearOpp < 6 && (b.z - (-dirZ * HL)) * dirZ < 11) {
      const side = b.x > 0 ? 1 : -1;
      plan = { kind: 'clear', ax: side * 5.0, az: b.z + dirZ * 11, power: 0.65, why: 'A rival is pressing close to our own goal: clear the ball up the wing, away from the posts.' };
    }
  }
  plan.ang = Math.atan2(plan.ax - b.x, plan.az - b.z);
  plan.t = s.tick;
  return plan;
}

// ---- collision avoidance with right of way ----------------------------------------------------------------------------------------
// Everyone predicts the closest approach to every other rider over the next 1.3 s. The rider with the lower claim on the ball yields: it
// slows and bends away; the rider with the better claim (the one holding the line of the ball, then the chaser, then whoever is nearer the ball) keeps its line.
function claim(s, r) {
  const b = s.ball, d = hyp(b.x - r.x, b.z - r.z);
  let v = -d;
  if (s.ai[r.team].chaser === r.id) v += 6; else if (s.ai[r.team].chaser >= 0) v -= 2;
  if (b.lastRider === r.id) v += 3;
  // riding along the line of the ball (the rider the ball is travelling toward) earns the right of way
  const sp = hyp(b.vx, b.vz);
  if (sp > 4) { const ux = b.vx / sp, uz = b.vz / sp, rx = r.x - b.x, rz = r.z - b.z, along = rx * ux + rz * uz, off = Math.abs(rx * uz - rz * ux); if (along > 0 && off < 2.2) v += 4; }
  return v;
}
const AV = { R: 6, keep: 0.2, bend: 1.6, slow: 0.9 };
function avoid(s, r, c, scale = 1) {
  let ax = 0, az = 0, slow = 1;
  const mine = claim(s, r);
  const rvx = Math.sin(r.h) * r.v, rvz = Math.cos(r.h) * r.v;
  for (const o of s.riders) {
    if (o.id === r.id) continue;
    const px = o.x - r.x, pz = o.z - r.z;
    if (Math.abs(px) > 8 || Math.abs(pz) > 8) continue;
    const vx = Math.sin(o.h) * o.v - rvx, vz = Math.cos(o.h) * o.v - rvz;
    const vv = vx * vx + vz * vz;
    const t = vv > 0.01 ? clamp(-(px * vx + pz * vz) / vv, 0, 1.3) : 0;
    const dx = px + vx * t, dz = pz + vz * t, d = hyp(dx, dz);
    const R = AV.R;
    if (d > R) continue;
    const theirs = claim(s, o);
    // the other rider yields to us when its claim is lower; a tie goes to the rider whose id is lower on team 0 and higher on team 1 (symmetrical)
    const iYield = mine < theirs - 0.01 || (Math.abs(mine - theirs) <= 0.01 && (r.team === 0 ? r.id > o.id : r.id < o.id));
    const near = (R - d) / R * (iYield ? 1 : AV.keep);
    // bend away from where they will be: perpendicular to the line to their future position, on the side that is already ours
    const fx = Math.sin(r.h), fz = Math.cos(r.h), side = (dx * fz - dz * fx) > 0 ? -1 : 1;     // dx*fz - dz*fx > 0: they are to the right of my heading
    ax += fz * side * near * AV.bend * scale; az += -fx * side * near * AV.bend * scale;
    if (iYield) slow = Math.min(slow, 1 - AV.slow * near * scale * (t < 0.6 ? 1 : 0.5));
  }
  const an = hyp(ax, az); if (an > 0.9) { ax *= 0.9 / an; az *= 0.9 / an; }
  slow = Math.max(slow, 0.35);
  if (slow < 1 || ax || az) {
    const m = hyp(c.sx, c.sz);
    if (m > 0.05) { c.sx += ax * m; c.sz += az * m; const m2 = hyp(c.sx, c.sz) || 1; c.sx *= m / m2 * slow; c.sz *= m / m2 * slow; }
  }
}

// ---- the per-rider controller -----------------------------------------------------------------------------------------------------
export function aiControl(S, r, rng) {
  const s = S.s, L = lvOf(r);
  const b = s.ball, team = r.team, dirZ = team === 0 ? 1 : -1, ownZ = -dirZ * HL, oppZ = dirZ * HL;
  const th = r.think;
  const c = { sx: 0, sz: 0, sprint: false, swing: false, hook: false };
  if (s.phase === 'reset' || s.phase === 'goal' || s.phase === 'break' || s.phase === 'end') {
    const g = goTo(r, r.rest.x, r.rest.z, 0.8, 1.0); c.sx = g.sx; c.sz = g.sz;
    avoid(s, r, c, 1);
    return c;
  }
  if (s.phase === 'throw') {
    const g = goTo(r, r.rest.x, r.rest.z, 0.6, 0.6); c.sx = g.sx; c.sz = g.sz;
    if (!g.sx && !g.sz) { const a = dirZ > 0 ? 0 : Math.PI; const e = wrap(a - r.h); if (Math.abs(e) > 0.15) { c.sx = Math.sin(a) * 0.15; c.sz = Math.cos(a) * 0.15; } }
    avoid(s, r, c, 1);
    return c;
  }
  const chaser = s.ai[team].chaser === r.id;
  const restr = s.restart && s.restart.team !== team && !s.restart.hit;
  const mates = s.riders.filter((o) => o.team === team && o.id !== r.id);
  const opps = s.riders.filter((o) => o.team !== team);
  // ---- hook an opposing stroke
  if (r.sw.ph === 'idle' && r.hook.ph === 'idle' && r.hook.cool <= 0 && !restr) {
    let winding = null;
    for (const o of opps) if (o.sw.ph === 'wind' && hyp(o.x - r.x, o.z - r.z) < 2.6) winding = o;
    if (winding) {
      if (!th.hookDecided) { th.hookDecided = true; th.hookWill = rng.next() < L.hook; }
      if (th.hookWill && winding.sw.t >= Math.round(L.react * 60 * 0.4)) { c.hook = true; th.hookWill = false; }
    } else th.hookDecided = false;
  }
  if (restr) {
    const d = hyp(r.x - b.x, r.z - b.z);
    if (d < 7) { const g = goTo(r, r.x + (r.x - b.x) / (d + 0.01) * 3, r.z + (r.z - b.z) / (d + 0.01) * 3, 0.7, 0.2); c.sx = g.sx; c.sz = g.sz; return c; }
  }
  if (chaser) { chase(S, r, c, L, rng); avoid(s, r, c, 1); return c; }
  // ---- positional play
  const pf = positionFor(s, r, mates);
  let tx = pf.x, tz = pf.z;
  [tx, tz] = clampField(tx, tz);
  const g = goTo(r, tx, tz, 0.9 * L.cap, 1.2);
  c.sx = g.sx; c.sz = g.sz;
  c.sprint = hyp(tx - r.x, tz - r.z) > 12 && L.sprint > 0.5 && r.stamina > 0.4;
  avoid(s, r, c, 1);
  return c;
}

function chase(S, r, c, L, rng) {
  const s = S.s, b = s.ball, th = r.think;
  // contest only when we are clearly the farther chaser: then mark the ball from the own-goal side
  const oc = s.ai[1 - r.team].chaser;
  if (oc >= 0 && hyp(b.vx, b.vz) < 3 && (s.ballStill || 0) < 3) {
    const o = s.riders[oc];
    const er = eta(s, r), eo = eta(s, o);
    const symR = r.x * (r.team === 0 ? 1 : -1) + r.z * 1e-3 * (r.team === 0 ? 1 : -1), symO = o.x * (o.team === 0 ? 1 : -1) + o.z * 1e-3 * (o.team === 0 ? 1 : -1);
    if ((er > eo + 0.25 || (Math.abs(er - eo) <= 0.25 && symR < symO)) && r.sw.ph === 'idle') {
      const dirZ = r.team === 0 ? 1 : -1;
      const g = goTo(r, clamp(b.x * 0.8, -HW + 1.5, HW - 1.5), clamp(b.z - dirZ * 4.5, -HL + 2.0, HL - 2.0), 0.7, 0.9);
      c.sx = g.sx; c.sz = g.sz; th.mode = undefined; return;
    }
  }
  if (!th.plan || s.tick - th.plan.t > 20 || (r.sw.ph === 'idle' && th.plan.carried !== b.lastRider && s.tick - th.plan.t > 6)) { th.plan = planShot(s, r, rng); th.plan.carried = b.lastRider; }
  const P = th.plan, ang = P.ang;
  const bs = hyp(b.vx, b.vz);
  const ds = hyp(b.x - r.x, b.z - r.z);
  const tt = clamp(ds / (V_BASE * 1.0), 0.1, 1.5);
  const bp = S.ballAt(Math.min(70, Math.round(tt * 0.9 * 60)));
  // approach options: a heading hc near the shot angle (the hit direction may differ from the heading by up to about 1.2 rad), the ball on the right (R), behind on the right (B) or on the left (L)
  const RR = REACH.R, RL = REACH.L, RB = REACH.B;
  const mk = (hc, kind) => {
    const sh = Math.sin(hc), ch = Math.cos(hc), E = kind === 'R' ? RR : kind === 'B' ? RB : RL;
    const T = kind !== 'L' ? { x: bp.x - (ch * E.latI + sh * E.fI), z: bp.z - (-sh * E.latI + ch * E.fI) } : { x: bp.x + (ch * E.latI - sh * E.fI), z: bp.z + (-sh * E.latI - ch * E.fI) };
    const ok = Math.abs(T.x) < HW - 1.0 && Math.abs(T.z) < HL - 1.6 && Math.abs(T.x) + Math.abs(T.z) < HW + HL - 4.6;
    const d = hyp(T.x - r.x, T.z - r.z);
    const relF = (r.x - T.x) * sh + (r.z - T.z) * ch, relR = (r.x - T.x) * ch - (r.z - T.z) * sh;
    const behind = relF < 0.2 ? 0 : 7;
    const lat = Math.abs(relR) > 0.55 * Math.max(0.5, -relF) + 0.9 ? 3 : 0;
    const kp = kind === 'L' ? NS.pen : kind === 'B' ? 3.2 : 0;
    return { hc, kind, T, ok, relF, relR, score: d + 1.1 * Math.abs(wrap(hc - r.h)) + 1.6 * Math.abs(wrap(ang - hc)) + behind + lat + kp + (ok ? 0 : 50) };
  };
  const cands = [];
  for (const dh of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2]) cands.push(mk(wrap(ang + dh), 'R'));
  for (const dh of NS.n > 3 ? [0, 0.5, -0.5, 0.9, -0.9] : [0, 0.5, -0.5]) cands.push(mk(wrap(ang + dh), 'L'));
  for (const dh of [Math.PI, 2.6, -2.6, 2.0, -2.0]) cands.push(mk(wrap(ang + dh), 'B'));
  let best = cands[0]; for (const c2 of cands) if (c2.score < best.score) best = c2;
  const prev = th.cand && cands.find((c2) => Math.abs(wrap(c2.hc - th.cand.hc)) < 1e-6 && c2.kind === th.cand.kind);
  if (prev && prev.ok && prev.score < best.score + 1.2) best = prev;
  th.cand = { hc: best.hc, kind: best.kind }; th.side = best.kind === 'L' ? -1 : 1;
  const T = best.T; [T.x, T.z] = clampField(T.x, T.z);
  const sh = Math.sin(best.hc), ch = Math.cos(best.hc);
  const relF = (r.x - T.x) * sh + (r.z - T.z) * ch, relR = (r.x - T.x) * ch - (r.z - T.z) * sh;
  let m, a;
  if (relF > 0.6) {
    // no clean line from here: swing wide to a point behind the stand spot
    const Wp = { x: T.x - sh * 3.6, z: T.z - ch * 3.6 }; [Wp.x, Wp.z] = clampField(Wp.x, Wp.z);
    a = Math.atan2(Wp.x - r.x, Wp.z - r.z); m = 0.9; th.mode = 'loop';
  } else {
    a = best.hc - clamp(Math.atan2(3.4 * relR, r.v + 1.0), -1.2, 1.2);
    const lo = 4.4 - 1.4 * L.sense * L.sense;      // better riders slow down for the stroke
    const want = clamp(lo + bs * 0.45 + 0.6 * Math.abs(relF), lo, V_BASE * 0.95);
    m = clamp(want / V_BASE, 0.35, 1); th.mode = 'run';
  }
  c.sx = Math.sin(a) * m; c.sz = Math.cos(a) * m;
  c.sprint = relF < -7 && r.stamina > 0.3 && L.sprint > 0.4;
  // ---- the stroke: start the wind-up when a contact tick inside the envelope is predicted
  const desired = P.kind === 'goal' ? Math.min(P.power, 0.7) : Math.min(P.power, 0.36);
  const windTicks = Math.round(clamp((desired - 0.3) / 0.7, 0, 1) * WIND_MAX / DT);
  if (r.sw.ph === 'idle' && s.phase === 'live' && r.sw.cool <= 0 && r.stun <= 0) {
    const bsx = S.bestStroke(r, ang, windTicks + STRIKE_MIN + 1, windTicks + STRIKE_MAX + 1);
    const need = 0.3;
    if (bsx.q >= need) {
      if (th.delay === undefined) th.delay = s.tick + Math.round(L.react * 60 * 0.5);
      if (s.tick >= th.delay) {
        if (s.cfg.watch && S.holdRequest && S.holdRequest(r, P, bsx)) return;
        c.swing = true; c.autoRelease = windTicks; c.aim = ang; c.power = desired; th.delay = undefined;
      }
    } else th.delay = undefined;
  } else if (r.sw.ph === 'wind') {
    c.swing = true; c.autoRelease = windTicks; c.aim = ang; c.power = desired;
    if (windTicks - r.sw.t <= 3) { const chk = S.bestStroke(r, ang, STRIKE_MIN, STRIKE_MAX); if (chk.q < 0.25) c.cancel = true; }
  }
}

// Where a rider without the ball should be, and why (used by the AI and by the Think hint, so the advice is what the computer would do).
export function positionFor(s, r, mates) {
  const b = s.ball, dirZ = r.team === 0 ? 1 : -1, ownZ = -dirZ * HL, oppZ = dirZ * HL;
  const away = (b.z - ownZ) * dirZ;
  let tx, tz, why;
  if (r.role === 0) {
    tz = dirZ * clamp(b.z * dirZ + 4.5, -HL + 6, HL - 4); tx = -Math.sign(b.x || 1) * 3.2; why = 'Stay ahead of the ball on the side away from it, ready for a pass.';
    if (away < 10) { tz = dirZ * 2.5; why = 'The ball is deep in your own half: wait near the middle for a counter-attack.'; }
    if (away > 23) { tz = oppZ - dirZ * 4.5; tx = Math.sign(b.x || 1) * -2.0; why = 'The ball is near their goal: wait at the far post for a rebound or pass.'; }
  } else if (r.role === 1) {
    tz = dirZ * clamp(b.z * dirZ - 3, -HL * 0.7, HL * 0.9); tx = b.x * 0.5 + (b.x > 0 ? -2.6 : 2.6); why = 'Shadow the ball a few metres behind it, on the other side, to win loose balls.';
  } else {
    tz = ownZ + dirZ * clamp(away * 0.42, 4, 10); tx = clamp(b.x * 0.35, -2.5, 2.5); why = 'Stay between the ball and your own goal.';
  }
  for (const m of mates || []) { const d = hyp(tx - m.x, tz - m.z); if (d < 4.2 && d > 0.01) { tx += (tx - m.x) / d * (4.2 - d); tz += (tz - m.z) / d * (4.2 - d); } }
  // keep clear of the ball: only the chaser plays it, everyone else leaves it room
  { const dx = tx - b.x, dz = tz - b.z, d = hyp(dx, dz); if (d < 5.2) { const k = d > 0.01 ? 5.2 / d : 0; tx = d > 0.01 ? b.x + dx * k : b.x + 5.2 * Math.sin(r.h); tz = d > 0.01 ? b.z + dz * k : b.z + 5.2 * Math.cos(r.h); } }
  const c = clampField(tx, tz);
  return { x: c[0], z: c[1], why };
}
