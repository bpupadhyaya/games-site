// Decisions of the computer players (and of the Think coach): serve, set, attack, block, plus formations. Pure functions of the sim state `s`.
// Every decision returns { choice, reason } where `reason` is built from the numbers it actually used, so Think and Watch & Learn can explain it.
import { HW, HL, ATK, SETS, SET_IDS, SHOTS, SERVES, TECH, BR, PELVIS_Y } from './consts.js';
import { clamp } from './util.js';
import { W, dirOf, latOf, latSign, depthOf, receivePos, slotPos, serverPos, typeOfId, heightScale, solveClear } from './model.js';
import { isMB, isOH } from './consts.js';

export const onCourt = (s, team) => s.players.filter((p) => p.team === team && p.onCourt);
export const frontRow = (s, team) => onCourt(s, team).filter((p) => p.front);
export const backRow = (s, team) => onCourt(s, team).filter((p) => !p.front);

// Which hitting lane each front-row player owns: 'L' left (team-left), 'M' middle, 'R' right, 'S' = the setter's own spot.
// Costs prefer outside hitters on the left, middles in the centre and the opposite on the right.
const LANE_PREF = {
  L: { 1: 0, 4: 0, 3: 1, 2: 2, 5: 2, 0: 3 },
  M: { 2: 0, 5: 0, 1: 1, 4: 1, 3: 2, 0: 3 },
  R: { 3: 0, 1: 1, 4: 1, 2: 2, 5: 2, 0: 3 },
};
export function assignLanes(s, team) {
  const fr = frontRow(s, team);
  const lanes = {};
  const setter = fr.find((p) => p.tp === 0);
  let rest = fr.filter((p) => p !== setter);
  if (setter) lanes[setter.id] = 'S';
  const slots = setter ? ['L', 'M'] : ['L', 'M', 'R'];
  // choose the cheapest assignment of the remaining front-row players to the open lanes
  const perms = (arr) => (arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map((r) => [x, ...r])));
  let best = null;
  for (const perm of perms(rest)) {
    let c = 0;
    perm.forEach((p, i) => { c += LANE_PREF[slots[i]][p.tp] ?? 3; });
    if (!best || c < best.c) best = { c, perm };
  }
  if (best) best.perm.forEach((p, i) => { lanes[p.id] = slots[i]; });
  return lanes;
}
export const LANE_LAT = { L: 3.5, M: 0.2, R: -3.5, S: -1.4 };

// ---- positions ---------------------------------------------------------------------------------------------------------------------
// The formation for an `intent`: 'serveTeam', 'receive', 'offense', 'defense', 'cover'. Returns a map pid -> {x, z}.
export function homeSpots(s, team, intent, x = {}) {
  const out = {};
  const tm = s.teams[team];
  const fr = frontRow(s, team), bk = backRow(s, team);
  const lanes = assignLanes(s, team);
  const lat0 = x.lat ?? 0;       // expected attack lane of the other team (in THEIR lateral frame -> flipped by the caller)
  for (const p of onCourt(s, team)) {
    const slot = p.slot;
    let w = null;
    if (intent === 'receive') w = receivePos(team, slot, p.tp);
    else if (intent === 'serveTeam') {
      const [lat, d] = [[0, 0], [-3.4, 1.8], [0, 1.8], [3.4, 1.8], [3.0, 5.8], [0.2, 6.4]][slot] || [0, 5];
      w = slot === 0 ? serverPos(team, p.srvLat ?? -2.4) : W(team, lat, d);
    } else if (intent === 'defense') {
      if (p.front) {
        // blockers wait at the net, spread across the three lanes, shifted a little to where the attack is expected
        const lane = lanes[p.id];
        const base = lane === 'L' ? 3.0 : lane === 'M' ? 0.1 : lane === 'R' ? -3.0 : -1.4;
        w = W(team, clamp(base * 0.9 + lat0 * 0.12, -HW + 0.4, HW - 0.4), lane === 'S' ? 2.6 : 0.8);
      } else {
        const lib = p.tp === 6;
        const sl = [(-3.0), 0, 0, 0, 3.0, 0][slot];
        const lat = slot === 0 ? -3.1 : slot === 4 ? 3.1 : 0.0;
        w = W(team, clamp(lat + lat0 * 0.28, -HW + 0.5, HW - 0.5), slot === 5 ? (lib ? 6.0 : 6.3) : 6.2);
        void sl;
      }
    } else if (intent === 'offense') {
      if (p.front) {
        const lane = lanes[p.id];
        if (lane === 'S') w = W(team, -1.4, 1.3);
        else w = W(team, LANE_LAT[lane] + (lane === 'L' ? 0.6 : lane === 'R' ? -0.6 : 0), 3.6);
      } else {
        const lat = slot === 0 ? -2.8 : slot === 4 ? 2.8 : 0.0;
        w = W(team, lat, slot === 5 ? 6.6 : 6.2);
      }
    } else if (intent === 'cover') {
      const c = x.hitter;
      if (c && p.id !== c.id) {
        const k = onCourt(s, team).filter((q) => q.id !== c.id).indexOf(p);
        const ang = [-1.2, -0.45, 0.45, 1.2, 0][k] ?? 0;
        w = { x: clamp(c.x + Math.sin(ang) * 3.0 * -dirOf(team) * 0 + [-2.4, -1.0, 1.0, 2.4, 0][k] * 1, -HW + 0.4, HW - 0.4), z: -dirOf(team) * clamp(depthOf(team, c.z) + [3.0, 4.2, 4.2, 3.0, 5.5][k], 2.5, HL - 1) };
      }
    }
    if (w) out[p.id] = w;
  }
  void tm; void bk;
  return out;
}

// ---- serve ---------------------------------------------------------------------------------------------------------------------------
// Aim at the weakest receiver (or the gap between two) and choose the serve. `p` is the server.
export function chooseServe(s, p, rnd, opts = {}) {
  const opp = 1 - p.team;
  const iq = opts.iq ?? s.teams[p.team].iq;
  const rec = onCourt(s, opp).filter((q) => !q.front || q.tp !== 0);
  const passers = onCourt(s, opp).filter((q) => q.tp !== 0 && !q.front).map((q) => ({ q, v: q.st.pass }));
  passers.sort((a, b) => a.v - b.v);
  const weak = passers[0];
  const lib = onCourt(s, opp).find((q) => q.tp === 6);
  // a good server picks the weakest passer; a weaker one picks a safe deep zone
  let tgt, why;
  if (iq > 0.45 && weak) {
    tgt = { x: weak.q.x + (rnd.next() - 0.5) * 0.8, z: weak.q.z + dirOf(opp) * 0.6 * 0 };
    why = `${weak.q.tp === 6 ? 'the libero' : 'their ' + codeOf(weak.q.tp)} is their weakest passer (${Math.round(weak.v * 100)}), so serve there`;
    if (lib && weak.q === lib) why = 'their libero is the weakest passer in that rotation';
  } else {
    tgt = W(opp, (rnd.next() - 0.5) * 6, 7.2);
    why = 'a deep serve into the open court is safest';
  }
  const bigLead = false;
  const jumpOk = p.st.srv >= 0.58 && iq > 0.4;
  const type = jumpOk && rnd.next() < 0.45 + 0.35 * (p.st.srv - 0.58) / 0.42 ? 'jump' : 'float';
  const x = clamp(tgt.x, -HW + 0.6, HW - 0.6);
  const z = clamp(tgt.z, 1.5, HL - 0.7) * 1;
  const zz = -dirOf(opp) * clamp(Math.abs(tgt.z) + 0.3, 4.2, HL - 0.8);
  void z; void bigLead; void rec;
  return { choice: { type, aim: { x, z: zz } }, reason: why + (type === 'jump' ? '. A jump serve brings more pace.' : '. A float serve keeps the ball in play.') };
}
const codeOf = (tp) => (tp === 0 ? 'setter' : tp === 3 ? 'opposite' : tp === 6 ? 'libero' : isMB(tp) ? 'middle' : 'outside hitter');

// ---- set ---------------------------------------------------------------------------------------------------------------------------
// Block presence at lateral position `lat` (in the ATTACKING team's frame, team-left positive) from the defenders' current net positions.
export function blockPresence(s, defTeam, atkTeam, latA) {
  let pr = 0;
  for (const q of frontRow(s, defTeam)) {
    const bx = q.x;                                   // world x of the potential blocker
    const lx = latOf(atkTeam, bx);
    const reach = q.tp === 0 ? 0.55 : 1.0;
    pr += reach * q.st.blk * Math.exp(-Math.pow((lx - latA) / 1.5, 2)) * (isMB(q.tp) ? 1.2 : 1);
  }
  return pr;
}
// Choose where the setter sends the ball. `inQ` = quality of the incoming pass (0..1). Returns { choice: {target, attackerId}, reason, scores }.
export function chooseSet(s, team, setter, inQ, rnd, opts = {}) {
  const opp = 1 - team;
  const iq = opts.iq ?? s.teams[team].iq;
  const lanes = assignLanes(s, team);
  const hitters = onCourt(s, team).filter((p) => p.id !== setter.id && p.tp !== 6);
  const opts_ = [];
  for (const p of hitters) {
    const lane = lanes[p.id];
    if (p.front && lane && lane !== 'S') {
      const tgt = lane === 'L' ? 'outside' : lane === 'M' ? 'middle' : 'right';
      if (tgt === 'middle' && inQ < 0.55) continue;                   // a quick set needs a good pass
      opts_.push({ target: tgt, p, lane });
    } else if (!p.front && p.st.att > 0.35 && inQ >= 0.5) {
      opts_.push({ target: 'pipe', p, lane: 'B' });                 // a back-row hitter attacks from behind the 3 m line
    }
  }
  if (!opts_.length) { const p = hitters.find((q) => q.front) || hitters[0]; if (p) opts_.push({ target: 'outside', p, lane: 'L' }); }
  const tcSet = opts.tcSet ?? s.t + 0.7;
  const scores = opts_.map((o) => {
    const S = SETS[o.target];
    const lat = S.lat;
    // can the hitter get to the take-off spot in time?
    const spot = W(team, S.lat, S.depth);
    const tup = Math.sqrt(2 * Math.max(0.2, o.p.st.jump) / 9.81);
    const tAvail = Math.max(0, tcSet + S.T - 0.04 - tup - 0.06 - s.t - (o.p.user ? 0 : o.p.st.react));
    const dd = Math.hypot(o.p.x - spot.x, o.p.z - spot.z);
    const slack = o.p.st.spd * 1.1 * tAvail + 0.5 - dd;
    const pres = blockPresence(s, opp, team, lat);
    const att = o.p.st.att * (isMB(o.p.tp) ? 1.0 : 1) + (o.target === 'middle' ? 0.12 : 0) + (o.target === 'right' ? 0.04 : 0);
    const tempo = o.target === 'middle' ? 0.25 : o.target === 'pipe' ? 0.12 : 0;
    const poorPass = inQ < 0.45 && o.target !== 'outside' ? -0.35 : 0;
    const quality = 0.30 + 0.55 * att + tempo + poorPass - 0.55 * pres;
    return { ...o, pres, att, slack, score: quality + (slack < 0 ? -4 + slack : 0) };
  });
  // a front-row setter can dump when the blockers are off or the pass is tight and the other side has a weak middle
  const dumpOk = setter.front && inQ >= 0.55 && opts_.length > 0;
  let dumpScore = -9;
  if (dumpOk) { const lat = latOf(team, setter.x); const pres = blockPresence(s, opp, team, lat); dumpScore = -0.12 + (1 - iq) * -0.5 + (0.5 - Math.min(1, pres)) * 0.5 + (iq > 0.6 ? 0.06 : 0); if (setter.st.set < 0.5) dumpScore -= 0.3; }
  scores.sort((a, b) => b.score - a.score);
  if (!scores.length || scores[0].slack < -0.3) { if (!opts.noOver) return { choice: { target: 'over', attackerId: setter.id }, reason: 'No hitter can get into position in time, so send the second ball over the net.', scores }; }
  const temp = (1 - iq) * 0.45 + 0.02;
  let pick = scores[0];
  if (scores.length > 1) {
    const w = scores.map((x) => Math.exp((x.score - scores[0].score) / temp));
    let r = rnd.next() * w.reduce((a, b) => a + b, 0), i = 0;
    for (; i < w.length - 1; i++) { r -= w[i]; if (r <= 0) break; }
    pick = scores[i];
  }
  let choice = { target: pick.target, attackerId: pick.p.id };
  let reason;
  const pct = (v) => Math.round(clamp(v, 0, 1.5) * 100);
  const best = pick;
  const names = { outside: 'the outside hitter on the left', middle: 'the middle with a quick set', right: 'the right-side hitter', pipe: 'the back-row hitter (a pipe)' };
  const others = scores.filter((x) => x !== best);
  const worst = others.length ? others[others.length - 1] : null;
  reason = `Set ${names[best.target]}: the other team's block there is ${best.pres < 0.4 ? 'thin' : best.pres < 0.9 ? 'light' : 'strong'} (${pct(best.pres)}%)`;
  if (worst && worst.pres > best.pres + 0.15) reason += `, while on the ${worst.target === 'outside' ? 'left' : worst.target === 'right' ? 'right' : worst.target === 'middle' ? 'middle' : 'back'} it is ${pct(worst.pres)}%`;
  reason += '.';
  if (inQ < 0.45) reason = 'The pass was loose, so set the safe high outside ball. ' + (best.target === 'outside' ? '' : '');
  if (dumpOk && dumpScore > best.score - 0.1 && iq > 0.3 && rnd.next() < clamp(0.05 + 0.35 * (dumpScore - (best.score - 0.1) + 0.2), 0, 0.5)) {
    choice = { target: 'dump', attackerId: setter.id };
    reason = 'Dump: the blockers are leaning away, so push the second ball over the net.';
  }
  return { choice, reason, scores };
}

// ---- attack ---------------------------------------------------------------------------------------------------------------------------
// Pick a shot and a landing spot. `C` the contact point, `blockers` the defenders' planned blocks [{x, h}] (may be empty).
export function chooseAttack(s, team, hitter, C, blockers, rnd, opts = {}) {
  const opp = 1 - team;
  const iq = opts.iq ?? s.teams[team].iq;
  const defs = onCourt(s, opp).filter((q) => !q.front || !blockers.some((b) => b.id === q.id));
  const grid = [];
  const lats = [-3.6, -2.7, -1.8, -0.9, 0, 0.9, 1.8, 2.7, 3.6];
  const deps = [2.4, 3.6, 5.0, 6.4, 7.6];
  const cD = Math.abs(C.z);
  const pw = SHOTS.power.speed * (0.80 + 0.20 * hitter.st.pow);
  for (const lat of lats) for (const dp of deps) {
    const target = { x: lat, z: -dirOf(opp) * dp };
    const t3 = { x: target.x, y: BR, z: target.z };
    const dist = Math.hypot(t3.x - C.x, t3.z - C.z, C.y - BR);
    const sol = solveClear(C, t3, Math.max(0.28, dist / pw), s.netH, 0.08);
    const v = dist / sol.T;
    const k = cD / (cD + dp);
    const xn = C.x + (lat - C.x) * k;
    let blk = 0;
    for (const b of blockers) blk = Math.max(blk, Math.exp(-Math.pow((xn - b.x) / 0.62, 2)) * b.w);
    let best = 9;
    for (const q of defs) best = Math.min(best, Math.hypot(q.x - lat, q.z - target.z) - (q.st.spd * Math.max(0, sol.T - q.st.react) + 0.55));
    const edge = Math.max(0, Math.abs(lat) - (HW - 0.95)) * 1.4 + Math.max(0, dp - (HL - 1.2)) * 1.4;
    const shot = v >= 16.5 ? 'power' : v >= 10.5 ? 'roll' : 'tip';
    grid.push({ lat, dp, target, blk, dig: clamp(best, -2, 4), edge, v, shot, T: sol.T, score: clamp(best, -2, 4) * 0.5 - blk * 1.6 - edge + clamp((v - 8) / 14, 0, 1) * 1.1 + (shot === 'tip' ? -0.2 : 0) });
  }
  grid.sort((a, b) => b.score - a.score);
  const temp = (1 - iq) * 0.7 + 0.04;
  let i = 0;
  { const w = grid.slice(0, 8).map((g) => Math.exp((g.score - grid[0].score) / temp)); let r = rnd.next() * w.reduce((a, b) => a + b, 0); for (; i < w.length - 1; i++) { r -= w[i]; if (r <= 0) break; } }
  const g = grid[i];
  let shot = g.shot;
  if ((opts.stretch ?? 0) > 0.4 || hitter.st.att < 0.3) shot = shot === 'power' ? 'roll' : shot;
  if (hitter.tp === 6) shot = 'tip';
  const blockedLane = blockers.length ? Math.max(...blockers.map((b) => b.w)) : 0;
  const where = `${Math.abs(g.lat) < 1.2 ? 'down the middle' : (g.lat * latSign(team) < 0 ? 'to their left' : 'to their right')}${g.dp > 6 ? ' deep' : g.dp < 3.2 ? ' short' : ''}`;
  const xn = C.x + (g.lat - C.x) * (cD / (cD + g.dp));
  let reason;
  if (blockers.length && blockedLane > 0.5) reason = `They have ${blockers.length === 1 ? 'one blocker' : blockers.length + ' blockers'} up, so hit ${where}: the ball passes ${Math.abs(blockers[0].x - xn).toFixed(1)} m from their hands.`;
  else reason = `The block is out of the way. Hit ${where}, where the nearest defender is ${Math.max(0, g.dig + 0.55).toFixed(1)} m too far away to dig it.`;
  return { choice: { shot, aim: { x: clamp(g.target.x, -HW + 0.5, HW - 0.5), z: g.target.z } }, reason, grid: g };
}

// ---- block ---------------------------------------------------------------------------------------------------------------------------
// Which blockers go up, where they stand. latA = lateral position (in the attacking team's frame) the defenders expect the hit at.
export function chooseBlock(s, defTeam, atkTeam, x_hit, rnd, opts = {}) {
  const iq = opts.iq ?? s.teams[defTeam].iq;
  const fr = frontRow(s, defTeam).filter((p) => p.tp !== 6);
  // read: with probability ~iq they read the real target, otherwise they bite on a decoy lane
  const reads = rnd.next() < 0.45 + 0.5 * iq;
  let xe = x_hit * 0.86;   // blockers shade towards the middle: most hits are angled across the court
  if (!reads) xe = x_hit + (rnd.next() < 0.5 ? -1 : 1) * (1.3 + rnd.next() * 1.2);
  xe = clamp(xe, -HW + 0.2, HW - 0.2);
  const sorted = fr.slice().sort((a, b) => Math.abs(a.x - xe) - Math.abs(b.x - xe));
  const list = [];
  if (sorted[0]) list.push({ p: sorted[0], x: xe });
  const dbl = sorted[1] && Math.abs(sorted[1].x - xe) < 3.6 && rnd.next() < 0.35 + 0.55 * iq;
  if (dbl) list.push({ p: sorted[1], x: xe + (sorted[1].x > xe ? 0.62 : -0.62) });
  if (dbl) list[0].x = xe - (sorted[1].x > xe ? 0.34 : -0.34) * 1;
  const triple = dbl && sorted[2] && Math.abs(sorted[2].x - xe) < 2.0 && iq > 0.75 && rnd.next() < 0.25;
  if (triple) list.push({ p: sorted[2], x: xe + (sorted[2].x > xe ? 1.2 : -1.2) });
  return { list, read: reads, xe };
}

export { heightScale, TECH, SHOTS, SERVES, SET_IDS, ATK, BR, PELVIS_Y, typeOfId, isOH };
