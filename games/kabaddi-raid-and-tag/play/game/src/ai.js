// The opponents (five levels) and the Think hint. They use the very same probability functions the match uses (rules.js), so what
// the hint says is true. Levels differ in how well they weigh risk, how well they read a feint, how often they slip, and how
// well they time the contact. They were calibrated by simulation: each level beats the one below (see verify/calibrate.mjs).
import {
  COURT, ACTIONS, RESPONSES, TOUCH_ACTIONS, BEAT_SECS, FORMATIONS, FORMATION_NAME, ACTION_NAME, RESPONSE_NAME, SUPER_TACKLE_MAX,
  defenderPositions, validTargets, available, touchProb, catchProb, raiderDestination, raiderOf, defenderOf, startRaid, bonusLive,
} from './rules.js';

export const LEVELS = [
  { name: 'Rookie', tag: 'Still learning the lines', stars: 1, tau: 1.5, qMean: 0.30, qSd: 0.28, model: 'uniform', feint: 0, slip: 0.30, think: 1.6 },
  { name: 'Club', tag: 'Plays every weekend', stars: 2, tau: 0.8, qMean: 0.38, qSd: 0.25, model: 'uniform', feint: 0, slip: 0.14, think: 1.4 },
  { name: 'Regional', tag: 'Reads a feint now and then', stars: 3, tau: 0.5, qMean: 0.47, qSd: 0.22, model: 'soft', feint: 0.15, slip: 0.05, think: 1.2 },
  { name: 'Expert', tag: 'Tracks what you do', stars: 4, tau: 0.28, qMean: 0.56, qSd: 0.2, model: 'soft', feint: 'history', slip: 0.02, think: 1.0 },
  { name: 'Champion', tag: 'Weighs every risk', stars: 5, tau: 0.12, qMean: 0.66, qSd: 0.16, model: 'minimax', feint: 'history', slip: 0.0, think: 0.9 },
];

const PT = 2.0, PB = 1.0;
const lossCaught = (raid) => 3.4 + (raid.defIds.length <= SUPER_TACKLE_MAX ? 1 : 0);
const gauss = (rng) => (rng.next() + rng.next() + rng.next() - 1.5) * 2;   // ~N(0,1) in [-3,3]
const softPick = (items, scoreOf, tau, rng) => {
  const sc = items.map(scoreOf), mx = Math.max(...sc);
  if (tau <= 0.001) return items[sc.indexOf(mx)];
  const w = sc.map((s) => Math.exp((s - mx) / tau)), tot = w.reduce((a, b) => a + b, 0);
  let r = rng.next() * tot;
  for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
};

// Value of being at raid state `st` (position, banked touches, bonus) and heading home now.
function homeValue(match, raid, st) {
  const R = { ...raid, P: st.P, banked: st.banked, bonus: st.bonus, crossed: st.crossed, closure: st.closure ?? raid.closure, beat: st.beat ?? raid.beat };
  const pos = defenderPositions(R);
  const pc = st.crossed ? catchProb(match, R, 'retreat', null, 'thigh', 0.5, pos) : 0.6;
  const pcBlock = st.crossed ? catchProb(match, R, 'retreat', null, 'block', 0.5, pos) : 0.6;
  const pe = 1 - 0.5 * (pc + pcBlock) * 0.75 - 0.25 * pc;
  const pts = PT * st.banked.length + PB * (st.bonus ? 1 : 0);
  const empty = st.banked.length === 0 && !st.bonus;
  const lc = lossCaught(raid);
  const base = empty ? (raid.dod ? -lc : 0) : pts;
  return pe * base - (1 - pe) * lc + (st.crossed ? 0 : -0.25);
}

// Raider's expected value for an action against one specific response.
export function raiderEV(match, raid, action, tgt, resp, pos) {
  const lc = lossCaught(raid);
  const st0 = { P: raid.P, banked: raid.banked, bonus: raid.bonus, crossed: raid.crossed };
  if (action === 'retreat') {
    const pc = catchProb(match, raid, 'retreat', null, resp, 0.5, pos);
    const pts = PT * raid.banked.length + PB * (raid.bonus ? 1 : 0);
    const empty = raid.banked.length === 0 && !raid.bonus;
    return (1 - pc) * (empty ? (raid.dod ? -lc : 0) : pts) - pc * lc;
  }
  const dest = raiderDestination(raid, action, tgt, pos);
  const crossed = raid.crossed || dest.u >= COURT.BAULK - 0.05;
  const pc = catchProb(match, raid, action, tgt, resp, 0.5, pos, dest);
  const left = raid.clock - BEAT_SECS[action] - 1.0;
  const canGetHome = left >= BEAT_SECS.retreat;
  const after = (banked, bonus, extra = 0) => {
    const stt = { P: dest, banked, bonus, crossed, closure: Math.min(0.5, raid.closure + 0.09), beat: raid.beat + 1 };
    return canGetHome ? homeValue(match, raid, stt) + extra : -lc;
  };
  if (action === 'bonus') {
    const pb = touchProb(match, raid, 'bonus', null, resp, 0.5, pos);
    return (1 - pc) * (pb * after(raid.banked, true) + (1 - pb) * after(raid.banked, false)) - pc * lc;
  }
  if (action === 'step') return (1 - pc) * after(raid.banked, raid.bonus) - pc * lc;
  if (action === 'feintL' || action === 'feintR') {
    const committed = resp === 'ankle' || resp === 'thigh' || resp === 'chain' || resp === 'dash';
    return (1 - pc) * (after(raid.banked, raid.bonus, committed ? 0.55 : -0.05)) - pc * lc;
  }
  const pt = touchProb(match, raid, action, tgt, resp, 0.5, pos);
  const b2 = raid.banked.includes(tgt) ? raid.banked : [...raid.banked, tgt];
  return (1 - pc) * (pt * after(b2, raid.bonus) + (1 - pt) * after(raid.banked, raid.bonus)) - pc * lc;
}

const candidateActions = (match, raid, pos) => {
  const av = available(raid), out = [];
  for (const a of ACTIONS) {
    if (av[a]) continue;
    if (TOUCH_ACTIONS.includes(a)) for (const t of validTargets(raid)) out.push({ action: a, target: t });
    else out.push({ action: a, target: null });
  }
  return out;
};

// How the defence is expected to answer (from the raider's view): a mix over responses.
function respWeights(match, raid, c, pos, level, mode) {
  const evs = RESPONSES.map((r) => raiderEV(match, raid, c.action, c.target, r, pos));
  if (mode === 'uniform') return RESPONSES.map(() => 1 / RESPONSES.length).map((w, i) => ({ r: RESPONSES[i], w, ev: evs[i] }));
  const tau = mode === 'minimax' ? 0.15 : 0.5;
  const mn = Math.min(...evs);
  const ws = evs.map((e) => Math.exp(-(e - mn) / tau)), tot = ws.reduce((a, b) => a + b, 0);
  return RESPONSES.map((r, i) => ({ r, w: ws[i] / tot, ev: evs[i] }));
}
const mixEV = (rw) => rw.reduce((s, x) => s + x.w * x.ev, 0);

export function rateRaider(match, raid, pos, mode = 'minimax') {
  return candidateActions(match, raid, pos).map((c) => {
    const rw = respWeights(match, raid, c, pos, 4, mode);
    return { ...c, ev: mixEV(rw), rw };
  });
}

// Time pressure: nobody can retreat when the clock cannot cover the way home.
const timePressure = (raid) => raid.clock < BEAT_SECS.retreat + 1.2;

export function suggestRaid(match, raid) {
  const pos = defenderPositions(raid);
  const rated = rateRaider(match, raid, pos, 'minimax');
  let best = null;
  for (const c of rated) {
    let ev = c.ev;
    if (timePressure(raid) && c.action !== 'retreat' && raid.crossed) ev -= 3;
    if (!best || ev > best.ev) best = { ...c, ev };
  }
  const pot = rated.slice().sort((a, b) => b.ev - a.ev);
  return { ...best, alts: pot.filter((c) => !(c.action === best.action && c.target === best.target)).slice(0, 2), pos };
}

// The defence's answer to what it sees. `tele` = { action (as shown, a feint is shown as a touch), target, disguised }.
export function responseEVs(match, raid, tele, pos, pFeint) {
  const real = TOUCH_ACTIONS.includes(tele.action) && tele.target == null ? 'step' : tele.action;
  return RESPONSES.map((r) => {
    if (real === 'retreat') return { r, ev: -raiderEV(match, raid, 'retreat', null, r, pos) };
    const evReal = raiderEV(match, raid, real, tele.target, r, pos);
    let ev = evReal;
    if (pFeint > 0) {
      const fe = raiderEV(match, raid, 'feintL', tele.target, r, pos);
      ev = (1 - pFeint) * evReal + pFeint * fe;
    }
    return { r, ev: -ev };
  });
}

export function feintRate(raid) {
  const h = raid.history;
  if (!h.length) return 0.2;
  const f = h.filter((a) => a === 'feintL' || a === 'feintR').length;
  return Math.min(0.6, (f + 0.5) / (h.length + 2.5));
}

export function suggestResponse(match, raid, tele) {
  const pos = defenderPositions(raid);
  const evs = responseEVs(match, raid, tele, pos, tele.action === 'retreat' ? 0 : feintRate(raid));
  evs.sort((a, b) => b.ev - a.ev);
  return { resp: evs[0].r, evs, pos };
}

export function formationScores(match, raid0) {
  return FORMATIONS.map((f) => {
    const raid = { ...raid0, form: f, P: { x: COURT.W / 2, u: 0 }, history: [], banked: [], closure: 0, off: [], crossed: false, bonus: false, beat: 0 };
    const pos = defenderPositions(raid);
    const rated = rateRaider(match, raid, pos, 'minimax').filter((c) => c.action !== 'retreat');
    const best = rated.reduce((m, c) => Math.max(m, c.ev), -9);
    return { f, ev: -best };
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// A brain with the interface playRaidInstant and sim.js use.
export function makeBrain(levelIdx) {
  const L = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelIdx | 0))];
  return {
    level: L, think: L.think,
    timing: (rng) => Math.max(0, Math.min(1, L.qMean + L.qSd * gauss(rng) * 0.6)),
    pickRaider(match, rng) {
      const raid = match.raiding, t = match.teams[raid];
      const dod = t.empty >= 2;
      if (levelIdx >= 2 || dod) {
        let best = t.onMat[0], bs = -1;
        for (const id of t.onMat) { const p = t.players[id], s = (p.spd + p.agi + p.rch) / 3 + (id === t.last ? -0.15 : 0); if (s > bs) { bs = s; best = id; } }
        return best;
      }
      return t.onMat[t.rot % t.onMat.length];
    },
    pickFormation(match, rng) {
      const raid = startRaid(match, {});
      if (rng.next() < L.slip) return FORMATIONS[Math.floor(rng.next() * FORMATIONS.length)];
      if (levelIdx < 2) return FORMATIONS[Math.floor(rng.next() * 2) === 0 ? 0 : 1];
      const sc = formationScores(match, raid);
      return softPick(sc, (s) => s.ev, L.tau * 0.5, rng).f;
    },
    chooseAction(match, raid, rng) {
      if (raid.clock <= 0) return { action: 'timeout', target: null };
      const pos = defenderPositions(raid);
      const mode = L.model;
      const rated = rateRaider(match, raid, pos, mode);
      const adj = rated.map((c) => {
        let ev = c.ev;
        if (timePressure(raid) && c.action !== 'retreat' && raid.crossed) ev -= 3;
        return { ...c, ev };
      });
      if (rng.next() < L.slip) {
        const pool = adj.filter((c) => c.action !== 'retreat' || raid.crossed);
        return pool[Math.floor(rng.next() * pool.length)] ?? adj[0];
      }
      const pick = softPick(adj, (c) => c.ev, L.tau, rng);
      return { action: pick.action, target: pick.target };
    },
    chooseResponse(match, raid, act, pos, rng) {
      if (rng.next() < L.slip) return RESPONSES[Math.floor(rng.next() * RESPONSES.length)];
      const seen = act.action === 'feintL' || act.action === 'feintR' ? disguise(act, raid, rng) : act;
      const pf = L.feint === 0 ? 0 : L.feint === 'history' ? feintRate(raid) : L.feint;
      const evs = responseEVs(match, raid, { action: seen.action, target: seen.target }, pos, seen.action === 'retreat' ? 0 : pf);
      if (L.model === 'uniform' && rng.next() < 0.5) return RESPONSES[Math.floor(rng.next() * RESPONSES.length)];
      return softPick(evs, (e) => e.ev, L.tau, rng).r;
    },
  };
}

// A feint is shown to the defence as a touch toward a defender (the raider's own approach).
export function disguise(act, raid, rng) {
  const pos = defenderPositions(raid);
  let best = null, bd = 1e9;
  for (const id of validTargets(raid)) { const d = Math.hypot(pos[id].x - raid.P.x, pos[id].u - raid.P.u); if (d < bd) { bd = d; best = id; } }
  const types = TOUCH_ACTIONS;
  return { action: types[Math.floor(rng.next() * types.length)], target: act.target ?? best, disguised: true };
}

// ---------------------------------------------------------------------------------------------------------------------
// Plain-English reasons. Every figure is computed from the same functions the match uses.
const pct = (p) => `${Math.round(p * 10) * 10}%`;
export function explainRaid(match, raid, pick) {
  const R = raiderOf(match, raid);
  const pos = pick.pos ?? defenderPositions(raid);
  const lines = [];
  const b = raid.banked.length;
  if (pick.action === 'step') {
    lines.push('Cross the baulk line (3.75 m from the midline) first: you may not go home without it.');
    lines.push('Step in now while the chain is still wide.');
  } else if (pick.action === 'retreat') {
    const pc = catchProb(match, raid, 'retreat', null, 'thigh', 0.5, pos);
    if (b || raid.bonus) lines.push(`${b ? `${b} touch${b > 1 ? 'es' : ''}` : 'The bonus point'} banked: they only count if you get home.`);
    lines.push(`The way home is about ${pct(1 - pc)} safe, and it gets worse the longer the chain closes.`);
    if (raid.clock < 9) lines.push(`Only ${Math.max(0, Math.round(raid.clock))} s left on the raid clock.`);
    if (raid.dod && !b && !raid.bonus) lines.push('A do-or-die raid with no point costs you the raider.');
  } else if (pick.action === 'bonus') {
    const pb = touchProb(match, raid, 'bonus', null, 'thigh', 0.5, pos);
    lines.push(`${raid.defIds.length} defenders are on the mat, so the bonus line is live: about ${pct(pb)} to reach it and come back.`);
    lines.push('Take it before any touch: after a touch it no longer counts.');
  } else if (pick.action === 'feintL' || pick.action === 'feintR') {
    const t = pick.target;
    lines.push('A feint costs little and pulls a defender off balance if he commits to a hold.');
    lines.push(`His reaction opens the next touch: about +20% to score on a defender who lunged.`);
    if (raid.beat === 0) lines.push('Nobody has seen how you move yet, so a first feint reads the defence.');
  } else {
    const t = pick.target, D = defenderOf(match, raid, t);
    const pt = touchProb(match, raid, pick.action, t, 'thigh', 0.5, pos), pc = catchProb(match, raid, pick.action, t, 'thigh', 0.5, pos, raiderDestination(raid, pick.action, t, pos));
    lines.push(`${ACTION_NAME[pick.action]} on #${D.num}: about ${pct(pt)} to score against a thigh hold, about ${pct(pc)} to be held.`);
    const alt = D.alt, mine = R.rch;
    lines.push(alt <= 0.6 ? `#${D.num} is not very alert, so he is the weak link.` : `#${D.num} is the best-placed target on the chain.`);
    if (pick.action === 'toe') lines.push('A toe touch keeps your upper body out of reach, but it is weak against an ankle hold.');
    if (pick.action === 'hand') lines.push('A hand touch is quick, but a defender who goes low for your ankle will miss your hand.');
    if (pick.action === 'run') lines.push('A running touch can tag two defenders, but it takes you deeper and farther from home.');
  }
  return lines;
}

export function explainResponse(match, raid, tele, pick) {
  const pos = pick.pos ?? defenderPositions(raid);
  const lines = [];
  const act = tele.action;
  if (act === 'retreat') {
    lines.push('He is running for the midline: block the exit or hold his legs now.');
  } else {
    const who = tele.target != null ? ` on #${defenderOf(match, raid, tele.target).num}` : '';
    lines.push(`${RESPONSE_NAME[pick.resp]} is the best answer to a ${ACTION_NAME[act].toLowerCase()}${who}.`);
    const fr = feintRate(raid);
    lines.push(fr > 0.3 ? 'He has been feinting a lot: do not over-commit.' : 'A feint looks like a touch: a lunge that finds nothing leaves you off balance.');
  }
  const names = { ankle: 'Low and fast, strong against a toe touch.', thigh: 'Holds a raider who has committed forward.', chain: 'Needs defenders within reach of each other; if it fails the chain can be touched.', block: 'Cuts the way home for the next move and makes this one safe.', dash: 'Fast, strong against a step or a touch, but the dasher can be touched.', hold: 'Step back out of reach: safe, but the raider keeps his options.' };
  lines.push(names[pick.resp]);
  return lines;
}

export function explainFormation(match, raid, f) {
  return {
    arc: 'A half circle keeps every gap covered and corner defenders deep for the way home.',
    line: 'A front line shuts the baulk line: short raids end quickly, but a raider who gets through finds the back empty.',
    deep: 'Deep cover makes the way home long: a raider who goes for the bonus has to come back past everyone.',
    pincer: 'The corners trap a raider who enters the open middle; he can score on the sides, though.',
  }[f];
}
export { FORMATION_NAME };
