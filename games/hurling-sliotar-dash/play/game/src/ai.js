// Computer players. Every decision goes through the same sim commands a human uses (startStrike, startPass, startRise, startHook),
// so the AI plays by exactly the same rules and timing. `decideFor` builds the same decision with a plain-language reason: Think hints
// and Watch & Learn read it, so what the coach says is what the computer really weighs.
import { HW, HL, GOAL_HW, HOME, SWEET, SOLO_PERIOD } from './consts.js';
import { clamp, wrapAng, fwd, yawOf } from './util.js';

const goalZ = (team) => (team === 0 ? HL : -HL);
const dirOf = (team) => (team === 0 ? 1 : -1);
const MARK = [5, 4, 3, 2, 1];            // which opposing role each of roles 1..5 marks (index = own role - 1)
const MARK_OF = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };
const fmt = (n) => Math.round(n);

function valueAt(x, z, team) {
  const dg = Math.hypot(x, goalZ(team) - z);
  return 0.05 + 0.75 * Math.pow(clamp(1 - dg / 20, 0, 1), 1.3);
}
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-6;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
function nearestOpp(S, x, z, team, skipGk = false) {
  let best = null, bd = 1e9;
  for (const q of S.P) { if (q.team === team || (skipGk && q.role === 0)) continue; const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = q; } }
  return { q: best, d: bd };
}
const anchorOf = (S, p) => {
  const s = S.s, B = S.B, a = dirOf(p.team);
  const bz = B.z * a;                      // ball z in team coordinates (+ = towards the goal we attack)
  const h = HOME[p.role];
  const hold = B.holder >= 0 ? S.P[B.holder].team : (B.lastTeam);
  const att = hold === p.team ? 1 : 0;
  let zt = h[1], x = h[0];
  if (p.role === 0) { zt = -HL + 1.1; x = clamp(B.x * a * 0.14, -1.6, 1.6); }
  else if (p.role === 1 || p.role === 2) { zt = clamp(h[1] + bz * 0.28 + att * 1.5, -12, -3); x = h[0] * 0.9 + clamp(B.x * a * 0.12, -1.4, 1.4); }
  else if (p.role === 3) { zt = clamp(bz * 0.72 + att * 1.5, -7, 8); x = clamp(B.x * a * 0.5, -4, 4); }
  else if (p.role === 4) { zt = clamp(bz * 0.55 + 3.5 + att * 1.5, -3, 11); x = h[0] + clamp(B.x * a * 0.2, -2, 2); }
  else { zt = clamp(bz * 0.4 + 7 + att * 1.5, 1, 12); x = h[0] + clamp(B.x * a * 0.2, -1.8, 1.8); }
  return { x: x * a, z: zt * a };
};

function setMove(p, tx, tz, sprint) { p.ai.tx = clamp(tx, -HW + 0.4, HW - 0.4); p.ai.tz = clamp(tz, -HL + 0.4, HL - 0.4); p.ai.sprint = !!sprint; }

export function aiTick(S, p, dt, idle = false) {
  const ai = p.ai, s = S.s;
  if (s.hold === null && ai.pending && !p.act) { const d = ai.pending; ai.pending = null; execute(S, p, d); }
  if (idle) { const a = anchorOf(S, p); setMove(p, a.x, a.z, false); }
  else if (!p.act && s.phase !== 'dead') {
    if (p.role === 0 && s.phase === 'play' && S.B.holder < 0 && keeperSave(S, p)) return;
    if (s.phase === 'play' && blockDownCheck(S, p)) return;
    ai.cd -= dt;
    if (ai.cd <= 0 && !ai.pending) { think(S, p); ai.cd = S.lvlOf(p).react * (0.75 + 0.5 * S.A.next()) + 0.03; }
  }
  const dx = ai.tx - p.x, dz = ai.tz - p.z, d = Math.hypot(dx, dz);
  if (d < 0.3 || p.act) { ai.dvx = ai.dvz = 0; ai.dmag = 0; }
  else { ai.dvx = dx / d; ai.dvz = dz / d; ai.dmag = clamp(d / 1.6, 0.25, 1); }
}

function think(S, p) {
  const s = S.s, B = S.B;
  if (s.phase === 'restart') return restartThink(S, p);
  if (s.phase !== 'play') { const a = anchorOf(S, p); setMove(p, a.x, a.z, false); return; }
  if (S.hasBall(p)) return carrierThink(S, p);
  if (p.role === 0) return keeperThink(S, p);
  const h = S.holder();
  if (h && h.team !== p.team) return defendThink(S, p, h);
  if (h && h.team === p.team) return supportThink(S, p, h);
  return looseThink(S, p);
}

// ---- restarts ------------------------------------------------------------------------------------------
function restartThink(S, p) {
  const s = S.s, r = s.restart, B = S.B;
  if (!r) return;
  const a = anchorOf(S, p);
  if (r.kind === 'puckout') {
    if (p.id === r.taker) {
      if (!p.human && r.t > 1.0 + 1.5 * (1 - S.skillOf(p)) && S.hasBall(p)) return execute(S, p, puckDecision(S, p));
      setMove(p, p.x, p.z, false); return;
    }
    // everyone spreads to their puck-out positions; the other side waits in its own half
    const side = p.team === r.team ? 0 : 1;
    let zt = side === 0 ? [0, -7, -7, -1, 3, 7][p.role] : [0, -5.5, -5.5, -1.5, 1.5, 5.5][p.role];
    if (side === 1) zt = Math.max(zt, [0, -6, -6, -1, 1, 4][p.role]);
    const x = [0, -3.2, 3.2, 0, -2.6, 2.6][p.role] * dirOf(p.team);
    setMove(p, x, zt * dirOf(p.team), false);
    return;
  }
  if (r.kind === 'free') {
    if (p.id === r.taker) {
      if (!p.human && r.t > 1.0 + 1.5 * (1 - S.skillOf(p))) {
        if (S.hasBall(p)) return carrierThink(S, p);
        const d = Math.hypot(B.x - p.x, B.z - p.z);
        const dg = Math.hypot(B.x, goalZ(p.team) - B.z);
        if (d < 3 && S.loosePick(p)) {
          if (dg < 18 && p.role >= 3) { const D = shootDecision(S, p, true); return execute(S, p, D); }
          return void S.startRise(p);
        }
        setMove(p, B.x, B.z - dirOf(p.team) * 1.0, false);
      } else setMove(p, B.x - dirOf(p.team) * 0.9, B.z, false);
      return;
    }
    // others keep clear of the ball (opponents by 5 m) and take attacking positions
    let tx = a.x, tz = a.z;
    if (p.team !== r.team && Math.hypot(tx - B.x, tz - B.z) < 6.5) { const dx = tx - B.x || 0.1, dz = tz - B.z || 0.1, l = Math.hypot(dx, dz); tx = B.x + dx / l * 7; tz = B.z + dz / l * 7; }
    setMove(p, tx, tz, false);
  }
}

// ---- goalkeeper ----------------------------------------------------------------------------------------
function blockDownCheck(S, p) {
  const lv = S.lvlOf(p);
  for (const q of S.P) {
    const a = q.act;
    if (q.team === p.team || !a || a.kind !== 'strike' || a.variant !== 'hand' || a.ok !== null || S.s.t > a.tc - 0.2 || a['bd' + p.id]) continue;
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    if (d > 2.7 || d < 0.5) continue;
    a['bd' + p.id] = true;
    if (!S.A.chance(lv.aggr * (0.25 + 0.5 * S.skillOf(p)))) continue;
    if (S.startHook(p, {})) return true;
  }
  return false;
}
function keeperSave(S, p) {          // every tick: a fast ball heading for the goal
  const B = S.B, gz = p.team === 0 ? -HL : HL;
  // anticipation: a rival winding up a strike near the goal gives the keeper a read on where it is going
  for (const q of S.P) {
    const a = q.act;
    if (q.team === p.team || !a || a.kind !== 'strike' || a.gkSeen || S.s.t > a.tc - 0.02) continue;
    if (Math.abs(q.z - gz) > 10) continue;
    a.gkSeen = true;
    const sk = S.skillOf(p);
    if (!S.A.chance(0.35 + 0.6 * sk)) continue;
    const dz = gz - q.z, xg = q.x + dz * (a.aim.x / (a.aim.z || 1e-6)) * (Math.sign(a.aim.z) === Math.sign(dz) ? 1 : 0);
    const guess = clamp(xg, -GOAL_HW, GOAL_HW) + S.A.range(-1, 1) * (0.9 * (1 - sk) + 0.3);
    const fl = Math.abs(dz) / (a.style === 'drive' ? 30 : 17);
    const Tt = clamp(a.tc - S.s.t + fl * 0.85, 0.24, 1.2);
    const lat = Math.abs(guess - p.x);
    if (S.startHook(p, lat < 1.0 ? { Tt } : { dive: true, dx: guess, dz: p.z, Tt })) return true;
  }
  if (B.mode !== 'free') return false;
  const sp = Math.hypot(B.vx, B.vz);
  if (sp < 6 || Math.sign(B.vz) !== Math.sign(gz)) return false;
  const T = (gz - B.z) / B.vz;
  if (T < 0.2 || T > 0.3 + 0.55 * S.skillOf(p)) return false;
  const pr = S.predictFree(T);
  if (Math.abs(pr.x) > GOAL_HW + 1 || pr.y > 3.2) return false;
  const lat = Math.abs(pr.x - p.x);
  if (lat < 1.0) return S.startHook(p, {});
  if (lat < 2.6 && T > 0.28) return S.startHook(p, { dive: true, dx: pr.x, dz: p.z });
  return false;
}
function keeperThink(S, p) {
  const s = S.s, B = S.B, a = dirOf(p.team), gz = p.team === 0 ? -HL : HL;
  const lv = S.lvlOf(p);
  if (B.mode === 'free' && B.holder < 0) {
    const sp = Math.hypot(B.vx, B.vz);
    // a loose ball in or near the small rectangle: collect it
    const inBox = Math.abs(B.z - gz) < 3.5 && Math.abs(B.x) < 4;
    if (inBox && sp < 6) {
      if (S.loosePick(p) && Math.hypot(B.x - p.x, B.z - p.z) < 2.6) { S.startRise(p); return; }
      if (sp < 2.5) { setMove(p, B.x - fwdx(p) * 0.3, B.z, true); return; }
    }
  }
  const h = S.holder();
  const car = h && h.team !== p.team ? h : null;
  let tx = clamp(B.x * 0.14, -1.2, 1.2), tz = gz - gz / HL * 1.0 + a * 0;
  tz = p.team === 0 ? -HL + 1.1 : HL - 1.1;
  if (car && Math.abs(car.z - gz) < 8) { tx = clamp(car.x * 0.35, -2, 2); tz = gz + (p.team === 0 ? 1 : -1) * clamp(8 - Math.abs(car.z - gz), 0, 2) * 0.5 + (p.team === 0 ? 1.1 : -1.1) * 0; }
  setMove(p, tx, tz, false);
  void lv;
}
const fwdx = (p) => fwd(p.face).x;

// ---- the ball is loose ---------------------------------------------------------------------------------
function timeToBall(S, q, at) { return Math.hypot(at.x - q.x, at.z - q.z) / (5.8 * S.speedOf(q)) + (q.act ? 0.4 : 0) + (q.stun > 0 ? q.stun : 0); }
function looseThink(S, p) {
  const s = S.s, B = S.B;
  const at = S.predictFree(0.55);
  let best = -1, bt = 1e9;
  for (const q of S.P) {
    if (q.team !== p.team) continue;
    if (q.role === 0 && Math.abs(B.z - (q.team === 0 ? -HL : HL)) > 8) continue;
    const t = timeToBall(S, q, at) + (q.human ? -0.15 : 0) - (B.intended === q.id ? 0.5 : 0);
    if (t < bt) { bt = t; best = q.id; }
  }
  // the best opponent decides whether we must hurry
  let ot = 1e9;
  for (const q of S.P) if (q.team !== p.team) ot = Math.min(ot, timeToBall(S, q, at));
  if (best !== p.id) {
    // second chaser when the opponent is closer than our best
    const a = anchorOf(S, p);
    setMove(p, a.x, a.z, false);
    return;
  }
  // intercept point: first time the player can be there
  let tgt = { x: B.x, z: B.z }, T = 0;
  for (T = 0.15; T <= 2.6; T += 0.15) { const pr = S.predictFree(T); if (Math.hypot(pr.x - p.x, pr.z - p.z) / (5.9 * S.speedOf(p)) <= T && pr.y < 1.2) { tgt = pr; break; } tgt = pr; }
  const d = Math.hypot(B.x - p.x, B.z - p.z);
  const sprint = d > 4 && p.stam > 0.25;
  const sk = S.skillOf(p), dg = Math.hypot(B.x, goalZ(p.team) - B.z);
  if (S.loosePick(p) && d < 2.4 && S.canAct(p)) {
    const attacking = dg < 14 && S.A.chance(0.35 + 0.3 * sk);
    const defending = Math.abs(B.z - (p.team === 0 ? -HL : HL)) < 12 && nearestOpp(S, B.x, B.z, p.team).d < 5 && S.A.chance(0.5);
    if (attacking || defending) { const D = attacking ? shootDecision(S, p, true) : clearDecision(S, p); return execute(S, p, D); }
    S.startRise(p); return;
  }
  // a fast low ball: first-time strike
  if (B.y < 1.4 && Math.hypot(B.vx, B.vz) >= 9 && d < 2.6 && S.canAct(p) && dg < 17 && S.A.chance(0.5 * sk)) return execute(S, p, shootDecision(S, p, true));
  setMove(p, tgt.x, tgt.z, sprint);
}

// ---- defending -------------------------------------------------------------------------------------------
function defendThink(S, p, car) {
  const s = S.s, B = S.B, a = dirOf(p.team), lv = S.lvlOf(p), sk = S.skillOf(p);
  const own = p.team === 0 ? -HL : HL;
  // nearest defender (not the keeper) presses the carrier
  let press = -1, bd = 1e9;
  for (const q of S.P) { if (q.team !== p.team || q.role === 0) continue; const d = Math.hypot(q.x - car.x, q.z - car.z) - (q.id === p.id ? 0.4 : 0); if (d < bd) { bd = d; press = q.id; } }
  if (press === p.id) {
    const d = Math.hypot(car.x - p.x, car.z - p.z);
    // stand goal-side of the carrier
    const gx = 0 - car.x, gzv = own - car.z, gl = Math.hypot(gx, gzv) || 1;
    const stand = d > 3 ? 0.4 : 1.1;
    setMove(p, car.x + gx / gl * stand + car.vx * 0.15, car.z + gzv / gl * stand + car.vz * 0.15, d > 5 && p.stam > 0.2);
    if (S.canAct(p) && d < 2.2) {
      const exposed = S.carrierExposed(car, s.t + 0.24);
      const seeSkill = S.A.chance(0.35 + 0.65 * sk);
      if (B.hs === 'bal' && exposed && seeSkill && d < 1.9 && car.burstT <= 0) { S.startHook(p, { target: car.id }); return; }
      if (d < 1.0 && S.A.chance(0.05 + 0.14 * lv.aggr)) { S.startHook(p, { target: car.id }); return; }
    }
    return;
  }
  // everyone else marks their man, goal side
  const mate = MARK_OF[p.role];
  if (mate) {
    const m = S.P[(1 - p.team) * 6 + mate];
    const gx = 0 - m.x, gzv = own - m.z, gl = Math.hypot(gx, gzv) || 1;
    const near = Math.hypot(m.x - B.x, m.z - B.z) < 14;
    const k = near ? 1.4 : 2.6;
    const an = anchorOf(S, p);
    const wA = 0.35 + 0.4 * lv.iq;
    setMove(p, (m.x + gx / gl * k) * wA + an.x * (1 - wA), (m.z + gzv / gl * k) * wA + an.z * (1 - wA), false);
  } else { const an = anchorOf(S, p); setMove(p, an.x, an.z, false); }
}

// ---- supporting the carrier ------------------------------------------------------------------------------
function supportThink(S, p, car) {
  const B = S.B, a = dirOf(p.team);
  const an = anchorOf(S, p);
  let tx = an.x, tz = an.z;
  const lv = S.lvlOf(p);
  if (p.role >= 3) {
    // find space: step away from the nearest opponent
    const o = nearestOpp(S, tx, tz, p.team);
    if (o.d < 4 && lv.iq > 0.3) { const dx = tx - o.q.x, dz = tz - o.q.z, l = Math.hypot(dx, dz) || 1; tx += dx / l * (4 - o.d) * lv.iq; tz += dz / l * (4 - o.d) * lv.iq * 0.6; }
    if (car.id !== p.id) { tx = clamp(tx, -HW + 3, HW - 3); }
  }
  setMove(p, tx, tz, Math.hypot(p.x - tx, p.z - tz) > 6 && p.stam > 0.4);
}

// ---- the carrier --------------------------------------------------------------------------------------------
function gkCover(S, p) {
  const gk = S.P[(1 - p.team) * 6];
  return gk;
}
function shotOdds(S, p, dg, sk) {
  const gk = gkCover(S, p);
  const gkOff = Math.abs(gk.x - clamp(p.x * (1 - 0.0), -GOAL_HW, GOAL_HW) * 0.2);
  const line = (q) => segDist(q.x, q.z, p.x, p.z, 0, goalZ(p.team));
  let blocked = 0;
  for (const q of S.P) { if (q.team === p.team) continue; if (q.role === 0) continue; const d = line(q); const dq = Math.hypot(q.x - p.x, q.z - p.z); if (d < 1.5 && dq > 1 && dq < dg) blocked = 1; }
  const pg = dg < 11 ? clamp((0.42 - 0.038 * dg) * (0.4 + 0.6 * sk) * (1 - 0.3 * (gkOff < 2 ? 1 : 0.3)) * (blocked ? 0.55 : 1) * 0.7, 0, 0.7) : 0;
  const pp = dg < 19 ? clamp((1.0 - dg / 19) * (0.3 + 0.62 * sk) * (blocked ? 0.8 : 1) * 0.6, 0, 0.9) : 0;
  return { pg, pp, blocked };
}
function shootDecision(S, p, fromGround = false) {
  const sk = S.skillOf(p), dg = Math.hypot(p.x, goalZ(p.team) - p.z);
  const o = shotOdds(S, p, dg, sk);
  const vg = 3 * o.pg + (1 - o.pg) * 0.1, vp = o.pp + (1 - o.pp) * 0.1;
  const goal = vg > vp * 1.02 && dg < 10;
  const aim = { x: 0 - p.x, z: goalZ(p.team) - p.z };
  const l = Math.hypot(aim.x, aim.z) || 1; aim.x /= l; aim.z /= l;
  const style = goal ? 'drive' : 'loft';
  const reason = goal
    ? `A low drive at the goal from ${fmt(dg)} m is worth 3 points; the keeper and backs can block it, so it needs a quick, clean strike. Estimated chance ${fmt(o.pg * 100)}%${o.blocked ? ', a rival is in the line' : ''}.`
    : `Over the bar from ${fmt(dg)} m is worth 1 point and is much harder to block. Estimated chance ${fmt(o.pp * 100)}% against ${fmt(o.pg * 100)}% for a goal${o.blocked ? ', and a rival is in the shooting line' : ''}.`;
  return { kind: 'shoot', style, aim, ground: fromGround, value: Math.max(vg, vp), summary: goal ? 'Drive at goal (3 points)' : 'Strike over the bar (1 point)', reason, odds: goal ? o.pg : o.pp };
}
function clearDecision(S, p) {
  const a = dirOf(p.team);
  const wide = p.x > 0 ? -1 : 1;
  const aim = { x: wide * 0.5, z: a * 0.85 }; const l = Math.hypot(aim.x, aim.z); aim.x /= l; aim.z /= l;
  return { kind: 'clear', style: 'loft', aim, value: 0.05, summary: 'Clear the ball upfield', reason: 'A rival is close to the ball in front of your own goal. A long strike up and away from the middle takes the danger out of the area.' };
}
function puckDecision(S, p) {
  const a = dirOf(p.team);
  // look for the teammate with the most room in the middle third
  let best = null, bs = -1;
  for (const q of S.P) {
    if (q.team !== p.team || q.role < 3) continue;
    const o = nearestOpp(S, q.x, q.z, p.team).d;
    const sc = o + (S.A.next() * 2) * (1 - S.lvlOf(p).iq);
    if (sc > bs) { bs = sc; best = q; }
  }
  const tx = best ? best.x : 0, tz = best ? best.z : a * 6;
  const aim = { x: tx - p.x, z: tz - p.z }; const l = Math.hypot(aim.x, aim.z) || 1; aim.x /= l; aim.z /= l;
  const range = Math.hypot(tx - p.x, tz - p.z);
  const f = clamp(0.45 + 0.55 * (range - 7) / 17, 0.5, 0.95);
  return { kind: 'puckout', style: 'loft', aim, f, noAssist: true, summary: 'Puck-out to the middle', reason: `The keeper strikes a long puck-out to the player with most space (${best ? fmt(nearestOpp(S, best.x, best.z, p.team).d) : 0} m from the nearest rival).` };
}
function carrierOptions(S, p) {
  const s = S.s, B = S.B, a = dirOf(p.team);
  const sk = S.skillOf(p), lv = S.lvlOf(p);
  const my = valueAt(p.x, p.z, p.team);
  const near = nearestOpp(S, p.x, p.z, p.team);
  const opts = [];
  // pass options
  for (const q of S.P) {
    if (q.team !== p.team || q.id === p.id) continue;
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    if (d < 2.2 || d > 12) continue;
    let lane = 9;
    for (const o of S.P) { if (o.team === p.team) continue; const sd = segDist(o.x, o.z, p.x, p.z, q.x, q.z); if (sd < lane) lane = sd; }
    const open = nearestOpp(S, q.x, q.z, p.team).d;
    const pc = clamp(0.88 - 0.023 * d - (lane < 1.5 ? 0.35 : 0) - (open < 2 ? 0.12 : 0), 0.1, 0.92) * (0.7 + 0.4 * sk);
    const lead = valueAt(q.x + q.vx * 0.8, q.z + q.vz * 0.8, p.team);
    opts.push({ kind: 'pass', to: q.id, value: pc * lead + (1 - pc) * 0.0, d, lane, open, pc, lead });
  }
  // solo
  const advance = valueAt(p.x, p.z + a * 5, p.team);
  const press = near.d < 2.4 ? (2.4 - near.d) * 0.1 : 0;
  opts.push({ kind: 'solo', value: advance * 0.93 - press - (p.role === 0 ? 0.3 : 0), near: near.d });
  // shoot
  const dg = Math.hypot(p.x, goalZ(p.team) - p.z);
  if ((goalZ(p.team) - p.z) * a > 0 && dg < 19 && p.role !== 0) opts.push({ ...shootDecision(S, p), kind: 'shoot' });
  return { opts, my, near, dg };
}
function carrierThink(S, p) {
  const D = decideFor(S, p, false);
  if (!D) return;
  // Watch & Learn asks for a freeze at real decisions
  if (S.s.cfg.hold && (D.kind === 'shoot' || D.kind === 'pass' || D.kind === 'puckout') && S.requestHold(p, D)) { p.ai.pending = D; return; }
  execute(S, p, D);
}

export function decideFor(S, p, explain) {
  const s = S.s, B = S.B, a = dirOf(p.team);
  const sk = S.skillOf(p), lv = S.lvlOf(p);
  if (!S.hasBall(p)) return explain ? thinkNoBall(S, p) : null;
  if (s.phase === 'restart' && s.restart && s.restart.kind === 'puckout' && p.role === 0) return puckDecision(S, p);
  if (p.role === 0) {
    // keeper in open play: clear
    return { ...puckDecision(S, p), kind: 'clear', summary: 'Clear the ball', reason: 'The keeper has the ball in open play: strike it long to a teammate with space.' };
  }
  const { opts, my, near, dg } = carrierOptions(S, p);
  // noise: weaker teams misjudge
  let best = null, bv = -1e9;
  for (const o of opts) { const v = o.value + S.A.range(-1, 1) * (1 - lv.iq) * 0.1; if (v > bv) { bv = v; best = o; } }
  if (!best) return null;
  if (best.kind === 'pass') {
    const q = S.P[best.to];
    const aim = { x: q.x - p.x, z: q.z - p.z };
    const l = Math.hypot(aim.x, aim.z) || 1; aim.x /= l; aim.z /= l;
    const ahead = (q.z - p.z) * a;
    return { kind: 'pass', to: q.id, aim, value: best.value, summary: `Hand-pass to number ${q.num}`,
      reason: `Number ${q.num} is ${fmt(best.d)} m away${ahead > 1 ? `, ${fmt(ahead)} m closer to the goal` : ''}, with the nearest rival ${fmt(best.open)} m from them${best.lane < 1.5 ? ' (a rival is close to the passing line)' : ' and a clear passing line'}. Estimated chance of the pass finding them ${fmt(best.pc * 100)}%.` };
  }
  if (best.kind === 'shoot') return best;
  // solo: run at the goal and away from the nearest rival
  let dx = 0 - p.x, dz = goalZ(p.team) - p.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  let rx = 0, rz = 0;
  for (const q of S.P) { if (q.team === p.team) continue; const ex = p.x - q.x, ez = p.z - q.z, d = Math.hypot(ex, ez); if (d < 5 && d > 0.1) { rx += ex / d / d * 2.2; rz += ez / d / d * 2.2; } }
  let ax = dx + rx, az = dz + rz; const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
  return { kind: 'solo', aim: { x: ax, z: az }, value: best.value, near: near.d, summary: 'Solo run: keep the ball bouncing on the hurley',
    reason: near.d < 3 ? `A rival is ${fmt(near.d)} m away. Run away from them, and remember the ball is exposed to a hook each time it bounces up; a burst of speed gives a short moment of safety.` : `No rival within ${fmt(near.d)} m: run towards the goal (${fmt(dg)} m away) and pass or strike once you are in range.` };
}

function thinkNoBall(S, p) {
  const s = S.s, B = S.B, a = dirOf(p.team);
  const h = S.holder();
  if (p.role === 0 && B.mode === 'free') return { kind: 'position', summary: 'Stay on your line, watch the ball', reason: 'Stay in the middle of the goal and move with the ball. When a strike comes, press SAVE: the stick covers about one metre either side, a dive about three.' };
  if (!h) {
    const d = Math.hypot(B.x - p.x, B.z - p.z);
    if (S.loosePick(p) && d < 3.4) return { kind: 'rise', summary: 'Rise the ball', reason: `The ball is loose ${fmt(d)} m from you and low: press RISE to flick it up onto your hurley before a rival gets there, or STRIKE to hit it first time.` };
    return { kind: 'chase', summary: 'Go for the ball', reason: `The ball is loose ${fmt(d)} m away. Run to where it will be, not where it is, then press RISE when it is close and slow.` };
  }
  if (h.team === p.team) {
    const an = anchorOf(S, p);
    return { kind: 'support', summary: 'Find space for a pass', reason: `Number ${h.num} has the ball. Move to open space about ${fmt(Math.hypot(an.x - p.x, an.z - p.z))} m from here, away from rivals, so they have a hand-pass option.`, x: an.x, z: an.z };
  }
  const d = Math.hypot(h.x - p.x, h.z - p.z);
  if (d < 2.6) return { kind: 'hook', summary: 'Hook when the ball bounces up', reason: `The rival ball is ${B.hs === 'bal' ? 'bouncing on the hurley about once a second' : 'in their hand'}. Press HOOK so the swing lands while the ball is high above the hurley (it is exposed for about half of each bounce); a hook while it sits on the hurley can be a foul.` };
  return { kind: 'mark', summary: 'Close down the carrier', reason: `The rival with the ball is ${fmt(d)} m away. Get goal-side of them and close in to about 2 m so you can hook when the ball bounces up.` };
}

// run a decision through the shared sim commands
export function execute(S, p, D) {
  const s = S.s, B = S.B;
  if (!D) return;
  if (D.kind === 'shoot' || D.kind === 'clear' || D.kind === 'puckout') {
    const sk = S.skillOf(p);
    const base = D.style === 'drive' ? SWEET.drive : SWEET.loft;
    const f = D.f != null ? D.f + S.A.range(-1, 1) * 0.08 * (1 - sk) : clamp(base + S.A.range(-1, 1) * 0.3 * (1 - sk), 0.02, 0.98);
    const style = f < 0.52 && D.style !== 'loft' ? 'drive' : D.style === 'drive' ? (f < 0.52 ? 'drive' : 'loft') : 'loft';
    const q = S.barQuality(style, f);
    if (S.startStrike(p, { style, f, aim: D.aim })) { p.act.q = q; p.act.noAssist = !!D.noAssist; }
    return;
  }
  if (D.kind === 'pass') { S.startPass(p, { aim: D.aim, tgt: D.to }); return; }
  if (D.kind === 'solo') {
    setMove(p, p.x + D.aim.x * 7, p.z + D.aim.z * 7, p.stam > 0.35 && (D.near || 9) > 2.2);
    p.ai.cd = Math.max(p.ai.cd, 0.25);
    if ((D.near || 9) < 2.0 && p.burstCd <= 0 && S.A.chance(0.25)) S.startBurst(p);
  }
}
