// The computer riders (both teams, and the team-mates of the human). One function per rider per tick: aiControl() returns a control record
// {mx, mz, mag, sprint, grab, pass, throwP}. Decisions are re-made every `react` seconds of the level; steering and the quick checks run each tick.
import { LEVELS, HL, HW, GOAL_R, DROP_R, GRAB_R, TUG_R, SPOTS, DT, G } from './consts.js';
import { goalCentre, landing, powerFor, solveThrow, rangeFor } from './phys.js';
import { clamp, hyp } from './util.js';

const norm = (x, z) => { const m = hyp(x, z) || 1; return { x: x / m, z: z / m }; };
const dirOf = (team) => (team === 0 ? 1 : -1);
export const spotFor = (team, role, n = 3) => {
  const sp = SPOTS[role < n ? role : n - 1];
  return team === 0 ? { x: sp.x, z: sp.z } : { x: -sp.x, z: -sp.z };
};

// Is the straight line from a to b clear of rivals of `team` (nearer than `w` m)?
export function laneClear(s, ax, az, bx, bz, team, w = 1.9) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
  for (const o of s.riders) {
    if (o.team === team) continue;
    const t = clamp(((o.x - ax) * dx + (o.z - az) * dz) / L2, 0, 1);
    if (hyp(o.x - (ax + dx * t), o.z - (az + dz * t)) < w) return false;
  }
  return true;
}
export function nearestRival(s, r, maxD = 99) {
  let best = null, bd = maxD;
  for (const o of s.riders) { if (o.team === r.team) continue; const d = hyp(o.x - r.x, o.z - r.z); if (d < bd) { bd = d; best = o; } }
  return best ? { r: best, d: bd } : null;
}
// Best team-mate to pass to. hint = a screen/field direction angle (the stick) or null.
export function bestPass(s, r, hint = null) {
  const dir = dirOf(r.team);
  let best = null, bs = -1e9;
  for (const m of s.riders) {
    if (m.team !== r.team || m.id === r.id) continue;
    const d = hyp(m.x - r.x, m.z - r.z);
    if (d < 3.2 || d > 26) continue;
    const gain = (m.x - r.x) * dir;
    const clear = laneClear(s, r.x, r.z, m.x + m.vx * 0.5, m.z + m.vz * 0.5, r.team);
    let near = 9; for (const o of s.riders) if (o.team !== r.team) near = Math.min(near, hyp(o.x - m.x, o.z - m.z));
    let score = gain * 0.45 + Math.min(near, 8) * 0.9 + (clear ? 5 : -6) - d * 0.12;
    if (hint != null) { let da = Math.atan2(m.z - r.z, m.x - r.x) - hint; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; score += (1 - Math.abs(da) / Math.PI) * 14 - Math.abs(da) * 4; }
    if (score > bs) { bs = score; best = { r: m, d, gain, clear, near, score }; }
  }
  return best;
}
// ETA ranking of a team to a point: lower rank = closer
function chaseRank(s, r, px, pz) {
  const mine = hyp(px - r.x, pz - r.z) + (r.act ? 1.5 : 0);
  let rank = 0;
  for (const m of s.riders) if (m.team === r.team && m.id !== r.id && hyp(px - m.x, pz - m.z) + (m.act ? 1.5 : 0) < mine - 0.01) rank++;
  return rank;
}

export function aiControl(s, r, rng) {
  const lvl = LEVELS[s.levels[r.team]];
  const dir = dirOf(r.team), ai = r.ai, b = s.ball;
  const out = { mx: 0, mz: 0, mag: 0, sprint: false, grab: false, pass: false, throwP: null };
  if (s.phase !== 'play') return out;
  ai.t -= DT;
  const replan = ai.t <= 0;
  if (replan) ai.t = lvl.react * (0.75 + 0.5 * rng.next());
  const atk = goalCentre(r.team), def = goalCentre(1 - r.team);
  const carrier = s.carrier >= 0 ? s.riders[s.carrier] : null;
  const call = s.call[r.team], tac = s.tactic[r.team];
  let tx = r.x, tz = r.z, mag = 1, sprint = false;

  if (r.carry) {
    // ---- carrying: ride at the circle, dodge rivals, pass when it is better, throw from the chosen distance -------------------
    const dg = hyp(atk.x - r.x, atk.z - r.z);
    if (ai.pick !== r.pickId) { ai.pick = r.pickId; ai.thr = lvl.range * (0.55 + 0.45 * rng.next()); }
    const nr = nearestRival(s, r, 7);
    const pressured = nr && nr.d < 2.6;
    let sx = atk.x - r.x, sz = atk.z - r.z;
    const g = norm(sx, sz); sx = g.x; sz = g.z;
    for (const o of s.riders) {
      if (o.team === r.team) continue;
      const ox = o.x - r.x, oz = o.z - r.z, d = hyp(ox, oz);
      if (d > 8 || d < 0.01) continue;
      if (ox * g.x + oz * g.z < -1.2) continue;               // behind us: ignore (only the tug matters)
      const w = (6 / (d + 1)) * (0.6 + lvl.speed * 0.4);
      sx -= (ox / d) * w * 0.55; sz -= (oz / d) * w * 0.55;
    }
    // keep off the boards
    if (r.z > HW - 3) sz -= 0.8; if (r.z < -HW + 3) sz += 0.8;
    const n = norm(sx, sz); tx = r.x + n.x * 10; tz = r.z + n.z * 10;
    sprint = (nr && nr.d < 5 && r.stam > 0.2) || (dg > 14 && r.stam > 0.55);
    // throw
    if (r.pickT > 0.35 && r.chargeLock <= 0) {
      if (dg <= DROP_R * 0.92 && Math.hypot(r.vx, r.vz) < 5.8) out.throwP = powerFor(dg);
      else if (dg <= ai.thr * (pressured ? 1.35 : 1) && r.pickT > 0.6) {
        // the level's skill: a length error proportional to the distance and a sideways error, both Gaussian-ish
        const gs = () => rng.next() + rng.next() + rng.next() - 1.5;
        const ux = (atk.x - r.x) / dg, uz = (atk.z - r.z) / dg;
        const sp = 0.75 + 0.35 * Math.hypot(r.vx, r.vz) / 9;
        const eL = gs() * 2 * lvl.aim * dg * sp, eS = gs() * 2 * lvl.lat * (dg / 10) * sp;
        const sol = solveThrow(r.x, r.z, r.vx, r.vz, atk.x + ux * eL - uz * eS, atk.z + uz * eL + ux * eS);
        out.throwP = clamp(sol.p, 0, 1); out.throwAng = sol.ang;
      }
    }
    // pass
    if (out.throwP == null && replan && r.pickT > 0.7 && r.passCool <= 0) {
      const bp = bestPass(s, r, null);
      if (bp && bp.clear && bp.gain > 2.5) {
        const want = lvl.pass * (call === 0 ? 1.25 : 0.6) * (pressured ? 2.2 : 0.55) * (tac === 0 ? 1.1 : 1);
        if (rng.next() < want * 0.5) { out.pass = true; out.passTo = bp.r.id; }
      }
    }
  } else if (carrier && carrier.team === r.team) {
    // ---- a team-mate has the ball: support, block, stay available -----------------------------------------------------
    const c = carrier;
    if (call === 1 && r.role === 0) {
      const nr = nearestRival(s, c, 9);
      if (nr) { tx = c.x + (nr.r.x - c.x) * 0.45; tz = c.z + (nr.r.z - c.z) * 0.45; } else { tx = c.x + dir * 3; tz = c.z; }
    } else if (r.role === 0) { tx = c.x + dir * (7 + (tac === 0 ? 3 : 0)); tz = c.z * 0.35; }
    else if (r.role === 1) { tx = c.x + dir * 3.5; tz = (c.z * dir > 0 ? -HW * 0.5 : HW * 0.5) * dir; }
    else if (r.role === 3) { tx = c.x + dir * 1.5; tz = (c.z * dir > 0 ? -5 : 5) * dir; }
    else { tx = c.x - dir * (8 - (tac === 0 ? -3 : tac === 2 ? 3 : 0)); tz = -c.z * 0.4; }
    tx = clamp(tx, -HL + 2, HL - 2); tz = clamp(tz, -HW + 2, HW - 2);
    const d = hyp(tx - r.x, tz - r.z); mag = clamp(d / 5, 0.15, 1); sprint = d > 11 && r.stam > 0.4;
  } else if (carrier) {
    // ---- a rival has the ball: two close down and tug, the rest guard the circle --------------------------------------
    const c = carrier;
    const rank = chaseRank(s, r, c.x, c.z);
    const nChase = tac === 0 ? 3 : 2;
    if (rank < nChase) {
      const lead = 0.35;
      tx = c.x + c.vx * lead; tz = c.z + c.vz * lead;
      const d = hyp(tx - r.x, tz - r.z);
      sprint = d > 3 && r.stam > 0.15;
      if (hyp(c.x - r.x, c.z - r.z) < TUG_R * 0.9 && r.tugCool <= 0 && !r.act && replan && rng.next() < 0.85) out.grab = true;
      mag = 1;
    } else {
      const dgc = hyp(c.x - def.x, c.z - def.z);
      const k = Math.min(7, dgc * 0.45), n = norm(c.x - def.x, c.z - def.z);
      tx = def.x + n.x * k; tz = def.z + n.z * k + (r.role === 3 ? 3 : r.role === 1 ? -3 : 0) * dir;
      if (tac === 2) { tx = def.x + n.x * 4; tz = def.z + n.z * 4; }
      tx = clamp(tx, -HL + 1.5, HL - 1.5); tz = clamp(tz, -HW + 1.5, HW - 1.5);
      const d = hyp(tx - r.x, tz - r.z); mag = clamp(d / 4, 0.1, 1); sprint = d > 9 && r.stam > 0.4;
      if (hyp(c.x - r.x, c.z - r.z) < TUG_R * 0.9 && r.tugCool <= 0 && !r.act && replan && rng.next() < 0.7) out.grab = true;   // guards pull too when he rides by
    }
  } else {
    // ---- the ball is loose or flying -------------------------------------------------------------------------------------
    const lp = landing(b);
    const px = b.owner === -1 && lp.air ? lp.x : b.x + b.vx * 0.25, pz = b.owner === -1 && lp.air ? lp.z : b.z + b.vz * 0.25;
    const rank = chaseRank(s, r, px, pz);
    const nChase = tac === 0 ? 2 : tac === 2 ? 1 : (r.role === 2 ? 1 : 2);
    if (rank < Math.max(1, nChase)) {
      tx = px; tz = pz;
      const d = hyp(tx - r.x, tz - r.z), speed = hyp(r.vx, r.vz);
      mag = d < 7 ? clamp(0.42 + (d - 1.2) / 8, 0.42, 1) : 1;
      sprint = d > 11 && r.stam > 0.3;
      const bd = hyp(b.x - r.x, b.z - r.z);
      if (!r.act && r.grabCool <= 0 && bd < GRAB_R * 0.85 && b.y < 1.1 && speed < 6.8 + lvl.catch && b.owner === -1) { if (replan || bd < GRAB_R * 0.5) out.grab = rng.next() < 0.5 + lvl.catch * 0.5; }
    } else {
      const sp = spotFor(r.team, r.role, s.size);
      const shift = clamp(b.x * 0.5, -14, 14) + (tac === 0 ? dir * 3 : tac === 2 ? -dir * 3 : 0);
      tx = clamp(sp.x + shift, -HL + 3, HL - 3); tz = clamp(sp.z * 0.9 + b.z * 0.25, -HW + 2, HW - 2);
      const d = hyp(tx - r.x, tz - r.z); mag = clamp(d / 4, 0.1, 1); sprint = d > 12 && r.stam > 0.45;
    }
  }
  // steering: toward the target, slowing in on it
  const dx = tx - r.x, dz = tz - r.z, d = hyp(dx, dz);
  if (d > 0.35) {
    const n = norm(dx, dz);
    out.mx = n.x; out.mz = n.z; out.mag = mag * clamp(d / 1.2, 0.2, 1);
  }
  out.sprint = sprint;
  // keep inside the boards
  return out;
}

// What a good rider would do now, for the human's controlled rider: used by the Think hint and by Watch & Learn.
export function advise(s, r) {
  const dir = dirOf(r.team), atk = goalCentre(r.team);
  const b = s.ball;
  if (s.phase !== 'play') return { kind: 'ready', title: 'Get set', text: 'The ball is set in the middle. Ride to it and grab it before the rivals do.', marks: [{ x: 0, z: 0, label: 'ball' }] };
  const carrier = s.carrier >= 0 ? s.riders[s.carrier] : null;
  if (r.carry) {
    const dg = hyp(atk.x - r.x, atk.z - r.z), need = powerFor(dg);
    const nr = nearestRival(s, r, 99), bp = bestPass(s, r, null);
    if (dg <= DROP_R) return { kind: 'throw', title: 'Drop it in', text: 'You are at the circle. Hold THROW a moment and let go: the ball drops into the pit.', marks: [{ x: atk.x, z: atk.z, label: 'circle' }], power: need };
    if (nr && nr.d < 3 && bp && bp.clear && bp.gain > 1.5) return { kind: 'pass', title: 'Pass now', text: 'A rival is right on you. Pass to the open team-mate marked here, then keep riding to support.', marks: [{ x: bp.r.x, z: bp.r.z, label: 'pass here', id: bp.r.id }] };
    if (dg <= rangeFor(1).d * 0.45) return { kind: 'throw', title: 'Throw for the circle', text: `The circle is ${Math.round(dg)} m away. Hold THROW and release when the landing ring sits inside the circle (about ${Math.round(need * 100)}% charge).`, marks: [{ x: atk.x, z: atk.z, label: 'circle' }], power: need };
    return { kind: 'carry', title: 'Carry it forward', text: 'Ride toward the far circle and steer round the rivals; sprint to break away, but watch your stamina. Throw when you are about 12 m out.', marks: [{ x: atk.x, z: atk.z, label: 'circle' }] };
  }
  if (carrier && carrier.team !== r.team) {
    const d = hyp(carrier.x - r.x, carrier.z - r.z);
    if (d <= TUG_R) return { kind: 'tug', title: 'Tug it away', text: 'A rival is carrying the ball and you are alongside. Press GRAB to pull it away: it works best when you are fresh and riding the same way.', marks: [{ x: carrier.x, z: carrier.z, label: 'rival', id: carrier.id }] };
    return { kind: 'chase', title: 'Close him down', text: 'A rival has the ball. Ride alongside him (sprint if you need to) and then press GRAB when the ring turns green.', marks: [{ x: carrier.x, z: carrier.z, label: 'rival', id: carrier.id }] };
  }
  if (carrier) {
    const bp = null; void bp;
    return { kind: 'support', title: 'Make yourself available', text: 'Your team-mate has the ball. Ride ahead and to the open side so he can pass to you.', marks: [{ x: clamp(carrier.x + dir * 6, -HL + 2, HL - 2), z: -carrier.z * 0.5, label: 'ride here' }] };
  }
  const lp = landing(b);
  const d = hyp(b.x - r.x, b.z - r.z), speed = hyp(r.vx, r.vz);
  if (d < GRAB_R && b.y < 1.2) return { kind: 'grab', title: speed > 6.8 ? 'Ease off, then grab' : 'Grab it now', text: speed > 6.8 ? 'You are very fast: slow a little so the lift is clean, then press GRAB.' : 'The ball is in reach (the ring is green). Press GRAB to lean down and lift it.', marks: [{ x: b.x, z: b.z, label: 'ball' }] };
  return { kind: 'chase', title: 'Ride to the ball', text: 'The ball is loose. Ride to it, easing off as you arrive, and press GRAB when the ring turns green.', marks: [{ x: lp.x, z: lp.z, label: 'ball' }] };
}
void GOAL_R; void G;
