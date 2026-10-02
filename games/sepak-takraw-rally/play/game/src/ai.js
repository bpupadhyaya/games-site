// Opponent AI and the Think coach. Both use the same shot model the simulation resolves with (model.js, consts.js),
// so a suggestion's stated chances match what the engine does. Level noise only perturbs the choice, never the physics.
import { HW, HL, ATTACKS, ATTACK_IDS, SERVES, SERVE_IDS, ZONES, ZONE_LAT, ZONE_DEPTH, REACH_UP, PELVIS_Y, SET_PACE, BR } from './consts.js';
import { clamp, normal, sig } from './util.js';
import { W, dirOf, latOf, depthOf, latSign, REACH0, PREP, setSpot, laneLat } from './model.js';
import { flightTo, netTime, posAt, landTime } from './ball.js';
import { solveClear } from './model.js';

const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
const cdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
const pct = (v) => `${Math.round(clamp(v, 0, 1) * 100)}%`;

const LAT_NAME = (team, lat) => (Math.abs(lat) < 0.8 ? 'centre' : latOf(team, lat * latSign(team)) > 0 ? 'left' : 'right'); // lat is in team coords
// name the target in the opponent's viewpoint as seen from the camera (screen left = world +x)
const screenSide = (x) => (Math.abs(x) < 0.9 ? 'centre' : x > 0 ? 'left' : 'right');
const depthName = (d) => (d > 4.8 ? 'deep' : d > 2.8 ? 'mid-court' : 'short');
const spotName = (x, z, team) => { const opp = 1 - team; const d = depthOf(opp, z); return `${depthName(d)} ${screenSide(x)}`.replace('deep centre', 'deep middle').replace('mid-court centre', 'middle').replace('short centre', 'short middle'); };

// pick from scored options with a softmax whose temperature shrinks with skill but never reaches zero (no robotic repetition)
function softPick(list, key, rA, temp) {
  let mx = -Infinity; for (const c of list) mx = Math.max(mx, c[key]);
  let tot = 0; const w = list.map((c) => { const v = Math.exp((c[key] - mx) / Math.max(1e-3, temp)); tot += v; return v; });
  let r = rA.next() * tot;
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}
function noiseOf(iq, o) { return o && o.noNoise ? 0 : (1 - (o && o.fixedIq != null ? o.fixedIq : iq)); }

// ---------------------------------------------------------------- serve
function receivers(api, team) { return [0, 1, 2].map((r) => api.P(team, r)); }
function evalServe(api, team, type, tx, tz, srvQ) {
  const rcv = 1 - team;
  const q = srvQ;
  const spread = (0.30 + 1.5 * (1 - q) * (1 - q)) / type.acc * 0.55;
  const sx = spread * 0.9, sz = spread;
  const dep = depthOf(rcv, tz);
  const pX = cdf((HW - tx) / sx) - cdf((-HW - tx) / sx);
  const pZ = cdf((HL - dep) / sz) - cdf((0.1 - dep) / sz);
  const marg = type.margin * (0.25 + 0.75 * q) + 0.04;
  const sdm = 0.07 * (1.15 - q);
  const pNet = dep < 1.5 ? cdf(-(marg - 0.0) / (sdm + 0.02)) * 0.3 : cdf(-(marg) / (sdm + 0.12 * (1 - q)));
  const pIn = pX * pZ * (1 - pNet);
  let dmin = 9;
  for (const p of receivers(api, rcv)) dmin = Math.min(dmin, Math.hypot(tx - p.x, tz - p.z));
  const speedBonus = clamp((1.4 - type.T) / 0.8, 0, 1);
  const pace = 0.30 + 0.45 * clamp((dmin - 0.8) / 3, 0, 1) + 0.25 * speedBonus;
  return { pIn, dmin, value: pIn * pace - (1 - pIn) * 0.9 };
}
function decideServe(api, team, extra, rA, o) {
  const s = api.s, st = api.P(team, 0).st;
  const nz = noiseOf(s.teams[team].iq, o);
  let best = null; const opts = [];
  const srvQ = clamp(0.30 + 0.30 * st.tech + 0.15 * st.pow + 0.30, 0.2, 0.85);
  for (const id of SERVE_IDS) {
    const type = SERVES[id];
    for (let lat = -2.4; lat <= 2.41; lat += 0.8) for (let dep = 3.2; dep <= 6.2; dep += 0.75) {
      const w = W(1 - team, lat, dep);
      const e = evalServe(api, team, type, w.x, w.z, srvQ);
      const score = e.value + (nz ? normal(rA) * nz * 0.25 : 0);
      const c = { id, x: w.x, z: w.z, e, score };
      opts.push(c);
      if (!best || score > best.score) best = c;
    }
  }
  if (!(o && o.noNoise)) { const top = opts.slice().sort((p, q) => q.score - p.score).slice(0, 10); best = softPick(top, 'score', rA, 0.02 + nz * 0.08); }
  const type = SERVES[best.id];
  const reason = `${type.name} to the ${spotName(best.x, best.z, team)}: it is the farthest spot from their receivers (${best.e.dmin.toFixed(1)} m) and about ${pct(best.e.pIn)} to land in.`;
  return { choice: { stype: best.id, serveAim: { x: best.x, z: best.z } }, reason, options: opts.sort((a, b) => b.score - a.score).slice(0, 3), summary: `${type.short} serve` };
}

// ---------------------------------------------------------------- receive: who attacks
function decideRecv(api, team, extra, rA, o) {
  const s = api.s;
  const recv = s.players[extra.receiver];
  const others = [0, 1, 2].filter((r) => r !== recv.role);
  const nz = noiseOf(s.teams[team].iq, o);
  const opp = 1 - team;
  let best = null; const opts = [];
  for (const r of others) {
    const p = api.P(team, r);
    let sc = 0.5 * p.st.pow + 0.5 * p.st.tech;
    if (r === 0) sc -= 0.35;                                 // the back player attacks from far away
    // a hitter facing the opponent's weaker blocker has the better matchup
    const lane = laneLat(r);
    const facing = api.P(opp, lane > 0 ? 2 : 1);             // inside player directly across
    if (r !== 0) sc += 0.25 * (0.6 - facing.st.blk);
    sc += nz ? normal(rA) * nz * 0.3 : 0;
    const c = { r, sc };
    opts.push(c);
    if (!best || sc > best.sc) best = c;
  }
  const p = api.P(team, best.r);
  const nm = best.r === 1 ? 'Left inside' : best.r === 2 ? 'Right inside' : 'The back player';
  const reason = `${nm} should attack: stronger spike (power ${Math.round(p.st.pow * 100)}, touch ${Math.round(p.st.tech * 100)}) and the better matchup against the block.`;
  return { choice: { attacker: best.r }, reason, options: opts, summary: `${nm} attacks` };
}

// ---------------------------------------------------------------- set
function blockStrength(api, opp, zoneLat, pace) {
  // how well the other team's insides can cover a set to `zoneLat` (team coords of the attacking team), 0..1
  const insides = [1, 2].map((r) => api.P(opp, r));
  let best = 0;
  for (const p of insides) {
    const dx = Math.abs(p.x - (-zoneLat * 0 + zoneLat)); void dx;
  }
  return best;
}
function decideSet(api, team, extra, rA, o) {
  const s = api.s, opp = 1 - team;
  const att = s.players[extra.attacker] || api.P(team, 1);
  const nz = noiseOf(s.teams[team].iq, o);
  const insides = [api.P(opp, 1), api.P(opp, 2)];
  let best = null; const opts = [];
  for (const zone of ZONES) {
    for (const pace of ['high', 'quick']) {
      const pc = SET_PACE[pace];
      const w = W(team, zone * ZONE_LAT, ZONE_DEPTH);
      const avail = Math.max(0, pc.T - 0.65);
      const lane = W(team, laneLat(att.role) || 1.2, 1.7);          // where the attacker will be waiting when the set is hit
      const d = Math.hypot(w.x - lane.x, (w.z - dirOf(team) * 0.25) - lane.z);
      const reach = att.st.spd * 1.1 * avail + 0.3;
      const comfort = clamp(1 - Math.max(0, d - reach) / 1.0, 0, 1) * (pace === 'quick' ? 0.93 : 1);
      // block cover: the blockers read the set and move to it (they commit later), so use their reading skill, not where they stand now
      const blkBest = Math.max(insides[0].st.blk, insides[1].st.blk);
      const sgB = clamp(0.95 - 0.85 * blkBest, 0.12, 0.9) * (pace === 'quick' ? 1.5 : 1);
      const cover = erf(0.7 / (sgB * Math.SQRT2)) * (pace === 'quick' ? 0.8 : 1);
      const timingEase = pace === 'high' ? 0.06 : 0;
      const sc = comfort * 0.62 + (1 - cover) * 0.30 + timingEase + (nz ? normal(rA) * nz * 0.18 : 0);
      const c = { zone, pace, comfort, cover, sc };
      opts.push(c);
      if (!best || sc > best.sc) best = c;
    }
  }
  const zn = best.zone === 0 ? 'the middle' : screenSide(W(team, best.zone * ZONE_LAT, 1).x) === 'left' ? 'the left wing' : 'the right wing';
  // free ball when the attacker cannot get there or the chances are poor
  const reason = `${best.pace === 'quick' ? 'Quick' : 'High'} set to ${zn}: the attacker gets there comfortably (${pct(best.comfort)}) and the block covers about ${pct(best.cover)} of that spot${best.pace === 'quick' ? ', and a quick set gives them less time to read it' : ', and a high set gives your hitter time'}.`;
  return { choice: { zone: best.zone, pace: best.pace }, reason, options: opts.sort((a, b) => b.sc - a.sc).slice(0, 3), summary: `${best.pace === 'quick' ? 'Quick' : 'High'} set to ${zn.replace('the ', '')}` };
}

// ---------------------------------------------------------------- attack
function blockersNow(api, opp) {
  return [1, 2].map((r) => api.P(opp, r)).filter((p) => p.blocker);
}
export function evalAttack(api, team, att, P3, type, aim, tmExp, opts = {}) {
  const s = api.s, opp = 1 - team;
  const st = att.st;
  const fit = clamp(1 - Math.abs(P3.y - type.y) * 1.1, 0.3, 1);
  const q = clamp(0.22 + 0.30 * st.tech + 0.42 * tmExp + 0.15 * fit - 0.2 * (opts.stretch ?? 0), 0.05, 1);
  const sc = (0.22 + 1.25 * (1 - q) * (1 - q)) / type.acc * 0.85;
  const dep = depthOf(opp, aim.z);
  const pX = cdf((HW - aim.x) / (sc * 0.8)) - cdf((-HW - aim.x) / (sc * 0.8));
  const pZ = cdf((HL - dep) / sc) - cdf((0.15 - dep) / sc);
  const pNetNoise = cdf(-0.16 / (0.14 * (1.2 - q) + 0.02));
  const dist = Math.hypot(aim.x - P3.x, aim.z - P3.z, P3.y);
  const Tpref = Math.max(0.28, dist / (type.speed * (0.82 + 0.3 * st.pow)));
  const p0 = { x: P3.x, y: P3.y, z: P3.z };
  const sol = solveClear(p0, { x: aim.x, y: BR, z: aim.z }, Tpref, s.netH, 0.16, 2.2);
  const fl = flightTo(0, p0, { x: aim.x, y: BR, z: aim.z }, sol.T);
  const tn = netTime(fl, sol.T) ?? sol.T * 0.2;
  const pn = posAt(fl, tn);
  const speedFactor = clamp(Tpref / sol.T, 0.3, 1);       // slowed by the net geometry
  // block
  let pBlockHit = 0, pKill = 0.4;
  const bl = opts.blockers ?? blockersNow(api, opp);
  let mode = bl.length;
  for (const b of bl) {
    const bx = b.tx ?? b.x;
    const sig2 = 0.05 + 0.10 * (1 - b.st.blk) + (opts.quick ? 0.03 : 0);
    const pT = erf(0.085 / (sig2 * Math.SQRT2));
    const pL = cdf((0.55 - Math.abs(pn.x - bx)) / 0.12);
    const reachTop = PELVIS_Y + clamp(0.3 + 0.55 * b.st.jump, 0.25, 0.75) + 0.68;
    const pR = cdf((reachTop - pn.y) / 0.1);
    pBlockHit = 1 - (1 - pBlockHit) * (1 - pT * pL * pR);
    pKill = clamp(0.28 + 0.45 * (b.st.blk - 0.45) + 0.12 * (mode > 1 ? 1 : 0), 0.06, 0.85);
  }
  // dig
  const tl = sol.T;
  const defenders = [0, 1, 2].map((r) => api.P(opp, r)).filter((p) => !(bl.includes(p)));
  let pReach = 0, bestNeed = 9, nearest = null;
  for (const p of defenders) {
    const avail = Math.max(0, tl - 0.05 - p.st.react - PREP);
    const px = p.tx ?? p.x, pz = p.tz ?? p.z;
    const d = Math.hypot(aim.x - px, aim.z - pz);
    const need = d - (REACH0 + p.st.spd * 0.9 * avail) - 0.8;
    const pr = sig(-need * 5);
    pReach = 1 - (1 - pReach) * (1 - pr);
    if (need < bestNeed) { bestNeed = need; nearest = p; }
  }
  const pDigGood = nearest ? clamp(0.25 + 0.55 * nearest.st.ctrl - 0.5 * clamp((type.speed * speedFactor - 8) / 16, 0, 1) * 0.6, 0.05, 0.9) : 0;
  const pIn = pX * pZ;
  const pErr = 1 - pIn * (1 - pNetNoise);
  const pFloor = (1 - pReach) + pReach * (1 - pDigGood) * 0.5;      // point won by the ball landing or a shank
  const pWin = (1 - pErr) * (1 - pBlockHit) * pFloor;
  const pLose = pErr + (1 - pErr) * pBlockHit * pKill;
  return { pWin, pLose, pErr, pBlockHit, pReach, E: pWin - pLose, q, Tl: sol.T, nearest, bestNeed };
}
function decideAttack(api, team, extra, rA, o) {
  const s = api.s, opp = 1 - team;
  const att = s.players[extra.attacker] || api.P(team, 1);
  const A = s.rally.atk;
  const P3 = extra.P3 || (A && A.P3) || { ...W(team, 0, ZONE_DEPTH), y: 2.4 };
  const nz = noiseOf(s.teams[team].iq, o);
  const tmExp = clamp(0.45 + 0.45 * s.teams[team].skill, 0.4, 0.9);
  const quick = A && A.pace === 'quick';
  const bl = blockersNow(api, opp);
  let best = null; const all = [];
  for (const id of ATTACK_IDS) {
    const type = ATTACKS[id];
    for (let lat = -2.6; lat <= 2.61; lat += 0.65) for (let dep = 0.9; dep <= 6.0; dep += 1.02) {
      const w = W(opp, lat, dep);
      const e = evalAttack(api, team, att, P3, type, w, tmExp, { quick, blockers: bl });
      // harder-to-time types cost a little when the player has to do the timing
      const diff = (1 - type.win) * 0.12;
      const score = e.E - diff * (o && o.fixedIq != null ? 1 : 0) + (nz ? normal(rA) * nz * 0.22 : 0);
      const c = { id, x: w.x, z: w.z, e, score };
      all.push(c);
      if (!best || score > best.score) best = c;
    }
  }
  if (!(o && o.noNoise)) { const top = all.slice().sort((p, q) => q.score - p.score).slice(0, 14); best = softPick(top, 'score', rA, 0.025 + nz * 0.12); }
  const type = ATTACKS[best.id];
  const e = best.e;
  let why;
  if (e.pBlockHit > 0.35) why = 'the block is likely to touch it, so it is the safest line available';
  else if (e.pReach < 0.5) why = `nobody can reach that spot in time (their nearest defender is ${Math.max(0, e.bestNeed).toFixed(1)} m short)`;
  else why = 'it is the most open part of their court';
  const reason = `${type.name} to the ${spotName(best.x, best.z, team)}: ${why}. About ${pct(e.pWin)} to win the point and ${pct(e.pLose)} to lose it.`;
  return { choice: { atype: best.id, aim: { x: best.x, z: best.z } }, reason, options: all.sort((a, b) => b.score - a.score).slice(0, 3), summary: `${type.short} to the ${spotName(best.x, best.z, team)}` };
}

// ---------------------------------------------------------------- block
function decideBlock(api, team, extra, rA, o) {
  const s = api.s, atk = 1 - team;
  const A = s.rally.atk;
  const att = A ? s.players[A.pid] : api.P(atk, 1);
  const nz = noiseOf(s.teams[team].iq, o);
  const pace = A ? A.pace : 'high';
  const bq = (api.P(team, 1).st.blk + api.P(team, 2).st.blk) / 2;
  const hit = att.st.pow;
  const sc = { single: 0.5 + 0.1 * bq, double: 0.35 + 0.35 * (hit - 0.4) + 0.2 * bq - (pace === 'quick' ? 0.2 : 0), drop: 0.40 + 0.35 * (pace === 'quick' ? 1 : 0) + 0.25 * (0.6 - hit) };
  let best = null;
  for (const k of Object.keys(sc)) { const v = sc[k] + (nz ? normal(rA) * nz * 0.2 : 0); if (!best || v > best.v) best = { k, v }; }
  const names = { single: 'a single block', double: 'a double block', drop: 'dropping back to dig' };
  const why = best.k === 'single' ? 'one blocker takes the lane and the other two players cover the court behind' : best.k === 'double' ? `the hitter is strong (power ${Math.round(hit * 100)}) and a high set gives time to close the gap` : 'a quick set is hard to read, so three diggers are safer than a late block';
  return { choice: { block: best.k }, reason: `Choose ${names[best.k]}: ${why}.`, options: [], summary: names[best.k][0].toUpperCase() + names[best.k].slice(1) };
}

// ---------------------------------------------------------------- free ball over
function decideOver(api, team, extra, rA, o) {
  const opp = 1 - team;
  const nz = noiseOf(api.s.teams[team].iq, o);
  let best = null;
  for (let lat = -2.4; lat <= 2.41; lat += 0.8) for (let dep = 2.6; dep <= 6.0; dep += 0.85) {
    const w = W(opp, lat, dep);
    let dmin = 9;
    for (const r of [0, 1, 2]) { const p = api.P(opp, r); dmin = Math.min(dmin, Math.hypot(w.x - p.x, w.z - p.z)); }
    const v = dmin + (nz ? normal(rA) * nz * 0.8 : 0) - Math.max(0, Math.abs(lat) - 2.0) * 2;
    if (!best || v > best.v) best = { w, v, dmin };
  }
  return { choice: { overAim: { x: best.w.x, z: best.w.z } }, reason: `Free ball to the ${spotName(best.w.x, best.w.z, team)}, ${best.dmin.toFixed(1)} m from the nearest defender.`, options: [], summary: 'Free ball over' };
}

export function decide(api, team, kind, extra, rA, o = {}) {
  switch (kind) {
    case 'serve': return decideServe(api, team, extra, rA, o);
    case 'recv': return decideRecv(api, team, extra, rA, o);
    case 'set': return decideSet(api, team, extra, rA, o);
    case 'attack': return decideAttack(api, team, extra, rA, o);
    case 'block': return decideBlock(api, team, extra, rA, o);
    case 'over': return decideOver(api, team, extra, rA, o);
    default: return { choice: {}, reason: '', options: [], summary: '' };
  }
}
