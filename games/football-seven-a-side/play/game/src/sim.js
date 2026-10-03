// The match simulation: 14 players, one ball, the referee and the clock. Pure and deterministic: fixed 1/60 s steps, the seeded stream
// only, no clock. The presenter and the HUD only READ this state. Everything the player can see (positions, kicks, saves) comes from here.
import {
  STEP, HL, HW, GOAL_HW, GOAL_H, GOAL_D, BOX_HW, BOX_D, SPOT, CIRCLE_R, BR, G, PR, ROLES, ANCHOR, KICKOFF_D, LEVELS, MATE_LEVEL, SPEED, ACCEL, DECEL, TURN,
} from './consts.js';
import { clamp, lerp, angDiff, normal, segDist } from './util.js';
import { newBall, stepBall, collideFrame, netBounds, groundSpeed, groundTime, lobSolve, predictPath } from './phys.js';
import { teamThink, playerThink, evalOptions, aiSetPiece } from './ai.js';

const TK = (sec) => Math.max(1, Math.round(sec / STEP));
export const dirOf = (t) => (t === 0 ? 1 : -1);                 // +1: team attacks +z
export const latSign = (t) => (t === 0 ? 1 : -1);               // a team's own left in world x
export const depthOf = (t, z) => (t === 0 ? z + HL : HL - z);     // metres from the team's own goal line
export const toWorld = (t, lat, d) => ({ x: latSign(t) * lat, z: t === 0 ? -HL + d : HL - d });
export const ownGoalZ = (t) => (t === 0 ? -HL : HL);
export const inBox = (t, x, z) => Math.abs(x) <= BOX_HW && depthOf(t, z) <= BOX_D && depthOf(t, z) >= -0.5;   // t's own penalty area

function mkStats(levelIdx, role) {
  const L = LEVELS[clamp(levelIdx, 1, 5) - 1];
  const w = role === 'WL' || role === 'WR', d = role === 'DL' || role === 'DR';
  return {
    lvl: levelIdx, vmax: SPEED.sprint * L.spd + (w ? 0.2 : 0) - (d ? 0.1 : 0) - (role === 'GK' ? 0.5 : 0),
    pass: clamp(L.pass + (role === 'CM' ? 0.06 : 0), 0.1, 1), shot: clamp(L.shot + (role === 'ST' ? 0.08 : role === 'GK' ? -0.2 : 0), 0.1, 1),
    tkl: clamp(L.tackle + (d ? 0.08 : 0) - (role === 'ST' ? 0.1 : 0), 0.1, 1), ctrl: clamp(L.ctrl + (w ? 0.04 : 0), 0.1, 1),
    gk: L.gk, react: L.react, vis: L.vision, press: L.press, line: L.line, dec: L.dec,
  };
}

export function createSim(cfg, rng) {
  const levels = cfg.levels || [MATE_LEVEL, cfg.level || 3];
  const X = {
    rng, cfg,
    s: {
      tick: 0, t: 0, phase: 'kickoff', pt: 1.5, half: 1, clock: cfg.halfSec || 180, score: [0, 0], players: [], ball: newBall(), sp: null, events: [], evN: 0,
      stats: [mkTeamStats(), mkTeamStats()], human: -1, hold: null, hud: null, kickTeam: cfg.kickoffTeam || 0, firstKick: cfg.kickoffTeam || 0, over: false, winner: -1, endFlag: false,
      lastTouch: -1, shotAt: -10, last: null, call: null, drill: cfg.drill || null, dead: null, spec: false, cam: null,
    },
    inp: null, held: { 1: 0, 2: 0, 3: 0, 4: 0 }, path: [], pathAt: -1, holdCool: 3, tm: [{}, {}], pending: null,
  };
  const s = X.s;
  // ---- players ------------------------------------------------------------------------------------------------------------------
  const humanRole = cfg.humanRole || null;
  for (let t = 0; t < 2; t++) {
    ROLES.forEach((role, i) => {
      const id = t * 7 + i;
      const lvl = t === 0 ? (cfg.mateLevels ? cfg.mateLevels[0] : levels[0]) : levels[1];
      const p = {
        id, team: t, role, x: 0, z: 0, vx: 0, vz: 0, face: t === 0 ? 0 : Math.PI, st: mkStats(lvl, role), act: null, stun: 0, stam: 1, jy: 0,
        cmd: { dx: 0, dz: 0, v: 0 }, cd: { ball: 0, tkl: 0, touch: 0 }, tq: null, tx: 0, tz: 0, ai: { at: 0, mode: '', a: 0, b: 0, c: 0 }, cel: 0, human: false, look: -1, hold: 0, spr: 0,
      };
      if (t === 0 && humanRole === role) { p.human = !cfg.shotBot; s.human = id; p.st = mkStats(cfg.humanLevel || 3, role); }
      if (cfg.mods && cfg.mods[t]) for (const k of Object.keys(cfg.mods[t])) p.st[k] = k === 'vmax' ? p.st[k] * cfg.mods[t][k] : cfg.mods[t][k];
      s.players.push(p);
    });
  }
  if (cfg.watch) s.spec = true;
  X.P = s.players;

  const ev = (type, d = {}) => { const e = { id: s.evN++, type, t: s.t, ...d }; s.events.push(e); if (s.events.length > 48) s.events.shift(); return e; };
  X.ev = ev;
  const B = s.ball;
  const P = s.players;
  const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  X.dist2 = dist2;

  function mkTeamStats() { return { shots: 0, onTarget: 0, passes: 0, passOk: 0, tackles: 0, fouls: 0, corners: 0, saves: 0, poss: 0 }; }

  // ---- kick-off / restarts ---------------------------------------------------------------------------------------------------------
  function placeFormation(kickTeam, kind) {
    for (const p of P) {
      const lat = ANCHOR[p.role].lat, d = kind === 'kickoff' ? KICKOFF_D[p.role] : ANCHOR[p.role].d;
      const w = toWorld(p.team, lat, d);
      p.tx = w.x; p.tz = w.z;
    }
    if (kind === 'kickoff') {
      // the kicking team's striker stands on the centre spot; the others wait in their own half, and the defending team outside the circle
      const st = P[kickTeam * 7 + 6]; st.tx = 0; st.tz = -dirOf(kickTeam) * 0.5;
      const cm = P[kickTeam * 7 + 3]; cm.tx = 0; cm.tz = -dirOf(kickTeam) * 3.2;
    }
  }
  function snapAll() { for (const p of P) { p.x = p.tx; p.z = p.tz; p.vx = p.vz = 0; p.act = null; p.stun = 0; p.jy = 0; p.cel = 0; p.face = p.team === 0 ? 0 : Math.PI; } }
  function putBall(x, z) { Object.assign(B, { x, y: BR, z, vx: 0, vy: 0, vz: 0, sp: 0, owner: -1, held: -1 }); }
  function startKickoff(team, instant) {
    s.kickTeam = team; s.phase = 'kickoff'; s.pt = 1.4; s.dead = null;
    putBall(0, 0);
    s.sp = { kind: 'kickoff', team, x: 0, z: 0, taker: team * 7 + 6, t: 0, wait: 1.4, aimx: 0, aimz: 0, ai: !P[team * 7 + 6].human };
    placeFormation(team, 'kickoff');
    if (instant) snapAll();
    X.pending = null;
  }
  X.startKickoff = startKickoff;

  // ---- set pieces --------------------------------------------------------------------------------------------------------------------
  function takerFor(kind, team, x, z) {
    if (kind === 'goalkick') return team * 7;
    if (kind === 'penalty') return team * 7 + 6;
    if (kind === 'free') { const d = depthOf(team, z); return team * 7 + (d > 24 ? 6 : 3); }
    if (kind === 'corner') { let best = -1, bd = 1e9; for (const r of [4, 5, 6, 3]) { const p = P[team * 7 + r]; const dd = Math.hypot(p.x - x, p.z - z) + (Math.sign(p.x) === Math.sign(x) && (r === 4 || r === 5) ? -20 : 0); if (dd < bd) { bd = dd; best = p.id; } } return best; }
    if (kind === 'throw') { let best = -1, bd = 1e9; for (const p of P) if (p.team === team && p.role !== 'GK') { const dd = Math.hypot(p.x - x, p.z - z); if (dd < bd) { bd = dd; best = p.id; } } return best; }
    return team * 7 + 6;
  }
  const WAIT = { kickoff: 1.4, throw: 0.5, goalkick: 1.4, corner: 1.8, free: 1.5, penalty: 2.2 };
  function startSetPiece(kind, team, x, z) {
    // keep the spot inside the lines
    x = clamp(x, -HW + 0.3, HW - 0.3); z = clamp(z, -HL + 0.3, HL - 0.3);
    if (kind === 'throw') x = Math.sign(x) * HW;
    if (kind === 'corner') { x = Math.sign(x || 1) * (HW - 0.25); z = Math.sign(z || 1) * (HL - 0.25); }
    if (kind === 'goalkick') { x = clamp(x, -3, 3); z = Math.sign(z || 1) * (HL - 1.2); }
    if (kind === 'penalty') { x = 0; z = (team === 0 ? 1 : -1) * (HL - SPOT); }
    const taker = takerFor(kind, team, x, z);
    s.sp = { kind, team, x, z, taker, t: 0, wait: WAIT[kind], aimx: 0, aimz: dirOf(team), ready: false, ai: !P[taker].human };
    s.phase = 'setpiece'; s.pt = 0; s.dead = null;
    putBall(x, z); B.last = -1; B.lastTeam = team;
    const tk = P[taker];
    if (kind === 'throw') { B.held = taker; B.owner = taker; }
    // formations: everybody goes to a sensible place for the restart (the AI uses them as targets)
    placeSetPieceTargets(s.sp);
    ev('setpiece', { kind, team, taker, x, z });
    for (const p of P) { p.act = null; if (p.id !== taker) p.hold = 0; }
    tk.ai.sp = 0;
  }
  function placeSetPieceTargets(sp) {
    const { kind, team, x, z } = sp;
    const dd = dirOf(team);
    for (const p of P) {
      const m = ANCHOR[p.role], pos = toWorld(p.team, m.lat, m.d);
      let tx = pos.x, tz = pos.z;
      // shift the block with the restart position
      const bd = depthOf(p.team, z), baseD = m.d, shift = clamp((bd - 19) * 0.45, -6, 6);
      if (p.role !== 'GK') { const w = toWorld(p.team, m.lat, clamp(baseD + shift, 4, 33)); tx = w.x; tz = w.z; }
      if (p.id === sp.taker) { tx = x - (kind === 'throw' ? Math.sign(x) * 0.4 : 0); tz = z - (kind === 'throw' ? 0 : dd * 0.9); if (kind === 'corner') { tx = x - Math.sign(x) * 0.8; tz = z - Math.sign(z) * 0.8; } if (kind === 'goalkick') tz = z - Math.sign(z) * 0.0 - Math.sign(z) * 0.6; if (kind === 'penalty') tz = z - dd * 1.2; p.tx = tx; p.tz = tz; continue; }
      if (kind === 'penalty') {
        if (p.role === 'GK') { tx = 0; tz = ownGoalZ(p.team) - Math.sign(ownGoalZ(p.team)) * 0.2 * -1; tz = ownGoalZ(p.team) + (p.team === 0 ? 0.3 : -0.3); }
        else { const sx = 3.2 * (p.id % 2 ? 1 : -1) + (p.id % 3) * 0.5 * (p.id % 2 ? 1 : -1); tx = clamp(sx + (p.team === 0 ? 1 : -1) * 0, -HW + 1, HW - 1); tz = (z > 0 ? 1 : -1) * (HL - BOX_D - 1.2 - (p.id % 4) * 0.8); }
      } else if (kind === 'corner') {
        // attackers crowd the box, defenders mark; the keeper stays home
        if (p.role !== 'GK') {
          const goalZ = Math.sign(z) * HL;
          if (p.team === team) { const slot = { ST: [0.8, 3.2], CM: [-1.6, 6.5], WL: [3.3, 4.6], WR: [-3.3, 4.6], DL: [3.5, 12], DR: [-3.5, 12] }[p.role]; tx = slot[0]; tz = goalZ - Math.sign(goalZ) * slot[1]; }
          else { const slot = { ST: [-1.2, 12], CM: [1.6, 3.2], WL: [2.6, 2.2], WR: [-2.4, 3.5], DL: [0.4, 6.6], DR: [-1.6, 5.2] }[p.role]; tx = slot[0]; tz = goalZ - Math.sign(goalZ) * slot[1]; }
        }
      } else if (kind === 'free') {
        if (p.team !== team && p.role !== 'GK') {
          // wall / goal-side cover: stay 3.5 m from the ball on the line to the goal, others cover opponents
          const gz = ownGoalZ(p.team), vx = 0 - x, vz = gz - z, l = Math.hypot(vx, vz) || 1;
          const slot = { DL: -0.8, DR: 0.8, CM: 0 }[p.role];
          if (slot !== undefined && depthOf(p.team, z) < 22) { tx = x + vx / l * 3.6 + (-vz / l) * slot; tz = z + vz / l * 3.6 + (vx / l) * slot; }
        }
      }
      if (p.role === 'GK' && kind !== 'penalty' && kind !== 'goalkick') { tx = clamp(x * 0.3, -2, 2); tz = ownGoalZ(p.team) + (p.team === 0 ? 1 : -1) * 1.2; }
      if (p.role === 'GK' && kind === 'goalkick' && p.team !== team) { tx = 0; tz = ownGoalZ(p.team) + (p.team === 0 ? 1 : -1) * 1.2; }
      p.tx = clamp(tx, -HW + 0.5, HW - 0.5); p.tz = clamp(tz, -HL + 0.5, HL - 0.5);
    }
  }
  X.startSetPiece = startSetPiece;

  // ---- fouls and the whistle ---------------------------------------------------------------------------------------------------------
  function foul(by, on, x, z) {
    const st = s.stats[by.team]; st.fouls++;
    ev('foul', { by: by.id, on: on.id, x, z, team: by.team });
    B.vx = B.vz = B.vy = 0; B.owner = -1; B.held = -1;
    const penalty = inBox(by.team, x, z);
    s.dead = { t: 0.9, kind: penalty ? 'penalty' : 'free', team: on.team, x, z };
    s.phase = 'dead';
    for (const p of P) p.act = null;
    on.stun = 0.3;
  }
  function ballOut(kind, team, x, z) {
    B.vx *= 0.2; B.vz *= 0.2;
    s.phase = 'dead'; s.dead = { t: 0.7, kind, team, x, z };
    B.owner = -1; B.held = -1;
    ev('out', { kind, team, x, z });
  }
  function goal(team) {   // `team` scored
    s.score[team]++; s.stats[team].shots += 0;
    s.phase = 'goal'; s.pt = 3.4; s.sp = null;
    const scorer = B.last >= 0 ? P[B.last] : null;
    const own = scorer && scorer.team !== team;
    ev('goal', { team, scorer: scorer ? scorer.id : -1, own, score: [...s.score] });
    if (scorer && !own) { scorer.cel = 1; s.stats[team].onTarget += 0; }
    B.owner = -1; B.held = -1;
    for (const p of P) { p.act = null; }
    placeFormation(1 - team, 'kickoff');
    s.kickTeam = 1 - team;
    const k = placeAfterGoal(team);
    void k;
  }
  function placeAfterGoal() { /* positions for the restart were set by placeFormation */ }

  // ---- actions (used by the human controls and by the AI) --------------------------------------------------------------------------
  const kickWind = { pass: 0.13, through: 0.14, lob: 0.18, cross: 0.19, shot: 0.20, clear: 0.17, volley: 0.12, gk: 0.34, throw: 0.62 };
  X.canAct = (p) => !p.act && p.stun <= 0 && s.phase !== 'goal' && s.phase !== 'half' && s.phase !== 'full';
  // o: { tx, tz, ty, power, curve, tgt }
  // will the ball be within reach of the foot when the kick lands? (rolling ball predicted through the wind-up, the player slowed by it)
  // The body can only kick a ball that is ahead of the hips and a little to the kicking side (the support leg stands beside the ball, never through it).
  // So a kick is planned: where the player must stand (standSpot), how long the pivot and the few steps there take, and which foot is used. A kick whose
  // pivot would take too long is refused (kick() returns false), and the wind-up is lengthened when the player needs a moment to get round the ball.
  const FOOT_F = 0.6, FOOT_L = 0.12, PIVOT_V = 3.4, PIVOT_EXTRA = 0.32;
  const standSpot = (bx, bz, face, foot) => {
    const fx = Math.sin(face), fz = Math.cos(face), lx = Math.cos(face), lz = -Math.sin(face), sg = foot === 'L' ? 1 : -1;
    return { x: bx - fx * FOOT_F - lx * sg * FOOT_L, z: bz - fz * FOOT_F - lz * sg * FOOT_L };
  };
  function kickPlan(p, kind, o) {
    let w = kickWind[kind] * (kind === 'shot' ? 1 - 0.18 * (o.power || 0) : 1);
    let plan = null;
    for (let it = 0; it < 2; it++) {
      const n = TK(w), c = { x: B.x, y: B.y, z: B.z, vx: B.vx, vy: B.vy, vz: B.vz, sp: B.sp };
      for (let i = 0; i < n; i++) stepBall(c, STEP);
      const k = Math.min(w, 0.35) * 0.55, px = p.x + p.vx * k, pz = p.z + p.vz * k;
      const hasAim = o.tx !== undefined && o.tz !== undefined && (o.tx !== 0 || o.tz !== 0);
      const aimA = hasAim ? Math.atan2(o.tx - px, o.tz - pz) : p.face;
      const bx = c.x - px, bz = c.z - pz;
      const lat = bx * Math.cos(aimA) - bz * Math.sin(aimA);
      const foot = lat > FOOT_L ? 'L' : lat < -FOOT_L ? 'R' : (p.id % 5 === 0 ? 'L' : 'R');
      const sp = standSpot(c.x, c.z, aimA, foot);
      const need = Math.max(Math.hypot(sp.x - px, sp.z - pz) / PIVOT_V, Math.abs(angDiff(aimA, p.face)) / 15);
      plan = { w, foot, c, near: Math.hypot(bx, bz), ok: c.y <= (kind === 'volley' ? 0.85 : 0.6) && Math.hypot(bx, bz) <= 1.3 && need <= w + (Math.hypot(B.vx, B.vz) < 1 ? 0.9 : PIVOT_EXTRA) };
      if (need <= w) break;
      w = Math.min(w + (Math.hypot(B.vx, B.vz) < 1 ? 0.9 : PIVOT_EXTRA), need + 0.02);
    }
    return plan;
  }
  // will the ball be where a foot can meet it when the kick lands?
  X.kickable = (p, kind, o = {}) => {
    if (kind === 'throw' || kind === 'gk') return B.held === p.id || B.owner === p.id;
    return kickPlan(p, kind, o).ok;
  };
  X.kick = (p, kind, o = {}) => {
    if (!X.canAct(p)) return false;
    let w = kickWind[kind] * (kind === 'shot' ? 1 - 0.18 * (o.power || 0) : 1), foot;
    if (kind === 'throw' || kind === 'gk') { const bx = B.x - p.x, bz = B.z - p.z, lat = bx * Math.cos(p.face) - bz * Math.sin(p.face); foot = lat > 0.12 ? 'L' : lat < -0.12 ? 'R' : (p.id % 5 === 0 ? 'L' : 'R'); }
    else {
      const pl = kickPlan(p, kind, o);
      if (!o.force && !pl.ok) return false;
      w = pl.w; foot = pl.foot;
    }
    const bx = B.x - p.x, bz = B.z - p.z;
    p.act = { k: 'kick', kind, t0: s.t, tck: s.tick + TK(w), tc: (s.tick + TK(w)) * STEP, t1: (s.tick + TK(w)) * STEP + (kind === 'throw' ? 0.35 : 0.32), tx: o.tx ?? 0, tz: o.tz ?? 0, ty: o.ty ?? 0.6, power: clamp(o.power ?? 0.5, 0, 1), curve: o.curve || 0, tgt: o.tgt ?? -1, foot, done: false, first: Math.hypot(bx, bz) > 0.9 };
    p.look = -1;
    return true;
  };
  X.tackle = (p, slide) => {
    if (!X.canAct(p) || p.cd.tkl > 0 || p.role === 'GK' && slide) return false;
    let dx = Math.sin(p.face), dz = Math.cos(p.face);
    // lunge towards the ball when it is close
    const d = Math.hypot(B.x - p.x, B.z - p.z);
    if (d < 2.5 && d > 0.05 && B.owner !== p.id) { const bx = (B.x - p.x) / d, bz = (B.z - p.z) / d; if (dx * bx + dz * bz > 0.2) { dx = bx; dz = bz; } }
    p.face = Math.atan2(dx, dz);
    const tc = s.tick + TK(slide ? 0.12 : 0.15);
    p.act = { k: slide ? 'slide' : 'tackle', t0: s.t, tck: tc, tc: tc * STEP, t1: s.t + (slide ? 0.95 : 0.55), dx, dz, hit: false, v0: Math.hypot(p.vx, p.vz) };
    p.cd.tkl = slide ? 1.6 : 0.9;
    return true;
  };
  X.head = (p, o = {}) => {
    if (!X.canAct(p)) return false;
    const eta = o.eta ?? 0.28;
    const tc = s.tick + TK(eta);
    p.act = { k: 'head', t0: s.t, tck: tc, tc: tc * STEP, t1: tc * STEP + 0.35, tx: o.tx ?? 0, tz: o.tz ?? 0, power: o.power ?? 0.6, done: false, jmax: o.jmax ?? 0.45, dur: eta };
    return true;
  };
  // dive / jump for a goalkeeper: (dx,dz) horizontal direction (unit or zero), h: 0 low, 1 mid, 2 high
  X.dive = (p, dx, dz, h, reach = 1) => {
    if (!X.canAct(p) || p.cd.tkl > 0) return false;
    const l = Math.hypot(dx, dz);
    if (l > 1e-6) { dx /= l; dz /= l; }
    const jump = l < 0.3;
    p.act = { k: 'dive', t0: s.t, tck: s.tick + TK(0.14), tc: s.t + 0.14, t1: s.t + 1.15, dx: jump ? 0 : dx, dz: jump ? 0 : dz, h, jump, reach: clamp(reach, 0.25, 1), x0: p.x, z0: p.z, hit: false, hx: p.x, hy: 0, hz: p.z };
    p.cd.tkl = 1.7;
    return true;
  };
  X.callFor = (p) => { s.call = { id: p.id, t: s.t }; };

  // ---- the kick itself ---------------------------------------------------------------------------------------------------------------
  const press = (p) => { let m = 9; for (const q of P) if (q.team !== p.team && q.role !== 'GK') { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < m) m = d; } return clamp(1 - (m - 0.8) / 3, 0, 1); };
  X.pressure = press;
  function kickError(p, base, mult = 1) {
    const sp = Math.hypot(p.vx, p.vz) / p.st.vmax;
    return normal(rng) * base * (1 + 0.8 * press(p) + 0.5 * sp) * mult;
  }
  function leadPoint(tgt, d, v0, through) {
    // where a runner will be when the ball arrives
    const T = groundTime(v0, d);
    const k = through ? 1.0 : 0.55;
    const sp = Math.hypot(tgt.vx, tgt.vz);
    const lead = Math.min(through ? 7 : 3.5, sp * T * k);
    const l = sp > 0.2 ? lead / sp : 0;
    return { x: tgt.x + tgt.vx * l, z: tgt.z + tgt.vz * l };
  }
  function launch(p, a) {
    const bx = B.x, bz = B.z;
    let tx = a.tx, tz = a.tz, vy = 0, vh = 10, curve = a.curve || 0, sp = 0;
    const kind = a.kind;
    const st = p.st;
    if (a.tgt >= 0 && (kind === 'pass' || kind === 'through' || kind === 'lob' || kind === 'cross')) {
      const q = P[a.tgt], d0 = Math.hypot(q.x - bx, q.z - bz);
      if (kind === 'lob' || kind === 'cross') { const T0 = 0.75 + d0 * 0.045; const l = Math.min(4, Math.hypot(q.vx, q.vz) * T0 * 0.8); const sq = Math.hypot(q.vx, q.vz) || 1; tx = q.x + q.vx / sq * l; tz = q.z + q.vz / sq * l; }
      else { const v0 = groundSpeed(d0, kind === 'through' ? 7.5 : 6.5); const lp = leadPoint(q, d0, v0, kind === 'through'); tx = lp.x; tz = lp.z; }
    }
    let dx = tx - bx, dz = tz - bz, d = Math.hypot(dx, dz);
    if (d < 0.2) { dx = Math.sin(p.face); dz = Math.cos(p.face); d = 0.2; tx = bx + dx; tz = bz + dz; }
    let ang = Math.atan2(dx, dz);
    if (kind === 'pass' || kind === 'through') {
      const varr = kind === 'through' ? 7.8 : 6.2;
      vh = groundSpeed(d, varr) * (1 + 0.55 * a.power * 0.4) ; vh = Math.min(vh, 24);
      ang += kickError(p, 0.12 * (1 - st.pass) + 0.012, 1);
      vh *= 1 + normal(rng) * (0.05 * (1 - st.pass) + 0.01);
      // a ball struck at the foot: tiny lift only on the harder hits
      vy = vh > 17 ? 0.8 : 0;
    } else if (kind === 'lob' || kind === 'cross') {
      const T = (kind === 'cross' ? 1.0 : 1.0) + d * 0.05 + a.power * 0.1;
      const sol = lobSolve(d, T, BR + Math.max(0, B.y - BR));
      vh = sol.vh; vy = sol.vy;
      ang += kickError(p, 0.10 * (1 - st.pass) + 0.012, 1);
      vh *= 1 + normal(rng) * (0.07 * (1 - st.pass) + 0.012);
      sp = clamp(curve, -1, 1) * 0.5;
    } else if (kind === 'shot') {
      const pw = a.power;
      vh = 15 + 14 * pw;
      const tt = d / (vh * 0.95);
      const ty = a.ty;
      // curl: the ball bends towards the spin side, so aim the other way (a = MAG * sp * v; displacement ~ a t^2 / 2)
      const curlLat = 0.5 * 0.30 * (curve * 0.7) * vh * tt * tt;
      const lateral = curve * 0 ;
      void lateral;
      ang += kickError(p, (0.075 * (1 - st.shot) + 0.012) * (0.8 + 0.7 * pw), 1);
      ang -= curlLat / Math.max(d, 1) * (curve >= 0 ? 1 : 1);
      const tyE = ty + normal(rng) * (0.22 * (1 - st.shot) + 0.03) * (1 + 0.8 * press(p)) * (0.7 + 0.6 * pw);
      vy = (tyE - Math.max(B.y, BR)) / tt + 0.5 * G * tt;
      sp = clamp(curve * 0.7, -1, 1);
      s.stats[p.team].shots++;
      s.shotAt = s.t;
    } else if (kind === 'clear') {
      vh = 16 + 4 * a.power; vy = 5.6 + 2 * a.power;
      ang += kickError(p, 0.10 * (1 - st.pass) + 0.03, 1);
    } else if (kind === 'volley') {
      vh = 13 + 8 * a.power; vy = 2.2;
      ang += kickError(p, 0.12 * (1 - st.shot) + 0.03, 1.3);
    } else if (kind === 'gk') {   // the goalkeeper's kick out of the hands
      const T = 0.9 + d * 0.04; const sol = lobSolve(d, T, 0.4); vh = sol.vh; vy = sol.vy; ang += kickError(p, 0.08 * (1 - st.pass) + 0.02, 1);
    } else if (kind === 'throw') {
      // a throw: ball released at head height towards the target
      const T = 0.45 + d * 0.06; const sol = lobSolve(d, T, 2.0); vh = Math.min(sol.vh, 17); vy = sol.vy; ang += kickError(p, 0.07 * (1 - st.pass) + 0.01, 1);
    }
    B.vx = Math.sin(ang) * vh; B.vz = Math.cos(ang) * vh; B.vy = vy; B.sp = sp;
    if (vy > 0.5 || B.y > BR + 0.02) B.y = Math.max(B.y, BR + 0.02);
    B.owner = -1; B.held = -1; B.last = p.id; B.lastTeam = p.team;
    p.cd.ball = kind === 'throw' ? 0.5 : 0.32;
    s.lastTouch = p.id;
    if (kind === 'pass' || kind === 'through' || kind === 'lob' || kind === 'cross') { s.stats[p.team].passes++; X.pending = { pid: p.id, tgt: a.tgt, t: s.t, team: p.team }; }
    else X.pending = null;
    const e = ev('kick', { pid: p.id, kind, bx, bz, by: B.y, vx: B.vx, vy: B.vy, vz: B.vz, foot: a.foot, power: a.power, tgt: a.tgt });
    return e;
  }

  // ---- ball / player interactions --------------------------------------------------------------------------------------------------------
  function claim(p, soft) {
    B.owner = p.id; B.last = p.id; B.lastTeam = p.team; s.lastTouch = p.id;
    p.cd.touch = 0.12;
    if (X.pending && X.pending.team === p.team && X.pending.pid !== p.id) { s.stats[p.team].passOk++; X.pending = null; }
    else if (X.pending && X.pending.team !== p.team) X.pending = null;
    if (!soft) B.vx *= 0.35, B.vz *= 0.35;
    ev('control', { pid: p.id });
  }
  function dribble(p, dt) {
    const sp = Math.hypot(p.vx, p.vz);
    const hx = Math.sin(p.face), hz = Math.cos(p.face);
    const rx = B.x - p.x, rz = B.z - p.z, rd = Math.hypot(rx, rz);
    p.cd.touch -= dt;
    if (sp < 0.7 && !p.cmd.v) {
      // standing: the ball rests at the foot on the side away from the nearest opponent
      let ox = 0, oz = 0, om = 4;
      for (const q of P) if (q.team !== p.team) { const dd = Math.hypot(q.x - p.x, q.z - p.z); if (dd < om) { om = dd; ox = q.x - p.x; oz = q.z - p.z; } }
      let fx = hx, fz = hz;
      if (om < 2.5) { const l = Math.hypot(ox, oz) || 1; fx = hx * 0.8 - ox / l * 0.6; fz = hz * 0.8 - oz / l * 0.6; const m = Math.hypot(fx, fz) || 1; fx /= m; fz /= m; }
      const wx = p.x + fx * 0.42, wz = p.z + fz * 0.42;
      B.vx += (wx - B.x) * 14 * dt - B.vx * 6 * dt; B.vz += (wz - B.z) * 14 * dt - B.vz * 6 * dt;
      if (rd < 0.9 && Math.hypot(B.vx, B.vz) < 1.2) { B.x = lerp(B.x, wx, Math.min(1, 9 * dt)); B.z = lerp(B.z, wz, Math.min(1, 9 * dt)); }
      return;
    }
    // running: take a touch when the ball is near the feet and ahead of / beside the runner. The touch is announced 4 ticks ahead
    // (p.tq = { tck, foot }) so the picture can bring the foot to the ball and meet it on exactly that tick.
    const ahead = rx * hx + rz * hz;
    if (p.tq && s.tick > p.tq.tck + 3) p.tq = null;
    if (p.tq) {
      if (s.tick >= p.tq.tck) {
        const t = p.tq; p.tq = null;
        // the foot can only meet a ball that is still ahead of the hips, near the line of the legs and on the ground
        const latNow = rx * hz - rz * hx;
        if (rd < 1.0 && ahead >= 0.14 && Math.abs(latNow) <= 0.5 && B.y <= 0.3) {
          const cx = p.cmd.dx || hx, cz = p.cmd.dz || hz;
          const sprint = sp > p.st.vmax * 0.85;
          const v = clamp(sp + 3.0 * (0.62 - clamp(ahead, 0, 1.2)) + (sprint ? 0.25 : 0), 2.0, sp + 1.7 + (sprint ? 0.4 : 0));   // a touch that keeps the ball about 0.6 m ahead of the hips
          B.vx = cx * v; B.vz = cz * v; B.sp = 0;
          p.cd.touch = 0.14 + (sprint ? 0.08 : 0.04);
          ev('touch', { pid: p.id, foot: t.foot, x: B.x, z: B.z, vx: B.vx, vz: B.vz });
        }
      }
    } else if (p.cd.touch <= 0 && rd < 0.95 && B.y <= 0.3) {
      // announce the touch only when the ball will still be ahead of the hips (and near the line of the legs) when the foot arrives 4 ticks later
      const ahead4 = ahead + ((B.vx - p.vx) * hx + (B.vz - p.vz) * hz) * (4 * STEP);
      const lat4 = (rx + (B.vx - p.vx) * 4 * STEP) * hz - (rz + (B.vz - p.vz) * 4 * STEP) * hx;
      if (ahead4 >= 0.2 && ahead4 <= 1.0 && Math.abs(lat4) <= 0.45) p.tq = { tck: s.tick + 4, foot: ((p.id + s.tick) >> 3) % 2 ? 'L' : 'R' };
    }
  }
  function ballInteract(dt) {
    if (B.held >= 0) {
      const h = P[B.held];
      if (h.act && h.act.k === 'kick' && h.act.kind === 'throw') { B.x = h.x + Math.sin(h.face) * 0.1; B.z = h.z + Math.cos(h.face) * 0.1; B.y = 2.05; B.vx = B.vz = B.vy = 0; }
      else { B.x = h.x + Math.sin(h.face) * 0.35; B.z = h.z + Math.cos(h.face) * 0.35; B.y = h.role === 'GK' ? 1.05 : 1.3; B.vx = B.vz = B.vy = 0; }
      return;
    }
    // GK hands first
    for (const g of [P[0], P[7]]) gkHands(g);
    if (B.held >= 0) return;
    if (B.owner >= 0) {
      const o = P[B.owner];
      const d = Math.hypot(B.x - o.x, B.z - o.z);
      const busy = o.act && (o.act.k === 'slide' || o.act.k === 'dive' || o.act.k === 'head');
      if (d > 1.15 || B.y > 0.9 || busy || o.stun > 0.25 && d > 0.8) { B.owner = -1; }
      else if (!(o.act && o.act.k === 'kick')) { dribble(o, dt); return; }
      else return;
    }
    // loose ball: the nearest player who can control it
    if (B.y > 1.0) return;
    let best = null, bd = 1e9;
    for (const p of P) {
      if (p.cd.ball > 0 || p.stun > 0 || (p.act && p.act.k !== 'tackle' && p.act.k !== 'kick' || p.act && p.act.k === 'kick')) continue;
      if (p.role === 'GK' && B.y > 0.6) continue;
      const d = Math.hypot(B.x - p.x, B.z - p.z);
      const cr = 0.5 + (p.act ? 0.08 : 0);
      if (d < cr && d < bd) { bd = d; best = p; }
    }
    if (!best) return;
    const p = best;
    const rs = Math.hypot(B.vx - p.vx, B.vz - p.vz);
    const band = B.y > 0.45 ? 0.8 : 1;
    const limit = (8 + 8 * p.st.ctrl) * band;
    if (rs <= limit) claim(p, rs < 4);
    else {
      // too hard to control: it is blocked or deflected
      const k = 0.35 + 0.15 * (1 - p.st.ctrl);
      const a = Math.atan2(B.vx, B.vz) + normal(rng) * 0.9;
      const sp = Math.hypot(B.vx, B.vz) * k;
      B.vx = Math.sin(a) * sp * 0.6 + p.vx * 0.5; B.vz = Math.cos(a) * sp * 0.6 + p.vz * 0.5;
      if (B.vy > 2) B.vy *= 0.5;
      p.cd.ball = 0.28; B.last = p.id; B.lastTeam = p.team; s.lastTouch = p.id;
      if (rs > 12) ev('block', { pid: p.id, x: B.x, z: B.z });
      else ev('heavy', { pid: p.id });
      X.pending = null;
    }
  }

  // ---- goalkeepers ----------------------------------------------------------------------------------------------------------------------
  function gkHands(g) {
    if (B.held >= 0 || g.stun > 0.4) return;
    if (B.lastTeam === g.team && B.last !== g.id && B.last >= 0 && B.owner >= 0 && B.owner !== g.id) return;
    const inArea = inBox(g.team, g.x, g.z) || inBox(g.team, B.x, B.z);
    const bs = Math.hypot(B.vx, B.vy, B.vz);
    const a = g.act && g.act.k === 'dive' ? g.act : null;
    // where are the hands: standing hands cover a 0.8 m disc in front, a dive extends sideways along a measured path
    let hx, hy, hz, r;
    if (a) {
      const age = s.t - a.t0;
      if (age < 0.1 || age > 0.95) return;
      const ext = clamp((age - 0.1) / 0.3, 0, 1); const e = 1 - (1 - ext) * (1 - ext);
      const reach = a.jump ? 0 : (1.05 * e + 0.35) * (a.reach ?? 1);
      hx = g.x + a.dx * reach; hz = g.z + a.dz * reach;
      hy = a.jump ? 0.9 + 1.2 * e : (a.h === 2 && age > 0.4 ? 1.38 : [0.35, 0.95, 1.65][a.h]);
      r = a.jump ? 0.6 : 0.24;
      a.hx = hx; a.hy = hy; a.hz = hz;
    } else {
      if (g.act) return;
      if (B.y < 0.85 && bs > 7) return;          // a hard ground ball is beyond a standing keeper's hands: a dive (or the feet) must deal with it
      hx = g.x + Math.sin(g.face) * 0.25; hz = g.z + Math.cos(g.face) * 0.25; hy = clamp(B.y, 0.25, 1.9); r = bs > 7 ? 0.35 : 0.5;
    }
    if (B.owner === g.id) return;
    if (!a && bs > 7) return;     // a standing keeper's arms only reach so far from the shoulders
    const d = Math.hypot(B.x - hx, B.y - hy, B.z - hz);
    if (d > r + BR) return;
    if (B.cdG && B.cdG > s.t) return;
    // a ball that is not travelling fast is simply picked up in the area; a shot is caught or parried
    const ground = B.y < 0.35 && bs < 9;
    const stand = !a;
    let pcatch = 0.93 - 0.045 * Math.max(0, bs - 8) + 0.22 * (g.st.gk - 0.5) - 0.35 * (d / (r + BR)) * (stand ? 1 : 0.7);
    pcatch = clamp(pcatch, 0.06, 0.97);
    const fromOpp = B.lastTeam !== g.team;
    if (!inArea && !(g.act)) { return; }
    if (!fromOpp && B.owner < 0 && bs < 4 && ground) return;       // a back-pass rolling slowly is dealt with by the feet code
    if (rng.next() < pcatch && (inArea)) {
      B.held = g.id; B.owner = g.id; B.last = g.id; B.lastTeam = g.team; B.vx = B.vz = B.vy = 0; g.hold = 0.01; s.lastTouch = g.id;
      g.act = a ? { ...a, hit: true, t1: s.t + 0.6 } : null; g.hold = 0.001;
      if (a) g.act.k = 'dive';
      s.stats[g.team].saves += fromOpp && s.t - s.shotAt < 3 ? 1 : 0;
      ev('save', { pid: g.id, kind: 'catch', x: B.x, y: B.y, z: B.z, hx, hy, hz, speed: bs });
      X.pending = null;
    } else {
      // parry: pushed away from goal, towards the sides, softer than it came
      const away = g.team === 0 ? 1 : -1;
      const sx = (B.x - g.x) >= 0 ? 1 : -1;
      const sp2 = clamp(bs * 0.5, 3, 11);
      B.vx = sx * sp2 * (0.35 + 0.5 * rng.next()); B.vz = away * sp2 * (0.3 + 0.5 * rng.next()); B.vy = Math.max(1.5, Math.abs(B.vy) * 0.4 + 1.2 * rng.next());
      B.last = g.id; B.lastTeam = g.team; B.owner = -1; B.cdG = s.t + 0.5; s.lastTouch = g.id;
      g.cd.ball = 0.4;
      s.stats[g.team].saves += fromOpp && s.t - s.shotAt < 3 ? 1 : 0;
      ev('save', { pid: g.id, kind: 'parry', x: B.x, y: B.y, z: B.z, hx, hy, hz, speed: bs });
      X.pending = null;
    }
  }

  // ---- acts in progress ------------------------------------------------------------------------------------------------------------------
  function actStep(p, dt) {
    const a = p.act; if (!a) return;
    const tNow = s.tick * STEP;
    if (a.k === 'kick') {
      // plant and turn to the target; keep a little momentum
      const aimA = a.kind === 'throw' || a.tz !== 0 || a.tx !== 0 ? Math.atan2(a.tx - p.x, a.tz - p.z) : p.face;
      if (!a.done) {
        const df = angDiff(aimA, p.face); const mx = (a.kind === 'throw' ? 7 : 15) * dt; p.face += clamp(df, -mx, mx);
        if (a.kind !== 'throw' && a.kind !== 'gk') pivotStep(p, a, dt);
        if (s.tick >= a.tck) { a.done = true; doKickContact(p, a); }
      }
      if (tNow >= a.t1 - 1e-9) p.act = null;
    } else if (a.k === 'tackle' || a.k === 'slide') {
      const slide = a.k === 'slide';
      const age = tNow - a.t0;
      if (!a.hit && tNow >= a.tc - 1e-9 && age < (slide ? 0.62 : 0.30)) tackleReach(p, a, slide);
      if (tNow >= a.t1 - 1e-9) { p.act = null; p.stun = Math.max(p.stun, slide ? 0.6 : 0.12); }
    } else if (a.k === 'head') {
      const age = tNow - a.t0;
      const u = clamp((age) / a.dur, 0, 1.2);
      p.jy = a.jmax * Math.max(0, 1 - Math.pow((u - 1) , 2) * 1.0);
      if (!a.done && s.tick >= a.tck) { a.done = true; doHead(p, a); }
      if (tNow >= a.t1 - 1e-9) { p.act = null; p.jy = 0; }
    } else if (a.k === 'dive') {
      if (tNow >= a.t1 - 1e-9) { p.act = null; p.stun = 0.1; }
    }
  }
  // during the wind-up the player steps round the ball (at most PIVOT_V) so it lands ahead of the hips on the kicking side where the foot can meet it
  function pivotStep(p, a, dt) {
    const m = a.tck - s.tick;
    if (m < 1) return;
    const c = { x: B.x, y: B.y, z: B.z, vx: B.vx, vy: B.vy, vz: B.vz, sp: B.sp };
    for (let i = 0; i < m; i++) stepBall(c, STEP);
    const sp = standSpot(c.x, c.z, p.face, a.foot);
    const dx = sp.x - p.x, dz = sp.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.004) return;
    const k = Math.min(1, PIVOT_V * dt / d);
    p.x += dx * k; p.z += dz * k;
    a.sx = sp.x; a.sz = sp.z;
  }
  function doKickContact(p, a) {
    // can the foot reach the ball now?
    const dx = B.x - p.x, dz = B.z - p.z, d = Math.hypot(dx, dz);
    const owner = B.owner >= 0 ? P[B.owner] : null;
    const stolen = owner && owner.team !== p.team && Math.hypot(owner.x - B.x, owner.z - B.z) < 0.7;
    const reach = a.kind === 'volley' ? 1.2 : 1.1;
    const thr = a.kind === 'throw' || a.kind === 'gk';
    const fwdC = dx * Math.sin(p.face) + dz * Math.cos(p.face), latC = dx * Math.cos(p.face) - dz * Math.sin(p.face), lkC = a.foot === 'L' ? latC : -latC;
    const ok = d <= reach && B.y <= (thr ? 3 : 1.05) && !stolen && (B.held < 0 || B.held === p.id) && (thr || (fwdC >= 0.05 && lkC >= -0.35 && Math.abs(latC) <= 0.75));
    if (!ok) { ev('whiff', { pid: p.id, x: B.x, z: B.z, kind: a.kind }); if (a.kind === 'throw' || a.kind === 'gk') { B.held = -1; } p.cd.ball = 0.25; return; }
    // a volley is taken on the full toe: raise the strength
    const o = { ...a, foot: a.foot };
    if (B.y > 0.4 && a.kind !== 'throw' && a.kind !== 'gk') { o.kind = a.kind === 'shot' ? 'shot' : a.kind; }
    if (a.kind === 'gk' && B.held === p.id) B.y = 0.42;     // a keeper's punt: the dropped ball is struck low (the picture drops it from the hands to that height)
    launch(p, o);
    if (a.kind === 'throw' || a.kind === 'gk') p.hold = 0;
    if (s.phase === 'setpiece') { s.phase = 'play'; s.sp = null; }
  }
  function doHead(p, a) {
    const hx = p.x + Math.sin(p.face) * 0.15, hz = p.z + Math.cos(p.face) * 0.15, hy = 1.72 + p.jy;
    const d = Math.hypot(B.x - hx, B.y - hy, B.z - hz);
    const fH = (B.x - p.x) * Math.sin(p.face) + (B.z - p.z) * Math.cos(p.face);
    if (d > 0.8 || Math.hypot(B.x - hx, B.z - hz) > 0.45 || fH < -0.05 || B.held >= 0) { ev('whiff', { pid: p.id, x: B.x, z: B.z, kind: 'head' }); return; }
    const dx = a.tx - B.x, dz = a.tz - B.z, l = Math.hypot(dx, dz) || 1;
    let ang = Math.atan2(dx, dz) + normal(rng) * (0.11 * (1 - p.st.shot) + 0.03) * (1 + 0.7 * press(p));
    const v = 6 + 10 * a.power;
    B.vx = Math.sin(ang) * v; B.vz = Math.cos(ang) * v; B.vy = a.power > 0.55 ? -1.2 - 2.5 * a.power : 2.2; B.sp = 0;
    B.y = Math.max(B.y, BR + 0.05);
    B.owner = -1; B.held = -1; B.last = p.id; B.lastTeam = p.team; p.cd.ball = 0.4; s.lastTouch = p.id;
    void l;
    const goalward = Math.abs(a.tz) >= HL - 0.5 && Math.abs(a.tx) <= GOAL_HW;
    if (goalward) { s.stats[p.team].shots++; s.shotAt = s.t; }
    ev('head', { pid: p.id, bx: B.x, by: B.y, bz: B.z, vx: B.vx, vy: B.vy, vz: B.vz, shot: goalward });
    X.pending = null;
    if (s.phase === 'setpiece') { s.phase = 'play'; s.sp = null; }
  }
  function tackleReach(p, a, slide) {
    // the foot point and its radius
    const fx = p.x + a.dx * (slide ? 0.85 : 0.6), fz = p.z + a.dz * (slide ? 0.85 : 0.6);
    const rr = slide ? 0.9 : 0.62;
    const dBall = Math.hypot(B.x - fx, B.z - fz);
    const owner = B.owner >= 0 && P[B.owner].team !== p.team ? P[B.owner] : null;
    const ballHere = dBall <= rr && B.y < 0.5 && B.held < 0;
    if (!ballHere) {
      // no ball: bumping into an opponent is a foul
      for (const q of P) {
        if (q.team === p.team || q.act && q.act.k === 'dive') continue;
        const dd = Math.hypot(q.x - fx, q.z - fz);
        if (dd < 0.5 && (slide || owner === q)) {
          if (rng.next() < (slide ? 0.78 : 0.45)) { a.hit = true; foul(p, q, q.x, q.z); return; }
        }
      }
      return;
    }
    a.hit = true;
    if (!owner) {
      // loose ball: simply win it
      const sp = 4.5 + 2 * rng.next();
      B.vx = a.dx * sp + p.vx * 0.3; B.vz = a.dz * sp + p.vz * 0.3; B.owner = -1; B.last = p.id; B.lastTeam = p.team; p.cd.ball = slide ? 0.2 : 0;
      s.lastTouch = p.id; ev('tackle', { pid: p.id, ok: true, slide, x: B.x, z: B.z, on: -1 });
      return;
    }
    const o = owner;
    const hx = Math.sin(o.face), hz = Math.cos(o.face);
    const behind = a.dx * hx + a.dz * hz;                        // > 0.5: tackling from behind
    const front = -(a.dx * hx + a.dz * hz);
    let pw = 0.30 + 0.5 * p.st.tkl - 0.32 * o.st.ctrl + (slide ? 0.14 : 0) + front * 0.1 - (Math.hypot(o.vx, o.vz) > o.st.vmax * 0.85 ? 0.08 : 0);
    pw = clamp(pw, 0.08, 0.9);
    const win = rng.next() < pw;
    s.stats[p.team].tackles += win ? 1 : 0;
    if (win) {
      const sp = 4 + 3 * rng.next();
      const ang = Math.atan2(a.dx, a.dz) + normal(rng) * 0.5;
      B.vx = Math.sin(ang) * sp; B.vz = Math.cos(ang) * sp; B.owner = -1; B.last = p.id; B.lastTeam = p.team; s.lastTouch = p.id;
      o.stun = 0.42; o.vx *= 0.3; o.vz *= 0.3; o.cd.ball = 0.35; p.cd.ball = 0;
      const fp = slide ? (behind > 0.5 ? 0.42 : 0.07) : (behind > 0.6 ? 0.18 : 0.03);
      ev('tackle', { pid: p.id, ok: true, slide, x: B.x, z: B.z, on: o.id });
      if (rng.next() < fp) foul(p, o, o.x, o.z);
    } else {
      // beaten: the carrier rides the challenge, and a mistimed one is a foul
      ev('tackle', { pid: p.id, ok: false, slide, x: B.x, z: B.z, on: o.id });
      const dd = Math.hypot(o.x - p.x, o.z - p.z);
      if (dd < 0.85 && rng.next() < (slide ? 0.6 : 0.3)) foul(p, o, o.x, o.z);
      else p.stun = Math.max(p.stun, 0.3);
    }
  }

  // ---- movement ---------------------------------------------------------------------------------------------------------------------------
  function movePlayer(p, dt) {
    const a = p.act;
    let dvx, dvz, accel = ACCEL, turn = TURN;
    if (p.stun > 0) { p.stun -= dt; }
    if (p.cd.ball > 0) p.cd.ball -= dt;
    if (p.cd.tkl > 0) p.cd.tkl -= dt;
    let sp = 0, dx = 0, dz = 0;
    const cmd = p.cmd;
    sp = Math.min(cmd.v, p.st.vmax); dx = cmd.dx; dz = cmd.dz;
    if (p.stun > 0) sp *= 0.1;
    // sprinting drains stamina
    const fast = sp > p.st.vmax * 0.82;
    p.stam = clamp(p.stam + (fast ? -0.16 : sp < 1 ? 0.12 : 0.05) * dt, 0, 1);
    if (p.stam < 0.04) sp = Math.min(sp, p.st.vmax * 0.8);
    if (B.owner === p.id) sp = Math.min(sp, p.st.vmax * 0.93);
    if (a) {
      if (a.k === 'kick') { sp = Math.min(sp, a.kind === 'throw' || a.kind === 'gk' ? 0 : 2.4); if (a.kind === 'shot') sp = Math.min(sp, 1.6); }
      else if (a.k === 'tackle') { const age = s.t - a.t0; dx = a.dx; dz = a.dz; sp = age < 0.3 ? 4.2 : 0; accel = 30; }
      else if (a.k === 'slide') { const age = s.t - a.t0; dx = a.dx; dz = a.dz; sp = Math.max(0, 6.2 - age * 6.8); accel = 40; turn = 0; if (age > 0.7) sp = 0; }
      else if (a.k === 'head') { sp = Math.min(sp, 1.8); }
      else if (a.k === 'dive') {
        const age = s.t - a.t0;
        if (a.jump) sp = 0;
        else { dx = a.dx; dz = a.dz; const e = clamp((age - 0.08) / 0.3, 0, 1); sp = age < 0.08 ? 0 : e < 1 ? 5.4 * (a.reach ?? 1) * (1 - e * e) : 0; accel = 60; }
        turn = 0;
      }
    }
    if (p.hold > 0 || B.held === p.id) sp = Math.min(sp, a ? sp : 3.0);
    const tvx = dx * sp, tvz = dz * sp;
    dvx = tvx - p.vx; dvz = tvz - p.vz;
    const dl = Math.hypot(dvx, dvz);
    const lim = (sp * sp < p.vx * p.vx + p.vz * p.vz ? DECEL : accel) * dt;
    if (dl > lim) { dvx *= lim / dl; dvz *= lim / dl; }
    p.vx += dvx; p.vz += dvz;
    const spd = Math.hypot(p.vx, p.vz);
    // facing
    if (!(a && (a.k === 'kick' || a.k === 'dive' || a.k === 'slide' || a.k === 'tackle'))) {
      let want = null;
      if (spd > 0.9) want = Math.atan2(p.vx, p.vz);
      else if (p.look >= 0) want = Math.atan2(P[p.look].x - p.x, P[p.look].z - p.z);
      else if (cmd.fx !== undefined && (cmd.fx || cmd.fz)) want = Math.atan2(cmd.fx, cmd.fz);
      else want = Math.atan2(B.x - p.x, B.z - p.z);
      if (want !== null) p.face += clamp(angDiff(want, p.face), -turn * dt, turn * dt) * (spd > 0.9 ? 1 : 0.6);
    }
    p.x += p.vx * dt; p.z += p.vz * dt;
    // keep inside the pitch (plus the run-off for throw-ins)
    p.x = clamp(p.x, -HW - 1.0, HW + 1.0); p.z = clamp(p.z, -HL - 0.8, HL + 0.8);
    if (p.cel > 0) p.cel += dt;
  }
  function separate() {
    for (let i = 0; i < 14; i++) {
      const a = P[i];
      for (let j = i + 1; j < 14; j++) {
        const b = P[j];
        const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
        const busyAct = (q) => q.act && (q.act.k === 'tackle' || q.act.k === 'kick' || q.act.k === 'head');
        const R = 2 * PR * 1.12 + ((busyAct(a) && busyAct(b)) ? 0.45 : (busyAct(a) || busyAct(b)) ? 0.25 : 0);   // bodies mid-action (kick, tackle, header) keep more room
        if (d2 >= R * R || d2 < 1e-8) continue;
        const d = Math.sqrt(d2), push = (R - d) * 0.5, nx = dx / d, nz = dz / d;
        const ma = a.act && (a.act.k === 'slide' || a.act.k === 'dive') ? 0.2 : 1, mb = b.act && (b.act.k === 'slide' || b.act.k === 'dive') ? 0.2 : 1;
        a.x -= nx * push * ma; a.z -= nz * push * ma; b.x += nx * push * mb; b.z += nz * push * mb;
      }
    }
  }
  function enforceRestrictions() {
    const sp = s.sp; if (!sp) return;
    const bx = sp.x, bz = sp.z;
    for (const p of P) {
      if (p.id === sp.taker) continue;
      let minD = 0;
      if (sp.kind === 'kickoff') { if (p.team !== sp.team) minD = CIRCLE_R; }
      else if (sp.kind === 'free' || sp.kind === 'corner') { if (p.team !== sp.team) minD = 3.0; }
      else if (sp.kind === 'throw') { if (p.team !== sp.team) minD = 2.0; }
      else if (sp.kind === 'goalkick') { if (p.team !== sp.team) minD = 0; }
      if (minD > 0) { const dx = p.x - bx, dz = p.z - bz, d = Math.hypot(dx, dz); if (d < minD) { const k = d < 1e-6 ? 1 : 0; const nx = d < 1e-6 ? 0 : dx / d, nz = d < 1e-6 ? -dirOf(sp.team) : dz / d; void k; p.x = bx + nx * minD; p.z = bz + nz * minD; } }
      if (sp.kind === 'kickoff') { // everybody stays in their own half until the kick
        if (p.team === 0 && p.z > -0.2) p.z = -0.2; if (p.team === 1 && p.z < 0.2) p.z = 0.2;
      }
      if (sp.kind === 'goalkick' && p.team !== sp.team) { // opponents stay outside the penalty area
        const d = depthOf(sp.team === 0 ? 1 : 0, p.z); void d;
        const sz = Math.sign(sp.z);
        if (Math.abs(p.x) < BOX_HW + 0.5 && (p.z - sz * HL) * -sz < BOX_D + 0.5 && p.z * sz > HL - BOX_D - 0.5) p.z = sz * (HL - BOX_D - 0.6);
      }
      if (sp.kind === 'penalty') {
        const gk = P[(sp.team === 0 ? 1 : 0) * 7];
        const sz = Math.sign(sp.z);
        if (p.id !== gk.id) { if (Math.abs(p.x) < BOX_HW + 1 && p.z * sz > HL - BOX_D - 1.0) { p.z = sz * (HL - BOX_D - 1.1); } }
        else { if (!sp.live) p.z = sz * HL - sz * 0.3; }
      }
    }
  }

  // ---- human controls -----------------------------------------------------------------------------------------------------------------------
  X.setInput = (inp) => { X.inp = inp; };
  const aimDir = (p, inp) => { const l = Math.hypot(inp.mx, inp.mz); return l > 0.25 ? { x: inp.mx / l, z: inp.mz / l, set: true } : { x: Math.sin(p.face), z: Math.cos(p.face), set: false }; };
  X.aimDir = aimDir;
  function bestPassTarget(p, dir, kind) {
    let best = null, bs = -1e9;
    for (const q of P) {
      if (q.team !== p.team || q.id === p.id) continue;
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d < 1.5) continue;
      let cos = (dx * dir.x + dz * dir.z) / d;
      if (cos < 0.62) continue;
      const lane = laneRisk(p, q, d, kind === 'lob' ? 1 : 0);
      let sc = cos * 4 - d * 0.04 - lane * 1.5 + (q.role === 'GK' ? -1 : 0);
      if (kind === 'through') sc += (q.z * dirOf(p.team) - p.z * dirOf(p.team)) * 0.05;
      if (sc > bs) { bs = sc; best = q; }
    }
    return best;
  }
  X.bestPassTarget = bestPassTarget;
  function laneRisk(p, q, d, lob) {
    if (lob) return 0.2;
    let risk = 0;
    for (const o of P) {
      if (o.team === p.team) continue;
      const sd = segDist(o.x, o.z, p.x, p.z, q.x, q.z);
      if (sd.d < 1.5) risk = Math.max(risk, 1 - sd.d / 1.5);
    }
    return risk;
  }
  X.laneRisk = laneRisk;
  function shotTarget(p, dir, power) {
    const gz = dirOf(p.team) * HL;
    // aim: stick direction projected on the goal line, snapped towards the goal mouth when the stick points near it
    let tx;
    const dz = gz - p.z;
    if (dir.set && Math.abs(dir.z) > 0.05 && dir.z * dz > 0) { tx = p.x + dir.x / dir.z * dz; }
    else if (dir.set) { tx = p.x + dir.x * 30; }
    else tx = clamp(p.x * 0.3, -1, 1);
    // auto-aim assist: the aim is bent a little towards the nearer post when it is inside the cone
    const mid = clamp(tx, -GOAL_HW + 0.3, GOAL_HW - 0.3);
    if (Math.abs(tx) < GOAL_HW + 2.0) tx = lerp(tx, mid, 0.5);
    return { tx, tz: gz, ty: dir.set && dir.vy !== undefined ? dir.vy : 0.7 };
  }
  X.shotTarget = shotTarget;

  function humanStep(p, dt) {
    const inp = X.inp || { mx: 0, mz: 0, spr: false, b: [{}, {}, {}, {}], dive: null };
    const mag = Math.min(1, Math.hypot(inp.mx, inp.mz));
    const dir = aimDir(p, inp);
    const hasBall = B.owner === p.id || (B.owner < 0 && B.held < 0 && Math.hypot(B.x - p.x, B.z - p.z) < 1.0 && B.y < 0.9);
    const heldBall = B.held === p.id;
    const hud = { ctx: 'run', labels: ['', '', '', ''], charge: 0, passTarget: -1, aim: null, ready: [false, false, false, false] };
    s.hud = hud;
    // movement
    const vmax = p.st.vmax, runMax = vmax * 0.8;
    if (mag > 0.12) {
      const v = (inp.spr && p.stam > 0.03 ? vmax : runMax) * clamp((mag - 0.12) / 0.55, 0.15, 1);
      p.cmd = { dx: inp.mx / Math.hypot(inp.mx, inp.mz), dz: inp.mz / Math.hypot(inp.mx, inp.mz), v };
    } else p.cmd = { dx: 0, dz: 0, v: 0, fx: dir.set ? dir.x : undefined, fz: dir.z };
    // button hold times: the time a button was held is kept for the tick it is released
    const H = X.hold || (X.hold = [0, 0, 0, 0]), R = X.relT || (X.relT = [0, 0, 0, 0]);
    for (let i = 0; i < 4; i++) { const b = inp.b[i] || {}; if (b.down) { H[i] += dt; R[i] = 0; } else { R[i] = b.released ? H[i] : 0; H[i] = 0; } }
    const down = (i) => !!(inp.b[i] && inp.b[i].down), pr = (i) => !!(inp.b[i] && inp.b[i].pressed), rel = (i) => !!(inp.b[i] && inp.b[i].released);
    const sp = s.sp;
    // a kick asked for a moment too early (the ball is still a step away) waits a little for the ball to arrive
    if (p.buf) {
      if (s.t > p.buf.until || p.act || p.stun > 0) p.buf = null;
      else if (hasBall && tryAction(p, p.buf.k, dir, p.buf.power, inp)) p.buf = null;
    }
    if (p.role === 'GK') return gkHuman(p, inp, dir, hud, down, pr, rel, heldBall, dt);
    // set piece taker
    if (sp && sp.taker === p.id && s.phase === 'setpiece') {
      hud.ctx = 'setpiece'; hud.labels = [sp.kind === 'penalty' || sp.kind === 'free' ? 'SHOOT' : 'KICK', 'PASS', 'LOB', 'THROUGH'];
      if (sp.kind === 'throw') hud.labels = ['', 'THROW', 'LONG', ''];
      p.cmd = { dx: 0, dz: 0, v: 0, fx: dir.set ? dir.x : undefined, fz: dir.z };
      sp.aimx = dir.x; sp.aimz = dir.z; sp.aimSet = dir.set;
      const tgtPlayer = bestPassTarget(p, dir, 'pass'); hud.passTarget = tgtPlayer ? tgtPlayer.id : -1; hud.aim = { x: dir.x, z: dir.z };
      if (down(0)) hud.charge = clamp(H[0] / 0.7, 0, 1);
      if (!p.act && sp.t > 0.6) {
        const arrived = Math.hypot(B.x - p.x, B.z - p.z) < 1.0 || sp.kind === 'throw';
        if (arrived) {
          if (sp.kind === 'throw') { if (rel(1) || rel(2)) { const T = rel(2) ? bestPassTarget(p, dir, 'lob') : tgtPlayer; X.kick(p, 'throw', { tx: T ? T.x : p.x + dir.x * 8, tz: T ? T.z : p.z + dir.z * 8, power: 0.5, tgt: T ? T.id : -1 }); } }
          else if (rel(0)) humanShoot(p, dir, sp.kind === 'penalty' ? clamp(0.5 + R[0] / 0.7 * 0.5, 0.5, 1) : clamp(0.35 + R[0] / 0.7 * 0.65, 0.35, 1), inp);
          else if (rel(1)) humanPass(p, dir, 'pass', clamp(R[1] / 0.7, 0, 1));
          else if (rel(2)) humanPass(p, dir, 'lob', clamp(R[2] / 0.7, 0, 1));
          else if (rel(3)) humanPass(p, dir, 'through', clamp(R[3] / 0.7, 0, 1));
        }
      }
      return;
    }
    if (s.phase !== 'play') return;
    // loose / aerial ball near the head: HEAD
    const airNear = B.y > 0.95 && B.y < 2.6 && Math.hypot(B.x - p.x, B.z - p.z) < 2.6 && B.held < 0;
    if (hasBall && !airNear) {
      hud.ctx = 'ball'; hud.labels = ['SHOOT', 'PASS', 'LOB', 'THROUGH'];
      const k = down(2) ? 'lob' : down(3) ? 'through' : 'pass';
      const t = bestPassTarget(p, dir, k); hud.passTarget = t ? t.id : -1;
      for (let i = 0; i < 4; i++) if (down(i)) hud.charge = clamp(H[i] / 0.7, 0, 1);
      hud.aim = { x: dir.x, z: dir.z };
      if (!p.act) {
        if (rel(0)) tryAction(p, 'shoot', dir, clamp(0.3 + R[0] / 0.7 * 0.7, 0.3, 1), inp, true);
        else if (rel(1)) tryAction(p, 'pass', dir, clamp(R[1] / 0.7, 0, 1), inp, true);
        else if (rel(2)) tryAction(p, 'lob', dir, clamp(R[2] / 0.7, 0, 1), inp, true);
        else if (rel(3)) tryAction(p, 'through', dir, clamp(R[3] / 0.7, 0, 1), inp, true);
      }
    } else if (airNear) {
      hud.ctx = 'air'; hud.labels = ['HEAD', 'SLIDE', 'CALL', ''];
      if (pr(0) && !p.act) humanHead(p, dir);
      else if (pr(1) && !p.act) X.tackle(p, true);
      else if (pr(2)) X.callFor(p);
    } else {
      const oppHas = B.owner >= 0 && P[B.owner].team !== p.team;
      hud.ctx = oppHas ? 'defend' : 'chase'; hud.labels = [oppHas ? 'TACKLE' : 'KICK', 'SLIDE', 'CALL', ''];
      if (pr(0) && !p.act) { if (!oppHas && Math.hypot(B.x - p.x, B.z - p.z) < 1.8 && B.y < 0.9) tryAction(p, 'clear', dir, 0.7, inp, true); else X.tackle(p, false); }
      else if (pr(1) && !p.act) X.tackle(p, true);
      else if (pr(2)) X.callFor(p);
    }
  }
  function tryAction(p, name, dir, power, inp, buffer) {
    let ok = false;
    if (name === 'shoot') ok = humanShoot(p, dir, power, inp);
    else if (name === 'clear') ok = humanPass(p, dir, 'clear', power);
    else ok = humanPass(p, dir, name, power);
    if (!ok && buffer) p.buf = { k: name, power, until: s.t + 0.3 };
    return ok;
  }
  function humanShoot(p, dir, power, inp) {
    const T = shotTarget(p, dir, power);
    // finesse: the stick sideways relative to the aim bends the ball (curve)
    let curve = 0;
    if (inp.curve !== undefined) curve = inp.curve;
    return X.kick(p, 'shot', { tx: T.tx, tz: T.tz, ty: T.ty, power, curve });
  }
  function humanPass(p, dir, kind, power) {
    if (kind === 'clear') return X.kick(p, 'clear', { tx: p.x + dir.x * 14, tz: p.z + dir.z * 14, power });
    const t = bestPassTarget(p, dir, kind);
    if (t) return X.kick(p, kind, { tx: t.x, tz: t.z, power, tgt: t.id });
    const d = kind === 'pass' ? 9 : kind === 'lob' ? 16 : 14;
    return X.kick(p, kind, { tx: p.x + dir.x * d, tz: p.z + dir.z * d, power, tgt: -1 });
  }
  function humanHead(p, dir) {
    // target: the goal when it is near, else a teammate in the stick direction, else forward
    const gz = dirOf(p.team) * HL, dg = Math.abs(gz - p.z);
    let tx, tz;
    if (dg < 11 && (!dir.set || dir.z * dirOf(p.team) > 0.2)) { tx = clamp(p.x + (dir.set ? dir.x * 3 : 0), -GOAL_HW + 0.4, GOAL_HW - 0.4); tz = gz; }
    else { const t = bestPassTarget(p, dir, 'lob'); if (t) { tx = t.x; tz = t.z; } else { tx = p.x + dir.x * 10; tz = p.z + dir.z * 10; } }
    // timing: contact when the ball is at head height above us; estimate arrival
    let eta = 0.28; const path = predictBall();
    for (const q of path) { if (q.y > 1.2 && q.y < 2.3 && Math.hypot(q.x - p.x, q.z - p.z) < 1.6 && q.t > 0.1) { eta = clamp(q.t, 0.16, 0.5); break; } }
    X.head(p, { tx, tz, power: dg < 11 ? 0.85 : 0.55, eta });
  }
  function gkHuman(p, inp, dir, hud, down, pr, rel, heldBall, dt) {
    hud.ctx = heldBall ? 'gkball' : 'gk';
    if (heldBall) {
      hud.labels = ['KICK', 'THROW', '', ''];
      p.cmd = { dx: 0, dz: 0, v: 0, fx: dir.set ? dir.x : undefined, fz: dir.z };
      const t = bestPassTarget(p, dir, 'pass'); hud.passTarget = t ? t.id : -1; hud.aim = { x: dir.x, z: dir.z };
      if (!p.act && p.hold > 6) { const t2 = bestPassTarget(p, { x: 0, z: dirOf(p.team) }, 'pass'); X.kick(p, 'throw', { tx: t2 ? t2.x : p.x, tz: t2 ? t2.z : p.z + dirOf(p.team) * 8, power: 0.5, tgt: t2 ? t2.id : -1 }); }
      if (!p.act) {
        if (pr(0)) { const d = 24 + 8; X.kick(p, 'gk', { tx: p.x + dir.x * 26, tz: p.z + dir.z * 26 + (dir.set ? 0 : dirOf(p.team) * 26), power: 0.8 }); }
        else if (pr(1)) { const tt = t; X.kick(p, 'throw', { tx: tt ? tt.x : p.x + dir.x * 9, tz: tt ? tt.z : p.z + dir.z * 9 + (dir.set ? 0 : dirOf(p.team) * 9), power: 0.5, tgt: tt ? tt.id : -1 }); }
      }
      return;
    }
    if (s.phase === 'setpiece' && s.sp && s.sp.taker === p.id) {
      hud.ctx = 'gkball'; hud.labels = ['KICK', 'SHORT', '', ''];
      p.cmd = { dx: 0, dz: 0, v: 0, fx: dir.set ? dir.x : undefined, fz: dir.z };
      const t = bestPassTarget(p, dir, 'pass'); hud.passTarget = t ? t.id : -1; hud.aim = { x: dir.x, z: dir.z };
      if (!p.act && s.sp.t > 0.8 && Math.hypot(B.x - p.x, B.z - p.z) < 1.4) {
        if (pr(0)) X.kick(p, 'lob', { tx: p.x + dir.x * 22, tz: p.z + (dir.set ? dir.z * 22 : dirOf(p.team) * 22), power: 0.8 });
        else if (pr(1)) { if (t) X.kick(p, 'pass', { tx: t.x, tz: t.z, power: 0.5, tgt: t.id }); else X.kick(p, 'pass', { tx: p.x + dir.x * 8, tz: p.z + dir.z * 8 + (dir.set ? 0 : dirOf(p.team) * 8), power: 0.5 }); }
      }
      return;
    }
    hud.labels = ['DIVE', 'JUMP', 'CALL', ''];
    // keeper is held to a corridor in front of the goal unless the ball is loose nearby
    // dive: from the swipe (inp.dive = {dx, dz, up}) or the DIVE button with the stick direction
    let dv = inp.dive || null;
    if (!dv && pr(0)) dv = { dx: dir.set ? dir.x : 0, dz: dir.set ? dir.z : 0, up: false };
    if (!dv && pr(1)) dv = { dx: 0, dz: 0, up: true };
    if (dv && !p.act) {
      const jump = dv.up || Math.hypot(dv.dx, dv.dz) < 0.35;
      // heights: a dive towards the goal-line direction (up the screen) is a high dive; sideways is mid; the ball's current height refines
      let h = jump ? 2 : B.y > 1.3 ? 2 : B.y < 0.5 ? 0 : 1, reach = 1;
      // dive assist: the swipe picks the side; the dive length and height come from where the shot will cross the keeper's line
      if (!jump && B.owner < 0 && Math.abs(B.vz) > 3) {
        const path = predictBall(), sgk = p.team === 0 ? 1 : -1;
        for (let i = 0; i < path.length; i++) {
          const q = path[i];
          if ((q.z - p.z) * sgk <= 0.2 && B.vz * sgk < 0) { const dxm = q.x - p.x; if (dxm * dv.dx >= 0 || Math.abs(dxm) < 0.4) { h = q.y > 1.45 ? 2 : q.y < 0.55 ? 0 : 1; reach = Math.max(0.25, (Math.abs(dxm) - 0.2) / 2.2); } break; }
        }
      }
      X.dive(p, jump ? 0 : dv.dx, jump ? 0 : dv.dz, h, reach);
    }
    if (!p.act && pr(2)) X.callFor(p);
    if (!p.act && s.phase === 'play' && B.owner < 0 && B.held < 0 && Math.hypot(B.x - p.x, B.z - p.z) < 1.0 && B.y < 0.4 && !inBox(p.team, p.x, p.z)) { /* feet control handled by claim */ }
  }
  function predictBall() { const t = s.tick; if (X.pathAt !== t) { X.path = predictPath(B, 14, 0.1, X.path); X.pathAt = t; } return X.path; }
  X.predictBall = predictBall;

  // ---- the tick ------------------------------------------------------------------------------------------------------------------------------
  function phaseStep(dt) {
    switch (s.phase) {
      case 'kickoff': case 'setpiece': {
        const sp = s.sp; if (!sp) { s.phase = 'play'; break; }
        sp.t += dt;
        // the taker of an AI-controlled restart acts when everyone is roughly in place
        const tk = P[sp.taker];
        if (sp.kind === 'kickoff') s.phase = 'setpiece';
        // human taker timeout: after a long wait a computer teammate takes the restart instead
        if (tk.human && sp.t > 8) {
          let best = null, bd = 1e9;
          for (const q of P) if (q.team === sp.team && !q.human && q.role !== 'GK') { const dd = Math.hypot(q.x - sp.x, q.z - sp.z); if (dd < bd) { bd = dd; best = q; } }
          if (best) { sp.taker = best.id; sp.ai = true; if (sp.kind === 'throw') { B.held = best.id; B.owner = best.id; } placeSetPieceTargets(sp); }
        }
        // human taker timeout: the computer takes it after a long wait
        if (!tk.act && sp.t > sp.wait && (sp.ai || sp.t > 9)) X.aiSetPiece(tk, sp);
        // when the ball has moved away the restart is over
        if (!sp.ai || true) { if (B.held < 0 && (Math.abs(B.x - sp.x) > 0.6 || Math.abs(B.z - sp.z) > 0.6) && sp.kind !== 'throw') { s.phase = 'play'; s.sp = null; } }
        break;
      }
      case 'dead': {
        const d = s.dead; d.t -= dt;
        if (d.t <= 0) { if (s.endFlag) { endHalf(); break; } if (d.kind === 'kickoff') startKickoff(d.team); else startSetPiece(d.kind, d.team, d.x, d.z); }
        break;
      }
      case 'goal': {
        s.pt -= dt;
        if (s.pt <= 0) { if (s.endFlag) endHalf(); else startKickoff(1 - (B.lastTeam === s.kickTeam ? 0 : 0) * 0 - 0 ? s.kickTeam : s.kickTeam); }
        break;
      }
      case 'half': { s.pt -= dt; if (s.pt <= 0) { s.half = 2; s.clock = cfg.halfSec || 180; s.endFlag = false; startKickoff(1 - s.firstKick); ev('half2', {}); snapAll(); } break; }
      default: break;
    }
  }
  function endHalf() {
    s.endFlag = false;
    if (s.half === 1) { s.phase = 'half'; s.pt = 3.0; ev('halftime', { score: [...s.score] }); B.owner = -1; B.held = -1; for (const p of P) p.act = null; placeFormation(0, 'kickoff'); }
    else { s.phase = 'full'; s.over = true; s.winner = s.score[0] > s.score[1] ? 0 : s.score[1] > s.score[0] ? 1 : -1; ev('fulltime', { score: [...s.score], winner: s.winner }); }
  }

  X.release = () => { const h = s.hold; if (!h) return; s.hold = null; X.holdCool = 7; if (h.run) h.run(); };
  X.holdCool = 3;

  function aiAndHuman(dt) {
    // team plans at 5 Hz, players at their own slots
    const k = s.tick;
    if (k % 6 === 0) { teamThink(X, 0); teamThink(X, 1); }
    for (const p of (X.order ? X.order : P)) {
      if (p.human) { humanStep(p, dt); continue; }
      if (p.idle) { if (!p.script) p.cmd = { dx: 0, dz: 0, v: 0 }; continue; }
      if (p.act) { if (p.act.k === 'kick' && p.act.kind === 'throw' || p.act.k === 'dive' || p.act.k === 'slide' || p.act.k === 'tackle') continue; }
      const carrier = B.owner === p.id || (B.held === p.id);
      const slot = carrier ? 3 : p.role === 'GK' ? 2 : 6;
      if ((k + p.id * 2) % slot === 0) playerThink(X, p);
    }
  }

  // run-in: while a restart waits, players walk to their spots
  function setpieceMove() {
    for (const p of P) {
      if (p.human) continue;
      if (s.sp && p.id === s.sp.taker) continue;
      const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
      p.cmd = d > 0.3 ? { dx: dx / d, dz: dz / d, v: Math.min(d * 3, 6.0) } : { dx: 0, dz: 0, v: 0 };
    }
  }

  X.update = (dt = STEP) => {
    if (s.over) return;
    if (s.hold) return;
    s.tick++; s.t = s.tick * STEP;
    if (X.holdCool > 0) X.holdCool -= dt;
    if (s.drill && X.drillStep) X.drillStep(dt);
    // clock
    if (s.phase === 'play') {
      s.clock -= dt;
      if (s.clock <= 0 && !s.endFlag) { s.clock = 0; s.endFlag = true; s.endAt = s.t + 7; ev('clockout', {}); }
      if (s.endFlag && s.t > s.endAt) endHalf();
      s.stats[B.lastTeam >= 0 ? B.lastTeam : 0].poss += dt;
    }
    const idle = s.phase === 'goal' || s.phase === 'half' || s.phase === 'full' || s.phase === 'dead';
    // decisions
    if (s.phase === 'play' || s.phase === 'setpiece' || s.phase === 'kickoff') {
      aiAndHuman(dt);
      if (s.phase === 'setpiece' || s.phase === 'kickoff') setpieceMove();
    } else if (s.phase === 'goal' || s.phase === 'half') {
      for (const p of P) { if (p.human) { p.cmd = { dx: 0, dz: 0, v: 0 }; continue; } const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz); p.cmd = d > 0.4 && p.cel === 0 ? { dx: dx / d, dz: dz / d, v: Math.min(7, 2.5 + d) } : { dx: 0, dz: 0, v: 0 }; }
    } else if (s.phase === 'dead') { for (const p of P) { if (!p.act) p.cmd = { dx: 0, dz: 0, v: 0 }; } }
    if (s.hold) return;     // the AI paused the match for Watch & Learn
    for (const p of P) { actStep(p, dt); movePlayer(p, dt); }
    separate();
    enforceRestrictions();
    // ball
    if (!idle || s.phase === 'goal' || s.phase === 'dead') {
      if (B.held < 0 && !(s.phase === 'setpiece' && s.sp && s.sp.kind !== 'throw' && Math.abs(B.vx) + Math.abs(B.vz) < 0.01)) {
        const r = stepBall(B, dt);
        if (r === 'bounce') ev('bounce', { x: B.x, z: B.z, v: -B.vy });
        const f = collideFrame(B);
        if (f) ev(f, { x: B.x, y: B.y, z: B.z });
        if (s.phase === 'goal' || s.phase === 'dead') netBounds(B);
        else if (Math.abs(B.z) > HL) netBounds(B);
      }
    }
    if (s.phase === 'setpiece' || s.phase === 'kickoff') { if (B.held < 0 && s.sp && s.sp.kind === 'throw') { /* held at the touchline */ } }
    if (s.phase === 'play' || s.phase === 'setpiece') { ballInteract(dt); }
    if (s.phase === 'play') ballRules();
    // fix the held-ball placement after movement
    if (B.held >= 0) { const h = P[B.held]; B.x = h.x + Math.sin(h.face) * 0.35; B.z = h.z + Math.cos(h.face) * 0.35; B.y = h.act && h.act.k === 'kick' && h.act.kind === 'throw' ? 2.05 : 1.1; }
    // goalkeeper holding: release by the AI / human via kick; auto-drop after a while
    for (const g of [P[0], P[7]]) { if (B.held === g.id) { g.hold += dt; } }
    phaseStep(dt);
    // the ball's roll for the picture
    const v = Math.hypot(B.vx, B.vz); B.rx += B.vz * dt / BR; B.rz -= B.vx * dt / BR; void v;
    for (const p of P) { if (p.cel > 0 && s.phase === 'play') p.cel = 0; }
  };

  function ballRules() {
    if (s.drill) {
      const dd = s.drill;
      if (Math.abs(B.z) > HL + BR * 0.5 && B.held < 0) {
        if (Math.abs(B.x) <= GOAL_HW && B.y <= GOAL_H) { dd.res = 'goal'; s.score[B.z > 0 ? 0 : 1]++; ev('goal', { team: B.z > 0 ? 0 : 1, scorer: B.last, own: false, score: [...s.score], drill: true }); } else dd.res = 'out';
        B.vx = B.vz = 0;
      } else if (Math.abs(B.x) > HW + BR * 0.5 && B.held < 0) { dd.res = 'out'; B.vx = B.vz = 0; }
      return;
    }
    // goal line
    if (Math.abs(B.z) > HL + BR * 0.5 - 0.0 && B.held < 0) {
      const team = B.z > 0 ? 0 : 1;           // the team that attacks this end scores here (team 0 attacks +z)
      if (Math.abs(B.x) <= GOAL_HW - 0.0 && B.y <= GOAL_H) { goal(team); return; }
      // out over the goal line
      const defending = B.z > 0 ? 1 : 0;
      if (B.lastTeam === defending) ballOut('corner', 1 - defending, Math.sign(B.x || 1) * HW, B.z);
      else ballOut('goalkick', defending, B.x, B.z);
      return;
    }
    if (Math.abs(B.x) > HW + BR * 0.5 && B.held < 0) {
      const team = B.lastTeam === 0 ? 1 : 0;
      ballOut('throw', team, Math.sign(B.x) * HW, clamp(B.z, -HL + 1, HL - 1));
    }
  }

  // ---- start ----------------------------------------------------------------------------------------------------------------------------------
  if (cfg.resume) {
    const r = cfg.resume;
    s.score = [...r.score]; s.half = r.half; s.clock = r.clock; s.firstKick = r.firstKick; s.stats = r.stats ? JSON.parse(JSON.stringify(r.stats)) : s.stats;
    startKickoff(r.kickTeam, true);
  } else if (cfg.start === 'none') { /* the drill code places everything */ }
  else startKickoff(s.kickTeam, true);
  X.snapAll = snapAll; X.putBall = putBall; X.goal = goal;
  X.evalOptions = (p, quick) => evalOptions(X, p, quick);
  X.aiSetPiece = (tk, sp) => aiSetPiece(X, tk, sp);
  return X;
}
