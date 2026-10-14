// Kok-boru simulation: pure, fixed 60 Hz, deterministic (only the rng it is given). Nothing here knows about drawing.
// Field: x along the length (team 0 attacks +x), z across (near the camera = larger z). Metres and seconds.
import {
  DT, HL, HW, GOAL_X, GOAL_R, DROP_R, G, V_BASE, V_SPRINT, CARRY_MUL, ACCEL, BRAKE, STAM_DRAIN, STAM_REGEN, GRAB_R, LEAN_T, TUG_R,
  RIDER_R, CHARGE_T, PASS_SPEED, LEVELS, GOLDEN_CAP,
} from './consts.js';
import { clamp, hyp } from './util.js';
import { aiControl, bestPass, spotFor, nearestRival } from './ai.js';
import { throwPlan, goalCentre, inGoalCircle, THROW_Y } from './phys.js';

export function createSim(cfg, rng) {
  const size = cfg.size || 3;
  const s = {
    t: 0, phase: 'ready', phaseT: 0, period: 1, periods: cfg.periods || 2, clock: cfg.periodSecs || 90, periodSecs: cfg.periodSecs || 90,
    score: [0, 0], riders: [], ball: null, events: [], evId: 0, hold: null, holdCool: 3, holdId: 0, releaseNow: false,
    over: false, winner: -1, golden: false, goldenT: 0, size, levels: [cfg.mateLevel ?? 2, cfg.oppLevel ?? 1], watch: !!cfg.watch,
    call: [0, 0], tactic: [cfg.tactic ?? 1, 1], carrier: -1, ctl: -1, ctlLock: 0, lastScorer: -1, pickCounter: 0,
    kick: cfg.kick ?? (cfg.human >= 0 ? 0 : (rng.next() < 0.5 ? 0 : 1)), poss: [0, 0], stats: [{ goals: 0, grabs: 0, passes: 0, throws: 0, tugs: 0 }, { goals: 0, grabs: 0, passes: 0, throws: 0, tugs: 0 }],
    cup: !!cfg.cup, autoHuman: !!cfg.autoHuman, human: cfg.human ?? -1,
  };
  if (cfg.watch) { s.levels = [cfg.mateLevel ?? 2, cfg.oppLevel ?? 2]; }
  else s.levels = [cfg.mateLevel ?? 2, cfg.oppLevel ?? 1];
  const emit = (type, o = {}) => { s.events.push({ ...o, who: o.id, id: s.evId++, type, t: s.t }); if (s.events.length > 40) s.events.shift(); };

  for (let team = 0; team < 2; team++) {
    for (let i = 0; i < size; i++) {
      const sp = spotFor(team, i, size);
      s.riders.push({
        id: team * size + i, team, role: i, x: sp.x, z: sp.z, vx: 0, vz: 0, face: team === 0 ? 1 : -1, ph: (i * 0.23 + team * 0.11) % 1, stam: 1,
        carry: false, act: null, cool: 0, stun: 0, pickT: 0, pickId: 0, passCool: 0, tugCool: 0, grabCool: 0, grace: 0, charge: 0, chargeLock: 0, throwT: 0, tugT: 0,
        human: false, held: false, spd: 0, sprinting: false, ai: { t: rng.next() * 0.2, pick: -1, thr: 12 },
      });
    }
  }
  s.ball = { x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, owner: -1, passTo: -1, passT: 0, last: -1, spin: 0 };
  if (s.human >= 0) s.ctl = 0;
  const R = s.riders;
  const humanRider = () => (s.ctl >= 0 ? R[s.ctl] : null);

  function resetKickoff(phase = 'ready') {
    for (const r of R) {
      const sp = spotFor(r.team, r.role, size);
      Object.assign(r, { x: sp.x, z: sp.z, vx: 0, vz: 0, face: r.team === 0 ? 1 : -1, carry: false, act: null, stun: 0, cool: 0, charge: 0, chargeLock: 0, throwT: 0, tugT: 0, stam: Math.max(r.stam, 0.75), pickT: 0, grabCool: 0, tugCool: 0, passCool: 0 });
    }
    Object.assign(s.ball, { x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, owner: -1, passTo: -1, passT: 0, last: -1 });
    s.carrier = -1;
    s.phase = phase; s.phaseT = 0;
    for (const r of R) r.delay = r.team === s.kick ? 0 : 0.7;      // the kicking-off side gets the first move
    if (s.human >= 0) s.ctl = 0;
  }
  resetKickoff();
  R.forEach((r) => { r.human = r.id === s.ctl; });

  function giveBall(r, quality = 1) {
    const b = s.ball;
    if (s.carrier >= 0) { const o = R[s.carrier]; o.carry = false; o.charge = 0; }
    r.carry = true; s.carrier = r.id; b.owner = r.id; b.vx = b.vz = b.vy = 0; b.passTo = -1;
    r.pickT = 0; r.pickId = ++s.pickCounter; r.grace = 1.6; r.charge = 0; r.chargeLock = 0.25; r.act = null;
    if (quality < 0.5) r.stun = Math.max(r.stun, 0.35);
    if (r.team === 0 && s.human >= 0 && !s.watch) { s.ctl = r.id; R.forEach((q) => { q.human = q.id === s.ctl; }); }
  }
  function release(r) {
    if (s.carrier === r.id) s.carrier = -1;
    r.carry = false; r.charge = 0;
    s.ball.owner = -1;
  }

  // ---- ball launch ------------------------------------------------------------------------------------------------------------
  function doThrow(r, p, ang, bot = false) {
    const b = s.ball;
    const plan = throwPlan(r, p, ang, r.team);
    let a = plan.ang;
    let power = plan.p;
    if (!plan.drop) {
      // human hands shake a little with speed; the circle assist lets the AI use its own error instead
      const sp = hyp(r.vx, r.vz);
      const sd = bot ? 0 : 0.012 + 0.018 * (sp / V_SPRINT);
      a += (rng.next() + rng.next() - 1) * sd * 2;
    }
    release(r);
    b.x = r.x + Math.cos(a) * 0.6; b.z = r.z + Math.sin(a) * 0.6; b.y = THROW_Y;
    const vh = plan.vh, vy = plan.vy;
    b.vx = Math.cos(a) * vh + r.vx * 0.5; b.vz = Math.sin(a) * vh + r.vz * 0.5; b.vy = vy;
    if (plan.drop) {   // a drop-in lands in the pit, by way of a short toss
      const g = goalCentre(r.team);
      const T = plan.t;
      b.vx = (g.x - b.x) / T; b.vz = (g.z - b.z) / T;
    }
    b.last = r.id; b.passTo = -1; r.throwT = 0.35; r.passCool = 0.8; r.grabCool = 0.6; r.chargeLock = 0.5; r.grace = 0;
    s.stats[r.team].throws++;
    emit('throw', { id: r.id, x: r.x, z: r.z, p: power, need: plan.need, vx: r.vx, vz: r.vz, a, plx: plan.lx, plz: plan.lz });
  }
  function doPass(r, hint = null, toId = -1) {
    const b = s.ball;
    let bp = bestPass(s, r, hint);
    if (toId >= 0) { const m = R[toId]; bp = { r: m, d: hyp(m.x - r.x, m.z - r.z) }; }
    if (!bp) return false;
    const m = bp.r;
    const T = clamp(bp.d / PASS_SPEED, 0.28, 1.4);
    const tx = m.x + m.vx * T * 0.9, tz = m.z + m.vz * T * 0.9;
    release(r);
    b.x = r.x + r.face * 0.5; b.z = r.z; b.y = 1.4;
    b.vx = (tx - b.x) / T; b.vz = (tz - b.z) / T;
    b.vy = (1.2 - b.y + 0.5 * G * T * T) / T;
    b.passTo = m.id; b.passT = T + 0.9; b.last = r.id;
    r.throwT = 0.3; r.passCool = 1.0; r.grabCool = 0.5; r.chargeLock = 0.4; r.grace = 0;
    s.stats[r.team].passes++;
    emit('pass', { id: r.id, to: m.id, x: r.x, z: r.z });
    return true;
  }
  function startAct(r, kind) {
    if (r.act || r.cool > 0) return;
    if (kind === 'grab') r.act = { k: 'grab', t: LEAN_T };
    else r.act = { k: 'tug', t: LEAN_T + 0.04 };
    r.tugT = 0;
    emit(kind === 'grab' ? 'lean' : 'reach', { id: r.id, x: r.x, z: r.z });
  }
  function finishAct(r) {
    const a = r.act; r.act = null; r.cool = 0.25;
    const b = s.ball;
    if (a.k === 'grab') {
      const d = hyp(b.x - r.x, b.z - r.z);
      if (b.owner === -1 && d <= GRAB_R + 0.5 && b.y < 1.6) {
        const sp = hyp(r.vx, r.vz);
        const slip = clamp((sp - 6.2) / 3, 0, 1) * 0.8;           // a clean lift below about 6 m/s, mostly a slip at a full sprint
        const q = 1 - slip;
        if (rng.next() < slip) {            // too fast: the lift slips and the ball is knocked on
          b.vx += r.vx * 0.6; b.vz += r.vz * 0.6; b.vy = 2.2; r.grabCool = 0.7;
          emit('fumble', { id: r.id, x: b.x, z: b.z });
        } else { giveBall(r, q); s.stats[r.team].grabs++; emit('grab', { id: r.id, q, x: r.x, z: r.z }); }
      } else r.grabCool = 0.5;
    } else {
      const c = s.carrier >= 0 ? R[s.carrier] : null;
      if (!c || c.team === r.team || hyp(c.x - r.x, c.z - r.z) > TUG_R + 0.5) { r.tugCool = 0.5; return; }
      const lvl = LEVELS[s.levels[r.team]], lvlC = LEVELS[s.levels[c.team]];
      let p = (r.human || s.autoHuman) && !s.watchBot(r) ? 0.46 : 0.14 + lvl.tug * 0.42;
      if (r.human || s.autoHuman) p = 0.4;
      p += 0.3 * (r.stam - c.stam) * 0.5;
      const sp = hyp(c.vx, c.vz); if (sp > 8) p -= 0.18;
      // matching direction helps; being dragged across his line does not
      const dot = (r.vx * c.vx + r.vz * c.vz) / ((hyp(r.vx, r.vz) * sp) || 1); p += 0.1 * dot;
      let esc = 0; for (const m of R) if (m.team === c.team && m.id !== c.id && hyp(m.x - c.x, m.z - c.z) < 3.2) esc++;
      p -= 0.1 * esc;
      p -= (c.human ? 0.0 : 0.12 * lvlC.tug) ;
      if (c.grace > 0) p = Math.min(p, 0.05);
      p = clamp(p, 0.08, 0.82);
      r.tugCool = 1.1;
      if (rng.next() < p) {
        c.stun = 0.55; c.tugT = 0.5; c.grace = 0; c.act = null; c.tugCool = Math.max(c.tugCool, 1.6);
        giveBall(r, 1); s.stats[r.team].tugs++; emit('tug', { id: r.id, from: c.id, x: r.x, z: r.z });
      } else { r.stun = 0.3; emit('tugfail', { id: r.id, x: r.x, z: r.z }); }
    }
  }
  s.watchBot = () => false;

  // ---- one rider's control for this tick ---------------------------------------------------------------------------------------
  function humanControl(r, inp) {
    const c = { mx: 0, mz: 0, mag: 0, sprint: false, grab: false, pass: false, throwP: null };
    if (!inp) return c;
    c.mx = inp.mx || 0; c.mz = inp.mz || 0; c.mag = clamp(inp.mag ?? Math.hypot(c.mx, c.mz), 0, 1); c.sprint = !!inp.sprint;
    if (r.carry) {
      if (inp.act && r.chargeLock <= 0 && !r.act) { r.charge = Math.min(1, r.charge + DT / CHARGE_T); r.holdAct = true; }
      else if (!inp.act && r.holdAct) {
        r.holdAct = false;
        if (r.charge > 0.08) c.throwP = r.charge;
        r.charge = 0;
      }
      if (inp.pass && r.passCool <= 0) c.pass = true;
    } else {
      r.holdAct = false; r.charge = 0;
      if (inp.actPressed) c.grab = true;
    }
    return c;
  }

  // ---- update ---------------------------------------------------------------------------------------------------------------------
  function update(dt, inp) {
    if (s.over) return;
    if (s.hold) return;
    s.t += dt;
    s.events = s.events.filter((e) => s.t - e.t < 2.5);
    s.phaseT += dt;
    if (s.holdCool > 0) s.holdCool -= dt;
    // phases
    if (s.phase === 'ready') {
      if (s.phaseT > 1.9) { s.phase = 'play'; s.phaseT = 0; emit('whistle', {}); }
    } else if (s.phase === 'goal') {
      if (s.phaseT > 2.8) {
        if (s.golden || (s.period === s.periods && s.clock <= 0 && s.score[0] !== s.score[1])) { endMatch(); return; }
        resetKickoff();
      }
    } else if (s.phase === 'break') {
      if (s.phaseT > 3) { s.period++; s.clock = s.periodSecs; resetKickoff(); }
    } else if (s.phase === 'end') {
      if (s.phaseT > 3) { s.over = true; return; }
    }
    if (s.phase === 'play') {
      if (s.golden) { s.goldenT += dt; if (s.goldenT >= GOLDEN_CAP) { s.winner = s.poss[0] > s.poss[1] ? 0 : 1; emit('whistle', {}); s.phase = 'end'; s.phaseT = 0; } }
      else {
        s.clock -= dt;
        if (s.clock <= 0) {
          s.clock = 0;
          if (s.period < s.periods) { s.phase = 'break'; s.phaseT = 0; emit('period', { n: s.period }); }
          else if (s.score[0] === s.score[1]) {
            if (s.cup) { s.golden = true; s.goldenT = 0; emit('golden', {}); } else endMatch();
          } else endMatch();
        }
      }
      if (s.carrier >= 0) s.poss[R[s.carrier].team] += dt;
    }
    const live = s.phase === 'play';
    // auto switch of the human's rider
    const hr = humanRider();
    if (hr && live && !s.watch) {
      s.ctlLock -= dt;
      if (inp && inp.switch) switchNext();
      else if (s.ctlLock <= 0 && s.carrier !== hr.id && !(s.carrier >= 0 && R[s.carrier].team === 0)) {
        // nearest team-mate to the ball (or the landing) becomes the ridden one
        let best = hr, bd = hyp(hr.x - s.ball.x, hr.z - s.ball.z) - 2.5;
        for (const m of R) if (m.team === 0) { const d = hyp(m.x - s.ball.x, m.z - s.ball.z); if (d < bd) { bd = d; best = m; } }
        if (best !== hr) { setCtl(best.id); s.ctlLock = 0.9; }
      }
    }
    // controls
    const ctrls = new Array(R.length);
    for (const r of R) {
      let c;
      const asHuman = r.human && !s.watch && !s.autoHuman;
      if (live && r.delay > 0) { r.delay -= DT; c = { mx: 0, mz: 0, mag: 0, sprint: false, grab: false, pass: false, throwP: null }; }
      else if (!live) c = { mx: 0, mz: 0, mag: 0, sprint: false, grab: false, pass: false, throwP: null };
      else if (asHuman) c = humanControl(r, inp);
      else c = aiControl(s, r, rng);
      ctrls[r.id] = c;
    }
    // decision holds for Watch & Learn (the user's team only)
    if (s.watch && live && s.holdCool <= 0 && !s.releaseNow) {
      for (const r of R) {
        if (r.team !== 0) continue;
        const c = ctrls[r.id];
        const kind = c.throwP != null ? 'throw' : c.pass ? 'pass' : c.grab ? (r.carry ? null : (s.carrier >= 0 && R[s.carrier].team !== r.team ? 'tug' : 'grab')) : null;
        if (kind) { s.hold = { id: ++s.holdId, rider: r.id, kind, pending: { ...c } }; s.hold.t = s.t; emit('hold', { id: r.id, kind }); return; }
      }
    }
    s.releaseNow = false;
    for (const r of R) applyControl(r, ctrls[r.id], dt, live);
    for (const r of R) moveRider(r, ctrls[r.id], dt);
    separate();
    ball(dt, live);
    if (live) goals();
  }

  function setCtl(id) { s.ctl = id; R.forEach((q) => { q.human = q.id === id; }); }
  function switchNext() {
    // cycle to the team-mate nearest the ball that is not the current one
    const cands = R.filter((m) => m.team === 0 && m.id !== s.ctl).sort((a, b) => hyp(a.x - s.ball.x, a.z - s.ball.z) - hyp(b.x - s.ball.x, b.z - s.ball.z));
    if (cands.length) { setCtl(cands[0].id); s.ctlLock = 1.2; emit('switch', { id: cands[0].id }); }
  }

  function applyControl(r, c, dt, live) {
    r.cool = Math.max(0, r.cool - dt); r.tugCool = Math.max(0, r.tugCool - dt); r.grabCool = Math.max(0, r.grabCool - dt);
    r.passCool = Math.max(0, r.passCool - dt); r.chargeLock = Math.max(0, r.chargeLock - dt); r.stun = Math.max(0, r.stun - dt);
    r.grace = Math.max(0, r.grace - dt); r.throwT = Math.max(0, r.throwT - dt); r.tugT = Math.max(0, r.tugT - dt);
    if (r.carry) r.pickT += dt;
    const lvl = LEVELS[s.levels[r.team]];
    const asBot = !(r.human && !s.watch && !s.autoHuman);
    // actions
    if (live) {
      if (r.carry) {
        if (c.throwP != null && !r.act) doThrow(r, c.throwP, c.throwAng ?? null, asBot);
        else if (c.pass && !r.act) doPass(r, asBot ? null : hintAngle(r, c), c.passTo ?? -1);
      } else if (c.grab && !r.act) {
        const carrier = s.carrier >= 0 ? R[s.carrier] : null;
        if (carrier && carrier.team !== r.team) { if (r.tugCool <= 0 && hyp(carrier.x - r.x, carrier.z - r.z) < TUG_R + 0.8) startAct(r, 'tug'); }
        else if (r.grabCool <= 0 && s.ball.owner === -1) startAct(r, 'grab');
      }
    }
    if (r.act) { r.act.t -= dt; if (r.act.t <= 0) finishAct(r); }
  }
  function moveRider(r, c, dt) {
    const lvl = LEVELS[s.levels[r.team]];
    const asBot = !(r.human && !s.watch && !s.autoHuman);
    let mag = c.mag, mx = c.mx, mz = c.mz;
    const sprintWant = c.sprint && r.stam > 0.04 && mag > 0.1;
    r.sprinting = sprintWant;
    let vmax = (V_BASE + (sprintWant ? V_SPRINT - V_BASE : 0)) * (asBot ? lvl.speed : 1);
    if (r.carry) vmax *= CARRY_MUL;
    if (r.act) vmax *= 0.8;
    if (r.stun > 0) vmax *= 0.55;
    if (r.carry && r.charge > 0) vmax *= 0.92;
    if (s.phase === 'break' || s.phase === 'goal') { mag = 0; }
    const tvx = mx * mag * vmax, tvz = mz * mag * vmax;
    let dx = tvx - r.vx, dz = tvz - r.vz;
    const dm = hyp(dx, dz);
    const sp0 = hyp(r.vx, r.vz), sp1 = hyp(tvx, tvz);
    const a = (sp1 < sp0 ? BRAKE : ACCEL) * dt;
    if (dm > a) { dx = dx / dm * a; dz = dz / dm * a; }
    r.vx += dx; r.vz += dz;
    r.x += r.vx * dt; r.z += r.vz * dt;
    r.x = clamp(r.x, -HL + 0.8, HL - 0.8); r.z = clamp(r.z, -HW + 0.8, HW - 0.8);
    r.spd = hyp(r.vx, r.vz);
    if (r.spd > 0.9) { if (Math.abs(r.vx) > 0.6 && Math.sign(r.vx) !== r.face) r.face = Math.sign(r.vx); }
    r.ph = (r.ph + r.spd * dt / 3.1 + (r.spd > 0.4 ? 0 : 0)) % 1;
    if (sprintWant) r.stam = Math.max(0, r.stam - STAM_DRAIN * dt); else r.stam = Math.min(1, r.stam + STAM_REGEN * dt);
  }
  const hintAngle = (r, c) => (c.mag > 0.35 ? Math.atan2(c.mz, c.mx) : null);

  function separate() {
    // soft, inelastic contact: riders ease apart (a third of the overlap per tick) and lose the speed they were closing at
    for (let i = 0; i < R.length; i++) {
      for (let j = i + 1; j < R.length; j++) {
        const a = R[i], b = R[j];
        let dx = b.x - a.x, dz = b.z - a.z, d = hyp(dx, dz);
        const min = RIDER_R * 2;
        if (d >= min) continue;
        if (d < 0.001) { dx = 1; dz = 0; d = 1; }
        const nx = dx / d, nz = dz / d, push = (min - d) * 0.33;
        a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
        const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rv < 0) { const k = rv * 0.5; a.vx += nx * k; a.vz += nz * k; b.vx -= nx * k; b.vz -= nz * k; }
      }
    }
  }

  function ball(dt, live) {
    const b = s.ball;
    if (b.owner >= 0) {
      const r = R[b.owner];
      const lean = r.act && r.act.k === 'tug' ? 0 : 0;
      b.x = r.x + r.face * 0.55; b.z = r.z - 0.05; b.y = 1.1 + lean; b.vx = r.vx; b.vz = r.vz; b.vy = 0;
      return;
    }
    // free flight
    b.passT = Math.max(0, b.passT - dt);
    b.vy -= G * dt;
    b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt;
    if (b.y <= 0) {
      b.y = 0;
      if (b.vy < -1.4) { b.vy = -b.vy * 0.3; b.vx *= 0.7; b.vz *= 0.7; emit('bounce', { x: b.x, z: b.z, p: Math.min(1, -b.vy / 8) }); }
      else b.vy = 0;
    }
    if (b.y === 0 && b.vy === 0) {
      const sp = hyp(b.vx, b.vz);
      if (sp > 0) { const ns = Math.max(0, sp - 5 * dt); b.vx *= ns / sp; b.vz *= ns / sp; }
    }
    if (b.z > HW - 0.3) { b.z = HW - 0.3; b.vz = -Math.abs(b.vz) * 0.5; }
    if (b.z < -HW + 0.3) { b.z = -HW + 0.3; b.vz = Math.abs(b.vz) * 0.5; }
    if (b.x > HL - 0.3) { b.x = HL - 0.3; b.vx = -Math.abs(b.vx) * 0.45; }
    if (b.x < -HL + 0.3) { b.x = -HL + 0.3; b.vx = Math.abs(b.vx) * 0.45; }
    if (!live) return;
    // catching: the pass target takes a pass out of the air; a rival may snatch it
    if (b.y < 2.4) {
      for (const r of R) {
        if (r.carry || r.act) continue;
        const d = hyp(r.x - b.x, r.z - b.z);
        if (b.passTo === r.id && d < 1.9 && b.passT > 0) { giveBall(r, 1); emit('catch', { id: r.id, x: r.x, z: r.z }); return; }
        if (b.passTo >= 0 && R[b.passTo].team !== r.team && d < 1.5 && b.passT > 0 && rng.next() < 0.05 * LEVELS[s.levels[r.team]].catch * (r.human ? 0.4 : 1)) {
          giveBall(r, 1); emit('steal', { id: r.id, x: r.x, z: r.z }); return;
        }
      }
    }
  }

  function goals() {
    const b = s.ball;
    if (b.owner >= 0 || b.y > 0.45) return;
    for (const team of [0, 1]) {
      if (inGoalCircle(b.x, b.z, team)) { scored(team); return; }
    }
  }
  function scored(team) {
    s.score[team]++; s.stats[team].goals++; s.lastScorer = team;
    emit('goal', { team, x: s.ball.x, z: s.ball.z });
    s.phase = 'goal'; s.phaseT = 0; s.kick = 1 - team;
    // the ball settles in the pit
    const g = goalCentre(team);
    s.ball.vx = s.ball.vz = s.ball.vy = 0; s.ball.x = g.x; s.ball.z = g.z; s.ball.y = 0;
    if (s.golden) { s.winner = team; }
  }
  function endMatch() {
    if (s.winner < 0) s.winner = s.score[0] === s.score[1] ? -1 : s.score[0] > s.score[1] ? 0 : 1;
    s.phase = 'end'; s.phaseT = 0; emit('end', {});
  }

  // Watch & Learn: the loop in the game shell calls release() when THINK and REVEAL are done
  function releaseHold() {
    const h = s.hold; if (!h) return;
    const r = R[h.rider];
    s.hold = null; s.holdCool = 5; s.releaseNow = true;
    // execute the pending decision now; the next tick then continues with fresh decisions
    const c = h.pending, live = s.phase === 'play';
    if (live) {
      if (r.carry) { if (c.throwP != null) doThrow(r, c.throwP, c.throwAng ?? null, true); else if (c.pass) doPass(r, null, c.passTo ?? -1); }
      else if (c.grab) {
        const carrier = s.carrier >= 0 ? R[s.carrier] : null;
        if (carrier && carrier.team !== r.team) startAct(r, 'tug'); else startAct(r, 'grab');
      }
    }
  }

  const snapshot = () => JSON.parse(JSON.stringify({ s: { ...s, events: [], hold: null }, }));
  const restore = (d) => {
    const o = d.s;
    for (const k of Object.keys(o)) if (k !== 'riders' && k !== 'ball') s[k] = o[k];
    o.riders.forEach((r, i) => Object.assign(R[i], r));
    Object.assign(s.ball, o.ball);
    s.events = []; s.hold = null; s.watchBot = () => false;
    R.forEach((q) => { q.human = q.id === s.ctl; });
  };

  return { s, update, release: releaseHold, snapshot, restore, switchNext, setCtl, nearestRival: (r) => nearestRival(s, r), humanRider };
}
