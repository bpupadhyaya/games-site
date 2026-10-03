// The match: players, ball physics, rules, clocks. Pure and deterministic (dt = 1/60, seeded streams). The 3D presenter and the HUD
// only READ `sim.s`. Every contact (dribble bounce, release, catch, rim touch) has an exact time here.
import { G, BR, HOOP, RIM_R, TUBE_R, BOARD_Z, BOARD, HW, Z_BASE, Z_HALF, ARC_R, ARC_X, FT_Z, BOUND, DT, SHOT_CLOCK, GAME_LEN, ROLES, LEVELS, TM_LEVEL, SPOTS } from './consts.js';
import { makeDribble } from './dribble.js';
import { clamp, hyp, normal, angDiff } from './util.js';
import * as AI from './ai.js';
import { visHalfWidth } from './camera.js';

const PLAYER_R = 0.45;
const RING = Array.from({ length: 32 }, (_, k) => ({ x: RIM_R * Math.cos((k / 32) * Math.PI * 2), z: RIM_R * Math.sin((k / 32) * Math.PI * 2) }));
const NAMES = ['Blue', 'Red'];
const TEAM_NAME = (t, cfg) => (t === 0 ? 'Blue' : 'Red');

export function isTwo(x, z) { return hyp(x, z) > ARC_R || Math.abs(x) > ARC_X; }
export const hoopDist = (x, z) => hyp(x - HOOP.x, z - HOOP.z);

export function createSim(cfg, rng) {
  const R = rng.fork(), RA = rng.fork();
  const len = GAME_LEN[cfg.len === 'quick' ? 'quick' : 'full'];
  const humanTeam = cfg.human ? (cfg.human.team ?? 0) : -1;
  const autoHuman = !!(cfg.human && cfg.human.auto);
  const lvl = cfg.levels ? [LEVELS[cfg.levels[0]], LEVELS[cfg.levels[1]]] : [LEVELS[TM_LEVEL], LEVELS[cfg.level ?? 3]];
  const s = {
    t: 0, tick: 0, phase: 'ready', mode: 'check', timer: 1.2, cfg: { len: cfg.len === 'quick' ? 'quick' : 'full', human: cfg.human || null, level: cfg.level ?? 3, watch: !!cfg.watch, drill: cfg.drill || null, noClock: !!(cfg.drill) },
    score: [0, 0], fouls: [0, 0], target: len.points, clock: len.seconds, shotClock: SHOT_CLOCK, poss: cfg.firstPoss ?? 0, cleared: true,
    ot: false, over: false, winner: -1, clockOut: false,
    players: [], ball: null, events: [], eid: 0, last: null, hold: null, ft: null, shotInfo: null,
    stats: [0, 1].map(() => ({ fga: 0, fgm: 0, tpa: 0, tpm: 0, reb: 0, stl: 0, blk: 0, tov: 0, ast: 0 })),
    lv: lvl.map((l) => l.id), names: [TEAM_NAME(0, cfg), TEAM_NAME(1, cfg)], humanTeam, humanId: cfg.human ? humanTeam * 3 + cfg.human.role : -1,
    aim: null, deadT: 0, restart: null, drillTally: null,
  };
  // ---- players ----------------------------------------------------------------------------------------------------------------
  for (let team = 0; team < 2; team++) for (let role = 0; role < 3; role++) {
    const r = ROLES[role];
    s.players.push({ id: team * 3 + role, team, role, human: !autoHuman && s.humanId === team * 3 + role, x: 0, z: 0, vx: 0, vz: 0, face: Math.PI, jy: 0, jvy: 0, act: null, sc: r.scale, reachH: r.reach, hand: 1, du: 0, side: -1, sideT: -1, lastCatch: -9,
      stumble: 0, cool: { steal: 0, cross: 0, jump: 0, pass: 0 }, plan: null, nextThink: 0, set: false, setT: 0, screenOn: false, burst: 0, out: false, callT: 0, expect: null, landT: 0, tmp: {}, speed: 0, cx: 0, cz: 0, dT: 0.5, bounceNext: false });
  }
  s.ball = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, mode: 'held', holder: 0, lastTeam: 0, lastId: 0, target: -1, age: 0, rim: 0, board: 0, thru: false, shot: null, dead: false, prevY: 1, spin: 0, deflect: false, bounceT: 0, passFrom: -1, pickT: 0, spinAxis: 0 };
  const P = s.players, B = s.ball;
  const lvOf = (p) => LEVELS[s.lv[p.team]];
  const ev = (type, o = {}) => { const e = { id: s.eid++, type, t: s.t, ...o }; s.events.push(e); if (s.events.length > 200) s.events.splice(0, 100); if (s.drill) drillOnEvent(e); };
  const opp = (t) => 1 - t;
  const teamOf = (t) => P.filter((p) => p.team === t && !p.out);
  const guardOf = (t) => P[t * 3];
  const holderP = () => (B.mode === 'held' ? P[B.holder] : null);

  // ---- helpers shared with the AI ----------------------------------------------------------------------------------------------
  const maxSpeed = (p) => {
    let v = ROLES[p.role].speed * (p.human ? 1 : lvOf(p).spd);
    if (B.mode === 'held' && B.holder === p.id) v *= 0.93 * (0.94 + 0.06 * ROLES[p.role].handle);
    if (p.stumble > 0) v *= 0.3;
    if (p.burst > 0) v *= 1.3;
    if (p.landT > 0) v *= 0.55;
    return v;
  };
  // how closely the nearest opposing player guards (0 open ... 1 smothered), and who
  const contestOf = (x, z, team, jumpBonus = true) => {
    let best = 0, who = -1;
    for (const d of P) {
      if (d.team === team || d.out) continue;
      const dd = hyp(d.x - x, d.z - z);
      let c = clamp((1.9 - dd) / 1.4, 0, 1);
      // a defender between the shooter and the hoop counts fully, one behind the shooter only a little
      const toH = Math.atan2(HOOP.x - x, HOOP.z - z), toD = Math.atan2(d.x - x, d.z - z);
      const ad = Math.abs(angDiff(toH, toD));
      c *= ad < 1.2 ? 1 : ad < 2.0 ? 0.7 : 0.35;
      if (jumpBonus && d.act && d.act.kind === 'jump' && d.jy > 0.05) c = Math.min(1, c + 0.25);
      if (c > best) { best = c; who = d.id; }
    }
    return { c: best, who };
  };
  const meterWindow = (d, c, layup) => clamp(layup ? 0.17 : 0.10 + 0.07 * (1 - d / 7.5) - 0.05 * c, 0.06, 0.18);
  const skillOf = (p, layup) => (p.human ? 1 : lvOf(p).skill) * (layup ? ROLES[p.role].layup : ROLES[p.role].shoot);
  // sigma of the miss at the rim plane (metres) for a given shooter, distance, contest, timing score
  const sigmaOf = (p, d, c, tq, layup) => {
    const sk = skillOf(p, layup);
    const s0 = layup ? 0.100 : 0.062 + 0.0062 * d;
    return (s0 * (1.9 - 1.3 * tq) * (1 + 0.9 * c) * 1.4) / sk;
  };
  const SIG = [[0.03, 0.98], [0.05, 0.94], [0.07, 0.81], [0.09, 0.72], [0.11, 0.63], [0.14, 0.50], [0.18, 0.35], [0.25, 0.22], [0.4, 0.10], [0.7, 0.03]];
  const pFromSigma = (sg) => { if (sg <= SIG[0][0]) return SIG[0][1]; for (let i = 1; i < SIG.length; i++) if (sg <= SIG[i][0]) { const [a, pa] = SIG[i - 1], [b, pb] = SIG[i]; return pa + (pb - pa) * (sg - a) / (b - a); } return 0.04; };
  // estimated probability that a shot from (x,z) goes in, for an average-timing shooter p (AI decisions and the Think hint)
  const makeProb = (p, x, z, c, tq = 0.8) => {
    const d = hoopDist(x, z), layup = d < 2.3;
    return clamp(pFromSigma(sigmaOf(p, d, c, tq, layup)), 0.02, 0.95);
  };
  const X = { s, P, B, R: RA, ROLES, LEVELS, lvOf, opp, teamOf, guardOf, holderP, maxSpeed, contestOf, makeProb, meterWindow, hoopDist, isTwo, SPOTS };

  // ---- dribble ---------------------------------------------------------------------------------------------------------------------
  const dribOf = (p) => {
    const sp = hyp(p.vx, p.vz);
    const T = clamp(0.56 - sp * 0.034 - (ROLES[p.role].handle - 1) * 0.05, 0.38, 0.6);
    p.dT = T; return makeDribble(T);
  };
  function heldBall(p) {
    const d = dribOf(p);
    const u = p.du;
    const hy = p.holdYaw ?? p.face, sinF = Math.sin(hy), cosF = Math.cos(hy);
    const sp = hyp(p.vx, p.vz);
    // lateral offset (hand side) eases across during a crossover; the ball crosses low in front of the body
    const lat = 0.30 * p.sideT, fwd = 0.24 + 0.025 * Math.min(sp, 5);
    const y = d.y(u);
    // the ball drifts forward at the floor contact when moving
    const lead = sp * 0.06 * Math.sin(Math.PI * u);
    B.x = p.x + cosF * lat + sinF * (fwd + lead);
    B.z = p.z - sinF * lat + cosF * (fwd + lead);
    B.y = y;
    // just caught: the ball settles from where it was caught into the dribble
    if (p.catchFrom && s.t - p.lastCatch < (p.catchDur ?? 0.16)) { const k = (s.t - p.lastCatch) / (p.catchDur ?? 0.16), e = k * k * (3 - 2 * k); B.x = p.catchFrom.x + (B.x - p.catchFrom.x) * e; B.y = p.catchFrom.y + (B.y - p.catchFrom.y) * e; B.z = p.catchFrom.z + (B.z - p.catchFrom.z) * e; }
  }
  const bodyFwd = (p) => ({ x: Math.sin(p.face), z: Math.cos(p.face) });

  // ---- placing ---------------------------------------------------------------------------------------------------------------
  function spotsFor(off) {
    const o = [SPOTS.top, SPOTS.wingL, { x: 2.4, z: 2.4 }];
    return o;
  }
  function setPlayer(p, x, z, face) { p.holdYaw = face; p.x = x; p.z = z; p.vx = p.vz = 0; p.face = face; p.jy = 0; p.jvy = 0; p.act = null; p.set = false; p.setT = 0; p.screenOn = false; p.stumble = 0; p.burst = 0; p.landT = 0; p.plan = null; p.nextThink = s.t + 0.2; p.expect = null; p.du = 0; }
  function setupPossession(off, mode) {
    s.poss = off; s.mode = mode; s.phase = 'ready'; s.timer = mode === 'check' ? 1.6 : 1.3; s.cleared = true; s.shotClock = SHOT_CLOCK; s.hold = null; s.ft = null; s.shotInfo = null;
    const de = opp(off);
    const sp = [SPOTS.top, { x: -5.0, z: 5.1 }, { x: 2.2, z: 2.6 }];
    for (let r = 0; r < 3; r++) {
      const a = P[off * 3 + r];
      setPlayer(a, sp[r].x, sp[r].z, Math.atan2(HOOP.x - sp[r].x, HOOP.z - sp[r].z));
      const dd = P[de * 3 + r];
      const k = mode === 'check' && r === 0 ? 1.75 : 1.2;
      const dx = sp[r].x * 0.82, dz = sp[r].z - k * (sp[r].z > 0 ? 1 : 0);
      setPlayer(dd, dx, Math.max(0.9, dz), Math.atan2(sp[r].x - dx, sp[r].z - dz));
    }
    const holder = mode === 'check' ? P[de * 3] : P[off * 3];
    B.mode = 'held'; B.holder = holder.id; B.lastTeam = holder.team; B.lastId = holder.id; B.shot = null; B.thru = false; B.dead = false; B.rim = 0; B.board = 0; B.target = -1;
    holder.du = 0;
    heldBall(holder);
    s.deadT = 0;
    ev('setup', { team: off, mode });
  }
  function startLive() { s.phase = 'live'; ev('live', { team: s.poss }); }

  // ---- control commands (human and AI use exactly the same ones) -------------------------------------------------------------------
  function cmdShot(p, timingErr = null) {
    if (p.act || p.jy > 0.02 || B.mode !== 'held' || B.holder !== p.id) return false;
    if (!s.cleared && s.phase === 'live') { ev('notcleared', { pid: p.id }); return false; }
    const d = hoopDist(p.x, p.z);
    const ft = s.phase === 'ft';
    const layup = !ft && d < 2.35;
    const t0 = s.t;
    const act = { id: s.eid++, kind: layup ? 'layup' : 'shot', t0, tj: t0 + (layup ? 0.15 : 0.20), tr: null, tl: 0, human: p.human, ft, layup, apexT: 0, aiRel: null, jv: layup ? 3.3 : ft ? 0 : 2.75, d, pts: isTwo(p.x, p.z) ? 2 : 1, x0: p.x, z0: p.z, tq: 0, c: 0, rel: null, face: Math.atan2(HOOP.x - p.x, HOOP.z - p.z) };
    act.tl = act.tj + (layup ? 0.67 : ft ? 0.56 : 0.56);
    act.apexT = layup ? act.tj + 0.19 : ft ? t0 + 0.44 : act.tj + act.jv / G;
    act.aiRel = timingErr === null ? null : act.apexT + timingErr;
    act.w0 = ft ? 0.13 : meterWindow(d, contestOf(p.x, p.z, p.team).c, layup);
    act.hold = true;
    act.from = { x: B.x, y: B.y, z: B.z };
    p.act = act;
    ev('shotStart', { pid: p.id, layup, ft });
    return true;
  }
  function cmdShotRelease(p) { const a = p.act; if (a && (a.kind === 'shot' || a.kind === 'layup') && a.tr === null && a.human) a.hold = false; }
  function cmdPass(p, toId, check = false) {
    if (p.act || B.mode !== 'held' || B.holder !== p.id || p.jy > 0.02) return false;
    const to = P[toId]; if (!to || (to.team !== p.team && !check) || to.out || toId === p.id) return false;
    p.act = { id: s.eid++, kind: 'pass', t0: s.t, tr: s.t + 0.17, tl: s.t + 0.5, to: toId, human: p.human, check, from: { x: B.x, y: B.y, z: B.z } };
    ev('passStart', { pid: p.id, to: toId });
    return true;
  }
  function cmdSteal(p) {
    if (p.act || p.cool.steal > 0 || p.jy > 0.02) return false;
    p.act = { id: s.eid++, kind: 'steal', t0: s.t, tc: s.t + 0.17, tl: s.t + 0.5, done: false, human: p.human };
    p.cool.steal = 0.9;
    ev('stealStart', { pid: p.id });
    return true;
  }
  function cmdJump(p, kind = 'jump') {
    if (p.act || p.cool.jump > 0 || p.jy > 0.02) return false;
    const big = ROLES[p.role].block;
    p.act = { id: s.eid++, kind: 'jump', t0: s.t, tj: s.t + 0.10, tl: s.t + 0.10 + 0.58, human: p.human, why: kind };
    p.cool.jump = 0.5;
    return true;
  }
  function cmdScreen(p, on) {
    if (on) { if (!p.screenOn && !p.act && B.holder !== p.id) { p.screenOn = true; p.setT = 0; } }
    else if (p.screenOn) { p.screenOn = false; p.set = false; p.setT = 0; }
  }
  function cmdCross(p) {
    if (B.mode !== 'held' || B.holder !== p.id || p.cool.cross > 0 || p.act || p.jy > 0.02) return false;
    p.cool.cross = 1.3; p.burst = 0.4; p.side = -p.side;
    p.crossT = 0.32;
    // the nearest defender in front can be beaten
    let best = null, bd = 1.7;
    for (const d of P) { if (d.team === p.team || d.out) continue; const dd = hyp(d.x - p.x, d.z - p.z); if (dd < bd) { bd = dd; best = d; } }
    if (best) {
      const defSkill = best.human ? 0.85 : 0.55 + 0.1 * lvOf(best).react * 0 + 0.12 * lvOf(best).ctest;
      const pBeat = clamp(0.8 - defSkill * 0.55 + (ROLES[p.role].handle - 1) * 0.35 - (bd < 0.8 ? 0.1 : 0), 0.12, 0.85);
      if (R.next() < pBeat) { best.stumble = 0.55; ev('beaten', { pid: best.id, by: p.id }); }
    }
    ev('cross', { pid: p.id });
    return true;
  }

  // ---- ball release: shot, pass --------------------------------------------------------------------------------------------------
  function releaseShot(p, a) {
    const sinF = Math.sin(a.face), cosF = Math.cos(a.face);
    const sc = p.sc;
    const relY = (a.layup ? 1.90 * sc + p.jy + 0.10 : 1.90 * sc + p.jy + 0.04);
    const x0 = p.x + sinF * (a.layup ? 0.2 : 0.12), z0 = p.z + cosF * (a.layup ? 0.2 : 0.12);
    // timing: perfect at the apex
    const e = s.t - a.apexT;
    const d = hyp(x0 - HOOP.x, z0 - HOOP.z);
    const { c, who } = a.ft ? { c: 0, who: -1 } : contestOf(p.x, p.z, p.team);
    const w = a.ft ? 0.13 : meterWindow(d, c, a.layup);
    const tq = clamp(1 - Math.pow(Math.abs(e) / w, 1.6), 0, 1);
    a.tq = tq; a.c = c; a.e = e; a.w = w;
    const sg = sigmaOf(p, d, c, tq, a.layup);
    const dirx = (HOOP.x - x0) / Math.max(0.01, d), dirz = (HOOP.z - z0) / Math.max(0.01, d);
    const lat = normal(R) * sg, dep = normal(R) * sg * 1.25;
    const tx = HOOP.x + (-dirz) * lat + dirx * dep, tz = HOOP.z + dirx * lat + dirz * dep;
    const clearance = a.layup ? 0.42 : clamp(0.75 + 0.17 * d, 0.9, 2.1);
    const ya = HOOP.y + clearance;
    const vy = Math.sqrt(2 * G * Math.max(0.2, ya - relY));
    const T = vy / G + Math.sqrt((2 * (ya - HOOP.y)) / G);
    B.mode = 'shot'; B.x = x0; B.y = relY; B.z = z0; B.vx = (tx - x0) / T; B.vz = (tz - z0) / T; B.vy = vy;
    B.lastTeam = p.team; B.lastId = p.id; B.age = 0; B.rim = 0; B.board = 0; B.thru = false; B.target = -1; B.deflect = false;
    B.spin = 6; B.spinAxis = Math.atan2(B.vx, B.vz);
    B.shot = { id: p.id, team: p.team, pts: a.ft ? 1 : isTwo(p.x, p.z) ? 2 : 1, layup: a.layup, ft: a.ft, d, c, tq, sg, relT: s.t, x0, z0, rimHits: 0, blocked: false, fouled: false };
    s.shotInfo = B.shot;
    a.rel = { x: x0, y: relY, z: z0 };
    a.tr = s.t;
    if (!a.ft) { const st = s.stats[p.team]; st.fga++; if (B.shot.pts === 2) st.tpa++; }
    ev('shot', { pid: p.id, team: p.team, pts: B.shot.pts, layup: a.layup, d, c, tq, e, ft: a.ft });
    s.shotClockRun = false;
    // a shooting foul: a defender who jumps right at the shooter and is close
    if (!a.ft && who >= 0) {
      const dd = P[who];
      const dist = hyp(dd.x - p.x, dd.z - p.z);
      if (dist < 1.0 && dd.act && dd.act.kind === 'jump' && dd.jy > 0.05) {
        const pf = clamp(0.07 + (1 - dist) * 0.16, 0, 0.3);
        if (R.next() < pf) { B.shot.fouled = true; B.shot.foulBy = who; }
      }
    }
    if (a.ft) { s.ft.pending = true; }
    // the AI defenders see the shot
  }
  function releasePass(p, a) {
    const to = P[a.to];
    const sinF = Math.sin(p.face), cosF = Math.cos(p.face);
    const x0 = p.x + sinF * 0.28, z0 = p.z + cosF * 0.28, y0 = 1.30 * p.sc;
    const sp = 11.5 * (0.9 + 0.1 * ROLES[p.role].pass);
    // lead the receiver
    let tx = to.x, tz = to.z, T = 0.4;
    for (let i = 0; i < 4; i++) {
      T = clamp(hyp(tx - x0, tz - z0) / sp, 0.18, 1.1);
      tx = to.x + to.vx * T * 0.85; tz = to.z + to.vz * T * 0.85;
    }
    tx = clamp(tx, -HW + 0.2, HW - 0.2); tz = clamp(tz, Z_BASE + 0.2, Z_HALF - 0.2);
    const press = contestOf(p.x, p.z, p.team, false).c;
    const sgm = 0.07 + 0.1 * press + (p.human ? 0.0 : 0.07 * (1 - lvOf(p).skill * 0.5));
    tx += normal(R) * sgm; tz += normal(R) * sgm;
    const cy = 1.22 * to.sc;
    B.mode = 'pass'; B.x = x0; B.y = y0; B.z = z0;
    B.vx = (tx - x0) / T; B.vz = (tz - z0) / T; B.vy = (cy - y0 + 0.5 * G * T * T) / T;
    B.check = !!a.check; B.target = a.to; B.lastTeam = p.team; B.lastId = p.id; B.age = 0; B.passFrom = p.id; B.passT = T; B.catchPt = { x: tx, y: cy, z: tz }; B.intercepted = {};
    B.spin = 2;
    to.expect = { x: tx, z: tz, until: s.t + T + 0.6, from: p.id };
    ev('pass', { pid: p.id, to: a.to, T, tx, tz });
  }

  // ---- ball in flight ------------------------------------------------------------------------------------------------------------
  function bounceFloor(h) {
    if (B.y < BR) {
      B.y = BR;
      if (B.vy < 0) {
        const imp = -B.vy;
        B.vy = imp * 0.78; B.vx *= 0.93; B.vz *= 0.93;
        if (B.vy < 0.9) B.vy = 0;
        if (imp > 1.2 && s.t - B.bounceT > 0.05) { ev('bounce', { x: B.x, z: B.z, v: imp }); B.bounceT = s.t; }
      }
    }
  }
  function stepFlight(h) {
    B.prevY = B.y;
    B.vy -= G * h; B.x += B.vx * h; B.y += B.vy * h; B.z += B.vz * h;
    bounceFloor(h);
    // backboard
    if (B.vz < 0 && B.z - BR < BOARD_Z && B.z > BOARD_Z - 0.25 && Math.abs(B.x) < BOARD.hw + BR * 0.4 && B.y > BOARD.y0 - BR * 0.4 && B.y < BOARD.y1 + BR * 0.4) {
      B.z = BOARD_Z + BR; B.vz = -B.vz * 0.52; B.vx *= 0.92; B.vy *= 0.94; B.board++;
      ev('board', { x: B.x, y: B.y, z: B.z, v: Math.abs(B.vz) });
      if (B.shot) B.shot.board = true;
    }
    // ring (32 tube points)
    const dy = B.y - HOOP.y;
    if (Math.abs(dy) < BR + 0.05) {
      for (const k of RING) {
        const dx = B.x - k.x, dz = B.z - k.z, dd = Math.hypot(dx, dy, dz);
        const lim = BR + TUBE_R;
        if (dd < lim && dd > 1e-6) {
          const nx = dx / dd, ny = dy / dd, nz = dz / dd;
          const vn = B.vx * nx + B.vy * ny + B.vz * nz;
          if (vn < 0) {
            const e = 0.55;
            B.vx -= (1 + e) * vn * nx; B.vy -= (1 + e) * vn * ny; B.vz -= (1 + e) * vn * nz;
            B.vx *= 0.97; B.vz *= 0.97;
            B.x += nx * (lim - dd); B.y += ny * (lim - dd); B.z += nz * (lim - dd);
            B.rim++; if (B.shot) B.shot.rimHits++;
            if (Math.abs(vn) > 0.8) ev('rim', { v: Math.abs(vn), x: B.x, y: B.y, z: B.z });
          }
        }
      }
    }
    // through the hoop: the ball centre crosses the ring plane downwards inside the ring
    if (!B.thru && B.prevY > HOOP.y && B.y <= HOOP.y && B.vy < 0 && Math.hypot(B.x - HOOP.x, B.z - HOOP.z) < RIM_R - 0.015) {
      B.thru = true;
      if (B.mode === 'shot') scoreBasket();
    }
    // the net slows and centres the ball
    if (B.thru && B.y < HOOP.y && B.y > HOOP.y - 0.5) {
      const k = Math.min(1, 7 * h);
      B.vx -= B.vx * k; B.vz -= B.vz * k; B.vx += (HOOP.x - B.x) * 6 * h; B.vz += (HOOP.z - B.z) * 6 * h;
      if (B.vy < -3.0) B.vy += (-3.0 - B.vy) * Math.min(1, 9 * h) * -1 * -1 * 0.5;
    }
  }
  function scoreBasket() {
    const sh = B.shot; if (!sh || sh.scored) return;
    sh.scored = true;
    const t = sh.team;
    s.score[t] += sh.pts;
    const st = s.stats[t]; if (!sh.ft) { st.fgm++; if (sh.pts === 2) st.tpm++; }
    ev('score', { team: t, pid: sh.id, pts: sh.pts, swish: B.rim === 0 && !B.board, ft: sh.ft, layup: sh.layup, d: sh.d, score: [...s.score] });
    s.last = { team: t, id: sh.id, pts: sh.pts, t: s.t, kind: 'score', swish: B.rim === 0 && !B.board };
    // shooting fouls: "and one"
    if (sh.fouled) { s.pendingFT = { shooter: sh.id, n: 1, foulBy: sh.foulBy }; sh.fouled = false; s.fouls[opp(t)]++; ev('foul', { team: opp(t), by: sh.foulBy, on: sh.id, ft: 1, and1: true }); }
    if (s.ft) return;
    endCheck();
  }
  function endCheck() {
    if (s.drill) return;
    if (s.cfg.noClock) { s.phase = 'dead'; s.deadT = 1.6; s.restart = { kind: 'inbound', team: opp(s.last.team), after: 'score' }; return; }
    const t = s.last.team;
    if (s.ot ? s.score[t] >= s.otTarget : s.score[t] >= s.target) { finish(t); return; }
    s.phase = 'dead'; s.deadT = 1.8; s.restart = { kind: 'inbound', team: opp(t) };
  }
  function finish(winner) { s.over = true; s.winner = winner; s.phase = 'over'; ev('end', { winner, score: [...s.score] }); }

  // ---- end of a possession type events ---------------------------------------------------------------------------------------------
  function turnover(team, why, deadBall = true) {
    // `team` loses the ball
    s.stats[team].tov++;
    s.last = { team: opp(team), kind: 'turnover', why, t: s.t };
    ev('turnover', { team, why });
    if (s.drill) { s.shotClock = SHOT_CLOCK; return; }
    if (deadBall) { s.phase = 'dead'; s.deadT = 1.1; s.restart = { kind: 'check', team: opp(team) }; B.dead = true; }
  }
  function foulCall(foulTeam, by, on, ftN, nonShoot = false) {
    s.fouls[foulTeam]++;
    ev('foul', { team: foulTeam, by, on, ft: ftN });
    s.last = { team: opp(foulTeam), kind: 'foul', t: s.t };
    const shooter = P[on];
    if (s.drill) { return; }
    if (nonShoot && s.fouls[foulTeam] < 7) { s.phase = 'dead'; s.deadT = 1.0; s.restart = { kind: 'check', team: opp(foulTeam) }; B.dead = true; return; }
    s.pendingFT = { shooter: on, n: nonShoot ? 2 : ftN, foulBy: by };
    s.phase = 'dead'; s.deadT = 1.0; s.restart = { kind: 'ft' }; B.dead = true;
  }
  function startFT() {
    const f = s.pendingFT; s.pendingFT = null;
    const sh = P[f.shooter];
    s.ft = { shooter: f.shooter, n: f.n, made: 0, shots: 0, timer: 1.2, team: sh.team };
    s.phase = 'ft'; s.poss = sh.team;
    for (const p of P) { p.act = null; p.vx = p.vz = 0; p.screenOn = false; p.set = false; p.jy = 0; p.jvy = 0; }
    setFTPositions();
  }
  function setFTPositions() {
    const f = s.ft, sh = P[f.shooter], de = opp(sh.team);
    setPlayer(sh, 0, FT_Z + 0.5, Math.PI);
    const matesAt = [{ x: 3.2, z: 5.2 }, { x: -3.2, z: 5.2 }], oppsAt = [{ x: -3.2, z: 2.6 }, { x: 3.2, z: 2.6 }, { x: -3.2, z: 4.6 }];
    let im = 0, io = 0;
    for (const p of P) {
      if (p.id === sh.id) continue;
      const slot = p.team === sh.team ? matesAt[im++ % 2] : oppsAt[io++ % 3];
      setPlayer(p, slot.x, slot.z, Math.PI);
    }
    // keep everyone clear of the key: teammates and opponents stand outside the lane
    B.mode = 'held'; B.holder = sh.id; B.lastTeam = sh.team; B.lastId = sh.id; B.dead = false; B.thru = false; B.shot = null; B.rim = 0; B.board = 0;
    sh.du = 0; heldBall(sh);
  }
  function afterFTShot(made) {
    const f = s.ft; f.shots++; if (made) f.made++;
    f.n--;
    if (f.n > 0) { f.timer = 0.9; setFTPositions(); return; }
    // last free throw
    s.ft = null;
    if (made) { s.last = { team: P[f.shooter].team, kind: 'score', t: s.t, pts: 1 }; endCheck(); }
    else { s.phase = 'live'; s.cleared = true; s.shotClockRun = true; s.poss = P[f.shooter].team; s.shotClock = SHOT_CLOCK; B.mode = 'loose'; ev('ftMiss'); }
  }

  // ---- catches, rebounds, pickups, interceptions -------------------------------------------------------------------------------------------
  function takeBall(p, how) {
    const prevTeam = B.lastTeam;
    const was = B.mode;
    p.catchFrom = { x: B.x, y: B.y, z: B.z };
    p.catchDur = clamp(0.16 + 0.4 * Math.max(0, B.y - 1.2), 0.16, 0.55);   // a ball caught overhead is brought down more slowly
    B.mode = 'held'; B.holder = p.id; B.vx = B.vy = B.vz = 0; B.thru = false; B.target = -1; B.passFrom = -1;
    const changed = p.team !== s.poss;
    B.lastTeam = p.team; B.lastId = p.id; B.shot = null; B.deflect = false;
    p.du = 0.0; p.lastCatch = s.t;
    if (changed) { s.poss = p.team; s.cleared = false; s.shotClock = SHOT_CLOCK; ev('poss', { team: p.team, how }); }
    else if (how === 'rebound') { s.shotClock = SHOT_CLOCK; }
    s.shotClockRun = true;
    if (s.phase === 'live' && !s.cleared && !isTwo(p.x, p.z) === false) s.cleared = true;
    if (isTwo(p.x, p.z)) s.cleared = true;
    // a received pass from a teammate keeps the clear status
    if (how === 'pass' && !changed) { /* keep */ }
    p.expect = null;
    if (how === 'rebound') s.stats[p.team].reb++;
    if (how === 'steal') s.stats[p.team].stl++;
    ev(how, { pid: p.id, team: p.team });
    if (p.act && p.act.kind === 'steal') { /* keep animation */ }
    if (p.screenOn) cmdScreen(p, false);
  }
  // Can the hands of p meet the ball on its surface? Same geometry the presenter solves with IK (arm 0.64 m x scale, shoulders 0.215 m
  // apart at 1.42 m, a forward lean of about 8 cm): 'two' = both palms on the ball's sides, 'scoop' = one palm on top of a low ball,
  // 'swipe' = one palm on the near side. Every contact in the game (catch, rebound, pickup, steal, block) is gated by this, so the
  // picture can always put the palm on the ball.
  const ARM = 0.57, SHO_W = 0.215, SHO_Y = 1.42, LUNGE = 0.08, HT = 0.012;
  function reachCheck(p, kind = 'two', slack = 0.015, lunge = LUNGE) {
    const sc = p.sc, d = Math.hypot(B.x - p.x, B.z - p.z), low = B.y < 0.8 && kind !== 'swipe';
    const shY = SHO_Y * sc + p.jy - (low ? 0.45 : 0), arm = ARM * sc - slack;
    if (low) return Math.hypot(Math.max(0, d - lunge - 0.02), B.y + BR + HT - shY) <= arm;
    if (kind === 'swipe') return Math.hypot(Math.max(0, d - lunge), B.y - shY) <= arm + BR + HT - slack;
    return Math.hypot(Math.max(0, d - lunge), BR + HT - SHO_W * sc, B.y - shY) <= arm;
  }
  const reachY = (p) => p.reachH + p.jy;
  function stepBallContacts() {
    // pass in flight: catch by the target (or a teammate), interception by an opponent
    if (B.mode === 'pass') {
      let caught = null;
      for (const p of P) {
        if (p.out) continue;
        const dd = hyp(p.x - B.x, p.z - B.z);
        const hi = reachY(p) - 0.1;
        if (B.check) { if (p.id === B.target && reachCheck(p)) { caught = p; break; } continue; }
        if (p.team === B.lastTeam) {
          if (p.id === B.passFrom && s.t - B.pickT < 0.3) continue;
          if (B.y > 0.45 && (p.id === B.target || dd < 0.6) && p.id !== B.passFrom && reachCheck(p)) { caught = p; break; }
        } else {
          // interception: only once per defender; chance by level, closeness and whether hands are up
          if (B.intercepted[p.id] || p.stumble > 0) continue;
          if (B.y > 0.25 && reachCheck(p)) {
            B.intercepted[p.id] = true;
            const lv = p.human ? 0.85 : lvOf(p);
            const lvf = p.human ? 0.85 : 0.5 + 0.3 * lv.steal;
            const pp = clamp(0.2 + 0.4 * lvf - dd * 0.35 + (p.act && p.act.kind === 'steal' ? 0.25 : 0), 0.03, 0.8);
            if (R.next() < pp) {
              if (R.next() < 0.45) { caught = p; ev('intercept', { pid: p.id }); } else { B.mode = 'loose'; B.vx *= 0.35; B.vz *= 0.35; B.vy = Math.min(B.vy, 1) ; B.lastTeam = p.team; B.lastId = p.id; B.deflect = true; ev('deflect', { pid: p.id }); return; }
            }
          }
        }
      }
      if (caught) {
        const was = caught.team === B.lastTeam;
        takeBall(caught, B.check ? 'catch' : (caught.team === B.lastTeam ? 'catch' : 'steal'));
        if (caught.team !== B.lastTeam && false) { /* unreachable */ }
        if (s.phase === 'live') { /* the stat for a steal is counted in takeBall */ }
        return;
      }
      if (B.vy < 0 && B.y <= BR + 0.001) { B.mode = 'loose'; }
    }
    if (B.mode === 'shot' && B.y <= BR + 0.01 && B.vy <= 0 && B.age > 0.25) { if (B.shot && !B.shot.scored) resolveMiss(); B.mode = 'loose'; }
    if (B.mode === 'shot') {
      B.age += DT;
      // blocks: a defender in a jump contact with the ball just after release
      if (B.age < 0.5 && B.shot && !B.shot.blocked) {
        for (const d of P) {
          if (d.team === B.shot.team || d.out || !d.act || d.act.kind !== 'jump' || d.jy < 0.04) continue;
          const hx = d.x + Math.sin(d.face) * 0.18, hz = d.z + Math.cos(d.face) * 0.18, hy = reachY(d) - 0.05;
          if (B.y > 1.7 && reachCheck(d, 'two', 0.015, 0.4)) {
            const pb = clamp(0.5 * ROLES[d.role].block * (d.human ? 0.95 : 0.6 + 0.4 * lvOf(d).ctest), 0, 0.9);
            if (R.next() < pb) {
              B.shot.blocked = true; B.mode = 'loose'; B.rim = 1;
              const away = Math.atan2(B.x - d.x, B.z - d.z);
              B.vx = Math.sin(away) * 3.2 + (B.x - B.shot.x0) * 0.6; B.vz = Math.cos(away) * 3.2 + (B.z - B.shot.z0) * 0.6; B.vy = -1.5;
              B.lastTeam = d.team; B.lastId = d.id; s.stats[d.team].blk++;
              ev('block', { pid: d.id, on: B.shot.id, team: d.team });
              s.shotInfo = null; s.shotClockRun = true;
              break;
            }
          }
        }
      }
    }
    if (B.mode === 'shot' || B.mode === 'loose') {
      // rebounds and loose-ball pickups
      const live = (B.mode === 'loose' || (B.mode === 'shot' && (B.rim > 0 || B.board > 0) && !B.thru)) && (s.phase === 'live' || s.phase === 'ft' || s.phase === 'over' && false);
      if (live && !B.dead) {
        let best = null, bs = -1e9;
        for (const p of P) {
          if (p.out || p.stumble > 0.3) continue;
          if (B.mode === 'shot' && p.team === B.shot?.team && s.t - (B.shot?.relT ?? 0) < 0.35) continue;
          const dd = hyp(p.x - B.x, p.z - B.z);
          const ry = reachY(p);
          const low = B.y < 1.15;
          if (B.y > 0.05 && reachCheck(p, low ? 'scoop' : 'two')) {
            const lv = p.human ? 1 : lvOf(p).reb;
            const sc = ry + 0.45 * ROLES[p.role].reb * lv - dd * 0.6 + R.next() * 0.2 + (p.act && p.act.kind === 'jump' ? 0.25 : 0) - (p.id === B.lastId && s.t - B.pickT < 0.4 ? 5 : 0);
            if (sc > bs) { bs = sc; best = p; }
          }
        }
        if (best) {
          const how = (B.mode === 'shot' || (B.rim > 0)) ? 'rebound' : 'pickup';
          const was = B.mode;
          if (was === 'shot' && B.shot) { resolveMiss(); }
          takeBall(best, how === 'pickup' && best.team !== s.poss ? 'steal2' : how);
          if (how === 'pickup') { s.stats[best.team].stl += 0; }
        }
      }
    }
  }
  function resolveMiss() {
    if (!B.shot || B.shot.scored || B.shot.resolved) return;
    B.shot.resolved = true;
    const sh = B.shot;
    ev('miss', { pid: sh.id, team: sh.team, ft: sh.ft });
    if (sh.fouled) { foulCallShoot(sh); return; }
    if (sh.ft) { /* handled by the FT logic */ }
  }
  function foulCallShoot(sh) {
    sh.fouled = false;
    foulCall(opp(sh.team), sh.foulBy, sh.id, sh.pts === 2 ? 2 : 1);
  }

  // ---- players ----------------------------------------------------------------------------------------------------------------------
  function humanIntent(p, ctl) {
    const mx = ctl.sx || 0, mz = ctl.sz || 0, m = Math.hypot(mx, mz);
    const k = m > 1 ? 1 / m : 1;
    p.in = s.phase === 'ft' || s.phase === 'ready' ? { mx: 0, mz: 0 } : { mx: mx * k, mz: mz * k };   // set pieces (check ball, free throws): everyone stands
  }
  function applyAction(p, plan) {
    const a = plan;
    if (!a) return;
    switch (a.k) {
      case 'shoot': cmdShot(p, a.err ?? 0); break;
      case 'pass': cmdPass(p, a.to); break;
      case 'steal': cmdSteal(p); break;
      case 'jump': cmdJump(p, a.why); break;
      case 'cross': cmdCross(p); break;
      default: break;
    }
  }
  function moveTowardIntent(p, dt, wantX, wantZ) {
    const ms = maxSpeed(p);
    const tvx = wantX * ms, tvz = wantZ * ms;
    const dvx = tvx - p.vx, dvz = tvz - p.vz;
    const dl = Math.hypot(dvx, dvz);
    const acc = (Math.hypot(tvx, tvz) < Math.hypot(p.vx, p.vz) ? 28 : 21) * dt;
    if (dl > acc) { p.vx += (dvx / dl) * acc; p.vz += (dvz / dl) * acc; } else { p.vx = tvx; p.vz = tvz; }
  }
  function updatePlayer(p, dt) {
    for (const k in p.cool) p.cool[k] = Math.max(0, p.cool[k] - dt);
    p.stumble = Math.max(0, p.stumble - dt); p.burst = Math.max(0, p.burst - dt); p.landT = Math.max(0, p.landT - dt);
    if (p.crossT > 0) p.crossT = Math.max(0, p.crossT - dt);
    p.sideT += (p.side - p.sideT) * Math.min(1, dt / 0.10);
    // control intent -> desired velocity
    const inn = p.in || { mx: 0, mz: 0 };
    let wx = inn.mx, wz = inn.mz;
    const act = p.act;
    const airborne = p.jy > 0.001 || p.jvy > 0;
    if (act) {
      if (act.kind === 'shot' || act.kind === 'layup') {
        if (act.layup) {
          // drive towards the hoop during the layup
          const dx = HOOP.x - p.x, dz = HOOP.z + 0.85 - p.z, dl = Math.hypot(dx, dz);
          const spd = Math.min(3.4, dl / 0.35);
          p.vx = dx / Math.max(dl, 0.01) * spd * (s.t < act.tj + 0.55 ? 1 : 0.3); p.vz = dz / Math.max(dl, 0.01) * spd * (s.t < act.tj + 0.55 ? 1 : 0.3);
          if (dl < 0.45) { p.vx *= 0.3; p.vz *= 0.3; }
        } else { const k = Math.exp(-dt * (airborne ? 1.5 : 7)); p.vx *= k; p.vz *= k; }
        wx = wz = null;
      } else if (act.kind === 'pass') { const k = Math.exp(-dt * 2.5); p.vx *= k; p.vz *= k; wx = wz = null; }
      else if (act.kind === 'steal') { wx *= 0.4; wz *= 0.4; }
      else if (act.kind === 'jump') { if (airborne) { const k = Math.exp(-dt * 0.8); p.vx *= k; p.vz *= k; wx = wz = null; } else { wx *= 0.5; wz *= 0.5; } }
    }
    if (p.screenOn) {
      p.setT += dt;
      const k = Math.exp(-dt * 9); p.vx *= k; p.vz *= k; wx = wz = null;
      p.set = p.setT > 0.28 && Math.hypot(p.vx, p.vz) < 0.5;
    } else p.set = false;
    if (wx !== null && !airborne) moveTowardIntent(p, dt, wx, wz);
    p.x += p.vx * dt; p.z += p.vz * dt;
    p.z = clamp(p.z, BOUND.z0, BOUND.z1); { const xl = Math.min(BOUND.x, visHalfWidth(p.z)); p.x = clamp(p.x, -xl, xl); }
    p.speed = Math.hypot(p.vx, p.vz);
    // facing
    let want = p.face;
    const sp = p.speed;
    if (act && (act.kind === 'shot' || act.kind === 'layup')) want = act.face;
    else if (act && act.kind === 'pass') { const to = P[act.to]; want = Math.atan2(to.x - p.x, to.z - p.z); }
    else if (p.faceTo) want = Math.atan2(p.faceTo.x - p.x, p.faceTo.z - p.z);
    else if (sp > 0.6) want = Math.atan2(p.vx, p.vz);
    const dfa = angDiff(want, p.face);
    const rate = (act ? 16 : p.faceTo ? 9 : 10) * dt;
    p.face += clamp(dfa, -rate, rate);
    {
      // the body yaw the picture uses (run in the direction of travel, torso twisted to the facing): the ball rides in THAT frame
      let tgt = p.face;
      if (!(act && (act.kind === 'shot' || act.kind === 'layup' || act.kind === 'pass')) && p.speed > 1.0) { const vd = Math.atan2(p.vx, p.vz), dl = angDiff(p.face, vd); tgt = Math.abs(dl) > 1.75 ? p.face - Math.sign(dl) * 1.75 : vd; }
      const hr = (act ? 34 : 14) * dt, h0 = p.holdYaw ?? tgt;
      p.holdYaw = h0 + clamp(angDiff(tgt, h0), -hr, hr);
    }
    // jumping
    if (act && (act.kind === 'shot' || act.kind === 'layup')) {
      if (s.t >= act.tj && p.jvy === 0 && p.jy === 0 && !act.air) { act.air = true; p.jvy = act.jv; }
    } else if (act && act.kind === 'jump') {
      if (s.t >= act.tj && !act.air) {
        act.air = true; p.jvy = 3.0 * (0.9 + 0.1 * ROLES[p.role].block); ev('jump', { pid: p.id });
        // a contest jump closes on the shooter / ball handler by a step
        if (act.why === 'contest') {
          let tgt = null, bd = 2.6;
          for (const o of P) { if (o.team === p.team || o.out) continue; const dd = hyp(o.x - p.x, o.z - p.z); if (dd < bd && (o.act || (B.mode === 'held' && B.holder === o.id))) { bd = dd; tgt = o; } }
          if (tgt) { const dx = tgt.x - p.x, dz = tgt.z - p.z, dl = Math.hypot(dx, dz) || 1; p.vx = (dx / dl) * 2.2; p.vz = (dz / dl) * 2.2; }
        }
      }
    }
    if (p.jvy !== 0 || p.jy > 0) {
      p.jvy -= G * dt; p.jy += p.jvy * dt;
      if (p.jy <= 0) { p.jy = 0; if (p.jvy < -0.5) { p.landT = 0.18; ev('land', { pid: p.id, v: -p.jvy }); } p.jvy = 0; }
    }
    // dribble phase and floor-contact sound
    if (B.mode === 'held' && B.holder === p.id && !(act && (act.kind === 'shot' || act.kind === 'layup') && s.t > act.tj - 0.06)) {
      const T = dribOf(p).T;
      const before = p.du;
      p.du += dt / T;
      const uf = dribOf(p).uFloor;
      if (before < uf && p.du >= uf) ev('dribble', { pid: p.id, x: B.x, z: B.z });
      if (p.du >= 1) p.du -= 1;
    }
    // end of actions
    if (act) {
      if (act.kind === 'shot' || act.kind === 'layup') {
        if (act.tr === null) {
          let go = false;
          if (act.aiRel !== null) go = s.t >= act.aiRel;
          else if (!act.hold && s.t >= act.t0 + 0.26) go = true;
          else if (s.t >= act.t0 + (act.layup ? 0.56 : 0.64)) go = true;
          if (!act.human && act.aiRel === null && s.t >= act.t0 + 0.44) go = true;
          if (act.ft && go) { /* free throw: standing */ }
          if (go && s.t >= act.t0 + 0.26 - 1e-9) releaseShot(p, act);
        }
        if (s.t >= act.tl && p.jy === 0) { p.act = null; p.landT = 0.1; }
      } else if (act.kind === 'pass') {
        if (!act.done && s.t >= act.tr) { act.done = true; releasePass(p, act); }
        if (s.t >= act.tl) p.act = null;
      } else if (act.kind === 'steal') {
        if (!act.done && s.t >= act.tc) { act.done = true; resolveSteal(p, act); }
        if (s.t >= act.tl) p.act = null;
      } else if (act.kind === 'jump') {
        if (s.t >= act.tl && p.jy === 0) p.act = null;
      }
    }
  }
  function resolveSteal(p, a) {
    if (B.mode === 'held') {
      const h = P[B.holder];
      if (h.team !== p.team) {
        const d = hyp(h.x - p.x, h.z - p.z), bd = hyp(B.x - p.x, B.z - p.z);
        const reach = 0.95;
        const df = Math.cos(angDiff(Math.atan2(h.x - p.x, h.z - p.z), p.face));
        const ok = reachCheck(p, 'swipe') && df > 0.2 && p.jy < 0.05;
        // vulnerable when the ball is away from the hand: low and far from the body
        const dr = dribOf(h);
        const u = h.du, lowness = clamp((0.95 - B.y) / 0.6, 0, 1);
        const exposed = lowness * (0.55 + 0.45 * Math.min(1, hyp(B.x - h.x, B.z - h.z) / 0.35));
        const hl = h.human ? 1 : 0.85 + 0.15 * lvOf(h).skill;
        if (ok) {
          const dskill = (p.human ? 0.85 : 0.6 + 0.3 * lvOf(p).steal) * ROLES[p.role].steal;
          const pst = clamp(0.1 + 0.85 * exposed * dskill - 0.2 * (ROLES[h.role].handle - 0.8) * 0.8, 0.02, 0.85) * (h.crossT > 0 ? 0.4 : 1) * (h.act ? 1.3 : 1) / (0.85 + 0.15 * hl);
          if (R.next() < pst) {
            ev('stealHit', { pid: p.id, from: h.id });
            if (R.next() < 0.55) {
              B.mode = 'loose'; const dir = Math.atan2(p.x - h.x, p.z - h.z) + (R.next() - 0.5) * 1.4;
              B.vx = Math.sin(dir) * 3.2; B.vz = Math.cos(dir) * 3.2; B.vy = 1.4; B.lastTeam = p.team; B.lastId = p.id; B.pickT = s.t;
              h.act = null; s.stats[p.team].stl++; ev('poke', { pid: p.id });
              // the stealer gets a head start on it
            } else { takeBall(p, 'steal'); h.act = null; }
            ev('turnoverSteal', { team: h.team });
            s.stats[h.team].tov++;
            return;
          }
          // a failed reach with contact can be a foul
          if (bd < 0.8 && R.next() < 0.22 + (h.crossT > 0 ? 0 : 0)) { foulCall(p.team, p.id, h.id, 1, true); return; }
        }
        ev('stealMiss', { pid: p.id });
      }
    }
  }
  function collide() {
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const a = P[i], b = P[j];
      if (a.out || b.out) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      const lim = (a.set ? 0.5 : PLAYER_R) + (b.set ? 0.5 : PLAYER_R);
      if (d < lim && d > 1e-4) {
        const nx = dx / d, nz = dz / d, pen = lim - d;
        const wa = a.set ? 0 : 1 * (1 / ROLES[a.role].strong), wb = b.set ? 0 : 1 * (1 / ROLES[b.role].strong);
        const sum = wa + wb; if (sum <= 0) continue;
        a.x -= nx * pen * (wa / sum); a.z -= nz * pen * (wa / sum); b.x += nx * pen * (wb / sum); b.z += nz * pen * (wb / sum);
        // velocity into the other is removed (a screen stops a defender)
        const va = a.vx * nx + a.vz * nz, vb = b.vx * nx + b.vz * nz;
        if (va > 0 && !a.set) { a.vx -= nx * va * 0.9; a.vz -= nz * va * 0.9; }
        if (vb < 0 && !b.set) { b.vx -= nx * vb * 0.9; b.vz -= nz * vb * 0.9; }
        const screener = a.set ? a : b.set ? b : null;
        if (screener) {
          const hit = screener === a ? b : a;
          if (hit.team !== screener.team && !hit.screenedT) { hit.screenedT = 0.3; ev('screened', { pid: hit.id, by: screener.id }); hit.stumble = Math.max(hit.stumble, 0.25); }
        }
      }
    }
    for (const p of P) { if (p.screenedT) { p.screenedT -= DT; if (p.screenedT < 0) p.screenedT = 0; } }
  }
  function outOfBounds() {
    if (B.dead) return;
    if (B.mode === 'pass' || B.mode === 'loose' || B.mode === 'shot') {
      const out = Math.abs(B.x) > HW + 0.1 || B.z > Z_HALF + 0.1 || B.z < Z_BASE - 0.1;
      if (out && B.y < 3.6 && !B.thru) {
        if (B.mode === 'shot' && B.shot) resolveMiss();
        B.dead = true;
        const t = B.lastTeam;
        ev('out', { team: t });
        if (s.drill) { B.mode = 'loose'; return; }
        s.phase = 'dead'; s.deadT = 1.0; s.restart = { kind: 'check', team: opp(t) }; s.last = { team: opp(t), kind: 'turnover', why: 'out', t: s.t };
        s.stats[t].tov++;
        B.mode = 'loose';
      }
    }
  }

  // ---- main update -------------------------------------------------------------------------------------------------------------------------
  function update(dt, ctl = {}) {
    if (s.over) { stepWorldIdle(dt); return; }
    if (s.hold) return;
    s.t += dt; s.tick++;
    const ph = s.phase;
    // intents
    for (const p of P) {
      if (p.out) continue;
      if (p.human) {
        humanIntent(p, ctl);
        applyHumanButtons(p, ctl);
      } else AI.think(X, p, dt, applyAction, cmdScreen, holdHook);
      if (s.hold) { s.t -= dt; s.tick--; return; }
    }
    for (const p of P) { if (!p.out) updatePlayer(p, dt); }
    collide();
    // ball
    if (B.mode === 'held' && P[B.holder].team === s.poss && !s.cleared && isTwo(P[B.holder].x, P[B.holder].z)) { s.cleared = true; ev('cleared', { pid: B.holder }); }
    if (B.mode === 'held') { const h = P[B.holder]; if (!(h.act && h.act.rel && h.act.tr !== null)) heldBallPos(h); }
    else {
      const n = B.mode === 'shot' || B.mode === 'loose' ? 4 : 2;
      for (let i = 0; i < n; i++) stepFlight(dt / n);
      if (B.mode === 'loose' && B.y <= BR + 0.002 && B.vy === 0) { const k = Math.max(0, 1 - 1.3 * dt); B.vx *= k; B.vz *= k; }
      B.spin = Math.max(0, B.spin * (1 - dt * 0.4));
      if (s.phase === 'dead' && (B.mode === 'loose' || B.thru)) { const k = Math.max(0, 1 - 2.2 * dt); B.vx *= k; B.vz *= k; }
    }
    stepBallContacts();
    outOfBounds();
    if (s.drill) sim.drillUpdate();
    // clocks and phases
    if (ph === 'ready') {
      s.timer -= dt;
      // the player who has the ball (check: the defender) moves nowhere; AI repositions
      if (s.timer <= 0) {
        if (s.mode === 'check') {
          const de = opp(s.poss);
          const dg = P[de * 3];
          if (!dg.act && B.mode === 'held') { cmdPass(dg, s.poss * 3, true); }
          if (B.mode === 'held' && B.holder !== dg.id) { startLive(); s.shotClockRun = true; }
          else if (B.mode === 'held' && B.holder === dg.id && dg.act === null && s.timer < -2) { startLive(); }
        } else startLive();
      }
      if (s.mode === 'check' && B.mode === 'held' && P[B.holder].team === s.poss) { startLive(); s.shotClockRun = true; }
    } else if (ph === 'live') {
      s.shotClockRun = s.shotClockRun ?? true;
      if (!s.cfg.noClock && !s.ot) {
        s.clock -= dt;
        if (s.clock <= 0) { s.clock = 0; if (B.mode !== 'shot' && B.mode !== 'pass' && !(P.some((p) => p.act && p.act.kind === 'shot' && p.act.tr === null))) endRegulation(); else s.clockOut = true; }
      }
      if (B.mode === 'held' || B.mode === 'pass') s.shotClock = Math.max(0, s.shotClock - dt);
      else if (B.mode === 'loose' && !B.thru) s.shotClock = Math.max(0, s.shotClock - 0);
      if (s.shotClock <= 0 && s.phase === 'live' && B.mode !== 'shot') {
        ev('shotclock', { team: s.poss });
        const holder = holderP();
        if (holder && holder.act && (holder.act.kind === 'shot' || holder.act.kind === 'layup') && holder.act.tr === null) { /* let the shot go */ }
        else { turnover(s.poss, 'shot clock'); B.mode = 'loose'; B.dead = true; }
      }
      if (s.clockOut && B.mode !== 'shot' && B.mode !== 'pass' && s.phase === 'live') endRegulation();
    } else if (ph === 'dead') {
      s.deadT -= dt;
      if (B.mode === 'loose' || B.mode === 'shot') { /* ball keeps rolling / falling */ }
      if (s.deadT <= 0) {
        if (s.clockOut && !s.over && !s.ot) { endRegulation(); return; }
        const r = s.restart || { kind: 'check', team: s.poss };
        if (r.kind === 'ft') startFT();
        else if (s.pendingFT && r.kind !== 'ft') { startFT(); }
        else setupPossession(r.team, r.kind);
      }
    } else if (ph === 'ft') {
      stepFT(dt);
    }
    // a shot that misses everything: resolve when it lands
    if (B.shot && !B.shot.resolved && !B.shot.scored && B.mode === 'loose' && B.shot && !B.thru) { resolveMiss(); }
    if (B.shot && B.shot.scored && B.mode !== 'shot') { /* nothing */ }
  }
  const smooth = (k) => k * k * (3 - 2 * k);
  function heldBallPos(h) {
    const a = h.act;
    const sinF = Math.sin(h.face), cosF = Math.cos(h.face);
    if (a && (a.kind === 'shot' || a.kind === 'layup') && a.tr === null) {
      // the ball is gathered into the shooting pocket, then lifted overhead for the release
      const T1 = a.layup ? 0.14 : 0.18, t = s.t;
      const kA = smooth(clamp((t - a.t0) / T1, 0, 1));
      const y1 = (a.layup ? 1.7 : 1.5) * h.sc + h.jy;
      const y2 = (a.layup ? 1.90 * h.sc + 0.10 : 1.90 * h.sc + 0.04) + h.jy;
      const fx = h.x + sinF * (a.layup ? 0.2 : 0.12), fz = h.z + cosF * (a.layup ? 0.2 : 0.12);
      let x = a.from.x + (h.x + sinF * 0.27 - a.from.x) * kA, y = a.from.y + (y1 - a.from.y) * kA, z = a.from.z + (h.z + cosF * 0.27 - a.from.z) * kA;
      const t1 = a.t0 + T1 * 0.8;
      const kB = smooth(clamp((t - t1) / Math.max(0.05, a.apexT - t1), 0, 1));
      B.x = x + (fx - x) * kB; B.z = z + (fz - z) * kB; B.y = y + (y2 - y) * kB;
      return;
    }
    if (a && a.kind === 'pass') {
      // carried to the chest and pushed out
      const kk = smooth(clamp((s.t - a.t0) / 0.14, 0, 1));
      const tx = h.x + sinF * 0.30, tz = h.z + cosF * 0.30, ty = 1.30 * h.sc;
      B.x = a.from.x + (tx - a.from.x) * kk; B.z = a.from.z + (tz - a.from.z) * kk; B.y = a.from.y + (ty - a.from.y) * kk;
      return;
    }
    if (s.phase === 'ft' && !a) { B.x = h.x + sinF * 0.26; B.z = h.z + cosF * 0.26; B.y = 1.15 * h.sc; return; }
    heldBall(h);
  }
  function stepWorldIdle(dt) { s.t += dt; for (const p of P) if (!p.out) { p.in = { mx: 0, mz: 0 }; updatePlayer(p, dt); } if (B.mode !== 'held') for (let i = 0; i < 2; i++) stepFlight(dt / 2); }
  function endRegulation() {
    if (s.over) return;
    s.clockOut = false;
    if (s.score[0] !== s.score[1]) { finish(s.score[0] > s.score[1] ? 0 : 1); return; }
    // overtime: first to 2 points
    s.ot = true; s.otTarget = Math.max(s.score[0], s.score[1]) + 2; s.clock = 0;
    ev('overtime', {});
    s.phase = 'dead'; s.deadT = 2.0; s.restart = { kind: 'check', team: opp(s.poss) };
  }
  function stepFT(dt) {
    const f = s.ft; if (!f) return;
    const sh = P[f.shooter];
    f.timer -= dt;
    if (B.mode === 'held' && !sh.act && f.timer <= 0) {
      if (!sh.human) { cmdShot(sh, normal(RA) * lvOf(sh).tErr); }
      else if (s.ftShootReq) { cmdShot(sh, null); }
    }
    if (B.mode === 'shot' || B.mode === 'loose') {
      // wait for the outcome
      if (B.shot && (B.shot.scored)) { if (B.y < 0.5 || B.mode === 'loose') { const sc = true; B.shot.afterFT = true; } }
    }
    if (B.shot && B.shot.ft && !B.shot.ftDone) {
      if (B.shot.scored && B.thru && B.y < HOOP.y - 0.45) { B.shot.ftDone = true; afterFTShot(true); }
      else if (!B.shot.scored && ((B.mode === 'loose' && B.y < 1.0) || (B.rim > 0 && B.y < 2.2 && B.vy < 0 && B.mode !== 'shot')) ) { B.shot.ftDone = true; afterFTShot(false); }
      else if (!B.shot.scored && B.mode === 'shot' && B.y <= 0.6) { B.shot.ftDone = true; afterFTShot(false); }
    }
  }
  function applyHumanButtons(p, ctl) {
    const b = ctl.btn || {};
    const o = (k) => b[k] || {};
    p.faceTo = null;
    const hasBall = B.mode === 'held' && B.holder === p.id;
    const myTeam = p.team;
    if (s.phase === 'ft') { s.ftShootReq = !!(o('a').pressed) && s.ft && s.ft.shooter === p.id; if (p.act) { if (o('a').released || !o('a').down) cmdShotRelease(p); } return; }
    if (s.phase !== 'live') { if (s.phase === 'ready' && hasBall && (o('a').pressed)) { /* wait for live */ } return; }
    if (p.act && (p.act.kind === 'shot' || p.act.kind === 'layup') && p.act.human) { if (!o('a').down) cmdShotRelease(p); }
    if (hasBall) {
      if (o('a').pressed) cmdShot(p, null);
      if (o('b').pressed) cmdPass(p, ctl.passTo ? ctl.passTo[0] : mates(p)[0].id);
      if (o('c').pressed) cmdPass(p, ctl.passTo ? ctl.passTo[1] : mates(p)[1].id);
      if (o('d').pressed) cmdCross(p);
      cmdScreen(p, false);
    } else if (B.mode === 'held' && P[B.holder].team === myTeam) {
      // off the ball: A = call for the ball, B = screen (hold), C = cut (burst), D = jump
      if (o('a').down) p.callT = 0.3; else p.callT = Math.max(0, p.callT - DT);
      cmdScreen(p, !!o('b').down);
      if (o('c').pressed && p.cool.cross <= 0) { p.burst = 0.45; p.cool.cross = 1.1; ev('burst', { pid: p.id }); }
    } else if (B.mode === 'held') {
      // defence: A = steal, B = contest (jump), C = burst
      if (o('a').pressed) cmdSteal(p);
      if (o('b').pressed) cmdJump(p, 'contest');
      if (o('c').pressed && p.cool.cross <= 0) { p.burst = 0.45; p.cool.cross = 1.1; ev('burst', { pid: p.id }); }
      p.faceTo = { x: B.x, z: B.z };
      cmdScreen(p, false);
    } else {
      // ball in the air or loose: A = jump (rebound / block / catch)
      if (o('a').pressed || o('b').pressed) cmdJump(p, 'rebound');
      if (o('c').pressed && p.cool.cross <= 0) { p.burst = 0.4; p.cool.cross = 1.1; }
    }
  }
  const mates = (p) => P.filter((q) => q.team === p.team && q.id !== p.id).sort((a, b) => a.role - b.role);
  const holdHook = (p, decision) => {
    if (!s.cfg.watch) return false;
    if (s.hold || s.t - (s.lastHoldT ?? -9) < 3.5) return false;
    s.lastHoldT = s.t;
    s.hold = { id: s.eid++, team: p.team, pid: p.id, decision };
    ev('hold', { pid: p.id });
    return true;
  };
  function release() { const h = s.hold; s.hold = null; if (h) { const p = P[h.pid]; if (p && p.plan) p.plan.holdCleared = true; } }

  // ---- hint for the human's role (also used by Watch & Learn reasons) ----------------------------------------------------------------
  function suggest() {
    const p = P[s.humanId >= 0 ? s.humanId : 0];
    return AI.suggest(X, p);
  }
  // calibration helper (dev): a lone shot from (x, z) with miss sigma sg at the rim plane; returns 'in' or 'miss' and the rim touches
  function testShot(x, z, sg, layup = false, relYin = null) {
    const x0 = x, z0 = z, d = hyp(x0, z0), relY = relYin ?? (layup ? 2.8 : 2.4);
    const dirx = -x0 / d, dirz = -z0 / d;
    const lat = normal(R) * sg, dep = normal(R) * sg * 1.25;
    const tx = (-dirz) * lat + dirx * dep, tz = dirx * lat + dirz * dep;
    const clearance = layup ? 0.42 : clamp(0.75 + 0.17 * d, 0.9, 2.1), ya = HOOP.y + clearance;
    const vy = Math.sqrt(2 * G * Math.max(0.2, ya - relY)), T = vy / G + Math.sqrt((2 * (ya - HOOP.y)) / G);
    B.mode = 'shot'; B.x = x0; B.y = relY; B.z = z0; B.vx = (tx - x0) / T; B.vz = (tz - z0) / T; B.vy = vy; B.rim = 0; B.board = 0; B.thru = false; B.dead = false; B.age = 0;
    B.shot = { id: 0, team: 0, pts: 1, scored: false, relT: s.t, rimHits: 0 };
    let made = false;
    const saveEv = s.events.length;
    for (let i = 0; i < 60 * 4; i++) { for (let k = 0; k < 4; k++) stepFlight(DT / 4); if (B.thru) { made = true; break; } if (B.y < 0.3 && B.vy < 0) break; }
    s.events.length = 0; s.score = [0, 0];
    return { made, rim: B.rim, board: B.board };
  }
  // the shot meter of the human's current shot: time since the press, where the sweet spot is, how wide it is now
  function meter() {
    const p = P[s.humanId]; const a = p && p.act;
    if (!a || (a.kind !== 'shot' && a.kind !== 'layup') || a.tr !== null) return null;
    const d = hyp(p.x - HOOP.x, p.z - HOOP.z);
    const w = a.ft ? 0.13 : meterWindow(d, contestOf(p.x, p.z, p.team).c, a.layup);
    return { t: s.t - a.t0, apex: a.apexT - a.t0, w, max: a.layup ? 0.56 : 0.64, min: 0.26, layup: a.layup, ft: a.ft };
  }
  const sim = { s, update, release, suggest, testShot, meter, foul: foulCall, X, cmd: { cmdShot, cmdPass, cmdSteal, cmdJump, cmdScreen, cmdCross }, setupPossession, endRegulation, ev };
  // ---- start ---------------------------------------------------------------------------------------------------------------------------
  setupPossession(s.poss, 'check');
  // ---- Learn drills: the real engine with some players parked off the court -----------------------------------------------------------
  const FT_SPOTS = [{ x: 0, z: 4.4 }, { x: -3.2, z: 4.6 }, { x: 3.2, z: 4.6 }, { x: 0, z: 7.4 }, { x: -5.0, z: 5.2 }, { x: 5.0, z: 5.2 }];
  function drillAttempt() {
    const d = s.drill, h = P[s.humanId];
    d.waiting = false; d.resetT = 0; d.hit = false; d.shotSeen = false;
    B.dead = false; B.thru = false; B.shot = null; B.rim = 0; B.board = 0; B.mode = 'held'; s.cleared = true; s.shotClock = SHOT_CLOCK; s.phase = 'live'; s.hold = null;
    for (const p of P) { p.act = null; p.vx = p.vz = 0; p.jy = 0; p.jvy = 0; p.screenOn = false; p.set = false; p.stumble = 0; p.plan = null; p.nextThink = s.t + 0.3; }
    const i = d.n;
    const me = h.team, you = opp(me);
    if (d.kind === 'shoot') {
      const sp = FT_SPOTS[i % FT_SPOTS.length];
      setPlayer(h, sp.x, sp.z, Math.atan2(-sp.x, -sp.z)); s.poss = me; B.holder = h.id; h.du = 0; heldBall(h);
    } else if (d.kind === 'drive') {
      s.poss = me; setPlayer(h, 0, 7.6, Math.PI); B.holder = h.id; h.du = 0; heldBall(h);
      setPlayer(P[you * 3], (i % 2 ? 0.6 : -0.6), 6.2, 0);
    } else if (d.kind === 'screen') {
      s.poss = me; const g = P[me * 3]; setPlayer(g, 0, 7.6, Math.PI); B.holder = g.id; g.du = 0; heldBall(g);
      setPlayer(h, 2.4, 3.2, Math.PI); setPlayer(P[you * 3], 0, 6.3, 0);
    } else if (d.kind === 'defend') {
      s.poss = you; const g = P[you * 3]; setPlayer(g, 0, 7.6, Math.PI); B.holder = g.id; g.du = 0; heldBall(g);
      setPlayer(h, 0, 6.2, 0);
    } else if (d.kind === 'rebound') {
      s.poss = you; const x = [-3, 2.5, 0, -4.5, 4.5][i % 5];
      setPlayer(h, x * 0.4, 2.4, Math.PI);
      // a missed shot comes off the rim: launch it at the front of the ring
      B.mode = 'shot'; B.holder = 0; B.x = x; B.z = 6.5; B.y = 2.3; B.shot = { id: 0, team: you, pts: 2, relT: s.t, rimHits: 0, scored: false, resolved: false };
      const dd = hyp(x, 6.5), T = 1.15;
      const tx = (x / dd) * -0.34 * -1, tz = 0.34;
      B.vx = (tx - x) / T; B.vz = (tz - 6.5) / T; B.vy = (3.3 - 2.3 + 0.5 * G * T * T) / T; B.age = 0; B.lastTeam = you; B.lastId = P[you * 3].id;
    }
    for (const p of P) { p.in = { mx: 0, mz: 0 }; }
  }
  function drillOnEvent(e) {
    const d = s.drill; if (!d || d.waiting) return;
    const me = P[s.humanId];
    let end = false;
    if (d.kind === 'shoot') { if (e.type === 'shot') { d.shotSeen = true; if (e.tq >= 0.65) d.ok++; d.last = { tq: e.tq, c: e.c }; } if (e.type === 'miss' || e.type === 'score' || e.type === 'out') end = true; }
    else if (d.kind === 'drive') { if (e.type === 'shot' && e.pid === me.id) { if (e.layup) { d.ok++; d.hit = true; } } if (e.type === 'miss' || e.type === 'score' || e.type === 'turnover' || e.type === 'out' || e.type === 'shotclock' || e.type === 'turnoverSteal') end = true; }
    else if (d.kind === 'screen') { if (e.type === 'screened' && e.by === me.id && !d.hit) { d.hit = true; d.ok++; } if (e.type === 'miss' || e.type === 'score' || e.type === 'turnover' || e.type === 'out' || e.type === 'shotclock' || e.type === 'turnoverSteal' || e.type === 'poss') end = true; }
    else if (d.kind === 'defend') { if (e.type === 'score') { end = true; d.hit = true; } if (e.type === 'miss' || e.type === 'turnover' || e.type === 'out' || e.type === 'shotclock' || e.type === 'turnoverSteal' || e.type === 'block' || e.type === 'poss') { end = true; d.ok++; } }
    else if (d.kind === 'rebound') { if ((e.type === 'rebound' || e.type === 'pickup' || e.type === 'steal' || e.type === 'steal2') && e.pid === me.id) { d.ok++; d.hit = true; end = true; } if (e.type === 'out' || e.type === 'score') end = true; }
    if (end) { d.n++; d.waiting = true; d.resetT = s.t + 1.4; d.lastOk = d.hit || (d.kind === 'shoot' && d.last && d.last.tq >= 0.65) || (d.kind === 'defend' && !d.hit); ev.call(null, 'drillAttempt', { n: d.n, ok: d.ok }); }
  }
  function drillStart(d) {
    s.drill = { ...d, n: 0, ok: 0, waiting: false, resetT: 0, total: d.total || 5 };
    s.cfg.noClock = true;
    const me = s.humanId;
    for (const p of P) p.out = false;
    const you = opp(P[me].team);
    for (const p of P) {
      if (p.id === me) continue;
      const keep = (d.kind === 'drive' && p.team === you && p.role === 0) || (d.kind === 'screen' && ((p.team === you && p.role === 0) || (p.team === P[me].team && p.role === 0))) || (d.kind === 'defend' && p.team === you && p.role === 0) || (d.kind === 'rebound' && p.team === you && p.role === 0);
      p.out = !keep;
    }
    if (d.kind === 'rebound') P[you * 3].out = true;
    drillAttempt();
  }
  function drillUpdate() {
    const d = s.drill;
    if (!d) return;
    if (d.waiting && s.t >= d.resetT && d.n < d.total) { drillAttempt(); }
    if (d.kind === 'shoot' && !d.waiting && B.mode === 'loose' && B.y < 0.5 && s.t - (B.shot ? B.shot.relT : s.t) > 0.5 && d.shotSeen) { /* an air ball: counted via out or miss */ }
  }
  sim.drillStart = drillStart; sim.drillUpdate = drillUpdate;
  if (cfg.drill) drillStart(cfg.drill);
  if (cfg.resume) { const r = cfg.resume; s.score = [...r.score]; s.fouls = [...r.fouls]; s.clock = r.clock; s.ot = !!r.ot; if (r.otTarget) s.otTarget = r.otTarget; setupPossession(r.poss, 'check'); }
  return sim;
}

