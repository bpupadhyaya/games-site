// Buzkashi: the match simulation. Pure and deterministic (fixed 60 Hz, randomness only from the rng handed in). Nothing here draws.
// A match is riders (two teams), one sack, a post (the flag) and a scoring circle. Everything the picture and the Rules page need is in `s`.
import {
  FIELD, FLAG, CIRCLE, CENTRE, FLAG_RING, FLAG_WIND, RIDER_R, V_WALK, ACC, BRAKE, SPRINT_MUL, STAM_DRAIN, SHIELD_DRAIN, STAM_REGEN, TIRED, CARRY_MUL,
  SHIELD_MUL, STRIP_BASE, STRIP_STR, STRIP_SHIELD, STRIP_TIRED, STRIP_MIN, STRIP_MAX, SCOOP_REACH, SCOOP_T, SCOOP_VMAX, STRIP_REACH, STRIP_CD, RECOVER_T, RESET_T, OVERTIME, HORSES, gauntletRivals, gauntletSkill,
} from './consts.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const r2 = (v) => Math.round(v * 100) / 100;
export const fmtClock = (v) => { const t = Math.max(0, Math.ceil(v)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

const spawnRider = (id, team, k, n, skill, horse, hum, side) => {
  const slot = n === 1 ? 0 : (k / (n - 1) - 0.5) * 2;
  const H = horse || HORSES[1];
  const vt = hum ? H.vTop : 9.9 + 1.5 * skill;
  return {
    id, team, hum: !!hum, x: slot * 8.5, y: team === 0 ? -9.5 : 9.5, th: team === 0 ? Math.PI / 2 : -Math.PI / 2, v: 0, yaw: 0,
    st: 1, stride: id * 0.37, lean: 0, shield: false, sprint: false, scoopT: 0, stripCd: 0, recover: 0, tug: 0,
    vTop: vt, turn: hum ? H.turn : 0.95 + 0.15 * skill, str: hum ? H.str : 0.85 + 0.35 * skill, skill: hum ? 1 : skill,
    wind: 0, lastAng: null, plan: { kind: 'wait', tx: 0, ty: 0, speed: 0, grab: false, shield: false, sprint: false }, think: 0, jx: 0, jy: 0,
    side: side || 0, taken: 0, strips: 0,
  };
};

export function createMatch(cfg, rng) {
  const size = Math.max(1, cfg.size | 0), nRiv = cfg.gauntlet ? gauntletRivals(0) : (cfg.rivals ?? size);
  const H = HORSES[cfg.horse ?? 1];
  const riders = [];
  for (let k = 0; k < size; k++) riders.push(spawnRider(riders.length, 0, k, size, k === 0 ? (cfg.coach ? 0.9 : 1) : cfg.mateSkill ?? 0.55, k === 0 ? H : null, k === 0 && !cfg.coach));
  for (let k = 0; k < nRiv; k++) riders.push(spawnRider(riders.length, 1, k, nRiv, cfg.skill ?? 0.5, null, false));
  const s = {
    phase: 'ready', t: 0, clock: cfg.time ?? 150, ot: false, over: false, held: false, score: [0, 0], carries: 0, winner: -1,
    riders, sack: { x: CENTRE.x, y: CENTRE.y - 0.6, vx: 0, vy: 0, h: -1, air: 0, rounded: false, spin: 0 },
    resetT: 0, events: [], evId: 0, parts: [], shake: 0, hinted: false, hintCount: 0, k: cfg.ground ?? 1, gauntlet: !!cfg.gauntlet,
    skill: cfg.skill ?? 0.5, spawnN: 0, lastScorer: -1, firstCarryT: -1, noCount: 0, endT: 0,
  };
  const ev = (type, o = {}) => { s.events.push({ n: s.evId++, type, t: r2(s.t), ...o }); if (s.events.length > 40) s.events.shift(); };
  const route = () => (s.sack.rounded ? CIRCLE : FLAG);
  const carrier = () => (s.sack.h >= 0 ? riders[s.sack.h] : null);

  // ---- the plan (pure: no randomness, no side effects). The same function drives the computer riders, the Think hint and Watch & Learn. ----
  function choosePlan(r) {
    const sack = s.sack, car = carrier(), mates = riders.filter((q) => q.team === r.team), foes = riders.filter((q) => q.team !== r.team);
    const dest = route();
    const nearFoe = foes.reduce((b, q) => (!b || dist(q, r) < dist(b, r) ? q : b), null);
    const P = (kind, tx, ty, o = {}) => ({ kind, tx, ty, speed: 1, grab: false, shield: false, sprint: false, ...o });
    if (s.phase === 'ready') return P('wait', r.x, r.y, { speed: 0 });
    if (car === r) {
      const foeD = nearFoe ? dist(nearFoe, r) : 99;
      const shield = foeD < 3.2 && r.st > 0.1;
      const sprint = foeD > 5.5 && r.st > 0.5;
      let tx, ty, kind;
      if (!sack.rounded) {
        // ride out to the post and sweep round it on the side we are already on
        const dir = r.x >= FLAG.x ? 1 : -1, dx = r.x - FLAG.x, dy = r.y - FLAG.y, a = Math.atan2(dy, dx);
        const d = Math.hypot(dx, dy);
        kind = 'carry-flag';
        if (d > FLAG_RING + 3) { tx = FLAG.x + dir * 6.5; ty = FLAG.y - 7; }
        else { const ang = a + dir * 0.9; tx = FLAG.x + Math.cos(ang) * 5.2; ty = FLAG.y + Math.sin(ang) * 5.2; }
      } else { tx = CIRCLE.x; ty = CIRCLE.y; kind = 'carry-home'; }
      // swerve away from a rival who is about to cut in
      if (nearFoe && foeD < 7) { const ax = r.x - nearFoe.x, ay = r.y - nearFoe.y, m = Math.hypot(ax, ay) || 1; tx += (ax / m) * 3; ty += (ay / m) * 3; }
      return P(kind, tx, ty, { shield, sprint });
    }
    if (car && car.team === r.team) {
      // a team mate has it: block the nearest rival, or lead the way
      if (nearFoe && dist(nearFoe, car) < 11) {
        const f = 0.45;
        return P('escort', car.x + (nearFoe.x - car.x) * f, car.y + (nearFoe.y - car.y) * f, { sprint: r.st > 0.6 && dist(r, car) > 8 });
      }
      const dx = dest.x - car.x, dy = dest.y - car.y, m = Math.hypot(dx, dy) || 1;
      return P('lead', car.x + (dx / m) * 7 + (r.id % 2 ? 3 : -3), car.y + (dy / m) * 7, { speed: 0.9 });
    }
    if (car) {
      // a rival has it: the two nearest chase and strip, the rest cut it off on the way to where it is going
      const order = mates.filter((q) => !q.hum).sort((a, b) => dist(a, car) - dist(b, car));
      const rank = order.indexOf(r);
      const d = dist(r, car);
      if (rank < 2 || r.hum) {
        const lead = Math.min(0.7, d / 12);
        const tx = car.x + Math.cos(car.th) * car.v * lead, ty = car.y + Math.sin(car.th) * car.v * lead;
        return P('strip', tx, ty, { sprint: r.st > 0.45 && d > 5, grab: d < STRIP_REACH - 0.15 && r.stripCd <= 0 && r.recover <= 0, speed: d < 3 ? 1.05 : 1 });
      }
      return P('cut', car.x + (dest.x - car.x) * 0.55, car.y + (dest.y - car.y) * 0.55, { sprint: r.st > 0.6 });
    }
    // the sack is loose: the nearest computer rider of each side goes for it, the others hold off at a distance
    const ord = mates.filter((q) => !q.hum).sort((a, b) => dist(a, sack) - dist(b, sack));
    const goes = r.hum || ord[0] === r || (ord[1] === r && r.skill > 0.65 && s.skill > 0.6 && dist(r, sack) < 7);
    if (goes) {
      const d = dist(r, sack), lead = Math.min(0.5, d / 20);
      const tx = sack.x + sack.vx * lead, ty = sack.y + sack.vy * lead;
      const slow = d < 4.5 ? clamp((d - 0.8) / 4.5, 0.35, 1) : 1;
      return P('scoop', tx, ty, { speed: slow, grab: d < SCOOP_REACH - 0.15 && r.v <= SCOOP_VMAX - 0.6 && r.scoopT <= 0 && r.recover <= 0 && sack.air <= 0, sprint: d > 9 && r.st > 0.4 });
    }
    // hover between the sack and our own side of the field
    const side = r.team === 0 ? -1 : 1;
    return P('hover', sack.x + (r.id % 2 ? 5.5 : -5.5), sack.y + side * 5, { speed: 0.6 });
  }

  // ---- control of one rider for one tick: the plan with a little human-like error, reaction time and skill -------------------------------
  function aiControl(r, dt) {
    r.think -= dt;
    if (r.think <= 0) {
      r.plan = choosePlan(r);
      r.think = 0.5 - 0.38 * r.skill + rng.range(0, 0.08);
      const err = (1 - r.skill) * 1.6;
      r.jx = rng.range(-err, err); r.jy = rng.range(-err, err);
      // a rider who could grab does it a beat later when less skilled
      if (r.plan.grab && rng.next() > 0.55 + 0.45 * r.skill) r.plan.grab = false;
    }
    const p = r.plan;
    const c = { tx: clamp(p.tx + r.jx, FIELD.x0 + 1.2, FIELD.x1 - 1.2), ty: clamp(p.ty + r.jy, FIELD.y0 + 1.2, FIELD.y1 - 1.2), speed: p.speed, shield: p.shield, sprint: p.sprint, grab: p.grab };
    p.grab = false;
    if (p.kind === 'strip' || p.kind === 'scoop') r.think = Math.min(r.think, 0.18 - 0.08 * r.skill);
    return c;
  }

  // ---- kinematics -------------------------------------------------------------------------------------------------------------------------
  function drive(r, c, dt) {
    r.shield = !!c.shield && s.sack.h === r.id && r.st > 0.02;
    r.sprint = !!c.sprint && r.st > 0.03;
    let want = 0, th = r.th;
    if (c.tx != null) {
      const dx = c.tx - r.x, dy = c.ty - r.y, d = Math.hypot(dx, dy);
      if (d > 0.35) th = Math.atan2(dy, dx);
      const frac = c.speed != null ? c.speed : clamp((d - 1.2) / 7, 0.18, 1);
      want = d < 0.5 ? 0 : frac;
    } else if (c.turn != null || c.go != null) {
      th = r.th + (c.turn || 0) * 3;
      want = clamp(c.go ?? 0.6, 0, 1);
    } else want = 0.22;
    let vTop = r.vTop * s.k * (r.sprint ? SPRINT_MUL : 1);
    if (s.sack.h === r.id) vTop *= r.shield ? SHIELD_MUL : CARRY_MUL;
    if (r.st < TIRED) vTop *= 0.82;
    if (r.scoopT > 0) vTop *= 0.5;
    if (r.recover > 0) vTop *= 0.8;
    const vWant = want <= 0 ? 0 : Math.max(V_WALK * 0.8, want * vTop);
    const accel = vWant > r.v ? ACC * (r.sprint ? 1.4 : 1) : BRAKE;
    r.v += clamp(vWant - r.v, -accel * dt, accel * dt);
    const dth = wrap(th - r.th);
    const maxYaw = 3.4 * r.turn / (1 + 0.09 * r.v);
    const yaw = clamp(dth / Math.max(dt, 1e-3), -maxYaw, maxYaw);
    r.yaw += (yaw - r.yaw) * Math.min(1, dt * 10);
    r.th = wrap(r.th + r.yaw * dt);
    r.v *= 1 - Math.min(0.5, Math.abs(r.yaw) * 0.03 * dt * 6);
    r.x += Math.cos(r.th) * r.v * dt; r.y += Math.sin(r.th) * r.v * dt;
    // the fence
    const m = RIDER_R;
    if (r.x < FIELD.x0 + m) { r.x = FIELD.x0 + m; r.v *= 0.96; } else if (r.x > FIELD.x1 - m) { r.x = FIELD.x1 - m; r.v *= 0.96; }
    if (r.y < FIELD.y0 + m) { r.y = FIELD.y0 + m; r.v *= 0.96; } else if (r.y > FIELD.y1 - m) { r.y = FIELD.y1 - m; r.v *= 0.96; }
    // stamina and gait
    if (r.sprint) r.st = Math.max(0, r.st - STAM_DRAIN * dt);
    else if (r.shield) r.st = Math.max(0, r.st - SHIELD_DRAIN * dt);
    else r.st = Math.min(1, r.st + STAM_REGEN * (r.v < 5 ? 1.7 : 1) * dt);
    r.stride += (r.v * 0.2 + 0.2) * dt * (r.sprint ? 1.2 : 1);
    r.lean += ((r.scoopT > 0 ? 1 : 0) - r.lean) * Math.min(1, dt * 12);
    if (r.stripCd > 0) r.stripCd -= dt;
    if (r.recover > 0) r.recover -= dt;
    if (r.tug > 0) r.tug -= dt;
  }

  // ---- contacts: grab, strip, collisions ---------------------------------------------------------------------------------------------------
  function takeSack(r, how) {
    const sk = s.sack;
    sk.h = r.id; sk.vx = 0; sk.vy = 0; sk.air = 0; r.wind = 0; r.lastAng = null; r.scoopT = 0; r.taken++;
    if (s.firstCarryT < 0) s.firstCarryT = s.t;
    ev(how, { id: r.id, team: r.team });
  }
  function tryGrab(r) {
    const sk = s.sack, car = carrier();
    if (r.scoopT > 0 || r.recover > 0) return;
    if (!car) {
      if (sk.air > 0 || dist(r, sk) > SCOOP_REACH) return;
      r.scoopT = SCOOP_T; r.scoopFrom = r.v; ev('lean', { id: r.id });
    } else if (car.team !== r.team && r.stripCd <= 0 && dist(r, car) <= STRIP_REACH) {
      r.stripCd = STRIP_CD; r.tug = 0.5; car.tug = 0.5;
      const lowShield = car.shield ? STRIP_SHIELD : 0;
      let p = STRIP_BASE + STRIP_STR * (r.str - car.str) - lowShield + (car.st < TIRED ? STRIP_TIRED : 0) + (r.sprint ? 0.05 : 0) - (car.v > r.v + 2 ? 0.1 : 0);
      p = clamp(p, STRIP_MIN, STRIP_MAX);
      if (rng.next() < p) {
        r.strips++;
        car.recover = RECOVER_T; car.shield = false;
        if (rng.next() < 0.55) { s.sack.h = -1; takeSack(r, 'steal'); ev('stripped', { id: car.id }); }
        else {
          const a = rng.range(0, TAU);
          sk.h = -1; sk.x = car.x; sk.y = car.y; sk.vx = Math.cos(a) * 3.6; sk.vy = Math.sin(a) * 3.6; sk.air = 0.5;
          ev('loose', { id: car.id, by: r.id });
        }
        s.shake = 0.25;
      } else ev('tug', { id: r.id, on: car.id });
    }
  }
  function finishScoop(r) {
    const sk = s.sack;
    if (carrier() || sk.air > 0 || dist(r, sk) > SCOOP_REACH * 1.25) { ev('miss', { id: r.id }); return; }
    if (r.scoopFrom > SCOOP_VMAX || r.v > SCOOP_VMAX + 1) {
      const a = r.th + rng.range(-0.8, 0.8);
      sk.vx = Math.cos(a) * 4.2; sk.vy = Math.sin(a) * 4.2; sk.air = 0.4; r.recover = 0.4;
      ev('fumble', { id: r.id });
      return;
    }
    takeSack(r, 'scoop');
  }

  function collide(dt) {
    const n = riders.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = riders[i], b = riders[j];
      let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      const lim = RIDER_R * 2;
      if (d >= lim) continue;
      if (d < 1e-4) { dx = Math.cos(a.id); dy = Math.sin(a.id); d = 1; }
      const nx = dx / d, ny = dy / d, ov = lim - d;
      // the heavier (stronger) rider is pushed less
      const wa = b.str / (a.str + b.str), wb = 1 - wa;
      a.x -= nx * ov * wa; a.y -= ny * ov * wa; b.x += nx * ov * wb; b.y += ny * ov * wb;
      const rel = (a.v * Math.cos(a.th) - b.v * Math.cos(b.th)) * nx + (a.v * Math.sin(a.th) - b.v * Math.sin(b.th)) * ny;
      if (rel > 3.5) { const lose = Math.min(0.12, rel * 0.012); if (a.str <= b.str) a.v *= 1 - lose; if (b.str <= a.str) b.v *= 1 - lose; if (s.t - (s.lastBump || -9) > 0.35) { s.lastBump = s.t; ev('bump', { a: a.id, b: b.id }); } }
    }
  }

  function updateSack(dt) {
    const sk = s.sack, car = carrier();
    if (car) {
      const side = 1.35;
      sk.x = car.x + Math.cos(car.th + Math.PI / 2) * side * (car.shield ? 0.45 : 1) * (car.lean * 0.3 + 0.8);
      sk.y = car.y + Math.sin(car.th + Math.PI / 2) * side * (car.shield ? 0.45 : 1) * (car.lean * 0.3 + 0.8);
      sk.vx = 0; sk.vy = 0;
      return;
    }
    if (s.resetT > 0) return;
    sk.x += sk.vx * dt; sk.y += sk.vy * dt;
    const f = Math.max(0, 1 - 2.4 * dt); sk.vx *= f; sk.vy *= f;
    if (sk.air > 0) sk.air -= dt;
    if (sk.x < FIELD.x0 + 0.5) { sk.x = FIELD.x0 + 0.5; sk.vx = Math.abs(sk.vx) * 0.4; } else if (sk.x > FIELD.x1 - 0.5) { sk.x = FIELD.x1 - 0.5; sk.vx = -Math.abs(sk.vx) * 0.4; }
    if (sk.y < FIELD.y0 + 0.5) { sk.y = FIELD.y0 + 0.5; sk.vy = Math.abs(sk.vy) * 0.4; } else if (sk.y > FIELD.y1 - 0.5) { sk.y = FIELD.y1 - 0.5; sk.vy = -Math.abs(sk.vy) * 0.4; }
    // a running horse pushes a loose sack aside a little
    for (const r of riders) {
      const d = dist(r, sk);
      if (d < RIDER_R + 0.3 && r.v > 3 && r.scoopT <= 0 && sk.air <= 0) { sk.vx += Math.cos(r.th) * r.v * 0.1; sk.vy += Math.sin(r.th) * r.v * 0.1; }
    }
  }

  function afterCarry(by) {
    s.resetT = RESET_T;
    const sk = s.sack;
    sk.h = -1; sk.x = CIRCLE.x; sk.y = CIRCLE.y; sk.vx = 0; sk.vy = 0; sk.rounded = false; sk.air = 0;
    for (const r of riders) { r.wind = 0; r.lastAng = null; r.shield = false; }
    s.lastScorer = by.team;
  }

  function addRival() {
    const k = riders.filter((q) => q.team === 1).length;
    const r = spawnRider(riders.length, 1, 0, 1, gauntletSkill(s.carries), null, false);
    r.x = (k % 2 ? 1 : -1) * (6 + (k % 3) * 2); r.y = FIELD.y1 - 2; r.th = -Math.PI / 2;
    riders.push(r);
    ev('join', { id: r.id });
  }

  function endMatch() {
    s.over = true; s.phase = 'over';
    s.winner = s.score[0] > s.score[1] ? 0 : s.score[1] > s.score[0] ? 1 : -1;
    ev('end', { winner: s.winner });
  }

  return {
    s, choosePlan, carrier,
    start() { if (s.phase === 'ready') { s.phase = 'play'; ev('start'); } },
    update(dt, ctl) {
      if (s.over || s.held) return;
      s.t += dt;
      if (s.shake > 0) s.shake = Math.max(0, s.shake - dt);
      if (s.phase === 'ready') { for (const r of riders) { r.stride += 0.4 * dt; } return; }
      // the clock
      s.clock -= dt;
      if (s.clock <= 0) {
        if (s.gauntlet) { s.clock = 0; endMatch(); return; }
        if (s.score[0] === s.score[1] && !s.ot) { s.ot = true; s.clock = OVERTIME; ev('overtime'); }
        else { s.clock = 0; endMatch(); return; }
      }
      if (s.resetT > 0) {
        s.resetT -= dt;
        if (s.resetT <= 0) { s.sack.x = CENTRE.x; s.sack.y = CENTRE.y; s.sack.vx = 0; s.sack.vy = 0; s.sack.rounded = false; ev('drop'); }
      }
      // controls
      const ord = riders.length;
      for (let k = 0; k < ord; k++) {
        const r = riders[(k + Math.floor(s.t * 60)) % ord];
        let c;
        if (r.hum) c = ctl || {};
        else c = aiControl(r, dt);
        if (s.resetT > 0 && !r.hum) c = { tx: CENTRE.x + (r.id % 3 - 1) * 6, ty: CENTRE.y + (r.team === 0 ? -5 : 5), speed: 0.55 };
        if (s.resetT > 0 && r.hum) c = { ...c, grab: false };
        drive(r, c, dt);
        if (c.grab && s.resetT <= 0) tryGrab(r);
        if (r.scoopT > 0) { r.scoopT -= dt; if (r.scoopT <= 0) { r.scoopT = 0; finishScoop(r); } }
      }
      collide(dt);
      updateSack(dt);
      // the post and the circle
      const car = carrier();
      for (const r of riders) {
        if (car !== r) { r.wind *= Math.max(0, 1 - dt * 2); r.lastAng = null; continue; }
        const dx = r.x - FLAG.x, dy = r.y - FLAG.y, d = Math.hypot(dx, dy);
        if (d < FLAG_RING) {
          const a = Math.atan2(dy, dx);
          if (r.lastAng != null) r.wind += wrap(a - r.lastAng);
          r.lastAng = a;
          if (!s.sack.rounded && Math.abs(r.wind) >= FLAG_WIND) { s.sack.rounded = true; ev('flag', { id: r.id }); }
        } else { r.wind *= Math.max(0, 1 - dt * 1.5); r.lastAng = null; }
        if (Math.hypot(r.x - CIRCLE.x, r.y - CIRCLE.y) <= CIRCLE.r) {
          if (s.sack.rounded) {
            s.score[r.team]++; s.carries++;
            ev('score', { id: r.id, team: r.team });
            afterCarry(r);
            if (s.ot || (s.gauntlet && s.score[1] >= 3)) { endMatch(); return; }
            if (s.gauntlet && r.team === 0) { for (let k = riders.filter((q) => q.team === 1).length; k < gauntletRivals(s.carries); k++) addRival(); }
            break;
          } else if (s.t - s.noCount > 3) { s.noCount = s.t; ev('nocount', { id: r.id }); }
        }
      }
      // stamina note and dust
      for (const r of riders) {
        if (r.v > 5.5 && s.parts.length < 90 && ((Math.floor(s.t * 60) + r.id * 3) % 7 === 0)) {
          s.parts.push({ x: r.x - Math.cos(r.th) * 1.2, y: r.y - Math.sin(r.th) * 1.2, vx: rng.range(-0.6, 0.6), vy: rng.range(-0.6, 0.6), life: 0.7, max: 0.7, size: 0.35 + rng.next() * 0.3 });
        }
      }
      for (let i = s.parts.length - 1; i >= 0; i--) { const p = s.parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life <= 0) s.parts.splice(i, 1); }
    },
  };
}

// ---- Think and Watch & Learn: what the rider is doing and why, in words, and the line to draw -------------------------------------------------
export function describe(m, r) {
  const s = m.s, p = m.choosePlan(r), sk = s.sack, car = m.carrier();
  const pts = [{ x: r.x, y: r.y }];
  const lines = [];
  const d = (a, b) => Math.round(Math.hypot(a.x - b.x, a.y - b.y));
  const who = r.hum ? 'you' : 'the rider';
  switch (p.kind) {
    case 'wait': lines.push('The chukka has not started. The sack lies in the middle of the field.'); break;
    case 'scoop':
      pts.push({ x: sk.x, y: sk.y });
      lines.push(`The sack is loose, about ${d(r, sk)} metres away. ${r.hum ? 'Ride to it' : 'The rider goes to it'} and slow down: a scoop at more than ${SCOOP_VMAX.toFixed(0)} metres a second is fumbled.`);
      lines.push(`Tap Grab when it is within ${SCOOP_REACH.toFixed(1)} metres. A rival close by will try to scoop it first.`);
      break;
    case 'carry-flag':
      pts.push({ x: FLAG.x + (r.x >= FLAG.x ? 6 : -6), y: FLAG.y - 4 }, { x: FLAG.x, y: FLAG.y + 6 }, { x: FLAG.x + (r.x >= FLAG.x ? -6 : 6), y: FLAG.y - 4 }, { x: CIRCLE.x, y: CIRCLE.y });
      lines.push(`${r.hum ? 'You have' : 'The rider has'} the sack. It must go round the post at the far end before it can score: a half turn on either side is enough.`);
      lines.push(p.shield ? 'A rival is close, so the sack is tucked in with the shield.' : p.sprint ? 'No rival is near, so the spur is a good use of stamina now.' : 'Keep the horse steady and watch for a rival coming alongside.');
      break;
    case 'carry-home':
      pts.push({ x: CIRCLE.x, y: CIRCLE.y });
      lines.push(`The post is rounded. Now it is straight into the white circle, about ${d(r, CIRCLE)} metres away.`);
      lines.push(p.shield ? 'A rival is near: shield the sack and keep riding.' : 'Spur if the horse has stamina and nobody is close.');
      break;
    case 'strip':
      pts.push({ x: car.x, y: car.y });
      lines.push(`${car.team === r.team ? 'A team mate' : 'A rival'} is carrying it, ${d(r, car)} metres away. Ride alongside, then tap Grab to try to strip it.`);
      lines.push('The chance is better against a tired horse, a rider who has not shielded, and with a stronger horse. Each try needs a short rest.');
      break;
    case 'cut': {
      pts.push({ x: p.tx, y: p.ty });
      lines.push('A rival has the sack and two of ours are chasing it. This rider cuts across to where it is heading, to block it.');
      break;
    }
    case 'escort': case 'lead':
      pts.push({ x: p.tx, y: p.ty });
      lines.push(p.kind === 'escort' ? 'A team mate has the sack. Ride between the carrier and the nearest rival to block the way.' : 'A team mate has the sack and no rival is near. Ride ahead and clear the way.');
      break;
    default:
      pts.push({ x: p.tx, y: p.ty });
      lines.push('A team mate is closer to the sack. Hold a short distance away, ready to ride with whoever picks it up.');
  }
  return { kind: p.kind, lines, pts, plan: p, who };
}
