// Kabaddi: Raid and Tag. The rules of the match as pure functions: the court, the teams, the raid and what one exchange
// (a "beat") between the raider and the defenders can do, the scoring, the outs and revivals. No time, no drawing, no input:
// sim.js adds the clock and the movement, ai.js the opponents, game.js the flow. Everything the Rules page promises is here.
//
// Raid-local frame: x runs across the court (0..10 m), u runs from the midline (0) into the defenders' half (to 6.5 m).

export const COURT = { W: 10, HALF: 6.5, BAULK: 3.75, BONUS: 4.75, LOBBY: 1, RAID_SECS: 30, CANT_SECS: 7, TEAM: 7 };
export const BONUS_MIN_DEFENDERS = 6;       // the bonus line is live only against 6 or 7 defenders
export const SUPER_TACKLE_MAX = 3;          // a tackle against 3 or fewer defenders is worth 2 points
export const DOD_AFTER = 2;                 // the raid after 2 empty raids is do-or-die
export const ALL_OUT_BONUS = 2;
export const MATCH_LENGTH = { quick: 4, full: 8 };   // raids per team per half

export const ACTIONS = ['step', 'feintL', 'feintR', 'hand', 'toe', 'run', 'bonus', 'retreat'];
export const RESPONSES = ['ankle', 'thigh', 'chain', 'block', 'dash', 'hold'];
export const ACTION_NAME = { step: 'Step in', feintL: 'Feint left', feintR: 'Feint right', hand: 'Hand touch', toe: 'Toe touch', run: 'Running touch', bonus: 'Bonus line', retreat: 'Retreat' };
export const RESPONSE_NAME = { ankle: 'Ankle hold', thigh: 'Thigh hold', chain: 'Chain tackle', block: 'Block the exit', dash: 'Dash', hold: 'Hold ground' };
export const TOUCH_ACTIONS = ['hand', 'toe', 'run'];
// Reach of each touch (metres from the target defender), and how long the whole exchange takes on the raid clock.
export const REACH = { hand: 1.3, toe: 1.05, run: 1.5 };

export const FORMATIONS = ['arc', 'line', 'deep', 'pincer'];
export const FORMATION_NAME = { arc: 'Half circle', line: 'Front line', deep: 'Deep cover', pincer: 'Corner pincer' };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.u - b.u);

// ---------------------------------------------------------------------------------------------------------------------
// Teams. Seven players each; the raid roles are fixed by position in the squad, the numbers by a stream of the match seed.
export const ROLE = ['raider', 'raider', 'raider', 'allround', 'allround', 'defender', 'defender'];
const NUMBERS = [[7, 4, 9, 2, 5, 3, 6], [8, 11, 1, 10, 12, 14, 15]];
export function makeTeam(rng, team) {
  const players = ROLE.map((role, i) => {
    const r = role === 'raider', d = role === 'defender';
    const v = (bias) => Math.round(clamp(0.62 + bias + (rng.next() - 0.5) * 0.24, 0.42, 0.9) * 20) / 20;
    return {
      id: i, num: NUMBERS[team][i], role,
      spd: v(r ? 0.08 : d ? -0.05 : 0), agi: v(r ? 0.1 : d ? -0.06 : 0), rch: v(r ? 0.08 : d ? -0.04 : 0),
      tkl: v(r ? -0.1 : d ? 0.12 : 0.02), alt: v(r ? -0.02 : d ? 0.08 : 0.02),
    };
  });
  return { players, onMat: players.map((p) => p.id), outQ: [], empty: 0, rot: 0 };
}
export const pips = (v) => clamp(Math.round(((v - 0.4) / 0.5) * 4 + 1), 1, 5);
export function describePlayer(p) {
  const tags = [];
  if (p.spd >= 0.7) tags.push('quick');
  if (p.agi >= 0.7) tags.push('agile');
  if (p.rch >= 0.7) tags.push('long reach');
  if (p.tkl >= 0.72) tags.push('strong tackler');
  if (p.alt >= 0.7) tags.push('alert');
  if (!tags.length) tags.push('steady');
  return tags.slice(0, 3).join(', ');
}

export function newMatch(rng, cfg = {}) {
  const per = MATCH_LENGTH[cfg.length === 'quick' ? 'quick' : 'full'];
  const first = cfg.first === 1 ? 1 : 0;
  return {
    cfg: { length: cfg.length === 'quick' ? 'quick' : 'full', mode: cfg.mode ?? 'ai', level: clamp((cfg.level ?? 1) | 0, 0, 4), watchA: cfg.watchA ?? 0, watchB: cfg.watchB ?? 1, first },
    teams: [makeTeam(rng, 0), makeTeam(rng, 1)],
    score: [0, 0], half: 1, per, done: [0, 0], raiding: first, over: null, raids: 0, stats: [newStats(), newStats()],
  };
}
const newStats = () => ({ raids: 0, success: 0, touches: 0, bonus: 0, tackles: 0, superTackles: 0, allOuts: 0, superRaids: 0, dod: 0 });

// ---------------------------------------------------------------------------------------------------------------------
// The defenders' shape. n players are spread left to right; positions are in the raid-local frame.
export function formationSlots(form, n) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const t = n === 1 ? 0.5 : (k + 0.5) / n, s = 1 - Math.pow(2 * t - 1, 2);
    let x = 1.25 + 7.5 * t, u;
    if (form === 'line') u = 3.15;
    else if (form === 'deep') u = 5.45 - 0.35 * s;
    else if (form === 'pincer') { const left = t < 0.5, tt = left ? t / 0.5 : (t - 0.5) / 0.5; x = left ? 1.3 + 2.0 * tt : 6.7 + 2.0 * tt; u = 4.6 - 1.3 * (left ? tt : 1 - tt); }
    else u = 5.3 - 2.5 * s;
    out.push({ x, u });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// A raid.
export function nextRaider(match, team, pick) {
  const t = match.teams[team];
  if (pick !== undefined && t.onMat.includes(pick)) return pick;
  const n = t.onMat.length;
  const id = t.onMat[t.rot % n];
  return id;
}

export function startRaid(match, { raider, formation } = {}) {
  const team = match.raiding, def = 1 - team, dt = match.teams[def], rt = match.teams[team];
  const rid = raider !== undefined && rt.onMat.includes(raider) ? raider : nextRaider(match, team);
  const defIds = [...dt.onMat].sort((a, b) => a - b);
  return {
    team, def, raider: rid, defIds, nDef: defIds.length, form: formation ?? 'arc',
    P: { x: COURT.W / 2, u: 0 }, crossed: false, banked: [], bonus: false, bonusTried: false, beat: 0, closure: 0,
    off: [], blocked: false, dod: rt.empty >= DOD_AFTER, clock: COURT.RAID_SECS, cant: 1, ended: null, lastFeints: 0, history: [],
  };
}
export const raiderOf = (match, raid) => match.teams[raid.team].players[raid.raider];
export const defenderOf = (match, raid, id) => match.teams[raid.def].players[id];
export const liveDefenders = (raid) => raid.defIds;     // touched defenders stay on the mat until the raider is safe

// Where the defenders stand now: the formation, squeezed toward the raider as the raid goes on.
export function defenderPositions(raid) {
  const slots = formationSlots(raid.form, raid.defIds.length);
  const pos = {};
  raid.defIds.forEach((id, k) => {
    const s = slots[k];
    const c = raid.closure * (0.5 + 0.5 * Math.min(1, 1.6 / Math.max(0.4, Math.hypot(s.x - raid.P.x, s.u - raid.P.u) * 0.35)));
    let x = s.x + (raid.P.x - s.x) * c * 0.55, u = s.u + (raid.P.u + 0.9 - s.u) * c * 0.5;
    const dx = x - raid.P.x, du = u - raid.P.u, d = Math.hypot(dx, du);
    if (d < 1.15) { const f = 1.15 / Math.max(d, 1e-3); x = raid.P.x + dx * f; u = raid.P.u + du * f; }
    pos[id] = { x: clamp(x, COURT.LOBBY + 0.1, COURT.W - COURT.LOBBY - 0.1), u: clamp(u, 0.6, COURT.HALF - 0.4) };
  });
  return pos;
}

export const validTargets = (raid) => raid.defIds.filter((id) => !raid.banked.includes(id));
export const nearestTarget = (raid, pos = defenderPositions(raid)) => {
  let best = null, bd = 1e9;
  for (const id of validTargets(raid)) { const d = dist(pos[id], raid.P); if (d < bd) { bd = d; best = id; } }
  return best;
};
// Defenders close enough to join a hold at a point (the target included), counted up to 4.
export function engaged(raid, pos, at, exclude = []) {
  return raid.defIds.filter((id) => !exclude.includes(id) && dist(pos[id], at) <= 2.4);
}

export function bonusLive(raid) { return raid.defIds.length >= BONUS_MIN_DEFENDERS && raid.banked.length === 0 && !raid.bonus && !raid.bonusTried; }

// What the raider may choose right now, with a reason when not.
export function available(raid) {
  const out = {};
  const targets = validTargets(raid);
  out.step = raid.crossed ? 'You are already past the baulk line' : null;
  out.feintL = null; out.feintR = null;
  for (const a of TOUCH_ACTIONS) out[a] = targets.length ? null : 'No defender left to touch';
  out.bonus = raid.defIds.length < BONUS_MIN_DEFENDERS ? 'The bonus line needs 6 or more defenders' : raid.banked.length ? 'The bonus must come before any touch' : (raid.bonus || raid.bonusTried) ? 'Bonus already tried' : null;
  out.retreat = raid.crossed ? null : 'Cross the baulk line first';
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// The exchange. All the numbers a beat uses are in these tables and the two probability functions below; the AI reads the same ones.
const TOUCH = {
  hand: { ankle: 0.62, thigh: 0.42, chain: 0.36, block: 0.55, dash: 0.45, hold: 0.18 },
  toe:  { ankle: 0.34, thigh: 0.60, chain: 0.44, block: 0.52, dash: 0.46, hold: 0.18 },
  run:  { ankle: 0.52, thigh: 0.34, chain: 0.30, block: 0.38, dash: 0.34, hold: 0.30 },
};
const CATCH = {
  ankle: { hand: 0.08, toe: 0.32, run: 0.12, step: 0.08, bonus: 0.18, feint: 0.05 },
  thigh: { hand: 0.26, toe: 0.12, run: 0.26, step: 0.10, bonus: 0.24, feint: 0.05 },
  chain: { hand: 0.30, toe: 0.26, run: 0.34, step: 0.14, bonus: 0.30, feint: 0.05 },
  block: { hand: 0.05, toe: 0.05, run: 0.05, step: 0.05, bonus: 0.08, feint: 0.03 },
  dash:  { hand: 0.34, toe: 0.30, run: 0.20, step: 0.20, bonus: 0.26, feint: 0.08 },
  hold:  { hand: 0.02, toe: 0.02, run: 0.03, step: 0.02, bonus: 0.06, feint: 0.01 },
};
const RETREAT = { ankle: 0.20, thigh: 0.17, chain: 0.21, block: 0.34, dash: 0.17, hold: 0.07 };
export const TUNE = { catch: 0.45, retreat: 0.5 };
const CHAIN_N = [0, 0.55, 0.85, 1.0, 1.12];
const COMMITTED = ['ankle', 'thigh', 'chain', 'dash'];
const feintKey = (a) => (a === 'feintL' || a === 'feintR' ? 'feint' : a);

const avg = (arr, f) => (arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : 0.6);
const players = (match, raid) => ({ R: raiderOf(match, raid), D: (id) => defenderOf(match, raid, id) });

// Probability that the raider scores a touch on `tgt` (or the bonus point for action 'bonus') against response `resp`.
export function touchProb(match, raid, action, tgt, resp, q = 0.5, pos = defenderPositions(raid)) {
  const { R, D } = players(match, raid);
  if (action === 'bonus') {
    const deep = raid.defIds.filter((id) => pos[id].u > 3.6).length;
    let p = 0.74 - 0.075 * deep + 0.3 * (R.agi - 0.65) + 0.25 * (R.spd - 0.65) + 0.25 * (q - 0.5);
    if (resp === 'hold') p += 0.06;
    if (resp === 'block') p -= 0.04;
    return clamp(p, 0.08, 0.92);
  }
  if (!TOUCH[action]) return 0;
  let p = TOUCH[action][resp] + 0.35 * (R.rch - D(tgt).alt) + 0.25 * (q - 0.5) * 1.0;
  if (action === 'run') p += 0.12 * (R.spd - 0.65);
  if (raid.off.includes(tgt)) p += 0.2;
  return clamp(p, 0.04, 0.9);
}

// Probability that the defenders hold the raider after this action (the raid ends, the banked touches are lost).
export function catchProb(match, raid, action, tgt, resp, q = 0.5, pos = defenderPositions(raid), at = raid.P) {
  const { R, D } = players(match, raid);
  const a = feintKey(action);
  const near = engaged(raid, pos, at);
  const nEng = Math.min(4, near.length);
  const tk = avg(near.slice(0, 3), (id) => D(id).tkl);
  let p;
  if (a === 'retreat') {
    const corridor = raid.defIds.filter((id) => {
      const d = pos[id];
      if (d.u > raid.P.u + 1.0) return false;
      return Math.abs(d.x - (raid.P.x + (COURT.W / 2 - raid.P.x) * (1 - d.u / Math.max(raid.P.u, 0.5)))) < 1.9;
    }).length;
    p = RETREAT[resp] + 0.05 * raid.banked.length + 0.035 * (corridor - 2) + 0.04 * (raid.P.u - 3) - 0.3 * (R.agi - 0.65) - 0.3 * (R.spd - 0.65) + 0.35 * (tk - 0.65);
    if (raid.blocked && resp !== 'block') p += 0.12;
    if (resp === 'chain') p *= CHAIN_N[Math.min(4, Math.max(1, corridor))] ?? 1;
    p += 0.2 * (q - 0.5);   // a well-timed chase adds, a poor one subtracts
    return clamp(p * TUNE.retreat, 0.03, 0.9);
  }
  p = CATCH[resp][a] ?? 0.2;
  if (resp === 'chain') p *= CHAIN_N[nEng] ?? 1;
  p += 0.3 * (q - 0.5) + 0.35 * (tk - 0.65) - 0.3 * (R.agi - 0.65) + 0.07 * raid.beat + 0.04 * raid.banked.length + 0.015 * (nEng - 3) + 0.015 * (raid.P.u - 3);
  if (tgt !== null && raid.off.includes(tgt)) p -= 0.12;
  if (resp === 'block' && a !== 'bonus') p = Math.min(p, 0.16);
  return clamp(p * TUNE.catch, 0.02, 0.9);
}

// ---------------------------------------------------------------------------------------------------------------------
// Where the raider ends up for an action (raid-local), and how long the exchange takes on the raid clock.
export const BEAT_SECS = { step: 2.2, feintL: 1.9, feintR: 1.9, hand: 2.6, toe: 2.6, run: 2.8, bonus: 3.0, retreat: 2.6 };
export function raiderDestination(raid, action, tgt, pos) {
  const P = raid.P;
  if (action === 'step') return { x: clamp(P.x + (COURT.W / 2 - P.x) * 0.25, 1.4, 8.6), u: COURT.BAULK + 0.4 };
  if (action === 'feintL' || action === 'feintR') return { x: clamp(P.x + (action === 'feintL' ? 0.7 : -0.7), 1.4, 8.6), u: Math.max(P.u, 1.7) + (P.u < 1.7 ? 0 : 0.2) };
  if (action === 'bonus') return { x: clamp(P.x, 2, 8), u: COURT.BONUS + 0.15 };
  if (action === 'retreat') return { x: clamp(P.x + (COURT.W / 2 - P.x) * 0.3, 1.2, 8.8), u: -0.3 };
  const d = pos[tgt], dx = d.x - P.x, du = d.u - P.u, len = Math.max(1e-3, Math.hypot(dx, du));
  const nx = dx / len, nu = du / len;
  if (action === 'run') return { x: clamp(d.x + nx * 1.2 - nu * 0.7, 1.2, 8.8), u: clamp(d.u + nu * 1.2 + nx * 0.7, 0.3, 6.2) };
  const r = REACH[action];
  return { x: clamp(d.x - nx * r, 1.2, 8.8), u: clamp(d.u - nu * r, 0.3, 6.2) };
}

// Apply one raider action against the defenders' response. `q` are the timing qualities (0..1). Returns what happened.
export function resolveBeat(match, raid, action, tgt, resp, qR, qD, rng) {
  const pos = defenderPositions(raid);
  const res = { action, tgt, resp, touched: [], caught: false, bonusGot: false, escaped: false, off: [], pTouch: 0, pCatch: 0, dashOut: null, chainBroke: false, from: { ...raid.P } };
  raid.history.push(action);
  raid.beat += 1;
  if (action === 'retreat') {
    res.pCatch = catchProb(match, raid, action, null, resp, qD, pos);
    res.caught = rng.next() < res.pCatch;
    if (!res.caught) res.escaped = true;
    res.to = { x: raid.P.x, u: 0 };
    return res;
  }
  const dest = raiderDestination(raid, action, tgt, pos);
  const at = dest;
  if (action === 'bonus') {
    raid.bonusTried = true;
    res.pTouch = touchProb(match, raid, 'bonus', null, resp, qR, pos);
    res.pCatch = catchProb(match, raid, 'bonus', null, resp, qD, pos, at);
    res.caught = rng.next() < res.pCatch;
    if (!res.caught && rng.next() < res.pTouch) { raid.bonus = true; res.bonusGot = true; }
  } else if (action === 'step') {
    res.pCatch = catchProb(match, raid, 'step', null, resp, qD, pos, at);
    res.caught = rng.next() < res.pCatch;
  } else if (action === 'feintL' || action === 'feintR') {
    res.pCatch = catchProb(match, raid, action, tgt, resp, qD, pos, at);
    res.caught = rng.next() < res.pCatch;
    if (!res.caught && COMMITTED.includes(resp) && tgt !== null) { res.off.push(tgt); }
    raid.lastFeints += 1;
  } else {
    res.pTouch = touchProb(match, raid, action, tgt, resp, qR, pos);
    res.pCatch = catchProb(match, raid, action, tgt, resp, qD, pos, at);
    const touched = rng.next() < res.pTouch;
    res.caught = rng.next() < res.pCatch;
    if (touched) res.touched.push(tgt);
    if (!res.caught) {
      if (action === 'run' && touched) {
        const extra = raid.defIds.filter((id) => id !== tgt && !raid.banked.includes(id) && dist(pos[id], at) < 1.8 && dist(pos[id], pos[tgt]) < 2.4);
        if (extra.length && rng.next() < 0.45) res.touched.push(extra[0]);
      }
      if (resp === 'chain') {
        const mates = engaged(raid, pos, at, [tgt, ...raid.banked]).slice(0, 2);
        if (mates.length >= 1 && rng.next() < 0.5) { res.touched.push(mates[0]); res.chainBroke = true; }
      }
      if (resp === 'dash' && !touched && rng.next() < 0.18) { res.touched.push(tgt); res.dashOut = tgt; }
    }
  }
  res.to = dest;
  if (!res.caught) {
    raid.P = { ...dest };
    for (const id of res.touched) if (!raid.banked.includes(id)) raid.banked.push(id);
    raid.off = res.off.slice();
    raid.closure = Math.min(0.5, raid.closure + 0.09 + (action === 'run' ? 0.05 : 0));
    if (raid.P.u >= COURT.BAULK - 0.05) raid.crossed = true;
    if (action === 'block' || resp === 'block') raid.blocked = true;
  } else raid.P = { ...dest };
  if (resp === 'block') raid.blocked = true;
  if (raid.P.u >= COURT.BAULK - 0.05) raid.crossed = true;
  return res;
}

// ---------------------------------------------------------------------------------------------------------------------
// The end of a raid: points, outs, revivals, all-out. `how` is one of safe | caught | time | cant | baulk | dod.
// Returns { how, points:[a,b], outs:[ids on each team], revived:[...], allOut:team|null, label } and mutates the match.
export function endRaid(match, raid, how) {
  const rt = match.teams[raid.team], dt = match.teams[raid.def];
  const sum = { how, team: raid.team, raider: raid.raider, touches: 0, bonus: 0, defPts: 0, defOut: [], raiderOut: false, revive: { raiders: [], defenders: [] }, allOut: [], superTackle: false, superRaid: false, empty: false, label: '' };
  const st = match.stats;
  st[raid.team].raids++;
  const defCount = raid.defIds.length;
  if (how === 'safe') {
    sum.touches = raid.banked.length; sum.bonus = raid.bonus ? 1 : 0;
    if (sum.touches === 0 && !sum.bonus) {
      if (raid.dod) { sum.raiderOut = true; sum.defPts = 1; how = sum.how = 'dod'; sum.label = 'Do-or-die raid with no point: the raider is out'; }
      else { sum.empty = true; sum.label = 'Empty raid'; }
    } else {
      match.score[raid.team] += sum.touches + sum.bonus;
      sum.defOut = [...raid.banked];
      sum.superRaid = sum.touches >= 3;
      sum.label = sum.superRaid ? 'Super raid' : sum.touches ? `${sum.touches} touch${sum.touches > 1 ? 'es' : ''}${sum.bonus ? ' and the bonus' : ''}` : 'Bonus point';
      st[raid.team].success++; st[raid.team].touches += sum.touches; st[raid.team].bonus += sum.bonus; if (sum.superRaid) st[raid.team].superRaids++;
    }
  } else {
    sum.raiderOut = true;
    sum.defPts = how === 'caught' && defCount <= SUPER_TACKLE_MAX ? 2 : 1;
    sum.superTackle = how === 'caught' && defCount <= SUPER_TACKLE_MAX;
    sum.label = { caught: sum.superTackle ? 'Super tackle' : 'Tackle', time: 'Raid clock ran out', cant: 'The cant was broken', baulk: 'Did not cross the baulk line' }[how] ?? 'Raider out';
    st[raid.def].tackles += how === 'caught' ? 1 : 0; if (sum.superTackle) st[raid.def].superTackles++;
  }
  if (raid.dod) st[raid.team].dod++;
  match.score[raid.def] += sum.defPts;
  // outs
  for (const id of sum.defOut) { dt.onMat = dt.onMat.filter((x) => x !== id); dt.outQ.push(id); }
  if (sum.raiderOut) { rt.onMat = rt.onMat.filter((x) => x !== raid.raider); rt.outQ.push(raid.raider); }
  // revivals: one per touch point for the raiders (bonus points revive nobody), one per tackle (or out) for the defenders
  const nR = sum.touches, nD = sum.raiderOut ? 1 : 0;
  for (let i = 0; i < nR && rt.outQ.length; i++) { const id = rt.outQ.shift(); rt.onMat.push(id); sum.revive.raiders.push(id); }
  for (let i = 0; i < nD && dt.outQ.length; i++) { const id = dt.outQ.shift(); dt.onMat.push(id); sum.revive.defenders.push(id); }
  rt.onMat.sort((a, b) => a - b); dt.onMat.sort((a, b) => a - b);
  // empty-raid counter: any raid that is not empty resets it
  rt.empty = sum.empty ? rt.empty + 1 : 0;
  rt.rot += 1;
  // all out
  for (const t of [raid.team, raid.def]) {
    const tm = match.teams[t];
    if (tm.onMat.length === 0) {
      match.score[1 - t] += ALL_OUT_BONUS; sum.allOut.push(t); st[1 - t].allOuts++;
      tm.onMat = tm.outQ.concat(tm.onMat).sort((a, b) => a - b); tm.outQ = [];
    }
  }
  sum.points = [...match.score];
  // advance the match
  match.done[raid.team] += 1; match.raids += 1;
  match.raiding = 1 - raid.team;
  if (match.done[0] >= match.per && match.done[1] >= match.per) {
    if (match.half === 1) { match.half = 2; match.done = [0, 0]; match.raiding = match.cfg.first === 0 ? 1 : 0; sum.halfEnd = true; for (const t of match.teams) t.empty = 0; }
    else { match.over = { winner: match.score[0] === match.score[1] ? -1 : match.score[0] > match.score[1] ? 0 : 1 }; sum.matchEnd = true; }
  } else if (match.done[match.raiding] >= match.per) match.raiding = 1 - match.raiding;
  return sum;
}

export const defendersOnMat = (match, team) => match.teams[team].onMat.length;
export const clone = (o) => JSON.parse(JSON.stringify(o));

// Play one whole raid instantly with the given deciders (used by the simulations; sim.js plays the same raid with a clock).
export function playRaidInstant(match, rng, raiderBrain, defBrain, opts = {}) {
  const raid = startRaid(match, { raider: raiderBrain.pickRaider?.(match, rng), formation: defBrain.pickFormation?.(match, rng) });
  let how = null;
  for (let guard = 0; guard < 40 && !how; guard++) {
    const act = raiderBrain.chooseAction(match, raid, rng);
    if (act.action === 'retreat' && !raid.crossed) { how = 'baulk'; break; }
    if (act.action === 'timeout') { how = 'time'; break; }
    const pos = defenderPositions(raid);
    const resp = defBrain.chooseResponse(match, raid, act, pos, rng);
    const res = resolveBeat(match, raid, act.action, act.target ?? null, resp, raiderBrain.timing(rng), defBrain.timing(rng), rng);
    raid.clock -= BEAT_SECS[act.action] + (raiderBrain.think ?? 1.2);
    if (res.caught) { how = 'caught'; break; }
    if (res.escaped) { how = 'safe'; break; }
    if (raid.clock <= 0) { how = 'time'; break; }
  }
  if (!how) how = 'time';
  return { raid, sum: endRaid(match, raid, how) };
}
