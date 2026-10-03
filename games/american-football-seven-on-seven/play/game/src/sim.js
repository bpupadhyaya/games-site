// The play engine: 14 players (7 a side, every player two-way), one play at a time, in real time at a fixed 1/60 s step.
// Pure and deterministic: all randomness comes from the rng handed in, all time from dt. Nothing here knows about drawing; the 3D presenter and the
// 2D fallback only READ the play object (actors, ball, events) and never write back. The user's own player is moved by `P.intent` (set by game.js).
import { FIELD, T, BASE, BALL, G_YD, LEVELS, TEAM_LEVEL, OFF_SLOT_OF_P, DEF_SLOT_OF_P, ROLE_OF_SLOT } from './consts.js';
import { offPlay, defCall, offFormation, defFormation } from './plays.js';
import { clamp, hyp, dist, norm, wrapAngle, attackDir, goalZ, ownGoalZ, ylOf, gauss, segDist } from './geo.js';

// ---------------------------------------------------------------------------------------------------------------------------------------
// teams and actors
// ---------------------------------------------------------------------------------------------------------------------------------------
export function makeTeams(rng, computerLevel) {
  const mk = (levelIdx) => {
    const L = LEVELS[levelIdx];
    return {
      level: levelIdx,
      players: BASE.map((b) => {
        const j = () => 0.97 + rng.next() * 0.06;
        const r = (v) => clamp(v * L.rate * j(), 0.05, 0.98);
        return { spd: b.spd * L.spd * j(), acc: b.acc, str: r(b.str), hands: r(b.hands), tackle: r(b.tackle), cover: r(b.cover), elude: r(b.elude), qb: clamp(b.qb * (L.acc / 0.74) * j(), 0.05, 0.97) };
      }),
    };
  };
  return [mk(TEAM_LEVEL), mk(computerLevel)];
}

export function newActors(teams, shapeRng) {
  const out = [];
  for (let team = 0; team < 2; team++) for (let p = 0; p < 7; p++) {
    const x = -9 + p * 3, z = team === 0 ? 20 : 32;
    out.push({
      id: team * 7 + p, team, p, x, z, vx: 0, vz: 0, face: team === 0 ? 0 : Math.PI, px: x, pz: z, pface: team === 0 ? 0 : Math.PI,
      unit: 'off', slot: OFF_SLOT_OF_P[p], role: 'QB', pose: 'stand',
    });
  }
  void teams; void shapeRng;
  return out;
}

const SLOT_P = {}; OFF_SLOT_OF_P.forEach((s, p) => { SLOT_P[s] = p; }); DEF_SLOT_OF_P.forEach((s, p) => { SLOT_P[s] = p; });

// ---------------------------------------------------------------------------------------------------------------------------------------
// creating a play
// ---------------------------------------------------------------------------------------------------------------------------------------
// spec: { rng, teams, actors, off (team index), los (yards from the offence's own goal line), toGo, offId, defId, human (actor id or -1), kind: 'scrimmage' }
export function newPlay(spec) {
  const { rng, teams, actors, off } = spec;
  const def = 1 - off;
  const dir = attackDir(off);
  const losZ = FIELD.EZ + (off === 0 ? spec.los : FIELD.LEN - spec.los);
  const play = offPlay(spec.offId), call = defCall(spec.defId);
  const P = {
    t: 0, tl: 0, phase: 'lineup', off, def, dir, losZ, los: spec.los, toGo: spec.toGo, down: spec.down || 1, play, call, rng, teams, actors,
    human: spec.human ?? -1, intent: { mx: 0, mz: 0, burst: false, juke: 0, spin: false, tackle: false, catchPress: false, swat: false, rush: false, throwTo: null, lob: 0 },
    events: [], eid: 0, ball: { st: 'held', holder: -1, x: 0, y: BALL.carryY, z: 0, px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0, fly: null }, carrierTeam: off, turnover: false,
    pairs: [], wraps: [], dead: false, deadReason: '', deadT: 0, result: null, qbHeld: false, openness: {}, tag: spec.tag || '', try: !!spec.try,
    handDone: false, fakeDone: false, thrown: false, knownRun: false, knownT: 0, passT: 0, kick: spec.kick || null,
    gain: { maxZ: 0 },
  };
  P.fieldPt = (u, v) => ({ x: dir * v, z: losZ + dir * u });
  P.U = (z) => (z - losZ) * dir;
  P.V = (x) => x * dir;
  const offF = offFormation(play), defF = defFormation(call);
  let maxD = 0;
  for (const a of actors) {
    const isOff = a.team === off;
    const slot = isOff ? OFF_SLOT_OF_P[a.p] : DEF_SLOT_OF_P[a.p];
    const r = teams[a.team].players[a.p];
    Object.assign(a, {
      unit: isOff ? 'off' : 'def', slot, role: ROLE_OF_SLOT[slot], spd: r.spd, acc: r.acc, str: r.str, hands: r.hands, tackle: r.tackle, cover: r.cover, elude: r.elude, qbr: r.qb,
      lvl: teams[a.team].level, react: LEVELS[teams[a.team].level].react * (0.85 + rng.next() * 0.3), dec: LEVELS[teams[a.team].level].dec,
      dvx: 0, dvz: 0, job: null, eng: null, wrap: null, down: false, stumble: 0, evade: 0, burst: 0, burstCd: 0, lunge: null, cool: {}, hist: [], q: null, route: null,
      carry: false, human: a.id === P.human, hasBall: false, catchAt: -9, handsBonus: 0, slow: 0, faceTo: null, pose: 'stand', touch: 0, spinT: 0, jukeT: 0, dive: 0, glued: 0,
      pursueT: 0, bite: 0, lastDir: [0, dir], lane: 0,
    });
    const f = isOff ? offF[slot] : defF[slot];
    const pt = P.fieldPt(f[0], f[1]);
    a.fx = pt.x; a.fz = pt.z;
    maxD = Math.max(maxD, hyp(a.x - a.fx, a.z - a.fz));
  }
  P.tl = clamp(maxD / 5.2, T.LINEUP, 5);
  // ball starts with the centre
  const C = actors[off * 7 + 5];
  P.ball.x = C.fx; P.ball.z = C.fz; P.ball.y = 0.55; P.ball.st = 'ground';
  P.ball.px = P.ball.x; P.ball.py = P.ball.y; P.ball.pz = P.ball.z;
  return P;
}

const emit = (P, type, o = {}) => { const e = { id: ++P.eid, type, t: P.t, ...o }; P.events.push(e); return e; };
const A = (P, id) => P.actors[id];
const offOf = (P, slot) => P.actors[P.off * 7 + SLOT_P[slot]];
const defOf = (P, slot) => P.actors[P.def * 7 + SLOT_P[slot]];
export const actorOf = (P, team, slot) => P.actors[team * 7 + SLOT_P[slot]];
const isRusher = (a) => a.job && (a.job.k === 'rush' || a.job.k === 'pursue');

// ---------------------------------------------------------------------------------------------------------------------------------------
// movement
// ---------------------------------------------------------------------------------------------------------------------------------------
function goTo(a, tx, tz, frac = 1, arrive = 0.25) {
  const dx = tx - a.x, dz = tz - a.z, d = hyp(dx, dz);
  if (d < 0.03) { a.dvx = 0; a.dvz = 0; return d; }
  const sp = Math.min(a.spd * frac * (a.slow > 0 ? 0.72 : 1) * (a.burst > 0 ? 1.14 : 1), d / arrive);
  a.dvx = (dx / d) * sp; a.dvz = (dz / d) * sp;
  return d;
}
function stand(a) { a.dvx = 0; a.dvz = 0; }

function integrate(P, a, dt) {
  a.px = a.x; a.pz = a.z; a.pface = a.face;
  let dvx = a.dvx, dvz = a.dvz;
  let acc = a.acc;
  if (a.stumble > 0) { a.stumble -= dt; dvx *= 0.35; dvz *= 0.35; }
  const ex = dvx - a.vx, ez = dvz - a.vz, el = hyp(ex, ez);
  // slowing down is quicker than speeding up
  const dot = a.vx * dvx + a.vz * dvz;
  const lim = acc * dt * (dot < 0 || hyp(dvx, dvz) < hyp(a.vx, a.vz) ? 1.5 : 1);
  if (el > lim) { a.vx += (ex / el) * lim; a.vz += (ez / el) * lim; } else { a.vx = dvx; a.vz = dvz; }
  a.x += a.vx * dt; a.z += a.vz * dt;
  if (a.shift && a.shift.left > 0) { const k = Math.min(dt, a.shift.left) / a.shift.t; a.x += a.shift.dx * k; a.z += a.shift.dz * k; a.shift.left -= dt; }
  a.x = clamp(a.x, -FIELD.HALF - 4, FIELD.HALF + 4);
  a.z = clamp(a.z, -2, FIELD.TOTAL + 2);
  // facing: toward the movement, or toward faceTo when set (defenders watching the quarterback), turn rate limited
  const sp = hyp(a.vx, a.vz);
  let want = a.face;
  if (a.faceTo) want = Math.atan2(a.faceTo.x - a.x, a.faceTo.z - a.z);
  else if (sp > 0.6) want = Math.atan2(a.vx, a.vz);
  const d = wrapAngle(want - a.face);
  const rate = 11 * dt;
  a.face = wrapAngle(a.face + clamp(d, -rate, rate));
  a.hist.push(a.x, a.z); if (a.hist.length > 90) a.hist.splice(0, 2);
}
// where the player was `sec` ago (tracking with a reaction delay)
function delayed(a, sec) {
  const n = a.hist.length / 2, k = Math.min(n - 1, Math.max(0, Math.round(sec * 60)));
  if (n < 1) return { x: a.x, z: a.z };
  const i = (n - 1 - k) * 2;
  return { x: a.hist[i], z: a.hist[i + 1] };
}
const carryPoint = (a) => {
  const fx = Math.sin(a.face), fz = Math.cos(a.face), rx = Math.cos(a.face), rz = -Math.sin(a.face);   // right-hand side (x is to the right on screen, z up)
  return { x: a.x + fx * 0.22 + rx * 0.2, y: BALL.carryY, z: a.z + fz * 0.22 + rz * 0.2 };
};
export { carryPoint };

// between plays: walk everybody to rest positions (no tackles, no jobs)
export function gatherStep(actors, targets, dt) {
  for (const a of actors) {
    const t = targets[a.id];
    a.px = a.x; a.pz = a.z; a.pface = a.face;
    if (a.hold > 0) { a.hold -= dt; a.dvx = a.dvz = 0; a.vx *= 0.9; a.vz *= 0.9; a.x += a.vx * dt; a.z += a.vz * dt; a.pose = 'gather'; continue; }
    a.down = false; a.wrap = null; a.eng = null; a.hasBall = false; a.attack = null; a.stumble = 0; a.burst = 0; a.slow = 0; a.evade = 0;
    if (!t) { a.dvx = a.dvz = 0; } else {
      a.spd = a.spd || 6;
      const dx = t.x - a.x, dz = t.z - a.z, d = hyp(dx, dz);
      const sp = Math.min(d > 0.2 ? 4.2 : 0, d / 0.4);
      a.dvx = d > 0.05 ? (dx / d) * sp : 0; a.dvz = d > 0.05 ? (dz / d) * sp : 0;
      a.faceTo = null;
    }
    a.acc = a.acc || 10;
    integrateFree(a, dt);
  }
}
function integrateFree(a, dt) {
  const ex = a.dvx - a.vx, ez = a.dvz - a.vz, el = hyp(ex, ez), lim = (a.acc || 10) * dt;
  if (el > lim) { a.vx += (ex / el) * lim; a.vz += (ez / el) * lim; } else { a.vx = a.dvx; a.vz = a.dvz; }
  a.x += a.vx * dt; a.z += a.vz * dt;
  const sp = hyp(a.vx, a.vz);
  if (sp > 0.5) { const want = Math.atan2(a.vx, a.vz); const d = wrapAngle(want - a.face); a.face = wrapAngle(a.face + clamp(d, -11 * dt, 11 * dt)); }
  a.pose = 'gather';
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// assigning the jobs at the snap
// ---------------------------------------------------------------------------------------------------------------------------------------
function assignOffense(P) {
  const pl = P.play;
  for (const a of P.actors) {
    if (a.unit !== 'off') continue;
    const slot = a.slot;
    const r = pl.routes && pl.routes[slot];
    if (slot === 'QB') { a.job = { k: 'qb' }; a.q = { mode: 'snapwait', t: 0, slid: 0 }; continue; }
    const blk = pl.blocks && pl.blocks[slot];
    if (pl.carrier === slot && pl.handoff) { const at = P.fieldPt(pl.handoff.at[0], pl.handoff.at[1]); a.job = { k: 'meet', at, t: 0 }; a.route = null; continue; }
    if (blk && blk !== 'qb') { a.job = { k: 'block', mode: blk, tgt: -1, t: 0, rel: false }; if (r && r.length) a.route = { pts: r.map(([u, v]) => P.fieldPt(u, v)), i: 0 }; continue; }
    if (r && r.length) { a.job = { k: 'route', t: 0 }; a.route = { pts: r.map(([u, v]) => P.fieldPt(u, v)), i: 0 }; continue; }
    a.job = { k: 'block', mode: 'pass', tgt: -1, t: 0 };
  }
}
function assignDefense(P) {
  const call = P.call;
  for (const a of P.actors) {
    if (a.unit !== 'def') continue;
    const t = call.tasks[a.slot];
    const job = { ...t, t: 0 };
    if (t.k === 'zone' || t.k === 'deep' || t.k === 'fill') { const pt = P.fieldPt(t.u, t.v); job.cx = pt.x; job.cz = pt.z; }
    a.job = job; a.fillRole = t.k === "fill";
  }
}


// ---------------------------------------------------------------------------------------------------------------------------------------
// kicks (punt, field goal, extra point): the outcome is decided by match.js, this plays it out on the field
// ---------------------------------------------------------------------------------------------------------------------------------------
const KICK_FORM = {
  punt: { QB: [-8, 0], RB: [-3.2, 0], C: [-0.5, 0], G: [-0.5, -1.7], TE: [-0.5, 1.7], WA: [-0.5, -8.5], WB: [-0.5, 8.5] },
  fg: { QB: [-7, 0.6], RB: [-3.0, -2.2], C: [-0.5, 0], G: [-0.5, -1.7], TE: [-0.5, 1.7], WA: [-0.5, -3.4], WB: [-0.5, 3.4] },
};
const KICK_DEF = {
  punt: { DL1: [0.9, -0.9], DL2: [0.9, 0.9], LB1: [1.0, -3.0], LB2: [1.0, 3.0], CB1: [8, -8], CB2: [8, 8], S: [FIELD.LEN > 0 ? 24 : 24, 0] },
  fg: { DL1: [0.9, -0.9], DL2: [0.9, 0.9], LB1: [1.0, -3.0], LB2: [1.0, 3.0], CB1: [1.2, -4.8], CB2: [1.2, 4.8], S: [10, 0] },
};
export function newKickPlay(spec) {
  const type = spec.type === 'punt' ? 'punt' : 'fg';
  const P = newPlay({ rng: spec.rng, teams: spec.teams, actors: spec.actors, off: spec.off, los: spec.los, toGo: 10, offId: 'inside', defId: 'zone', human: -1, kick: { type: spec.type, dist: spec.dist, good: spec.good, land: spec.land } });
  const offF = KICK_FORM[type], defF = KICK_DEF[type];
  let maxD = 0;
  for (const a of P.actors) {
    const f = a.team === P.off ? offF[a.slot] : defF[a.slot];
    const pt = P.fieldPt(f[0], f[1]);
    a.fx = pt.x; a.fz = pt.z;
    maxD = Math.max(maxD, hyp(a.x - a.fx, a.z - a.fz));
  }
  P.tl = clamp(maxD / 5.2, T.LINEUP, 5);
  const C = P.actors[P.off * 7 + 5];
  P.ball.x = C.fx; P.ball.z = C.fz; P.ball.px = C.fx; P.ball.pz = C.fz;
  P.play = { ...P.play, kind: 'kick', routes: {}, blocks: {} };
  return P;
}
function assignKick(P) {
  for (const a of P.actors) {
    if (a.unit === 'off') {
      if (a.slot === 'QB') { a.job = { k: 'kicker' }; a.q = { mode: 'snapwait', t: 0 }; }
      else if (a.slot === 'WA' || a.slot === 'WB') { a.job = { k: 'gunner', t: 0 }; }
      else a.job = { k: 'block', mode: 'pass', tgt: -1, t: 0 };
    } else {
      if (a.slot === 'DL1' || a.slot === 'DL2') a.job = { k: 'rush', lane: a.slot === 'DL1' ? -0.9 : 0.9, t: 0 };
      else if (a.slot === 'S' && P.kick.type === 'punt') a.job = { k: 'returner', t: 0 };
      else a.job = { k: 'kickother', t: 0 };
    }
  }
}
function kickMove(P, a, dt, tl) {
  const K = P.kick, kicker = P.actors[P.off * 7];
  if (a.job.k === 'kicker') {
    if (a.q.mode === 'snapwait') { stand(a); return true; }
    if (a.q.mode === 'got') {
      a.q.mode = 'step'; a.q.t = 0;
    }
    if (a.q.mode === 'step') {
      a.q.t += dt;
      const at = P.fieldPt(K.type === 'punt' ? -6.4 : -6.2, a.v);
      goTo(a, at.x, at.z, 0.45, 0.2);
      if (!P.kickDone && tl >= P.kickT) { doKick(P, a, tl); a.q.mode = 'after'; }
    }
    if (a.q.mode === 'after') { a.dvx *= 0.7; a.dvz *= 0.7; }
    return true;
  }
  if (a.job.k === 'gunner') {
    if (!P.kickDone) { stand(a); return true; }
    const l = K.land ? K.land : { x: 0, z: P.losZ + P.dir * 22 };
    goTo(a, a.x * 0.9 + l.x * 0.1, l.z, 0.95, 0.3);
    return true;
  }
  if (a.job.k === 'returner') {
    if (!P.kickDone) { stand(a); return true; }
    const l = P.ball.fly ? { x: P.ball.fly.x1, z: P.ball.fly.z1 } : { x: a.x, z: a.z };
    goTo(a, l.x, l.z, 0.8, 0.2);
    return true;
  }
  if (a.job.k === 'kickother') { if (P.kickDone) { stand(a); } else stand(a); return true; }
  void kicker;
  return false;
}
function doKick(P, k, tl) {
  const K = P.kick;
  P.kickDone = true;
  const from = { x: k.x + Math.sin(k.face) * 0.35, y: 0.5, z: k.z + Math.cos(k.face) * 0.35 };
  let to, Tf;
  if (K.type === 'punt') {
    const land = K.land || P.fieldPt(K.dist, 0);
    to = { x: land.x, y: 1.3, z: land.z };
    Tf = clamp(Math.hypot(to.x - from.x, to.z - from.z) / 11, 1.8, 3.4);
  } else {
    // through the uprights (good) or just wide of them (no good)
    const wide = K.good ? 0 : (P.rng.next() < 0.5 ? -1 : 1) * (1.6 + P.rng.next() * 1.2);
    to = { x: wide, y: K.good ? 5 : 4, z: goalZ(P.off) + P.dir * 1.1 };
    Tf = clamp(Math.hypot(to.x - from.x, to.z - from.z) / 14.5, 1.2, 2.4);
  }
  P.ball.st = 'air'; P.ball.kind = 'kick'; P.ball.holder = -1; k.hasBall = false;
  P.ball.fly = { x0: from.x, y0: from.y, z0: from.z, x1: to.x, y1: to.y, z1: to.z, T: Tf, t0: P.t, to: -1, lob: 1 };
  emit(P, 'kick', { kicker: k.id, type: K.type, T: Tf, from, to, good: K.good });
  K.landT = P.t + Tf;
}
function kickStepEnd(P, tl) {
  const K = P.kick;
  if (P.dead) return;
  if (P.kickDone && P.t >= K.landT - 1e-6) {
    const ret = K.type === 'punt' ? P.actors[P.def * 7] : null;
    if (ret && K.catchable !== false && P.ball.fly && P.U(P.ball.fly.z1) < FIELD.LEN + 1.5 && Math.abs(P.ball.fly.x1) < FIELD.HALF) { P.ball.st = 'held'; P.ball.holder = ret.id; ret.hasBall = true; P.carrierTeam = ret.team; emit(P, 'catch', { who: ret.id, kind: 'punt', x: ret.x, z: ret.z }); }
    endPlay(P, 'kick', { x: P.ball.fly ? P.ball.fly.x1 : 0, z: P.ball.fly ? P.ball.fly.z1 : P.losZ });
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// stepping the play
// ---------------------------------------------------------------------------------------------------------------------------------------
export function stepPlay(P, dt) {
  P.t += dt;
  const ball = P.ball;
  ball.px = ball.x; ball.py = ball.y; ball.pz = ball.z;
  for (const a of P.actors) { a.u = P.U(a.z); a.v = P.V(a.x); }
  if (P.phase === 'lineup') {
    for (const a of P.actors) { goTo(a, a.fx, a.fz, 0.82, 0.35); a.faceTo = null; }
    if (P.t >= P.tl) { P.phase = 'set'; P.tSet = P.t; for (const a of P.actors) { a.x = a.fx; a.z = a.fz; a.vx = a.vz = 0; a.px = a.x; a.pz = a.z; } }
    else { for (const a of P.actors) integrate(P, a, dt); return; }
  }
  if (P.phase === 'set') {
    const mo = P.play.motion;
    for (const a of P.actors) { stand(a); a.faceTo = null; a.face = a.team === P.off ? (P.dir > 0 ? 0 : Math.PI) : (P.dir > 0 ? Math.PI : 0); a.pface = a.face; a.vx = a.vz = 0; }
    ball.x = A(P, P.off * 7 + 5).fx; ball.z = A(P, P.off * 7 + 5).fz; ball.y = 0.5;
    if (mo) {
      const m = offOf(P, mo.slot), k = P.t - P.tSet;
      if (k > T.SET - mo.t) { const pt = P.fieldPt(mo.to[0], mo.to[1]); goTo(m, pt.x, pt.z, 0.75, 0.4); m.faceTo = null; m.face = Math.atan2(m.dvx, m.dvz || 1e-6) || m.face; integrate(P, m, dt); }
    }
    if (P.t - P.tSet >= T.SET) snap(P);
    return;
  }
  P.tl2 = P.t - P.tLive;
  stepLive(P, dt);
}

function snap(P) {
  P.phase = 'live'; P.tLive = P.t;
  if (P.kick) { assignKick(P); P.kickT = 1.45; } else { assignOffense(P); assignDefense(P); }
  const C = offOf(P, 'C'), Q = offOf(P, 'QB');
  const from = { x: C.x, y: 0.7, z: C.z }, to = { x: Q.x, y: 1.25, z: Q.z };
  const Tf = T.SNAP_FLIGHT;
  P.ball.st = 'air'; P.ball.kind = 'snap'; P.ball.holder = -1;
  P.ball.fly = { x0: from.x, y0: from.y, z0: from.z, x1: to.x, y1: to.y, z1: to.z, T: Tf, t0: P.t, to: Q.id };
  emit(P, 'snap', { qb: Q.id, c: C.id, T: Tf, from, to });
}

function stepLive(P, dt) {
  const ball = P.ball;
  const tl = P.t - P.tLive;
  // --- ball flights ------------------------------------------------------------------------------------------------------------------------------
  if (P.windup) { const q = A(P, P.windup.qb); if (q.wrap || q.down) { q.faceTo = null; P.windup = null; } else if (P.t >= P.windup.t - 1e-9) releaseThrow(P); }
  stepBall(P, dt, tl);
  // --- decisions and movement ----------------------------------------------------------------------------------------------------------------------
  if (!P.dead) {
    for (const a of P.actors) { a.slow = Math.max(0, a.slow - dt); a.evade = Math.max(0, a.evade - dt); a.burst = Math.max(0, a.burst - dt); a.burstCd = Math.max(0, a.burstCd - dt); for (const k in a.cool) if (a.cool[k] > 0) a.cool[k] -= dt; }
    humanIntent(P, dt);
    updateKnown(P, tl);
    for (const a of P.actors) {
      if (a.wrap || a.down) continue;
      if (a.attack) { attackMove(P, a); continue; }
      if (a.eng) { engagedMove(P, a); continue; }
      aiMove(P, a, dt, tl);
    }
    stepEngagements(P, dt);
    stepTackles(P, dt);
  } else {
    for (const a of P.actors) { if (!a.wrap && !a.down) { stand(a); } }
    stepTackles(P, dt);
  }
  for (const a of P.actors) integrate(P, a, dt);
  separate(P);
  afterMove(P, dt, tl);
  if (P.kick) kickStepEnd(P, tl);
  if (P.dead && P.t - P.deadT >= (P.kick ? 0.9 : T.WHISTLE) && P.phase === 'live') { P.phase = 'done'; finish(P); }
  if (!P.dead && tl > (P.kick ? 12 : T.MAX_PLAY)) { endPlay(P, ball.holder >= 0 ? 'time' : 'incomplete'); }
}

// ---- ball ----------------------------------------------------------------------------------------------------------------------------------
function flightPos(f, t) {
  const s = clamp((t - f.t0) / f.T, 0, 1);
  const vy0 = (f.y1 - f.y0 + 0.5 * G_YD * f.T * f.T) / f.T;
  const tt = s * f.T;
  return { x: f.x0 + (f.x1 - f.x0) * s, z: f.z0 + (f.z1 - f.z0) * s, y: f.y0 + vy0 * tt - 0.5 * G_YD * tt * tt };
}
export const flightApex = (f) => { const vy0 = (f.y1 - f.y0 + 0.5 * G_YD * f.T * f.T) / f.T; return f.y0 + (vy0 * vy0) / (2 * G_YD); };

function stepBall(P, dt, tl) {
  const b = P.ball;
  if (b.st === 'air' && b.fly) {
    const p = flightPos(b.fly, P.t);
    b.x = p.x; b.y = p.y; b.z = p.z;
    if (P.t >= b.fly.t0 + b.fly.T - 1e-9) arrive(P);
  } else if (b.st === 'held' && b.holder >= 0) {
    const h = A(P, b.holder);
    let c;
    if (h.q && h.q.mode === 'windup' && P.windup) {
      const s0 = clamp((P.t - P.windup.t0) / WINDUP, 0, 1), k = s0 * s0 * (3 - 2 * s0), r0 = readPoint(h), r1 = releasePoint(h);
      c = { x: r0.x + (r1.x - r0.x) * k, y: r0.y + (r1.y - r0.y) * k, z: r0.z + (r1.z - r0.z) * k };
    } else if (h.q && (h.q.mode === 'read')) c = readPoint(h);
    else c = carryPoint(h);
    if (b.blend) { const k = clamp((P.t - b.blend.t0) / 0.2, 0, 1), w = 1 - k * k * (3 - 2 * k); c = { x: c.x + b.blend.dx * w, y: c.y + b.blend.dy * w, z: c.z + b.blend.dz * w }; if (k >= 1) b.blend = null; }
    b.x = c.x; b.y = c.y; b.z = c.z;
  } else if (b.st === 'loose') {
    b.vy -= G_YD * dt; b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt;
    if (b.y <= 0.15) { b.y = 0.15; if (Math.abs(b.vy) > 1.6) b.vy = -b.vy * 0.45; else b.vy = 0; const f = Math.exp(-2.2 * dt); b.vx *= f; b.vz *= f; }
    if (b.z < -1.5 || b.z > FIELD.TOTAL + 1.5 || Math.abs(b.x) > FIELD.HALF + 1) { if (!P.dead) endPlay(P, 'loose-oob'); }
    // someone gets to it
    if (!P.dead && tl > b.looseT + 0.25) {
      let best = null, bd = 1e9;
      for (const a of P.actors) { if (a.wrap || a.down || a.eng) continue; const d = hyp(a.x - b.x, a.z - b.z); if (d < bd) { bd = d; best = a; } }
      if (best && bd < 0.95 && b.y < 1.5) recoverLoose(P, best);
    }
  } else if (b.st === 'ground' || b.st === 'dead') {
    if (b.st === 'dead') { b.vy -= G_YD * dt; b.y = Math.max(0.12, b.y + b.vy * dt); if (b.y <= 0.12) { b.vy = Math.abs(b.vy) > 1.5 ? -b.vy * 0.4 : 0; } b.x += b.vx * dt; b.z += b.vz * dt; b.vx *= 0.96; b.vz *= 0.96; }
  }
}

function giveBall(P, a, blend = true) {
  const b = P.ball;
  const was = { x: b.x, y: b.y, z: b.z }, wasHeld = b.st === 'held';
  b.st = 'held'; b.holder = a.id; b.fly = null; b.vx = b.vy = b.vz = 0;
  const c = a.q && a.q.mode === 'read' ? readPoint(a) : carryPoint(a);
  b.blend = blend && !wasHeld && hyp(was.x - c.x, was.z - c.z) + Math.abs(was.y - c.y) > 0.02 ? { dx: was.x - c.x, dy: was.y - c.y, dz: was.z - c.z, t0: P.t } : null;
  a.hasBall = true;
  for (const o of P.actors) if (o !== a) o.hasBall = false;
  P.carrierTeam = a.team;
}

function arrive(P) {
  const b = P.ball, f = b.fly;
  if (b.kind === 'snap') { const q = A(P, f.to); b.x = f.x1; b.y = f.y1; b.z = f.z1; giveBall(P, q); q.q && (q.q.mode = 'got'); P.qbHeld = true; emit(P, 'snapDone', { qb: q.id }); return; }
  if (b.kind === 'handoff') { const r = A(P, f.to); giveBall(P, r, false); if (P.play.id === 'jet') { r.burst = 1.2; r.burstCd = 99; } r.job = { k: 'carry', t: 0, hole: r.job && r.job.hole, hold: r.job && r.job.hold }; b.blend = null; return; }
  if (b.kind === 'pitch') {
    const r = A(P, f.to);
    if (!r.wrap && !r.down && hyp(r.x - f.x1, r.z - f.z1) < 2.2) { giveBall(P, r); r.job = { k: 'carry', t: 0, hole: P.play.hole, hold: P.play.hold }; emit(P, 'catch', { who: r.id, kind: 'pitch', x: f.x1, y: f.y1, z: f.z1 }); }
    else { dropLoose(P, f.x1, f.y1, f.z1, 'pitch'); }
    return;
  }
  if (b.kind === 'pass') resolvePass(P);
  else if (b.kind === 'kick') { b.st = 'dead'; b.x = f.x1; b.y = 0.3; b.z = f.z1; b.vx = b.vz = 0; b.vy = 0; emit(P, 'kickLand', { x: f.x1, z: f.z1 }); }
}

function dropLoose(P, x, y, z, why) {
  const b = P.ball;
  b.st = 'loose'; b.x = x; b.y = y; b.z = z; b.holder = -1; b.fly = null; b.looseT = P.t - P.tLive; b.vx = (P.rng.next() - 0.5) * 2.2; b.vz = (P.rng.next() - 0.5) * 2.2; b.vy = 2;
  for (const a of P.actors) a.hasBall = false;
  emit(P, 'loose', { x, z, why });
}
function recoverLoose(P, a) {
  const b = P.ball;
  const wasTeam = P.carrierTeam;
  giveBall(P, a);
  a.job = { k: 'carry', t: 0 };
  if (a.team !== P.off && !P.turnover) { P.turnover = true; }
  if (a.team === P.off && P.turnover) P.turnover = false;
  emit(P, 'recover', { who: a.id, team: a.team, wasTeam });
  void b;
}

// the throw (also used by the computer's quarterback): a short wind-up, then the ball leaves the hand
export const WINDUP = 0.3;
const releasePoint = (qb) => ({ x: qb.x + Math.sin(qb.face) * 0.25, y: BALL.releaseY, z: qb.z + Math.cos(qb.face) * 0.25 });
const readPoint = (qb) => ({ x: qb.x + Math.sin(qb.face) * 0.3 + Math.cos(qb.face) * 0.1, y: 1.5, z: qb.z + Math.cos(qb.face) * 0.3 - Math.sin(qb.face) * 0.1 });
export function qbThrow(P, qb, target, o = {}) {
  if (P.windup || !qb.q || P.ball.holder !== qb.id) return false;
  P.windup = { qb: qb.id, target: target.id, o, t: P.t + WINDUP, t0: P.t };
  qb.q.mode = 'windup'; qb.faceTo = { x: target.x, z: target.z };
  emit(P, 'windup', { qb: qb.id, target: target.id, release: P.t + WINDUP });
  return true;
}
function releaseThrow(P) {
  const w = P.windup; P.windup = null;
  const qb = A(P, w.qb), target = A(P, w.target), o = w.o, b = P.ball;
  qb.faceTo = null;
  if (qb.wrap || qb.down || b.holder !== qb.id) return;
  const from = releasePoint(qb);
  const lob = clamp(o.lob ?? 0, 0, 1);
  const vh = BALL.bullet - (BALL.bullet - BALL.lob) * lob;
  let Tf = 0.8, tp = { x: target.x, z: target.z };
  for (let i = 0; i < 4; i++) {
    const d = hyp(tp.x - from.x, tp.z - from.z);
    Tf = Math.max(BALL.minFlight, d / vh);
    tp = futurePos(P, target, Tf);
  }
  const d = hyp(tp.x - from.x, tp.z - from.z);
  // accuracy: depends on the thrower, the distance, pressure, throwing on the run and (for the user) how well the loft was timed
  let sig = (0.1 + 0.042 * d) * (1.4 - qb.qbr) * (1 + (o.err ?? 0));
  const near = nearestRusher(P, qb);
  if (near && near.d < 2.4) sig *= 1.25 + (2.4 - near.d) * 0.15;
  if (hyp(qb.vx, qb.vz) > 2) sig *= 1.15;
  const ex = gauss(P.rng) * sig, ez = gauss(P.rng) * sig * 0.9;
  const to = { x: clamp(tp.x + ex, -FIELD.HALF - 2, FIELD.HALF + 2), y: BALL.catchY + (lob > 0.5 ? 0.1 : 0) - 0.2 * Math.abs(gauss(P.rng)) * 0.3, z: tp.z + ez };
  b.st = 'air'; b.kind = 'pass'; b.holder = -1; qb.hasBall = false; b.blend = null;
  b.fly = { x0: from.x, y0: from.y, z0: from.z, x1: to.x, y1: to.y, z1: to.z, T: Tf, t0: P.t, to: target.id, lob, err: hyp(ex, ez) };
  P.thrown = true; P.passT = P.t; P.passTarget = target.id; P.qbHeld = false;
  qb.q.mode = 'thrown'; qb.job = { k: 'idle' };
  target.job = { k: 'ballwatch', to, t: 0 };
  P.knownRun = false;
  emit(P, 'throw', { qb: qb.id, target: target.id, T: Tf, from, to, lob, err: hyp(ex, ez) });
}

function futurePos(P, a, tf) {
  if (a.route && a.job && (a.job.k === 'route' || a.job.k === 'block') && a.route.i < a.route.pts.length) {
    let x = a.x, z = a.z, rem = tf * a.spd * 0.97, i = a.route.i;
    while (rem > 1e-6 && i < a.route.pts.length) {
      const p = a.route.pts[i], d = hyp(p.x - x, p.z - z);
      if (d <= rem) { x = p.x; z = p.z; rem -= d; i++; } else { x += ((p.x - x) / d) * rem; z += ((p.z - z) / d) * rem; rem = 0; }
    }
    return { x, z };
  }
  return { x: a.x + a.vx * tf * 0.85, z: a.z + a.vz * tf * 0.85 };
}
export { futurePos };

function nearestRusher(P, qb) {
  let best = null;
  for (const a of P.actors) {
    if (a.team === qb.team || a.wrap || a.down) continue;
    if (!(a.job && (a.job.k === 'rush' || a.job.k === 'pursue'))) continue;
    const d = hyp(a.x - qb.x, a.z - qb.z);
    if (!best || d < best.d) best = { a, d, free: !a.eng };
  }
  return best;
}
export { nearestRusher };

// ---- completing a pass ----------------------------------------------------------------------------------------------------------------------
function resolvePass(P) {
  const b = P.ball, f = b.fly;
  const to = { x: f.x1, y: f.y1, z: f.z1 };
  const tgt = A(P, f.to);
  const cands = [];
  for (const a of P.actors) {
    if (a.wrap || a.down) continue;
    const d = hyp(a.x - to.x, a.z - to.z);
    if (d < 2.7) cands.push({ a, d });
  }
  cands.sort((p, q) => p.d - q.d);
  // defenders first: anyone close to the ball may break it up or take it
  const quality = clamp(1 - f.err / 3, 0, 1);
  for (const c of cands) {
    const a = c.a;
    if (a.team === P.off) continue;
    const swatOn = a.human && a.swatAt != null && Math.abs(a.swatAt - P.t) < 0.35;
    const reach = swatOn ? 2.9 : 2.6;
    if (c.d > reach) continue;
    let p = (0.95 - c.d / reach) * (0.2 + 0.55 * a.cover + 0.15 * a.hands) * (a.eng ? 0.4 : 1) + (swatOn ? 0.25 : 0);
    p *= 0.8 + 0.5 * (1 - quality);
    p = clamp(p, 0, 0.85);
    const u = P.rng.next();
    if (u < p * 0.38) { intercept(P, a, to); return; }
    if (u < p) { emit(P, 'deflect', { who: a.id, x: to.x, y: to.y, z: to.z }); deflected(P, to); return; }
  }
  // the receiver
  if (tgt && !tgt.wrap && !tgt.down && tgt.team === P.off) {
    const d = hyp(tgt.x - to.x, tgt.z - to.z);
    const R = 1.3;
    if (Math.abs(to.x) > FIELD.HALF - 0.3) { missed(P, to, 'oob'); return; }
    if (d <= R) {
      let p = 0.55 + 0.3 * tgt.hands - 0.26 * Math.pow(d / R, 1.5);
      const win = tgt.human && Math.abs(tgt.catchAt - P.t) < 0.35;
      if (win) p += 0.22; else if (tgt.human && tgt.catchAt > -5 && Math.abs(tgt.catchAt - P.t) < 0.8) p -= 0.05;
      // a defender right on top of the receiver makes it harder
      let close = 9; for (const c of cands) if (c.a.team !== tgt.team) close = Math.min(close, hyp(c.a.x - tgt.x, c.a.z - tgt.z));
      if (close < 2.6) p -= 0.42 * (1 - close / 2.6);
      const depth = Math.max(0, P.U(to.z) - 8);
      p -= 0.02 * depth;
      p = clamp(p, 0.04, 0.97);
      if (P.rng.next() < p) { catchBall(P, tgt, to, d); return; }
      emit(P, 'drop', { who: tgt.id, x: to.x, y: to.y, z: to.z });
      missed(P, to, 'drop'); return;
    }
  }
  // someone else on the offence (a lucky bounce) never catches it: incomplete
  missed(P, to, 'incomplete');
}
function catchBall(P, a, to, d) {
  giveBall(P, a);
  a.shift = { dx: to.x - a.x, dz: to.z - a.z, t: 0.16, left: 0.16 };
  a.job = { k: 'carry', t: 0 };
  a.evade = 0; a.slow = 0.5; a.vx *= 0.6; a.vz *= 0.6;
  P.catchSpot = { x: to.x, z: to.z };
  emit(P, 'catch', { who: a.id, kind: 'pass', x: to.x, y: to.y, z: to.z, d });
  P.knownRun = true; P.knownT = P.t - P.tLive; P.afterCatch = true;
}
function intercept(P, a, to) {
  giveBall(P, a);
  a.shift = { dx: to.x - a.x, dz: to.z - a.z, t: 0.16, left: 0.16 };
  a.job = { k: 'carry', t: 0 };
  P.turnover = true;
  emit(P, 'intercept', { who: a.id, x: to.x, y: to.y, z: to.z });
  P.knownRun = true; P.knownT = P.t - P.tLive;
  for (const o of P.actors) if (o !== a && o.team === a.team) o.job = { k: 'escort', t: 0 };
  for (const o of P.actors) if (o.team !== a.team && !o.wrap && !o.down) o.job = { k: 'pursue', t: 0 };
}
function deflected(P, to) {
  const b = P.ball;
  b.st = 'dead'; b.x = to.x; b.y = to.y; b.z = to.z; b.vx = (P.rng.next() - 0.5) * 3; b.vz = (P.rng.next() - 0.5) * 3; b.vy = 1.5; b.holder = -1; b.fly = null;
  endPlay(P, 'incomplete');
}
function missed(P, to, why) {
  const b = P.ball;
  b.st = 'dead'; b.x = to.x; b.y = Math.max(0.5, to.y); b.z = to.z; b.vx = b.fly ? (b.fly.x1 - b.fly.x0) / b.fly.T * 0.25 : 0; b.vz = b.fly ? (b.fly.z1 - b.fly.z0) / b.fly.T * 0.25 : 0; b.vy = 0.5; b.holder = -1; b.fly = null;
  emit(P, 'incompletePass', { x: to.x, z: to.z, why });
  endPlay(P, 'incomplete');
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// the user's input
// ---------------------------------------------------------------------------------------------------------------------------------------
function humanIntent(P) {
  const a = P.human >= 0 ? A(P, P.human) : null;
  const I = P.intent;
  if (!a) return;
  a.stick = hyp(I.mx, I.mz) > 0.18;
  if (I.burst) { if (a.burstCd <= 0) { a.burst = 1.0; a.burstCd = 3.6; emit(P, 'burst', { who: a.id }); } I.burst = false; }
  if (I.catchPress) { a.catchAt = P.t; I.catchPress = false; }
  if (I.swat) { a.swatAt = P.t; I.swat = false; emit(P, 'swat', { who: a.id }); }
  if (I.juke && a.hasBall && !(a.cool.juke > 0)) {
    const s = I.juke > 0 ? 1 : -1; doJuke(P, a, s); I.juke = 0;
  } else if (I.juke) I.juke = 0;
  if (I.spin) { if (a.hasBall && !(a.cool.spin > 0)) doSpin(P, a); I.spin = false; }
  if (I.tackle) { doLunge(P, a); I.tackle = false; }
  if (I.rush) { rushMove(P, a); I.rush = false; }
  if (I.throwTo && a.q && (a.q.mode === 'read' || a.q.mode === 'drop') && P.ball.holder === a.id) {
    const tgt = I.throwTo === 'WA' || I.throwTo === 'WB' || I.throwTo === 'TE' || I.throwTo === 'RB' ? offOf(P, I.throwTo) : null;
    if (tgt) {
      const d = hyp(tgt.x - a.x, tgt.z - a.z);
      const ideal = clamp((d - 8) / 24, 0, 1);
      const lob = clamp(I.lob, 0, 1);
      const err = lob < 0.04 && ideal > 0.55 ? 0.35 : Math.abs(lob - ideal) < 0.25 ? -0.2 : Math.abs(lob - ideal) * 0.8;
      qbThrow(P, a, tgt, { lob, err: Math.max(-0.2, err) });
    }
    I.throwTo = null;
  } else if (I.throwTo) I.throwTo = null;
}

function doJuke(P, a, s) {
  // s = +1: toward the right of the screen, -1: toward the left; the step is sideways to his heading
  const hv = hyp(a.vx, a.vz), hx = hv > 0.5 ? a.vx / hv : Math.sin(a.face), hz = hv > 0.5 ? a.vz / hv : Math.cos(a.face);
  let px = hz, pz = -hx;                         // the heading's right-hand side
  if (px * s < 0 || (Math.abs(px) < 0.2 && s * (px || 1) < 0)) { px = -px; pz = -pz; }
  a.vx += px * 3.2; a.vz += pz * 3.2;
  a.vx *= 0.93; a.vz *= 0.93;
  a.evade = 0.42; a.jukeT = 0.42; a.jukeDir = s; a.cool.juke = 0.8;
  emit(P, 'juke', { who: a.id, dir: s });
}
function doSpin(P, a) {
  a.evade = 0.5; a.spinT = 0.5; a.slow = 0.35; a.cool.spin = 1.1; a.cool.juke = Math.max(a.cool.juke || 0, 0.3);
  emit(P, 'spin', { who: a.id });
}
function doLunge(P, a) {
  // the user's tackle button: dive at the ball carrier (or the quarterback) if one is near
  if (a.attack || a.wrap || a.down || a.cool.lunge > 0) return;
  const tgt = P.ball.holder >= 0 ? A(P, P.ball.holder) : null;
  if (!tgt || tgt.team === a.team || tgt.wrap || tgt.down) { a.cool.lunge = 0.4; return; }
  if (hyp(tgt.x - a.x, tgt.z - a.z) > 3.6) { a.cool.lunge = 0.4; return; }
  startAttack(P, a, tgt, true);
}
export function startAttack(P, d, h, dive) {
  d.attack = { tgt: h.id, t0: P.t, tc: P.t + (dive ? 0.3 : 0.24), dive };
  d.cool.lunge = 1.0; d.dive = 0.3;
  emit(P, 'tackleStart', { tackler: d.id, carrier: h.id, tc: d.attack.tc, dive: !!dive });
}
function rushMove(P, a) {
  if (!a.eng || a.unit !== 'def' || a.cool.rushmove > 0) return;
  a.cool.rushmove = 1.2;
  const pr = a.eng, B = A(P, pr.a === a.id ? pr.b : pr.a);
  if (P.t - pr.t0 < 0.3) return;
  const p = clamp(0.38 + 0.9 * (a.str - B.str) + 0.12, 0.12, 0.88);
  emit(P, 'rushMove', { who: a.id });
  if (P.rng.next() < p) pr.hold = 0; else { pr.hold += 0.35; a.stumble = 0.25; }
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// who moves where
// ---------------------------------------------------------------------------------------------------------------------------------------
function updateKnown(P, tl) {
  if (P.knownRun) return;
  if (P.handDone && P.play.kind === 'run') { P.knownRun = true; P.knownT = tl; return; }
  const h = P.ball.holder >= 0 ? A(P, P.ball.holder) : null;
  if (h && h.hasBall && h.team === P.off && !(h.slot === 'QB' && P.qbHeld && P.play.kind === 'pass' && h.u < 0.4) && h.slot !== 'QB' && (P.play.kind === 'run' || P.afterCatch)) { P.knownRun = true; P.knownT = tl; }
  else if (h && h.slot === 'QB' && h.u > 0.6 && P.qbHeld) { P.knownRun = true; P.knownT = tl; }
}

function aiMove(P, a, dt, tl) {
  const job = a.job;
  if (!job) { stand(a); return; }
  job.t += dt;
  if (P.kick && kickMove(P, a, dt, tl)) return;
  if (a.human && a.stick && a.job.k !== 'qb_h') {
    humanMove(P, a, dt);
    return;
  }
  switch (job.k) {
    case 'route': routeMove(P, a, tl); break;
    case 'meet': meetMove(P, a, tl); break;
    case 'receive': carryMove(P, a, dt); break;
    case 'qb': qbMove(P, a, dt, tl); break;
    case 'carry': carryMove(P, a, dt); break;
    case 'block': blockMove(P, a, dt, tl); break;
    case 'rush': rushJob(P, a, tl); break;
    case 'man': manJob(P, a, tl); break;
    case 'zone': zoneJob(P, a, tl); break;
    case 'deep': deepJob(P, a, tl); break;
    case 'fill': fillJob(P, a, tl); break;
    case 'pursue': pursueJob(P, a, tl); break;
    case 'ballwatch': ballwatchJob(P, a, tl); break;
    case 'escort': escortJob(P, a, tl); break;
    case 'sit': sitJob(P, a); break;
    case 'bite': goTo(a, a.x, a.z + P.dir * 1, 0.5); break;
    default: stand(a);
  }
  // defenders break on the ball / the runner once they know
  if (a.unit === 'def' && !a.wrap && !a.down && job.k !== 'pursue' && job.k !== 'ballwatch' && job.k !== 'carry') reactDefender(P, a, tl);
  else if (a.unit === 'off' && P.turnover && a.job.k !== 'pursue' && a.job.k !== 'carry' && a.job.k !== 'escort') a.job = P.carrierTeam === a.team ? { k: 'escort', t: 0 } : { k: 'pursue', t: 0 };
}

function reactDefender(P, a, tl) {
  const b = P.ball;
  if (P.turnover && P.carrierTeam === a.team) { a.job = { k: 'escort', t: 0 }; return; }
  if (b.st === 'air' && b.kind === 'pass' && P.t - P.passT >= a.react * 0.7) {
    const dd = hyp(a.x - b.fly.x1, a.z - b.fly.z1);
    a.job = dd < 15 ? { k: 'ballwatch', to: { x: b.fly.x1, y: b.fly.y1, z: b.fly.z1 }, t: 0, def: true } : { k: 'pursue', t: 0 };
    return;
  }
  const rt = a.job.k === 'fill' ? a.react * 0.3 : a.react;
  if (P.knownRun && tl - P.knownT >= rt && !P.thrown || (P.afterCatch && P.carrierTeam === P.off && tl - P.knownT >= a.react * 0.5)) {
    if (a.job.k === 'rush' && !P.afterCatch && !(P.ball.holder >= 0 && A(P, P.ball.holder).slot !== 'QB' && P.play.kind !== 'run' && false)) { /* rushers keep rushing a quarterback who runs */ }
    a.job = { k: 'pursue', t: 0 };
    return;
  }
  // play-action and fake handoffs pull the linebackers up
  if (P.fakeDone && !a.bitten && (a.slot === 'LB1' || a.slot === 'LB2' || a.slot === 'S') && tl - P.fakeT < 0.6 && a.job.k !== 'rush') {
    a.bitten = true;
    if (P.rng.next() < (a.slot === 'S' ? 0.2 : 0.75) * (1.15 - a.dec * 0.4)) a.bite = 0.7;
  }
  if (a.bite > 0) { a.bite -= 1 / 60; a.dvx *= 0.4; a.dvz = a.dvz * 0.4 + P.dir * -1 * 0; goTo(a, a.x, a.z - P.dir * 1.0, 0.5); }
}

// --- offence: routes, handoffs, the quarterback ----------------------------------------------------------------------------------------
function routeMove(P, a, tl) {
  const r = a.route;
  if (!r || r.i >= r.pts.length) { a.job = { k: 'sit', t: 0 }; return; }
  const p = r.pts[r.i];
  const d = hyp(p.x - a.x, p.z - a.z);
  if (d < 0.7) {
    r.i++;
    if (r.i < r.pts.length) {
      const n = r.pts[r.i], ang = Math.abs(wrapAngle(Math.atan2(n.x - p.x, n.z - p.z) - Math.atan2(p.x - a.x, p.z - a.z)));
      if (ang > 0.5) a.slow = 0.18 + 0.1 * (1 - a.elude);
    } else { a.job = { k: 'sit', t: 0 }; return; }
  }
  const q = r.pts[Math.min(r.i, r.pts.length - 1)];
  goTo(a, q.x, q.z, 0.97, 0.15);
}
function sitJob(P, a) {
  // settle into a soft spot: slow to a stop, facing the quarterback
  a.dvx *= 0.6; a.dvz *= 0.6;
  const q = P.actors[P.off * 7];
  a.faceTo = null; void q;
}
function meetMove(P, a, tl) {
  const j = a.job, h = P.play.handoff;
  goTo(a, j.at.x, j.at.z, 0.9, 0.2);
  void tl; void h;
}
function escortJob(P, a, tl) {
  const c = P.ball.holder >= 0 ? A(P, P.ball.holder) : null;
  if (!c) { stand(a); return; }
  const gd = attackDir(c.team);
  // run ahead of the ball carrier and block the nearest chaser
  let best = null, bd = 1e9;
  for (const o of P.actors) { if (o.team === c.team || o.wrap || o.down) continue; if ((o.z - c.z) * gd < -1) continue; const d = hyp(o.x - c.x, o.z - c.z); if (d < bd) { bd = d; best = o; } }
  if (best && !best.eng && bd < 9) goTo(a, best.x, best.z + gd * 0.4, 1, 0.2); else goTo(a, c.x * 0.8, c.z + gd * 4, 0.9, 0.3);
}
function pursueJob(P, a, tl) {
  const c = P.ball.holder >= 0 ? A(P, P.ball.holder) : null;
  const b = P.ball;
  if (!c) {
    if (b.st === 'loose') goTo(a, b.x, b.z, 1, 0.12);
    else if (b.st === 'air' && b.fly) goTo(a, b.fly.x1, b.fly.z1, 1, 0.12);
    else stand(a);
    return;
  }
  if (c.team === a.team) { a.job = { k: 'escort', t: 0 }; return; }
  const dd = hyp(c.x - a.x, c.z - a.z);
  if (dd > 4 && a.burstCd <= 0 && !a.human) { a.burst = 1.4; a.burstCd = 99; }
  const sp = a.spd * (a.burst > 0 ? 1.14 : 1);
  // where can he be caught? solve |c + v t - d| = sp t for the earliest t; fall back to a lead on his heading
  let tx = c.x, tz = c.z;
  const vx = c.vx, vz = c.vz, rx = c.x - a.x, rz = c.z - a.z;
  const qa = vx * vx + vz * vz - sp * sp, qb = 2 * (rx * vx + rz * vz), qc = rx * rx + rz * rz;
  let tt = -1;
  if (Math.abs(qa) < 1e-6) { if (Math.abs(qb) > 1e-6) tt = -qc / qb; }
  else { const disc = qb * qb - 4 * qa * qc; if (disc >= 0) { const r1 = (-qb - Math.sqrt(disc)) / (2 * qa), r2 = (-qb + Math.sqrt(disc)) / (2 * qa); const lo = Math.min(r1, r2), hi = Math.max(r1, r2); tt = lo > 0 ? lo : hi > 0 ? hi : -1; } }
  if (tt > 0) { tt = Math.min(tt, 1.8) * (dd > 3 ? 0.95 : 0.6); tx = c.x + vx * tt; tz = c.z + vz * tt; }
  goTo(a, tx, tz, 1, 0.1);
}
function ballwatchJob(P, a, tl) {
  const j = a.job, to = j.to;
  const ball = P.ball;
  if (ball.st === 'held' && ball.holder >= 0 && ball.holder !== a.id) { const h = A(P, ball.holder); a.job = h.team === a.team ? { k: 'escort', t: 0 } : { k: 'pursue', t: 0 }; return; }
  if (ball.st !== 'air' && !P.thrown) { stand(a); return; }
  if (ball.st !== 'air') { stand(a); return; }
  const tgt = to;
  const rem = ball.fly ? Math.max(0, ball.fly.t0 + ball.fly.T - P.t) : 0;
  const d = hyp(tgt.x - a.x, tgt.z - a.z);
  // run to the spot, arriving as the ball does
  const need = d / Math.max(0.1, rem + 0.15);
  const frac = clamp(need / a.spd, 0.25, 1.05);
  goTo(a, tgt.x, tgt.z, Math.min(1, frac), 0.12);
  a.faceTo = rem < 0.5 && d < 3.5 ? { x: tgt.x, z: tgt.z } : null;
}

function qbMove(P, a, dt, tl) {
  const q = a.q, play = P.play;
  const qbTeam = a.team;
  switch (q.mode) {
    case 'snapwait': stand(a); break;
    case 'got': {
      q.t = 0;
      if (play.kind === 'run' && play.handoff) q.mode = 'hand';
      else if (play.draw) q.mode = 'draw';
      else q.mode = 'drop';
      break;
    }
    case 'hand': {
      const h = play.handoff, at = P.fieldPt(h.at[0] + (h.toss ? -0.3 : 0.6), h.at[1] + (h.toss ? -1.4 : -0.5));
      goTo(a, at.x, at.z, 0.7, 0.25);
      const r = offOf(P, h.to);
      q.t += dt;
      if (!P.handDone && tl >= h.t) {
        const d = hyp(r.x - a.x, r.z - a.z);
        if (h.toss) {
          P.handDone = true;
          const tp = futurePos(P, r, 0.5), from = { x: a.x, y: 1.3, z: a.z };
          const Tf = Math.max(0.4, hyp(tp.x - from.x, tp.z - from.z) / 12);
          P.ball.st = 'air'; P.ball.kind = 'pitch'; P.ball.holder = -1; a.hasBall = false; P.qbHeld = false;
          P.ball.fly = { x0: from.x, y0: from.y, z0: from.z, x1: tp.x, y1: 1.2, z1: tp.z, T: Tf, t0: P.t, to: r.id };
          r.job = { k: 'ballwatch', to: { x: tp.x, y: 1.2, z: tp.z }, t: 0 };
          emit(P, 'pitch', { qb: a.id, to: r.id, T: Tf, from, target: { x: tp.x, y: 1.2, z: tp.z } });
        } else if (d < 1.15 || tl > h.t + 0.5) {
          P.handDone = true;
          const from = { x: P.ball.x, y: P.ball.y, z: P.ball.z }, c = carryPoint(r);
          P.ball.st = 'air'; P.ball.kind = 'handoff'; P.ball.holder = -1; a.hasBall = false; P.qbHeld = false;
          P.ball.fly = { x0: from.x, y0: from.y, z0: from.z, x1: c.x + r.vx * 0.15, y1: c.y, z1: c.z + r.vz * 0.15, T: 0.16, t0: P.t, to: r.id };
          r.job = { k: 'receive', t: 0, hole: play.hole, hold: play.hold };
          emit(P, 'handoff', { qb: a.id, to: r.id, T: 0.16 });
        }
      }
      if (P.handDone) q.mode = 'after';
      break;
    }
    case 'after': {
      // carry out the fake: a few steps toward the strong side, then stand
      goTo(a, a.x + P.dir * 0.2, a.z + P.dir * 1.2, 0.4, 0.3);
      if (q.t > 1.5) stand(a);
      q.t += dt; break;
    }
    case 'draw': {
      const dr = play.draw, tgt = P.fieldPt(dr.u, 0);
      goTo(a, tgt.x, tgt.z, 0.75, 0.25);
      q.t += dt;
      if (q.t >= dr.t) { a.burst = 2.2; a.burstCd = 99; a.spd *= 1.12; a.job = { k: "carry", t: 0, hole: play.hole, hold: play.hold }; P.qbHeld = false; emit(P, 'qbRun', { who: a.id }); P.knownRun = true; P.knownT = tl + 0.55; }
      break;
    }
    case 'drop': {
      const dr = play.drop, pt = P.fieldPt(dr.u, play.fake ? 1.2 : 0);
      q.t += dt;
      if (play.fake && !P.fakeDone && q.t >= play.fake.t) {
        P.fakeDone = true; P.fakeT = tl;
        emit(P, 'fake', { qb: a.id, to: offOf(P, play.fake.to).id });
      }
      const d = goTo(a, pt.x, pt.z, 0.82, 0.3);
      if (d < 0.45 || q.t > dr.t + 0.8) { q.mode = 'read'; q.t0 = tl; }
      break;
    }
    case 'read': {
      stand(a);
      if (!a.human) qbThink(P, a, tl);
      else humanQbMove(P, a);
      break;
    }
    case 'thrown': stand(a); break;
    default: stand(a);
  }
  // the user's quarterback may steer away from the rush even during the drop
  if (a.human && a.stick && (q.mode === 'drop' || q.mode === 'read' || q.mode === 'got')) humanMove(P, a, dt);
  // the quarterback always faces downfield (or where he runs)
  if (q.mode === 'read' || q.mode === 'drop' || q.mode === 'got' || q.mode === 'snapwait') a.faceTo = { x: a.x, z: a.z + P.dir * 12 };
  else if (q.mode === 'hand') { const r = offOf(P, P.play.handoff.to); a.faceTo = { x: r.x, z: r.z }; }
}
function humanQbMove(P, a) {
  // user quarterback: the stick scrambles; once he crosses the line with the ball he is a runner
  if (a.u > 0.4 && P.ball.holder === a.id) { a.job = { k: 'carry', t: 0 }; a.q.mode = 'run'; P.qbHeld = false; }
}

// openness of every receiver (separation from the nearest defender at the catch point), used by the computer's quarterback and the user's tags
export function receiverRead(P, qb) {
  const out = [];
  for (const slot of ['WA', 'TE', 'WB', 'RB']) {
    const r = offOf(P, slot);
    if (!r || r.wrap || r.down) continue;
    const d0 = hyp(r.x - qb.x, r.z - qb.z);
    const Tf = Math.max(BALL.minFlight, d0 / BALL.bullet) + 0.25;
    const pt = futurePos(P, r, Tf);
    let sep = 99, near = null;
    for (const d of P.actors) {
      if (d.team === r.team || d.wrap || d.down) continue;
      const dp = { x: d.x + d.vx * Tf * 0.7, z: d.z + d.vz * Tf * 0.7 };
      // a blocked or rushing defender cannot reach the ball
      if (d.eng && d.slot !== 'S') continue;
      const dd = hyp(dp.x - pt.x, dp.z - pt.z);
      if (dd < sep) { sep = dd; near = d; }
    }
    const u = P.U(pt.z), inb = Math.abs(pt.x) < FIELD.HALF - 0.8;
    out.push({ slot, id: r.id, sep, u, x: pt.x, z: pt.z, d: d0, inb, behind: u < 0 });
  }
  return out;
}

function qbThink(P, a, tl) {
  const q = a.q, play = P.play;
  q.n = (q.n || 0) + 1;
  // slide away from the nearest free rusher
  const near = nearestRusher(P, a);
  if (near && near.free && near.d < 3.2 && a.dec > 0.4) {
    const side = Math.sign(a.x - near.a.x) || 1;
    a.dvx = side * 1.6; a.dvz = -P.dir * 0.4;
  } else stand(a);
  if (q.n % 5 !== 1) return;
  const hot = near && near.free && near.d < 3.9 && tl > 0.9;
  if (tl < play.ready && !hot) return;
  const reads = receiverRead(P, a);
  // score the receivers in the play's read order, the first read gets a bonus
  let best = null;
  for (const r of reads) {
    if (!r.inb || r.d < 2.5) continue;
    let score = Math.min(r.sep, 5) + (play.reads[0] === r.slot ? 0.9 * a.dec : 0) + (r.u > 0 ? Math.min(r.u, 20) * 0.03 : -1.2);
    if (play.screen) { if (r.slot !== 'RB') continue; const rr = offOf(P, 'RB'); if (Math.abs(rr.v) < 6.2 || tl < play.ready) continue; score += 3; }
    score += (P.rng.next() - 0.5) * (1.1 - a.dec) * 1.4;
    if (!best || score > best.score) best = { r, score };
  }
  const press = near && near.d < 2.3 && near.free;
  const thresh = 1.35 + (1 - a.dec) * 1.4;
  const waited = tl >= play.max;
  if (best && (best.r.sep >= thresh || (press && best.r.sep >= 0.8) || waited)) {
    const r = A(P, best.r.id);
    const ideal = clamp((best.r.d - 8) / 24, 0, 1);
    qbThrow(P, a, r, { lob: clamp(ideal + (P.rng.next() - 0.5) * 0.25 * (1.1 - a.dec), 0, 1), err: (1 - a.dec) * 0.35 });
  } else if (press && a.dec > 0.5 && P.rng.next() < 0.5) {
    // run for it
    a.job = { k: 'carry', t: 0 }; a.q.mode = 'run'; P.qbHeld = false; emit(P, 'scramble', { who: a.id });
  } else if (waited && !best) {
    // nothing: throw it away
    const to = { x: a.x > 0 ? FIELD.HALF + 1 : -FIELD.HALF - 1, y: 1.8, z: a.z + P.dir * 3 };
    throwAway(P, a, to);
  }
}
function throwAway(P, a, to) {
  const b = P.ball;
  const from = { x: a.x, y: BALL.releaseY, z: a.z };
  const Tf = Math.max(0.6, hyp(to.x - from.x, to.z - from.z) / 16);
  b.st = 'air'; b.kind = 'pass'; b.holder = -1; a.hasBall = false; P.qbHeld = false; P.thrown = true; P.passT = P.t;
  b.fly = { x0: from.x, y0: from.y, z0: from.z, x1: to.x, y1: to.y, z1: to.z, T: Tf, t0: P.t, to: -1, lob: 0.2, err: 9 };
  a.q.mode = 'thrown'; a.job = { k: 'idle' };
  emit(P, 'throw', { qb: a.id, target: -1, T: Tf, from, to, lob: 0.2, err: 9, away: true });
}

// --- offence: blocking -------------------------------------------------------------------------------------------------------------------
function freeRushers(P, team) {
  return P.actors.filter((d) => d.team === team && !d.wrap && !d.down && d.job && (d.job.k === 'rush' || d.job.k === 'pursue' || d.slot === 'DL1' || d.slot === 'DL2'));
}
function blockMove(P, a, dt, tl) {
  const j = a.job, mode = j.mode;
  const qb = P.actors[P.off * 7];
  if (mode === 'fake' || mode === 'draw') { stand(a); return; }
  // receivers who have a route and a block: run the route first
  if (mode === 'screen') {
    if (tl < 0.8 && !j.rel) { passBlock(P, a, qb, j); return; }
    if (!j.rel) { j.rel = true; j.mode2 = 'run'; }
    const rb = offOf(P, 'RB');
    if (!j.tgt || j.tgt < 0) { j.tgt = pickBlockTarget(P, a, { x: rb.x, z: rb.z + P.dir * 2 }); }
    runBlock(P, a, j, rb);
    return;
  }
  if (mode === 'pass' && P.play.draw && tl > P.play.draw.t - 0.1 && !j.drawn) { j.drawn = true; j.mode = 'run'; j.tgt = -1; return; }
  if (mode === 'pass') { passBlock(P, a, qb, j); return; }
  if (mode === 'stalk') { stalkBlock(P, a, j, tl); return; }
  if (mode === 'lead') { leadBlock(P, a, j, tl); return; }
  if (mode === 'run') { runBlock(P, a, j, null); return; }
  stand(a);
}
function passBlock(P, a, qb, j) {
  // find the most dangerous rusher this player can handle
  if (j.tgt < 0 || !A(P, j.tgt) || A(P, j.tgt).wrap || A(P, j.tgt).down || (A(P, j.tgt).eng && A(P, j.tgt).eng.a !== a.id && A(P, j.tgt).eng.b !== a.id) || (P.t - (j.pick || 0) > 0.4)) {
    j.pick = P.t;
    let best = null, bs = 1e9;
    const taken = new Set(); for (const o of P.actors) if (o.team === a.team && o !== a && o.job && o.job.k === 'block' && o.job.tgt >= 0) taken.add(o.job.tgt);
    for (const d of freeRushers(P, P.def)) {
      if (d.eng && d.eng.a !== a.id && d.eng.b !== a.id) continue;
      const dq = hyp(d.x - qb.x, d.z - qb.z);
      if (dq > 11) continue;
      let s = Math.abs(d.v - a.v) * 0.8 + hyp(d.x - a.x, d.z - a.z) * 0.5 + (taken.has(d.id) ? 6 : 0);
      if (a.slot === 'RB') s = dq + (taken.has(d.id) ? 7 : 0);
      if (s < bs) { bs = s; best = d; }
    }
    j.tgt = best ? best.id : -1;
  }
  const d = j.tgt >= 0 ? A(P, j.tgt) : null;
  if (!d) {
    // nobody to block: set up in front of the quarterback
    goTo(a, qb.x + (a.x - qb.x) * 0.5, qb.z + P.dir * 1.8, 0.55, 0.3);
    return;
  }
  // stand between the rusher and the quarterback, 1.1 yd from him
  const [nx, nz] = norm(qb.x - d.x, qb.z - d.z);
  const px = d.x + nx * 1.38, pz = d.z + nz * 1.38;
  goTo(a, px, pz, 1, 0.12);
  if (!d.eng && !a.eng && !(a.cool['e' + d.id] > 0) && hyp(d.x - a.x, d.z - a.z) < 1.5 && hyp(d.x - qb.x, d.z - qb.z) > 1.4) engage(P, a, d, 'pass');
}
function pickBlockTarget(P, a, aim) {
  let best = null, bs = 1e9;
  const taken = new Set(); for (const o of P.actors) if (o.team === a.team && o !== a && o.job && o.job.k === 'block' && o.job.tgt >= 0) taken.add(o.job.tgt);
  for (const d of P.actors) {
    if (d.team === a.team || d.wrap || d.down) continue;
    if (d.eng && d.eng.a !== a.id && d.eng.b !== a.id) continue;
    const s = hyp(d.x - aim.x, d.z - aim.z) + hyp(d.x - a.x, d.z - a.z) * 0.6 + (taken.has(d.id) ? 5 : 0) + (d.slot === 'S' ? 3 : 0);
    if (s < bs) { bs = s; best = d; }
  }
  return best ? best.id : -1;
}
function runBlock(P, a, j, anchor) {
  const hole = P.play.hole ? P.fieldPt(P.play.hole[0], P.play.hole[1]) : { x: 0, z: P.losZ + P.dir * 3 };
  if (j.tgt < 0 || A(P, j.tgt).wrap || A(P, j.tgt).down || (A(P, j.tgt).eng && A(P, j.tgt).eng.a !== a.id && A(P, j.tgt).eng.b !== a.id) || P.t - (j.pick || 0) > 0.6 && !a.eng) {
    j.pick = P.t;
    j.tgt = pickBlockTarget(P, a, anchor ? { x: anchor.x, z: anchor.z + P.dir * 2.5 } : { x: lerpX(a.x, hole.x, 0.5), z: P.losZ + P.dir * 1.5 });
  }
  const d = j.tgt >= 0 ? A(P, j.tgt) : null;
  if (!d) { goTo(a, hole.x, hole.z, 0.6, 0.4); return; }
  // get to the defender's far side (between him and the hole) so the push opens the lane
  const [nx, nz] = norm(hole.x - d.x, hole.z - d.z);
  const px = d.x - nx * 1.22, pz = d.z - nz * 1.22;
  goTo(a, px, pz, 1, 0.1);
  if (!d.eng && !a.eng && !(a.cool['e' + d.id] > 0) && hyp(d.x - a.x, d.z - a.z) < 1.5) engage(P, a, d, 'run', { push: [nx, nz] });
}
const lerpX = (a, b, t) => a + (b - a) * t;
function stalkBlock(P, a, j, tl) {
  // run downfield on the nearest corner and block him
  if (a.route && a.route.i < a.route.pts.length && tl < 0.5) { routeMove(P, a, tl); return; }
  if (j.tgt < 0 || A(P, j.tgt).wrap || A(P, j.tgt).down) {
    let best = null, bs = 1e9;
    for (const d of P.actors) {
      if (d.team === a.team || d.wrap || d.down) continue;
      if (d.eng && d.eng.a !== a.id && d.eng.b !== a.id) continue;
      const s = hyp(d.x - a.x, d.z - a.z) + (d.slot === 'S' ? 2 : 0) + (d.slot.startsWith('DL') ? 6 : 0);
      if (s < bs) { bs = s; best = d; }
    }
    j.tgt = best ? best.id : -1;
  }
  const d = j.tgt >= 0 ? A(P, j.tgt) : null;
  if (!d) { stand(a); return; }
  goTo(a, d.x, d.z - P.dir * 0.6, 1, 0.1);
  if (!d.eng && !a.eng && !(a.cool['e' + d.id] > 0) && hyp(d.x - a.x, d.z - a.z) < 1.5) engage(P, a, d, 'run', { push: [0, P.dir] });
}
function leadBlock(P, a, j, tl) {
  const car = P.ball.holder >= 0 ? A(P, P.ball.holder) : null;
  const hole = P.play.hole ? P.fieldPt(P.play.hole[0], P.play.hole[1]) : { x: 0, z: P.losZ + P.dir * 3 };
  if (tl < 0.7 || !car) { const at = P.fieldPt(-2.5, hole.x * P.dir * 0.5); goTo(a, at.x, at.z, 0.8, 0.3); return; }
  if (j.tgt < 0 || A(P, j.tgt).wrap || A(P, j.tgt).down) j.tgt = pickBlockTarget(P, a, { x: hole.x, z: hole.z });
  const d = j.tgt >= 0 ? A(P, j.tgt) : null;
  if (!d) { goTo(a, car.x, car.z + P.dir * 2, 0.9, 0.3); return; }
  goTo(a, d.x, d.z - P.dir * 0.7, 1, 0.1);
  if (!d.eng && !a.eng && !(a.cool['e' + d.id] > 0) && hyp(d.x - a.x, d.z - a.z) < 1.5) engage(P, a, d, 'run', { push: [0, P.dir] });
}

// --- the ball carrier ----------------------------------------------------------------------------------------------------------------------------
function humanMove(P, a, dt) {
  const I = P.intent;
  const m = Math.min(1, hyp(I.mx, I.mz));
  const [nx, nz] = norm(I.mx, I.mz);
  const sp = a.spd * (a.burst > 0 ? 1.14 : 1) * (a.slow > 0 ? 0.72 : 1) * (a.hasBall ? 0.97 : 1) * (0.35 + 0.65 * Math.min(1, m * 1.25));
  a.dvx = nx * sp; a.dvz = nz * sp;
  a.faceTo = null;
  void dt;
}
function carryMove(P, a, dt) {
  const j = a.job, team = a.team, gd = attackDir(team);
  if (a.human && a.stick) { humanMove(P, a, dt); return; }
  // candidate directions fan out around "toward the goal"
  let bestAng = 0, bestS = -1e9;
  const sp = a.spd * (a.burst > 0 ? 1.14 : 1);
  const hole = j.hole && P.carrierTeam === P.off && j.t < (j.hold || 1.2) ? P.fieldPt(j.hole[0], j.hole[1]) : null;
  const lastAng = a.lastAng ?? 0;
  for (let k = -5; k <= 5; k++) {
    const ang = (k * 14 * Math.PI) / 180;
    // direction: rotate "up the field" by ang (positive = toward +x for gd>0)
    const dx = Math.sin(ang), dz = Math.cos(ang) * gd;
    let score = 0;
    for (const L of [2.5, 5, 8]) {
      const px = a.x + dx * L, pz = a.z + dz * L;
      const tme = L / sp;
      let pen = 0;
      for (const d of P.actors) {
        if (d.team === team || d.wrap || d.down) continue;
        if (d.eng) continue;
        const dd = hyp(d.x - px, d.z - pz);
        const reach = (hyp(d.x - a.x, d.z - a.z) > 14 ? 0 : 1) * dd / Math.max(3, d.spd * 0.92);
        const margin = tme + 0.25 - reach;
        if (margin > 0) pen += margin * (L === 2.5 ? 2.6 : L === 5 ? 1.8 : 1.1);
        if (dd < 1.1) pen += 1.5;
      }
      score -= pen;
      if (Math.abs(px) > FIELD.HALF - 0.9) score -= (Math.abs(px) - (FIELD.HALF - 0.9)) * 1.4;
    }
    score += dz * gd * 3.2 * 1;           // gain ground
    score -= Math.abs(ang) * 0.55;
    score -= Math.abs(ang - lastAng) * 0.9;
    if (hole) { const ha = Math.atan2(hole.x - a.x, (hole.z - a.z) * gd); score -= Math.abs(ang - ha) * 1.7; }
    if (score > bestS) { bestS = score; bestAng = ang; }
  }
  a.lastAng = lastAng * 0.55 + bestAng * 0.45;
  const dx = Math.sin(a.lastAng), dz = Math.cos(a.lastAng) * gd;
  a.dvx = dx * sp; a.dvz = dz * sp;
  a.faceTo = null;
  // the computer's runner juking and spinning
  const lv = LEVELS[a.lvl];
  let thr = null, td = 9;
  for (const d of P.actors) { if (d.team === team || d.wrap || d.down) continue; const dd = hyp(d.x - a.x, d.z - a.z); if (dd < td) { td = dd; thr = d; } }
  if (thr && td < 2.4 && a.cool.juke <= 0 && !a.human) {
    const closing = (thr.x - a.x) * (a.vx - thr.vx) + (thr.z - a.z) * (a.vz - thr.vz) > 0;
    if (closing && P.rng.next() < dt * 4.5 * (0.5 + a.elude) * (0.5 + lv.dec * 0.6)) {
      if (P.rng.next() < 0.35 && !(a.cool.spin > 0)) doSpin(P, a);
      else { const side = Math.sign(thr.x - a.x) || 1; doJuke(P, a, -side); }
    }
  }
  void j;
}

// --- defence ---------------------------------------------------------------------------------------------------------------------------------------
function rushJob(P, a, tl) {
  const j = a.job;
  const qb = P.ball.holder >= 0 && P.ball.holder !== a.id && A(P, P.ball.holder).team === P.off ? A(P, P.ball.holder) : P.actors[P.off * 7];
  const tx = qb.x + (j.lane || 0) * 0.15 * P.dir, tz = qb.z;
  goTo(a, tx, tz, 1, 0.12);
  a.faceTo = null;
}
function manJob(P, a, tl) {
  const j = a.job;
  const rec = offOf(P, j.on);
  if (!rec) { stand(a); return; }
  // track him as he was a moment ago (reaction time), a little behind and inside
  const dl = delayed(rec, a.react * 0.9);
  const cush = Math.max(0.45, 1.5 - tl * 0.6) * (1.05 - a.cover * 0.3);
  const tx = dl.x + rec.vx * 0.12, tz = dl.z + P.dir * cush;
  const d = goTo(a, tx, tz, 0.97 + a.cover * 0.03, 0.2);
  // while backing off, keep facing the quarterback
  const qb = P.actors[P.off * 7];
  a.faceTo = tl < 1.0 && d > 0.8 && (tz - a.z) * P.dir > 0.5 ? { x: qb.x, z: qb.z } : null;
}
function zoneJob(P, a, tl) {
  const j = a.job;
  // receivers inside the zone: shadow the closest one; otherwise stay at the zone's centre
  let best = null, bd = j.r + 1.2;
  for (const r of P.actors) {
    if (r.team === a.team || r.slot === 'C' || r.slot === 'G' || r.slot === 'QB') continue;
    if (r.job && r.job.k === 'block' && r.job.mode !== 'screen') continue;
    const d = hyp(r.x - j.cx, r.z - j.cz);
    if (d < bd) { bd = d; best = r; }
  }
  if (best) {
    const dl = delayed(best, a.react * 0.9);
    goTo(a, dl.x, dl.z + P.dir * 1.2, 0.92, 0.2);
  } else goTo(a, j.cx, j.cz, 0.7 + (tl < 1.2 ? 0.2 : 0), 0.3);
  const qb = P.actors[P.off * 7];
  a.faceTo = tl < 1.3 && (j.cz - a.z) * P.dir > 0.5 ? { x: qb.x, z: qb.z } : null;
}
function deepJob(P, a, tl) {
  const j = a.job;
  // stay deeper than the deepest receiver in the area and drift toward the side with the most receivers
  let deepest = -1e9, side = 0, n = 0;
  for (const r of P.actors) {
    if (r.team === a.team || r.slot === 'C' || r.slot === 'G' || r.slot === 'QB') continue;
    if (Math.abs(r.x - j.cx) > 11) continue;
    const u = P.U(r.z); if (u > deepest) { deepest = u; }
    if (u > 6) { side += r.v; n++; }
  }
  const baseU = P.U(j.cz);
  const wantU = Math.max(baseU, deepest + 3.5 - 0.0);
  const tv = j.cx !== undefined ? (n ? lerpX(P.V(j.cx), side / n, 0.55) : P.V(j.cx)) : 0;
  const pt = P.fieldPt(Math.min(wantU, 34), clamp(tv, -11, 11));
  goTo(a, pt.x, pt.z, 0.88, 0.3);
  const qb = P.actors[P.off * 7];
  a.faceTo = tl < 1.6 && (pt.z - a.z) * P.dir > 0.5 ? { x: qb.x, z: qb.z } : null;
}
function fillJob(P, a, tl) {
  const j = a.job;
  goTo(a, j.cx, j.cz, 0.95, 0.3);
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// blocks: engagements
// ---------------------------------------------------------------------------------------------------------------------------------------
function engage(P, B, R, mode, o = {}) {
  const base = mode === 'pass' ? 2.1 : 2.0;
  let hold = clamp(base + 4.2 * (B.str - R.str) + (P.rng.next() - 0.5) * 1.4, 0.45, 6);
  if (R.job && R.job.k === 'fill') hold *= 0.55;                       // defenders crowding the line shed blocks quickly
  if (P.play.draw && mode === 'run') hold *= 2.2;
  const pr = { a: B.id, b: R.id, mode, t0: P.t, hold, push: o.push || null, ang: Math.atan2(R.x - B.x, R.z - B.z) };
  B.eng = pr; R.eng = pr; P.pairs.push(pr);
  emit(P, 'block', { blocker: B.id, rusher: R.id, mode });
}
function disengage(P, pr, rusherWins) {
  const B = A(P, pr.a), R = A(P, pr.b);
  B.eng = null; R.eng = null;
  P.pairs = P.pairs.filter((x) => x !== pr);
  B.cool['e' + R.id] = 2.5; R.cool['e' + B.id] = 2.5;
  if (rusherWins) { R.burst = Math.max(R.burst, 0.7); B.stumble = 0.35; B.job = B.job && B.job.k === 'block' ? { ...B.job, tgt: -1, pick: P.t + 0.5 } : B.job; emit(P, 'shed', { rusher: R.id, blocker: B.id, mode: pr.mode }); }
  else { R.slow = 0.4; if (!P.dead) emit(P, "shed", { rusher: R.id, blocker: B.id, mode: pr.mode, blockerWon: true }); }
}
function engagedMove(P, a) {
  const pr = a.eng;
  const B = A(P, pr.a), R = A(P, pr.b);
  const isR = a.id === R.id;
  const qbT = P.ball.holder >= 0 ? A(P, P.ball.holder) : P.actors[P.off * 7];
  if (isR) {
    // the defender strains toward his goal at a fraction of his speed
    const gx = pr.mode === 'pass' ? qbT.x : R.x, gz = pr.mode === 'pass' ? qbT.z : R.z + P.dir * 0;
    const [nx, nz] = norm(gx - R.x, gz - R.z);
    const f = pr.mode === 'pass' ? 0.2 : 0.12;
    a.dvx = nx * a.spd * f * (1 + (R.str - B.str) * 0.8) ; a.dvz = nz * a.spd * f * (1 + (R.str - B.str) * 0.8);
    if (pr.mode === 'run' && pr.push) { a.dvx = pr.push[0] * 0.9; a.dvz = pr.push[1] * 0.9; }
    a.faceTo = { x: B.x, z: B.z };
  } else {
    // the blocker keeps his body between the defender and the target and drives
    const [nx, nz] = pr.mode === 'run' && pr.push ? pr.push : norm(qbT.x - R.x, qbT.z - R.z);
    const tx = R.x - nx * 1.22, tz = R.z - nz * 1.22;
    goTo(a, tx, tz, 1, 0.1);
    a.faceTo = { x: R.x, z: R.z };
  }
}
function stepEngagements(P, dt) {
  for (const pr of [...P.pairs]) {
    const B = A(P, pr.a), R = A(P, pr.b);
    if (B.wrap || R.wrap || B.down || R.down) { B.eng = R.eng = null; P.pairs = P.pairs.filter((x) => x !== pr); continue; }
    pr.hold -= dt;
    // the blocker may no longer have anything to do once the ball is gone (pass play: still holds)
    if (pr.hold <= 0) disengage(P, pr, true);
    else if (pr.mode === 'run' && P.dead) disengage(P, pr, false);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// tackles
// ---------------------------------------------------------------------------------------------------------------------------------------
function stepTackles(P, dt) {
  // wraps in progress
  for (const w of [...P.wraps]) {
    const C = A(P, w.carrier), D = A(P, w.tackler);
    const s = P.t - w.t0;
    // the carrier slows to a stop, the tackler stays on him
    const k = clamp(1 - s / 0.6, 0, 1);
    C.dvx = w.v0x * k; C.dvz = w.v0z * k; C.faceTo = null;
    const tx = C.x + w.ox, tz = C.z + w.oz;
    D.dvx = (tx - D.x) * 9 + C.vx; D.dvz = (tz - D.z) * 9 + C.vz;
    const dl = hyp(D.dvx, D.dvz); if (dl > 9) { D.dvx *= 9 / dl; D.dvz *= 9 / dl; }
    D.faceTo = { x: C.x, z: C.z };
    if (!w.down && s >= T.TACKLE_DOWN) {
      w.down = true; C.down = true; D.down = true; C.wrap = D.wrap = null;
      C.dvx = C.dvz = D.dvx = D.dvz = 0; C.vx *= 0.1; C.vz *= 0.1; D.vx *= 0.1; D.vz *= 0.1;
      P.wraps = P.wraps.filter((x) => x !== w);
      emit(P, 'down', { carrier: C.id, tackler: D.id, x: C.x, z: C.z, sack: w.sack });
      if (!P.dead) { const spot = { x: C.x, z: C.z }; ball_down(P, C, spot, w.sack); }
    }
  }
  if (P.dead) return;
  // attacks in progress resolve when their time comes
  for (const d of P.actors) {
    if (!d.attack) continue;
    const at = d.attack, h = A(P, at.tgt);
    if (P.t < at.tc - 1e-9) continue;
    d.attack = null;
    if (!h.hasBall || h.wrap || h.down || d.wrap || d.down) continue;
    const dd = hyp(d.x - h.x, d.z - h.z);
    if (dd <= (at.dive ? 1.9 : 1.5)) attemptTackle(P, d, h, dd, at.dive);
    else { d.stumble = 0.55; d.slow = 0.4; emit(P, 'missTackle', { tackler: d.id, carrier: h.id, far: true }); }
  }
  if (P.dead || P.kick) return;
  // new tackle attempts on the ball carrier
  const h = P.ball.holder >= 0 ? A(P, P.ball.holder) : null;
  if (!h || !h.hasBall || h.wrap || h.down) return;
  if (h.slot === 'QB' && h.q && (h.q.mode === 'got')) return;
  for (const d of P.actors) {
    if (d.team === h.team || d.wrap || d.down || d.stumble > 0.25 || d.attack) continue;
    if (d.cool['t' + h.id] > 0) continue;
    const dd = hyp(d.x - h.x, d.z - h.z);
    // the computer's defenders dive at a runner who is about to get past them
    if (!d.human && !d.eng && dd < 2.3 && dd > 1.05 && !(d.cool.lunge > 0) && P.rng.next() < dt * 12 * (0.35 + 0.65 * d.dec)) {
      const closing0 = (h.x - d.x) * (d.vx - h.vx) + (h.z - d.z) * (d.vz - h.vz) > 0;
      if (closing0) { startAttack(P, d, h, true); continue; }
    }
    const reach = d.eng ? 0.95 : 1.05;
    if (dd > reach) continue;
    const closing = (h.x - d.x) * (d.vx - h.vx) + (h.z - d.z) * (d.vz - h.vz) > -0.3;
    if (d.eng && !closing) continue;
    d.cool['t' + h.id] = 0.55;
    startAttack(P, d, h, false);
  }
}
function attackMove(P, a) {
  const at = a.attack, h = A(P, at.tgt);
  const rem = Math.max(0.05, at.tc - P.t);
  // go where he will be at contact
  const tx = h.x + h.vx * rem, tz = h.z + h.vz * rem;
  const dx = tx - a.x, dz = tz - a.z, d = hyp(dx, dz);
  const sp = Math.min(a.spd * 1.2, d / rem);
  a.dvx = (dx / (d || 1)) * sp; a.dvz = (dz / (d || 1)) * sp;
  a.faceTo = { x: h.x, z: h.z };
}
function attemptTackle(P, d, h, dd, dive) {
  d.cool['t' + h.id] = 0.55;
  let p = 0.76 + 0.5 * (d.tackle - h.elude * 0.95) + (dive ? 0.05 : 0) + (d.fillRole ? 0.1 : 0);
  // approach angle: head-on and from the side are good, from behind at a distance is a reach
  const hv = hyp(h.vx, h.vz);
  if (hv > 0.5) { const cx = (d.x - h.x) / (dd || 1), cz = (d.z - h.z) / (dd || 1); const cosA = (cx * h.vx + cz * h.vz) / hv; p += 0.05 * cosA; if (cosA < -0.3) p -= 0.18 * (1 - dd / 1.5); }
  if (h.evade > 0) p -= h.spinT > 0 ? 0.38 : 0.46;
  if (d.eng) p *= 0.4;
  const spdFrac = hv / Math.max(1, h.spd);
  if (spdFrac > 0.92 && !dive) p -= 0.08;
  p = clamp(p, 0.07, 0.95);
  if (P.rng.next() < p) startWrap(P, d, h, dd);
  else { d.stumble = 0.5 + P.rng.next() * 0.3; d.slow = 0.4; emit(P, 'missTackle', { tackler: d.id, carrier: h.id, dive: !!dive }); }
}
function startWrap(P, d, h, dd) {
  const hv = hyp(h.vx, h.vz);
  const hx = hv > 0.4 ? h.vx / hv : Math.sin(h.face), hz = hv > 0.4 ? h.vz / hv : Math.cos(h.face);
  // which side of the carrier the tackler is on (left = +x when the carrier faces +z)
  const lx = hz, lz = -hx;
  const rel = (d.x - h.x) * lx + (d.z - h.z) * lz;
  const side = rel >= 0 ? 1 : -1;
  const sack = h.slot === 'QB' && P.qbHeld && P.carrierTeam === P.off && P.U(h.z) < 0.5 && !P.afterCatch && !h.q?.ran;
  // the tackler ends up beside and a little behind the carrier, wrapping the waist
  const ox = lx * side * 1.08 - hx * 0.3, oz = lz * side * 1.08 - hz * 0.3;
  const w = { carrier: h.id, tackler: d.id, t0: P.t, tc: P.t, side, hx, hz, v0x: h.vx, v0z: h.vz, ox, oz, sack, down: false };
  h.wrap = w; d.wrap = w; d.attack = null;
  h.eng = null; if (d.eng) { const pr = d.eng; d.eng = null; const o = A(P, pr.a === d.id ? pr.b : pr.a); o.eng = null; P.pairs = P.pairs.filter((x) => x !== pr); }
  if (h.eng) { const pr = h.eng; h.eng = null; const o = A(P, pr.a === h.id ? pr.b : pr.a); o.eng = null; P.pairs = P.pairs.filter((x) => x !== pr); }
  P.wraps.push(w);
  // fumble?
  const pf = (0.012 + 0.035 * (d.tackle - 0.5) + (h.slot === 'QB' ? 0.012 : 0) + (P.afterCatch ? 0.004 : 0)) * (hv > 6 ? 1.3 : 1);
  w.fumble = P.rng.next() < pf;
  emit(P, 'tackle', { tackler: d.id, carrier: h.id, side, hx, hz, tc: w.tc, fumble: w.fumble, sack, dd, x: h.x, z: h.z });
  if (w.fumble) {
    const spot = carryPoint(h);
    dropLoose(P, spot.x, spot.y, spot.z, 'fumble');
    P.ball.vx = hx * 1.5 + (P.rng.next() - 0.5) * 1.5; P.ball.vz = hz * 1.5 + (P.rng.next() - 0.5) * 1.5;
    emit(P, 'fumble', { who: h.id });
    h.hasBall = false;
  }
  // the play is dead as soon as the carrier is down (unless the ball is loose)
}
function ball_down(P, C, spot, sack) {
  if (P.ball.st === 'loose') return;
  endPlay(P, sack ? 'sack' : 'tackle', spot);
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// after movement: separation, boundaries, scoring
// ---------------------------------------------------------------------------------------------------------------------------------------
function separate(P) {
  const L = P.actors;
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j];
    if (a.down || b.down) continue;
    if (a.eng && a.eng === b.eng) continue;
    if (a.wrap && a.wrap === b.wrap) continue;
    const dx = b.x - a.x, dz = b.z - a.z, d = hyp(dx, dz);
    const min = a.team === b.team ? 0.9 : 1.0;
    if (d < min && d > 1e-4) {
      const push = (min - d) * 0.5;
      const wa = a.eng ? 0.35 : 1, wb = b.eng ? 0.35 : 1, ws = wa + wb;
      a.x -= (dx / d) * push * 2 * wa / ws; a.z -= (dz / d) * push * 2 * wa / ws;
      b.x += (dx / d) * push * 2 * wb / ws; b.z += (dz / d) * push * 2 * wb / ws;
    } else if (d <= 1e-4) { a.x -= 0.02; b.x += 0.02; }
  }
}

function afterMove(P, dt, tl) {
  if (P.dead) return;
  const b = P.ball;
  const h = b.holder >= 0 ? A(P, b.holder) : null;
  if (h && h.hasBall && !h.down) {
    // touchdown
    const gz = goalZ(h.team);
    if ((h.team === 0 && h.z >= gz) || (h.team === 1 && h.z <= gz)) { P.scorer = h.id; endPlay(P, 'td', { x: h.x, z: h.z }); return; }
    // out of bounds
    if (Math.abs(h.x) > FIELD.HALF) { endPlay(P, 'oob', { x: clamp(h.x, -FIELD.HALF, FIELD.HALF), z: h.z }); return; }
    // sideline/back line behind own goal (safety): carrier runs out of his own end zone
    const og = ownGoalZ(h.team);
    if ((h.team === 0 && h.z < FIELD.EZ - FIELD.EZ) || (h.team === 1 && h.z > FIELD.TOTAL)) { endPlay(P, 'tackle', { x: h.x, z: h.z }); return; }
    if (P.carrierTeam === P.off && !P.turnover && P.U(h.z) < P.gain.minU) P.gain.minU = P.U(h.z);
    void og;
  }
  if (b.st === 'loose' && Math.abs(b.x) > FIELD.HALF + 1) endPlay(P, 'loose-oob');
}

export function endPlay(P, reason, spot) {
  if (P.dead) return;
  P.dead = true; P.deadReason = reason; P.deadT = P.t; P.spot = spot || (P.ball.holder >= 0 ? { x: A(P, P.ball.holder).x, z: A(P, P.ball.holder).z } : { x: P.ball.x, z: P.ball.z });
  emit(P, 'whistle', { reason, spot: P.spot });
  for (const pr of [...P.pairs]) disengage(P, pr, false);
  for (const a of P.actors) { a.job = a.hasBall ? a.job : a.job; }
  if (reason === 'td') for (const a of P.actors) if (a.team === A(P, P.scorer).team && a.id !== P.scorer) a.job = { k: 'idle' };
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// the result of a finished play
// ---------------------------------------------------------------------------------------------------------------------------------------
function finish(P) {
  const reason = P.deadReason;
  const ballTeam = P.carrierTeam;
  const off = P.off;
  let res = { reason, turnover: false, td: false, safety: false, yards: 0, clockStop: false, secs: Math.round(P.t - P.tLive), score: [0, 0], text: '', passer: P.passTarget };
  const spot = P.spot || { x: 0, z: P.losZ };
  const spotU = P.U(spot.z);
  if (P.kick) { P.result = { kind: 'kick', reason, type: P.kick.type, good: P.kick.good, spot, spotU, secs: Math.round(P.t - P.tLive), turnover: false, td: false, clockStop: false, yards: 0, ballTeam: P.off, thrown: false }; P.phase = 'done'; return; }
  if (reason === 'incomplete' || reason === 'loose-oob') {
    if (P.ball.st === 'loose' || reason === 'loose-oob') {
      // a fumble out of bounds / unrecovered: spot where it went loose, offence keeps it
      res.yards = Math.round(P.U(P.looseSpot ? P.looseSpot.z : spot.z));
    }
    res.clockStop = true; res.text = 'Incomplete pass';
    res.kind = 'incomplete';
  } else if (reason === 'td') {
    res.td = true; res.scorer = P.scorer; res.scoringTeam = ballTeam; res.clockStop = true; res.kind = 'td';
    res.turnover = ballTeam !== off;
    res.text = 'Touchdown';
  } else {
    res.kind = reason === 'sack' ? 'sack' : reason === 'oob' ? 'oob' : P.turnover ? 'turnover' : P.play.kind;
    res.turnover = ballTeam !== off;
    res.clockStop = reason === 'oob';
    if (!res.turnover) {
      res.yards = Math.round(spotU);
      // safety: downed in own end zone
      if (P.U(spot.z) < -P.los) { res.safety = true; res.kind = 'safety'; }
    } else {
      // the new offence takes over where the ball carrier was downed
      res.newYl = Math.round(ylOf(ballTeam, spot.z));
      if (res.newYl < 1) res.newYl = 8;     // downed in his own end zone: touchback at the 8
    }
  }
  res.spot = spot; res.spotU = spotU;
  res.ballTeam = ballTeam;
  res.passDepth = P.thrown ? Math.round(P.U(P.ball.fly ? P.ball.fly.z1 : spot.z)) : 0;
  res.recId = P.thrown ? P.passTarget : -1;
  res.fumbleLost = P.events.some((e) => e.type === 'fumble') && res.turnover;
  res.int = P.events.some((e) => e.type === 'intercept');
  res.sack = reason === 'sack';
  res.completed = P.events.some((e) => e.type === 'catch' && e.kind === 'pass');
  res.thrown = P.thrown;
  P.result = res;
  P.phase = 'done';
}
