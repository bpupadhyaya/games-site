// The computer's coach: which play to call, which defence to call, what to do on fourth down and after a touchdown, and the reasons the Think hint
// gives the player. Every number a reason quotes comes from the simulated play matrix (verify/matrix.mjs writes web/src/matrix.js), never from guesses.
import { LEVELS, FIELD } from './consts.js';
import { MATRIX } from './matrix.js';
import { OFF_PLAYS, DEF_CALLS } from './plays.js';
import { canKickFG, fieldGoalChance, fieldGoalDistance } from './match.js';
import { clamp } from './geo.js';

const OI = (id) => MATRIX.off.indexOf(id), DI = (id) => MATRIX.def.indexOf(id);
export const cellMean = (o, d) => MATRIX.mean[OI(o)][DI(d)];
export const cell = (k, o, d) => MATRIX[k][OI(o)][DI(d)];

// ---- what the opponent tends to call (counts this game plus a situational prior) ---------------------------------------------------------------
export function offPrior(down, toGo) {
  const w = {};
  for (const p of OFF_PLAYS) w[p.id] = 1;
  if (toGo >= 8) { w.deep += 1.2; w.quick += 1; w.screen += 0.4; w.playaction += 0.5; w.inside -= 0.5; w.jet -= 0.4; w.qbdraw -= 0.5; }
  else if (toGo <= 3) { w.inside += 1.4; w.qbdraw += 0.7; w.outside += 0.6; w.jet += 0.4; w.deep -= 0.4; w.screen -= 0.4; }
  else { w.inside += 0.4; w.quick += 0.5; w.outside += 0.4; w.playaction += 0.2; }
  if (down === 1) { w.inside += 0.3; w.playaction += 0.4; }
  for (const k in w) w[k] = Math.max(0.15, w[k]);
  return w;
}
export function defPrior(down, toGo) {
  const w = {};
  for (const c of DEF_CALLS) w[c.id] = 1;
  if (toGo >= 8) { w.prevent += 0.5; w.zone += 0.5; w.blitz += 0.3; }
  else if (toGo <= 3) { w.runstop += 1.2; w.man += 0.3; w.blitz += 0.2; }
  else { w.zone += 0.4; w.man += 0.4; }
  return w;
}
// tendencies: counts of what the opponent called so far this game, blended with the prior
function blend(prior, history) {
  const w = { ...prior };
  const n = history.length;
  for (const id of history) w[id] = (w[id] || 0) + 2.2 / Math.max(1, Math.sqrt(n));
  const tot = Object.values(w).reduce((a, b) => a + b, 0);
  const out = {}; for (const k in w) out[k] = w[k] / tot;
  return out;
}

// ---- how good a play is in a situation ---------------------------------------------------------------------------------------------------------
// value of an offence call against one defence call: the chance of the gain that the situation needs, plus the average gain, minus the cost of a turnover
export function playValue(o, d, down, toGo, yl) {
  const need = Math.min(toGo, FIELD.LEN - yl);
  const pk = need <= 3 ? 'p3' : need <= 6 ? 'p6' : 'p10';
  const pNeed = cell(pk, o, d);
  const mean = cell('mean', o, d);
  const to = cell('to', o, d);
  const wNeed = down >= 3 ? 7 : down === 2 ? 4 : 2.5;
  return wNeed * pNeed + 0.55 * mean - 11 * to;
}
export function expectedValue(o, down, toGo, yl, defDist) {
  let v = 0;
  for (const d of MATRIX.def) v += (defDist[d] || 0) * playValue(o, d, down, toGo, yl);
  return v;
}

function softPick(rng, ids, scores, temp) {
  const mx = Math.max(...scores);
  const w = scores.map((s) => Math.exp((s - mx) / temp));
  const tot = w.reduce((a, b) => a + b, 0);
  let u = rng.next() * tot;
  for (let i = 0; i < ids.length; i++) { u -= w[i]; if (u <= 0) return ids[i]; }
  return ids[ids.length - 1];
}

export function chooseOffense(rng, M, level) {
  const L = LEVELS[level];
  const hist = M.calls[1 - M.poss].def;                           // what the other side has called on defence recently
  const dist = blend(defPrior(M.down, M.toGo), hist.slice(-12));
  const ids = OFF_PLAYS.map((p) => p.id);
  const scores = ids.map((o) => expectedValue(o, M.down, M.toGo, M.yl, dist));
  const temp = 2.6 * (1 - L.call) + 0.45;
  return softPick(rng, ids, scores, temp);
}
export function chooseDefense(rng, M, level) {
  const L = LEVELS[level];
  const hist = M.calls[M.poss].off;
  const prior = offPrior(M.down, M.toGo);
  const dist = blend(prior, hist.slice(-12));
  const ids = DEF_CALLS.map((c) => c.id);
  // the defence wants the lowest offence value, averaged over what it expects the offence to call
  const scores = ids.map((d) => { let v = 0; for (const o of MATRIX.off) v += (dist[o] || 0) * playValue(o, d, M.down, M.toGo, M.yl); return -v; });
  const temp = 2.6 * (1 - L.call) + 0.45;
  return softPick(rng, ids, scores, temp);
}

// ---- fourth down, tries ---------------------------------------------------------------------------------------------------------------------------
export function fourthOptions(M) {
  const o = { go: true, punt: M.yl < FIELD.LEN - 3, fg: canKickFG(M.yl) };
  o.fgDist = fieldGoalDistance(M.yl);
  o.fgChance = o.fg ? fieldGoalChance(M, M.poss, M.yl) : 0;
  return o;
}
export function chooseFourth(rng, M, level) {
  const L = LEVELS[level], o = fourthOptions(M);
  const team = M.poss, diff = M.score[team] - M.score[1 - team];
  const late = M.q === 4 && M.clock < 50;
  if (late && diff < 0 && diff > -4 && o.fg && M.toGo > 3) return 'fg';
  if (late && diff < -3) return 'go';
  if (o.fg && o.fgChance >= 0.55 && !(late && diff <= -4)) return 'fg';
  if (M.toGo <= 2 && M.yl >= 14 && L.call > 0.3) return 'go';
  if (M.toGo <= 1 && L.call > 0.0 && M.yl >= 10) return 'go';
  if (o.punt) return 'punt';
  return o.fg ? 'fg' : 'go';
}
export function chooseTry(rng, M, level) {
  const t = M.tryFor, L = LEVELS[level];
  const d = M.score[t] - M.score[1 - t];          // after the touchdown, before the try
  // late in the game, two points are worth the risk when they tie the game or take a lead a field goal cannot erase
  if (M.q === 4 && L.call > 0.5 && (d === -2 || d === -5 || d === 1 || d === 5)) return 'two';
  return 'kick';
}

// ---- reasons for the Think hint ------------------------------------------------------------------------------------------------------------------
const NAME = {}; for (const p of OFF_PLAYS) NAME[p.id] = p.name; for (const c of DEF_CALLS) NAME[c.id] = c.name;
export const callName = (id) => NAME[id] || id;
export function thinkOffense(M) {
  const hist = M.calls[1 - M.poss].def.slice(-12);
  const dist = blend(defPrior(M.down, M.toGo), hist);
  const ids = OFF_PLAYS.map((p) => p.id);
  const sc = ids.map((o) => ({ id: o, v: expectedValue(o, M.down, M.toGo, M.yl, dist) })).sort((a, b) => b.v - a.v);
  const best = sc[0].id;
  const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
  const need = Math.min(M.toGo, FIELD.LEN - M.yl);
  const lines = [`Suggested play: ${callName(best)}.`];
  const bestDef = MATRIX.def.map((d) => ({ d, m: cellMean(best, d) }));
  const good = bestDef.sort((a, b) => b.m - a.m)[0], bad = bestDef.sort((a, b) => a.m - b.m)[0];
  lines.push(`In ${MATRIX.n} simulated plays on each pair, ${callName(best)} averaged ${cellMean(best, top[0]).toFixed(1)} yards against ${callName(top[0])}, the defence you are most likely to face (${Math.round(top[1] * 100)}% by the situation and what it has called).`);
  const pk = need <= 3 ? 'p3' : need <= 6 ? 'p6' : 'p10';
  lines.push(`You need ${need} yards: it got them ${Math.round(cell(pk, best, top[0]) * 100)}% of the time against that call.`);
  lines.push(`Its best answer is ${callName(bad.d)} (${bad.m.toFixed(1)} yards on average); it works best against ${callName(good.d)} (${good.m.toFixed(1)}).`);
  return { best, lines };
}
export function thinkDefense(M) {
  const hist = M.calls[M.poss].off.slice(-12);
  const dist = blend(offPrior(M.down, M.toGo), hist);
  const ids = DEF_CALLS.map((c) => c.id);
  const sc = ids.map((d) => { let v = 0; for (const o of MATRIX.off) v += (dist[o] || 0) * playValue(o, d, M.down, M.toGo, M.yl); return { id: d, v: -v }; }).sort((a, b) => b.v - a.v);
  const best = sc[0].id;
  const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
  const lines = [`Suggested call: ${callName(best)}.`];
  lines.push(`The offence is most likely to call ${callName(top[0])} (${Math.round(top[1] * 100)}% by the situation and its last calls); against ${callName(best)} that play averaged ${cellMean(top[0], best).toFixed(1)} yards in ${MATRIX.n} simulated plays, against ${callName(sc[sc.length - 1].id)} it averaged ${cellMean(top[0], sc[sc.length - 1].id).toFixed(1)}.`);
  return { best, lines };
}
export const clampN = clamp;

// A sentence about how a call did in the simulated plays (generated from the matrix, so it can never disagree with it).
export function matrixNote(kind, id) {
  const y = (v) => `${v.toFixed(1)} yd`;
  if (kind === 'off') {
    const row = MATRIX.def.map((d) => ({ d, v: cellMean(id, d) })).sort((a, b) => b.v - a.v);
    return `In ${MATRIX.n} simulated plays against each defence it gained most against ${callName(row[0].d)} (${y(row[0].v)}) and least against ${callName(row[row.length - 1].d)} (${y(row[row.length - 1].v)}).`;
  }
  const col = MATRIX.off.map((o) => ({ o, v: cellMean(o, id) })).sort((a, b) => a.v - b.v);
  return `In ${MATRIX.n} simulated plays per pair it allowed the least to ${callName(col[0].o)} (${y(col[0].v)}) and the most to ${callName(col[col.length - 1].o)} (${y(col[col.length - 1].v)}).`;
}
