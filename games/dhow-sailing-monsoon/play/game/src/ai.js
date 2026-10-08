// The computer navigator: picks a heading by scoring a polar diagram (speed made good toward the port, with a tack inertia and reef
// avoidance), sets the sheet, reefs, takes star sights and decides hazards. Used by Auto Play (Watch and Learn), by the Think hint and by tests.
import { DEG, clamp, wrap180, wrap360, bearingOf, sinD, cosD, compassName } from './core.js';
import { LEVELS } from './data.js';
import { KN, polar, idealAngle, idealTrim, targetSpeed, overpower, reefArea, windAt, frame, distTo, setHeading, setTrim, setReef, canSight, startSight, takeSight, decide, upcomingSquall, isNight, todOf, errRadius, SIGHT_R } from './sim.js';

const kn = (ms) => Math.round(ms * KN);
const dirName = (deg) => `${compassName(deg)} (${Math.round(wrap360(deg))}°)`;

// Candidate headings scored for speed made good toward the port (est position) with reefs in the way avoided.
export function scoreHeadings(V, ws, wf) {
  const sh = V.ship, Lv = LEVELS[V.level];
  const want = bearingOf(V.D.x - V.est.x, V.D.y - V.est.y);
  const reefs = V.hazards.filter((h) => h.k === 'reef' && Math.hypot(h.x - sh.x, h.y - sh.y) < 330);
  const out = [];
  for (let h = 0; h < 360; h += 4) {
    const beta = Math.abs(wrap180(wf - h));
    const sp = targetSpeed(beta, ws, idealTrim(beta), V.ship.reef, 1, Lv.trimW);
    let vmg = sp * Math.cos(wrap180(h - want) * DEG);
    let blocked = false;
    for (const r of reefs) {
      // distance from the reef centre to the ray from the ship along heading h, within 320 m
      const dx = r.x - sh.x, dy = r.y - sh.y, along = dx * sinD(h) + dy * cosD(h), across = Math.abs(dx * cosD(h) - dy * sinD(h));
      if (along > -10 && along < 320 && across < r.r + 24) blocked = true;
    }
    if (blocked) vmg -= 6;
    if (Math.sign(wrap180(h - wf)) === Math.sign(wrap180(sh.h - wf)) && sp > 0) vmg *= 1.09;     // inertia: staying on the current tack
    out.push({ h, beta, sp, vmg, blocked });
  }
  return { out, want };
}

export function planFor(V) {
  const w = V.wind, sh = V.ship;
  const { out, want } = scoreHeadings(V, w.speed, w.from);
  let best = out[0];
  for (const c of out) if (c.vmg > best.vmg) best = c;
  const cur = out.reduce((b, c) => (Math.abs(wrap180(c.h - sh.h)) < Math.abs(wrap180(b.h - sh.h)) ? c : b), out[0]);
  const keep = cur.vmg > best.vmg * 0.93 && !cur.blocked && cur.sp > 0.2 && Math.abs(wrap180(best.h - cur.h)) > 4;
  const chosen = keep ? { ...cur, h: sh.h } : best;
  const betaC = Math.abs(wrap180(w.from - chosen.h));
  const O = overpower(betaC, w.speed * 1.12, 0, 1);
  return { h: chosen.h, beta: betaC, trim: idealTrim(betaC), sp: chosen.sp, vmg: chosen.vmg, want, over: O, blocked: best.blocked, beating: betaC < 60 && Math.abs(wrap180(chosen.h - want)) > 12 };
}

// One tick of computer control (heading, sheet, reef, sights, choices). `skill` 0..1 sets how clean the sheet and sights are.
export function autoControl(V, skill = 0.9, canDecide = true) {
  if (V.phase !== 'sail') return;
  const sh = V.ship, ai = V.ai || (V.ai = { next: 0, lastH: V.ship.h, unreefAt: 0, sightAt: -1, trim: V.ctl.trim });
  if (V.decision && canDecide) {
    const d = V.decision;
    if (d.type === 'squall') decide(V, 'reef');
    else if (d.type === 'calm') decide(V, V.crew.sailors >= 3 ? 'sweeps' : 'wait');
    else if (d.type === 'help') decide(V, V.water > 0.55 ? 'help' : 'pass');
  }
  if (V.t >= ai.next) {
    const p = planFor(V);
    ai.next = V.t + 1.5;
    if (V.plan.squall !== 'run') setHeading(V, p.h);
    ai.plan = { h: Math.round(p.h), trim: Math.round(p.trim * 100) / 100, beta: Math.round(p.beta), over: Math.round(p.over * 100) / 100 };
    if (!V.ctl.reef && (p.over > 0.95 || V.plan.squall)) setReef(V, true);
    else if (V.ctl.reef && p.over < 0.5 && !V.plan.squall && V.t > ai.unreefAt) setReef(V, false);
    if (p.over > 0.95) ai.unreefAt = V.t + 10;
  }
  // sheet follows the ideal angle, with a gentle hand
  const tgt = ai.plan ? ai.plan.trim : V.ctl.trim;
  const wob = (1 - skill) * 0.05 * Math.sin(V.t * 0.7);
  ai.trim += clamp(tgt + wob - ai.trim, -0.35 / 60, 0.35 / 60);
  setTrim(V, ai.trim);
  // star sights
  if (V.sight && !V.sight.done) { if (Math.abs(V.sight.m) < 0.1 + (1 - skill) * 0.2 && V.sight.t > 1.2) takeSight(V); }
  else if (canSight(V) && isNight(todOf(V)) && V.t - ai.sightAt > 30) { ai.sightAt = V.t; startSight(V); }
}

// Plain-language lines for the Think hint and for Auto Play's THINK / REVEAL cards.
export function explain(V, why = 'now') {
  const w = V.wind, sh = V.ship, p = planFor(V), L = [];
  const want = p.want, off = Math.abs(wrap180(w.from - want));
  L.push(`Wind: from the ${dirName(w.from)}, about ${kn(w.speed)} knots. The port lies ${dirName(want)} of us, ${Math.round(Math.hypot(V.D.x - V.est.x, V.D.y - V.est.y))} metres away.`);
  const kind = (b) => (b < 44 ? 'close to the wind' : b < 70 ? 'a close reach' : b < 110 ? 'a beam reach, the fastest way to sail' : b < 150 ? 'a broad reach, fast and easy' : 'running before the wind');
  if (off < 44) L.push(`The wind is only ${Math.round(off)}° off the line to port, closer than a lateen sail can sail (about 45°). So I steer ${Math.round(p.h)}°, ${Math.round(p.beta)}° off the wind, and will tack later.`);
  else L.push(`The wind is ${Math.round(off)}° off our course to port: ${kind(off)}. I steer ${Math.round(p.h)}°.${off > 150 ? ' A lateen sail runs slowest dead downwind, and the yard flips over if the wind crosses the stern, so I keep a few degrees to one side.' : ''}`);
  L.push(`For ${Math.round(p.beta)}° off the wind the sail wants to be about ${Math.round(idealAngle(p.beta))}° from the centre line: I set the sheet slider to about ${Math.round(p.trim * 100)}%. Too loose and the sail shakes; too tight and it stalls.`);
  if (p.over > 0.9) L.push('The gusts are strong for a full sail. I reef it to keep the boat upright and the cloth whole.');
  const reef = V.hazards.filter((h) => h.k === 'reef' && Math.hypot(h.x - sh.x, h.y - sh.y) < 330).sort((a, b) => Math.hypot(a.x - sh.x, a.y - sh.y) - Math.hypot(b.x - sh.x, b.y - sh.y))[0];
  if (reef) L.push(`A reef lies about ${Math.round(Math.hypot(reef.x - sh.x, reef.y - sh.y))} metres away, shown by pale water and breakers. ${p.blocked ? 'It is in the way, so I look for a gap.' : 'My course keeps well clear of it.'}`);
  const sq = upcomingSquall(V);
  if (sq && V.t < sq.t0 + 2) L.push('A dark squall line is coming. Reefing early is safe; running before it keeps us fast but off course; pressing on risks the sail.');
  if (isNight(todOf(V))) L.push(canSight(V) || V.sight ? 'It is night and the sky is clear: I take a star sight with the kamal. It fixes our latitude and shrinks the circle of doubt on the chart.' : 'It is night. I will take a star sight when the sea allows.');
  if (!V.landfall) L.push(`Our chart position is only an estimate (circle about ${Math.round(errRadius(V))} m). Land will be seen from ${SIGHT_R} m.`);
  return { lines: L, plan: p };
}
export { sheetAngle } from './sim.js';
void reefArea; void polar; void distTo; void frame; void bearingOf;
