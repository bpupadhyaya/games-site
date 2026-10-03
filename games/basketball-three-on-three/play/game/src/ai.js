// Computer players: offence (handler, spacing, screens, cuts), defence (man defence, help, closeouts, steals, contests, boxing out)
// and rebounds. One planner serves the opponents, the user's AI teammates, Watch & Learn and the Think hint. Pure: it reads the sim
// through the helper object X and returns plans; the sim executes them with the same commands the human buttons use.
import { HOOP, ARC_R, ARC_X, Z_HALF, SPOTS, ROLES, BOUND, G } from './consts.js';
import { clamp, hyp, normal, angDiff } from './util.js';
import { visHalfWidth } from './camera.js';

const manOf = (X, p) => { const m = X.P[(1 - p.team) * 3 + p.role]; if (m && !m.out) return m; return X.P.find((q) => q.team !== p.team && !q.out) || null; };
const nearestDef = (X, x, z, team) => { let b = 9; for (const o of X.P) if (o.team !== team && !o.out) b = Math.min(b, hyp(o.x - x, o.z - z)); return b; };
const dist = (a, b) => hyp(a.x - b.x, a.z - b.z);
const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-6;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
  return hyp(px - (ax + dx * t), pz - (az + dz * t));
};
const m1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
const pct = (v) => `${Math.round(v * 100)}%`;
const ptsAt = (X, x, z) => (X.isTwo(x, z) ? 2 : 1);
const roleName = (p) => ROLES[p.role].name.toLowerCase();

function outsideArcPoint(p) {
  // nearest point beyond the arc, towards where the player already is
  const d = Math.hypot(p.x, p.z) || 1;
  const k = (ARC_R + 0.5) / d;
  let x = p.x * k, z = p.z * k;
  if (Math.abs(p.x) > ARC_X) x = p.x;
  const zz = clamp(z, 2, Z_HALF - 0.5), xl = visHalfWidth(zz) - 0.3;
  return { x: clamp(x, -xl, xl), z: zz };
}

// ---- evaluation of the offensive options of the ball handler ---------------------------------------------------------------------
export function evaluate(X, p, explain = false) {
  const { s, P } = X;
  const team = p.team;
  const mates = P.filter((q) => q.team === team && q.id !== p.id && !q.out);
  const opps = P.filter((q) => q.team !== team && !q.out);
  const opts = [];
  const cl = s.cleared || s.phase !== 'live';
  const c0 = X.contestOf(p.x, p.z, team).c;
  const d0 = X.hoopDist(p.x, p.z);
  const pts0 = ptsAt(X, p.x, p.z);
  if (cl && d0 < 8.6) {
    const pm = X.makeProb(p, p.x, p.z, c0, 0.8);
    opts.push({ k: 'shoot', v: pts0 * pm, c: c0, d: d0, pts: pts0, pm, nd: nearestDef(X, p.x, p.z, team) });
  }
  for (const q of mates) {
    const cq = X.contestOf(q.x, q.z, team).c;
    const dq = X.hoopDist(q.x, q.z);
    let risk = 0;
    for (const o of opps) { const sd = segDist(o.x, o.z, p.x, p.z, q.x, q.z); risk = Math.max(risk, clamp(1 - sd / 1.25, 0, 1) * (o.act && o.act.kind === 'steal' ? 1.1 : 1)); }
    const pq = X.makeProb(q, q.x, q.z, cq, 0.8);
    const pq2 = ptsAt(X, q.x, q.z) * pq;
    const dpass = dist(p, q);
    const clearOk = !cl ? (X.isTwo(q.x, q.z) ? 1 : 0.2) : 1;
    const v = pq2 * (1 - 0.8 * risk) * 0.93 * clearOk + (q.callT > 0 ? 0.1 : 0) - (dpass > 9 ? 0.1 : 0);
    opts.push({ k: 'pass', to: q.id, v: v - 0.02, c: cq, d: dq, risk, pm: pq, pts: ptsAt(X, q.x, q.z), q, nd: nearestDef(X, q.x, q.z, team) });
  }
  // drive: the lane between the handler and the rim
  if (cl && d0 > 1.7 && d0 < 7.5) {
    let lane = 0;
    for (const o of opps) lane = Math.max(lane, clamp(1 - segDist(o.x, o.z, p.x, p.z, 0, 0.9) / 1.0, 0, 1));
    const pm = X.makeProb(p, 0, 1.0, clamp(lane * 0.8, 0, 1), 0.85);
    const speedAdj = 1 - clamp((d0 - 3) / 8, 0, 0.35);
    opts.push({ k: 'drive', v: pm * speedAdj * 1.9 - 0.04 + c0 * 0.08, lane, pm });
  }
  return { opts, c0, d0, pts0, cl };
}

function handlerPlan(X, p, lv, explain) {
  const { s, R } = X;
  const ev = evaluate(X, p, explain);
  if (!ev.cl) {
    const t = outsideArcPoint(p);
    return { mv: { x: t.x, z: t.z, spd: 1 }, face: null, why: 'clear', info: explain ? { kind: 'move', reason: 'The ball must be taken behind the arc after a change of possession before anyone can shoot.', summary: 'Take the ball behind the arc', target: t } : null };
  }
  const urgent = s.shotClock < 3.2;
  const forced = s.shotClock < 1.6;
  const opts = ev.opts.filter((o) => o.k !== 'shoot' || true);
  // shooting needs a minimum worth; it drops with the shot clock
  const need = clamp(0.62 - (12 - s.shotClock) * 0.05, 0.0, 0.62);
  opts.sort((a, b) => b.v - a.v);
  let pick = opts[0] || { k: 'probe', v: 0 };
  if (R.next() > lv.iq && opts.length > 1) pick = opts[1 + Math.floor(R.next() * Math.min(opts.length - 1, 2))];
  const shootOpt = opts.find((o) => o.k === 'shoot');
  if (urgent && shootOpt && (forced || pick.k !== 'pass' || shootOpt.v >= pick.v * 0.8)) pick = shootOpt;
  const dx = HOOP.x - p.x, dz = HOOP.z - p.z;
  if (globalThis.__aiCount) globalThis.__aiCount[pick.k] = (globalThis.__aiCount[pick.k] || 0) + 1;
  // not worth acting yet: probe by dribbling to a better spot
  const wait = s.t - (p.tmp.possStart ?? s.t) < 0.55 + 0.4 * (1 - lv.react);
  if (pick.k === 'shoot' && pick.v < need && !urgent) pick = { k: 'probe', v: 0 };
  if (pick.k !== 'shoot' && pick.k !== 'probe' && pick.v < 0.12 && !urgent) pick = { k: 'probe', v: 0 };
  if (wait && !urgent) pick = { k: 'probe', v: 0, wait: true };
  if (pick.k === 'shoot') {
    const err = normal(R) * lv.tErr;
    const info = explain ? { kind: 'shoot', reason: `${pick.nd > 2 ? 'You are open' : pick.nd > 1.3 ? 'A defender is close but not on you' : 'Contested, but time is running out'}: the nearest defender is ${m1(pick.nd)} m away and the shot is from ${m1(pick.d)} m ${pick.pts === 2 ? '(beyond the arc, worth 2)' : '(inside the arc, worth 1)'}; it goes in about ${pct(pick.pm)} of the time.`, summary: pick.pts === 2 ? 'Shoot the two' : 'Shoot the one', target: { x: 0, z: 0 } } : null;
    return { mv: { x: p.x, z: p.z, spd: 0.2 }, do: { k: 'shoot', err }, info, face: { x: HOOP.x, z: HOOP.z } };
  }
  if (pick.k === 'pass') {
    const q = pick.q;
    const info = explain ? { kind: 'pass', reason: `The ${roleName(q)} is ${pick.nd > 2 ? 'open' : 'the better look'}: the nearest defender is ${m1(pick.nd)} m from him and the pass lane ${pick.risk < 0.25 ? 'is clear' : 'is tight but possible'}; his shot is worth about ${m1(pick.pts * pick.pm)} points against ${m1(ev.opts.find((o) => o.k === 'shoot')?.v ?? 0)} for yours.`, summary: `Pass to the ${roleName(q)}`, target: { x: q.x, z: q.z }, to: q.id } : null;
    return { mv: { x: p.x, z: p.z, spd: 0.3 }, do: { k: 'pass', to: pick.to }, info, face: { x: q.x, z: q.z } };
  }
  if (pick.k === 'drive') {
    const info = explain ? { kind: 'drive', reason: `The lane to the rim is ${pick.lane < 0.3 ? 'open' : 'only lightly guarded'}; a layup from the lane is worth about ${m1(pick.pm)} points.`, summary: 'Drive to the rim', target: { x: 0, z: 1 } } : null;
    const near = X.P.filter((o) => o.team !== p.team && hyp(o.x - p.x, o.z - p.z) < 1.8).length;
    return { mv: { x: 0, z: 1.0, spd: 1 }, drive: true, do: near && p.cool.cross <= 0 && R.next() < 0.5 * lv.iq ? { k: 'cross' } : null, info, face: null };
  }
  // probe: dribble towards the open side to find a better shot or a pass
  let best = null, bv = -9;
  for (const key of ['wingL', 'wingR', 'top', 'elbowL', 'elbowR']) {
    const sp = SPOTS[key];
    const c = X.contestOf(sp.x, sp.z, p.team).c;
    const v = ptsAt(X, sp.x, sp.z) * X.makeProb(p, sp.x, sp.z, c) - 0.02 * dist(p, sp) - (hyp(sp.x - p.x, sp.z - p.z) < 0.8 ? 0.1 : 0);
    if (v > bv) { bv = v; best = sp; }
  }
  const info = explain ? { kind: 'move', reason: 'Nobody is open yet. Dribble towards the open side of the arc and make the defence move.', summary: 'Dribble to find an opening', target: best } : null;
  return { mv: { x: best.x, z: best.z, spd: 0.75 }, info, face: null };
}

// ---- the spot an off-ball offensive player runs to ----------------------------------------------------------------------------------
function offBallPlan(X, p, lv, explain) {
  const { s, P, R } = X;
  const team = p.team;
  const hold = P[s_holder(X)];
  const mates = P.filter((q) => q.team === team && q.id !== p.id && !q.out);
  const T = p.tmp;
  // a pass is coming to me: go and catch it
  if (p.expect && s.t < p.expect.until) return { mv: { x: p.expect.x, z: p.expect.z, spd: 1 }, face: { x: hold ? hold.x : 0, z: hold ? hold.z : 0 }, info: null };
  const ballInAir = X.B.mode === 'shot';
  if (ballInAir) {
    // offensive rebound: the big crashes the boards, the others hold the arc
    if (p.role === 2 || p.role === 1 && lv.reb > 0.9) return { mv: { x: clamp(p.x * 0.5, -2, 2), z: 1.1, spd: 1 }, why: 'crash', info: null };
    return { mv: { x: p.x, z: p.z, spd: 0.3 }, info: null };
  }
  if (X.B.mode === 'loose') return { mv: { x: X.B.x, z: X.B.z, spd: 1 }, why: 'loose', info: null };
  // the big sets screens for the handler, then rolls
  if (p.role === 2 && hold && hold.team === team) {
    if (!T.mode || s.t > T.until) { T.mode = T.mode === 'screen' ? 'roll' : T.mode === 'roll' ? 'post' : (R.next() < 0.75 * lv.iq ? 'screen' : 'post'); T.until = s.t + (T.mode === 'screen' ? 2.6 : 1.8); T.t0 = s.t; }
    if (T.mode === 'screen') {
      const hd = manOf(X, hold) || hold;
      const tx = hd.x + (HOOP.x - hd.x) * 0.0 + Math.sign(hold.x - hd.x || 1) * 0.0, tz = hd.z - 0.25 + (hd.z > 3 ? -0.55 : 0.4);
      // stand where the handler's defender must run through: between the defender and the handler's path to the hoop
      const ax = hd.x + (hold.x - hd.x) * 0.12, az = hd.z + (HOOP.z - hd.z) * 0.35;
      const near = hyp(p.x - ax, p.z - az) < 0.65;
      return { mv: { x: ax, z: az, spd: 0.9 }, screen: near, why: 'screen', info: explain ? { kind: 'screen', reason: `Set a screen on the ${roleName(hd)} guarding the ball handler: stand still next to him so he has to go around you, then roll to the rim.`, summary: 'Set a screen', target: { x: ax, z: az } } : null, face: { x: hd.x, z: hd.z } };
    }
    if (T.mode === 'roll') return { mv: { x: clamp(hold.x * 0.2, -1.2, 1.2), z: 1.35, spd: 1 }, why: 'roll', info: explain ? { kind: 'move', reason: 'After the screen, roll to the rim: the defender who switched or trailed leaves you open under the basket.', summary: 'Roll to the rim', target: { x: 0, z: 1.3 } } : null };
  }
  // spacing: choose a spot not near a teammate and away from the ball handler's line to the rim
  if (!T.spot || s.t > T.spotUntil) {
    const keys = p.role === 2 ? ['blockL', 'blockR', 'elbowL', 'elbowR', 'high'] : p.role === 1 ? ['wingL', 'wingR', 'deepL', 'deepR', 'top'] : ['top', 'wingL', 'wingR', 'deepL', 'deepR'];
    let best = null, bv = -9;
    for (const key of keys) {
      const sp = SPOTS[key];
      let v = 0;
      const c = X.contestOf(sp.x, sp.z, team).c;
      v += ptsAt(X, sp.x, sp.z) * X.makeProb(p, sp.x, sp.z, c) * 1.2;
      for (const q of mates) { const dd = hyp(sp.x - (q.tmp.spot ? q.tmp.spot.x : q.x), sp.z - (q.tmp.spot ? q.tmp.spot.z : q.z)); if (dd < 3.2) v -= (3.2 - dd) * 0.22; }
      if (hold && hold.team === team) { v -= clamp(1 - segDist(sp.x, sp.z, hold.x, hold.z, 0, 0) / 1.2, 0, 1) * 0.5; v -= dist(sp, hold) < 2.2 ? 0.3 : 0; }
      if (T.spot && T.spot === sp) v -= 0.05;
      v += R.next() * 0.15;
      if (v > bv) { bv = v; best = sp; }
    }
    T.spot = best; T.spotUntil = s.t + 1.4 + R.next() * 1.4;
  }
  const sp = T.spot;
  const c = X.contestOf(p.x, p.z, team).c;
  const info = explain ? { kind: 'move', reason: `Spread the floor: go to ${sp.z > 7.5 ? 'the top of the arc' : sp.z > 6 ? 'the arc between the top and the wing' : sp.z > 4.5 ? 'the wing beyond the arc' : 'a spot near the rim'} so the ball handler has a pass and the defence has to stay with you.`, summary: 'Spot up', target: sp } : null;
  return { mv: { x: sp.x, z: sp.z, spd: 0.8 }, face: hold ? { x: hold.x, z: hold.z } : null, info };
}
function s_holder(X) { return X.B.mode === 'held' ? X.B.holder : (X.B.lastId ?? 0); }

// ---- defence ---------------------------------------------------------------------------------------------------------------------------
function defPlan(X, p, lv, explain) {
  const { s, P, B, R } = X;
  const team = p.team;
  const man = manOf(X, p);
  if (!man) return { mv: { x: 0, z: 2.0, spd: 0.5 }, info: null };
  const holder = B.mode === 'held' ? P[B.holder] : null;
  const onBall = holder && holder.id === man.id;
  const ballPt = holder ? { x: holder.x, z: holder.z } : { x: B.x, z: B.z };
  let tx, tz, spd = 1, act = null, info = null;
  const toHoop = (a) => { const d = hyp(HOOP.x - a.x, HOOP.z - a.z) || 1; return { x: (HOOP.x - a.x) / d, z: (HOOP.z - a.z) / d }; };
  if (onBall) {
    const u = toHoop(man);
    const gap = (man.act && man.act.kind === 'shot' ? 0.75 : 1.0) + (1 - lv.ctest) * 0.9;
    tx = man.x + u.x * gap; tz = man.z + u.z * gap;
    // do not let the handler drive: cut off the lane
    if (hyp(man.x, man.z) < 5.2) { tx = man.x + u.x * (0.85 + (1 - lv.ctest)) ; tz = man.z + u.z * (0.85 + (1 - lv.ctest)); }
    info = explain ? { kind: 'defend', reason: `Stay between your man (the ${roleName(man)}) and the hoop, about ${m1(gap)} m from him, and watch the ball.`, summary: 'Stay in front of the handler', target: { x: tx, z: tz } } : null;
    // steal when the ball is exposed
    const d = dist(p, man);
    if (d < 1.15 && !p.act && p.cool.steal <= 0 && !(man.act)) {
      const lowness = clamp((0.95 - B.y) / 0.6, 0, 1);
      if (lowness > 0.45 && R.next() < 0.5 * lv.steal * lowness * (1 - lv.react * 0.5)) act = { k: 'steal' };
    }
    // contest a shot: jump as the shooter rises
    if (man.act && (man.act.kind === 'shot' || man.act.kind === 'layup') && man.act.tr === null && d < 2.3 && !p.act && p.cool.jump <= 0) {
      if (s.t >= man.act.t0 + 0.10 + (1 - lv.ctest) * 0.12 && R.next() < 0.1 + 0.9 * lv.ctest) act = { k: 'jump', why: 'contest' };
    }
  } else {
    // off the ball: sag between the man and the hoop; the further from the ball the deeper
    const dBall = dist(man, ballPt);
    const u = toHoop(man);
    const depth = clamp(0.8 + (dBall > 4 ? (dBall - 4) * 0.22 : 0) * lv.help, 0.8, 2.0);
    // help: a big stays near the rim when the handler is close to it
    let hx = man.x + u.x * depth, hz = man.z + u.z * depth;
    if (holder && holder.team !== team && hyp(holder.x, holder.z) < 4.6 && p.role === 2) { hx = clamp(holder.x * 0.5, -1.6, 1.6); hz = 1.2 + 0.5 * (1 - lv.help); }
    // ball side: shade to the ball side to deny the pass
    if (holder) { hx += clamp((holder.x - hx) * 0.1, -0.35, 0.35); }
    tx = hx; tz = hz;
    info = explain ? { kind: 'defend', reason: `Your man is ${m1(dBall)} m from the ball. Stay between him and the hoop, a little towards the ball, so you can help or jump the pass.`, summary: 'Stay between your man and the hoop', target: { x: tx, z: tz } } : null;
    if (man.act && (man.act.kind === 'shot' || man.act.kind === 'layup') && man.act.tr === null && dist(p, man) < 2.3 && !p.act && p.cool.jump <= 0 && s.t >= man.act.t0 + 0.12 && R.next() < lv.ctest * 0.8) act = { k: 'jump', why: 'contest' };
  }
  return { mv: { x: tx, z: tz, spd }, do: act, face: onBall ? { x: man.x, z: man.z } : (holder ? { x: holder.x, z: holder.z } : { x: man.x, z: man.z }), info };
}

function reboundPlan(X, p, lv, explain) {
  const { s, P, B, R } = X;
  const team = p.team;
  const shootTeam = B.shot ? B.shot.team : B.lastTeam;
  const man = manOf(X, p) || p;
  // predicted landing: where the ball will be at rim height on the way down; with a miss it comes off in the direction of travel
  let lx = B.x + B.vx * 0.35, lz = B.z + B.vz * 0.35;
  if (B.mode === 'shot' && B.rim === 0 && !B.board) { lx = HOOP.x + (B.x - HOOP.x) * 0.2 + B.vx * 0.15; lz = HOOP.z + B.vz * 0.15 + 0.4; }
  const ownTeam = team === shootTeam;
  const mine = ROLES[p.role].reb * lv.reb;
  // who goes for the ball: the two best placed; the rest hold their man / the arc
  const cands = P.filter((q) => q.team === team).map((q) => ({ q, d: hyp(q.x - lx, q.z - lz) / (ROLES[q.role].reb * 0.35 + 0.65) })).sort((a, b) => a.d - b.d);
  const rank = cands.findIndex((c) => c.q.id === p.id);
  let act = null;
  const ballDown = B.vy < 0.5;
  if (rank === 0 || (rank === 1 && (B.mode === 'loose' || mine > 0.9))) {
    const dxy = hyp(p.x - B.x, p.z - B.z);
    if (B.mode !== 'loose' && (B.rim > 0 || B.board) && B.y < 4.0 && ballDown && dxy < 1.6 && p.cool.jump <= 0 && !p.act && R.next() < 0.2 + 0.5 * mine) act = { k: 'jump', why: 'rebound' };
    if (B.mode === 'loose' && B.y > 1.2 && B.y < 3.6 && dxy < 1.5 && p.cool.jump <= 0 && !p.act && R.next() < 0.15 * mine) act = { k: 'jump', why: 'rebound' };
    return { mv: { x: lx, z: lz, spd: 1 }, do: act, face: { x: B.x, z: B.z }, info: explain ? { kind: 'rebound', reason: 'The shot is up. Get to the spot under the ball and jump for it as it comes down.', summary: 'Go for the rebound', target: { x: lx, z: lz } } : null };
  }
  if (team !== shootTeam) {
    // box out: stand between the man and the hoop
    const d = hyp(HOOP.x - man.x, HOOP.z - man.z) || 1;
    return { mv: { x: man.x + (HOOP.x - man.x) / d * 0.7, z: man.z + (HOOP.z - man.z) / d * 0.7, spd: 1 }, face: { x: man.x, z: man.z }, info: explain ? { kind: 'rebound', reason: 'Box out: stand between your man and the hoop so he cannot reach the rebound.', summary: 'Box out your man', target: { x: man.x, z: man.z } } : null };
  }
  return { mv: { x: p.x, z: p.z, spd: 0.4 }, face: { x: B.x, z: B.z }, info: null };
}

export function plan(X, p, explain = false) {
  const { s, B } = X;
  const lv = X.lvOf(p);
  const holder = B.mode === 'held' ? X.P[B.holder] : null;
  if (s.phase === 'ready') {
    // settle into the opening spots
    const off = p.team === s.poss;
    return { mv: { x: p.x, z: p.z, spd: 0 }, info: null };
  }
  if (B.mode === 'held') {
    if (holder.id === p.id) { if (!p.tmp.possStart || p.tmp.lastHold !== s.t - 0) p.tmp.possStart = p.tmp.possStart ?? s.t; return handlerPlan(X, p, lv, explain); }
    if (holder.team === p.team) return offBallPlan(X, p, lv, explain);
    return defPlan(X, p, lv, explain);
  }
  if (B.mode === 'pass') {
    if (B.lastTeam === p.team) return offBallPlan(X, p, lv, explain);
    // defenders: jump the lane (deflect)
    return defPlan(X, p, lv, explain);
  }
  // shot in the air or a loose ball
  return reboundPlan(X, p, lv, explain);
}

export function think(X, p, dt, applyAction, cmdScreen, holdHook) {
  const { s, B } = X;
  p.in = { mx: 0, mz: 0 };
  p.faceTo = null;
  if (s.phase === 'dead' || s.phase === 'over' || s.phase === 'ft') { p.plan = null; return; }
  const lv = X.lvOf(p);
  const holder = B.mode === 'held' ? X.P[B.holder] : null;
  if (!holder || holder.id !== p.id) p.tmp.possStart = null;
  else if (p.tmp.possStart === null || p.tmp.possStart === undefined) p.tmp.possStart = s.t;
  if (s.t >= p.nextThink || !p.plan) {
    p.plan = plan(X, p, s.cfg.watch);
    p.nextThink = s.t + lv.react * (0.8 + 0.4 * X.R.next());
    if (p.plan.do) { p.plan.holdAsked = false; }
  }
  const pl = p.plan;
  // the wait for Watch & Learn: the decision is shown, then released
  if (pl.do && !pl.fired) {
    if (s.cfg.watch && pl.info && !pl.holdAsked && p.team === s.poss) {
      pl.holdAsked = true;
      if (holdHook(p, pl.info)) return;
    }
    if (!(s.hold)) { pl.fired = true; applyAction(p, pl.do); }
  }
  // movement
  if (pl.mv) {
    const dx = pl.mv.x - p.x, dz = pl.mv.z - p.z, d = Math.hypot(dx, dz);
    const frac = clamp(d / 0.7, 0, 1) * pl.mv.spd;
    if (d > 0.04 && frac > 0.01) p.in = { mx: (dx / d) * frac, mz: (dz / d) * frac };
  }
  // personal space: keep a body width from the other players (defenders stay close to their man, so only inside 0.8 m)
  {
    let ax = 0, az = 0;
    for (const q of X.P) { if (q === p || q.out) continue; const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz); if (d < 0.85 && d > 1e-3) { const w = (0.85 - d) / 0.85; ax += (dx / d) * w; az += (dz / d) * w; } }
    if (ax || az) { let mx = p.in.mx + ax * 0.9, mz = p.in.mz + az * 0.9; const m = Math.hypot(mx, mz); if (m > 1) { mx /= m; mz /= m; } p.in = { mx, mz }; }
  }
  if (pl.face) p.faceTo = pl.face;
  cmdScreen(p, !!pl.screen);
  if (pl.drive && p.act === null && holder && holder.id === p.id) { /* the drive ends with a layup when the hoop is close */
    if (X.hoopDist(p.x, p.z) < 1.9 && X.s.cleared) applyAction(p, { k: 'shoot', err: normal(X.R) * lv.tErr * 1.3 });
  }
}

export function suggest(X, p) {
  const saved = X.R;
  const lvBackup = X.lvOf;
  const pl = plan({ ...X, R: { next: () => 0.5 } }, p, true);
  const info = pl.info || { kind: 'move', reason: 'Stay in position and keep your eyes on the ball.', summary: 'Hold position', target: { x: p.x, z: p.z } };
  return { ...info, plan: pl };
}
