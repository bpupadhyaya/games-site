// The match: ball physics, six-a-side players, stick actions (strike, hand-pass, rising pick-up, hook / block / shoulder, burst),
// scoring (goal 3, point 1), restarts and the two halves. Pure and deterministic: fixed 1/60 s step, randomness only from env.rng.
// The presenter (web/view3d) only READS this state: every action carries its contact time `tc` and contact point `c`.
import { HAND_MAX_SEC, HAND_MAX_STEPS, HAND_STEP_M, EXPOSE_FROM, EXPOSE_TO, KEEPER_REACH, KEEPER_DIVE, TOSS_SEC, GROUND_SEC, PASS_SEC, HOOK_SEC, ASSIST_DEG, BURST_SEC, BURST_CD, HOOK_REACH, SHOULDER_REACH, FOUL_HOOK_P, RESTART_MAX_SEC, FREE_BACK_M, HW, HL, GOAL_HW, BAR, POST_H, NET_D, SMALL_D, G, BALL_R, HALF_SEC, REACH, SOLO_PERIOD, SOLO_HOP, BAS_Y, CHARGE_SEC, SWEET, HOME, LEVELS, LINE_13 } from './consts.js';
import { clamp, wrapAng, fwd, rgt, yawOf } from './util.js';
import { aiTick, decideFor } from './ai.js';
import { initialCam } from './camera.js';

const DT = 1 / 60;
const PLAYER_R = 0.42;
const HOOK_ARM = 1.1;     // how far in front of the player the stick meets the ball in a hook / block (metres)
const quant = (T) => Math.max(2, Math.round(T / DT)) * DT;     // contact times sit exactly on a simulation tick

export const goalZ = (team) => (team === 0 ? HL : -HL);          // the goal a team attacks
export const dirOf = (team) => (team === 0 ? 1 : -1);

export function createSim(cfg, rng) {
  const R = rng.fork();           // outcome rolls (catches, noise)
  const A = rng.fork();           // AI noise
  const humanId = cfg.human == null ? -1 : cfg.human;     // id of the controlled player (team 0), -1 = none
  const levels = cfg.levels || [3, 3];                    // [team 0 teammates level, team 1 level], 1..5
  const s = {
    t: 0, clock: 0, half: 1, phase: 'ready', phaseT: 0, over: false, winner: -1,
    cfg: { mode: cfg.mode || 'full', halfSec: cfg.halfSec || HALF_SEC, halves: cfg.mode === 'quick' ? 1 : 2, levels: [...levels], human: humanId, drill: cfg.drill || null, watch: !!cfg.watch, hold: !!cfg.hold },
    score: [{ g: 0, p: 0 }, { g: 0, p: 0 }],
    players: [], ball: null, restart: null, events: [], evId: 0, hold: null, holdCool: 3, last: null, stats: [{ shots: 0, goals: 0, points: 0, wides: 0, hooks: 0, passes: 0, saves: 0, fouls: 0 }, { shots: 0, goals: 0, points: 0, wides: 0, hooks: 0, passes: 0, saves: 0, fouls: 0 }],
    input: { mx: 0, mz: 0, sprint: false, down: false, up: false, pass: false, rise: false, hook: false, burst: false, think: false },
    charge: null, actId: 1, aimHint: null, drillState: null, cam: initialCam(),
  };
  const lvlOf = (p) => (cfg.proxy && p.id === cfg.proxy.id ? cfg.proxy.lvl : LEVELS[clamp((levels[p.team] | 0) - 1, 0, 4)]);
  s.ball = { x: 0, y: BALL_R, z: 0, vx: 0, vy: 0, vz: 0, mode: 'free', holder: -1, hs: 'hand', hp: 0, lastTouch: -1, lastTeam: 0, lastT: -9, path: null, intended: -1, dead: false };

  for (let i = 0; i < 12; i++) {
    const team = i < 6 ? 0 : 1, r = i % 6, h = HOME[r];
    const a = team === 0 ? 1 : -1;
    s.players.push({
      id: i, team, role: r, x: h[0] * a, z: h[1] * a, vx: 0, vz: 0, face: team === 0 ? 0 : Math.PI, stam: 1, stun: 0, act: null, catchCd: 0, burstT: 0, burstCd: 0,
      human: i === humanId && !cfg.bot, ai: { cd: 0.2 * (i % 5), tx: h[0] * a, tz: h[1] * a, sprint: false, mode: 'idle', plan: null, hold: 0, tbias: A.range(-1, 1) },
      steps: 0, handT: 0, skillJit: A.range(-0.05, 0.05), num: [1, 2, 3, 8, 11, 14][r],
    });
  }

  const ev = (type, o = {}) => { const e = { id: s.evId++, type, t: s.t, ...o }; s.events.push(e); if (s.events.length > 70) s.events.shift(); return e; };
  const B = s.ball;
  const P = s.players;
  const gaussish = () => (R.next() + R.next() + R.next() - 1.5) * 1.6;      // roughly N(0, 1)
  const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
  const skillOf = (p) => clamp(lvlOf(p).skill + p.skillJit + (p.role === 5 ? 0.04 : 0), 0.2, 0.99);
  const speedOf = (p) => lvlOf(p).speed;

  // ---- ball prediction (free flight only) --------------------------------------------------------------
  function predictFree(T, from = B) {
    let x = from.x, y = from.y, z = from.z, vx = from.vx, vy = from.vy, vz = from.vz;
    const n = Math.max(1, Math.round(T / (DT * 2)));
    for (let i = 0; i < n; i++) {
      const h = DT * 2;
      vy -= G * h; x += vx * h; y += vy * h; z += vz * h;
      if (y < BALL_R) { y = BALL_R; if (vy < -0.8) { vy = -vy * 0.55; vx *= 0.88; vz *= 0.88; } else { vy = 0; const sp = Math.hypot(vx, vz); const k = Math.max(0, sp - 1.6 * h) / (sp || 1); vx *= k; vz *= k; } }
    }
    return { x, y, z };
  }
  // ballistic solvers (no drag)
  function solveSpeed(dx, dz, dy, v, high) {      // elevation angle for a given speed
    const d = Math.hypot(dx, dz);
    const disc = v ** 4 - G * (G * d * d + 2 * dy * v * v);
    if (disc < 0) return { el: Math.PI / 4, ok: false };
    const sq = Math.sqrt(disc);
    const tn = (v * v + (high ? sq : -sq)) / (G * d);
    return { el: Math.atan(tn), ok: true };
  }
  function solveAngle(dx, dz, dy, el) {            // speed for a given elevation angle
    const d = Math.hypot(dx, dz), c = Math.cos(el), tn = Math.tan(el);
    const den = 2 * c * c * (d * tn - dy);
    if (den <= 0.01) return 0;
    return Math.sqrt(G * d * d / den);
  }

  // ---- actions -------------------------------------------------------------------------------------------
  const holder = () => (B.holder >= 0 ? P[B.holder] : null);
  const hasBall = (p) => B.holder === p.id;
  function pathBall(p0, p1, T) {       // kinematic toss from p0 to p1 over T seconds (ballistic arc)
    B.mode = 'path'; B.holder = -1;
    B.path = { t0: s.t, T, x0: p0.x, y0: p0.y, z0: p0.z, x1: p1.x, y1: p1.y, z1: p1.z, vy: (p1.y - p0.y + 0.5 * G * T * T) / T };
  }
  function setBallVel(vx, vy, vz) { B.vx = vx; B.vy = vy; B.vz = vz; B.mode = 'free'; B.holder = -1; B.path = null; }

  function canAct(p) { return !p.act && p.stun <= 0; }

  // Starts a strike. o = { style: 'drive'|'loft', f: 0..1 (bar position), aim: {x,z} unit }
  function startStrike(p, o) {
    if (!canAct(p)) return false;
    const have = hasBall(p) || (B.mode === 'path' && B.pathOwner === p.id);
    const f = o.f ?? 0.3;
    let aim = o.aim;
    if (!aim || Math.hypot(aim.x, aim.z) < 0.1) aim = fwd(p.face);
    const aimPhi = yawOf(aim.x, aim.z);
    const bodyPhi = aimPhi + Math.PI / 2;
    const act = { id: s.actId++, kind: 'strike', t0: s.t, style: o.style || (f < 0.5 ? 'drive' : 'loft'), f, aim, aimPhi, bodyFace: bodyPhi, variant: 'hand', who: p.id, ok: null, q: 0, tgt: o.tgt || null };
    if (have) {
      let Tt = TOSS_SEC;
      Tt = quant(Tt);
      act.tc = s.t + Tt; act.t1 = act.tc + 0.55;
      const fb = fwd(bodyPhi);
      act.stance = { x: p.x + p.vx * 0.12, z: p.z + p.vz * 0.12 };
      act.c = { x: act.stance.x + fb.x * 1.0, y: 1.2, z: act.stance.z + fb.z * 1.0 };
      B.pathOwner = p.id; B.hs = 'hand';
      pathBall({ x: B.x, y: B.y, z: B.z }, act.c, Tt);
      p.handT = 0;
    } else {
      // from the ground / low in the air: the ball must be reachable
      const near = B.mode === 'free' && dist2(B.x, B.z, p.x, p.z) < 5.5;
      if (!near) return false;
      act.variant = 'ground';
      let Tt = quant(GROUND_SEC);
      const pr = predictFree(Tt);
      if (pr.y > 0.6) return false;                      // a strike off the ground needs the ball low when the bas arrives
      const fb = fwd(bodyPhi);
      act.tc = s.t + Tt; act.t1 = act.tc + 0.5;
      act.stance = { x: pr.x - fb.x * 1.0, z: pr.z - fb.z * 1.0 };
      act.c = { x: pr.x, y: clamp(pr.y, 0.1, 1.7), z: pr.z };
      act.track = 1.0;
    }
    p.act = act; p.burstT = 0;
    return true;
  }

  function startPass(p, o) {
    if (!canAct(p) || !hasBall(p)) return false;
    let aim = o.aim || fwd(p.face);
    const aimPhi = yawOf(aim.x, aim.z);
    const bodyPhi = aimPhi + 0.5;
    const Tt = quant(PASS_SEC);
    const fb = fwd(bodyPhi);
    const act = { id: s.actId++, kind: 'pass', t0: s.t, tc: s.t + Tt, t1: s.t + Tt + 0.45, aim, aimPhi, bodyFace: bodyPhi, who: p.id, tgt: o.tgt ?? -1, variant: 'hand', ok: null };
    act.stance = { x: p.x + p.vx * 0.1, z: p.z + p.vz * 0.1 };
    act.c = { x: act.stance.x + fb.x * 0.5, y: 1.05, z: act.stance.z + fb.z * 0.5 };
    pathBall({ x: B.x, y: B.y, z: B.z }, act.c, Tt);
    B.pathOwner = p.id;
    p.act = act;
    return true;
  }

  function loosePick(p) {      // can this player rise the ball?
    return B.mode === 'free' && B.y < 0.6 && Math.hypot(B.vx, B.vz) < 9 && dist2(B.x, B.z, p.x, p.z) < 3.4 && B.holder < 0;
  }
  function startRise(p) {
    if (!canAct(p) || !loosePick(p)) return false;
    const Tt = quant(GROUND_SEC);
    const pr = predictFree(Tt);
    if (pr.y > 0.45) return false;
    const dx = pr.x - p.x, dz = pr.z - p.z, ph = Math.hypot(dx, dz) > 0.2 ? yawOf(dx, dz) : p.face;
    const fb = fwd(ph);
    p.act = { id: s.actId++, kind: 'rise', t0: s.t, tc: s.t + Tt, t1: s.t + Tt + 0.7, bodyFace: ph, who: p.id, variant: 'ground', ok: null,
      stance: { x: pr.x - fb.x * 0.7, z: pr.z - fb.z * 0.7 }, c: { x: pr.x, y: 0.12, z: pr.z }, track: 0.7 };
    return true;
  }

  function carrierExposed(c, at) {     // is the carrier's ball in the air above the bas at time `at`?
    if (!c || B.holder !== c.id || B.hs !== 'bal') return false;
    const u = (((B.hp + (at - s.t)) / SOLO_PERIOD) % 1 + 1) % 1;
    return u > EXPOSE_FROM && u < EXPOSE_TO;
  }
  function ballOnCarrier(c, at) {       // predicted ball position of a solo carrier at time `at`
    const fb = fwd(c.face), rb = rgt(c.face), dt = at - s.t;
    const u = (((B.hp + dt) / SOLO_PERIOD) % 1 + 1) % 1;
    return { x: c.x + c.vx * dt + fb.x * 0.75 + rb.x * 0.3, y: BAS_Y + 4 * SOLO_HOP * u * (1 - u), z: c.z + c.vz * dt + fb.z * 0.75 + rb.z * 0.3 };
  }

  // Hook / block / shoulder: one stick action, resolved at tc from what is there. variant 'dive' = goalkeeper's lunge.
  function startHook(p, o = {}) {
    if (!canAct(p)) return false;
    if (p.role === 0 && !o.dive && B.mode === 'free' && B.holder < 0) {      // a keeper whose ball is wide goes for it with a dive
      const pr0 = predictFree(0.3);
      if (Math.abs(pr0.x - p.x) > 1.0 && Math.abs(pr0.x - p.x) < KEEPER_DIVE + 0.6 && pr0.y < 3) o = { ...o, dive: true, dx: pr0.x, dz: p.z };
    }
    let tcOverride = null, trackCar = -1;
    const Tt0 = quant(o.Tt ?? (o.dive ? 0.3 : HOOK_SEC));
    let tc = s.t + Tt0;
    let ph = p.face, c = null, target = o.target != null ? P[o.target] : null;
    if (!target) {
      const h = holder();
      if (h && h.team !== p.team && dist2(h.x, h.z, p.x, p.z) < 2.6) target = h;
    }
    const stance = { x: p.x, z: p.z };
    if (o.dive) {
      stance.x = clamp(o.dx, p.x - KEEPER_DIVE, p.x + KEEPER_DIVE); stance.x = clamp(stance.x, -GOAL_HW - 1.2, GOAL_HW + 1.2); stance.z = o.dz ?? p.z;
      c = { x: stance.x, y: 1.0, z: stance.z + dirOf(p.team) * 0.8 };
    } else if (target && B.holder === target.id && B.hs === 'bal') {
      const bp = ballOnCarrier(target, tc);
      const dx = bp.x - p.x, dz = bp.z - p.z;
      ph = Math.hypot(dx, dz) > 0.1 ? yawOf(dx, dz) : p.face;
      const fb = fwd(ph);
      stance.x = bp.x - fb.x * HOOK_ARM; stance.z = bp.z - fb.z * HOOK_ARM;
      c = { x: bp.x, y: bp.y, z: bp.z }; trackCar = target.id;
    } else if (target) {
      const dx = target.x - p.x, dz = target.z - p.z;
      ph = Math.hypot(dx, dz) > 0.1 ? yawOf(dx, dz) : p.face;
      const fb = fwd(ph);
      c = { x: p.x + fb.x * HOOK_ARM, y: 1.0, z: p.z + fb.z * HOOK_ARM };
    } else if (B.mode === 'path' && B.pathOwner >= 0 && P[B.pathOwner].team !== p.team && P[B.pathOwner].act && P[B.pathOwner].act.c && s.t < P[B.pathOwner].act.tc - 0.12) {
      // a rival is winding up: step in and hook the ball as it is struck
      const wa = P[B.pathOwner].act;
      const dx = wa.c.x - p.x, dz = wa.c.z - p.z;
      ph = Math.hypot(dx, dz) > 0.1 ? yawOf(dx, dz) : p.face;
      const fb = fwd(ph);
      stance.x = wa.c.x - fb.x * HOOK_ARM; stance.z = wa.c.z - fb.z * HOOK_ARM;
      c = { x: wa.c.x, y: wa.c.y, z: wa.c.z };
      o = { ...o, Tt: Math.max(0.2, wa.tc - s.t - 0.034) };
      tcOverride = s.t + o.Tt;
    } else {
      // a ball flying near: step into its path
      const pr = predictFree(Tt0);
      const dx = pr.x - p.x, dz = pr.z - p.z, dd = Math.hypot(dx, dz);
      if (B.mode === 'free' && dd < 3.2 && pr.y < 2.6) { ph = yawOf(dx, dz); const fb = fwd(ph); stance.x = pr.x - fb.x * HOOK_ARM; stance.z = pr.z - fb.z * HOOK_ARM; c = { x: pr.x, y: clamp(pr.y, 0.2, 2.2), z: pr.z }; }
      else { const fb = fwd(ph); c = { x: p.x + fb.x * HOOK_ARM, y: 1.0, z: p.z + fb.z * HOOK_ARM }; }
    }
    if (tcOverride) tc = tcOverride;
    p.act = { id: s.actId++, kind: 'hook', t0: s.t, tc, t1: tc + 0.45, bodyFace: ph, who: p.id, variant: o.dive ? 'dive' : 'stick', ok: null, stance, c, victim: target ? target.id : -1, win0: tc - 0.1, win1: tc + 0.14, blocked: false, trackCar, track: o.dive ? 0 : HOOK_ARM };
    return true;
  }

  function startBurst(p) {
    if (!canAct(p) || p.burstCd > 0 || p.stam < 0.12) return false;
    p.burstT = BURST_SEC; p.burstCd = BURST_CD; p.stam = Math.max(0, p.stam - 0.12);
    ev('burst', { id2: p.id });
    return true;
  }

  // ---- resolving contacts ----------------------------------------------------------------------------------
  function barQuality(style, f) { return clamp(1 - Math.abs(f - SWEET[style]) / 0.24, 0, 1); }

  // Launch the ball from point c as a strike. Returns the event.
  function launchStrike(p, act) {
    const sk = skillOf(p);
    const style = act.style;
    const q = act.q;
    const a = dirOf(p.team), gz = goalZ(p.team);
    const aim = act.aim;
    const from = { x: B.x, y: B.y, z: B.z };
    let az = act.aimPhi;
    const dGoal = Math.hypot(0 - from.x, gz - from.z);
    const toGoal = yawOf(0 - from.x, gz - from.z);
    const assist = cfg.assist ?? 0.7;
    let aimPoint = null;
    // aim assist: the goal mouth pulls a strike aimed within about 30 degrees of it
    const dAng = Math.abs(wrapAng(az - toGoal));
    const goalSide = (gz - from.z) * a > 0;
    if (goalSide && dGoal < 24 && dAng < ASSIST_DEG * Math.PI / 180 && !act.noAssist) {
      const az2 = az + wrapAng(toGoal - az) * assist;
      const dz = gz - from.z;
      const tx = from.x + Math.tan(az2) * dz;
      const tcl = Math.abs(tx) < GOAL_HW + 2.2 ? clamp(tx, -GOAL_HW + 0.5, GOAL_HW - 0.5) : tx;
      aimPoint = { x: tcl, z: gz, y: style === 'drive' ? 1.1 : BAR + 1.9 };
    }
    let v, el, azF = az;
    const noise = (0.03 + 0.2 * (1 - q)) * (1.6 - 0.8 * sk) * (cfg.noiseK ?? 1.5) * (0.6 + dGoal / 8);
    if (aimPoint) {
      const dx = aimPoint.x - from.x, dz = aimPoint.z - from.z, dy = aimPoint.y - from.y;
      azF = yawOf(dx, dz);
      if (style === 'drive') { v = 22 + 10 * q; const sol = solveSpeed(dx, dz, dy, v, false); el = sol.el; }
      else { el = 0.72 - 0.0033 * dGoal * 0; v = solveAngle(dx, dz, dy, el); if (v > 34) v = 34; if (v < 14) v = 14; }
      s.stats[p.team].shots++;
      act.shot = true;
    } else if (style === 'drive') { v = 22 + 10 * q; el = 0.1; }
    else { const range = 7 + 17 * clamp((act.f - 0.45) / 0.55, 0, 1); el = 0.68; v = Math.sqrt(range * G / Math.sin(2 * el)); }
    azF += gaussish() * noise;
    el += gaussish() * noise * 0.5;
    const ch = Math.cos(el);
    setBallVel(Math.sin(azF) * ch * v, Math.sin(el) * v, Math.cos(azF) * ch * v);
    B.lastTouch = p.id; B.lastTeam = p.team; B.lastT = s.t; B.intended = -1;
    B.shotBy = act.shot ? p.team : -1;
    act.speed = v; act.dir = { x: Math.sin(azF) * ch, y: Math.sin(el), z: Math.cos(azF) * ch };
    return ev('strike', { by: p.id, team: p.team, style, q, speed: v, shot: !!act.shot, variant: act.variant });
  }

  function passTarget(p, aim) {        // the teammate (id) best matching the pass direction, or -1
    const aimPhi = yawOf(aim.x, aim.z);
    let best = -1, bs = 0.5;
    for (const q of P) {
      if (q.team !== p.team || q.id === p.id || q.frozen) continue;
      const d = dist2(q.x, q.z, p.x, p.z);
      if (d < 2.5 || d > 30) continue;
      const ang = Math.abs(wrapAng(yawOf(q.x - p.x, q.z - p.z) - aimPhi));
      const score = 0.7 - ang - d * 0.004;
      if (score > bs - 0.5 && ang < 0.62 && score > (best < 0 ? -9 : bs)) { best = q.id; bs = score; }
    }
    return best;
  }

  function launchPass(p, act) {
    const sk = skillOf(p);
    const tgt = act.tgt >= 0 ? P[act.tgt] : null;
    const from = { x: B.x, y: B.y, z: B.z };
    let tx, tz, T;
    let az = act.aimPhi;
    if (tgt) {
      const d0 = dist2(tgt.x, tgt.z, from.x, from.z);
      T = clamp(d0 / 14, 0.35, 1.5);
      tx = tgt.x + tgt.vx * T * 0.85; tz = tgt.z + tgt.vz * T * 0.85;
      az = yawOf(tx - from.x, tz - from.z);
      tx = clamp(tx, -HW + 0.4, HW - 0.4); tz = clamp(tz, -HL + 0.4, HL - 0.4);
    } else { tx = from.x + Math.sin(az) * 9; tz = from.z + Math.cos(az) * 9; T = 0.65; }
    const dx = tx - from.x, dz = tz - from.z, d = Math.hypot(dx, dz) || 0.1;
    const dy = 1.25 - from.y;
    const v = clamp(d / T, 8, 19);
    const T2 = d / v;
    const vy = (dy + 0.5 * G * T2 * T2) / T2;
    const noise = (0.015 + 0.05 * (1 - sk));
    const azF = yawOf(dx, dz) + gaussish() * noise;
    setBallVel(Math.sin(azF) * d / T2, vy, Math.cos(azF) * d / T2);
    B.lastTouch = p.id; B.lastTeam = p.team; B.lastT = s.t; B.intended = tgt ? tgt.id : -1; B.shotBy = -1;
    s.stats[p.team].passes++;
    return ev('pass', { by: p.id, team: p.team, to: tgt ? tgt.id : -1, speed: d / T2 });
  }

  function giveBall(p, hs = 'hand') {
    B.mode = 'carried'; B.holder = p.id; B.hs = hs; B.hp = 0; B.path = null; B.vx = B.vy = B.vz = 0; B.intended = -1; B.shotBy = -1;
    B.lastTouch = p.id; B.lastTeam = p.team; B.lastT = s.t;
    p.handT = 0; p.steps = 0;
    ballFollow(p);
  }
  function ballFollow(p) {
    const fb = fwd(p.face), rb = rgt(p.face);
    if (B.hs === 'hand') { B.x = p.x + fb.x * 0.4 + rb.x * 0.22; B.z = p.z + fb.z * 0.4 + rb.z * 0.22; B.y = 1.02; }
    else {
      const u = (B.hp / SOLO_PERIOD) % 1;
      B.x = p.x + fb.x * 0.75 + rb.x * 0.3; B.z = p.z + fb.z * 0.75 + rb.z * 0.3; B.y = BAS_Y + 4 * SOLO_HOP * u * (1 - u);
    }
    B.vx = p.vx; B.vz = p.vz; B.vy = 0;
  }

  function loseBall(p, vel) {
    if (B.holder !== p.id) return;
    const sp = vel || { x: 0, z: 0 };
    B.mode = 'free'; B.holder = -1; B.path = null;
    B.vx = sp.x; B.vz = sp.z; B.vy = 2.5;
  }

  function foul(p, reason, spot) {
    if (s.restart || s.phase !== 'play') return;
    s.stats[p.team].fouls++;
    const team = 1 - p.team;
    const x = clamp(spot.x, -HW + 1, HW - 1), z = clamp(spot.z, -HL + 3, HL - 3);
    ev('foul', { by: p.id, team: p.team, reason, x, z });
    startRestart({ kind: 'free', team, x, z, text: `Free to ${team === 0 ? 'you' : 'them'}: ${reason}` });
  }

  // ---- restarts ------------------------------------------------------------------------------------------
  function takerFor(team, x, z) {
    let best = -1, bd = 1e9;
    for (const q of P) { if (q.team !== team || q.role === 0 && Math.hypot(x, z - goalZ(1 - team)) > 14) continue; const d = dist2(q.x, q.z, x, z); if (d < bd) { bd = d; best = q.id; } }
    return best;
  }
  function startRestart(r) {
    s.restart = { t: 0, ...r };
    s.phase = 'restart'; s.phaseT = 0;
    for (const q of P) { if (q.act) { q.act = null; } q.stun = 0; }
    B.mode = 'free'; B.holder = -1; B.path = null; B.dead = false; B.shotBy = -1; B.intended = -1;
    if (r.kind === 'puckout') {
      const gk = P[r.team * 6];
      gk.x = clamp(r.x ?? 0, -1.5, 1.5); gk.z = goalZ(1 - r.team) + dirOf(r.team) * 1.8; gk.vx = gk.vz = 0; gk.face = r.team === 0 ? 0 : Math.PI;
      B.x = gk.x; B.z = gk.z + dirOf(r.team) * 0.5; B.y = BALL_R; B.vx = B.vy = B.vz = 0;
      giveBall(gk, 'hand');
      s.restart.taker = gk.id;
      for (const q of P) if (q.team !== r.team) { /* opponents keep to their half until the ball is struck */ }
    } else if (r.kind === 'free') {
      B.x = r.x; B.z = r.z; B.y = BALL_R; B.vx = B.vy = B.vz = 0;
      s.restart.taker = takerFor(r.team, r.x, r.z);
      const tk = P[s.restart.taker];
      // opponents stand off by 5 m, the taker starts next to the ball
      for (const q of P) if (q.team !== r.team) {
        const d = dist2(q.x, q.z, r.x, r.z);
        if (d < FREE_BACK_M) { const dx = (q.x - r.x) || 0.1, dz = (q.z - r.z) || 0.1, l = Math.hypot(dx, dz); q.x = r.x + dx / l * 3.6; q.z = r.z + dz / l * 3.6; q.vx = q.vz = 0; }
        q.x = clamp(q.x, -HW + 0.4, HW - 0.4); q.z = clamp(q.z, -HL + 0.4, HL - 0.4);
      }
      tk.x = r.x - fwd(tk.face).x * 1.0; tk.z = r.z - fwd(tk.face).z * 1.0; tk.vx = tk.vz = 0;
    } else if (r.kind === 'throw') {
      B.x = 0; B.z = 0; B.y = BALL_R; B.vx = B.vy = B.vz = 0;
    }
  }
  function endRestart() { s.restart = null; s.phase = 'play'; s.phaseT = 0; }

  function formation(kickoff) {
    for (const q of P) {
      const h = HOME[q.role], a = q.team === 0 ? 1 : -1;
      q.x = h[0] * a; q.z = h[1] * a; q.vx = q.vz = 0; q.face = q.team === 0 ? 0 : Math.PI; q.act = null; q.stun = 0; q.stam = 1; q.ai.tx = q.x; q.ai.tz = q.z;
      if (kickoff && q.role === 3) q.z = 3 * a;
    }
    B.mode = 'free'; B.holder = -1; B.path = null; B.x = 0; B.z = 0; B.y = BALL_R; B.vx = B.vy = B.vz = 0;
  }

  // ---- scoring and out of play ----------------------------------------------------------------------------------
  function score(team, kind) {
    const sc = s.score[team];
    if (kind === 'goal') { sc.g++; s.stats[team].goals++; } else { sc.p++; s.stats[team].points++; }
    const text = kind === 'goal' ? 'GOAL' : 'POINT';
    s.last = { t: s.t, team, kind, text, by: B.lastTouch };
    ev('score', { team, kind, by: B.lastTouch });
    s.phase = 'dead'; s.phaseT = 0; B.dead = true;
    s.deadNext = { kind: 'puckout', team: 1 - team };
  }
  function wide(team) {       // `team` attacked; the ball crossed the end line outside the posts or was last touched by the defence
    s.stats[team].wides++;
    s.last = { t: s.t, team, kind: 'wide', text: 'WIDE', by: B.lastTouch };
    ev('wide', { team });
    s.phase = 'dead'; s.phaseT = 0; B.dead = true;
    s.deadNext = { kind: 'puckout', team: 1 - team };
  }
  function checkBounds() {
    if (B.dead || s.phase === 'dead') return;
    // end lines
    for (const end of [1, -1]) {
      const att = end === 1 ? 0 : 1;           // team 0 attacks z = +HL
      const beyond = end * B.z > HL;
      if (!beyond) continue;
      const inPosts = Math.abs(B.x) < GOAL_HW - BALL_R * 0.5;
      const prevZ = B.pz;
      if (end * prevZ > HL) { /* already beyond: inside the net */ continue; }
      const t = clamp((HL - end * prevZ) / (Math.abs(B.z - prevZ) < 1e-6 ? 1 : Math.abs(B.z - prevZ)), 0, 1);
      const xAt = B.px + (B.x - B.px) * t, yAt = B.py + (B.y - B.py) * t;
      const nearPost = Math.abs(Math.abs(xAt) - GOAL_HW) < 0.1 && yAt < POST_H;
      if (nearPost) { B.vz = -B.vz * 0.4; B.vx += (xAt > 0 ? 1 : -1) * 1.5; B.z = end * (HL - 0.05); ev('post'); return; }
      if (Math.abs(xAt) < GOAL_HW && Math.abs(yAt - BAR) < 0.1 && B.vy !== 0) { B.vz = -B.vz * 0.45; B.vy = Math.abs(B.vy) * 0.5 + 1.2; B.z = end * (HL - 0.05); ev('bar'); return; }
      if (Math.abs(xAt) < GOAL_HW) {
        const attTeam = B.lastTeam === att ? att : (B.lastTeam === 1 - att ? 1 - att : att);
        // a ball struck by the defending side into its own net still counts for the attackers
        if (yAt < BAR) { score(att, 'goal'); return; }
        score(att, 'point'); return;
        void attTeam;
      }
      // wide
      if (B.lastTeam === att) wide(att);
      else { s.last = { t: s.t, team: att, kind: 'long', text: 'LONG FREE', by: B.lastTouch }; ev('wide', { team: att, long: true }); s.phase = 'dead'; s.phaseT = 0; B.dead = true; s.deadNext = { kind: 'free', team: att, x: clamp(B.x, -4, 4), z: end * (HL - 9) }; }
      return;
    }
    if (Math.abs(B.x) > HW) {
      const team = 1 - B.lastTeam;
      const x = Math.sign(B.x) * (HW - 0.6), z = clamp(B.z, -HL + 2, HL - 2);
      s.last = { t: s.t, team, kind: 'side', text: 'SIDELINE', by: B.lastTouch };
      ev('side', { team });
      s.phase = 'dead'; s.phaseT = 0; B.dead = true;
      s.deadNext = { kind: 'free', team, x, z, side: true };
    }
  }

  // ---- update ---------------------------------------------------------------------------------------------------
  function humanInput(p, dt) {
    const I = s.input;
    const mag = Math.hypot(I.mx, I.mz);
    let tx = 0, tz = 0, sprint = false;
    if (mag > 0.12) { tx = I.mx / Math.max(1, mag); tz = I.mz / Math.max(1, mag); sprint = mag > 0.93 || I.sprint; }
    p.dvx = tx; p.dvz = tz; p.dmag = Math.min(1, mag); p.sprint = sprint;
    const aim = mag > 0.3 ? { x: tx, z: tz } : fwd(p.face);
    s.aimHint = { x: aim.x, z: aim.z, moving: mag > 0.3 };
    if (p.act || p.stun > 0 || s.phase === 'dead') { s.charge = null; return; }
    const have = hasBall(p);
    const canStrikeGround = !have && B.mode === 'free' && dist2(B.x, B.z, p.x, p.z) < 4.5 && B.holder < 0;
    if (I.down && !s.charge && (have || canStrikeGround)) s.charge = { t0: s.t, ground: !have };
    if (s.charge) {
      const f = clamp((s.t - s.charge.t0) / CHARGE_SEC, 0, 1);
      if (!I.down || f >= 1) {
        const style = f < 0.52 ? 'drive' : 'loft';
        const act = { style, f, aim };
        const q = barQuality(style, f);
        s.charge = null;
        const ok = startStrike(p, act);
        if (ok) { p.act.q = q; p.act.tgt = null; }
      }
    }
    if (I.pass && have) { const tg = passTarget(p, aim); startPass(p, { aim: tg >= 0 ? { x: P[tg].x - p.x, z: P[tg].z - p.z } : aim, tgt: tg }); }
    else if (I.rise) { if (have) startBurst(p); else startRise(p); }
    else if (I.hook) startHook(p, {});
    if (I.burst) startBurst(p);
  }

  // keep the stand spot on the (predicted) ball while the swing is under way, so the ball is exactly where the clip expects it at contact
  function retarget(p, a) {
    const left = Math.max(0, a.tc - s.t);
    let c = null;
    if (a.trackCar >= 0 && B.holder === a.trackCar && B.hs === 'bal') c = ballOnCarrier(P[a.trackCar], a.tc);
    else if (a.trackCar < 0 && B.mode === 'free') c = predictFree(left);
    if (!c) return;
    const fb = fwd(a.bodyFace);
    a.stance = { x: c.x - fb.x * a.track, z: c.z - fb.z * a.track };
    if (a.kind === 'strike') a.c = { x: c.x, y: clamp(c.y, 0.1, 1.7), z: c.z };
    else if (a.kind === 'rise') a.c = { x: c.x, y: 0.12, z: c.z };
    else a.c = { x: c.x, y: c.y, z: c.z };
  }

  function stepPlayers(dt) {
    for (const p of P) {
      p.stun = Math.max(0, p.stun - dt); p.catchCd = Math.max(0, p.catchCd - dt); p.burstCd = Math.max(0, p.burstCd - dt); p.burstT = Math.max(0, p.burstT - dt);
      let dvx = 0, dvz = 0, mag = 0, sprint = false;
      const frozen = s.phase === 'dead' || s.over || s.phase === 'hold' || p.frozen || !!p.script;
      if (!frozen) {
        if (p.human) humanInput(p, dt);
        else aiTick(api, p, dt);
      }
      const lv = lvlOf(p);
      const base = (p.human ? 4.7 : 4.7 * lv.speed) * (1 - (1 - p.stam) * 0.18) * (hasBall(p) ? 0.94 : 1) * (p.role === 5 ? 1.03 : p.role === 0 ? 0.95 : 1);
      if (p.human) { dvx = p.dvx || 0; dvz = p.dvz || 0; mag = p.dmag || 0; sprint = p.sprint; }
      else { dvx = p.ai.dvx || 0; dvz = p.ai.dvz || 0; mag = p.ai.dmag || 0; sprint = p.ai.sprint; }
      if (p.script) { dvx = p.script.vx; dvz = p.script.vz; mag = 1; }
      let vmax = p.script ? Math.hypot(p.script.vx, p.script.vz) : base * mag * (sprint && p.stam > 0.04 ? 1.32 : 1);
      if (p.script) { const l = Math.hypot(dvx, dvz) || 1; dvx /= l; dvz /= l; }
      if (p.burstT > 0) { vmax = base * 1.62; if (mag < 0.1) { dvx = Math.sin(p.face); dvz = Math.cos(p.face); } mag = 1; }
      let tvx = dvx * vmax, tvz = dvz * vmax;
      const a = p.act;
      let acc = 17;
      if (a && a.track && a.ok === null && s.t < a.tc) retarget(p, a);
      if (a) {
        if (a.stance && (a.kind === 'strike' || a.kind === 'rise' || a.kind === 'hook')) {
          const dx = a.stance.x - p.x, dz = a.stance.z - p.z, d = Math.hypot(dx, dz);
          const left = Math.max(0.05, a.tc - s.t);
          const sp = a.variant === 'dive' ? Math.min(11, d / left) : Math.min(8.2, d / left);
          if (d > 0.02) { tvx = dx / d * sp; tvz = dz / d * sp; } else { tvx = tvz = 0; }
          if (s.t >= a.tc) { tvx = tvz = 0; }
          acc = 40;
        } else { tvx = tvz = 0; acc = 26; }
      }
      if ((frozen && !p.script) || p.stun > 0) { tvx = tvz = 0; acc = 30; }
      const dvx2 = tvx - p.vx, dvz2 = tvz - p.vz, dl = Math.hypot(dvx2, dvz2);
      const step = acc * dt;
      if (dl > step) { p.vx += dvx2 / dl * step; p.vz += dvz2 / dl * step; } else { p.vx = tvx; p.vz = tvz; }
      p.x += p.vx * dt; p.z += p.vz * dt;
      const sp = Math.hypot(p.vx, p.vz);
      if (sprint && sp > 5.5) p.stam = Math.max(0, p.stam - 0.2 * dt);
      else p.stam = Math.min(1, p.stam + (sp < 1 ? 0.2 : 0.08) * dt);
      p.steps += sp * dt / HAND_STEP_M;
      // facing
      let want = p.face;
      if (a) want = a.bodyFace; else if (sp > 0.6) want = yawOf(p.vx, p.vz);
      else if (p.human && p.dmag > 0.12) want = yawOf(p.dvx, p.dvz);
      const dif = wrapAng(want - p.face);
      p.face = wrapAng(p.face + clamp(dif, -dt * (a ? 14 : 11), dt * (a ? 14 : 11)));
      p.x = clamp(p.x, -HW + 0.3, HW - 0.3); p.z = clamp(p.z, -HL + 0.3, HL - 0.3);
      if (p.human && p.role === 0) { p.x = clamp(p.x, -4.5, 4.5); p.z = clamp(p.z, -HL + 0.3, -HL + 4.5); }   // the keeper stays near the goal
    }
    // separation between players
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) {
      const a = P[i], b = P[j];
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < PLAYER_R * 2 && d > 1e-4) {
        const push = (PLAYER_R * 2 - d) / 2, nx = dx / d, nz = dz / d;
        a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
      }
    }
  }

  function carryStep(dt) {
    const h = holder();
    if (!h) return;
    if (B.hs === 'hand') {
      h.handT += dt;
      if (h.handT > HAND_MAX_SEC || h.steps > HAND_MAX_STEPS) { B.hs = 'bal'; B.hp = 0; ev('balance', { by: h.id }); }
    } else {
      B.hp += dt;
      if (B.hp >= SOLO_PERIOD) { B.hp -= SOLO_PERIOD; ev('solo', { by: h.id }); }
    }
    if (h.stun > 0 && B.hs === 'bal') { /* a stunned carrier keeps the ball */ }
    ballFollow(h);
  }

  function stepBall(dt) {
    B.px = B.x; B.py = B.y; B.pz = B.z;
    if (B.mode === 'carried') { carryStep(dt); return; }
    if (B.mode === 'path') {
      const pa = B.path, u = clamp((s.t - pa.t0) / pa.T, 0, 1);
      B.x = pa.x0 + (pa.x1 - pa.x0) * u; B.z = pa.z0 + (pa.z1 - pa.z0) * u;
      const tt = u * pa.T; B.y = pa.y0 + pa.vy * tt - 0.5 * G * tt * tt; B.vx = B.vy = B.vz = 0;
      return;
    }
    if (B.dead) {
      // after a score the ball just settles
    }
    B.px = B.x; B.py = B.y; B.pz = B.z;
    B.vy -= G * dt; B.x += B.vx * dt; B.y += B.vy * dt; B.z += B.vz * dt;
    // goal net: slows the ball behind the line
    if (Math.abs(B.z) > HL && Math.abs(B.x) < GOAL_HW + 0.5) { B.vx *= 0.9; B.vz *= 0.86; if (Math.abs(B.z) > HL + NET_D) { B.z = Math.sign(B.z) * (HL + NET_D); B.vz = -B.vz * 0.2; } }
    if (B.y < BALL_R) {
      B.y = BALL_R;
      if (B.vy < -0.8) { B.vy = -B.vy * 0.55; B.vx *= 0.88; B.vz *= 0.88; if (B.vy > 1.2) ev('bounce', { v: B.vy }); }
      else { B.vy = 0; const sp = Math.hypot(B.vx, B.vz); const k = Math.max(0, sp - 1.6 * dt) / (sp || 1); B.vx *= k; B.vz *= k; if (sp < 0.05) { B.vx = B.vz = 0; } }
    }
    if (Math.abs(B.z) > HL + NET_D + 8) { B.z = Math.sign(B.z) * (HL + NET_D + 8); B.vz = 0; }
    if (Math.abs(B.x) > HW + 12) { B.x = Math.sign(B.x) * (HW + 12); B.vx = 0; }
  }

  function interactions(dt) {
    // catches / deflections of a free ball flying near a player
    if (B.mode === 'free' && !B.dead && s.phase === 'play') {
      const sp = Math.hypot(B.vx, B.vy, B.vz);
      for (const q of P) {
        if (q.catchCd > 0 || q.stun > 0) continue;
        if (q.act && q.act.kind !== 'hook' && !(q.act.t1 < s.t)) continue;
        if (B.lastTouch === q.id && s.t - B.lastT < 0.45) continue;
        const d = dist2(B.x, B.z, q.x, q.z);
        const rr = q.role === 0 ? 1.15 : 0.95;
        if (d > rr) continue;
        if (B.y < 0.45 || B.y > (q.role === 0 ? 2.7 : 2.3)) continue;
        if (sp < 1.2) continue;
        q.catchCd = 0.6;
        const mine = B.intended === q.id;
        const pc = clamp(0.42 + 0.55 * skillOf(q) - sp * 0.0175 + (mine ? 0.32 : 0) + (q.human ? 0.1 : 0), 0.08, 0.97);
        if (R.chance(pc)) {
          giveBall(q, 'hand');
          ev('catch', { by: q.id, team: q.team, mine, shot: B.shotBy });
          if (B.shotBy >= 0 && B.shotBy !== q.team && q.role === 0) s.stats[q.team].saves++;
          B.shotBy = -1;
          break;
        } else {
          B.vx *= 0.3; B.vz *= 0.3; B.vy = Math.abs(B.vy) * 0.3 + 1; B.vx += R.range(-2, 2); B.vz += R.range(-2, 2);
          B.lastTouch = q.id; B.lastTeam = q.team; B.lastT = s.t; B.intended = -1; B.shotBy = -1;
          ev('fumble', { by: q.id });
          break;
        }
      }
    }
  }

  function resolveActs() {
    for (const p of P) {
      const a = p.act;
      if (!a) continue;
      if (a.ok === null && s.t >= a.tc - 1e-9) {
        if (a.kind === 'strike') resolveStrike(p, a);
        else if (a.kind === 'pass') resolvePass(p, a);
        else if (a.kind === 'rise') resolveRise(p, a);
        else if (a.kind === 'hook') resolveHook(p, a);
      }
      if (a.kind === 'hook' && a.ok === null && s.t >= a.win0 && s.t < a.tc) blockWindow(p, a);
      if (a.kind === 'hook' && a.ok === true && !a.blocked && s.t <= a.win1) blockWindow(p, a);
      if (s.t >= a.t1) p.act = null;
    }
  }

  function touched() { if (s.restart && s.phase === 'restart') endRestart(); }

  function resolveStrike(p, a) {
    if (a.variant === 'hand') {
      a.ok = true;
      B.x = a.c.x; B.y = a.c.y; B.z = a.c.z;
      a.q = a.q || barQuality(a.style, a.f);
      launchStrike(p, a);
    } else {
      const fb = fwd(a.bodyFace);
      const cx = p.x + fb.x * 1.0, cz = p.z + fb.z * 1.0;
      const d = dist2(B.x, B.z, cx, cz);
      if (B.mode === 'free' && d < 0.5 && B.y < 0.65) {
        a.ok = true; a.c = { x: B.x, y: Math.max(0.1, B.y), z: B.z };
        a.q = a.q || barQuality(a.style, a.f);
        launchStrike(p, a);
      } else { a.ok = false; ev('whiff', { by: p.id }); }
    }
    if (a.ok) touched();
  }
  function resolvePass(p, a) {
    a.ok = true; B.x = a.c.x; B.y = a.c.y; B.z = a.c.z;
    launchPass(p, a); touched();
  }
  function resolveRise(p, a) {
    const fb = fwd(a.bodyFace);
    const d = dist2(B.x, B.z, p.x + fb.x * 0.7, p.z + fb.z * 0.7);
    if (B.mode === 'free' && d < 0.5 && B.y < 0.5) {
      a.ok = true; a.c = { x: B.x, y: 0.12, z: B.z };
      B.lastTouch = p.id; B.lastTeam = p.team; B.lastT = s.t;
      pathBall({ x: B.x, y: Math.max(B.y, 0.1), z: B.z }, { x: p.x + fb.x * 0.4 + rgt(a.bodyFace).x * 0.22, y: 1.02, z: p.z + fb.z * 0.4 + rgt(a.bodyFace).z * 0.22 }, 0.4);
      B.pathOwner = p.id; B.riseBy = p.id; B.riseEnd = s.t + 0.4;
      ev('rise', { by: p.id, team: p.team });
      touched();
    } else { a.ok = false; ev('whiff', { by: p.id }); }
  }
  function blockWindow(p, a) {
    // stick volume in front of the player: knocks down a ball in flight
    if (B.mode !== 'free' || B.dead || a.blocked) return;
    if (B.lastTouch === p.id && s.t - B.lastT < 0.3) return;
    const fb = fwd(a.bodyFace);
    const gk = p.role === 0;
    const vx = a.variant === 'dive' ? a.stance.x : p.x + fb.x * HOOK_ARM, vz = a.variant === 'dive' ? a.stance.z : p.z + fb.z * HOOK_ARM;
    const rr = gk ? KEEPER_REACH : HOOK_REACH;
    if (dist2(B.x, B.z, vx, vz) > rr || B.y > (gk ? 2.7 : 2.4) || B.y < 0.05) return;
    if (a.variant !== 'dive' && dist2(B.x, B.z, p.x, p.z) < 0.55) return;      // a ball inside the player's own body cannot be met with the stick
    if (B.vx * B.vx + B.vy * B.vy + B.vz * B.vz < 4) return;
    const sp = Math.hypot(B.vx, B.vy, B.vz);
    const pb = clamp(0.55 + 0.42 * skillOf(p) - sp * 0.006 + (p.human ? 0.12 : 0), 0.15, 0.96);
    a.blocked = true;
    if (R.chance(pb)) {
      const away = p.team === 0 ? 1 : -1;
      B.vx = R.range(-3, 3); B.vz = away * R.range(1.2, 4.5); B.vy = 1.5 + R.range(0, 2);
      B.lastTouch = p.id; B.lastTeam = p.team; B.lastT = s.t; B.intended = -1;
      if (B.shotBy >= 0 && B.shotBy !== p.team) s.stats[p.team].saves += gk ? 1 : 0;
      B.shotBy = -1;
      ev('block', { by: p.id, team: p.team, gk });
    }
  }
  function resolveHook(p, a) {
    a.ok = false;
    // block-down: the ball is on its way up to a rival's strike and this stick gets there first
    if (B.mode === 'path' && B.pathOwner >= 0 && P[B.pathOwner].team !== p.team && P[B.pathOwner].act && P[B.pathOwner].act.ok === null && dist2(B.x, B.z, p.x + fwd(a.bodyFace).x * HOOK_ARM, p.z + fwd(a.bodyFace).z * HOOK_ARM) < 1.15 && B.y < 2.0) {
      const o = P[B.pathOwner];
      const pb = clamp(0.35 + 0.4 * skillOf(p) - 0.2 * skillOf(o) + (p.human ? 0.15 : 0), 0.1, 0.85);
      if (R.chance(pb)) {
        o.act.ok = false; o.act.blockedDown = true;
        B.mode = 'free'; B.path = null; B.vx = R.range(-2, 2); B.vz = R.range(-2, 2); B.vy = 1.5; B.lastTouch = p.id; B.lastTeam = p.team; B.lastT = s.t; B.intended = -1;
        a.ok = true; s.stats[p.team].hooks++;
        ev('blockdown', { by: p.id, victim: o.id, team: p.team });
        touched();
        return;
      }
    }
    const h = holder();
    // hook: an opposing solo carrier whose ball is up in the air within reach
    if (h && h.team !== p.team && B.hs === 'bal') {
      const bp = ballOnCarrier(h, s.t);
      const fbx = fwd(a.bodyFace);
      const reach = dist2(bp.x, bp.z, p.x + fbx.x * HOOK_ARM, p.z + fbx.z * HOOK_ARM);
      const win = carrierExposed(h, s.t) && h.burstT <= 0;
      if (win && reach < HOOK_REACH && B.y < 1.75) {
        a.ok = true; a.c = { x: B.x, y: B.y, z: B.z };
        const away = fwd(a.bodyFace);
        loseBall(h, { x: away.x * 4 + R.range(-1, 1), z: away.z * 4 + R.range(-1, 1) });
        B.vy = 3;
        B.lastTouch = p.id; B.lastTeam = p.team; B.lastT = s.t;
        h.stun = 0.3;
        s.stats[p.team].hooks++;
        ev('hook', { by: p.id, victim: h.id, team: p.team });
        touched();
        return;
      }
      if (dist2(h.x, h.z, p.x, p.z) < 1.1 && !win && R.chance(FOUL_HOOK_P)) { foul(p, 'high stick', h); return; }
    }
    // shoulder: clean side-on contact with a player near the ball
    const near = nearestOpp(p, SHOULDER_REACH);
    if (near && !a.blocked) {
      const legal = B.holder === near.id || dist2(near.x, near.z, B.x, B.z) < 3.2;
      if (!legal) { foul(p, 'shoulder away from the ball', near); return; }
      const dx = near.x - p.x, dz = near.z - p.z, d = Math.hypot(dx, dz) || 1;
      near.vx += dx / d * 3.2; near.vz += dz / d * 3.2; near.stun = 0.4; p.vx -= dx / d * 0.8; p.vz -= dz / d * 0.8;
      a.ok = true; a.shoulder = near.id;
      if (B.holder === near.id) {
        const str = 0.42 + 0.25 * (lvlOf(p).skill - lvlOf(near).skill) + (p.human ? 0.1 : 0);
        if (B.hs === 'hand' || R.chance(str)) { loseBall(near, { x: dx / d * 3, z: dz / d * 3 }); B.lastTouch = p.id; B.lastTeam = p.team; B.lastT = s.t; s.stats[p.team].hooks++; ev('shoulder', { by: p.id, victim: near.id, won: true }); touched(); }
        else ev('shoulder', { by: p.id, victim: near.id, won: false });
      } else ev('shoulder', { by: p.id, victim: near.id, won: false });
    }
  }
  function nearestOpp(p, r) {
    let best = null, bd = r;
    for (const q of P) { if (q.team === p.team) continue; const d = dist2(q.x, q.z, p.x, p.z); if (d < bd) { bd = d; best = q; } }
    return best;
  }

  function finishRise() {
    if (B.mode === 'path' && B.riseBy != null && B.riseBy >= 0 && s.t >= B.riseEnd - 1e-9) {
      const p = P[B.riseBy]; B.riseBy = -1;
      giveBall(p, 'hand');
    }
    if (B.mode === 'path' && B.path && s.t >= B.path.t0 + B.path.T && B.riseBy < 0 && !(P[B.pathOwner]?.act)) {
      // a toss whose action ended without contact: drop the ball
      B.mode = 'free'; B.path = null;
    }
  }

  function half() {
    // end of half
    ev('halfEnd', { half: s.half });
    if (s.half >= s.cfg.halves) {
      s.over = true; s.phase = 'over';
      const a = s.score[0].g * 3 + s.score[0].p, b = s.score[1].g * 3 + s.score[1].p;
      s.winner = a > b ? 0 : b > a ? 1 : -1;
      ev('matchEnd', { winner: s.winner });
    } else {
      s.half++; s.clock = 0; s.phase = 'halftime'; s.phaseT = 0; s.restart = null;
    }
  }

  function update(dt = DT) {
    if (s.over) return;
    if (s.hold) return;
    s.t += dt; s.phaseT += dt;
    if (s.phase === 'ready') {
      if (!s.started) { s.started = true; formation(true); }
      for (const p of P) { aiTick(api, p, dt, true); }
      stepPlayers(dt);
      if (s.phaseT > (cfg.readyT ?? 2.2)) { s.phase = 'play'; s.phaseT = 0; B.vy = 6.5; B.mode = 'free'; ev('throwin'); }
      stepBall(dt);
      return;
    }
    if (s.phase === 'halftime') { if (s.phaseT > 3) { formation(true); s.phase = 'ready'; s.phaseT = 0; } return; }
    if (s.phase === 'dead') {
      stepPlayers(dt); stepBall(dt);
      if (s.phaseT > 2.4) { startRestart(s.deadNext); s.deadNext = null; }
      return;
    }
    if (s.phase === 'play' || s.phase === 'restart') {
      s.clock += dt;
      if (s.clock >= s.cfg.halfSec && !s.cfg.drill) { half(); return; }
    }
    if (s.phase === 'restart') {
      s.restart.t += dt;
      if (s.restart.t > RESTART_MAX_SEC) endRestart();
    }
    if (s.holdCool > 0) s.holdCool -= dt;
    stepPlayers(dt);
    resolveActs();
    stepBall(dt);
    finishRise();
    resolveActs();
    interactions(dt);
    if (s.phase === 'play') checkBounds();
    if (s.cfg.drill && s.drillTick) s.drillTick(dt);
  }

  // ---- hold (Watch & Learn): the AI asks to freeze at a decision ------------------------------------------------------
  function requestHold(p, decision) {
    if (!s.cfg.hold || s.hold || s.holdCool > 0) return false;
    s.holdCool = 5.5;
    s.hold = { id: s.evId++, team: p.team, who: p.id, decision };
    return true;
  }
  const release = () => { s.hold = null; };

  const api = {
    s, B, P, R, A, DT, lvlOf, skillOf, speedOf, dist2, predictFree, hasBall, holder, ballOnCarrier, carrierExposed, loosePick,
    startStrike, startPass, startRise, startHook, startBurst, passTarget, barQuality, requestHold, ev, canAct, foul, solveSpeed,
    update, release, giveBall,
    input(i) { Object.assign(s.input, i); },
    suggest: (p) => decideFor(api, p, true),
    set humanId(v) { s.cfg.human = v; },
    formation, startRestart,
  };
  if (cfg.resume) {
    const r = cfg.resume;
    s.half = r.half; s.clock = r.clock; s.score = r.score.map((x) => ({ ...x })); s.stats = r.stats ? r.stats.map((x) => ({ ...x })) : s.stats;
  }
  return api;
}

export const BALL_VIS_R = 0.13;      // radius drawn on screen (about twice the physical sliotar so it reads on a phone)
export { SMALL_D, LINE_13 };
