// The voyage simulation: one leg sailed in real time. Pure and deterministic (a function of the seed, the inputs and dt).
// World frame: x east, y north, metres. Headings are compass degrees (0 = north, clockwise). Wind direction is where the wind blows FROM.
import { DEG, DT, clamp, lerp, smooth, wrap180, wrap360, sinD, cosD, bearingOf, hash01, DAYLEN } from './core.js';
import { SEASONS, LEVELS } from './data.js';

export const KN = 1.6;                        // game metres/second -> knots shown to the player
export const SIGHT_R = 280;                   // land is seen from this far
export const HARBOUR_R = 72;
export const COAST_HALF = 760;
export const POLAR = [[0, 0], [34, 0], [44, 0.5], [56, 0.78], [80, 0.95], [105, 1], [135, 0.9], [160, 0.78], [180, 0.7]];
export function polar(beta) {
  for (let i = 1; i < POLAR.length; i++) if (beta <= POLAR[i][0]) { const [a, pa] = POLAR[i - 1], [b, pb] = POLAR[i]; return lerp(pa, pb, (beta - a) / (b - a)); }
  return POLAR[POLAR.length - 1][1];
}
export const sheetAngle = (u) => 4 + 84 * clamp(u, 0, 1);                      // boom angle from the centre line, degrees
export const idealAngle = (beta) => clamp(0.5 * beta + 2, 6, 86);
export const idealTrim = (beta) => (idealAngle(beta) - 4) / 84;
// sail efficiency 0..1 for wind angle beta (0 = head to wind), trim fraction u and window width w (degrees)
export function sailEff(beta, u, w) {
  const d = sheetAngle(u) - idealAngle(beta);
  const k = d > 0 ? w : w * 1.3;
  return clamp(1 - (d / k) * (d / k), 0, 1);
}
export const reefArea = (r) => 1 - 0.42 * r;
export const targetSpeed = (beta, ws, u, reef, cond, w) => Math.min(7.4, 5.6 * Math.pow(Math.max(0, polar(beta) * sailEff(beta, u, w) * reefArea(reef)), 0.8) * Math.pow(Math.max(0.05, ws) / 8, 0.7) * cond);
export const overpower = (beta, ws, reef, e) => Math.pow((ws * reefArea(reef)) / 11.5, 2) * (0.45 + 0.55 * e) * (0.55 + 0.45 * sinD(Math.min(beta, 150)));
export const todOf = (V) => (V.tod0 + V.t / DAYLEN) % 1;
export const isNight = (tod) => tod < 0.22 || tod > 0.78;

// ---- tiny seeded stream for content and noise (the sim never touches env.rng after creation) ------------------------------------
function stream(seed) { let s = (seed >>> 0) || 1; return { next() { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; } }; }

export function makeVoyage(o) {
  const { leg, season = 'kusi', level = 1, seed = 1, crew = { sailors: 3, navigator: 1, sailmaker: 0 }, hull = 100, sail = 100, water = 1.0, tod0 = 0.27, label = '' } = o;
  const S = SEASONS[season], L = LEVELS[level], R = stream(seed * 7919 + 13);
  const b = leg.bearing, dir = [sinD(b), cosD(b)], perp = [cosD(b), -sinD(b)];
  const at = (u, l) => ({ x: dir[0] * u + perp[0] * l, y: dir[1] * u + perp[1] * l });
  const par = leg.dist / 5.0;
  const V = {
    legId: leg.id, from: leg.from, to: leg.to, season, level, seed, label, t: 0, tod0,
    dist: leg.dist, bearing: b, par, D: at(leg.dist, 0), crew: { ...crew },
    ship: { x: 0, y: 0, h: b, v: 0.5, yaw: 0, lee: 0, heel: 0, side: 1, dip: 0, dipTot: 0, reef: 0, flap: 0, stall: 0, eff: 0, beta: 90, sailAng: 40, drive: 0, over: 0, strain: 0, bro: 0 },
    ctl: { target: b, trim: 0.45, reef: 0, sweeps: false },
    est: { x: 0, y: 0 }, errBias: (R.next() * 2 - 1) * (3 + 3 * L.err), logBias: 1 + (R.next() * 2 - 1) * 0.08 * L.err, sightsDone: 0, lastSightT: -999, sight: null, lastQ: null,
    cur: { dir: 0, mag: 0 }, wind: { from: S.from, speed: S.speed },
    wphase: [R.next() * 6.28, R.next() * 6.28, R.next() * 6.28, R.next() * 6.28],
    hull, sail, water, thirst: 0, morale: o.morale ?? 80, cargoLost: 0, rep: 0, dmg: 0,
    hazards: [], decision: null, plan: {}, skip: 0, landfall: null, grounded: 0,
    phase: 'sail', result: null, events: [], evId: 0, log: [], stats: { tacks: 0, dips: 0, reefs: 0, sights: 0, bestQ: 0, maxKn: 0, helped: 0, passed: 0, wetT: 0 },
  };
  // content: reefs, squalls, calms, a dhow in need, sea life
  const hz = L.hazard, nReef = Math.max(1, Math.round((2.2 + R.next() * 1.6) * hz));
  let id = 1;
  for (let i = 0; i < nReef; i++) {
    const u = leg.dist * (0.3 + 0.55 * R.next()), side = R.next() < 0.5 ? -1 : 1, l = i === 0 ? side * (14 + R.next() * 90) : side * (60 + R.next() * 230);
    const p = at(u, l); V.hazards.push({ id: id++, k: 'reef', x: p.x, y: p.y, r: 30 + R.next() * 26, seen: false, hit: false });
    if (R.next() < 0.4 * hz) { const p2 = at(u + 8, l + side * -1 * (92 + R.next() * 20)); V.hazards.push({ id: id++, k: 'reef', x: p2.x, y: p2.y, r: 34 + R.next() * 20, seen: false, hit: false }); }
  }
  const sq = Math.floor(S.squall * hz + R.next() * 0.9) + (season === 'between' ? 1 : 0);
  for (let i = 0; i < Math.min(2, sq); i++) V.hazards.push({ id: id++, k: 'squall', t0: par * (0.28 + 0.4 * R.next() + i * 0.25), warn: 9, dur: 22, shift: (R.next() < 0.5 ? -1 : 1) * (25 + 25 * R.next()), mult: 1.8 + 0.3 * R.next(), done: false, warned: false });
  const calmP = season === 'between' ? 0.9 : season === 'kaskazi' ? 0.35 : 0.12;
  if (R.next() < calmP * hz) V.hazards.push({ id: id++, k: 'calm', t0: par * (0.25 + 0.45 * R.next()), dur: 24 + 8 * R.next(), done: false, warned: false });
  if (R.next() < 0.4) { const p = at(leg.dist * (0.35 + 0.35 * R.next()), (R.next() < 0.5 ? -1 : 1) * (50 + 60 * R.next())); V.hazards.push({ id: id++, k: 'help', x: p.x, y: p.y, state: 'none', ang: R.next() * 360 }); }
  for (let i = 0; i < 2; i++) V.hazards.push({ id: id++, k: 'life', t0: par * (0.15 + 0.6 * R.next()), kind: R.next() < 0.5 ? 'dolphins' : 'fish', done: false });
  V.hazards.sort((a, b2) => (a.t0 ?? 0) - (b2.t0 ?? 0));
  const c = require_current(leg, season); V.cur = c;
  pushEvent(V, 'depart', { season });
  return V;
}
function require_current(leg, season) {
  // local copy so sim.js does not import the table twice; mirrors data.legSeaCurrent
  if (leg.africa) return season === 'kusi' ? { dir: 20, mag: 0.8 } : season === 'kaskazi' ? { dir: 200, mag: 0.4 } : { dir: 20, mag: 0.3 };
  return season === 'kusi' ? { dir: 70, mag: 0.3 } : season === 'kaskazi' ? { dir: 250, mag: 0.3 } : { dir: 90, mag: 0.1 };
}

export function pushEvent(V, type, extra = {}) {
  V.evId += 1; V.events.push({ id: V.evId, type, t: V.t, ...extra });
  if (V.events.length > 48) V.events.shift();
}
const logLine = (V, text) => { if (V.log.length < 40) V.log.push({ t: V.t, text }); };

// ---- wind ---------------------------------------------------------------------------------------------------------------------------
export function windAt(V, t) {
  const S = SEASONS[V.season], p = V.wphase;
  let from = S.from + S.vary * (Math.sin(t * 0.031 + p[0]) * 0.6 + Math.sin(t * 0.0113 + p[1]) * 0.4);
  let speed = S.speed * (1 + 0.16 * Math.sin(t * 0.27 + p[2]) + 0.11 * Math.sin(t * 0.093 + p[3]));
  for (const h of V.hazards) {
    if (h.k === 'squall') { const e = envelope(t - h.t0, 2.5, h.dur, 4); if (e > 0) { speed *= 1 + (h.mult - 1) * e; from += h.shift * e; } }
    else if (h.k === 'calm') { const e = envelope(t - h.t0, 4, h.dur, 5); if (e > 0) speed *= 1 - 0.9 * e; }
  }
  return { from: wrap360(from), speed: Math.max(0.2, speed) };
}
function envelope(x, up, hold, down) { if (x < 0 || x > up + hold + down) return 0; if (x < up) return smooth(x / up); if (x < up + hold) return 1; return 1 - smooth((x - up - hold) / down); }
export const squallLevel = (V) => { let m = 0; for (const h of V.hazards) if (h.k === 'squall') m = Math.max(m, envelope(V.t - h.t0, 2.5, h.dur, 4)); return m; };
export const calmLevel = (V) => { let m = 0; for (const h of V.hazards) if (h.k === 'calm') m = Math.max(m, envelope(V.t - h.t0, 4, h.dur, 5)); return m; };
export const upcomingSquall = (V) => V.hazards.find((h) => h.k === 'squall' && !h.done && V.t >= h.t0 - h.warn - 1 && V.t < h.t0 + h.dur + 6) || null;

// ---- coordinates -------------------------------------------------------------------------------------------------------------------
export function frame(V, p) { const b = V.bearing; return { u: p.x * sinD(b) + p.y * cosD(b), l: p.x * cosD(b) - p.y * sinD(b) }; }
export const distTo = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);
export const estError = (V) => distTo(V.ship, V.est);
export const errRadius = (V) => Math.max(22, estError(V) * 1.25 + 14 + V.t * 0.12);

// ---- crew helpers ---------------------------------------------------------------------------------------------------------------------
const sailors = (V) => Math.max(1, V.crew.sailors | 0);
const dipTime = (V) => clamp(5.4 - 0.65 * sailors(V), 1.8, 5) * (V.morale < 25 ? 1.4 : 1);

// ---- control inputs (the UI/AI call these) ---------------------------------------------------------------------------------------------
export function setHeading(V, deg) { V.ctl.target = wrap360(deg); }
export function setTrim(V, u) { V.ctl.trim = clamp(u, 0, 1); }
export function setReef(V, on) { if (V.ctl.reef !== (on ? 1 : 0)) { V.ctl.reef = on ? 1 : 0; if (on) V.stats.reefs += 1; pushEvent(V, on ? 'reef-in' : 'reef-out'); } }
export function setSweeps(V, on) { V.ctl.sweeps = !!on; }
export function canSight(V) { const tod = todOf(V); return V.phase === 'sail' && isNight(tod) && calmLevel(V) < 2 && squallLevel(V) < 0.2 && V.t - V.lastSightT > 4 && !V.sight; }
export function startSight(V) {
  if (!canSight(V)) return false;
  V.sight = { t: 0, m: 0, done: false, q: null, amp: 0.8 + 0.1 * LEVELS[V.level].err };
  pushEvent(V, 'sight-start'); return true;
}
export function takeSight(V) {
  const s = V.sight; if (!s || s.done) return null;
  const win = 0.5 + 0.1 * V.crew.navigator + (V.morale < 25 ? -0.08 : 0) + (V.level === 0 ? 0.12 : V.level === 2 ? -0.06 : 0);
  const q = clamp(1 - Math.abs(s.m) / win, 0, 1);
  s.done = true; s.q = q; V.lastQ = q; V.lastSightT = V.t; V.stats.sights += 1; V.stats.bestQ = Math.max(V.stats.bestQ, q);
  const n = hash01(V.seed * 31 + V.stats.sights * 17) * 2 - 1;
  V.est.y = V.ship.y + n * (1 - q) * 55 * LEVELS[V.level].err;
  V.sightsDone += 1;
  pushEvent(V, 'sight', { q }); logLine(V, q > 0.75 ? 'A fine star sight: the latitude is sure.' : q > 0.35 ? 'A fair star sight.' : 'The star would not hold still: a poor sight.');
  return q;
}
export function decide(V, choice) {
  const d = V.decision; if (!d) return false;
  if (d.type === 'squall') {
    V.plan.squall = choice;
    if (choice === 'reef') setReef(V, true);
    else if (choice === 'run') { V.plan.prevTarget = V.ctl.target; const w = windAt(V, V.t + 4).from; const away = wrap360(w + 180); const side = wrap180(V.ctl.target - away) >= 0 ? 1 : -1; V.ctl.target = wrap360(away + side * 12); V.plan.autoTrim = true; }
    pushEvent(V, 'decision', { d: 'squall', choice });
  } else if (d.type === 'calm') {
    if (choice === 'sweeps') setSweeps(V, true);
    else if (choice === 'wait') V.skip = Math.max(0, d.until - V.t);
    pushEvent(V, 'decision', { d: 'calm', choice });
  } else if (d.type === 'help') {
    const hz = V.hazards.find((h) => h.id === d.hid);
    if (hz) {
      if (choice === 'help') { hz.state = 'helped'; V.water = Math.max(0, V.water - 0.12); V.rep += 5; V.morale = Math.min(100, V.morale + 8); V.ship.v *= 0.2; V.stats.helped += 1; logLine(V, 'We shared water with a dhow in need.'); }
      else { hz.state = 'passed'; V.rep -= 1; V.stats.passed += 1; }
    }
    pushEvent(V, 'decision', { d: 'help', choice });
  }
  V.decision = null; return true;
}

// ---- the step --------------------------------------------------------------------------------------------------------------------------------
export function stepVoyage(V, dt = DT) {
  if (V.phase !== 'sail') return V;
  const sh = V.ship, ctl = V.ctl, Lv = LEVELS[V.level];
  V.t += dt;
  const w = windAt(V, V.t); V.wind = w;
  const tod = todOf(V);

  // helm: the hull turns slowly toward the chosen heading
  const dh = wrap180(ctl.target - sh.h);
  const maxRate = (12 + 3.2 * Math.min(sh.v, 6)) * (V.hull < 40 ? 0.8 : 1);
  const want = clamp(dh * 1.1, -maxRate, maxRate);
  sh.yaw += (want - sh.yaw) * Math.min(1, dt * 2.0);
  sh.h = wrap360(sh.h + sh.yaw * dt);

  // wind angle and sail side (with hysteresis; changing sides means dipping the yard)
  const s = wrap180(w.from - sh.h);                           // + means wind comes from the starboard side
  const beta = Math.abs(s);
  const wantSide = s > 0 ? -1 : 1;                            // sail sits on the lee side
  if (wantSide !== sh.side && Math.min(beta, 180 - beta) > 7 && sh.dip <= 0) {
    sh.side = wantSide; sh.dip = dipTime(V); sh.dipTot = sh.dip; V.stats.dips += 1;
    if (beta < 90) V.stats.tacks += 1;
    pushEvent(V, 'dip', { tack: beta < 90, dur: sh.dip });
  }
  if (sh.dip > 0) sh.dip = Math.max(0, sh.dip - dt);
  // reef animates
  sh.reef += clamp(ctl.reef - sh.reef, -0.4 * dt, 0.4 * dt);
  // auto trim while running before a squall ("run" plan keeps the sail right)
  if (V.plan.autoTrim) ctl.trim = idealTrim(beta);
  const u = ctl.trim;
  const cond = 0.55 + 0.45 * (V.sail / 100) * (V.hull < 30 ? 0.9 : 1);
  const A = reefArea(sh.reef);
  const e = sailEff(beta, u, Lv.trimW);
  const ang = sheetAngle(u), ideal = idealAngle(beta);
  sh.beta = beta; sh.eff = e; sh.sailAng = ang;
  sh.flap = beta < 38 ? 1 : clamp((ang - ideal) / Lv.trimW - 0.28, 0, 1);
  sh.stall = beta < 38 ? 0 : clamp((ideal - ang) / (Lv.trimW * 1.3) - 0.28, 0, 1);
  const dipK = sh.dip > 0 ? 0.15 : 1;
  let vt = targetSpeed(beta, w.speed, u, sh.reef, cond, Lv.trimW) * dipK;
  if (ctl.sweeps) { vt += 0.95 * Math.min(1, sailors(V) / 4.5) * (V.morale < 15 ? 0.6 : 1); V.morale = Math.max(0, V.morale - 1.1 * dt); }
  if (V.hull < 50) vt *= 0.88 + 0.12 * V.hull / 50;
  if (V.plan.heaveTo > 0) { vt *= 0.1; V.plan.heaveTo -= dt; }
  sh.drive = vt;
  const tau = vt < sh.v ? 2.2 : 3.0;
  sh.v += (vt - sh.v) * Math.min(1, dt / tau);
  sh.v = Math.max(0, sh.v);
  V.stats.maxKn = Math.max(V.stats.maxKn, sh.v * KN);

  // strain and broaching
  const O = overpower(beta, w.speed, sh.reef, e);
  sh.over = O;
  if (O > 1) sh.strain += (O - 1) * 0.45 * dt * (1 - 0.18 * V.crew.sailmaker); else sh.strain = Math.max(0, sh.strain - 0.15 * dt);
  if (sh.strain >= 1) {
    sh.strain = 0.35; V.sail = Math.max(0, V.sail - 22); V.dmg += 1; pushEvent(V, 'split'); logLine(V, 'The sail split in a gust.');
  }
  if (O > 2.0) sh.bro += dt; else sh.bro = Math.max(0, sh.bro - dt * 0.5);
  if (sh.bro > 2.5) {
    sh.bro = 0; V.hull = Math.max(0, V.hull - 10); V.cargoLost += 0.1; sh.v *= 0.3; sh.yaw += (hash01(V.seed + Math.floor(V.t)) - 0.5) * 40; V.dmg += 1;
    pushEvent(V, 'broach'); logLine(V, 'A gust laid us over and cargo went into the sea.');
  }
  const lean = clamp(O, 0, 1.6);
  sh.heel += ((4 + 15 * lean) * (beta < 38 ? 0.3 : 1) * sh.side - sh.heel) * Math.min(1, dt * 2.5);   // degrees, + = starboard side down (the lee side)

  // leeway and current
  const lee = (beta < 100 ? 7 * (1 - polar(beta) * 0.5) * (0.3 + 0.7 * clamp(O, 0, 1)) : 1.5) * (sh.v > 0.6 ? 1 : 0.2);
  sh.lee = lee * sh.side;                                          // degrees; wind from starboard pushes the boat to port (smaller bearing)
  const track = sh.h + sh.lee;
  const cvx = sinD(V.cur.dir) * V.cur.mag, cvy = cosD(V.cur.dir) * V.cur.mag;
  sh.x += (sinD(track) * sh.v + cvx) * dt; sh.y += (cosD(track) * sh.v + cvy) * dt;
  // dead reckoning: heading with the compass bias and the log speed, no leeway or current
  const eh = sh.h + V.errBias * smooth(Math.min(1, V.t / 40));
  V.est.x += sinD(eh) * sh.v * V.logBias * dt; V.est.y += cosD(eh) * sh.v * V.logBias * dt;

  // supplies and morale
  V.water -= dt * (V.crew.sailors + 2) / 5 / (V.par * 3.0);
  if (V.water <= 0) { V.water = 0; V.thirst += dt; V.morale = Math.max(0, V.morale - 1.5 * dt); } else V.thirst = 0;
  if (sh.v > 3.5) V.morale = Math.min(100, V.morale + 0.025 * dt); else if (sh.v < 1) V.morale = Math.max(0, V.morale - 0.05 * dt);

  // star sight timing task
  if (V.sight && !V.sight.done) {
    const sg = V.sight; sg.t += dt;
    const sea = 0.25 + 0.05 * w.speed;
    sg.m = Math.sin(sg.t * (1.9 + 0.35 * Lv.err)) * sg.amp + 0.2 * Math.sin(sg.t * 3.7 + V.seed) * Math.min(1, sea);
    if (sg.t > 9) { sg.done = true; sg.q = null; V.sight = null; pushEvent(V, 'sight-lost'); }
  } else if (V.sight && V.sight.done && V.t - V.lastSightT > 2.5) V.sight = null;

  // hazards
  const night = isNight(tod);
  for (const h of V.hazards) {
    if (h.k === 'reef') {
      const d = Math.hypot(h.x - sh.x, h.y - sh.y);
      if (!h.seen && d < 260) { h.seen = true; pushEvent(V, 'reef-seen', { id: h.id }); }
      if (!h.hit && d < h.r + 5) {
        h.hit = true; V.hull = Math.max(0, V.hull - (14 + 2 * sh.v)); V.cargoLost += 0.05; sh.v *= 0.3; V.dmg += 1; V.morale = Math.max(0, V.morale - 6);
        const nx = (sh.x - h.x) / (d || 1), ny = (sh.y - h.y) / (d || 1); sh.x = h.x + nx * (h.r + 6); sh.y = h.y + ny * (h.r + 6);
        pushEvent(V, 'reef-hit', { id: h.id }); logLine(V, 'We struck a reef and the hull cried out.');
      } else if (h.hit && d > h.r + 60) h.hit = false;
    } else if (h.k === 'squall') {
      if (!h.warned && V.t >= h.t0 - h.warn) { h.warned = true; V.decision = { type: 'squall', t0: V.t, until: V.t + h.warn, hid: h.id }; pushEvent(V, 'squall-warn', { id: h.id }); }
      if (V.decision && V.decision.type === 'squall' && V.decision.hid === h.id && V.t >= h.t0) { V.decision = null; if (!V.plan.squall) V.plan.squall = 'press'; }
      if (!h.done && V.t > h.t0 + h.dur + 5) {
        h.done = true;
        if (V.plan.squall === 'run' && V.plan.prevTarget != null) { ctl.target = V.plan.prevTarget; V.plan.autoTrim = false; }
        if (V.plan.squall === 'reef') { V.plan.shake = V.t + 6; }
        V.plan.squall = null; V.plan.prevTarget = null;
        pushEvent(V, 'squall-end');
      }
    } else if (h.k === 'calm') {
      if (!h.warned && V.t >= h.t0 - 1) { h.warned = true; V.decision = { type: 'calm', t0: V.t, until: h.t0 + h.dur, hid: h.id }; pushEvent(V, 'calm-start', { id: h.id }); }
      if (!h.done && V.t > h.t0 + h.dur + 6) { h.done = true; setSweeps(V, false); if (V.decision && V.decision.type === 'calm') V.decision = null; pushEvent(V, 'calm-end'); }
    } else if (h.k === 'help') {
      const d = Math.hypot(h.x - sh.x, h.y - sh.y);
      if (h.state === 'none' && d < 120) { h.state = 'offered'; V.decision = { type: 'help', t0: V.t, until: V.t + 9, hid: h.id }; pushEvent(V, 'help-near', { id: h.id }); }
      else if (h.state === 'offered' && V.decision && V.decision.hid === h.id && V.t > V.decision.until) { V.decision = null; h.state = 'passed'; V.stats.passed += 1; }
    } else if (h.k === 'life' && !h.done && V.t >= h.t0) { h.done = true; pushEvent(V, 'life', { kind: h.kind }); logLine(V, h.kind === 'dolphins' ? 'Dolphins ran alongside the bow.' : 'Flying fish skimmed the waves.'); }
  }
  if (V.plan.shake && V.t > V.plan.shake) { V.plan.shake = 0; setReef(V, false); }
  if (V.decision && V.decision.type !== 'calm' && V.t > V.decision.until + 0.01 && V.decision.type === 'squall') V.decision = null;
  void night;

  // coast, landfall and harbour
  const f = frame(V, sh);
  const coastGap = V.dist - f.u;                              // metres to the coast line
  const alongOK = Math.abs(f.l) < COAST_HALF;
  if (!V.landfall && ((alongOK && coastGap < SIGHT_R) || Math.hypot(V.D.x - sh.x, V.D.y - sh.y) < SIGHT_R)) {
    V.landfall = { u: f.u, l: f.l, t: V.t }; V.est.x = sh.x; V.est.y = sh.y; pushEvent(V, 'land'); logLine(V, 'Land sighted. The coast rises out of the haze.');
  }
  if (V.landfall) { V.est.x = lerp(V.est.x, sh.x, Math.min(1, dt * 1.5)); V.est.y = lerp(V.est.y, sh.y, Math.min(1, dt * 1.5)); }
  if (alongOK && coastGap < 22 && V.grounded <= 0) {
    V.grounded = 3; V.hull = Math.max(0, V.hull - 8); V.dmg += 1; sh.v *= 0.2; pushEvent(V, 'ground');
    const bx = sinD(V.bearing), by = cosD(V.bearing); sh.x -= bx * 10; sh.y -= by * 10;
  }
  if (V.grounded > 0) V.grounded -= dt;
  if (alongOK && coastGap < 12) { const bx = sinD(V.bearing), by = cosD(V.bearing); sh.x -= bx * (12 - coastGap); sh.y -= by * (12 - coastGap); }
  if (Math.hypot(V.D.x - sh.x, V.D.y - sh.y) < HARBOUR_R) finish(V, 'arrived');
  else if (V.hull <= 0) finish(V, 'wrecked');
  else if (V.thirst > 22) finish(V, 'thirst');
  else if (V.t > V.par * 3.4) finish(V, 'lost');
  return V;
}

function finish(V, how) {
  V.phase = how === 'arrived' ? 'arrived' : 'failed';
  const T = V.t, ratio = T / V.par;
  const dmgLoss = (100 - V.hull);
  const stars = how !== 'arrived' ? 0 : 1 + (ratio < 1.15 ? 1 : 0) + (V.hull >= 70 && V.landfall && Math.abs(V.landfall.l) < 260 ? 1 : 0);
  V.result = { how, t: T, ratio, stars, hull: V.hull, dmgLoss, sights: V.stats.sights, tacks: V.stats.tacks, helped: V.stats.helped, cargoLost: Math.min(1, V.cargoLost), water: V.water, rep: V.rep + (how === 'arrived' ? (ratio < 1 ? 3 : ratio < 1.4 ? 1 : 0) : -6) };
  pushEvent(V, how);
}

export const knots = (ms) => Math.round(ms * KN * 10) / 10;
