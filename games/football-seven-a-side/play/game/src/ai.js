// Computer players: a cheap team plan (5 Hz) plus a per-player decision slot. Everything here is a pure function of the sim state and
// the seeded stream. Levels differ in reaction time, speed, accuracy, vision and pressing (see consts.js LEVELS), not in rules.
import { HL, HW, GOAL_HW, BOX_HW, BOX_D, ANCHOR, BR, G } from './consts.js';
import { clamp, lerp, normal, segDist, angDiff } from './util.js';
import { predictPath } from './phys.js';

const dirOf = (t) => (t === 0 ? 1 : -1);
const latSign = (t) => (t === 0 ? 1 : -1);
const depthOf = (t, z) => (t === 0 ? z + HL : HL - z);
const toWorld = (t, lat, d) => ({ x: latSign(t) * lat, z: t === 0 ? -HL + d : HL - d });
const ownGoalZ = (t) => (t === 0 ? -HL : HL);
const insideBox = (t, x, z) => Math.abs(x) <= BOX_HW && depthOf(t, z) <= BOX_D;

function setMove(p, tx, tz, mode, arrive = true) {
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  p.tx = tx; p.tz = tz;
  if (d < 0.25) { p.cmd = { dx: 0, dz: 0, v: 0 }; return; }
  const vmax = p.st.vmax;
  let v = mode === 'sprint' ? vmax : mode === 'run' ? vmax * 0.8 : mode === 'jog' ? vmax * 0.56 : vmax * 0.3;
  if (arrive) v = Math.min(v, 1.6 + d * 3.2);
  p.cmd = { dx: dx / d, dz: dz / d, v };
}

// ---- shared measures ---------------------------------------------------------------------------------------------------------------------
export function freeSpace(X, x, z, team, cap = 6) {
  let m = cap;
  for (const q of X.P) if (q.team !== team) { const d = Math.hypot(q.x - x, q.z - z); if (d < m) m = d; }
  return m;
}
export function xgAt(X, team, x, z, fromId = -1) {
  const gz = dirOf(team) * HL, dgz = Math.abs(gz - z), dg = Math.hypot(x, dgz);
  if (dgz < 0.3 || dg > 16) return 0;
  const a1 = Math.atan2(-GOAL_HW - x, dgz), a2 = Math.atan2(GOAL_HW - x, dgz), alpha = Math.abs(a2 - a1);
  let xg = clamp(alpha * 0.95, 0, 0.75) * Math.exp(-Math.max(0, dg - 5) / 6.5);
  for (const q of X.P) {
    if (q.team === team || q.id === fromId) continue;
    const sd = segDist(q.x, q.z, x, z, 0, gz);
    if (sd.u > 0.03 && sd.u < 0.98 && sd.d < (q.role === 'GK' ? 0.9 : 0.75)) xg *= q.role === 'GK' ? 0.62 : 0.5;
  }
  return xg;
}
// seconds before the nearest opponent could intercept a pass p -> (tx,tz) at ball speed ~ v (positive margin = safe)
export function laneMargin(X, p, tx, tz, v = 11) {
  let worst = 9;
  const d = Math.hypot(tx - p.x, tz - p.z);
  for (const o of X.P) {
    if (o.team === p.team || o.role === 'GK' && d < 14) continue;
    const sd = segDist(o.x, o.z, p.x, p.z, tx, tz);
    const tBall = sd.u * d / v;
    const tOpp = Math.max(0, sd.d - 0.45) / (o.st.vmax * 0.85) + 0.12;
    const m = tOpp - tBall;
    if (m < worst) worst = m;
  }
  return worst;
}

// ---- the team plan -------------------------------------------------------------------------------------------------------------------------
export function teamThink(X, t) {
  const s = X.s, B = s.ball, P = X.P, tm = X.tm[t];
  const path = X.predictBall();
  tm.has = B.owner >= 0 ? P[B.owner].team : B.held >= 0 ? P[B.held].team : -1;
  tm.carrier = B.owner >= 0 && P[B.owner].team === t ? B.owner : -1;
  tm.oppCarrier = B.owner >= 0 && P[B.owner].team !== t ? B.owner : -1;
  // time to the ball for every outfield player of this team (and the opposing best, to know who wins the race)
  let bestMine = 99, mine = -1, bestOpp = 99, bestHuman = 99;
  for (const p of P) {
    if (p.role === 'GK' && !(insideBox(p.team, B.x, B.z) || Math.abs(B.z - ownGoalZ(p.team)) < 7)) continue;
    let best = 99, bi = null;
    if (B.owner >= 0 || B.held >= 0) {
      const o = B.owner >= 0 ? P[B.owner] : P[B.held];
      if (o.team === p.team) continue;
      best = Math.hypot(o.x - p.x, o.z - p.z) / (p.st.vmax * 0.85);
      bi = { x: o.x, z: o.z, t: best };
    } else {
      for (let i = 0; i < path.length; i += 1) {
        const q = path[i];
        if (q.y > 2.2) continue;
        const d = Math.hypot(q.x - p.x, q.z - p.z);
        const tt = Math.max(0, d - 0.35) / (p.st.vmax * 0.9) + 0.1;
        if (tt <= q.t + 0.05) { best = q.t; bi = q; break; }
        if (tt < best) { best = tt + 0.3; bi = q; }
      }
      if (!bi) { const q = path[path.length - 1]; bi = q; best = 3; }
    }
    p.ai.tti = best; p.ai.ix = bi.x; p.ai.iz = bi.z;
    if (p.team === t) {
      if (p.human) { bestHuman = best; continue; }
      if (best < bestMine) { bestMine = best; mine = p.id; }
    } else if (best < bestOpp) bestOpp = best;
  }
  // if the human is clearly the first to the ball, the computer teammates leave it
  if (bestHuman + 0.35 < bestMine) mine = -1;
  tm.chaser = mine; tm.tChase = bestMine; tm.tOpp = bestOpp;
  // second presser: next closest to the carrier
  tm.second = -1;
  if (tm.oppCarrier >= 0) {
    let b2 = 99;
    for (const p of P) if (p.team === t && !p.human && p.role !== 'GK' && p.id !== mine) { const d = Math.hypot(P[tm.oppCarrier].x - p.x, P[tm.oppCarrier].z - p.z); if (d < b2) { b2 = d; tm.second = p.id; } }
  }
  // marking assignment (greedy by distance between my player's anchor-ish position and each opponent attacker)
  if (s.tick % 12 === (t === 0 ? 0 : 6) || !tm.mark) {
    tm.mark = {};
    const taken = new Set();
    const defenders = P.filter((p) => p.team === t && p.role !== 'GK' && p.role !== 'ST' && p.id !== tm.chaser && p.id !== tm.second);
    const attackers = P.filter((q) => q.team !== t && q.role !== 'GK' && q.id !== tm.oppCarrier);
    const pairs = [];
    for (const d of defenders) for (const a of attackers) pairs.push([Math.hypot(d.x - a.x, d.z - a.z) + (d.human ? 3 : 0), d.id, a.id]);
    pairs.sort((u, v) => u[0] - v[0] || u[1] - v[1]);
    const used = new Set();
    for (const [dd, did, aid] of pairs) { if (used.has(did) || taken.has(aid) || dd > 14) continue; tm.mark[did] = aid; used.add(did); taken.add(aid); }
  }
  // last opposing defender depth (for runs behind the line)
  let ld = 99;
  for (const q of P) if (q.team !== t && q.role !== 'GK') ld = Math.min(ld, depthOf(t === 0 ? 1 : 0, q.z));
  tm.oppLine = ld;   // depth measured from the OPPONENT'S own goal line: the lowest is their deepest defender
}

// ---- player decisions ------------------------------------------------------------------------------------------------------------------------
export function playerThink(X, p) {
  const s = X.s;
  if (s.phase !== 'play') return;
  if (p.role === 'GK') { gkThink(X, p); return; }
  const B = s.ball;
  if (B.owner === p.id) { carrierThink(X, p); return; }
  if (s.t < p.ai.at) { followTarget(X, p); return; }
  p.ai.at = s.t + p.st.react * (0.35 + 0.5 * X.rng.next());
  const tm = X.tm[p.team];
  if (tm.has === p.team) attackThink(X, p, tm);
  else defendThink(X, p, tm);
}
function followTarget(X, p) {
  // keep heading to the (slightly stale) target; chasers keep updating through their think slot
  if (p.cmd && p.cmd.v > 0) setMove(p, p.tx, p.tz, p.ai.mode || 'run');
}

function anchorFor(X, p, tm, attacking) {
  const s = X.s, B = s.ball, t = p.team;
  const a = ANCHOR[p.role];
  const bd = depthOf(t, B.z);
  let d = a.d + clamp((bd - 19) * (attacking ? 0.5 : 0.38), -7, 8);
  if (!attacking) d = Math.min(d, Math.max(a.d - 3, bd - 5.5)) * p.st.line;
  if (p.role === 'DL' || p.role === 'DR') d = clamp(d, 5, attacking ? 24 : 18);
  else d = clamp(d, 4, 33);
  let lat = a.lat * (attacking ? 1.1 : 0.82);
  // slide the shape towards the ball side
  const ballLat = latSign(t) * B.x;
  lat += clamp(ballLat - lat, -9, 9) * (attacking ? 0.14 : 0.3);
  return toWorld(t, clamp(lat, -HW + 1.4, HW - 1.4), d);
}
function separateFrom(X, p, pos, r = 3.2) {
  let x = pos.x, z = pos.z;
  for (const q of X.P) if (q.team === p.team && q.id !== p.id && q.role !== 'GK') {
    const dx = x - q.x, dz = z - q.z, d = Math.hypot(dx, dz);
    if (d < r && d > 1e-6) { const k = (r - d) * 0.45; x += dx / d * k; z += dz / d * k; }
  }
  return { x: clamp(x, -HW + 1, HW - 1), z: clamp(z, -HL + 1, HL - 1) };
}

export function attackSpot(X, p, tm) {
  const s = X.s, B = s.ball, t = p.team, dd = dirOf(t);
  let pos = anchorFor(X, p, tm, true);
  const carrier = tm.carrier >= 0 ? X.P[tm.carrier] : (B.owner >= 0 ? X.P[B.owner] : null);
  let mode = 'jog';
  if (p.role === 'ST') {
    // sit on the shoulder of the last defender and drift to the open lane
    const lineZ = t === 0 ? HL - tm.oppLine : -HL + tm.oppLine;
    const wantD = clamp(depthOf(t, lineZ) - 1.2, 14, 33);
    let bestX = pos.x, bs = -9;
    for (const ox of [-6, -3.5, -1.5, 0, 1.5, 3.5, 6]) {
      const x = clamp(ox + (p.x * 0.4), -HW + 2, HW - 2);
      const z = toWorld(t, 0, wantD).z;
      let sc = freeSpace(X, x, z, t, 5) * 0.8 - Math.abs(x) * 0.1 + (carrier ? (laneMargin(X, carrier, x, z) * 1.2) : 0) - Math.abs(x - p.x) * 0.08;
      if (sc > bs) { bs = sc; bestX = x; }
    }
    pos = { x: bestX, z: toWorld(t, 0, wantD).z };
    mode = Math.hypot(pos.x - p.x, pos.z - p.z) > 5 ? 'sprint' : 'run';
  } else if (p.role === 'WL' || p.role === 'WR') {
    const sx = latSign(t) * (p.role === 'WL' ? 1 : -1);
    const wide = (HW - 2.8) * sx;
    const bd = depthOf(t, B.z);
    const d = clamp(Math.max(ANCHOR[p.role].d, bd + 3.5), 12, 31);
    pos = { x: lerp(wide, pos.x, 0.25), z: toWorld(t, 0, d).z };
    // when the other wing has the ball cut in at the far post
    if (carrier && Math.sign(carrier.x) === -Math.sign(wide) && depthOf(t, B.z) > 18) pos.x = wide * 0.45;
    mode = Math.hypot(pos.x - p.x, pos.z - p.z) > 4 ? 'sprint' : 'run';
  } else if (p.role === 'CM') {
    // support at an angle behind or beside the ball, away from the nearest defender
    if (carrier && carrier !== p) {
      let best = null, bs = -99;
      for (const ang of [-2.4, -1.9, -1.4, 1.4, 1.9, 2.4]) {
        const a = Math.atan2(Math.sin(carrier.face), Math.cos(carrier.face)) + ang;   // relative to the carrier's facing
        const x = carrier.x + Math.sin(a) * 6.5, z = carrier.z + Math.cos(a) * 6.5;
        if (Math.abs(x) > HW - 1 || Math.abs(z) > HL - 2) continue;
        const sc = freeSpace(X, x, z, t, 5) + laneMargin(X, carrier, x, z) * 1.5 - Math.abs(x - pos.x) * 0.08 - Math.abs(depthOf(t, z) - pos.z * 0 - ANCHOR.CM.d - 4) * 0.05;
        if (sc > bs) { bs = sc; best = { x, z }; }
      }
      if (best) pos = best;
    }
    mode = 'run';
  } else {
    // defenders stay as an outlet, a step behind the ball
    const bd = depthOf(t, B.z);
    pos = toWorld(t, ANCHOR[p.role].lat * 0.9, clamp(bd - 9, 6, 22));
    mode = 'jog';
  }
  pos = separateFrom(X, p, pos);
  return { pos, mode };
}
function attackThink(X, p, tm) {
  const s = X.s, t = p.team;
  // loose ball: the chaser goes for it even when we are attacking
  if (tm.chaser === p.id && tm.has !== t) { chase(X, p, tm); return; }
  const { pos, mode } = attackSpot(X, p, tm);
  p.ai.mode = mode;
  setMove(p, pos.x, pos.z, mode);
  p.look = -1;
}

function chase(X, p, tm) {
  const s = X.s, B = s.ball;
  const ix = p.ai.ix ?? B.x, iz = p.ai.iz ?? B.z;
  const d = Math.hypot(ix - p.x, iz - p.z);
  p.ai.mode = 'sprint';
  setMove(p, ix, iz, d > 2 ? 'sprint' : 'run', true);
  // an aerial ball: head or volley when it is about to arrive at the right height
  const near = Math.hypot(B.x - p.x, B.z - p.z);
  if (B.y > 1.15 && B.y < 2.5 && near < 2.2 && X.canAct(p)) {
    const path = X.predictBall();
    for (const q of path) if (q.y > 1.2 && q.y < 2.2 && Math.hypot(q.x - p.x, q.z - p.z) < 1.0 && q.t > 0.12 && q.t < 0.55) {
      const gz = dirOf(p.team) * HL;
      const dg = Math.abs(gz - p.z);
      const goalward = dg < 10;
      const tgt = goalward ? { x: clamp(p.x * 0.3 + (X.rng.next() - 0.5) * 3, -GOAL_HW + 0.4, GOAL_HW - 0.4), z: gz } : clearTarget(X, p);
      X.head(p, { tx: tgt.x, tz: tgt.z, power: goalward ? 0.9 : 0.6, eta: clamp(q.t, 0.2, 0.5) });
      return;
    }
  }
  if (near < 0.9 && B.owner < 0 && B.y < 1.0 && X.canAct(p) && p.ai.tti > 0 && Math.hypot(B.vx, B.vz) > 7.5 && p.st.ctrl > 0.5 && X.rng.next() < 0.5) {
    // first-time clear / pass on a fast ball
    const o = firstTime(X, p);
    if (o) X.kick(p, o.kind, o);
  }
}
function firstTime(X, p) {
  const opts = X.evalOptions(p, true);
  const best = opts.find((o) => o.kind !== 'dribble');
  return best || null;
}
function clearTarget(X, p) {
  const t = p.team;
  const side = p.x >= 0 ? 1 : -1;
  return { x: side * (HW - 2.5), z: clamp(p.z + dirOf(t) * 14, -HL + 3, HL - 3) };
}

export function defendSpot(X, p, tm) {
  const s = X.s, B = s.ball, t = p.team, P = X.P;
  const own = ownGoalZ(t);
  const carrier = tm.oppCarrier >= 0 ? P[tm.oppCarrier] : null;
  if (tm.chaser === p.id) return { kind: 'press', carrier };
  if (tm.second === p.id && p.st.press > 0.5 && carrier) {
    const gx = 0 - carrier.x, gz = own - carrier.z, l = Math.hypot(gx, gz) || 1;
    const px = carrier.x + gx / l * 3.2 + (carrier.x > p.x ? -1 : 1) * 1.4, pz = carrier.z + gz / l * 3.2;
    return { kind: 'cover', pos: { x: clamp(px, -HW + 1, HW - 1), z: pz }, carrier };
  }
  const mk = tm.mark ? tm.mark[p.id] : undefined;
  let pos = anchorFor(X, p, tm, false);
  let marking = -1;
  if (mk !== undefined) {
    const o = P[mk];
    const gx = 0 - o.x, gz = own - o.z, l = Math.hypot(gx, gz) || 1;
    const dOpp = Math.hypot(o.x - pos.x, o.z - pos.z);
    if (dOpp < 11 || (p.role === 'DL' || p.role === 'DR')) {
      const bx = B.x - o.x, bz = B.z - o.z, bl = Math.hypot(bx, bz) || 1;
      const px = o.x + gx / l * 1.5 + bx / bl * 0.8, pz = o.z + gz / l * 1.5 + bz / bl * 0.8;
      pos = { x: lerp(pos.x, px, 0.8), z: lerp(pos.z, pz, 0.8) }; marking = mk;
    }
  }
  if (p.role === 'DL' || p.role === 'DR') {
    for (const o of P) if (o.team !== t && o.role === 'ST') { const od = depthOf(t, o.z); if (depthOf(t, pos.z) > od - 0.8 && Math.abs(o.x - pos.x) < 6) pos.z = toWorld(t, 0, Math.max(3, od - 1.0)).z; }
  }
  pos = separateFrom(X, p, pos, 2.6);
  return { kind: marking >= 0 ? 'mark' : 'hold', pos, mark: marking, carrier };
}
function defendThink(X, p, tm) {
  const r = defendSpot(X, p, tm);
  if (r.kind === 'press') { pressOrChase(X, p, tm, r.carrier); return; }
  p.ai.mode = 'run';
  const pos = r.pos;
  if (r.kind === 'cover') { setMove(p, pos.x, pos.z, 'run'); return; }
  const d = Math.hypot(pos.x - p.x, pos.z - p.z);
  setMove(p, pos.x, pos.z, d > 6 ? 'sprint' : d > 2.5 ? 'run' : 'jog');
  p.look = r.carrier ? r.carrier.id : -1;
}
function pressOrChase(X, p, tm, carrier) {
  const s = X.s, B = s.ball, t = p.team;
  if (!carrier) { chase(X, p, tm); return; }
  const own = ownGoalZ(t);
  const d = Math.hypot(carrier.x - p.x, carrier.z - p.z);
  // jockey: stay between the carrier and my goal, a step from him
  const gx = 0 - carrier.x, gz = own - carrier.z, gl = Math.hypot(gx, gz) || 1;
  const stand = d < 6 ? 1.35 : 0;
  const cvx = carrier.vx, cvz = carrier.vz;
  const tx = carrier.x + cvx * 0.22 + gx / gl * stand, tz = carrier.z + cvz * 0.22 + gz / gl * stand;
  p.ai.mode = 'sprint';
  setMove(p, tx, tz, d > 3 ? 'sprint' : 'run', d < 3);
  p.look = carrier.id;
  // tackle when in range, facing the carrier, with a level-dependent patience
  const aggr = p.st.press;
  if (d < 1.55 && X.canAct(p) && p.cd.tkl <= 0) {
    const fx = Math.sin(p.face), fz = Math.cos(p.face);
    const ax = (carrier.x - p.x) / (d || 1), az = (carrier.z - p.z) / (d || 1);
    const facing = fx * ax + fz * az;
    const closing = d < 1.25;
    if (facing > 0.55 && closing && X.rng.next() < 0.16 + 0.22 * aggr) { X.tackle(p, false); return; }
    if (d < 2.4 && d > 1.2 && aggr > 0.85 && facing > 0.8 && Math.hypot(carrier.vx, carrier.vz) > 3.5 && X.rng.next() < 0.03) { X.tackle(p, true); return; }
  }
}

// ---- the ball carrier ------------------------------------------------------------------------------------------------------------------------
// Returns scored options (no randomness): { kind: 'shot'|'pass'|'through'|'lob'|'cross'|'dribble'|'clear', score, ... }
export function evalOptions(X, p, quick = false) {
  const s = X.s, t = p.team, dd = dirOf(t), P = X.P, B = s.ball;
  const opts = [];
  const pd = depthOf(t, p.z);
  const pressure = X.pressure(p);
  const gz = dd * HL;
  // 1. shot
  const xg = xgAt(X, t, p.x, p.z, p.id);
  const dg = Math.hypot(p.x, gz - p.z);
  if (xg > 0.05 && dg < 15) {
    // choose the corner away from the keeper
    const gk = P[(1 - t) * 7];
    let tx = (gk.x > 0 ? -1 : 1) * (GOAL_HW - 0.55 - (1 - p.st.shot) * 0.2);
    if (Math.abs(p.x) > 3) tx = (p.x > 0 ? -1 : 1) * (GOAL_HW - 0.6);
    const ty = dg < 7 ? 0.35 : 0.6;
    opts.push({ kind: 'shot', tx, tz: gz, ty, power: clamp(0.55 + dg / 20, 0.5, 0.95), score: xg * 3.0 + 0.05, xg, why: `shot from ${dg.toFixed(0)} m, about ${Math.round(xg * 100)} percent chance` });
  }
  // 2. passes
  for (const q of P) {
    if (q.team !== t || q.id === p.id) continue;
    const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
    if (d < 2.2 || d > 26) continue;
    if (q.role === 'GK' && pd > 12) continue;
    const qd = depthOf(t, q.z);
    const progress = (qd - pd);
    const space = freeSpace(X, q.x, q.z, t, 5);
    const exg = xgAt(X, t, q.x, q.z, q.id);
    const m = laneMargin(X, p, q.x, q.z, 12);
    const hasLane = m > 0.12;
    const called = s.call && s.call.id === q.id && s.t - s.call.t < 1.6 ? 0.7 : 0;
    const base = progress * 0.085 + space * 0.18 + exg * 2.2 + (q.human ? -0.15 : 0) + called;
    // ground pass
    if (hasLane) opts.push({ kind: 'pass', tgt: q.id, tx: q.x, tz: q.z, power: 0.5, score: base + Math.min(m, 0.6) * 1.2 - d * 0.015 - (q.role === 'GK' ? 0.5 : 0), margin: m, why: `${roleWord(q)} is free${space > 3 ? '' : ' enough'}` });
    // through ball: receiver running forward into space beyond the line
    const rv = (q.vz * dd);
    if (qd > pd + 2.5 && rv > 1.5 && d > 5) {
      const lx = q.x + q.vx * 0.7, lz = q.z + q.vz * 0.7;
      const mm = laneMargin(X, p, lx, lz, 12);
      if (mm > 0.05) opts.push({ kind: 'through', tgt: q.id, tx: lx, tz: lz, power: 0.6, score: base + 0.55 + Math.min(mm, 0.5) - d * 0.012, margin: mm, why: `${roleWord(q)} is running in behind` });
    }
    // lob / cross over the defenders: only when the ground is blocked, or a cross from the wing into the area
    if (d > 8 && !quick) {
      const T = 1.0 + d * 0.05 + 0.055;
      let lm = 9; for (const o of P) if (o.team !== t && o.role !== 'GK') { const tt = Math.max(0, Math.hypot(o.x - q.x, o.z - q.z) - 0.6) / (o.st.vmax * 0.85) + 0.15; lm = Math.min(lm, tt - T); }
      const open = space > 2.4 && lm > -0.55;
      const wide = Math.abs(p.x) > 6.5 && qd > 22 && Math.abs(q.x) < BOX_HW + 1;
      if (((open && !hasLane) || (wide && lm > -1.1 && space > 1.2)) && (q.role !== 'GK')) opts.push({ kind: wide ? 'cross' : 'lob', tgt: q.id, tx: q.x, tz: q.z, power: 0.55, score: base * 0.8 + (hasLane ? -0.5 : 0.05) + (wide ? 0.85 : 0) - d * 0.012, margin: m, why: wide ? `cross into the area for the ${roleWord(q)}` : `lofted over the defenders to the ${roleWord(q)}` });
    }
  }
  // 3. dribble: the best of a few directions
  let bestDir = null;
  const baseAng = Math.atan2(0, dd);   // straight at their goal
  for (const off of [-1.0, -0.6, -0.25, 0, 0.25, 0.6, 1.0]) {
    const a = baseAng + off;
    const ux = Math.sin(a), uz = Math.cos(a);
    let free = 6;
    for (const o of P) {
      if (o.team === t) continue;
      const rx = o.x - p.x, rz = o.z - p.z, along = rx * ux + rz * uz, lat = Math.abs(rx * uz - rz * ux);
      if (along > 0 && lat < 1.5) free = Math.min(free, along - 0.5);
    }
    // walls
    const wx = ux > 0 ? (HW - 0.8 - p.x) / ux : ux < 0 ? (-HW + 0.8 - p.x) / ux : 99; const wz = uz > 0 ? (HL - 0.8 - p.z) / uz : uz < 0 ? (-HL + 0.8 - p.z) / uz : 99;
    free = Math.min(free, wx, wz);
    const sc = free * 0.2 + uz * dd * 0.5 - Math.abs(off) * 0.05;
    if (!bestDir || sc > bestDir.sc) bestDir = { sc, ux, uz, free };
  }
  if (bestDir) {
    const dscore = bestDir.sc * 0.55 - pressure * 0.55 + (pd > 26 ? 0.1 : 0) - 0.05;
    opts.push({ kind: 'dribble', ux: bestDir.ux, uz: bestDir.uz, score: dscore, free: bestDir.free, why: bestDir.free > 3 ? 'open grass ahead' : 'space is tight' });
  }
  // 4. clear: when in trouble near my own goal
  if (pd < 10 && pressure > 0.55) { const ct = clearTarget(X, p); opts.push({ kind: 'clear', tx: ct.x, tz: ct.z, power: 0.8, score: 0.35 + pressure * 0.4, why: 'under pressure in front of my own goal' }); }
  opts.sort((a, b) => b.score - a.score);
  return opts;
}
function roleWord(q) { return q.role === 'ST' ? 'striker' : q.role === 'WL' || q.role === 'WR' ? 'winger' : q.role === 'CM' ? 'midfielder' : q.role === 'GK' ? 'goalkeeper' : 'defender'; }

function carrierThink(X, p) {
  const s = X.s, B = s.ball;
  if (!X.canAct(p)) { return; }
  if (s.t < p.ai.at) { dribbleStep(X, p); return; }
  p.ai.at = s.t + p.st.react * (0.25 + 0.4 * X.rng.next());
  const opts = X.evalOptions(p);
  if (!opts.length) { dribbleStep(X, p); return; }
  // noise by decision quality
  const noise = (1 - p.st.dec) * 0.35;
  let best = null, bs = -9;
  for (const o of opts) {
    // limited vision: a level sometimes does not see an option
    if (o.kind !== 'dribble' && X.rng.next() > 0.5 + 0.5 * p.st.vis) continue;
    const sc = o.score + normal(X.rng) * noise;
    if (sc > bs) { bs = sc; best = o; }
  }
  if (!best) best = opts[0];
  const pr = X.pressure(p);
  if (best.kind === 'dribble') { p.ai.dir = { x: best.ux, z: best.uz, until: s.t + 0.45 }; dribbleStep(X, p); return; }
  // a pass with a poor margin may wait for a better moment unless pressed
  if ((best.kind === 'pass' || best.kind === 'through' || best.kind === 'lob' || best.kind === 'cross') && best.margin < 0.15 && pr < 0.4) { p.ai.dir = { x: Math.sin(p.face), z: Math.cos(p.face), until: s.t + 0.25 }; dribbleStep(X, p); return; }
  // Watch & Learn: stop and explain the important decisions
  if (s.spec && X.holdCool <= 0 && p.team === 0 && (best.kind === 'shot' || best.kind === 'through' || best.kind === 'cross' || (best.kind === 'pass' && depthOf(0, best.tz) > 22))) {
    s.hold = { id: p.id, kind: best.kind, options: opts.slice(0, 4).map(slim), chosen: slim(best), x: p.x, z: p.z, run: () => commit(X, p, best), n: (X.holdN = (X.holdN || 0) + 1) };
    return;
  }
  commit(X, p, best);
}
const slim = (o) => ({ kind: o.kind, tgt: o.tgt ?? -1, tx: o.tx ?? 0, tz: o.tz ?? 0, score: Math.round(o.score * 100) / 100, why: o.why, xg: o.xg });
export function commit(X, p, o) {
  if (!X.canAct(p)) return;
  const curve = o.kind === 'shot' ? clamp(normal(X.rng) * 0.0, -1, 1) : 0;
  if (o.kind === 'dribble') { p.ai.dir = { x: o.ux, z: o.uz, until: X.s.t + 0.45 }; return; }
  X.kick(p, o.kind, { tx: o.tx, tz: o.tz, ty: o.ty, power: o.power, tgt: o.tgt ?? -1, curve });
}
function dribbleStep(X, p) {
  const s = X.s;
  let d = p.ai.dir;
  if (!d || s.t > d.until) d = p.ai.dir = { x: 0, z: dirOf(p.team), until: s.t + 0.3 };
  const free = freeSpace(X, p.x + d.x * 3, p.z + d.z * 3, p.team, 5);
  p.cmd = { dx: d.x, dz: d.z, v: free > 3 ? p.st.vmax * 0.93 : p.st.vmax * 0.7 };
  p.look = -1;
}

// ---- the goalkeeper ----------------------------------------------------------------------------------------------------------------------------
function gkThink(X, p) {
  const s = X.s, B = s.ball, t = p.team, P = X.P;
  const gz = ownGoalZ(t), sg = t === 0 ? 1 : -1;       // sg: direction from the goal line into the pitch
  const ai = p.ai;
  if (B.held === p.id) {
    p.cmd = { dx: 0, dz: 0, v: 0 };
    if (!p.act) {
      if (!ai.rel) ai.rel = s.t + 1.0 + 1.2 * X.rng.next();
      if (s.t >= ai.rel) {
        ai.rel = 0;
        // pick a free teammate; short throw to a defender, or a long kick when nobody is free
        let best = null, bs = -9;
        for (const q of P) {
          if (q.team !== t || q.id === p.id) continue;
          const d = Math.hypot(q.x - p.x, q.z - p.z);
          const m = laneMargin(X, p, q.x, q.z, 11);
          const sc = freeSpace(X, q.x, q.z, t, 5) * 0.4 + m + (depthOf(t, q.z) - 6) * 0.04 - d * 0.02;
          if (sc > bs && m > 0.1) { bs = sc; best = q; }
        }
        if (best && Math.hypot(best.x - p.x, best.z - p.z) < 16) X.kick(p, 'throw', { tx: best.x, tz: best.z, power: 0.5, tgt: best.id });
        else { const q = P[t * 7 + (X.rng.next() < 0.5 ? 4 : 5)]; X.kick(p, 'gk', { tx: q.x, tz: q.z + sg * 4, power: 0.8, tgt: -1 }); }
      }
    }
    return;
  }
  ai.rel = 0;
  if (p.act) return;
  // ball distance and an incoming shot
  const path = X.predictBall();
  let cross = null;
  if (Math.abs(B.vz) > 3 && B.vz * sg < 0) {
    for (let i = 0; i < path.length; i++) { const q = path[i]; if ((q.z - gz) * sg <= 0.0) { const prev = i ? path[i - 1] : { t: 0, x: B.x, y: B.y, z: B.z }; const u = (prev.z - gz) * sg / (((prev.z - gz) * sg) - ((q.z - gz) * sg) || 1); cross = { t: prev.t + (q.t - prev.t) * u, x: prev.x + (q.x - prev.x) * u, y: prev.y + (q.y - prev.y) * u }; break; } }
  }
  const speed = Math.hypot(B.vx, B.vz);
  if (cross && Math.abs(cross.x) < GOAL_HW + 0.7 && cross.y < 2.5 && speed > 6 && B.owner < 0) {
    if (ai.seen !== s.shotAt && ai.seen !== s.lastTouch + 0.5) { ai.seen = s.shotAt; ai.seenT = s.t; ai.err = normal(X.rng) * (0.25 + (1 - p.st.gk) * 2.2); ai.errY = normal(X.rng) * (1 - p.st.gk) * 0.5; }
    const xp = cross.x + ai.err, yp = clamp(cross.y + ai.errY, 0.1, 2.3);
    const remain = cross.t + (s.t - (ai.seenT ?? s.t)) * 0 ;
    const waited = s.t - (ai.seenT ?? s.t);
    const dxm = xp - p.x;
    const kreact = 0.04 + (1 - p.st.gk) * 0.12;
    if (waited >= kreact && X.canAct(p)) {
      if (Math.abs(dxm) < 0.55 && yp < 1.7) { /* a stand save: step across */ setMove(p, clamp(xp, -GOAL_HW, GOAL_HW), p.z, 'sprint', false); }
      else {
        // dive so that the hands arrive about when the ball does (the dive takes ~0.3 s)
        if (remain < 0.95) {
          const h = yp > 1.45 ? 2 : yp < 0.55 ? 0 : 1;
          if (Math.abs(dxm) < 0.9 && yp > 1.8) X.dive(p, 0, 0, 2); else X.dive(p, Math.sign(dxm || 1), -sg * 0.0, h, (Math.abs(dxm) - 0.2) / 2.2);
          return;
        } else setMove(p, clamp(xp, -GOAL_HW, GOAL_HW), p.z, 'sprint', false);
      }
    }
    return;
  }
  // loose ball in or near the box with nobody closer: come out and gather it
  const dBall = Math.hypot(B.x - p.x, B.z - p.z);
  const inArea = insideBox(t, B.x, B.z);
  const tm = X.tm[t];
  if (B.owner < 0 && B.held < 0 && (inArea || depthOf(t, B.z) < 9) && tm.chaser === -1 + 0 || false) { /* handled below */ }
  if (B.owner < 0 && B.held < 0 && depthOf(t, B.z) < 9 && Math.abs(B.x) < BOX_HW + 1 && dBall < 9) {
    // am I first to it?
    let first = true;
    const ttMe = dBall / (p.st.vmax * 0.9);
    for (const q of P) if (q.id !== p.id) { const tq = Math.hypot(q.x - B.x, q.z - B.z) / (q.st.vmax * 0.9) + (q.team === t ? 0.25 : 0); if (tq < ttMe - 0.1) { first = false; break; } }
    if (first && speed < 11) { setMove(p, B.x + B.vx * 0.3, B.z + B.vz * 0.3, 'sprint', false); return; }
  }
  // positioning: on the line between the ball and the goal centre, closer when the ball is near and on a breakaway
  const bx = B.x, bz = B.z;
  const dg = Math.hypot(bx, bz - gz);
  const off = clamp(0.9 + dg * 0.07, 0.9, 2.6) + (B.owner >= 0 && P[B.owner].team !== t && dg < 9 ? 0.8 : 0);
  const k = clamp(2.2 / Math.max(dg, 2.2), 0.15, 0.6);
  const tx = clamp(bx * (0.2 + 0.4 * k) * 1.0, -GOAL_HW + 0.4, GOAL_HW - 0.4);
  setMove(p, tx, gz + sg * off, 'run', true);
  p.look = -1;
}

// ---- restarts -----------------------------------------------------------------------------------------------------------------------------------
export function aiSetPiece(X, tk, sp) {
  const s = X.s, B = s.ball, t = sp.team, P = X.P;
  if (tk.act) return;
  const kind = sp.kind;
  if (kind !== 'throw') {
    const d = Math.hypot(B.x - tk.x, B.z - tk.z);
    if (d > 0.85) { setMove(tk, B.x, B.z, 'run'); return; }
    tk.cmd = { dx: 0, dz: 0, v: 0 };
  } else if (Math.hypot(sp.x - tk.x, sp.z - tk.z) > 1.0) { setMove(tk, sp.x, sp.z, 'sprint'); return; }
  else tk.cmd = { dx: 0, dz: 0, v: 0 };
  const dd = dirOf(t);
  const opts = (() => {
    const old = X.s.sp; void old;
    return X.evalOptions(tk);
  })();
  if (kind === 'kickoff') { const cm = P[t * 7 + 3]; X.kick(tk, 'pass', { tx: cm.x, tz: cm.z, tgt: cm.id, power: 0.4 }); return; }
  if (kind === 'goalkick') {
    const lvl = tk.st.pass;
    const q = P[t * 7 + (X.rng.next() < 0.5 ? 1 : 2)];
    if (X.rng.next() < 0.45 + lvl * 0.2) X.kick(tk, 'pass', { tx: q.x, tz: q.z, tgt: q.id, power: 0.5 });
    else { const w = P[t * 7 + (X.rng.next() < 0.5 ? 4 : 5)]; X.kick(tk, 'gk', { tx: w.x, tz: w.z, power: 0.8 }); }
    return;
  }
  if (kind === 'throw') {
    let best = null, bs = -9;
    for (const q of P) { if (q.team !== t || q.id === tk.id || q.role === 'GK') continue; const d = Math.hypot(q.x - tk.x, q.z - tk.z); if (d < 3 || d > 16) continue; const sc = freeSpace(X, q.x, q.z, t, 5) + laneMargin(X, tk, q.x, q.z, 10) * 1.5 - d * 0.05 + (depthOf(t, q.z) - depthOf(t, tk.z)) * 0.03; if (sc > bs) { bs = sc; best = q; } }
    if (best) X.kick(tk, 'throw', { tx: best.x, tz: best.z, tgt: best.id, power: 0.5 }); else X.kick(tk, 'throw', { tx: tk.x - Math.sign(tk.x) * 6, tz: tk.z + dd * 4, power: 0.5 });
    return;
  }
  if (kind === 'corner') {
    // whipped in towards the near post and penalty spot area where the attackers wait
    const tg = P[t * 7 + 6];
    X.kick(tk, 'cross', { tx: tg.x * 0.6 + (X.rng.next() - 0.5) * 2, tz: sp.z > 0 ? HL - 4.0 : -HL + 4.0, power: 0.7, tgt: -1, curve: sp.x > 0 ? -0.5 : 0.5 });
    return;
  }
  if (kind === 'penalty') {
    const gk = P[(1 - t) * 7];
    const side = X.rng.next() < 0.5 ? -1 : 1;
    X.kick(tk, 'shot', { tx: side * (GOAL_HW - 0.55), tz: dd * HL, ty: 0.5 + X.rng.next() * 0.5, power: 0.8 });
    void gk; return;
  }
  // free kick: shoot when it is in range, else the best pass
  const dg = Math.hypot(B.x, dd * HL - B.z);
  if (dg < 12 && tk.st.shot > 0.4) { X.kick(tk, 'shot', { tx: (X.rng.next() < 0.5 ? -1 : 1) * 1.6, tz: dd * HL, ty: 0.9, power: 0.8, curve: (B.x > 0 ? -1 : 1) * 0.5 }); return; }
  const o = opts.find((q) => q.kind === 'pass' || q.kind === 'lob' || q.kind === 'through');
  if (o) X.kick(tk, o.kind === 'through' ? 'pass' : o.kind, { tx: o.tx, tz: o.tz, tgt: o.tgt, power: 0.55 });
  else X.kick(tk, 'pass', { tx: B.x, tz: B.z + dd * 8, power: 0.5 });
}
