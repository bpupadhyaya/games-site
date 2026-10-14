// Bentengan engine: the rule book and the real-time simulation. Pure and deterministic: no DOM, no clock, randomness only from `rng`.
// Two teams of four. Each defends a pole inside a fort ring. The one rule that makes everything: when two rivals meet in the open,
// the one who LEFT HIS FORT LATER (the fresher one) tags the other, and the tagged player goes to the jail beside the tagger's fort.
// Touching a rival's pole wins the round; touching your own jail frees every teammate in it.
// Canonical court space: 720 x 960. The human team is H (bottom fort), the computer team is C (top fort).

export const COURT = { w: 720, h: 960 };
export const POLE = { H: { x: 360, y: 826 }, C: { x: 360, y: 134 } };
export const JAIL = { H: { x: 628, y: 292 }, C: { x: 92, y: 668 } };   // JAIL.H holds captured H players (beside the C fort)
export const FORT_R = 88, POLE_R = 30, JAIL_R = 52, TAG_R = 33, TEAM_SIZE = 4;
export const BOUNDS = { x0: 34, x1: 686, y0: 92, y1: 868 };
export const SPEEDS = [168, 152, 152, 138];            // sprinter, two steady runners, a guard
export const ROLES = ['Sprinter', 'Steady', 'Steady', 'Guard'];
export const CHASE_BOOST = 1.1, RETURN_SPEED = 165, JAIL_WALK = 85, HOLD_SECS = 0.55;   // units / s; the court is about 34 units to the metre
export const ROUND_TIME = 60, AUTO_ROUND_TIME = 45, ROUNDS_MAX = 5, WIN_POINTS = 3;
export const LEVELS = [
  { name: 'Street', period: 0.65, bold: 0.35, seeR: 120, mistake: 0.18, react: 0.7 },
  { name: 'Neighbourhood', period: 0.45, bold: 0.5, seeR: 165, mistake: 0.07, react: 0.45 },
  { name: 'Champion', period: 0.3, bold: 0.8, seeR: 215, mistake: 0.02, react: 0.25 },
];
export const SLOT = (team, k) => {   // idle spots in the fort ring, fanned toward the field
  const p = POLE[team], dir = team === 'H' ? -1 : 1, a = [-0.95, -0.32, 0.32, 0.95][k];
  return { x: p.x + Math.sin(a) * 52, y: p.y + dir * Math.cos(a) * 52 };
};
export const JAIL_SLOT = (team, k) => ({ x: JAIL[team].x + [-20, 20, -20, 20][k], y: JAIL[team].y + [-18, -18, 22, 22][k] });

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const other = (t) => (t === 'H' ? 'C' : 'H');
const turn = (a, b, k) => { let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * Math.min(1, k); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function newRound(rng, { level = 1, roundTime = ROUND_TIME, aiH = false, aiC = true } = {}) {
  const players = [];
  for (const team of ['H', 'C']) for (let k = 0; k < TEAM_SIZE; k++) {
    const s = SLOT(team, k);
    players.push({ id: players.length, team, k, x: s.x, y: s.y, st: 'fort', stamp: 0, goal: null, speed: SPEEDS[k], face: team === 'H' ? -1 : 1, ang: team === 'H' ? -Math.PI / 2 : Math.PI / 2, phase: rng.next() * 6, moving: false, jailK: -1, left: 0, tagged: 0 });
  }
  return { t: 0, clock: roundTime, roundTime, level, counter: 0, players, result: null, ev: [], aiH, aiC, next: { H: 0.8, C: 0.8 }, over: false };
}
export const teamOf = (w, team) => w.players.filter((p) => p.team === team);
export const jailedOf = (w, team) => w.players.filter((p) => p.team === team && p.st === 'jail');

// A goal is an intent, not a path: { kind: 'point', x, y } | { kind: 'chase', id } | { kind: 'pole' } | { kind: 'jail' } | { kind: 'home' }.
export function goalTarget(w, p) {
  const g = p.goal; if (!g) return null;
  if (g.kind === 'point') return { x: g.x, y: g.y };
  if (g.kind === 'home') return { x: POLE[p.team].x, y: POLE[p.team].y };
  if (g.kind === 'pole') return { x: POLE[other(p.team)].x, y: POLE[other(p.team)].y };
  if (g.kind === 'jail') return { x: JAIL[p.team].x, y: JAIL[p.team].y };
  if (g.kind === 'chase') {
    const e = w.players[g.id];
    if (!e || e.st !== 'out') return null;
    const lead = 0.3; return { x: e.x + (e.vx || 0) * lead, y: e.y + (e.vy || 0) * lead };
  }
  return null;
}
export function setGoal(w, id, goal) {
  const p = w.players[id];
  if (!p || p.st === 'jail' || p.st === 'return') return false;
  p.goal = goal; return true;
}

function toJail(w, tagger, p) {
  const j = jailedOf(w, p.team).length;
  p.st = 'jail'; p.goal = null; p.stamp = 0; p.jailK = j; p.moving = false; p.vx = p.vy = 0;
  const s = JAIL_SLOT(p.team, j % 4); p.jx = s.x; p.jy = s.y; p.tx = p.x; p.ty = p.y; p.slide = 0; p.hold = HOLD_SECS; p.tagBy = tagger.id;
  p.slideDur = Math.max(0.6, dist(p.x, p.y, s.x, s.y) / JAIL_WALK);   // the tagged player walks to the jail at a natural pace
  w.ev.push({ t: 'tag', x: p.x, y: p.y, by: tagger.id, id: p.id, team: tagger.team });
}
function release(w, team, by) {
  const free = jailedOf(w, team);
  for (const p of free) { p.st = 'return'; p.hold = 0; p.goal = null; p.jailK = -1; p.stamp = 0; }
  if (free.length) w.ev.push({ t: 'free', x: JAIL[team].x, y: JAIL[team].y, n: free.length, by, team });
}

export function step(w, rng, dt) {
  if (w.result) return;
  w.t += dt; w.clock -= dt;
  const lvl = LEVELS[w.level] ?? LEVELS[1];
  // the computer's own thinking (a team under AI control re-plans every `period` seconds; Auto Play drives goals itself)
  for (const team of ['H', 'C']) {
    if (!(team === 'H' ? w.aiH : w.aiC)) continue;
    w.next[team] -= dt;
    if (w.next[team] <= 0) { w.next[team] = lvl.period * (0.8 + rng.next() * 0.4); for (const pl of aiPlan(w, team, rng)) setGoal(w, pl.id, pl.goal); }
  }
  // movement
  for (const p of w.players) {
    p.vx = 0; p.vy = 0; p.moving = false;
    if (p.st === 'jail') {
      if (p.hold > 0) { p.hold = Math.max(0, p.hold - dt); continue; }   // caught: a short stop before the walk to the jail
      if ((p.slide ?? 1) < 1) {
        p.slide = Math.min(1, (p.slide ?? 1) + dt / (p.slideDur || 0.6));
        const nx = p.tx + (p.jx - p.tx) * p.slide, ny = p.ty + (p.jy - p.ty) * p.slide;
        p.vx = (nx - p.x) / dt; p.vy = (ny - p.y) / dt; p.moving = p.slide < 1; p.x = nx; p.y = ny;
        if (Math.abs(p.vx) > 4) p.face = Math.sign(p.vx);
        p.ang = turn(p.ang, Math.atan2(p.vy, p.vx), dt * 10); p.phase += dt * 9;
      }
      continue;
    }
    if (p.st === 'return') {
      const f = SLOT(p.team, p.k), d = dist(p.x, p.y, f.x, f.y);
      if (d < 6) { p.st = 'fort'; p.x = f.x; p.y = f.y; } else { const s = Math.min(d, RETURN_SPEED * dt); p.vx = (f.x - p.x) / d * RETURN_SPEED; p.vy = (f.y - p.y) / d * RETURN_SPEED; p.x += (f.x - p.x) / d * s; p.y += (f.y - p.y) / d * s; p.moving = true; p.face = Math.sign(f.x - p.x) || p.face; p.ang = turn(p.ang, Math.atan2(f.y - p.y, f.x - p.x), dt * 10); }
      p.phase += dt * 9; continue;
    }
    const tg = goalTarget(w, p);
    if (p.goal && !tg) p.goal = null;
    if (tg) {
      const d = dist(p.x, p.y, tg.x, tg.y);
      const boost = p.goal.kind === 'chase' ? CHASE_BOOST : 1, sp = p.speed * boost;
      if (d < 3 && p.goal.kind !== 'chase') { if (p.goal.kind === 'point' || p.goal.kind === 'home') p.goal = null; }
      else {
        const s = Math.min(d, sp * dt), ux = (tg.x - p.x) / (d || 1), uy = (tg.y - p.y) / (d || 1);
        p.x += ux * s; p.y += uy * s; p.vx = ux * sp; p.vy = uy * sp; p.moving = s > 0.01;
        if (Math.abs(ux) > 0.2) p.face = Math.sign(ux);
        p.ang = turn(p.ang, Math.atan2(uy, ux), dt * 14);
      }
    }
    p.x = clamp(p.x, BOUNDS.x0, BOUNDS.x1); p.y = clamp(p.y, BOUNDS.y0, BOUNDS.y1);
    if (p.moving) p.phase += dt * 9;
  }
  // leaving and re-entering the fort ring stamps freshness
  for (const p of w.players) {
    if (p.st === 'jail' || p.st === 'return') continue;
    const d = dist(p.x, p.y, POLE[p.team].x, POLE[p.team].y);
    if (p.st === 'fort' && d > FORT_R + 2) { p.st = 'out'; p.stamp = ++w.counter; p.left = w.t; w.ev.push({ t: 'leave', id: p.id, x: p.x, y: p.y }); }
    else if (p.st === 'out' && d <= FORT_R - 6) { p.st = 'fort'; p.stamp = 0; if (p.goal && (p.goal.kind === 'home' || p.goal.kind === 'chase')) p.goal = null; w.ev.push({ t: 'home', id: p.id, x: p.x, y: p.y }); }
  }
  // tags: two rivals, both in the open, close enough: the fresher one wins
  const H = w.players.filter((p) => p.team === 'H' && p.st === 'out'), C = w.players.filter((p) => p.team === 'C' && p.st === 'out');
  const caught = new Set();
  for (const a of H) for (const b of C) {
    if (caught.has(a.id) || caught.has(b.id)) continue;
    if (dist(a.x, a.y, b.x, b.y) <= TAG_R) { const win = a.stamp > b.stamp ? a : b, lose = win === a ? b : a; caught.add(lose.id); win.tagged += 1; toJail(w, win, lose); }
  }
  // a rescue: a free player in the open touches his own jail
  for (const team of ['H', 'C']) {
    if (!jailedOf(w, team).length) continue;
    for (const p of w.players) if (p.team === team && p.st === 'out' && dist(p.x, p.y, JAIL[team].x, JAIL[team].y) <= JAIL_R + 14) { release(w, team, p.id); break; }
  }
  // pole touch ends the round
  for (const p of w.players) if (p.st === 'out' && dist(p.x, p.y, POLE[other(p.team)].x, POLE[other(p.team)].y) <= POLE_R) { w.result = { kind: 'pole', winner: p.team, by: p.id }; w.ev.push({ t: 'pole', x: POLE[other(p.team)].x, y: POLE[other(p.team)].y, team: p.team }); return; }
  for (const team of ['H', 'C']) if (jailedOf(w, team).length === TEAM_SIZE) { w.result = { kind: 'sweep', winner: other(team) }; return; }
  if (w.clock <= 0) {
    w.clock = 0;
    const jh = jailedOf(w, 'H').length, jc = jailedOf(w, 'C').length;
    w.result = { kind: 'time', winner: jc > jh ? 'H' : jh > jc ? 'C' : 'draw', jh, jc };
  }
}

// ---------------------------------------------------------------- the computer's mind (also the hint and Auto Play)
// Returns [{ id, goal, why, kind }] for the players whose goal should CHANGE for `team`. Nothing is applied here.
export function aiPlan(w, team, rng, forAuto = false) {
  const lvl = LEVELS[w.level] ?? LEVELS[1], foe = other(team), mine = teamOf(w, team).filter((p) => p.st === 'fort' || p.st === 'out');
  const foeOut = w.players.filter((p) => p.team === foe && p.st === 'out');
  const prisoners = jailedOf(w, team).length, myOut = mine.filter((p) => p.st === 'out'), myFort = mine.filter((p) => p.st === 'fort');
  const plans = [], taken = new Set(), pole = POLE[team], fpole = POLE[foe];
  const same = (a, b) => a && b && a.kind === b.kind && (a.kind !== 'chase' || a.id === b.id) && (a.kind !== 'point' || (Math.abs(a.x - b.x) < 6 && Math.abs(a.y - b.y) < 6));
  const add = (p, goal, why, kind) => { if (!same(p.goal, goal)) plans.push({ id: p.id, goal, why, kind }); taken.add(p.id); };
  const mistake = () => !forAuto && rng.next() < lvl.mistake;
  const clearOfFort = (e) => dist(e.x, e.y, POLE[foe].x, POLE[foe].y) > FORT_R + 26;
  const preyOf = new Set();
  // players in the open first
  for (const p of myOut) {
    const threats = foeOut.filter((e) => e.stamp > p.stamp && dist(e.x, e.y, p.x, p.y) < lvl.seeR);
    const homeD = dist(p.x, p.y, pole.x, pole.y);
    if (threats.length) { add(p, { kind: 'home' }, 'A fresher rival is close: run for the fort', 'flee'); continue; }
    if (p.goal && p.goal.kind === 'pole' && !mistake()) {
      // keep running at the pole unless a fresher rival has stepped out
      continue;
    }
    const prey = foeOut.filter((e) => e.stamp < p.stamp && !preyOf.has(e.id) && clearOfFort(e) && dist(e.x, e.y, p.x, p.y) < 300).sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y))[0];
    if (prey && !mistake()) { preyOf.add(prey.id); add(p, { kind: 'chase', id: prey.id }, 'Rival left earlier: tag him', 'chase'); continue; }
    if (prisoners && !(p.goal && p.goal.kind === 'jail')) {
      const guard = w.players.some((e) => e.team === foe && e.st === 'fort' && dist(e.x, e.y, JAIL[team].x, JAIL[team].y) < 200);
      if (!guard || rng.next() < 0.25) { add(p, { kind: 'jail' }, 'Free the prisoners', 'rescue'); continue; }
    }
    const alone = foeOut.length === 0, defendersIn = w.players.filter((e) => e.team === foe && e.st === 'fort').length;
    if (alone && defendersIn > 0 && !(p.goal && p.goal.kind === 'pole') && rng.next() < lvl.bold * (p.k === 0 ? 0.9 : 0.5) * (0.5 + 0.1 * (w.t - p.left))) { add(p, { kind: 'pole' }, 'Dash for the rival pole', 'pole'); continue; }
    if (!p.goal && w.t - p.left > 7 + rng.next() * 5 && homeD > FORT_R) add(p, { kind: 'home' }, 'Back to the fort to refresh', 'home');
  }
  // players in the fort: who steps out
  let guards = myFort.length;
  for (const p of myFort) {
    if (p.goal && !(p.goal.kind === 'home')) continue;
    const near = foeOut.filter((e) => !preyOf.has(e.id) && dist(e.x, e.y, pole.x, pole.y) < 330).sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y))[0];
    const urgent = near && dist(near.x, near.y, pole.x, pole.y) < 250;
    if (near && (guards > 1 || urgent) && !mistake()) { preyOf.add(near.id); guards -= 1; add(p, { kind: 'chase', id: near.id }, 'Rival in the open: step out fresher and tag him', 'launch'); continue; }
    const jailGuard = w.players.some((e) => e.team === foe && e.st === 'fort' && dist(e.x, e.y, JAIL[team].x, JAIL[team].y) < 200);
    if (prisoners && guards > 1 && !myOut.some((o) => o.goal && o.goal.kind === 'jail') && (!jailGuard ? rng.next() < 0.9 : rng.next() < 0.02)) { guards -= 1; add(p, { kind: 'jail' }, 'Go and free the prisoners', 'rescue'); continue; }
    if (guards > 1 && myOut.length < 2 && rng.next() < lvl.bold * 0.1 * (1 + w.t / 10)) { guards -= 1; add(p, { kind: 'pole' }, 'Send a runner at the rival pole', 'launch'); }
  }
  return plans;
}

// Which single change would the computer make for `team` right now? (the Hint button and Auto Play both use this)
export function hintFor(w, team, rng) {
  const plans = aiPlan(w, team, rng, true);
  const rank = { pole: 5, rescue: 4, chase: 3, launch: 3, flee: 4, home: 1 };
  plans.sort((a, b) => (rank[b.kind] ?? 0) - (rank[a.kind] ?? 0));
  return plans[0] ?? null;
}

// ---------------------------------------------------------------- match
export function newMatch() { return { n: 0, score: { H: 0, C: 0 }, log: [], over: null }; }
export function bookRound(m, w) {
  m.n += 1;
  const r = w.result, pts = [0, 0];
  if (r.winner === 'H') { m.score.H += 1; pts[0] = 1; } else if (r.winner === 'C') { m.score.C += 1; pts[1] = 1; }
  m.log.push({ kind: r.kind, winner: r.winner, pts });
  if (m.score.H >= WIN_POINTS || m.score.C >= WIN_POINTS || m.n >= ROUNDS_MAX) m.over = { winner: m.score.H > m.score.C ? 'H' : m.score.C > m.score.H ? 'C' : 'draw' };
}
