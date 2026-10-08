// The table: rods, men, the ball, goals and the match. Deterministic: time comes from update(dt), randomness from the rng passed in.
// The player (team 0) defends the bottom goal and attacks up the table. State is plain data (s) so it can be saved and hashed.
import { HL, HW, BALL_R, GOAL_HW, ROD_LAYOUT, ROD_Y, KINDS, MAN_HX, MAN_HY, dirOf, LEVELS } from './consts.js';
import { clamp, manX, footAt, inStrike, SW, collideRect, collideBounds } from './physics.js';
import { aiCommands, hint, levelOf } from './ai.js';

const SUB = 4;
const MAX_SPEED = 330;
const HUMAN_SPEED = 560;

/**
 * cfg: { goals, level, watch, watchLevels:[a,b], bot, two, kits }  (two: both sides are played by people)
 *  watch: both sides are played by the computer; team 0 pauses ("hold") before each strike so the lesson can explain it.
 */
export function createSim(cfg, rng) {
  const lv = [levelOf(cfg.watch ? cfg.watchLevels[0] : 3), levelOf(cfg.watch ? cfg.watchLevels[1] : cfg.level || 2)];
  const s = {
    t: 0, phase: 'ready', phaseT: 0, goals: cfg.goals || 5, score: [0, 0], over: false, winner: -1,
    ball: { x: 0, y: 0, vx: 0, vy: 0, rot: 0 }, rods: [], events: [], eid: 0, hist: [], lastTouch: -1, deadT: 0,
    serveTeam: 0, hold: null, holdId: 0, coachCd: 0.8, forceKick: -1, level: lv[1].id, watch: !!cfg.watch, goalBy: -1, goalT: 0, shake: 0,
    stats: { shots: [0, 0], goals: [0, 0] }, streak: 0, lastKick: null,
  };
  ROD_LAYOUT.forEach((d, i) => s.rods.push({ i, team: d.team, kind: d.kind, y: ROD_Y[i], off: 0, tgt: 0, vx: 0, speed: (d.team === 0 && !cfg.watch) || cfg.two ? HUMAN_SPEED : lv[d.team].speed, f: 0, vf: 0, swT: -1, swP: 0, swHit: false, noise: 0 }));
  s.rods.forEach((r) => { r.noise = rng.range(-1, 1); });
  const aiRng = rng.fork();

  const emit = (type, o = {}) => { s.events.push({ id: s.eid++, type, t: s.t, ...o }); if (s.events.length > 48) s.events.shift(); };

  function placeBall(vyDir) {
    const b = s.ball;
    b.x = rng.range(-9, 9); b.y = 0; b.vx = 0; b.vy = 0; b.rot = 0;
    s.pendingServe = vyDir;
  }
  function launch() {
    const b = s.ball, toward = s.serveTeam === 0 ? 1 : -1;
    b.vy = toward * 55; b.vx = rng.range(-18, 18);
    emit('serve', { team: s.serveTeam });
  }
  placeBall(1);

  function startSwing(r, p) {
    if (r.swT >= 0) return false;
    r.swT = 0; r.swP = clamp(p, 0.25, 1); r.swHit = false;
    emit('swing', { rod: r.i, team: r.team, p: r.swP });
    return true;
  }

  function stepRods(h) {
    for (const r of s.rods) {
      const K = KINDS[r.kind];
      const want = clamp(r.tgt, -K.maxOff, K.maxOff);
      const d = want - r.off, mv = clamp(d, -r.speed * h, r.speed * h);
      r.off += mv; r.vx = mv / h;
      if (r.swT >= 0) {
        const f0 = r.f;
        r.swT += h; r.f = footAt(r.swT); r.vf = (r.f - f0) / h;
        if (r.swT >= SW.back) { r.swT = -1; r.f = 0; r.vf = 0; }
      }
    }
  }

  function stepBall(h) {
    const b = s.ball;
    b.x += b.vx * h; b.y += b.vy * h;
    const sp0 = Math.hypot(b.vx, b.vy);
    if (sp0 > 0) { const sp = Math.max(0, sp0 - (1.0 + 0.045 * sp0) * h); const k = sp / sp0; b.vx *= k; b.vy *= k; }
    b.rot += (b.vx - b.vy * 0) * h * 0.2;
    // men
    for (const r of s.rods) {
      const dir = dirOf(r.team), K = KINDS[r.kind];
      const strike = r.swT >= 0 && inStrike(r.swT);
      // sweep: cover the foot's path since the previous sub-step
      const prevF = r.f - r.vf * h, mid = (r.f + prevF) / 2, ext = Math.abs(r.f - prevF) / 2;
      let touching = 0;
      for (let k = 0; k < K.n; k++) {
        const cx = manX(r, k), cy = r.y + dir * mid;
        if (Math.abs(b.y - cy) > MAN_HY + ext + BALL_R + 1 || Math.abs(b.x - cx) > MAN_HX + BALL_R + 1) continue;
        const c = collideRect(b, cx, cy, MAN_HX, MAN_HY + ext, r.vx, dir * r.vf, 0.35);
        if (!c) continue;
        touching++;
        if (touching > 1) { b.vx *= 0.25; b.vy *= 0.25; }   // squeezed between two men: the wood soaks it up
        const forward = c.nx * 0 + c.ny * dir;      // contact normal along the rod's forward direction
        if (strike && !r.swHit && forward > 0.3) {
          r.swHit = true;
          const spd = 70 + 230 * r.swP;
          const lat = clamp((b.x - cx) * 11, -48, 48) + clamp(r.vx * 0.35, -30, 30);
          b.vy = dir * spd; b.vx = lat;
          const sp = Math.hypot(b.vx, b.vy); if (sp > MAX_SPEED) { b.vx *= MAX_SPEED / sp; b.vy *= MAX_SPEED / sp; }
          s.lastTouch = r.team; s.stats.shots[r.team]++;
          s.lastKick = { team: r.team, t: s.t, p: r.swP, rod: r.i };
          emit('kick', { rod: r.i, team: r.team, p: r.swP, x: b.x, y: b.y });
        } else if (Math.abs(c.rel) > 8) {
          s.lastTouch = r.team;
          emit('man', { rod: r.i, team: r.team, v: Math.abs(c.rel), x: b.x, y: b.y });
        } else s.lastTouch = r.team;
      }
    }
    const hits = collideBounds(b);
    for (const hh of hits) if (hh.v > 14) emit(hh.t, { v: hh.v, x: b.x, y: b.y });
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > MAX_SPEED) { b.vx *= MAX_SPEED / sp; b.vy *= MAX_SPEED / sp; }
  }

  function goal(by) {   // by = team that scored
    s.score[by]++; s.stats.goals[by]++; s.phase = 'goal'; s.phaseT = 0; s.goalBy = by; s.shake = 1;
    s.serveTeam = by === 0 ? 1 : 0;
    s.streak = by === 0 ? s.streak + 1 : 0;
    emit('goal', { team: by, score: [...s.score], x: s.ball.x });
    if (s.score[by] >= s.goals) { s.over = true; s.winner = by; }
  }

  function applyCommands(team, P, dt) {
    const cmds = aiCommands(s, team, P, aiRng);
    for (const c of cmds) {
      const r = s.rods[c.rod];
      if (Math.abs(c.tgt - r.tgt) > 0.5 || c.kick > 0) r.tgt = c.tgt;   // dead zone: no trembling rods
      if (c.kick > 0 && r.swT < 0) {
        if (team === 0 && cfg.watch && s.coachCd <= 0 && !s.hold && s.forceKick !== r.i) {
          s.hold = { id: ++s.holdId, rod: r.i, tgt: c.tgt, k: c.k, aimX: c.aimX, why: c.why, power: c.kick };
          s.coachCd = 1.6;
          return true;
        }
        if (team === 0 && cfg.watch && s.forceKick === r.i) s.forceKick = -1;
        startSwing(r, c.kick); r.noise = aiRng.range(-1, 1);
      }
    }
    return false;
  }

  const api = {
    s,
    humanRod(i) { const r = s.rods[i]; return r && (r.team === 0 || cfg.two) ? r : null; },
    // player input
    slideTo(i, off) { const r = api.humanRod(i); if (r) r.tgt = off; },
    kick(i, p) { const r = api.humanRod(i); if (r && s.phase !== 'goal' && s.phase !== 'over') return startSwing(r, p); return false; },
    hint() { return hint(s, 0, LEVELS[2], aiRng); },
    releaseHold() { if (s.hold) { s.forceKick = s.hold.rod; const r = s.rods[s.hold.rod]; r.tgt = s.hold.tgt; s.hold = null; } },
    update(dt) {
      if (s.hold) return;
      s.t += dt; s.phaseT += dt; s.coachCd -= dt; s.shake = Math.max(0, s.shake - dt * 2.2);
      if (s.phase === 'over') return;
      if (s.phase === 'ready') {
        for (const r of s.rods) r.tgt = r.tgt; // rods may move while waiting
        if (cfg.watch || cfg.bot) { applyCommands(0, lv[0], dt); }
        if (!cfg.two) applyCommands(1, lv[1], dt);
        stepRods(dt);
        s.hist.push({ x: s.ball.x, y: s.ball.y, vx: 0, vy: 0 }); if (s.hist.length > 30) s.hist.shift();
        if (s.phaseT >= 1.0) { s.phase = 'live'; s.phaseT = 0; s.deadT = 0; launch(); }
        return;
      }
      if (s.phase === 'goal') {
        const h = dt / 2;
        for (let i = 0; i < 2; i++) { stepRods(h); stepBall(h); }
        s.ball.vx *= 0.96; s.ball.vy *= 0.9;
        if (s.phaseT >= 2.1) {
          if (s.over) { s.phase = 'over'; s.phaseT = 0; emit('matchEnd', { winner: s.winner, score: [...s.score] }); return; }
          s.phase = 'ready'; s.phaseT = 0; placeBall(s.serveTeam === 0 ? 1 : -1);
          for (const r of s.rods) { r.swT = -1; r.f = 0; r.vf = 0; }
        }
        return;
      }
      // live
      if (cfg.watch || cfg.bot) { if (applyCommands(0, lv[0], dt)) return; }
      if (!cfg.two) applyCommands(1, lv[1], dt);
      const h = dt / SUB;
      for (let i = 0; i < SUB; i++) {
        stepRods(h); stepBall(h);
        const b = s.ball;
        if (Math.abs(b.x) < GOAL_HW && Math.abs(b.y) > HL + 0.4) { goal(b.y < 0 ? 0 : 1); return; }
      }
      const b = s.ball;
      s.hist.push({ x: b.x, y: b.y, vx: b.vx, vy: b.vy }); if (s.hist.length > 30) s.hist.shift();
      if (Math.hypot(b.vx, b.vy) < 3) s.deadT += dt; else s.deadT = 0;
      if (s.deadT > 2.2) { emit('dead', {}); s.phase = 'ready'; s.phaseT = 0; s.serveTeam = s.lastTouch === 0 ? 1 : 0; placeBall(s.serveTeam === 0 ? 1 : -1); }
    },
  };
  return api;
}
