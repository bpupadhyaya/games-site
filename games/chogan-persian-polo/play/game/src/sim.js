// The match simulation: pure and deterministic, fixed 60 Hz steps. It owns every position, every stick contact tick and every outcome.
// The presenter only reads `state`; it never writes back.
import { DT, HW, HL, GOAL_HW, POST_R, BALL_R, GRAV, V_BASE, V_SPRINT, ACC, BRAKE, A_LAT, STAM_DRAIN, STAM_REGEN, BODY_HALF_W, BODY_HALF_L,
  WIND_MAX, STRIKE_TICKS, STRIKE_MIN, STRIKE_MAX, FOLLOW_TICKS, SWING_COOL, REACH, HIT_MAX_Y, HOOK_TICKS, HOOK_WIN, HOOK_COOL, HOOK_RANGE, HOOK_STUN,
  PERIODS, PERIOD_SECS, CHAMFER, FIG, RESET_MAX, THROW_COUNT, GOAL_PAUSE, FOUL_PAUSE, BREAK_PAUSE, SPOTS, LEVELS, MATE_LEVEL } from './consts.js';
import { aiControl, aiTeamThink } from './ai.js';
import { clamp, wrap, hyp } from './util.js';

const TAU = Math.PI * 2;


// ---- ball physics (shared by the real step and by the prediction helpers) -------------------------------------------------------------
export function physBall(b, dt, emit) {
  const onGround = b.y <= BALL_R + 1e-4 && Math.abs(b.vy) < 0.9;
  if (!onGround) {
    b.vy -= GRAV * dt; b.y += b.vy * dt;
    const k = Math.exp(-0.12 * dt); b.vx *= k; b.vz *= k;
    if (b.y <= BALL_R) {
      b.y = BALL_R;
      if (b.vy < -0.9) { b.vy = -b.vy * 0.52; b.vx *= 0.92; b.vz *= 0.92; b.bounces = (b.bounces || 0) + 1; if (emit) emit('bounce', { x: b.x, z: b.z, p: Math.min(1, -b.vy / 5) }); } else { b.vy = 0; }
    }
  } else {
    b.y = BALL_R; b.vy = 0;
    const sp = hyp(b.vx, b.vz);
    if (sp > 0) {
      const dec = (1.9 + 0.16 * sp) * dt, ns = Math.max(0, sp - dec);
      b.vx *= ns / sp; b.vz *= ns / sp;
      if (ns < 0.05) { b.vx = 0; b.vz = 0; }
    }
  }
  b.x += b.vx * dt; b.z += b.vz * dt;
  b.rot = (b.rot || 0) + hyp(b.vx, b.vz) * dt / BALL_R;
  const hwB = HW - BALL_R;
  if (b.x > hwB) { b.x = hwB; if (b.vx > 0.6) { b.vx *= -0.62; b.vz *= 0.92; if (emit) emit('board', { x: b.x, z: b.z, p: Math.min(1, Math.abs(b.vx) / 12) }); } }
  else if (b.x < -hwB) { b.x = -hwB; if (b.vx < 0) { b.vx *= -0.62; b.vz *= 0.92; if (emit) emit('board', { x: b.x, z: b.z, p: Math.min(1, Math.abs(b.vx) / 12) }); } }
  // corner cuts: a 45-degree wall in each corner
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    if (sx * b.x > HW - CHAMFER && sz * b.z > HL - CHAMFER) {
      const pen = sx * b.x + sz * b.z + BALL_R * Math.SQRT2 - (HW + HL - CHAMFER);
      if (pen > 0) {
        const k = pen / 2; b.x -= sx * k; b.z -= sz * k;
        const vn = (sx * b.vx + sz * b.vz) / Math.SQRT2;
        if (vn > 0) { b.vx -= 1.62 * vn * sx / Math.SQRT2; b.vz -= 1.62 * vn * sz / Math.SQRT2; if (emit) emit('board', { x: b.x, z: b.z, p: Math.min(1, vn / 12) }); }
      }
    }
  }
  for (const px of [-GOAL_HW, GOAL_HW]) for (const pz of [-HL, HL]) {
    const dx = b.x - px, dz = b.z - pz, d = hyp(dx, dz), rr = POST_R + BALL_R;
    if (d < rr && d > 1e-5) {
      const nx = dx / d, nz = dz / d; b.x = px + nx * rr; b.z = pz + nz * rr;
      const vn = b.vx * nx + b.vz * nz; if (vn < 0) { b.vx -= 1.7 * vn * nx; b.vz -= 1.7 * vn * nz; if (emit) emit('post', { x: b.x, z: b.z, p: Math.min(1, -vn / 12) }); }
    }
  }
  const inMouth = Math.abs(b.x) < GOAL_HW - 0.05;
  if (Math.abs(b.z) > HL) {
    if (inMouth) {
      const depth = Math.abs(b.z) - HL;
      b.vx *= 0.96; b.vz *= 0.94;
      if (depth > 2.2) { b.z = Math.sign(b.z) * (HL + 2.2); b.vz *= -0.2; }
    } else {
      const sg = Math.sign(b.z);
      b.z = sg * HL; if (b.vz * sg > 0.6) { b.vz *= -0.6; b.vx *= 0.94; if (emit) emit('board', { x: b.x, z: b.z, p: 0.6 }); }
    }
  }
}

export function spotFor(team, role) {
  const p = SPOTS[role];
  return team === 0 ? { x: p.x, z: p.z } : { x: -p.x, z: -p.z };
}

// cfg: { human: role 0..2 | -1 (all computer), levels: [levelA, levelB], mateLevel, periodSecs, periods, drill }
export function createSim(cfg, rng) {
  const periodSecs = cfg.periodSecs || 90, periods = cfg.periods || PERIODS;
  const s = {
    v: 1, t: 0, tick: 0, phase: 'reset', phaseT: 0, cfg: { ...cfg }, period: 1, periods, clock: periodSecs, periodSecs, score: [0, 0],
    ball: { x: 0, y: BALL_R, z: 0, vx: 0, vy: 0, vz: 0, lastRider: -1, lastTeam: -1, bounces: 0, free: true, rot: 0 },
    riders: [], events: [], evId: 0, msg: null, restart: null, countdown: 0, over: false, winner: -1,
    stats: [{ shots: 0, hits: 0, hooks: 0, fouls: 0, goals: 0 }, { shots: 0, hits: 0, hooks: 0, fouls: 0, goals: 0 }],
    ai: [{ chaser: -1, next: 0 }, { chaser: -1, next: 0 }],
    ctl: { sx: 0, sz: 0, sprint: false, swing: false, hook: false },
    hold: null, holdUntil: 0, holdId: 0,
  };
  const lv = cfg.levels || [MATE_LEVEL, 3];
  for (let team = 0; team < 2; team++) for (let role = 0; role < 3; role++) {
    const sp = spotFor(team, role);
    const level = team === 0 ? (cfg.mateLevel ?? lv[0]) : lv[1];
    const own = team === 0 && cfg.human === role;
    s.riders.push({
      id: team * 3 + role, team, role, x: sp.x, z: sp.z, h: team === 0 ? 0 : Math.PI, v: 0, w: 0, stamina: 1, sprint: false, human: own, level: own ? 0 : level,
      sw: { ph: 'idle', t: 0, side: 1, kind: 'R', n: STRIKE_TICKS, charge: 0, dir: 0, power: 0, tc: -1, q: 0, res: '', cool: 0 },
      hook: { ph: 'idle', t: 0, cool: 0, side: 1, ok: false }, stun: 0, think: { until: 0, tx: 0, tz: 0 }, last: { sx: 0, sz: 0 },
      rest: { x: sp.x, z: sp.z }, anim: { acc: 0 },
    });
  }
  const R = s.riders;
  const ev = (type, o = {}) => { s.events.push({ id: s.evId++, type, t: s.t, tick: s.tick, ...o }); if (s.events.length > 80) s.events.splice(0, s.events.length - 80); };

  function placeBall(x, z) { const b = s.ball; b.x = x; b.z = z; b.y = BALL_R; b.vx = b.vy = b.vz = 0; b.lastRider = -1; b.lastTeam = -1; b.bounces = 0; }
  function setPhase(p, extra = {}) { s.phase = p; s.phaseT = 0; Object.assign(s, extra); }
  function toReset() {
    setPhase('reset'); s.restart = null; s.msg = null;
    placeBall(0, 0);
    for (const r of R) { r.sw.ph = 'idle'; r.sw.cool = 0; r.hook.ph = 'idle'; r.stun = 0; }
  }
  toReset();
  s.phaseT = 0;
  // the very first reset teleports nothing: riders start on their spots; skip straight to the countdown
  if (!cfg.rideIn) { setPhase('throw'); s.countdown = THROW_COUNT; }
  if (cfg.drill) { setPhase('live'); s.msg = null; }

  const speedOf = (r) => V_BASE * (r.human ? 1 : (LEVELS[Math.max(0, r.level - 1)].cap)) ;

  // ---------------------------------------------------------------- rider kinematics
  function stepRider(r, c, dt) {
    const mag = hyp(c.sx, c.sz);
    const sprinting = c.sprint && r.stamina > (r.sprint ? 0.02 : 0.2) && mag > 0.5;
    r.sprint = sprinting;
    const vmax = speedOf(r) * (sprinting ? V_SPRINT : 1);
    let want = 0, err = 0;
    if (mag > 0.1) {
      const ang = Math.atan2(c.sx, c.sz); err = wrap(ang - r.h);
      want = vmax * Math.min(1, mag * 1.12);
      const ae = Math.abs(err);
      want *= 1 - 0.68 * clamp((ae - 0.45) / 1.9, 0, 1);       // ride slower into a sharp turn
      if (r.stun > 0) want *= 0.6;
    }
    const a = want > r.v ? ACC * (sprinting ? 1.25 : 1) : BRAKE;
    r.v += clamp(want - r.v, -a * dt, a * dt);
    let wmax = clamp(A_LAT / Math.max(r.v, 2.2), 0.85, 3.5);
    if (r.sw.ph === 'wind' || r.sw.ph === 'strike') wmax = Math.min(wmax, 0.8);      // a rider lining up a stroke holds the horse steady
    const wt = mag > 0.1 ? clamp(err * 7, -wmax, wmax) : 0;
    r.w += (wt - r.w) * Math.min(1, dt * 11);
    r.h = wrap(r.h + r.w * dt);
    r.x += Math.sin(r.h) * r.v * dt; r.z += Math.cos(r.h) * r.v * dt;
    r.stamina = clamp(r.stamina + (sprinting ? -STAM_DRAIN : STAM_REGEN) * dt, 0, 1);
    // boards: slide along and lose speed
    const mx = HW - 0.9, mz = HL - 1.3;
    if (r.x > mx) { r.x = mx; r.v *= 0.92; } else if (r.x < -mx) { r.x = -mx; r.v *= 0.92; }
    if (r.z > mz) { r.z = mz; r.v *= 0.92; } else if (r.z < -mz) { r.z = -mz; r.v *= 0.92; }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pen = sx * r.x + sz * r.z - (HW + HL - CHAMFER - 1.9);
      if (sx * r.x > HW - CHAMFER - 1.2 && sz * r.z > HL - CHAMFER - 1.2 && pen > 0) { r.x -= sx * pen / 2; r.z -= sz * pen / 2; r.v *= 0.94; }
    }
  }

  // ---------------------------------------------------------------- stick
  const local = (r, x, z) => { const dx = x - r.x, dz = z - r.z, sh = Math.sin(r.h), ch = Math.cos(r.h); return { f: dx * sh + dz * ch, r: dx * ch - dz * sh }; };
  // ---- prediction helpers (pure copies of the real physics; used for the stroke timing and by the AI)
  function cloneBall() { const b = s.ball; return { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, rot: 0 }; }
  function ballPath(nMax) {
    const b = cloneBall(), out = [{ x: b.x, y: b.y, z: b.z }];
    for (let i = 0; i < nMax; i++) { physBall(b, DT, null); out.push({ x: b.x, y: b.y, z: b.z }); }
    return out;
  }
  function ballAt(n) { const p = ballPath(n)[n]; return { x: p.x, z: p.z }; }
  function riderPath(r, nMax, straight) {
    // constant controls: the same speed and turn rate for the rest of the prediction (straight = ignore the current turn: a rider on its run-in is steering onto the line)
    let x = r.x, z = r.z, h = r.h; const out = [{ x, z, h }];
    // a stroke holds the horse steady: the turn rate relaxes toward at most 0.8 rad/s (the same smoothing as stepRider)
    let w = r.w; const wc = clamp(r.w, -0.8, 0.8);
    for (let i = 0; i < nMax; i++) { w += (wc - w) * Math.min(1, DT * 11); h = wrap(h + (straight ? w * 0.35 : w) * DT); x += Math.sin(h) * r.v * DT; z += Math.cos(h) * r.v * DT; out.push({ x, z, h }); }
    return out;
  }
  const frameOf = (p, x, z) => { const dx = x - p.x, dz = z - p.z, sh = Math.sin(p.h), ch = Math.cos(p.h); return { f: dx * sh + dz * ch, r: dx * ch - dz * sh }; };
  // quality of a ball position (frame f, lat) for a stroke kind, 0 outside the envelope
  function envQ(kind, f, lat, y) {
    const E = REACH[kind];
    if (y > HIT_MAX_Y || lat < E.latMin || lat > E.latMax || f < E.fMin || f > E.fMax) return 0;
    const lh = (E.latMax - E.latMin) / 2, fh = (E.fMax - E.fMin) / 2;
    return clamp(1 - 0.5 * Math.abs(lat - E.latI) / lh - 0.5 * Math.abs(f - E.fI) / fh, 0.3, 1);
  }
  const kindsFor = (dirRel) => (Math.abs(dirRel) > 1.75 ? ['B'] : ['R', 'L']);
  const sideOf = (kind) => (kind === 'L' ? -1 : 1);
  // the best stroke for a rider hitting toward `dir`: scans the contact ticks nMin..nMax after now. Returns { kind, side, n, q } (q 0 = nothing in reach)
  function bestStroke(r, dir, nMin, nMax, straight) {
    const bp = ballPath(nMax), rp = riderPath(r, nMax, straight);
    const rel = wrap(dir - r.h), kinds = kindsFor(rel);
    let best = { kind: kinds[0], side: sideOf(kinds[0]), n: STRIKE_TICKS + (nMin - STRIKE_MIN > 0 ? nMin - STRIKE_MIN : 0), q: 0 };
    for (let n = nMin; n <= nMax; n++) {
      for (const kind of kinds) {
        const L = frameOf(rp[n], bp[n].x, bp[n].z), lat = sideOf(kind) * L.r;
        const q = envQ(kind, L.f, lat, bp[n].y);
        if (q > best.q + 1e-6) best = { kind, side: sideOf(kind), n, q };
      }
    }
    return best;
  }
  const canSwing = (r) => s.phase === 'live' && r.stun <= 0 && r.sw.cool <= 0 && !(s.restart && s.restart.team !== r.team && s.t < s.restart.until && !s.restart.hit);
  function stepSwing(r, c) {
    const sw = r.sw;
    if (sw.cool > 0) sw.cool--;
    if (r.stun > 0) { r.stun--; if (sw.ph !== 'idle' && sw.ph !== 'hooked') cancelSwing(r, 'stun'); }
    if (sw.ph === 'idle') {
      if (c.swing && canSwing(r) && r.hook.ph === 'idle') {
        sw.ph = 'wind'; sw.t = 0; sw.charge = 0; sw.power = 0.3;
        ev('wind', { rider: r.id });
      }
    } else if (sw.ph === 'wind') {
      if (c.cancel) { cancelSwing(r, 'abort'); sw.cool = 24; return; }
      sw.t++;
      sw.charge = clamp(sw.t * DT / WIND_MAX, 0, 1);
      if (!c.swing || (c.autoRelease !== undefined && sw.t >= c.autoRelease)) releaseSwing(r, c);
    } else if (sw.ph === 'strike') {
      sw.t++;
      if (sw.t === sw.n) contact(r);
      if (sw.t >= sw.n + FOLLOW_TICKS) { sw.ph = 'idle'; sw.cool = SWING_COOL; }
    } else if (sw.ph === 'hooked') {
      sw.t++;
      if (sw.t >= 30) { sw.ph = 'idle'; sw.cool = SWING_COOL; }
    }
  }
  function cancelSwing(r, why) { if (r.sw.ph !== 'idle') { r.sw.ph = 'idle'; r.sw.cool = SWING_COOL; ev('swingEnd', { rider: r.id, why }); } }
  function aimDir(r, c) {
    const mag = hyp(c.sx, c.sz);
    if (c.aim !== undefined) return c.aim;
    if (mag > 0.3) return Math.atan2(c.sx, c.sz);
    // no stick: along the heading, or at the opponents' goal when that is roughly where the rider is facing
    const gz = r.team === 0 ? HL : -HL, toGoal = Math.atan2(0 - r.x, gz - r.z);
    return Math.abs(wrap(toGoal - r.h)) < 0.7 ? toGoal : r.h;
  }
  function releaseSwing(r, c) {
    const sw = r.sw;
    sw.power = clamp(0.3 + 0.7 * sw.charge, 0.3, 1);
    if (c.power !== undefined) sw.power = clamp(c.power, 0.25, 1);
    sw.dir = aimDir(r, c);
    const bs = bestStroke(r, sw.dir, STRIKE_MIN, STRIKE_MAX);
    sw.kind = bs.kind; sw.side = bs.side; sw.n = bs.q > 0 ? bs.n : STRIKE_TICKS;
    sw.ph = 'strike'; sw.t = 0; sw.tc = s.tick + sw.n; sw.res = '';
    ev('swing', { rider: r.id, side: sw.side, kind: sw.kind, tc: sw.tc, n: sw.n, power: sw.power, dir: sw.dir, q: bs.q });
  }
  function contact(r) {
    const sw = r.sw, b = s.ball;
    const L = local(r, b.x, b.z), lat = sw.side * L.r;
    const q = s.phase === 'live' && !(s.restart && s.restart.team !== r.team && !s.restart.hit) ? envQ(sw.kind, L.f, lat, b.y) : 0;
    if (q <= 0) { sw.res = 'miss'; ev('miss', { rider: r.id, lat, f: L.f, kind: sw.kind }); return; }
    sw.q = q;
    // accuracy: a poor contact, a back-hand, a hard turn or a high speed spreads the direction
    const rel = Math.abs(wrap(sw.dir - r.h));
    let spread = (1 - q) * 0.30 + Math.max(0, rel - 1.2) * 0.12 + Math.abs(r.w) * 0.05 + r.v * 0.004;
    spread += (r.human ? 0.02 : LEVELS[r.level - 1].err * 0.7);
    const noise = (rng.next() + rng.next() + rng.next() - 1.5) * 1.15;      // roughly normal, range about +-1.7
    const ang = sw.dir + noise * spread;
    const powMul = rel > 1.9 ? 0.78 : rel > 1.2 ? 0.9 : 1;
    const speed = (4 + 18 * sw.power) * powMul * (0.8 + 0.2 * q);
    const carry = r.v * 0.35;
    b.vx = Math.sin(ang) * speed + Math.sin(r.h) * carry; b.vz = Math.cos(ang) * speed + Math.cos(r.h) * carry;
    b.vy = 0.4 + 2.2 * sw.power * (0.6 + 0.8 * (1 - q)) + rng.next() * 0.4;
    b.y = Math.max(b.y, BALL_R + 0.02); b.bounces = 0;
    b.lastRider = r.id; b.lastTeam = r.team;
    sw.res = 'hit';
    s.stats[r.team].hits++;
    const gz = r.team === 0 ? 1 : -1;
    if (Math.abs(Math.atan2(b.vx, b.vz) - Math.atan2(0 - b.x, gz * HL - b.z)) < 0.5 && gz * (gz * HL - b.z) < 14) s.stats[r.team].shots++;
    if (s.restart && s.restart.team === r.team) s.restart.hit = true;
    ev('hit', { rider: r.id, tc: s.tick, speed, q, side: sw.side, kind: sw.kind, dir: ang, x: b.x, y: b.y, z: b.z });
  }

  // ---------------------------------------------------------------- hook
  function stepHook(r, c) {
    const hk = r.hook;
    if (hk.cool > 0) hk.cool--;
    if (hk.ph === 'idle') {
      if (c.hook && s.phase === 'live' && hk.cool <= 0 && r.sw.ph === 'idle' && r.stun <= 0) {
        hk.ph = 'hook'; hk.t = 0; hk.ok = false;
        // side: the side where the nearest opposing stick is
        let best = null, bd = 1e9;
        for (const o of R) { if (o.team === r.team) continue; const d = hyp(o.x - r.x, o.z - r.z); if (d < bd) { bd = d; best = o; } }
        hk.side = best ? (local(r, best.x, best.z).r < 0 ? -1 : 1) : 1;
        ev('hook', { rider: r.id, side: hk.side, tc: s.tick + HOOK_WIN[0] });
      }
    } else {
      hk.t++;
      if (hk.t >= HOOK_WIN[0] && hk.t <= HOOK_WIN[1] && !hk.ok) {
        for (const o of R) {
          if (o.team === r.team || (o.sw.ph !== 'wind' && o.sw.ph !== 'strike') || (o.sw.ph === 'strike' && o.sw.t >= o.sw.n)) continue;
          if (hyp(o.x - r.x, o.z - r.z) > HOOK_RANGE) continue;
          // the hook must come from the side the opposing stick is on, and from behind or beside (not through the horse)
          const L = local(r, o.x, o.z);
          if (L.f > 1.8) continue;
          hk.ok = true;
          cancelSwing(o, 'hooked'); o.sw.ph = 'hooked'; o.sw.t = 0; o.stun = HOOK_STUN;
          s.stats[r.team].hooks++;
          ev('hooked', { rider: r.id, victim: o.id, tc: s.tick });
          break;
        }
      }
      if (hk.t >= HOOK_TICKS) { hk.ph = 'idle'; hk.cool = hk.ok ? 8 : HOOK_COOL; }
    }
  }

  // ---------------------------------------------------------------- collisions
  const circles = (r) => { const sh = Math.sin(r.h), ch = Math.cos(r.h), o = 0.95 * FIG; return [[r.x + sh * o, r.z + ch * o], [r.x, r.z], [r.x - sh * o, r.z - ch * o]]; };
  function collideRiders() {
    for (let ii = 0; ii < R.length; ii++) for (let jj = ii + 1; jj < R.length; jj++) {
      const a = R[(ii + s.tick) % R.length], b = R[(jj + s.tick) % R.length];
      if (Math.abs(a.x - b.x) > 4.2 || Math.abs(a.z - b.z) > 4.2) continue;
      let hit = false, nx = 0, nz = 0, pen = 0;
      for (const [ax, az] of circles(a)) for (const [bx, bz] of circles(b)) {
        const dx = bx - ax, dz = bz - az, d = hyp(dx, dz), rr = 1.0 * FIG;
        if (d < rr && d > 1e-4) { hit = true; if (rr - d > pen) { pen = rr - d; nx = dx / d; nz = dz / d; } }
      }
      if (!hit) continue;
      a.x -= nx * pen * 0.5; a.z -= nz * pen * 0.5; b.x += nx * pen * 0.5; b.z += nz * pen * 0.5;
      const va = [Math.sin(a.h) * a.v, Math.cos(a.h) * a.v], vb = [Math.sin(b.h) * b.v, Math.cos(b.h) * b.v];
      const closing = (va[0] - vb[0]) * nx + (va[1] - vb[1]) * nz;
      if (closing > 0.5) {
        a.v *= 0.95; b.v *= 0.95;
        if (closing > 2.5 && (!a.bumpT || s.t - a.bumpT > 0.5)) {
          a.bumpT = b.bumpT = s.t;
          ev('bump', { a: a.id, b: b.id, closing });
          if (a.team !== b.team && s.phase === 'live') checkFoul(a, b, nx, nz, closing);
        }
      }
    }
  }
  function checkFoul(a, b, nx, nz, closing) {
    // fouls: riding across an opposing rider's path (Crossing) or riding into one at speed (Dangerous ride-in). The foul is on the rider who
    // cut across; the rider holding the line of the ball is never penalised for a collision it did not cause.
    if (cfg.noFouls || s.t - (s.lastFoulT ?? -99) < 5) return;
    const dh = Math.abs(wrap(a.h - b.h));
    if (closing < 4.8 || dh < 0.9) return;
    const ca = Math.abs(Math.sin(a.h) * nx + Math.cos(a.h) * nz), cb = Math.abs(Math.sin(b.h) * nx + Math.cos(b.h) * nz);
    const symA = a.x * (a.team === 0 ? 1 : -1), symB = b.x * (b.team === 0 ? 1 : -1);
    const culprit = Math.abs(ca - cb) < 0.03 ? (symA < symB ? a : b) : (ca < cb ? a : b), other = culprit === a ? b : a;
    if (Math.min(ca, cb) > 0.75) return;                  // both riding straight at each other: a hard bump, not a foul
    const claimsLine = (o) => s.ball.lastRider >= 0 && R[s.ball.lastRider].team === o.team;
    const fouler = (claimsLine(culprit) && !claimsLine(other)) ? other : culprit;
    if (fouler.v < 3) return;
    s.lastFoulT = s.t;
    callFoul(fouler, dh > 2.2 ? 'Dangerous ride-in' : 'Crossing');
  }
  function callFoul(f, why) {
    const team = 1 - f.team;
    s.stats[f.team].fouls++;
    if (cfg.noRestart) return;
    const b = s.ball;
    // the free hit is taken where the ball is, kept clear of the boards
    const x = clamp(b.x, -(HW - 2.5), HW - 2.5), z = clamp(b.z, -(HL - 4), HL - 4);
    placeBall(x, z);
    setPhase('foul', { msg: { text: `Foul: ${why}`, sub: `Free hit to ${team === 0 ? 'your team' : 'the other team'}`, team }, restart: { team, x, z, until: s.t + FOUL_PAUSE + 6, hit: false, t0: s.t } });
    ev('foul', { rider: f.id, why, team, x, z });
  }
  function collideBall() {
    const b = s.ball;
    for (let k = 0; k < R.length; k++) {
      const r = R[(k + s.tick) % R.length];
      const dx = b.x - r.x, dz = b.z - r.z;
      if (Math.abs(dx) > 2.2 || Math.abs(dz) > 2.2) continue;
      const L = local(r, b.x, b.z);
      const a = BODY_HALF_W + BALL_R * 0.9, bb = BODY_HALF_L + BALL_R * 0.9;
      const e = (L.r / a) ** 2 + (L.f / bb) ** 2;
      if (e < 1 && b.y < 1.0) {
        // push out along the ellipse normal and nudge the ball along the horse's motion
        const nl = hyp(L.r / (a * a), L.f / (bb * bb)) || 1, nr = L.r / (a * a) / nl, nf = L.f / (bb * bb) / nl;
        const k = 1 / Math.sqrt(e || 1e-6);
        const pr = L.r * k, pf = L.f * k;
        const ch = Math.cos(r.h), sh = Math.sin(r.h);
        b.x = r.x + pr * ch + pf * sh; b.z = r.z - pr * sh + pf * ch;
        const wx = nr * ch + nf * sh, wz = -nr * sh + nf * ch;
        const rvx = b.vx - Math.sin(r.h) * r.v, rvz = b.vz - Math.cos(r.h) * r.v;
        const vn = rvx * wx + rvz * wz;
        if (vn < 0) { b.vx -= 1.4 * vn * wx; b.vz -= 1.4 * vn * wz; }
      }
    }
  }

  // ---------------------------------------------------------------- ball
  function stepBall(dt) {
    const b = s.ball;
    physBall(b, dt, (type, o) => ev(type, o));
    // end boards and the goals (real play only)
    const inMouth = Math.abs(b.x) < GOAL_HW - 0.05;
    if (Math.abs(b.z) > HL && inMouth && s.phase === 'live') goal(b.z > 0 ? 0 : 1);
  }
  function goal(scoringTeam) {
    s.score[scoringTeam]++; s.stats[scoringTeam].goals++;
    ev('goal', { team: scoringTeam, rider: s.ball.lastRider });
    if (cfg.drill) return;
    setPhase('goal', { msg: { text: 'GOAL', sub: scoringTeam === 0 ? 'Your team scores' : 'The other team scores', team: scoringTeam } });
  }

  // ---------------------------------------------------------------- the step
  // scripted opponents for practice drills: everyone stands still, except the hook drill's rival who rides beside the player and keeps winding up
  function drillAi(r) {
    const c = { sx: 0, sz: 0, sprint: false, swing: false, hook: false };
    if (cfg.drill === 'hook' && r.id === 3) {
      const me = R.find((o) => o.human);
      const tx = me.x + 1.9, tz = me.z + 0.2, dx = tx - r.x, dz = tz - r.z, d = hyp(dx, dz);
      if (d > 0.4) { const m = clamp(d / 4, 0.2, 1) * 1.0; c.sx = dx / d * m; c.sz = dz / d * m; } else { c.sx = Math.sin(me.h) * 0.3; c.sz = Math.cos(me.h) * 0.3; }
      const cyc = s.tick % 150;
      if (cyc >= 20 && cyc < 55 && canSwing(r)) { c.swing = true; c.autoRelease = 33; c.aim = me.h; c.power = 0.5; }
    }
    return c;
  }
  function controlFor(r) {
    if (cfg.drill && !r.human) return drillAi(r);
    if (r.human && !cfg.autoHuman && s.phase !== 'reset' && s.phase !== 'goal' && s.phase !== 'break' && s.phase !== 'end') return s.ctl;
    return aiControl(api, r, rng);
  }
  function step(dt) {
    s.t += dt; s.tick++; s.phaseT += dt;
    const live = s.phase === 'live' || s.phase === 'foul' || s.phase === 'throw';
    if (s.phase === 'live' && !s.cfg.drill) {
      s.clock -= dt;
      if (s.clock <= 0) { s.clock = 0; endPeriod(); }
    }
    for (const t of [0, 1]) aiTeamThink(s, t);
    // controls
    const ctls = R.map((r) => controlFor(r));
    for (let i = 0; i < R.length; i++) {
      const r = R[i], c = ctls[i];
      if (s.phase === 'goal' || s.phase === 'break' || s.phase === 'end') {
        // celebrate: slow to a trot, then walk
        stepRider(r, { sx: Math.sin(r.h) * 0.4, sz: Math.cos(r.h) * 0.4, sprint: false }, dt);
      } else stepRider(r, c, dt);
    }
    collideRiders();
    if (s.phase === 'live' || s.phase === 'foul' || s.phase === 'throw' || s.phase === 'goal') { collideBall(); stepBall(dt); }
    // strokes and hooks run last: everyone and the ball have moved for this tick, so a contact is decided on exactly the positions the picture shows;
    // the new ball velocity takes effect on the next step. Each tick starts from a different rider so that no side is always first.
    if (live || s.phase === 'reset') for (let k = 0; k < R.length; k++) { const i = (k + s.tick) % R.length; stepSwing(R[i], ctls[i]); stepHook(R[i], ctls[i]); }
    // phase logic
    if (s.phase === 'reset') {
      let ok = true;
      for (const r of R) { const d = hyp(r.x - r.rest.x, r.z - r.rest.z); if (d > 2.2 || r.v > 3.2) ok = false; }
      if (ok || s.phaseT > RESET_MAX) { setPhase('throw'); s.countdown = THROW_COUNT; s.msg = null; ev('countdown', {}); }
    } else if (s.phase === 'throw') {
      s.countdown -= dt;
      if (s.countdown <= 0) {
        const b = s.ball;
        const sgn = rng.next() < 0.5 ? -1 : 1;
        b.vx = sgn * (1.2 + rng.next() * 1.8); b.vz = (rng.next() - 0.5) * 1.5; b.vy = 7.2; b.y = 1.6;
        setPhase('live'); s.msg = null; s.restart = null; ev('throw', { x: b.x, z: b.z });
      }
    } else if (s.phase === 'foul') {
      if (s.phaseT >= FOUL_PAUSE) { setPhase('live'); s.msg = null; ev('freehit', { team: s.restart.team }); }
    } else if (s.phase === 'goal') {
      if (s.phaseT >= GOAL_PAUSE) {
        if (s.pendingEnd) endPeriod(true); else { toReset(); setRestSpots(); }
      }
    } else if (s.phase === 'break') {
      if (s.phaseT >= BREAK_PAUSE) { s.period++; s.clock = s.periodSecs; toReset(); setRestSpots(); }
    }
    if (s.restart && s.phase === 'live' && s.t > s.restart.until) s.restart = null;
    // a ball lying still too long, or jammed against the boards, is put back by the umpire a little way in
    if (s.phase === 'live' && !s.cfg.drill) {
      const b = s.ball, still = hyp(b.vx, b.vz) < 0.3 && b.y < 0.4;
      s.ballStill = still ? (s.ballStill || 0) + dt : 0;
      const nearBoard = Math.abs(b.x) > HW - 1.3 || Math.abs(b.z) > HL - 1.3;
      if ((nearBoard && s.ballStill > 2.5) || s.ballStill > 9) {
        const nx = clamp(b.x * 0.55, -HW + 3, HW - 3), nz = clamp(b.z * 0.8, -HL + 5, HL - 5);
        placeBall(nx, nz); s.ballStill = 0; ev('reset', { x: nx, z: nz });
        s.msg = { text: 'Ball put back', sub: 'The umpire moves it clear of the boards', team: -1 }; s.msgUntil = s.t + 1.6;
      }
    }
    if (s.msg && s.msgUntil && s.t > s.msgUntil && s.phase === 'live') { s.msg = null; s.msgUntil = 0; }
  }
  function setRestSpots() { for (const r of R) { const sp = spotFor(r.team, r.role); r.rest.x = sp.x; r.rest.z = sp.z; } }
  function endPeriod() {
    if (s.period >= s.periods) {
      s.over = true; s.winner = s.score[0] > s.score[1] ? 0 : s.score[1] > s.score[0] ? 1 : -1;
      setPhase('end', { msg: { text: 'Full time', sub: '' } }); ev('end', { winner: s.winner });
    } else {
      setPhase('break', { msg: { text: `End of period ${s.period}`, sub: `${s.score[0]} - ${s.score[1]}` } });
      ev('period', { period: s.period });
    }
  }
  setRestSpots();

  const api = {
    s, rng,
    // one fixed step; ctl = the human rider's controls { sx, sz, sprint, swing, hook }
    update(dt, ctl) {
      if (ctl) { s.ctl.sx = ctl.sx || 0; s.ctl.sz = ctl.sz || 0; s.ctl.sprint = !!ctl.sprint; s.ctl.swing = !!ctl.swing; s.ctl.hook = !!ctl.hook; }
      if (s.phase === 'end') { s.t += dt; s.tick++; for (const r of R) stepRider(r, { sx: Math.sin(r.h) * 0.3, sz: Math.cos(r.h) * 0.3, sprint: false }, dt); return; }
      step(dt);
    },
    ballAt, ballPath, riderPath, bestStroke, envQ, local, canSwing,
    placeBall(x, z, vx = 0, vz = 0) { placeBall(x, z); s.ball.vx = vx; s.ball.vz = vz; },
    placeRider(id, x, z, h) { const r = R[id]; r.x = x; r.z = z; r.h = h; r.v = 0; r.w = 0; },
    holdRequest(r, plan, stroke) {
      if (s.hold || s.t < s.holdUntil) return false;
      s.hold = { id: ++s.holdId, rider: r.id, kind: plan.kind, why: plan.why, ax: plan.ax, az: plan.az, power: plan.power, stroke: stroke.kind };
      return true;
    },
    release() { s.hold = null; s.holdUntil = s.t + 6; },
    restore(snap) { s.score = [...snap.score]; s.period = snap.period; s.clock = snap.clock; },
    snapshot() { return { score: [...s.score], period: s.period, clock: s.clock }; },
  };
  return api;
}
