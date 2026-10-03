// The match: a six-a-side kick-and-mark ball game on an oval. Pure and deterministic (fixed 1/60 s step, seeded streams, no clock).
// The simulation owns every position, contact time and outcome; the 3D presenter only reads s.players / s.ball / s.events.
import * as K from './consts.js';
import { clamp, hyp, normal, wrapAngle, lerp } from './util.js';
import { GOAL_SIGMA, dirOf, goalZ, inside, clampPitch, exitPoint, faceVec, yawOf, jumpH, kickSolve, kickSigma, pressureOf, nearestOpp, predictBall } from './model.js';
import { aiStep, chooseDisposal, hintFor, positionTarget, setshotChoice, landing } from './ai.js';
import { createDrill, DRILL_ROLE } from './drills.js';

const { HW, HL, ZG, GHW, BHW, G, BR, ATTR, SLOT_ROLE, ROLE_SLOT, JOG, SPRINT, ACCEL } = K;
const TAU = Math.PI * 2;

const mkStats = () => ({ marks: 0, tackles: 0, kicks: 0, handballs: 0, goalKicks: 0, contested: 0, frees: 0 });

export function createSim(cfg, rootRng) {
  const rngB = rootRng.fork(), rngM = rootRng.fork(), rngK = rootRng.fork(), rngA = rootRng.fork();
  const quarters = cfg.mode === 'quick' ? 2 : 4;
  const humanRole = cfg.drill ? DRILL_ROLE[cfg.drill] : (cfg.humanRole || null);
  const humanSlot = humanRole ? ROLE_SLOT[humanRole] : -1;
  const lvP = (p) => p.ex.lvl || lv(p.team);
  const lv = (t) => K.LEVELS[clamp(((t === 0 ? cfg.levels[0] : cfg.levels[1]) || 3) - 1, 0, 4)];
  const s = {
    v: 1, t: 0, tick: 0, phase: 'dead', phaseT: 0, q: 0, quarters, clock: K.QUARTER, siren: false, sirenT: 0,
    score: [{ g: 0, b: 0 }, { g: 0, b: 0 }], qscore: [], stats: [mkStats(), mkStats()],
    teams: [{ name: cfg.names ? cfg.names[0] : 'Gold', human: !!humanRole, level: cfg.levels[0] }, { name: cfg.names ? cfg.names[1] : 'Green', human: false, level: cfg.levels[1] }],
    players: [], ball: null, events: [], evId: 1, set: null, contest: null, ballup: null, next: null, last: null, hold: null, holdAt: -99,
    cfg, humanId: humanSlot, over: false, winner: -1, think: null, poss: -1, lastPoss: 0, drill: cfg.drill || null,
  };
  s.ball = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, owner: -1, kind: 'none', kicker: -1, kteam: -1, kx: 0, kz: 0, bounced: false, touched: false, spin: 0, roll: 0, markable: false, lastTouch: -1, lastTeam: -1, free: false, heldT: 0, bounces: 0, claim: -1, kickT: -9, tgtId: -1 };
  for (let team = 0; team < 2; team++) for (let slot = 0; slot < 6; slot++) {
    const id = team * 6 + slot;
    s.players.push({ id, team, slot, role: SLOT_ROLE[slot], x: 0, z: 0, vx: 0, vz: 0, face: team === 0 ? 0 : Math.PI, stam: 1, st: 'free', act: null, jt: -1, jh: 0, spoil: false,
      human: team === 0 && slot === humanSlot && !cfg.bot, cool: { pick: 0, catch: 0, tackle: 0, jump: 0 }, hold: 0, goto: null, in: { mx: 0, mz: 0, sprint: false }, think: rngA.next() * 0.3, ex: {}, num: slot + 1, celeb: 0 });
  }
  const P = s.players, B = s.ball;
  if (cfg.bot && cfg.proxy && humanSlot >= 0) P[humanSlot].ex.lvl = K.HUMANLIKE;      // a computer stand-in with human-like reactions and aim (dev calibration)
  const S = { s, cfg, rngA, rngK, rngM, rngB, lv, lvP, humanSlot, K };
  let evSeen = 0; void evSeen;

  // ---------------------------------------------------------------------------------------- events
  function emit(type, o = {}) { const e = { ...o, pid: o.pid ?? o.id, id: s.evId++, type, t: s.t }; s.events.push(e); if (s.events.length > 160) s.events.splice(0, s.events.length - 160); return e; }
  S.emit = emit;
  const say = (text, team) => { s.last = { text, team, t: s.t }; };
  const holder = () => (B.owner >= 0 ? P[B.owner] : null);

  // ---------------------------------------------------------------------------------------- positions and restarts
  function placeFormation(bx, bz, contest) {
    // contest: {0: playerId, 1: playerId} the two players who stand at the ball
    const go = (p, x, z) => { const q = { x, z }; clampPitch(q, 1.0); p.goto = q; };
    for (const p of P) {
      p.act = null; p.st = 'free'; p.jt = -1; p.jh = 0; p.celeb = 0;
      if (contest && contest[p.team] === p.id) { go(p, bx + (p.team === 0 ? -0.2 : 0.2), bz + (p.team === 0 ? -1.3 : 1.3) * (1)); continue; }
      const off = K.FORM[p.slot], sg = p.team === 0 ? 1 : -1;
      go(p, bx + off[0] * sg * (p.team === 0 ? 1 : 1), bz + off[1] * sg);
    }
    // keep the contest circle clear: anyone else nearer than 3 m is pushed out
    for (const p of P) { if (contest && contest[p.team] === p.id) continue; const d = hyp(p.goto.x - bx, p.goto.z - bz); if (d < 3.2) { const a = Math.atan2(p.goto.z - bz, p.goto.x - bx); p.goto.x = bx + Math.cos(a) * 3.4; p.goto.z = bz + Math.sin(a) * 3.4; clampPitch(p.goto, 1.0); } }
  }
  function snapToGoto(far = 1.2) { for (const p of P) if (p.goto && hyp(p.x - p.goto.x, p.z - p.goto.z) > far) { p.x = p.goto.x; p.z = p.goto.z; p.vx = p.vz = 0; } }
  function nearestTo(team, x, z, not = -1) { let b = null, bd = 1e9; for (const p of P) if (p.team === team && p.id !== not) { const d = hyp(p.x - x, p.z - z); if (d < bd) { bd = d; b = p; } } return b; }
  function startBallUp(x, z, why) {
    if (s.siren && why !== 'quarter' && !s.drill) { endQuarter(); return; }
    const q = { x, z }; clampPitch(q, 3.5);
    s.phase = 'ballup'; s.phaseT = 0; s.set = null; s.hold = null; s.contest = null;
    B.owner = -1; B.kind = 'none'; B.vx = B.vy = B.vz = 0; B.x = q.x; B.y = 1.1; B.z = q.z; B.touched = false; B.markable = false; B.bounced = false;
    const c0 = why === 'center' || why === 'quarter' ? P[0] : nearestTo(0, q.x, q.z), c1 = why === 'center' || why === 'quarter' ? P[6] : nearestTo(1, q.x, q.z);
    s.ballup = { x: q.x, z: q.z, why, c: [c0.id, c1.id], ready: false };
    placeFormation(q.x, q.z, s.ballup.c);
    if (why === 'quarter') snapToGoto(0.1);
    else snapToGoto(14);
    emit('ballup', { x: q.x, z: q.z, why });
  }
  function doBounce() {
    const u = s.ballup;
    const centre = u.why === 'center' || u.why === 'quarter';
    B.x = u.x; B.z = u.z; B.y = centre ? BR + 0.02 : 1.2; B.vx = (rngB.next() - 0.5) * 1.2; B.vz = (rngB.next() - 0.5) * 1.2; B.vy = centre ? 10.8 : 9.0;      // the umpire bounces it at the centre, throws it up elsewhere
    B.kind = 'ballup'; B.markable = false; B.touched = false; B.bounced = false; B.owner = -1; B.kicker = -1; B.lastTeam = -1;
    s.phase = 'play'; s.phaseT = 0; s.contest = null;
    emit('bounce', { x: u.x, z: u.z, centre });
  }
  function startSetShot(kind, p, x, z, o = {}) {
    if (s.siren && !s.drill) { if (s.sirenShots >= 1) { endQuarter(); return; } s.sirenShots = (s.sirenShots | 0) + 1; }
    // kind: 'mark' | 'free' | 'kickin'. p takes the ball standing at (x,z).
    const q = { x, z }; clampPitch(q, 0.8);
    s.phase = 'setshot'; s.phaseT = 0; s.contest = null; s.hold = null;
    for (const o2 of P) { if (o2 === p && o2.act && o2.act.kind === 'jump') continue; if (o2.act && o2.act.kind !== 'celebrate') { o2.act = null; if (o2.st === 'tackled' || o2.st === 'tackling' || o2.st === 'stagger') o2.st = 'free'; } o2.jt = -1; o2.jh = 0; }
    p.x = q.x; p.z = q.z; p.vx = p.vz = 0;
    B.owner = p.id; B.vx = B.vy = B.vz = 0; B.kind = 'held'; B.markable = false; B.touched = false; B.bounced = false; B.free = false; B.heldT = 0;
    p.hold = 0;
    s.set = { kind, id: p.id, team: p.team, x: q.x, z: q.z, t0: s.t, taken: false, meter: 1.125, mq: -1, why: o.why || '', limit: p.human ? 14 : 5 };
    s.set.aiDelay = p.human ? 0 : 1.0 + (1 - lvP(p).react) * 2.2 + rngA.next() * 0.8;
    // opponents stand back
    emit('setshot', { kind, id: p.id, team: p.team, x: q.x, z: q.z });
  }
  S.startSetShot = startSetShot;

  function startQuarter() {
    s.clock = K.QUARTER; s.siren = false; s.sirenT = 0; s.sirenShots = 0; s.set = null;
    startBallUp(0, 0, s.q === 0 ? 'quarter' : 'quarter');
    for (const p of P) { p.stam = 1; p.vx = p.vz = 0; p.face = p.team === 0 ? 0 : Math.PI; }
    emit('quarterStart', { q: s.q });
  }
  function endQuarter() {
    s.qscore.push([{ ...s.score[0] }, { ...s.score[1] }]);
    emit('quarterEnd', { q: s.q });
    if (s.q + 1 >= quarters) {
      s.phase = 'over'; s.over = true;
      const a = pts(0), b = pts(1); s.winner = a > b ? 0 : b > a ? 1 : -1;
      emit('matchEnd', { winner: s.winner });
    } else { s.phase = 'break'; s.phaseT = 0; for (const p of P) { p.act = null; p.st = 'free'; p.in = { mx: 0, mz: 0, sprint: false }; } }
  }
  const pts = (t) => s.score[t].g * K.GOAL_PTS + s.score[t].b * K.BEHIND_PTS;
  S.pts = pts;
  S.nextQuarter = () => { if (s.phase !== 'break') return; s.q++; startQuarter(); };

  // ---------------------------------------------------------------------------------------- the ball
  function setOwner(p, how) {
    B.owner = p.id; B.vx = B.vy = B.vz = 0; B.heldT = 0; B.free = false; B.lastTouch = p.id; B.lastTeam = p.team; B.kind = 'held'; B.markable = false; B.bounced = false;
    p.hold = 0;
    if (s.poss !== p.team) { s.poss = p.team; }
    emit('hold', { id: p.id, team: p.team, how });
  }
  function carryPos(p) { const f = faceVec(p); return { x: p.x + f.x * 0.5, y: 1.25, z: p.z + f.z * 0.5 }; }
  const rightOf = (p) => ({ x: -Math.cos(p.face), z: Math.sin(p.face) });   // character right in the world
  const leftOf = (p) => ({ x: Math.cos(p.face), z: -Math.sin(p.face) });
  S.rightOf = rightOf; S.leftOf = leftOf;
  function kickPoint(p) { const f = faceVec(p), r = rightOf(p); return { x: p.x + f.x * K.KP.f + r.x * K.KP.s, y: K.KP.y, z: p.z + f.z * K.KP.f + r.z * K.KP.s }; }
  function handPoint(p) { const f = faceVec(p), l = leftOf(p); return { x: p.x + f.x * K.HP.f + l.x * K.HP.s, y: K.HP.y, z: p.z + f.z * K.HP.f + l.z * K.HP.s }; }
  S.kickPoint = kickPoint; S.handPoint = handPoint;

  function launch(vx, vy, vz, kind, p) {
    B.vx = vx; B.vy = vy; B.vz = vz; B.owner = -1; B.kind = kind; B.kicker = p.id; B.kteam = p.team; B.kx = B.x; B.kz = B.z; B.bounced = false; B.touched = false; B.markable = false; B.bounces = 0;
    B.lastTouch = p.id; B.lastTeam = p.team; B.free = false;
    p.cool.catch = 0.35;
  }

  function ballPhysics(dt) {
    if (B.owner >= 0) {
      const p = P[B.owner]; let c = carryPos(p); const a = p.act;
      if (a && a.kind === 'kick' && !a.released) { const f = faceVec(p), r = rightOf(p), k = clamp((s.t - a.t0) / Math.max(0.01, a.tr - a.t0), 0, 1); const d = { x: p.x + f.x * K.KP.f + r.x * K.KP.s, y: a.yr, z: p.z + f.z * K.KP.f + r.z * K.KP.s }; c = { x: lerp(c.x, d.x, k), y: lerp(c.y, d.y, k), z: lerp(c.z, d.z, k) }; }
      else if (a && a.kind === 'handball' && !a.fired) { const hp = handPoint(p), k = clamp((s.t - a.t0) / 0.08, 0, 1); c = { x: lerp(c.x, hp.x, k), y: lerp(c.y, hp.y, k), z: lerp(c.z, hp.z, k) }; }
      B.x = c.x; B.y = c.y; B.z = c.z; B.vx = p.vx; B.vz = p.vz; B.vy = 0; B.heldT += dt; return;
    }
    if (B.kind === 'held' || B.kind === 'umpire') return;
    if (B.claim >= 0) {                                   // being scooped up: the ball is drawn into the gatherer's hands
      const p = P[B.claim], f = faceVec(p), k = 0.3;
      B.vx *= 0.7; B.vz *= 0.7; B.vy = 0;
      B.x += (p.x + f.x * 0.34 + p.vx * 0.08 - B.x) * k; B.z += (p.z + f.z * 0.34 + p.vz * 0.08 - B.z) * k; B.y += (0.3 - B.y) * k;
      return;
    }
    B.vy -= G * dt;
    B.x += B.vx * dt; B.y += B.vy * dt; B.z += B.vz * dt;
    const sp = hyp(B.vx, B.vz);
    if (B.y > BR + 0.05) { const k = 1 - 0.035 * dt * sp / 10; B.vx *= k; B.vz *= k; B.spin += dt * (4 + sp * 0.7); }
    else B.spin += dt * sp * 1.6;
    if (B.y <= BR) {
      B.y = BR;
      if (B.vy < -1.6) {
        // an oval ball bounces oddly: lower and sideways by a random amount
        B.bounced = true; B.bounces++;
        B.vy = -B.vy * (0.34 + rngB.next() * 0.2);
        const dev = (rngB.next() - 0.5) * 1.0;                       // radians of sideways kick
        const c = Math.cos(dev), sn = Math.sin(dev), k = 0.72 + rngB.next() * 0.14;
        const vx = B.vx * c - B.vz * sn, vz = B.vx * sn + B.vz * c;
        B.vx = vx * k; B.vz = vz * k;
        emit('bounceBall', { x: B.x, z: B.z, v: -B.vy });
      } else {
        B.vy = 0; B.bounced = true;
        const sp2 = hyp(B.vx, B.vz);
        if (sp2 > 0) { const dec = Math.min(sp2, (1.6 + 0.9 * (sp2 > 4 ? 1 : 0)) * dt); B.vx -= B.vx / sp2 * dec; B.vz -= B.vz / sp2 * dec; }
        if (sp2 < 0.25) { B.vx = B.vz = 0; }
      }
    }
  }

  // ---------------------------------------------------------------------------------------- scoring and boundary
  let prevB = { x: 0, y: 1, z: 0 };
  function scoreEvent(kind, team, xc, o = {}) {
    if (kind === 'goal') s.score[team].g++; else s.score[team].b++;
    s.stats[team][kind === 'goal' ? 'goalKicks' : 'goalKicks'] += 0;
    const name = s.teams[team].name;
    say(kind === 'goal' ? `GOAL! ${name}` : `Behind. ${name}`, team);
    emit(kind, { team, x: xc, z: B.z, by: B.lastTeam === team ? B.lastTouch : -1, touched: !!B.touched });
    B.owner = -1; B.vx *= 0.2; B.vz *= 0.2;
    s.phase = 'dead'; s.phaseT = 0; s.set = null; s.contest = null;
    for (const p of P) { if (p.act && p.act.kind !== 'celebrate') p.act = null; if (p.st !== 'free') p.st = 'free'; p.jt = -1; p.jh = 0; p.celeb = 0; }
    if (kind === 'goal') {
      s.next = { type: 'ballup', x: 0, z: 0, why: 'center' };
    } else {
      const other = 1 - team, sgn = dirOf(team);
      s.next = { type: 'kickin', team: other, x: 0, z: sgn * (ZG - 6.5) };
    }
    for (const p of P) { p.goto = null; }
    afterScoreGoto();
    if (kind === 'goal') for (const p of P) if (p.team === team) p.celeb = 1;       // after the restart formation is planned (it clears everything): the scoring team celebrates where it stands
    if (s.siren) { /* the quarter ends after the score */ }
  }
  function afterScoreGoto() {
    const n = s.next;
    if (n.type === 'ballup') placeFormation(0, 0, [0, 6]);
    else {
      // kick-in: the defending side's back takes it from the goal square, the others spread up the ground
      const sgn = -dirOf(n.team);                                 // z-direction away from the goal that was attacked
      for (const p of P) {
        const own = p.team === n.team, off = K.FORM[p.slot];
        const bz = n.z * 1, up = -Math.sign(n.z);                 // up = towards the centre
        if (own && p.slot === 5) p.goto = { x: 0, z: n.z };
        else { const sgT = p.team === 0 ? 1 : -1, q = { x: sgT * off[0] * (own ? 0.8 : 0.9), z: bz + up * (own ? 12 + Math.abs(off[1]) * 0.4 + p.slot * 2 : 20 + p.slot * 2) }; clampPitch(q, 1.5); p.goto = q; }
      }
      void sgn;
    }
  }
  function outOfBounds(ex) {
    const full = B.kind === 'kick' && !B.bounced && !B.touched && B.kteam >= 0;
    const q = { x: ex.x * 0.92, z: ex.z * 0.92 };
    // nudge in by ~2.5 m along the inward normal
    const nx = ex.x / (HW * HW), nz = ex.z / (HL * HL), nl = hyp(nx, nz) || 1;
    q.x = ex.x - (nx / nl) * 2.4; q.z = ex.z - (nz / nl) * 2.4;
    clampPitch(q, 2.0);
    B.vx = B.vy = B.vz = 0; B.owner = -1; B.x = q.x; B.z = q.z; B.y = 1;
    if (full) {
      const team = 1 - B.kteam;
      const taker = nearestTo(team, q.x, q.z);
      say('Out on the full: free kick', team); emit('out', { full: true, x: q.x, z: q.z, team });
      s.stats[team].frees++;
      startSetShot('free', taker, q.x, q.z, { why: 'out on the full' });
    } else {
      say('Out of bounds: ball-up', -1); emit('out', { full: false, x: q.x, z: q.z, team: -1 });
      startBallUp(q.x, q.z, 'out');
    }
  }
  function boundaryAndGoals() {
    if (B.owner >= 0 || B.kind === 'held' || B.kind === 'none') { prevB = { x: B.x, y: B.y, z: B.z }; return; }
    // goal line crossing
    for (const sg of [1, -1]) {
      const zl = sg * ZG;
      if ((prevB.z - zl) * sg < 0 && (B.z - zl) * sg >= 0) {
        const f = (zl - prevB.z) / ((B.z - prevB.z) || 1e-9), xc = prevB.x + (B.x - prevB.x) * f;
        const att = sg === 1 ? 0 : 1;                       // the team that attacks this end
        if (Math.abs(xc) < GHW) { scoreEvent(B.lastTeam === att && !B.touched ? 'goal' : 'behind', att, xc); return; }
        if (Math.abs(xc) < BHW) { scoreEvent('behind', att, xc); return; }
      }
    }
    if (!inside(B.x, B.z, 0)) { const ex = exitPoint(prevB.x, prevB.z, B.x, B.z); outOfBounds(ex); return; }
    prevB = { x: B.x, y: B.y, z: B.z };
  }

  // ---------------------------------------------------------------------------------------- catches, marks, spoils
  const catchR = (p) => K.ARM;
  function canCatch(p) {
    if (p.cool.catch > 0) return false;
    if (p.st !== 'free' && p.st !== 'jump') return false;
    if (p.act && p.act.kind !== 'jump' && p.act.kind !== 'celebrate') return false;
    return true;
  }
  // the ball is in front of the chest, within easy reach of both palms (the 3D bodies can put both palms exactly on it): checked when the contest opens AND again when it resolves
  function inEasyReach(p, ballup, slack = 0, back = 0) {
    const f = faceVec(p), sx = p.x + f.x * 0.1, sz = p.z + f.z * 0.1, sy = K.SHOULDER + p.jh;
    const d = Math.sqrt((B.x - sx) * (B.x - sx) + (B.z - sz) * (B.z - sz) + (B.y - sy) * (B.y - sy));
    const fw = (B.x - sx) * f.x + (B.z - sz) * f.z, lt = (B.x - sx) * f.z - (B.z - sz) * f.x;
    return d <= K.ARM * 0.74 + (ballup ? 0.2 : 0) + slack && (ballup || (fw > 0.26 - slack - back && fw < 0.56 + slack && Math.abs(lt) < 0.32 + slack && B.y - sy < 0.42 && B.y - sy > -0.72 && !(B.y - sy > 0.2 && Math.hypot(fw, lt) < 0.22)));
  }
  // A catch resolves a few ticks after the contest opened, and a fast ball has moved on. If the ball is only a little outside the easy-reach zone, the catch point is nudged
  // (at most 0.4 m) onto the nearest point inside it, so the palms still meet the ball exactly; further out, the catcher does not get it.
  function snapIntoReach(p, ballup) {
    if (inEasyReach(p, ballup)) return true;
    if (ballup) return false;
    const f = faceVec(p), sx = p.x + f.x * 0.1, sz = p.z + f.z * 0.1, sy = K.SHOULDER + p.jh;
    let fw = (B.x - sx) * f.x + (B.z - sz) * f.z, lt = (B.x - sx) * f.z - (B.z - sz) * f.x, dy = B.y - sy;
    const o = { fw, lt, dy };
    fw = clamp(fw, 0.3, 0.4); lt = clamp(lt, -0.2, 0.2); dy = clamp(dy, -0.5, 0.2);
    const r = Math.hypot(fw, lt, dy), lim = K.ARM * 0.6; if (r > lim) { const k = lim / r; fw *= k; lt *= k; dy *= k; }
    if (Math.hypot(fw - o.fw, lt - o.lt, dy - o.dy) > 0.3) return false;
    const nx = sx + f.x * fw + f.z * lt, nz = sz + f.z * fw - f.x * lt, ny = sy + dy;
    const ox = B.x, oy = B.y, oz = B.z; B.x = nx; B.y = ny; B.z = nz;
    if (!inEasyReach(p, false)) { B.x = ox; B.y = oy; B.z = oz; return false; }
    return true;
  }
  function candidates() {
    const out = [];
    const ballup = B.kind === 'ballup';
    for (const p of P) {
      if (!canCatch(p)) continue;
      // the ball must be inside the sphere the arms can really reach from the shoulders (so the picture can put the hands on it exactly)
      const f = faceVec(p), sx = p.x + f.x * 0.1, sz = p.z + f.z * 0.1, sy = K.SHOULDER + p.jh;
      const d = Math.sqrt((B.x - sx) * (B.x - sx) + (B.z - sz) * (B.z - sz) + (B.y - sy) * (B.y - sy));
      if (B.y < (ballup ? 1.4 : 0.8)) continue;
      const fw = (B.x - sx) * f.x + (B.z - sz) * f.z, lt = (B.x - sx) * f.z - (B.z - sz) * f.x;           // ball in front of the chest, within easy reach of both palms
      if (d <= K.ARM * 0.74 + (ballup ? 0.2 : 0) && (ballup || (fw > 0.08 && fw < 0.56 && Math.abs(lt) < 0.32 && B.y - sy < 0.42 && B.y - sy > -0.72 && !(B.y - sy > 0.2 && Math.hypot(fw, lt) < 0.22)))) out.push({ p, d: Math.hypot(B.x - sx, B.z - sz) });
    }
    return out;
  }
  function markScore(c) {
    const p = c.p, human = p.human, L = lvP(p);
    const skill = human ? 0.72 : L.mark;
    const tb = p.jt >= 0 ? clamp(1 - Math.abs(p.jt - K.JUMP_APEX) / 0.28, 0, 1) : 0.35;
    const reach = clamp(1 - c.d / catchR(p), 0, 1);
    return reach * 0.4 + skill * 0.28 + ATTR[p.slot].mark * 0.14 + tb * 0.16 + (rngM.next() - 0.5) * 0.18 + (p.act && p.act.kind === 'jump' ? 0.04 : 0);
  }
  function resolveContest() {
    const C = s.contest; s.contest = null;
    const list = C.c.filter((c) => canCatch(c.p) || c.p.act && c.p.act.kind === 'jump');
    if (!list.length) return;
    for (const c of list) c.sc = markScore(c);
    list.sort((a, b) => b.sc - a.sc);
    let win = list[0];
    const sp = list.find((c) => c.p.spoil && c.p.team !== (B.kteam >= 0 ? B.kteam : -2));
    if (sp && sp !== win && sp.sc >= win.sc - 0.28) win = sp;
    const p = win.p;
    if (B.kind === 'ballup') { doTap(p); return; }
    if (!(p.spoil && p.team !== B.kteam) && !snapIntoReach(p, false)) { if (s.t - C.t0 < 0.14) s.contest = C; return; }      // not yet (or no longer) in easy reach: keep the contest open a few more ticks
    { const f = faceVec(p), dd = Math.sqrt((B.x - p.x - f.x * 0.1) ** 2 + (B.z - p.z - f.z * 0.1) ** 2 + (B.y - K.SHOULDER - p.jh) ** 2); if (dd > K.ARM * 0.95 && !(p.spoil && p.team !== B.kteam)) { doFumble(p); return; } }
    if (p.spoil && p.team !== B.kteam) { doSpoil(p); return; }
    const fast = hyp(B.vx, B.vy, B.vz) > 21 ? 0.1 : 0;
    const pc = clamp(0.52 + 0.62 * win.sc - fast - (list.length > 1 ? 0.1 : 0), 0.15, 0.97);
    if (rngM.next() < pc) doCatch(p, list.length > 1); else doFumble(p);
  }
  function doCatch(p, contested) {
    const trav = hyp(B.x - B.kx, B.z - B.kz);
    const isMark = B.kind === 'kick' && !B.bounced && !B.touched && trav >= K.MARK_MIN && B.kteam >= 0;
    const ex = { x: B.x, y: B.y, z: B.z };
    p.act = null; p.st = 'free';
    if (isMark) {
      s.stats[p.team].marks++; if (contested) s.stats[p.team].contested++;
      B.owner = p.id; B.vx = B.vy = B.vz = 0; B.kind = 'held'; B.lastTouch = p.id; B.lastTeam = p.team;
      emit('mark', { id: p.id, team: p.team, jh: p.jh, x: p.x, z: p.z, bx: ex.x, by: ex.y, bz: ex.z, contested, from: B.kicker, dist: trav });
      say(`Mark! ${s.teams[p.team].name}`, p.team);
      if (p.team !== B.kteam || true) {
        const q = { x: p.x, z: p.z };
        const siren = s.siren; void siren;
        startSetShot('mark', p, q.x, q.z, { why: 'mark' });
      }
    } else {
      emit('catch', { id: p.id, team: p.team, jh: p.jh, bx: ex.x, by: ex.y, bz: ex.z, contested, kind: B.kind });
      setOwner(p, 'catch');
    }
  }
  function doFumble(p) {
    B.touched = true; B.vx *= 0.3; B.vz *= 0.3; B.vy = Math.min(B.vy, 0) * 0.3 - 0.5; B.lastTouch = p.id; B.lastTeam = p.team; B.kind = 'loose';
    B.vx += (rngM.next() - 0.5) * 2.2; B.vz += (rngM.next() - 0.5) * 2.2;
    p.cool.catch = 0.5;
    emit('fumble', { id: p.id, team: p.team, x: B.x, y: B.y, z: B.z });
  }
  function doSpoil(p) {
    B.touched = true; B.lastTouch = p.id; B.lastTeam = p.team; B.kind = 'loose';
    const a = Math.atan2(B.vz, B.vx) + (rngM.next() < 0.5 ? 1 : -1) * (1.2 + rngM.next() * 0.8);
    const spd = 4.5 + rngM.next() * 3;
    B.vx = Math.cos(a) * spd; B.vz = Math.sin(a) * spd; B.vy = 3 + rngM.next() * 2;
    p.cool.catch = 0.5; p.spoil = false;
    emit('spoil', { id: p.id, team: p.team, x: B.x, y: B.y, z: B.z });
  }
  function doTap(p) {
    // ruck hit-out: the ball is tapped towards a teammate (the human's stick direction, or the AI's best midfielder)
    let tx, tz;
    if (p.ex.tapTo !== undefined && p.ex.tapTo >= 0) { const m = P[p.ex.tapTo], dx = m.x - B.x, dz = m.z - B.z, dl = hyp(dx, dz) || 1; tx = dx / dl; tz = dz / dl; }
    else if (p.human && (hyp(p.in.mx, p.in.mz) > 0.3)) { const m = hyp(p.in.mx, p.in.mz); tx = p.in.mx / m; tz = p.in.mz / m; }
    else {
      let best = null, bs = -1e9;
      for (const m of P) if (m.team === p.team && m.id !== p.id) { const d = hyp(m.x - B.x, m.z - B.z); const sc = (m.role === 'mid' ? 2 : 0) - Math.abs(d - 9) * 0.12 - nearestOpp(P, m, p.team).d * -0.05; if (sc > bs) { bs = sc; best = m; } }
      const dx = best.x - B.x, dz = best.z - B.z, dl = hyp(dx, dz) || 1; tx = dx / dl; tz = dz / dl;
    }
    const L = lvP(p), acc = p.human ? 0.7 : L.aim; let e = normal(rngM) * (1.15 - acc) * 0.35; if (p.ex.perfect) e = 0;
    const c = Math.cos(e), sn = Math.sin(e), vx = tx * c - tz * sn, vz = tx * sn + tz * c;
    B.vx = vx * 8.5; B.vz = vz * 8.5; B.vy = 3.6; B.kind = 'tap'; B.touched = true; B.lastTouch = p.id; B.lastTeam = p.team; B.markable = false;
    p.cool.catch = 0.6;
    emit('tap', { id: p.id, team: p.team, x: B.x, y: B.y, z: B.z });
  }
  function catchTick() {
    if (B.owner >= 0 || B.kind === 'held' || B.kind === 'none') { s.contest = null; return; }
    if (B.y < 0.45 && B.kind !== 'ballup') return;
    const cs = candidates();
    if (cs.length || s.contest) {
      if (!s.contest) s.contest = { t0: s.t, c: [] };
      for (const c of cs) { const k = s.contest.c.find((x) => x.p === c.p); if (!k) s.contest.c.push(c); else if (c.d < k.d) k.d = c.d; }
      const bsp = Math.sqrt(B.vx * B.vx + B.vy * B.vy + B.vz * B.vz);
      const rivals = P.some((q) => q !== s.contest.c[0].p && s.contest.c.length && canCatch(q) && hyp(q.x - B.x, q.z - B.z) < 3.2 && !s.contest.c.some((c) => c.p === q) && q.team !== s.contest.c[0].p.team || q.team === s.contest.c[0].p.team && q !== s.contest.c[0].p && canCatch(q) && hyp(q.x - B.x, q.z - B.z) < 2.2);
      if (!rivals || s.t - s.contest.t0 >= Math.min(0.09, 0.5 / Math.max(bsp, 1))) resolveContest();      // a lone catcher takes it at once; with rivals about, wait a moment      // wait for rivals only while the ball has not travelled far
    }
  }
  function pickupTick() {
    if (B.owner >= 0 || B.kind === 'held' || B.kind === 'none' || B.y > 0.8 || B.claim >= 0) return;
    if (hyp(B.vx, B.vz) > 4.5) return;
    let best = null, bd = 0.85;
    for (const p of P) {
      if (p.cool.pick > 0 || p.st !== 'free' || (p.act && p.act.kind !== 'celebrate')) continue;
      if (p.id === B.kicker && s.t - (B.kickT || 0) < 0.5) continue;
      const d = hyp(p.x - B.x, p.z - B.z); if (d < bd) { bd = d; best = p; }
    }
    if (best) {
      best.act = { kind: 'gather', t0: s.t, tc: s.t + K.GATHER_LEN * 0.6, t1: s.t + K.GATHER_LEN }; best.st = 'gather'; B.claim = best.id; B.kind = 'loose';
      emit('act', { pid: best.id, kind: 'gather', t0: s.t, tc: s.t + K.GATHER_LEN * 0.6, t1: s.t + K.GATHER_LEN, x: B.x, z: B.z });
    }
  }

  // ---------------------------------------------------------------------------------------- targets (shared by the human's auto-aim and the AI)
  const leadPoint = (m, T) => { const q = { x: m.x + m.vx * T * 0.75, z: m.z + m.vz * T * 0.75 }; clampPitch(q, 1.0); return q; };
  S.leadPoint = leadPoint;
  // Candidate targets for a disposal by p: teammates (kick or handball) and the goal.
  function targetsFor(p, kind) {
    const out = [];
    const rng = kind === 'handball' ? [2.5, 11] : [8, 46];
    for (const m of P) {
      if (m.team !== p.team || m.id === p.id) continue;
      const d0 = hyp(m.x - p.x, m.z - p.z);
      const T = kind === 'handball' ? d0 / 12 : kickSolve(d0).T;
      const q = leadPoint(m, T), D = hyp(q.x - p.x, q.z - p.z);
      if (D < rng[0] || D > rng[1]) continue;
      out.push({ type: 'mate', id: m.id, x: q.x, z: q.z, D });
    }
    if (kind === 'kick') {
      const gz = goalZ(p.team), D = hyp(0 - p.x, gz - p.z);
      if (D <= 46 && (gz - p.z) * dirOf(p.team) > 1) out.push({ type: 'goal', id: -1, x: 0, z: gz, D });
    }
    return out;
  }
  S.targetsFor = targetsFor;
  // The human's auto-aim: the target best matching the aim direction (stick, else the way the player faces).
  function autoTarget(p, kind, ax, az) {
    let m = hyp(ax, az);
    if (m < 0.25) { const f = faceVec(p); ax = f.x; az = f.z; m = 1; } else { ax /= m; az /= m; }
    const cone = kind === 'handball' ? 1.0 : 0.62;
    let best = null, bs = 1e9;
    for (const t of targetsFor(p, kind)) {
      const dx = t.x - p.x, dz = t.z - p.z, dl = hyp(dx, dz) || 1;
      const ang = Math.acos(clamp((dx * ax + dz * az) / dl, -1, 1));
      if (ang > cone) continue;
      const sc = ang * (t.type === 'goal' ? 0.7 : 1) + t.D * 0.0025 + (nearestOpp(P, { x: t.x, z: t.z }, p.team, t.x, t.z).d < 3 ? 0.12 : 0);
      if (sc < bs) { bs = sc; best = t; }
    }
    if (best) return best;
    const D = kind === 'handball' ? 8 : 30, q = { x: p.x + ax * D, z: p.z + az * D };
    return { type: 'free', id: -1, x: q.x, z: q.z, D };
  }
  S.autoTarget = autoTarget;

  // ---------------------------------------------------------------------------------------- actions
  const busy = (p) => !!(p.act && p.act.kind !== 'celebrate') ;
  function startKick(p, tgt, snap = false) {
    if (B.owner !== p.id || busy(p)) return false;
    const underTackle = p.st === 'tackled';
    if (underTackle) return false;
    const f0 = { x: tgt.x - p.x, z: tgt.z - p.z }, D = hyp(f0.x, f0.z) || 1;
    const goal = tgt.type === 'goal';
    const sol = kickSolve(D, K.KP.y, goal ? 3.4 : 2.5);
    const L = lvP(p), aimSkill = p.human ? 0.74 : L.aim;
    const pr = pressureOf(P, p), moving = clamp(hyp(p.vx, p.vz) / SPRINT, 0, 1);
    let q = s.set && s.set.id === p.id ? s.set.mq : -1;
    let sig = kickSigma(aimSkill, D, pr, moving) * (goal ? GOAL_SIGMA : 1);
    if (q >= 0) sig *= (1.35 - q);                              // set-shot timing: 0 = worst, 1 = perfect
    else if (s.set && s.set.id === p.id) sig *= 0.9;
    let err = normal(rngK) * sig, rerr = 1 + normal(rngK) * 0.03 * (1 + pr) * (1.3 - aimSkill);
    if (p.ex.perfect) { err = 0; rerr = 1; }
    const wind = snap ? K.SNAP_WIND : K.KICK_WIND, yr = snap ? K.KP.yrSnap : K.KP.yr, Td = Math.sqrt(2 * (yr - K.KP.y) / G);
    const tr = s.t + Math.max(0.03, wind - Td);
    const lock = 0.55, vx = p.vx * lock, vz = p.vz * lock, sp = hyp(vx, vz), cap = sp > 2.6 ? 2.6 / sp : 1;
    p.act = { kind: 'kick', sub: snap ? 'snap' : 'punt', t0: s.t, tr, tc: s.t + wind, t1: s.t + wind + 0.38, vx: vx * cap, vz: vz * cap, yaw: yawOf(f0.x, f0.z) + err, speed: sol.speed * rerr, elev: sol.elev, tgtId: tgt.id, tgtType: tgt.type, tx: tgt.x, tz: tgt.z, D, released: false, yr, fired: false, setshot: !!(s.set && s.set.id === p.id) };
    p.st = 'kick';
    emit('act', { pid: p.id, kind: 'kick', sub: p.act.sub, t0: s.t, tr, tc: p.act.tc, t1: p.act.t1, yaw: p.act.yaw, tgt: tgt.type, tgtId: tgt.id, D, yr, setshot: p.act.setshot });
    return true;
  }
  S.startKick = startKick;
  function startHandball(p, tgt) {
    if (B.owner !== p.id || busy(p) && p.act.kind !== 'tackled') return false;
    const f0 = { x: tgt.x - p.x, z: tgt.z - p.z }, D = hyp(f0.x, f0.z) || 1;
    const under = p.st === 'tackled';
    const L = lvP(p), aimSkill = p.human ? 0.74 : L.aim, pr = under ? 1 : pressureOf(P, p);
    const sig = kickSigma(aimSkill, D, pr, 0) * 0.28 * (under ? 1.5 : 1);
    const err = normal(rngK) * sig;
    const lock = 0.5, vx = p.vx * lock, vz = p.vz * lock;
    const tackler = under ? P[p.act.by] : null;
    p.act = { kind: 'handball', t0: s.t, tc: s.t + K.HB_WIND, t1: s.t + K.HB_WIND + 0.3, vx, vz, yaw: yawOf(f0.x, f0.z) + err, D, tgtId: tgt.id, tx: tgt.x, tz: tgt.z, under, fired: false };
    p.st = 'handball';
    if (tackler) { tackler.act = { kind: 'wrapEnd', t0: s.t, t1: p.act.tc + 0.25 }; }
    emit('act', { pid: p.id, kind: 'handball', t0: s.t, tc: p.act.tc, t1: p.act.t1, yaw: p.act.yaw, tgtId: tgt.id, D, under });
    return true;
  }
  S.startHandball = startHandball;
  function startJump(p, spoil = false) {
    if (busy(p) && p.act.kind !== 'jump') return false;
    if (p.cool.jump > 0 || p.st !== 'free' || p.jt >= 0) return false;
    p.act = { kind: 'jump', t0: s.t, tc: s.t + K.JUMP_APEX, t1: s.t + K.JUMP_LEN, spoil };
    if (B.owner < 0 && B.kind !== 'ballup' && B.kind !== 'none' && B.kind !== 'held') {          // steer to the ball's line: the jump starts from where the hands can reach it
      const I = landing(S);
      if (I && hyp(I.x - p.x, I.z - p.z) < 4.5 && I.t < 1.1) p.act.assist = { x: I.x, z: I.z, t: s.t + Math.max(0.25, I.t) };
    }
    p.jt = 0; p.spoil = spoil; p.st = 'free';
    emit('act', { pid: p.id, kind: spoil ? 'spoil' : 'jump', t0: s.t, tc: s.t + K.JUMP_APEX, t1: s.t + K.JUMP_LEN });
    return true;
  }
  S.startJump = startJump;
  function tackleChance(p, c) {
    const L = lvP(p), skill = (p.human ? 0.62 : L.tackle) * ATTR[p.slot].tackle / 0.55;
    const toT = { x: p.x - c.x, z: p.z - c.z }, tl = hyp(toT.x, toT.z) || 1, f = faceVec(c);
    const dot = (toT.x * f.x + toT.z * f.z) / tl;              // +1: tackler in front of the carrier, -1: from behind
    let pr = 0.30 + 0.34 * skill - 0.17 * dot - 0.14 * (hyp(c.vx, c.vz) / SPRINT) + (p.human ? 0.1 : 0);
    if (tl < 1.0) pr += 0.08;
    return clamp(pr, 0.1, 0.93);
  }
  S.tackleChance = tackleChance;
  function startTackle(p, c) {
    if (s.phase !== 'play' || !c || B.owner !== c.id || c.team === p.team || busy(p) || p.cool.tackle > 0 || p.st !== 'free') return false;
    if (c.act && (c.act.kind === 'kick' || c.act.kind === 'handball')) return false;
    const d = hyp(c.x - p.x, c.z - p.z);
    if (d > 3.4) return false;
    const ok = rngM.next() < tackleChance(p, c);
    p.act = { kind: 'tackle', t0: s.t, tc: s.t + K.TACKLE_TC, t1: s.t + K.TACKLE_LEN, tgt: c.id, ok, wrapped: false };
    p.st = 'tackling'; p.cool.tackle = 1.1;
    emit('act', { pid: p.id, kind: 'tackle', t0: s.t, tc: p.act.tc, t1: p.act.t1, tgt: c.id, ok });
    return true;
  }
  S.startTackle = startTackle;
  function releaseTackle(c, free) {
    const t = c.act && c.act.kind === 'tackled' ? P[c.act.by] : null;
    c.act = null; c.st = 'free';
    if (t && (t.st === 'wrap' || t.act)) { if (t.act && t.act.kind === 'wrap') t.act = null; t.st = 'free'; }
    void free;
  }
  function updateActions(dt) {
    for (const p of (s.tick % 2 ? P : P.slice(6).concat(P.slice(0, 6)))) {
      for (const k in p.cool) if (p.cool[k] > 0) p.cool[k] -= dt;
      if (p.jt >= 0) { p.jt += dt; p.jh = jumpH(p); if (p.jt >= K.JUMP_LEN) { p.jt = -1; p.jh = 0; p.cool.jump = 0.35; p.spoil = false; if (p.act && p.act.kind === 'jump') { p.act = null; p.st = 'free'; } } }
      const a = p.act; if (!a) continue;
      if (a.kind === 'kick') {
        if (!a.released && s.t >= a.tr) {
          a.released = true; p.face = a.yaw; const c = carryPos(p); const f = faceVec(p), r = rightOf(p);
          // the ball leaves the hands at the right hip and falls to the foot: horizontal position fixed relative to the body
          B.owner = -1; B.kind = 'drop'; B.x = p.x + f.x * K.KP.f + r.x * K.KP.s; B.z = p.z + f.z * K.KP.f + r.z * K.KP.s; B.y = a.yr; B.vx = a.vx; B.vz = a.vz; B.vy = 0; void c;
          B.lastTouch = p.id; B.lastTeam = p.team; B.touched = false;
        }
        if (!a.fired && s.t >= a.tc) {
          a.fired = true;
          const kp = kickPoint(p); B.x = kp.x; B.y = kp.y; B.z = kp.z;
          const ce = Math.cos(a.elev), vx = Math.sin(a.yaw) * ce * a.speed, vz = Math.cos(a.yaw) * ce * a.speed, vy = Math.sin(a.elev) * a.speed;
          launch(vx, vy, vz, 'kick', p); B.kickT = s.t; B.spin = 0; B.tgtId = a.tgtId;
          { const lag = s.t - a.tc - dt; B.x = kp.x + vx * lag; B.y = kp.y + vy * lag; B.z = kp.z + vz * lag; }     // contact happened `lag` before this step: the ball is already that far along
          B.markable = true;
          s.stats[p.team].kicks++;
          emit('kick', { id: p.id, team: p.team, x: B.x, y: B.y, z: B.z, vx, vy, vz, tgt: a.tgtType, tgtId: a.tgtId, D: a.D, goal: a.tgtType === 'goal', setshot: a.setshot });
        }
        if (s.t >= a.t1) { p.act = null; p.st = 'free'; }
      } else if (a.kind === 'handball') {
        if (!a.fired && s.t >= a.tc) {
          a.fired = true; p.face = a.yaw; const hp = handPoint(p);
          B.x = hp.x; B.y = hp.y; B.z = hp.z;
          const T = Math.max(0.12, a.D / 12.5), vh = a.D / T;
          launch(Math.sin(a.yaw) * vh, (1.6 - hp.y + 0.5 * G * T * T) / T, Math.cos(a.yaw) * vh, 'handball', p); B.kickT = s.t; B.spin = 0; B.tgtId = a.tgtId;
          { const lag = s.t - a.tc - dt; B.x = hp.x + B.vx * lag; B.y = hp.y + B.vy * lag; B.z = hp.z + B.vz * lag; }
          s.stats[p.team].handballs++;
          if (a.under) releaseTackleAfterHandball(p);
          emit('handball', { id: p.id, team: p.team, x: B.x, y: B.y, z: B.z, tgtId: a.tgtId, D: a.D });
        }
        if (s.t >= a.t1) { p.act = null; if (p.st === 'handball') p.st = 'free'; }
      } else if (a.kind === 'tackle') {
        const c = P[a.tgt];
        if (!a.wrapped && s.t >= a.tc) {
          a.wrapped = true;
          const d = hyp(c.x - p.x, c.z - p.z);
          const stillHas = B.owner === c.id && !(c.act && c.act.kind === 'kick' && c.act.released);
          if (a.ok && d < 2.4 && stillHas && c.st !== 'tackled') {
            const ux = (c.x - p.x) / (d || 1), uz = (c.z - p.z) / (d || 1);
            p.x = c.x - ux * 0.9; p.z = c.z - uz * 0.9; p.vx = p.vz = 0; c.vx = c.vz = 0; { const q = { x: p.x, z: p.z }; clampPitch(q, 0.3); p.x = q.x; p.z = q.z; } p.face = yawOf(ux, uz);
            if (c.act && (c.act.kind === 'kick' || c.act.kind === 'handball') && !c.act.fired) { c.act = null; if (c.id === B.owner) { /* keeps the ball */ } }
            c.act = { kind: 'tackled', t0: s.t, t1: s.t + K.HOLD_UNDER_TACKLE, by: p.id }; c.st = 'tackled';
            p.act = { kind: 'wrap', t0: s.t, t1: s.t + K.HOLD_UNDER_TACKLE + 0.2, tgt: c.id }; p.st = 'wrap';
            s.stats[p.team].tackles++;
            emit('tackle', { id: p.id, team: p.team, tgt: c.id, x: c.x, z: c.z, t1: c.act.t1 });
          } else {
            p.act = { kind: 'stagger', t0: s.t, t1: s.t + 0.55 }; p.st = 'stagger';
            emit('tackleMiss', { id: p.id, team: p.team, tgt: c.id });
          }
        } else if (!a.wrapped) { /* lunge handled by movement */ }
      } else if (a.kind === 'wrap') {
        const c = P[a.tgt];
        if (!c.act || c.act.kind !== 'tackled') { p.act = { kind: 'stagger', t0: s.t, t1: s.t + 0.25 }; p.st = 'stagger'; }
      } else if (a.kind === 'wrapEnd') {
        if (s.t >= a.t1) { p.act = null; p.st = 'free'; }
      } else if (a.kind === 'tackled') {
        if (s.t >= a.t1 && B.owner === p.id) {
          // held ball: free kick to the tackler's team
          const t = P[a.by]; const x = p.x, z = p.z;
          p.act = null; p.st = 'free'; if (t.act) { t.act = null; } t.st = 'free';
          s.stats[t.team].frees++;
          say(`Held ball: free kick to ${s.teams[t.team].name}`, t.team); emit('heldBall', { team: t.team, id: t.id, x, z });
          startSetShot('free', t, x, z, { why: 'holding the ball' });
        } else if (s.t >= a.t1) { p.act = null; p.st = 'free'; }
      } else if (a.kind === 'gather') {
        if (s.t >= a.t1) {
          p.act = null; p.st = 'free'; B.claim = -1;
          if (B.owner < 0 && hyp(p.x - B.x, p.z - B.z) < 1.35 && B.y < 0.8) { setOwner(p, 'gather'); emit('gather', { id: p.id, team: p.team }); }
          else { p.cool.pick = 0.3; emit('fumble', { id: p.id, team: p.team, x: B.x, y: B.y, z: B.z }); }
        }
      } else if (a.kind === 'stagger') { if (s.t >= a.t1) { p.act = null; p.st = 'free'; } }
    }
  }
  function releaseTackleAfterHandball(p) { const t = p.act && p.act.kind === 'handball' ? null : null; void t; p.st = 'free'; }

  // ---------------------------------------------------------------------------------------- movement
  function movePlayers(dt) {
    for (const p of P) {
      const a = p.act, I = p.in, L = p.human ? 1 : lvP(p).speed;
      let mx = I.mx, mz = I.mz; const mm = hyp(mx, mz); if (mm > 1) { mx /= mm; mz /= mm; }
      const carrying = B.owner === p.id;
      const wantSprint = I.sprint && p.stam > 0.04 && mm > 0.2;
      const vmax = (wantSprint ? SPRINT : JOG) * ATTR[p.slot].speed * L * (carrying ? 0.94 : 1);
      let tvx = mx * vmax, tvz = mz * vmax, acc = ACCEL, faceTo = null, turn = 13, frozen = false;
      if (a) {
        switch (a.kind) {
          case 'kick': tvx = a.vx; tvz = a.vz; acc = 30; if (!a.released) faceTo = a.yaw; else frozen = true; turn = 18; break;
          case 'handball': tvx = a.vx; tvz = a.vz; acc = 30; if (!a.fired) faceTo = a.yaw; else frozen = true; turn = 18; break;
          case 'tackle': { const c = P[a.tgt]; const dx = c.x + c.vx * 0.12 - p.x, dz = c.z + c.vz * 0.12 - p.z, dl = hyp(dx, dz) || 1; const sp = 6.4 * (a.wrapped ? 0 : 1); tvx = dx / dl * sp; tvz = dz / dl * sp; faceTo = yawOf(dx, dz); acc = 40; turn = 18; break; }
          case 'tackled': case 'wrap': case 'wrapEnd': tvx = tvz = 0; acc = 45; frozen = a.kind !== 'wrapEnd'; break;
          case 'stagger': tvx = p.vx * 0.3; tvz = p.vz * 0.3; acc = 10; break;
          case 'gather': tvx *= 0.35; tvz *= 0.35; acc = 22; break;
          case 'jump': {
            tvx = p.vx * 0.985; tvz = p.vz * 0.985; acc = 3;
            if (a.assist && s.t < a.assist.t && s.t - a.t0 < 0.4) { const dx = a.assist.x - p.x, dz = a.assist.z - p.z, d = hyp(dx, dz), rem = Math.max(0.12, a.assist.t - s.t), v = Math.min(7.5, d / rem); if (d > 0.08) { tvx = dx / d * v; tvz = dz / d * v; acc = 30; } else { tvx = tvz = 0; acc = 30; } }
            break;
          }
          case 'celebrate': break;
          default: break;
        }
      }
      if (s.phase === 'setshot' && s.set && s.set.id === p.id && !a) { tvx = tvz = 0; acc = 40; }
      const dvx = tvx - p.vx, dvz = tvz - p.vz, dl = hyp(dvx, dvz), step = acc * dt;
      if (dl <= step) { p.vx = tvx; p.vz = tvz; } else { p.vx += dvx / dl * step; p.vz += dvz / dl * step; }
      p.x += p.vx * dt; p.z += p.vz * dt;
      clampPitch(p, 0.5);
      const sp = hyp(p.vx, p.vz);
      if (wantSprint && sp > JOG * 0.9) p.stam = Math.max(0, p.stam - 0.2 * dt); else p.stam = Math.min(1, p.stam + (sp < 1 ? 0.16 : 0.07) * dt);
      if (!frozen) {
        let want = faceTo;
        if (want === null && sp > 0.7 && (!a || a.kind === 'jump' || a.kind === 'gather')) want = yawOf(p.vx, p.vz);
        if (want === null && a === null && hyp(I.fx || 0, I.fz || 0) > 0.1) want = yawOf(I.fx, I.fz);
        if ((a === null || a.kind === 'jump') && B.owner < 0 && B.y > 0.7 && B.y < 3.4 && B.kind !== 'held' && B.kind !== 'none' && hyp(B.x - p.x, B.z - p.z) < 3.6 && (B.vx * (p.x - B.x) + B.vz * (p.z - B.z)) < 0 && p.st === 'free') { want = yawOf(B.x - p.x, B.z - p.z); turn = 18; }     // face the ball that is coming
        if (want !== null) { const d = wrapAngle(want - p.face), st = turn * dt; p.face = wrapAngle(p.face + (Math.abs(d) <= st ? d : Math.sign(d) * st)); }
      }
    }
    // soft separation: bodies do not overlap (a tackler and the player he holds stand together)
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const a = P[i], b = P[j];
      const paired = (a.act && (a.act.kind === 'wrap' && a.act.tgt === b.id || a.act.kind === 'tackle' && a.act.tgt === b.id)) || (b.act && (b.act.kind === 'wrap' && b.act.tgt === a.id || b.act.kind === 'tackle' && b.act.tgt === a.id));
      if (paired) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = hyp(dx, dz), m = 1.0;
      if (d < m && d > 1e-4) { const k = (m - d) / 2 / d; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k; }
    }
    for (const p of P) clampPitch(p, 0.5);
  }
  function gotoIntent(p, speedMul = 1) {
    const g = p.goto, I = p.in;
    if (!g) { I.mx = I.mz = 0; I.sprint = false; return; }
    const dx = g.x - p.x, dz = g.z - p.z, d = hyp(dx, dz);
    if (d < 0.35) { I.mx = I.mz = 0; I.sprint = false; I.fx = (p.team === 0 ? 0 : 0); I.fz = 0; return; }
    const k = Math.min(1, d / 2.0) * speedMul; I.mx = dx / d * k; I.mz = dz / d * k; I.sprint = d > 9;
  }

  // ---------------------------------------------------------------------------------------- the human player
  function contextOf(p) {
    const c = { a1: null, a2: null };
    if (!p) return c;
    if (s.phase === 'setshot') { if (s.set && s.set.id === p.id && !p.act) { c.a1 = 'KICK'; c.a2 = 'PLAY ON'; } return c; }
    if (s.phase === 'ballup') return c;
    if (s.phase !== 'play') return c;
    if (B.owner === p.id) { if (p.st === 'tackled') c.a2 = 'HANDBALL'; else if (!busy(p)) { c.a1 = 'KICK'; c.a2 = 'HANDBALL'; } return c; }
    if (busy(p) && p.act.kind !== 'jump') return c;
    const h = holder();
    const air = B.owner < 0 && B.kind !== 'held' && (B.y > 0.9 || B.vy > 1) && hyp(B.x - p.x, B.z - p.z) < 16;
    if (B.kind === 'ballup' && hyp(B.x - p.x, B.z - p.z) < 7) { c.a1 = 'TAP'; return c; }
    if (air && p.jt < 0 && p.cool.jump <= 0) { c.a1 = B.kind === 'tap' || B.kind === 'loose' ? 'JUMP' : 'MARK'; if (B.kteam >= 0 && B.kteam !== p.team && B.kind === 'kick') c.a2 = 'SPOIL'; return c; }
    if (h && h.team !== p.team && hyp(h.x - p.x, h.z - p.z) < 3.4 && p.cool.tackle <= 0 && p.st === 'free' && !busy(p)) { c.a1 = 'TACKLE'; return c; }
    return c;
  }
  S.contextOf = contextOf;
  function humanControl(p, ctl) {
    const I = p.in;
    I.mx = ctl.mx || 0; I.mz = ctl.mz || 0; I.sprint = !!ctl.sprint; I.fx = 0; I.fz = 0;
    const ctx = contextOf(p);
    if (s.phase === 'setshot' && s.set && s.set.id === p.id) {
      s.set.aimx = I.mx; s.set.aimz = I.mz; I.mx = 0; I.mz = 0; I.sprint = false;
      const set = s.set;
      set.meter += 1 / 60;
      if (ctl.a1 && ctx.a1) {
        const ph = Math.sin(set.meter * TAU / 1.5); set.mq = 1 - Math.abs(ph);
        const tgt = humanTarget(p, 'kick', true);
        startKick(p, tgt, false);
      } else if (ctl.a2 && ctx.a2) { playOn(p); }
      else if (s.t - set.t0 > set.limit && !p.act) { set.mq = 0.3; startKick(p, humanTarget(p, 'kick', true), false); }
      return;
    }
    if (!(ctl.a1 || ctl.a2)) return;
    if (ctl.a1 && ctx.a1) {
      if (ctx.a1 === 'KICK') startKick(p, humanTarget(p, 'kick', false), false);
      else if (ctx.a1 === 'MARK' || ctx.a1 === 'JUMP' || ctx.a1 === 'TAP') startJump(p, false);
      else if (ctx.a1 === 'TACKLE') startTackle(p, holder());
    }
    if (ctl.a2 && ctx.a2) {
      if (ctx.a2 === 'HANDBALL') startHandball(p, humanTarget(p, 'handball', false));
      else if (ctx.a2 === 'SPOIL') startJump(p, true);
    }
  }
  function humanTarget(p, kind, set) {
    let ax = p.in.mx, az = p.in.mz;
    if (set && s.set) { ax = s.set.aimx || 0; az = s.set.aimz || 0; }
    if (hyp(ax, az) < 0.25 && set) { const gz = goalZ(p.team), dx = 0 - p.x, dz = gz - p.z, dl = hyp(dx, dz) || 1; if (dl < 46) { ax = dx / dl; az = dz / dl; } else { ax = 0; az = dirOf(p.team); } }
    return autoTarget(p, kind, ax, az);
  }
  S.humanTarget = (p, kind) => humanTarget(p, kind, s.phase === 'setshot');
  function playOn(p) {
    if (!(s.phase === 'setshot' && s.set && s.set.id === p.id)) return;
    s.phase = 'play'; s.phaseT = 0; s.set = null; B.kind = 'held'; p.hold = 0; p.cool.tackle = 0;
    emit('playOn', { id: p.id, team: p.team });
  }
  S.playOn = playOn;

  // ---------------------------------------------------------------------------------------- phases
  function standBack(set, dt) {
    for (const o of P) {
      if (o.team === set.team) continue;
      const d = hyp(o.x - set.x, o.z - set.z);
      if (d < K.MARK_STAND) {
        const ux = d > 1e-3 ? (o.x - set.x) / d : 1, uz = d > 1e-3 ? (o.z - set.z) / d : 0;
        o.in.mx = ux; o.in.mz = uz; o.in.sprint = false; o.ex.stand = true;
      }
    }
  }
  function setshotTick(dt) {
    const set = s.set; if (!set) return;
    const p = P[set.id];
    for (const q of P) { if (q.id === p.id && q.human) continue; aiStep(S, q, dt); }
    if (set.id !== p.id) return;
    standBack(set, dt);
    if (!p.human && !p.act && s.t - set.t0 >= set.aiDelay) {
      const ch = setshotChoice(S, p);
      if (S.cfg.watch && !s.hold && s.t - s.holdAt > 3) { s.hold = { ...ch.hold, id: p.id, team: p.team, t0: s.t, choice: ch }; return; }
      execChoice(p, ch);
    }
    if (!p.human && !p.act && s.t - set.t0 > set.limit + 4) execChoice(p, setshotChoice(S, p));
  }
  function execChoice(p, ch) {
    if (!ch) return;
    if (ch.kind === 'kick') startKick(p, ch.tgt, !!ch.snap);
    else if (ch.kind === 'handball') startHandball(p, ch.tgt);
    else if (ch.kind === 'playon') playOn(p);
  }
  S.execChoice = execChoice;
  S.release = () => { const h = s.hold; if (!h) return; s.hold = null; s.holdAt = s.t; const p = P[h.id]; if (h.choice) { if (s.phase === 'setshot' && h.choice.kind === 'playon') playOn(p); execChoice(p, h.choice); } };

  function playTick(dt, ctl) {
    if (!s.drill) s.clock = Math.max(0, s.clock - dt);
    if (s.clock <= 0 && !s.siren && !s.drill) { s.siren = true; s.sirenT = 0; emit('siren', {}); }
    if (s.siren) { s.sirenT += dt; if (s.sirenT > 25) { endQuarter(); return; } }
    const ord = s.tick % 2 ? P : P.slice(6).concat(P.slice(0, 6));      // alternate which team acts first (a first-mover edge would favour one side)
    for (const p of ord) { if (p.human) humanControl(p, ctl); else aiStep(S, p, dt); }
    if (s.hold) return;
    movePlayers(dt);
    updateActions(dt);
    ballPhysics(dt);
    catchTick(); pickupTick(); boundaryAndGoals();
    if (s.phase === 'play' && B.owner >= 0) { const h = P[B.owner]; h.hold += dt; if (s.poss !== h.team) s.poss = h.team; }
  }

  function update(dt, ctl) {
    if (s.over) return;
    ctl = ctl || {};
    s.t += dt; s.phaseT += dt; s.tick++;
    if (s.hold) return;
    switch (s.phase) {
      case 'ballup': {
        for (const p of P) { gotoIntent(p, 1); }
        movePlayers(dt); updateActions(dt);
        const u = s.ballup;
        const lim = u.why === 'quarter' ? 2.3 : 1.7;
        if (s.phaseT >= lim) doBounce();
        break;
      }
      case 'dead': {
        for (const p of P) { if (s.phaseT < 1.4 && s.next && s.next.type === 'ballup') { p.in.mx = p.in.mz = 0; p.in.sprint = false; if (p.celeb && !p.act) p.act = { kind: 'celebrate', t0: s.t, t1: s.t + 1.4 }; } else if (p.celeb && p.act) { p.in.mx = p.in.mz = 0; p.in.sprint = false; } else gotoIntent(p, 1); }      // after a goal everybody stands for a moment (the scoring team celebrates), then all walk back together: symmetric for both teams
        for (const p of P) if (p.celeb && p.act && p.act.kind === 'celebrate' && s.t >= p.act.t1) { p.act = null; p.celeb = 0; }
        movePlayers(dt); ballPhysics(dt);
        if (s.phaseT >= 2.9) {
          for (const p of P) if (p.act && p.act.kind === 'celebrate') { p.act = null; p.celeb = 0; }
          snapToGoto(1.0);
          if (s.siren) { endQuarter(); break; }
          const n = s.next;
          if (n.type === 'ballup') startBallUp(0, 0, 'center');
          else { const taker = P[n.team * 6 + 5]; startSetShot('kickin', taker, n.x, n.z, { why: 'kick-in' }); for (const p of P) p.goto = null; }
        }
        break;
      }
      case 'setshot': {
        movePlayers(dt); updateActions(dt); ballPhysics(dt);
        if (s.phase === 'setshot') setshotTickPost(dt, ctl);
        break;
      }
      case 'play': playTick(dt, ctl); break;
      case 'drillwait': { for (const p of P) { p.in.mx = p.in.mz = 0; p.in.sprint = false; } movePlayers(dt); updateActions(dt); ballPhysics(dt); break; }
      case 'break': case 'over': break;
      default: break;
    }
    if (S.drillApi) S.drillApi.tick(dt);
  }
  function setshotTickPost(dt, ctl) {
    // intents are set before movement in the next tick; run them now so movement sees fresh values
    const set = s.set; if (!set) return;
    for (const p of P) { if (p.human) humanControl(p, ctl); }
    if (!s.set || s.phase !== 'setshot') return;                 // the human pressed PLAY ON (or the shot was taken) just now
    setshotTick(dt);
    if (set.id >= 0 && P[set.id].act && P[set.id].act.kind === 'kick' && P[set.id].act.fired) { s.phase = 'play'; s.phaseT = 0; s.set = null; }
  }

  // ---------------------------------------------------------------------------------------- API
  S.update = update;
  S.holder = holder;
  S.carryPos = carryPos;
  S.setOwner = setOwner;
  S.busy = busy;
  S.nearestTo = nearestTo;
  S.hint = (id) => hintFor(S, P[id]);
  S.suggest = S.hint;
  S.startMatch = () => { startQuarter(); };
  S.humanPlayer = () => (humanSlot >= 0 ? P[humanSlot] : null);
  S.shown = P[humanSlot >= 0 ? humanSlot : 0];
  S.forceBallUp = (x, z) => startBallUp(x, z, 'out');
  S.placeDrill = (fn) => fn(S);
  S.endQuarterNow = () => { if (s.phase === 'play' || s.phase === 'setshot') endQuarter(); };
  S.resume = null;
  S.drillFeed = null;
  S.forceBounce = () => { if (s.phase === 'ballup') doBounce(); };
  if (cfg.drill) { createDrill(S); S.drillApi.begin(); }
  else if (cfg.resume) { const r = cfg.resume; s.q = r.q; s.score = r.score.map((x) => ({ ...x })); s.qscore = (r.qscore || []).map((a) => [{ ...a[0] }, { ...a[1] }]); s.stats = r.stats ? r.stats.map((x) => ({ ...x })) : s.stats; startQuarter(); s.clock = r.clock; }
  else startQuarter();
  return S;
}
