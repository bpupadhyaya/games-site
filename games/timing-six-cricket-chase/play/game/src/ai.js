// Opponent and assistant brains: bowling plan, captain's field, batting shot choice, run decisions.
// All deterministic given the rng handed in. Analysis uses a private fixed-seed rng so asking "what would
// the AI do" (Think, Auto Play) never disturbs the match's own random streams.
import { THEMES, LEVELS, clamp, lerp, DEG } from './core.js';
import { TYPES, makeSpec, resolveSwing, idealAngle, shotName, trackPos } from './ball.js';
import { evalShot, throwTime, safeRuns, sectorOf, SECTOR_NAMES, PRESETS } from './field.js';

export function localRng(seed = 7) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, range: (lo, hi) => lo + (hi - lo) * next(), int: (n) => Math.floor(next() * n), chance: (p) => next() < p, pick: (arr) => arr[Math.floor(next() * arr.length)], shuffle: (arr) => { const o = arr.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; } };
}

const gauss = (r) => (r.next() + r.next() + r.next() - 1.5) * 2;

// ---- bowling -----------------------------------------------------------------------------------------------
export function planDelivery(m, bowler, rng) {
  const i = m.inn, lvl = LEVELS[m.lvl];
  const f = i.maxBalls ? i.balls / i.maxBalls : 0;
  const pace = bowler.kind === 'pace';
  const w = { pace: 0, inswing: 0, outswing: 0, offspin: 0, legspin: 0, bouncer: 0, yorker: 0, slower: 0, fulltoss: 0, wide: 0 };
  if (pace) {
    Object.assign(w, { pace: 2.2, inswing: 1.4, outswing: 1.4, bouncer: 0.7, yorker: 0.7, slower: 0.7, fulltoss: 0.12, wide: 0.1 });
    if (f < 0.25 && m.overs >= 3) { w.inswing += 1; w.outswing += 1; w.pace += 0.6; w.yorker -= 0.3; }
  } else {
    Object.assign(w, { offspin: 2.0, legspin: 2.0, slower: 0.6, pace: 0.5, fulltoss: 0.1, wide: 0.08 });
  }
  const need = i.target != null ? i.target - i.runs : 0;
  const rrr = i.target != null ? (need / Math.max(1, i.maxBalls - i.balls)) * 6 : 8;
  if (f > 0.75) { w.yorker += 1.6; w.slower += 1.0; w.bouncer += 0.2; w.wide += 0.25; w.pace *= 0.7; }
  if (rrr > 11) { w.yorker += 0.5; w.slower += 0.3; }
  if (!m.rules.extras) { w.wide = 0; w.fulltoss *= 0.4; }
  if (i.shorts >= 2) w.bouncer = 0;
  if (m.inn.fh) { w.wide = 0; w.fulltoss = 0; }
  const last = i.recent[i.recent.length - 1];
  const last2 = i.recent[i.recent.length - 2];
  if (last) w[last] *= 0.35;
  if (last && last === last2) w[last] = 0;
  const keys = Object.keys(w).filter((k) => w[k] > 0);
  let tot = 0; keys.forEach((k) => { tot += w[k]; });
  let r = rng.next() * tot, type = keys[0];
  for (const k of keys) { r -= w[k]; if (r <= 0) { type = k; break; } }
  const hand = 1;
  const spec = makeSpec(type, rng, lvl.acc, hand);
  // bowl away from where the batter scores
  const zr = i.zoneRuns;
  const offRuns = zr[1] + zr[2] + zr[3], legRuns = zr[5] + zr[6] + zr[7], strRuns = zr[0];
  const tot2 = offRuns + legRuns + strRuns + 0.001;
  let why = '';
  if (tot2 > 8 && lvl.fieldIq > 0.3) {
    if (offRuns / tot2 > 0.55) { spec.bx -= 0.28 * lvl.fieldIq; why = 'Batter scores off the off side: bowling straighter.'; }
    else if (legRuns / tot2 > 0.5) { spec.bx += 0.28 * lvl.fieldIq; why = 'Batter scores on the leg side: bowling wider.'; }
  }
  if (i.fh && m.rules.extras) why = 'Free hit: bowling for the stumps.';
  return { spec, why };
}

export function captainPreset(m, bowler, rng) {
  const i = m.inn, lvl = LEVELS[m.lvl];
  const f = i.balls / i.maxBalls;
  const rrr = i.target != null ? ((i.target - i.runs) / Math.max(1, i.maxBalls - i.balls)) * 6 : 8;
  const opts = [];
  if (lvl.fieldIq < 0.3) return rng.pick(['balanced', 'balanced', 'defensive', 'attacking']);
  if (f < 0.25 && m.overs >= 3) opts.push('powerplay', 'attacking');
  else if (f > 0.78) opts.push('guard', 'defensive');
  else opts.push(bowler.kind === 'spin' ? 'spinring' : 'balanced');
  if (rrr > 11 && f < 0.75) opts.push('attacking');
  if (rrr < 6.5 && f > 0.3) opts.push('defensive', 'guard');
  if (bowler.kind === 'spin' && f > 0.25 && f < 0.78) opts.push('spinring');
  if (m.theme === 'backyard') { return rng.pick(['balanced', 'attacking', 'defensive']); }
  return rng.pick(opts);
}

// ---- batting ----------------------------------------------------------------------------------------------
const lengthWord = { fulltoss: 'a full toss', yorker: 'a yorker', full: 'full', good: 'a good length', short: 'short', bouncer: 'a bouncer' };
export const lineWord = (x) => (x < -0.3 ? 'on the pads' : x < 0.2 ? 'on the stumps' : x < 0.75 ? 'just outside off' : x < 1.2 ? 'wide of off' : 'well wide');

export function wicketValue(m) {
  const i = m.inn;
  const rrr = i.target != null ? ((i.target - i.runs) / Math.max(1, i.maxBalls - i.balls)) * 6 : 8;
  const left = i.maxWk - i.wk;
  return clamp(26 - rrr * 1.6 - (left <= 1 ? -8 : 0), 4, 30) * (i.fh && m.rules.extras ? 0 : 1);
}

export function planBat(m, d, rng, skillOver = null) {
  const lvl = LEVELS[m.lvl];
  const skill = skillOver ?? (m.ai && m.inn.role === 'bat' ? 0.72 : lvl.aiSkill);
  const i = m.inn;
  const q = { next: () => 0.5, range: (lo, hi) => (lo + hi) / 2, chance: () => false, pick: (x) => x[0], int: () => 0 };
  const runTime = THEMES[m.theme].runLen / 7.4;
  const phi = idealAngle(d.xc, d.yc, d.bounced);
  const wv = wicketValue(m);
  const cands = [];
  const rrr = i.target != null ? ((i.target - i.runs) / Math.max(1, i.maxBalls - i.balls)) * 6 : 8;
  const fh = i.fh && m.rules.extras;
  const sigma0 = lerp(0.078, 0.022, skill);
  const evalOne = (a, pw, terr) => {
    const res = resolveSwing(d, { kind: 'swing', t: d.tC - 0.05 + terr, angle: a, power: pw }, m.theme, q, 1);
    if (!res.contact) return { value: d.bowled && !fh ? -wv : 0, runs: 0, boundary: 0, caught: 0, pOut: d.bowled ? 1 : 0, res, miss: true };
    const ev = evalShot(res.init, m.field, m.theme, lvl, m.rules, runTime, 0.3);
    const runsEff = ev.boundary ? ev.boundary : ev.runs;
    let pOut = ev.caught;
    if (res.kind === 'edge' && !ev.boundary && !ev.caught) pOut = Math.max(pOut, 0.35);
    if (m.rules.sixOut && ev.boundary === 6 && !fh) pOut = 1;
    return { value: runsEff - wv * pOut, runs: ev.runs, boundary: ev.boundary, caught: ev.caught, pOut, res, ev };
  };
  for (let a = phi - 44; a <= phi + 44.1; a += 11) {
    for (const pw of [0.3, 0.55, 0.7, 0.85, 1.0]) {
      const c = evalOne(a, pw, 0);
      if (c.miss) continue;
      cands.push({ a, pw, ...c });
    }
  }
  cands.sort((x, y) => y.value - x.value);
  // refine the leaders against the batter's own timing error (what the shot is worth when it is not perfect)
  const sig = [-1.7, -0.85, 0, 0.85, 1.7];
  const wts = [0.1, 0.25, 0.3, 0.25, 0.1];
  for (const c of cands.slice(0, 8)) {
    let v = 0, po = 0;
    sig.forEach((k, j) => { const r = evalOne(c.a, c.pw, k * sigma0); v += r.value * wts[j]; po += r.pOut * wts[j]; });
    c.value = v; c.pOut = po;
  }
  cands.sort((x, y) => y.value - x.value);
  const noise = (1 - skill) * 1.4;
  let best = null;
  for (const c of cands.slice(0, 8)) { const v = c.value + gauss(rng) * noise * 0.5; if (!best || v > best.v) best = { v, c }; }
  // alternatives
  const wideBall = d.xc > 1.28 || d.yc > 2.0 || d.xc < -1.0;
  const hitsStumps = d.bowled;
  let kind = 'swing', angle = phi, power = 0.55;
  const blockValue = 0.25 + (d.lengthClass === 'yorker' ? 0.5 : 0) + (rrr < 6 ? 0.4 : 0) - (rrr > 11 ? 1.0 : 0);
  const leaveValue = wideBall && !hitsStumps ? 0.35 : -99;
  const bestV = best ? best.c.value : -99;
  const reasons = [];
  reasons.push(`The bowler: ${TYPES[d.spec.type].name}, ${lengthWord[d.lengthClass] ?? d.lengthClass}, ${lineWord(d.xc)}.`);
  if (PRESETS[m.fieldKey]) reasons.push(`The field is set ${PRESETS[m.fieldKey].name.toLowerCase()}: ${PRESETS[m.fieldKey].blurb.toLowerCase()}${m.fieldNotes?.length ? ' ' + m.fieldNotes[0] + '.' : ''}`);
  if (leaveValue > bestV && leaveValue > blockValue) { kind = 'leave'; reasons.push(wideBall ? 'It is too wide or too high to hit safely: leave it alone.' : 'Nothing to hit.'); }
  else if (!best || blockValue > bestV) {
    kind = 'block';
    reasons.push(d.lengthClass === 'yorker' ? 'A yorker at the toes: dig it out with a straight bat.' : 'No scoring shot is worth the risk here: defend.');
  } else {
    const c = best.c;
    angle = c.a; power = c.pw;
    const near = nearestFielder(m, c.ev?.plan?.pos);
    const shot = shotName(c.res.angle, c.res.elev, d, 'hit');
    const dirWord = Math.abs(angle) < 18 ? 'straight' : angle > 0 ? 'to the off side' : 'to the leg side';
    reasons.push(c.boundary ? `A gap ${dirWord === 'straight' ? 'straight down the ground' : dirWord + ' (' + SECTOR_NAMES[sectorOf(angle)] + ')'}: no fielder can stop it.` : c.runs ? `The field is thin ${dirWord}: ${c.runs} safe run${c.runs > 1 ? 's' : ''} are there.` : `Closed field ${dirWord}; ${near ? near + ' is close' : 'keep it down'}.`);
    reasons.push(`Shot: ${shot}, ${power > 0.75 ? 'hard and in the air' : power > 0.45 ? 'firm, along the ground' : 'a soft push'}. Risk of a catch about ${Math.round(c.pOut * 100)} percent.`);
    reasons.push(i.target != null ? `The chase needs ${rrr.toFixed(1)} an over: ${rrr > 10 ? 'attack' : rrr < 6.5 ? 'take no chances' : 'keep ticking over'}.` : 'Build the innings.');
  }
  const sigma = sigma0;
  let terr = clamp(gauss(rng) * sigma, -0.15, 0.15);
  if (kind === 'swing' && power > 0.8) terr *= 1.2;
  return {
    kind, angle: clamp(angle, -170, 170), power, terr, reasons, skill,
    best: best ? { angle: best.c.a, power: best.c.pw, runs: best.c.runs, boundary: best.c.boundary, pOut: best.c.pOut } : null,
    top: cands.slice(0, 5).map((c) => ({ angle: c.a, power: c.pw, runs: c.runs, boundary: c.boundary, value: c.value })),
    gap: best ? { angle: best.c.a } : null,
  };
}

function nearestFielder(m, pos) {
  if (!pos) return null;
  let b = null, bd = 99;
  for (const f of m.field) { const d = Math.hypot(f.x - pos[0], f.z - pos[2]); if (d < bd) { bd = d; b = f; } }
  return b ? b.name : null;
}

// ---- running decisions -----------------------------------------------------------------------------------------
// Looks at the live ball and says whether the next run is safe. Used by Think, by AI batters and by Auto Play.
export function runAdvice(m, margin = 0.25) {
  const L = m.live, th = THEMES[m.theme];
  if (!L) return null;
  const rn = L.run;
  const runTime = th.runLen / 7.4, uRate = 7.4 / th.runLen;
  const pl = L.plan;
  let holdT = 0, hx = 0, hz = 0, who = '';
  if (L.bs === 'held') { const f = m.field[L.holder]; hx = f.x; hz = f.z; holdT = 0; who = f.name; }
  else if (L.bs === 'thrown') return { act: 'hold', safe: 0, slack: -9, text: 'The throw is already in. Stay.', runTime };
  else if (L.bs === 'over') return { act: 'hold', safe: 0, slack: -9, text: 'The ball is dead or gone.', runTime };
  else { holdT = Math.max(0, ((pl.pickupIdx ?? pl.idx) - L.i) / 60); hx = pl.pos[0]; hz = pl.pos[2]; who = m.field[pl.fielder]?.name ?? 'a fielder'; }
  let start, fromEnd;
  if (rn.mode === 'run') { start = (1 - Math.min(rn.u[0], rn.u[1])) / uRate + 0.18; fromEnd = 1 - rn.from[0]; }
  else { start = 0.1 + (rn.turn ?? 0); fromEnd = rn.from[0]; }
  const to = 1 - fromEnd, endZ = to === 0 ? 0 : th.pitchLen;
  const finish = start + runTime;
  const arrive = holdT + throwTime(hx, hz, 0, endZ);
  const slack = arrive - finish;
  const ok = slack >= margin;
  const dist = Math.hypot(hx, hz - endZ);
  return {
    act: ok ? 'run' : 'hold', slack, safe: ok ? 1 : 0, runTime, who, holdT, dist, finish, arrive,
    text: ok
      ? `${who} gets to it in ${holdT.toFixed(1)}s, then the throw needs ${(arrive - holdT).toFixed(1)}s. A run takes ${finish.toFixed(1)}s. Safe by ${slack.toFixed(1)}s: RUN.`
      : `${who} gets to it in ${holdT.toFixed(1)}s, then the throw needs ${(arrive - holdT).toFixed(1)}s. A run takes ${finish.toFixed(1)}s: too tight. HOLD.`,
  };
}

export function aiMargin(m) {
  const i = m.inn;
  const rrr = i.target != null ? ((i.target - i.runs) / Math.max(1, i.maxBalls - i.balls)) * 6 : 8;
  const skill = m.ai ? 0.9 : LEVELS[m.lvl].aiSkill;
  const aggr = clamp(0.4 + (rrr - 8) / 10, 0.1, 0.9);
  return lerp(0.5, 0.12, aggr) + (1 - skill) * 0.25;
}

// Think hint for the batter BEFORE the ball: where the gaps are and what to expect.
export function readyHint(m) {
  const d = m.d;
  const lvl = LEVELS[m.lvl];
  if (!d) return null;
  const plan = planBat(m, d, localRng(3), 1);
  const reasons = [];
  const T = TYPES[d.spec.type];
  reasons.push(`Expect ${T.name.toLowerCase()}: ${T.cue.toLowerCase()}.`);
  reasons.push(`It will pitch ${lengthWord[d.lengthClass] ?? d.lengthClass}, ${lineWord(d.xc)}.`);
  if (PRESETS[m.fieldKey]) reasons.push(`Field: ${PRESETS[m.fieldKey].name}. ${PRESETS[m.fieldKey].blurb}`);
  if (plan.kind === 'swing') {
    reasons.push(`Best gap: swipe ${plan.angle > 12 ? 'toward the off side' : plan.angle < -12 ? 'toward the leg side' : 'straight'} (${SECTOR_NAMES[sectorOf(plan.angle)]}), ${plan.power > 0.75 ? 'with a hard flick to go aerial' : plan.power > 0.45 ? 'with a firm swipe' : 'with a gentle drag'}.`);
  } else if (plan.kind === 'block') reasons.push('Defend this one: a quick tap.');
  else reasons.push('Leave it alone: do not swipe.');
  return { reasons, plan };
}
