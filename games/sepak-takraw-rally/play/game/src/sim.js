// The sepak takraw simulation: deterministic, pure, no 3D. It owns every position, contact time, contact point and
// outcome. The presenter only reads `getState()` (players[].act, ball, events) and animates; it never writes back.
import { G, BR, HW, HL, NET, SET_POINTS, SET_CAP, ATTACKS, SERVES, SET_PACE, ZONE_LAT, ZONE_DEPTH, TECH_FWD, LEVELS, HUMAN_SKILL, REACH_UP, ATTACK_FWD, PELVIS_Y, NET_TOUCH_DEPTH, NET_BOTTOM } from './consts.js';
import { clamp, lerp, sgn, normal, r2 } from './util.js';
import { posAt, velAt, speedAt, flightTo, landTime, netTime, timeAtHeight } from './ball.js';
import { dirOf, latSign, W, depthOf, latOf, makeStats, intercept, solveClear, clearanceOf, landsIn, setSpot, laneLat, techFor, PREP, REACH0 } from './model.js';
import * as AI from './ai.js';
import { initialCam, stepCam } from './camera.js';

const READY = 1.7;       // s between a point and the toss
const TOSS_T = 1.05;     // toss flight
const POINT_PAUSE = 2.0; // s the ball rolls / referee calls the point
const LAG = 0.28;        // timing ring closes this long before contact

export function createSim(cfg, rng) {
  const NETH = cfg.women ? NET.f : NET.m;
  const rR = rng.fork();   // outcome rolls
  const rA = rng.fork();   // AI noise
  const mode = cfg.mode || 'full';
  const setPts = mode === 'quick' ? SET_POINTS.quick : SET_POINTS.full;
  const setCap = mode === 'quick' ? SET_CAP.quick : SET_CAP.full;
  const setsToWin = mode === 'quick' ? 1 : 2;
  const humans = cfg.humans ?? [true, false];
  const levels = cfg.levels ?? [3, cfg.opp ?? 3];

  const s = {
    t: 0, ts: 1, cfg: { mode, women: !!cfg.women, humans, levels, drill: cfg.drill ?? null }, netH: NETH,
    phase: 'pre', phaseT: 0, hold: null,
    teams: [0, 1].map((i) => ({ idx: i, human: !!humans[i], level: levels[i], name: '', skill: humans[i] ? HUMAN_SKILL : LEVELS[levels[i] - 1].skill, iq: humans[i] ? (cfg.bot ? cfg.bot.iq : 0.6) : (cfg.iqs ? cfg.iqs[i] : LEVELS[levels[i] - 1].iq) })),
    players: [],
    ball: { x: 0, y: -5, z: 0, vis: false, flight: null, free: null, vx: 0, vy: 0, vz: 0, spin: 0 },
    match: { setNo: 1, sets: [0, 0], pts: [0, 0], firstServer: cfg.firstServer ?? 0, serving: cfg.firstServer ?? 0, serveCount: 0, rallies: 0, over: false, winner: null, setPts, setCap, setsToWin, history: [], stats: [{ aces: 0, kills: 0, blocks: 0, errors: 0 }, { aces: 0, kills: 0, blocks: 0, errors: 0 }] },
    rally: null, queue: [], fid: 0, actSeq: 0, evSeq: 0, events: [],
    choice: [0, 1].map(() => ({ attacker: null, zone: 0, pace: 'high', atype: 'roll', aim: null, stype: 'drive', block: 'single', overAim: null })),
    pending: [null, null], ring: null, tapT: [null, null], announce: null, think: null, last: null, cam: initialCam(),
  };
  for (const t of [0, 1]) {
    s.teams[t].name = s.teams[t].human ? (t === 0 ? (humans[1] ? 'Player 1' : 'You') : 'Player 2') : LEVELS[s.teams[t].level - 1].name + (!humans[0] && !humans[1] && levels[0] === levels[1] ? (t === 0 ? ' (red)' : ' (blue)') : '');
    for (let r = 0; r < 3; r++) {
      const st = makeStats(s.teams[t].skill, r);
      s.players.push({ id: t * 3 + r, team: t, role: r, st, x: 0, z: 0, vx: 0, vz: 0, tx: 0, tz: 0, go: 0, hold: 0, lockFrom: -1e9, path: null, jy: 0, face: t === 0 ? 0 : Math.PI, act: null, num: r + 1 + t * 0, blocker: false });
    }
  }
  const P = (t, r) => s.players[t * 3 + r];
  const emit = (type, d = {}) => { s.events.push({ id: s.evSeq++, type, t: s.t, ...d }); if (s.events.length > 60) s.events.splice(0, s.events.length - 60); };
  const schedule = (t, type, d = {}) => { const ev = { t, type, fid: s.fid, ...d }; let i = s.queue.length; while (i > 0 && s.queue[i - 1].t > t) i--; s.queue.splice(i, 0, ev); return ev; };
  const purge = () => { s.queue = s.queue.filter((e) => e.keep); };
  const randAim = (team) => { const o = 1 - team; return W(o, rR.range(-2.3, 2.3), rR.range(3.5, 6.0)); };

  // ---------------------------------------------------------------- movement
  const goto = (p, pos, delay = 0) => { p.tx = clamp(pos.x, -HW - 1.5, HW + 1.5); p.tz = clamp(pos.z, -HL - 1.5, HL + 1.5); p.go = s.t + delay; };
  const teleport = (p, pos) => { p.x = p.tx = pos.x; p.z = p.tz = pos.z; p.vx = p.vz = 0; };
  // scripted arrival: the player is guaranteed to be at (x1, z1) at t1 (used for every contact so the body is where the sim says)
  const setPath = (p, x1, z1, t0, t1) => { p.path = { x0: p.x, z0: p.z, x1, z1, t0, t1: Math.max(t1, t0 + 0.05) }; p.tx = x1; p.tz = z1; };
  function movePlayers(dt) {
    for (const p of s.players) {
      const pa = p.path;
      if (pa && s.t >= pa.t0 - 1e-9) {
        const u = clamp((s.t - pa.t0) / (pa.t1 - pa.t0), 0, 1), k = u * u * (3 - 2 * u), dk = (6 * u * (1 - u)) / (pa.t1 - pa.t0);
        const nx = pa.x0 + (pa.x1 - pa.x0) * k, nz = pa.z0 + (pa.z1 - pa.z0) * k;
        p.vx = (pa.x1 - pa.x0) * dk; p.vz = (pa.z1 - pa.z0) * dk; p.x = nx; p.z = nz;
        if (u >= 1) { p.path = null; p.vx = p.vz = 0; }
      } else if (pa) { p.vx *= 0.9; p.vz *= 0.9; p.x += p.vx * dt; p.z += p.vz * dt; }
      else {
        const locked = s.t >= p.lockFrom && s.t < p.hold;
        let dx = p.tx - p.x, dz = p.tz - p.z; const d = Math.hypot(dx, dz);
        let wvx = 0, wvz = 0;
        if (!locked && s.t >= p.go && d > 0.03) {
          const sp = Math.min(p.st.spd, Math.sqrt(2 * 9 * d) + 0.2);
          wvx = dx / d * sp; wvz = dz / d * sp;
        }
        const a = 13 * dt;
        const ex = wvx - p.vx, ez = wvz - p.vz, em = Math.hypot(ex, ez);
        if (em > a) { p.vx += ex / em * a; p.vz += ez / em * a; } else { p.vx = wvx; p.vz = wvz; }
        p.x += p.vx * dt; p.z += p.vz * dt;
      }
      const ac = p.act;
      if (ac && ac.air && s.t >= ac.air.ts && s.t <= ac.air.te) { const u = (s.t - ac.air.ta) / (ac.air.ta - ac.air.ts); p.jy = Math.max(0, ac.air.h * (1 - u * u)); } else p.jy = 0;
      if (ac && s.t > ac.t1) p.act = null;
    }
  }
  function faceUpdate() {
    for (const p of s.players) {
      const ac = p.act;
      let fx = null, fz = null;
      if (ac && s.t >= ac.t0 && s.t <= ac.t1 && ac.face) {
        const tx = ac.face.x - p.x, tz = ac.face.z - p.z;
        if (ac.kind === 'receive' || ac.kind === 'set' || ac.kind === 'free') {
          // face the incoming ball, then turn the hips towards the target just before the touch
          const bx = s.ball.x - p.x, bz = s.ball.z - p.z;
          const u = clamp((s.t - (ac.tc - 0.4)) / 0.3, 0, 1);
          const a0 = Math.atan2(bx, bz), a1 = Math.atan2(tx, tz);
          let d = a1 - a0; d = Math.atan2(Math.sin(d), Math.cos(d));
          const a = a0 + d * u * u * (3 - 2 * u);
          fx = Math.sin(a); fz = Math.cos(a);
        } else { fx = tx; fz = tz; }
      }
      else if (Math.hypot(p.vx, p.vz) > 1.6) { fx = p.vx; fz = p.vz; }
      else if (s.ball.vis && !s.ball.free) { const near = depthOf(p.team, s.ball.z) > -0.5; if (near) { fx = s.ball.x - p.x; fz = s.ball.z - p.z; } else { fx = 0; fz = dirOf(p.team); } }
      else { fx = 0; fz = dirOf(p.team); }
      if (fx !== null && Math.hypot(fx, fz) > 1e-4) p.face = Math.atan2(fx, fz);
    }
  }

  // ---------------------------------------------------------------- formations
  const formServe = (server, instant) => {
    const rcv = 1 - server;
    const pos = [[server, 0, W(server, 0, 4.25)], [server, 1, W(server, 2.45, 0.6)], [server, 2, W(server, -2.45, 0.6)],
      [rcv, 0, W(rcv, 0, 4.7)], [rcv, 1, W(rcv, 1.5, 2.8)], [rcv, 2, W(rcv, -1.5, 2.8)]];
    for (const [t, r, w] of pos) { const p = P(t, r); instant ? teleport(p, w) : goto(p, w, 0.05 * r); p.hold = 0; p.lockFrom = -1e9; p.path = null; p.act = null; p.jy = 0; p.blocker = false; }
  };
  const formNeutral = (team, delay = 0.2) => {
    goto(P(team, 0), W(team, 0, 4.6), delay); goto(P(team, 1), W(team, 1.6, 2.9), delay); goto(P(team, 2), W(team, -1.6, 2.9), delay);
  };

  // ---------------------------------------------------------------- acts (what the presenter animates)
  function setAct(p, kind, tech, tc, c, o = {}) {
    const lead = o.lead ?? (kind === 'serve' ? 0.8 : kind === 'attack' ? 0.0 : 0.5);
    const act = { id: ++s.actSeq, kind, tech, t0: tc - lead, tc, t1: tc + (o.follow ?? 0.55), c: { x: r2(c.x), y: r2(c.y), z: r2(c.z) }, to: o.to ?? null, face: o.face ?? null, side: o.side ?? (c.x - p.x) * Math.cos(p.face) - (c.z - p.z) * Math.sin(p.face) > 0 ? 'L' : 'R', q: o.q ?? 0.6, air: o.air ?? null, atype: o.atype ?? null, fail: !!o.fail, stretch: o.stretch ?? 0, lunge: o.lunge ?? 0, sx: o.sx ?? p.tx, sz: o.sz ?? p.tz };
    if (act.air) act.t0 = Math.min(act.t0, act.air.ts - (o.approach ?? 0.6));
    p.act = act; return act;
  }
  // side of the body the ball is on: positive = player's left. facing yaw f: left vector = (cos f, -sin f)
  const sideOfBall = (p, bx, bz, yaw) => ((bx - p.x) * Math.cos(yaw) - (bz - p.z) * Math.sin(yaw) > 0 ? 'L' : 'R');

  // ---------------------------------------------------------------- scoring / match flow
  function announce(text, kind = 'info') { s.announce = { text, kind, t: s.t, id: s.evSeq }; emit('announce', { text, kind }); }

  function startSet() {
    const m = s.match;
    m.pts = [0, 0]; m.serveCount = 0;
    m.serving = m.firstServer; s.last = null;
    startRally(true);
  }
  function startMatch() {
    const m = s.match;
    m.firstServer = cfg.firstServer ?? (rR.next() < 0.5 ? 0 : 1); m.serving = m.firstServer;
    startRally(true);
  }
  function startRally(instant = false) {
    const m = s.match;
    s.rally = { no: ++m.rallies, server: m.serving, touches: [0, 0], last: null, plan: null, kind: 'serve', crossed: false, dead: false, atk: null, blk: null, isServe: true };
    s.ball.vis = false; s.ball.flight = null; s.ball.free = null; s.fid++; s.queue = []; s.ring = null; s.tapT = [null, null]; s.pending = [null, null];
    for (const ch of s.choice) ch.attacker = null;
    formServe(m.serving, instant);
    s.phase = 'ready'; s.phaseT = s.t;
    schedule(s.t + (instant ? 1.2 : READY), 'toss');
    announce(`${s.teams[m.serving].name} to serve`, 'serve');
  }
  // practice drills: some rallies are cut short once the skill being practised has happened
  function drillHook(kind, d) {
    const dr = s.cfg.drill; if (!dr) return;
    const R = s.rally;
    if (dr.kind === 'receive' && kind === 'touch' && d.n === 2) schedule(s.t + 0.9, 'drillEnd', { always: true });
    if (dr.kind === 'spike' && kind === 'attack') schedule(s.t + 1.6, 'drillEnd', { always: true });
    void R;
  }
  function endRally(winner, reason, info = {}) {
    const R = s.rally; if (R.dead) return; R.dead = true;
    s.queue = []; s.ring = null; s.pending = [null, null];
    const m = s.match; m.pts[winner]++;
    m.history.push({ w: winner, r: reason });
    if (reason === 'ace') m.stats[winner].aces++;
    if (reason === 'kill') m.stats[winner].kills++;
    if (reason === 'block') m.stats[winner].blocks++;
    if (info.loser !== undefined && /fault|out|net|own|four|hand|serve/.test(reason)) m.stats[info.loser].errors++;
    s.last = { winner, reason, text: info.text || reason, t: s.t };
    emit('point', { winner, reason, text: info.text || reason, pts: [...m.pts] });
    s.phase = 'dead'; s.phaseT = s.t;
    // rally / set / match progression
    const [a, b] = m.pts;
    let setWon = null;
    const hi = Math.max(a, b), lo = Math.min(a, b);
    if ((hi >= m.setPts && hi - lo >= 2) || hi >= m.setCap) setWon = a > b ? 0 : 1;
    // service: three serves each, then alternate; deuce (20-20 in a full set) alternates every point
    m.serveCount++;
    if (s.cfg.drill) { m.serving = s.cfg.drill.server ?? 0; m.serveCount = 0; m.pts = [0, 0]; }
    const deuce = m.setPts >= 21 ? (a >= 20 && b >= 20) : (a >= m.setPts - 1 && b >= m.setPts - 1);
    if (deuce) { m.serving = 1 - m.serving; m.serveCount = 0; } else if (m.serveCount >= 3) { m.serving = 1 - m.serving; m.serveCount = 0; }
    if (setWon !== null) { m.sets[setWon]++; emit('setEnd', { winner: setWon, pts: [...m.pts], sets: [...m.sets] }); }
    if (setWon !== null && m.sets[setWon] >= m.setsToWin) { m.over = true; m.winner = setWon; schedule(s.t + POINT_PAUSE + 0.8, 'matchEnd'); }
    else if (setWon !== null) schedule(s.t + POINT_PAUSE + 2.5, 'nextSet', { winner: setWon });
    else schedule(s.t + POINT_PAUSE, 'nextRally');
    // celebrations / reactions are presenter-only; but give players short holds
  }

  // ---------------------------------------------------------------- choices
  const iqOf = (t) => s.teams[t].iq;
  function openDecision(team, kind, deadline, extra = {}) {
    const dec = { kind, open: s.t, deadline, ...extra };
    s.pending[team] = dec;
    if (!s.teams[team].human || cfg.bot) {
      const d = AI.decide(api, team, kind, extra, rA);
      applyChoice(team, d.choice);
      dec.reason = d.reason; dec.ai = d;
      if (cfg.watch) s.hold = { team, kind, decision: d, t: s.t, id: ++s.actSeq };
    } else if (s.cfg.drill == null) { /* human decides via UI */ }
  }
  function applyChoice(team, patch) { Object.assign(s.choice[team], patch); }
  function choose(team, patch) { if (!s.teams[team].human) return; applyChoice(team, patch); }
  function release() { s.hold = null; }
  // Human default when nothing was chosen: the same coach the Think button uses, at the team's own level.
  const humanDefault = (team, kind, extra) => AI.decide(api, team, kind, extra, rA, { fixedIq: 0.6, noNoise: false }).choice;

  // ---------------------------------------------------------------- serve
  function doToss() {
    const R = s.rally, srv = R.server, rcv = 1 - srv;
    s.phase = 'serve'; s.phaseT = s.t;
    const T = P(srv, 0), F = P(srv, 2);
    const circ = W(srv, 0, 4.25);
    teleportIfFar(T, circ); teleportIfFar(F, W(srv, -2.45, 0.6)); teleportIfFar(P(srv, 1), W(srv, 2.45, 0.6));
    const fwd = dirOf(srv);
    // contact point: the tekong strikes the falling ball in front of their body
    const cx = circ.x - latSign(srv) * 0.12, cz = circ.z + fwd * TECH_FWD.serve;
    const C = { x: cx, y: 1.30, z: cz };
    const hand = { x: F.x - 0.0, y: 1.10, z: F.z + fwd * 0.28 };
    const tc = s.t + TOSS_T;
    s.ball.vis = true;
    launch(flightTo(s.t, hand, C, TOSS_T), { kind: 'toss', team: srv });
    setAct(F, 'toss', 'toss', s.t, hand, { lead: 0.55, follow: 0.5, face: { x: circ.x, z: circ.z }, side: 'R', to: { x: C.x, z: C.z } });
    F.hold = s.t + 1.2;
    for (const p of [T]) { p.hold = tc + 0.9; }
    T.act = null; // set when the serve is resolved (needs the choice), but announce the kick spot now:
    s.rally.serveC = C;
    s.rally.serveTc = tc;
    s.ring = { team: srv, kind: 'serve', open: tc - 0.78, close: tc - LAG, tc, tapped: null };
    s.queue = s.queue.filter((e) => e.type !== 'land');
    schedule(tc, 'serveTouch', { keep: true });
    s.queue[s.queue.length - 1].fid = s.fid;
    emit('toss', { team: srv, tc, c: C });
    openDecision(srv, 'serve', tc, { tc, C });
    // the kicking action is planned so the presenter can start the wind-up before the contact
    const tk = P(srv, 0);
    setAct(tk, 'serve', 'serve', tc, C, { lead: 0.85, follow: 0.7, face: { x: C.x, z: C.z + fwd * 2 }, to: null, side: 'R' });
    tk.act.pending = true;
    // receivers get ready (nothing to do: they stand in formation)
    void rcv;
  }
  function teleportIfFar(p, pos) { if (Math.hypot(p.x - pos.x, p.z - pos.z) > 1.2) teleport(p, pos); else goto(p, pos); }

  function timingScore(team, tc, win = 1) {
    const ring = s.ring && s.ring.team === team ? s.ring : null;
    let e;
    if (s.teams[team].human && !cfg.bot) {
      if (ring && ring.tapped !== null) e = ring.tapped - (tc - LAG);
      else return { tm: 0.12, e: 0.35, none: true };
    } else if (cfg.bot && s.teams[team].human) {
      e = normal(rA) * cfg.bot.sigma;
    } else {
      const k = s.teams[team].skill;
      e = normal(rA) * (0.17 - 0.12 * k) * 1.0;
    }
    const a = Math.abs(e) / win;
    const tm = a <= 0.05 ? 1 : a <= 0.12 ? 0.8 - (a - 0.05) * 2 : a <= 0.22 ? 0.66 - (a - 0.12) * 2 : a <= 0.4 ? 0.46 - (a - 0.22) * 1.2 : 0.12;
    return { tm: clamp(tm, 0.1, 1), e };
  }

  function doServeTouch() {
    const R = s.rally, srv = R.server, rcv = 1 - srv;
    const T = P(srv, 0), tc = s.t;
    const C = R.serveC;
    let ch = s.choice[srv];
    const dec = s.teams[srv].human ? humanDefaultServe(srv) : null;
    const type = SERVES[(s.teams[srv].human && !s.pending[srv]?.touched ? ch.stype : ch.stype)] ?? SERVES.drive;
    let aim = ch.serveAim ?? dec;
    const tmS = timingScore(srv, tc);
    const st = T.st;
    const q = clamp(0.25 + 0.5 * st.pow * 0.4 + 0.45 * tmS.tm + 0.25 * st.tech - (tmS.none ? 0.1 : 0) + 0.1 * normal(rA) * (1 - st.tech), 0.05, 1);
    R.touches[srv] = 1; R.last = { team: srv, pid: T.id };
    s.rally.kind = 'serve';
    // foot fault (rare)
    if (rR.next() < 0.012 * (1 - st.tech) + (tmS.tm < 0.2 ? 0.02 : 0)) { fault(srv, 'service fault', 'Service fault'); return; }
    const spread = (0.30 + 1.5 * (1 - q) * (1 - q)) * type.acc ** -1 * 0.55;
    const tgt = { x: aim.x + normal(rR) * spread * 0.9, y: BR, z: aim.z + normal(rR) * spread };
    const margin = type.margin * (0.25 + 0.75 * q) + 0.04 + normal(rR) * 0.07 * (1.15 - q);
    const sol = solveClear(C, tgt, type.T, NETH, Math.max(margin, -0.3), 2.0);
    // negative margin means the shot may clip the net: solveClear returns the first T that clears `margin`, so it is allowed to be below the tape
    const fl = { ...flightTo(tc, C, tgt, sol.T) };
    T.act.q = q; T.act.stype = type.id; T.act.pending = false; T.act.to = { x: tgt.x, z: tgt.z };
    s.ring = null;
    const blockedByNet = false; void blockedByNet;
    launch(fl, { kind: 'serve', team: srv, q, power: type.id });
    emit('touch', { team: srv, pid: T.id, kind: 'serve', q, tech: 'serve', stype: type.id });
    formNeutralAfterServe(srv);
  }
  function humanDefaultServe(team) { return AI.decide(api, team, 'serve', {}, rA, { fixedIq: 0.6 }).choice.serveAim; }
  function formNeutralAfterServe(srv) { const r = 1 - srv; void r; goto(P(srv, 1), W(srv, 1.5, 2.8), 0.4); goto(P(srv, 2), W(srv, -1.5, 2.8), 0.4); }

  // ---------------------------------------------------------------- flight launch + planning
  function launch(fl, meta) {
    s.fid++;
    s.queue = s.queue.filter((e) => e.keep && e.fid === s.fid); // events of the old flight die (keep marks events that belong to the new flight)
    s.ball.flight = fl; s.ball.free = null; s.ball.meta = meta; s.ball.vis = true;
    plan(fl, meta);
  }
  function plan(fl, meta) {
    const R = s.rally;
    const tl = landTime(fl);
    const side0 = fl.z < 0 ? 0 : 1;
    const tn = netTime(fl, tl);
    let nextTeam = side0, blocked = false;
    R.kind = meta.kind;
    if (tn !== null) {
      const pn = posAt(fl, tn);
      const overWide = Math.abs(pn.x) > HW + 0.04;
      if (overWide) {
        schedule(tn, 'wide', { x: pn.x });
        return;
      }
      if (pn.y < s.netH - 0.012 && meta.kind !== 'toss') {
        schedule(tn, 'netHit', { y: pn.y });
        return;
      }
      if (pn.y < s.netH + BR * 0.7 && meta.kind !== 'toss') {
        schedule(tn, 'cord', { y: pn.y });
        return;
      }
      if (meta.kind === 'attack' && meta.block) {
        const b = meta.block;
        if (b.hit) { schedule(b.t, 'blockTouch', { ...b }); return; }
      }
      schedule(tn, 'net', { x: pn.x, y: pn.y });
      nextTeam = 1 - side0;
      R.crossed = true;
    }
    if (meta.kind === 'toss') return; // the serve touch is scheduled by doToss
    planReceive(fl, meta, nextTeam, tl);
  }

  function planReceive(fl, meta, team, tl) {
    const R = s.rally;
    const sameTeam = R.last && R.last.team === team;
    let cands = [0, 1, 2].map((r) => P(team, r)).filter((p) => !(sameTeam && R.last.pid === p.id));
    if (R.last && R.last.team === team && meta.noReceive) cands = [];
    const dr = s.cfg.drill;
    if (dr && dr.kind === 'serve' && team === 1) cands = [];
    let best = null;
    const pre = meta.plan?.pid;
    for (const p of cands) {
      const opts = { preferY: meta.preferY ?? 0.95, minY: 0.14, maxY: meta.kind === 'set' ? 1.2 : 1.3 };
      const ic = intercept(fl, p, s.t, opts);
      if (!ic) continue;
      let cost = ic.cost + (p.id === pre ? -1.2 : 0);
      if (!best || cost < best.cost) best = { ...ic, p, cost };
    }
    // A fourth touch is a fault; a team that has used three touches never plays it on purpose.
    const touches = sameTeam ? R.touches[team] : 0;
    if (best && touches >= 3 && sameTeam) {
      schedule(best.t, 'fourTouch', { pid: best.p.id });
      return;
    }
    if (!best) {
      // nobody gets there: the ball lands. The nearest defender lunges for it.
      const lp = posAt(fl, tl);
      let near = null;
      for (const p of cands) { const d = Math.hypot(lp.x - p.x, lp.z - p.z); if (!near || d < near.d) near = { p, d }; }
      // a desperate dive can still keep the ball alive when it lands close to a defender
      if (near && depthOf(team, lp.z) > 1.2 && Math.abs(lp.x) < HW + 1.5 && Math.abs(lp.z) < HL + 1.5) {
        const td = (timeAtHeight(fl, 0.16, true) ?? tl);
        const dd = near.d;
        const need = dd - (p0reach(near.p, td - s.t));
        const pSave = clamp(0.62 * near.p.st.ctrl * (1 - need / 1.3) * (R.touches[team] >= 3 && sameTeam ? 0 : 1), 0, 0.7);
        if (need < 1.3 && rR.next() < pSave) {
          const bp = posAt(fl, td);
          const ev = schedule(td, 'touch', { team, pid: near.p.id, tech: 'dive', stretch: 1, c: { x: bp.x, y: bp.y, z: bp.z } });
          ev.keep = true; ev.fid = s.fid;
          const dstand = { x: bp.x, z: bp.z - (near.p.team === 0 ? -0.1 : 0.1) };
          setPath(near.p, bp.x + (near.p.x - bp.x) * 0.35, bp.z + (near.p.z - bp.z) * 0.35, s.t + near.p.st.react, td - 0.1);
          near.p.lockFrom = td - 0.1; near.p.hold = td + 0.3;
          const act = setAct(near.p, R.touches[team] >= 1 && sameTeam ? (R.touches[team] === 1 ? 'set' : 'free') : 'receive', 'dive', td, bp, { lead: 0.55, follow: 0.9, stretch: 1, lunge: need, face: { x: bp.x, z: bp.z } });
          act.pending = true; void dstand;
          return;
        }
      }
      schedule(tl, 'land', { x: lp.x, z: lp.z });
      if (near && depthOf(team, lp.z) > 0 && near.d < 6) { goto(near.p, { x: lp.x, z: lp.z }, near.p.st.react); }
      if (near && near.d < 2.6 && depthOf(team, lp.z) > 0 && sameTeam !== true) {
        near.p.hold = 0;
        const dv = { x: lp.x, y: BR + 0.1, z: lp.z };
        const a = setAct(near.p, 'dive', 'dive', tl - 0.12, dv, { lead: 0.5, follow: 0.9, fail: true, face: { x: lp.x, z: lp.z } });
        void a;
      }
      return;
    }
    // stand spot: ball position pulled back along the intended outgoing direction
    const p = best.p;
    let to = meta.outTo ?? W(team, 0, 2.2);
    const intent = intentFor(team, p);
    const out = { x: to.x - best.x, z: to.z - best.z }; const ol = Math.hypot(out.x, out.z) || 1; out.x /= ol; out.z /= ol;
    const fwd = TECH_FWD[best.tech === 'dive' ? 'foot' : best.tech] ?? 0.4;
    const stand = { x: best.x - out.x * fwd, z: best.z - out.z * fwd };
    { const dd0 = depthOf(team, stand.z); if (dd0 < 0.55) stand.z = W(team, 0, 0.55).z; }
    // limit to what the player can reach
    // limit the stand spot to what the player can reach at a sensible speed, then script the arrival
    const tStart = s.t + p.st.react, tArr = best.t - 0.08;
    const dx = stand.x - p.x, dz = stand.z - p.z, dd = Math.hypot(dx, dz), vmax = p.st.spd * 1.05, reach = vmax * Math.max(0.05, tArr - tStart);
    const fin = dd > reach ? { x: p.x + dx / dd * reach, z: p.z + dz / dd * reach } : stand;
    p.act = null;
    setPath(p, fin.x, fin.z, tStart, tArr);
    p.lockFrom = tArr; p.hold = best.t + 0.4;
    const ev = schedule(best.t, 'touch', { team, pid: p.id, tech: best.tech, stretch: best.stretch, c: { x: best.x, y: best.y, z: best.z } });
    ev.keep = true; ev.fid = s.fid;
    // the planned toucher already shows the preparation
    const c = { x: best.x, y: best.y, z: best.z };
    void intent;
    const nTouch = (sameTeam ? R.touches[team] : 0) + 1;
    const act = setAct(p, nTouch === 1 ? 'receive' : nTouch === 2 ? 'set' : 'free', best.tech, best.t, c, { lead: 0.55, follow: 0.55, face: { x: to.x, z: to.z }, to: { x: to.x, z: to.z }, stretch: best.stretch, lunge: Math.max(0, best.d - 0.3) });
    act.pending = true;
    if (meta.kind !== 'attackSetup') openReceiveDecisions(team, meta, best);
  }
  const p0reach = (p, dt) => REACH0 + p.st.spd * 0.9 * Math.max(0, dt - p.st.react - PREP);
  const intentFor = (team, p) => { const R = s.rally; return R.touches[team]; };

  // decision windows that open while the ball is in flight towards `team`
  function openReceiveDecisions(team, meta, best) {
    const R = s.rally;
    const sameTeam = R.last && R.last.team === team;
    if (!sameTeam) {
      // first touch of a new possession: pick the attacker
      openDecision(team, 'recv', best.t, { receiver: best.p.id });
      // the other team just attacked / served: tell them they can defend
    }
  }

  // ---------------------------------------------------------------- touches
  function doTouch(ev) {
    const R = s.rally, team = ev.team, p = s.players[ev.pid];
    const fl = s.ball.flight, tc = ev.t;
    const b = posAt(fl, tc);
    const vin = speedAt(fl, tc);
    if (!R.last || R.last.team !== team) R.touches[team] = 0;
    R.isServe = false;
    const n = ++R.touches[team];
    if (s.cfg.drill && team === 0) drillHook('touch', { n });
    const st = p.st;
    const prevQ = s.ball.meta?.q ?? 0.6;
    R.last = { team, pid: p.id };
    let q = 0.12 + 0.82 * st.ctrl - 0.5 * ev.stretch - 0.40 * clamp((vin - 7) / 17, 0, 1) * (1.1 - 0.5 * st.ctrl) + normal(rR) * 0.14 * (1.15 - st.ctrl);
    q = clamp(q, 0.02, 1);
    const act = p.act && p.act.tc === tc ? p.act : setAct(p, n === 1 ? 'receive' : n === 2 ? 'set' : 'free', ev.tech, tc, b, { stretch: ev.stretch });
    act.q = q; act.pending = false; act.c = { x: r2(b.x), y: r2(b.y), z: r2(b.z) };
    emit('touch', { team, pid: p.id, kind: 'receive', n, q, tech: ev.tech, c: act.c });
    const meta0 = s.ball.meta || {};
    // hand touch on a stretched ball
    if (ev.stretch > 0.2 && rR.next() < 0.10 * ev.stretch) { fault(team, 'hand touch', 'Hand touch'); act.fail = true; return; }
    const intent = n === 1 ? 'receive' : n === 2 ? 'set' : 'attack';
    const planned = R.plan && R.plan.team === team ? R.plan : null;
    if (n === 1) {
      // choose attacker + setter
      const others = [0, 1, 2].filter((r) => r !== p.role);
      let pick = s.choice[team].attacker;
      if (pick === null || pick === p.role || !others.includes(pick)) pick = s.teams[team].human ? humanDefault(team, 'recv', { receiver: p.id }).attacker : s.choice[team].attacker;
      if (pick === null || pick === undefined || !others.includes(pick)) pick = others[0];
      const att = pick, setr = others.find((r) => r !== att);
      R.plan = { team, setter: P(team, setr).id, attacker: P(team, att).id };
      doPass(team, p, b, q, act, vin);
    } else if (n === 2) {
      doSet(team, p, b, q, act, vin);
    } else {
      doAttackOrOver(team, p, b, q, act, vin, ev);
    }
  }

  function scatter(sig) { return { x: normal(rR) * sig, z: normal(rR) * sig }; }

  function wildBall(team, p, b, act, why) {
    const T = rR.range(0.9, 1.5);
    const to = { x: clamp(b.x + rR.range(-4, 4), -HW - 2, HW + 2), y: BR, z: clamp(b.z + rR.range(-4, 4), -HL - 2, HL + 2) };
    act.to = { x: to.x, z: to.z }; act.fail = true;
    const fl = flightTo(s.t, b, to, T);
    emit('shank', { team, pid: p.id, why });
    launch(fl, { kind: 'wild', team, q: 0.1, noReceive: false });
  }

  function doPass(team, p, b, q, act, vin) {
    const R = s.rally, setter = s.players[R.plan.setter];
    if (q < 0.18 && rR.next() < (0.18 - q) / 0.18 * 0.9) { wildBall(team, p, b, act, 'receive'); return; }
    const spot = setSpot(team, setter.role);
    const sg = 0.10 + 1.15 * (1 - q) * (1 - q);
    const e = scatter(sg);
    let to = { x: spot.x + e.x, y: 1.0, z: spot.z + e.z };
    // keep the pass on its own side
    const dep = depthOf(team, to.z); if (dep < 0.7) to = { ...to, ...W(team, latOf(team, to.x), 0.7) , y: 1.0 };
    act.to = { x: to.x, z: to.z };
    const T = 1.15 + (1 - q) * 0.15;
    const fl = flightTo(s.t, b, to, T);
    // Pre-plan the attacker: head for the lane
    const att = s.players[R.plan.attacker];
    goto(att, W(team, laneLat(att.role) || 1.2, 1.7), 0.15);
    if (p.role !== 0) goto(P(team, 0), W(team, 0, 4.2), 0.3);
    launch(fl, { kind: 'pass', team, q, plan: { pid: setter.id }, outTo: W(team, latOf(team, to.x) * 0.5, 1.2), preferY: 1.0 });
    // set decision for this team (zone/pace): opens now, deadline = set contact
    const ev = s.queue.find((x) => x.type === 'touch');
    openDecision(team, 'set', ev ? ev.t : s.t + 1, { setter: setter.id, attacker: att.id });
    // the opponent notes the pass
  }

  function doSet(team, p, b, q, act, vin) {
    const R = s.rally;
    const ch = s.choice[team];
    const human = s.teams[team].human;
    const dec = human ? null : null; void dec;
    const zone = ch.zone, pace = ch.pace;
    // the attacker is whoever is not in the chain so far
    const used = new Set([R.firstToucher ?? -1]);
    let att = R.plan ? s.players[R.plan.attacker] : null;
    if (!att || att.id === p.id) att = [0, 1, 2].map((r) => P(team, r)).find((x) => x.id !== p.id && x.id !== R.chain1);
    if (!att) att = [0, 1, 2].map((r) => P(team, r)).find((x) => x.id !== p.id);
    void used;
    if (q < 0.15 && rR.next() < (0.15 - q) / 0.15 * 0.9) { wildBall(team, p, b, act, 'set'); return; }
    if (pace === 'over') {
      doOver(team, p, b, q, act, 'free');
      return;
    }
    const pc = SET_PACE[pace] || SET_PACE.high;
    const sg = 0.08 + 0.95 * (1 - q) * (1 - q);
    const e = scatter(sg);
    const lat = zone * ZONE_LAT;
    let P3 = { ...W(team, lat, ZONE_DEPTH), y: pc.y };
    P3 = { x: P3.x + e.x, y: P3.y + normal(rR) * 0.10 * (1.1 - q), z: P3.z + e.z * 0.7 };
    // never set through the net line
    let dep = depthOf(team, P3.z); if (dep < 0.4) { const w = W(team, latOf(team, P3.x), 0.4); P3.z = w.z; }
    act.to = { x: P3.x, z: P3.z };
    const T = pc.T;
    const fl = flightTo(s.t, b, P3, T);
    const tc3 = s.t + T;
    s.rally.atk = { team, pid: att.id, P3, tc3, q2: q, pace, type: null };
    // attacker approach + the opponent's block plan
    planAttackerApproach(team, att, P3, tc3, q);
    goto(P(team, 0), W(team, 0, 4.2), 0.3);
    launch(fl, { kind: 'set', team, q, plan: { pid: att.id }, atk: true, setAttacker: att.id, outTo: { x: P3.x, z: P3.z }, noReceive: true });
    // schedule: blockers read the set, the attacker commits to an attack, the swing is timed against the ring
    const tBlock = Math.max(tc3 - 0.80, s.t + 0.05), tAI = Math.max(tc3 - 0.68, tBlock + 0.05), tCommit = Math.max(tc3 - 0.62, tAI + 0.03);
    s.ring = { team, kind: 'attack', open: tc3 - 0.78, close: tc3 - LAG, tc: tc3, tapped: null };
    s.rally.atk.tCommit = tCommit;
    if (s.teams[team].human && !cfg.bot) openDecision(team, 'attack', tc3, { attacker: att.id, P3, tc3, commit: tCommit });
    else schedule(tAI, 'aiAttack', { team, attacker: att.id, P3, tc3, keep: true, fid: s.fid });
    const opp = 1 - team;
    openDecision(opp, 'block', tBlock, { zone, P3 });
    schedule(tBlock, 'blockCommit', { team: opp, atkTeam: team, keep: true, fid: s.fid });
    schedule(tCommit, 'attackCommit', { team, pid: att.id, keep: true, fid: s.fid });
    schedule(tc3, 'attackTouch', { team, pid: att.id, keep: true, fid: s.fid });
    formNeutral(opp, 0.15);
  }

  function planAttackerApproach(team, att, P3, tc3, q2) {
    const pel = { x: P3.x, z: P3.z - dirOf(team) * ATTACK_FWD };    // pelvis stands behind the contact point
    const tStart = s.t + 0.05, tArr = tc3 - 0.60;
    const dx = pel.x - att.x, dz = pel.z - att.z, d = Math.hypot(dx, dz), reach = att.st.spd * 1.1 * Math.max(0.05, tArr - tStart);
    const short = Math.max(0, d - reach);
    const fin = d > reach ? { x: att.x + dx / d * reach, z: att.z + dz / d * reach } : pel;
    att.act = null;
    setPath(att, fin.x, fin.z, tStart, tArr);
    att.lockFrom = tArr; att.hold = tc3 + 0.8;
    s.rally.atk.short = short; s.rally.atk.pel = fin; s.rally.atk.pelWant = pel;
  }

  // The attacker commits to a type (the animation needs it from take-off) and the act is created so the body can prepare.
  function attackCommit(ev) {
    const R = s.rally, A = R.atk; if (!A || A.done) return;
    const team = ev.team, p = s.players[ev.pid];
    const ch = s.choice[team];
    const type = ATTACKS[ch.atype] || ATTACKS.roll;
    A.type = type.id;
    const b = A.P3, st = p.st;
    const needJ = b.y - REACH_UP[type.id] - PELVIS_Y;
    const hAir = clamp(needJ, 0.15, 0.2 + st.jump);
    const tc = A.tc3, upT = type.up;
    const air = { ts: tc - upT, ta: tc + 0.03, te: tc + 0.03 + (upT + 0.03), h: hAir };
    const aim = ch.aim || { x: 0, z: dirOf(team) * 4.5 };
    const act = setAct(p, 'attack', 'attack', tc, b, { atype: type.id, air, face: { x: aim.x, z: aim.z }, to: { x: aim.x, z: aim.z }, follow: upT + 0.6, stretch: 0, lead: 0 });
    act.t0 = tc - 0.62;
    act.pending = true; A.act = act; A.air = air; A.needJ = needJ;
    emit('commit', { team, pid: p.id, atype: type.id });
  }

  function doOver(team, p, b, q, act, label) {
    // soft free ball over the net to a target
    const opp = 1 - team;
    let aim = s.choice[team].overAim;
    if (!aim || s.teams[team].human === false) aim = AI.decide(api, team, 'over', {}, rA).choice.overAim;
    if (!s.teams[team].human) { /* AI uses its pick */ }
    const e = scatter(0.15 + 1.4 * (1 - q) * (1 - q));
    const to = { x: aim.x + e.x, y: BR, z: aim.z + e.z };
    const T0 = 1.15;
    const sol = solveClear(b, to, T0, s.netH, 0.35 + normal(rR) * 0.1 * (1.2 - q), 2.4);
    act.to = { x: to.x, z: to.z };
    const fl = flightTo(s.t, b, to, sol.T);
    goto(P(team, 0), W(team, 0, 4.2), 0.2);
    launch(fl, { kind: 'free', team, q, outTo: W(opp, 0, 3) });
    void label;
  }

  function doAttackOrOver(team, p, b, q, act, vin, ev) {
    // a third touch by someone who is not the planned attacker (the set went astray): a free ball over the net
    if (q < 0.12 && rR.next() < 0.5) { wildBall(team, p, b, act, 'free'); return; }
    doOver(team, p, b, q, act, 'free');
  }

  // The planned attack contact (set arrives at P3)
  function doAttackTouch(ev) {
    const R = s.rally, A = R.atk, team = ev.team;
    if (s.cfg.drill && team === 0) drillHook('attack', {});
    const p = s.players[ev.pid];
    const fl = s.ball.flight, tc = ev.t;
    const b = posAt(fl, tc);
    const opp = 1 - team;
    A.done = true;
    if (!A.act) attackCommit({ team, pid: p.id });
    if (!R.last || R.last.team !== team) R.touches[team] = 0;
    R.touches[team]++; R.last = { team, pid: p.id };
    const ch = s.choice[team];
    const type = ATTACKS[A.type] || ATTACKS.roll;
    const st = p.st;
    const tmS = timingScore(team, tc, type.win);
    const short = A.short ?? 0;
    const needJ = A.needJ;
    const jumpShort = Math.max(0, needJ - (0.2 + st.jump));
    const fit = clamp(1 - Math.abs(b.y - type.y) * 1.1, 0.3, 1);
    const stretch = clamp(short / 0.5 + jumpShort / 0.3, 0, 2);
    let q = 0.22 + 0.30 * st.tech + 0.42 * tmS.tm + 0.15 * fit - 0.30 * stretch + normal(rR) * 0.09 * (1.1 - st.tech) + 0.05 * (A.q2 - 0.5);
    q = clamp(q, 0.02, 1);
    let aim = ch.aim;
    if (!aim) aim = AI.decide(api, team, 'attack', { attacker: p.id, P3: A.P3, tc3: tc }, rA, { fixedIq: 0.6 }).choice.aim;
    const sc = (0.22 + 1.25 * (1 - q) * (1 - q)) / type.acc * 0.85;
    const tgtX = aim.x + normal(rR) * sc * 0.8, tgtZ = aim.z + normal(rR) * sc;
    const tgt = { x: tgtX, y: BR, z: tgtZ };
    const dist = Math.hypot(tgt.x - b.x, tgt.z - b.z, b.y);
    const Tpref = Math.max(0.52, dist / (type.speed * (0.82 + 0.3 * st.pow)));
    const margin = 0.16 + normal(rR) * 0.14 * (1.2 - q);
    const sol = solveClear(b, tgt, Tpref, s.netH, margin, 2.2);
    const aFl = flightTo(tc, b, tgt, sol.T);
    const netDepth = depthOf(team, A.pel ? A.pel.z : p.z);
    let netTouch = false;
    if (netDepth < NET_TOUCH_DEPTH + 0.25) netTouch = rR.next() < 0.5 * (1 - (netDepth - NET_TOUCH_DEPTH) / 0.25) * (1.4 - tmS.tm);
    const act = A.act;
    if (stretch >= 1.0) {
      // the attacker cannot get to the ball: the jump happens but the ball is not touched and falls on their own side
      act.miss = true; act.pending = false; act.fail = true; p.hold = A.air.te + 0.4;
      emit('miss', { team, pid: p.id });
      R.touches[team]--; R.last = R.touches[team] > 0 ? R.last : R.last;
      return;
    }
    act.c = { x: r2(b.x), y: r2(b.y), z: r2(b.z) }; act.q = q; act.stretch = stretch; act.to = { x: tgt.x, z: tgt.z }; act.face = { x: tgt.x, z: tgt.z }; act.pending = false;
    act.tm = r2(tmS.tm); act.tmE = r2(tmS.e); act.t1 = tc + type.up + 0.6;
    p.hold = A.air.te + 0.4;
    emit('touch', { team, pid: p.id, kind: 'attack', n: R.touches[team], q, tm: tmS.tm, atype: type.id, c: act.c, aim: { x: r2(tgtX), z: r2(tgtZ) } });
    s.ring = null;
    if (netTouch) { act.netTouch = true; fault(team, 'net touch', 'Net touch'); return; }
    const blk = resolveBlock(opp, team, aFl, tc, b, type, q, p);
    const meta = { kind: 'attack', team, q, atype: type.id, block: blk, power: speedAt(aFl, tc), outTo: { x: tgtX, z: tgtZ } };
    launch(aFl, meta);
  }

  // ---------------------------------------------------------------- blocking
  function blockCommit(ev) {
    const opp = ev.team, atkTeam = ev.atkTeam;
    const A = s.rally.atk;
    if (!A) return;
    const mode = s.choice[opp].block;
    const insides = [P(opp, 1), P(opp, 2)];
    const atkX = A.P3.x;
    for (const p of s.players) if (p.team === opp) p.blocker = false;
    const rb = [];
    const tc3 = A.tc3;
    if (mode === 'drop') {
      goto(P(opp, 1), W(opp, 1.5, 3.2), 0.05); goto(P(opp, 2), W(opp, -1.5, 3.2), 0.05); goto(P(opp, 0), W(opp, 0, 4.9), 0.05);
      s.rally.blk = { mode, blockers: [] };
      return;
    }
    const lat = latOf(opp, atkX);
    const pace = A.pace === 'quick' ? 1.5 : 1;
    const sorted = insides.slice().sort((a, b) => Math.abs(latOf(opp, a.x) - lat) - Math.abs(latOf(opp, b.x) - lat));
    const chosen = mode === 'double' ? sorted : [sorted[0]];
    const other = mode === 'double' ? null : sorted[1];
    chosen.forEach((p, i) => {
      const sig = clamp(0.95 - 0.85 * p.st.blk, 0.12, 0.9) * pace;
      const bx = atkX + normal(rR) * sig * (mode === 'double' ? 0.6 : 1) + (mode === 'double' ? (i === 0 ? -0.5 : 0.5) : 0);
      const pos = { x: clamp(bx, -HW + 0.15, HW - 0.15), z: dirOf(atkTeam) * 0.6 };
      // the jump is timed on the attacker, not on the ball: apex a little after the attack contact, with the blocker's own timing error
      const sigT = 0.05 + 0.10 * (1 - p.st.blk) + (A.pace === 'quick' ? 0.03 : 0);
      const eJ = normal(rR) * sigT + 0.01;
      const apex = tc3 + 0.11 + eJ;
      const jumpH = clamp(0.3 + 0.55 * p.st.jump, 0.25, 0.75);
      const up = 0.36;
      const air = { ts: apex - up, ta: apex, te: apex + up, h: jumpH };
      const reachTop = PELVIS_Y + jumpH + 0.68;
      p.act = null;
      setPath(p, pos.x, pos.z, s.t + 0.05, Math.max(s.t + 0.15, air.ts - 0.12));
      p.lockFrom = Math.max(s.t + 0.15, air.ts - 0.12); p.hold = air.te + 0.3;
      const ac = setAct(p, 'block', 'block', apex, { x: pos.x, y: reachTop - 0.12, z: dirOf(atkTeam) * 0.22 }, { air, lead: 0, follow: up + 0.5, face: { x: pos.x, z: -dirOf(atkTeam) * 3 }, side: i === 0 ? 'R' : 'L' });
      ac.t0 = air.ts - 0.6; ac.pending = true;
      p.blocker = true; p.bx = pos.x; p.bapex = apex; p.beJ = eJ; p.breach = reachTop;
      rb.push(p.id);
    });
    if (other) goto(other, W(opp, -Math.sign(lat || 1) * 1.2, 3.0), 0.1);
    goto(P(opp, 0), W(opp, clamp(-lat * 0.4, -1.4, 1.4), 4.5), 0.05);
    s.rally.blk = { mode, blockers: rb };
  }

  // decide at attack contact whether the ball is blocked (blockers are already moving / jumping from blockCommit)
  function resolveBlock(opp, atkTeam, fl, tc, b, type, q, attacker) {
    const R = s.rally;
    const info = R.blk;
    if (!info || !info.blockers.length) return { hit: false };
    const tn = netTime(fl, landTime(fl));
    if (tn === null) return { hit: false };
    const pn = posAt(fl, tn);
    if (pn.y < s.netH) return { hit: false };
    let chosen = null;
    for (const id of info.blockers) {
      const bp = s.players[id];
      const inTime = Math.abs(bp.bapex - tn) <= 0.085;
      const inLine = Math.abs(pn.x - bp.bx) <= 0.70;
      const inReach = pn.y <= bp.breach - 0.02;
      if (inTime && inLine && inReach && !chosen) chosen = bp;
    }
    if (!chosen) return { hit: false };
    const bp = chosen;
    const tb = tn + 0.02;
    const pb = posAt(fl, tb);
    const steep = clamp(-velAt(fl, tb).y / Math.max(1, speedAt(fl, tb)), 0, 1);
    const power = speedAt(fl, tb);
    const pKill = clamp(0.28 + 0.45 * (bp.st.blk - 0.45) + 0.25 * steep + (info.mode === 'double' ? 0.12 : 0) - 0.18 * (type.tip ? 1 : 0), 0.06, 0.85);
    const kill = rR.next() < pKill;
    const ac = bp.act;
    ac.tc = tb; ac.c = { x: r2(pb.x), y: r2(pb.y), z: r2(pb.z) }; ac.hit = true; ac.kill = kill; ac.pending = false;
    return { hit: true, t: tb, pid: bp.id, kill, c: { x: pb.x, y: pb.y, z: pb.z }, steep, power };
  }

  function doBlockTouch(ev) {
    const R = s.rally;
    const bp = s.players[ev.pid];
    const opp = bp.team, atkTeam = 1 - opp;
    const fl = s.ball.flight;
    const b = posAt(fl, ev.t);
    R.last = { team: opp, pid: bp.id };
    R.touches[opp] = 0; R.touches[atkTeam] = 0;   // a block is not one of the three touches
    emit('block', { team: opp, pid: bp.id, kill: ev.kill, c: { x: r2(b.x), y: r2(b.y), z: r2(b.z) } });
    if (ev.kill) {
      // stuff: ball drops steeply on the attackers' side near the net
      const to = { x: clamp(b.x + rR.range(-1.4, 1.4), -HW + 0.2, HW - 0.2), y: BR, z: -dirOf(opp) * rR.range(0.8, 3.2) * -1 };
      to.z = -dirOf(opp) * rR.range(0.8, 3.0) * -1;
      // attackers are on the other side: their side z sign = -dirOf(atkTeam)... compute explicitly
      const tz = -dirOf(atkTeam) * rR.range(0.9, 3.2);
      const fl2 = flightTo(s.t, b, { x: to.x, y: BR, z: tz }, rR.range(0.38, 0.52));
      launch(fl2, { kind: 'blockKill', team: opp, q: 0.5, outTo: { x: to.x, z: tz } });
      bp.act.to = { x: to.x, z: tz };
    } else {
      // soft block: the ball pops up and drifts, usually to the blockers' side
      const toSide = rR.next() < 0.72 ? opp : atkTeam;
      const tz = -dirOf(toSide) * rR.range(1.2, 3.8);
      const to = { x: clamp(b.x + rR.range(-1.6, 1.6), -HW + 0.3, HW - 0.3), y: BR, z: tz };
      const fl2 = flightTo(s.t, b, to, rR.range(0.9, 1.25));
      bp.act.to = { x: to.x, z: to.z };
      launch(fl2, { kind: 'blockSoft', team: opp, q: 0.4, outTo: { x: to.x, z: tz } });
    }
  }

  // ---------------------------------------------------------------- net / landing
  function netEvent(ev) {
    const R = s.rally, fl = s.ball.flight;
    const last = R.last;
    if (ev.type === 'net') { emit('net', { over: true }); return; }
    if (ev.type === 'cord') {
      // the tape clips the ball: it loses pace and usually dribbles over
      const pn = posAt(fl, ev.t);
      const side0 = fl.z < 0 ? 0 : 1;
      const over = rR.next() < 0.55;
      const sz = over ? dirOf(side0) : -dirOf(side0);
      const to = { x: clamp(pn.x + rR.range(-0.5, 0.5), -HW + 0.1, HW - 0.1), y: BR, z: (over ? 1 : -1) * dirOf(side0) * rR.range(0.4, 1.3) };
      const fl2 = flightTo(s.t, { x: pn.x, y: pn.y + 0.05, z: pn.z }, to, rR.range(0.45, 0.7));
      emit('cord', { over });
      launch(fl2, { kind: 'cord', team: last.team, q: 0.4, outTo: { x: to.x, z: to.z }, preferY: 0.4 });
      void sz;
      return;
    }
    if (ev.type === 'netHit') {
      const pn = posAt(fl, ev.t);
      const side0 = fl.z < 0 ? 0 : 1;
      emit('netHit', { x: pn.x, y: pn.y });
      const mk = s.ball.meta?.kind;
      if (R.isServe || mk === 'attack' || R.touches[last.team] >= 3) {
        const to0 = { x: pn.x, y: pn.y, z: pn.z - dirOf(side0) * 0.05 };
        startBounceFrom(to0, { x: 0, y: 0, z: -dirOf(side0) * 0.8 }, s.t); R.crossed = false;
        endRally(1 - last.team, R.isServe ? 'serve fault' : 'net', { loser: last.team, text: R.isServe ? 'Service fault: into the net' : 'Into the net' });
        return;
      }
      const to = { x: pn.x * 0.9, y: BR, z: -dirOf(side0) * 0.4 * -1 };
      to.z = -(-dirOf(side0)) * 0 + (side0 === 0 ? -0.35 : 0.35);
      const fl2 = flightTo(s.t, { x: pn.x, y: pn.y, z: pn.z - dirOf(side0) * 0.05 }, to, 0.35);
      launch(fl2, { kind: 'netDrop', team: last.team, q: 0.3, noReceive: false, preferY: 0.3 });
      return;
    }
    if (ev.type === 'wide') {
      emit('wide', { x: ev.x });
      const lt = last.team;
      endRally(1 - lt, 'out', { loser: lt, text: 'Out: wide of the net' });
    }
  }

  function doLand(ev) {
    const R = s.rally, fl = s.ball.flight;
    const x = ev.x, z = ev.z;
    const side = z < 0 ? 0 : 1;
    const last = R.last ? R.last.team : R.server;
    const inb = Math.abs(x) <= HW && Math.abs(z) <= HL;
    startBounce(fl, ev.t);
    emit('land', { x: r2(x), z: r2(z), in: inb, side });
    const lastKind = s.ball.meta?.kind;
    if (R.isServe && side === R.server) { endRally(1 - R.server, 'serve fault', { loser: R.server, text: 'Service fault: ball did not cross' }); return; }
    if (inb) {
      const loser = side, w = 1 - loser;
      let reason = 'point', txt = 'Ball down';
      if (lastKind === 'serve') { reason = 'ace'; txt = 'Ace'; }
      else if (R.last && R.last.team === w && lastKind === 'attack') { reason = 'kill'; txt = 'Spike wins the point'; }
      else if (R.last && R.last.team === w && lastKind === 'blockKill') { reason = 'block'; txt = 'Block wins the point'; }
      else if (R.last && R.last.team === loser) { reason = 'own court'; txt = 'Ball fell on own side'; }
      endRally(w, reason, { loser, text: txt });
    } else {
      endRally(1 - last, 'out', { loser: last, text: 'Out' });
    }
  }

  function fault(team, reason, text) {
    emit('fault', { team, reason });
    stopBall();
    endRally(1 - team, reason, { loser: team, text });
  }
  function stopBall() {
    const fl = s.ball.flight; if (!fl) return;
    const b = posAt(fl, s.t); startBounceFrom(b, velAt(fl, s.t), s.t);
  }
  function startBounce(fl, t) { const b = posAt(fl, t); const v = velAt(fl, t); startBounceFrom({ x: b.x, y: BR, z: b.z }, v, t); }
  function startBounceFrom(b, v, t) {
    s.ball.free = { x: b.x, y: Math.max(BR, b.y), z: b.z, vx: v.x * 0.55, vy: -v.y * 0.45, vz: v.z * 0.55, n: 0 };
    s.ball.flight = null;
  }
  function freeBall(dt) {
    const f = s.ball.free; if (!f) return;
    f.vy -= G * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
    if (f.y <= BR) {
      f.y = BR;
      if (Math.abs(f.vy) > 0.9 && f.n < 4) { f.vy = -f.vy * 0.45; f.n++; f.vx *= 0.8; f.vz *= 0.8; } else { f.vy = 0; const k = Math.max(0, 1 - 2.2 * dt); f.vx *= k; f.vz *= k; }
    }
    f.x = clamp(f.x, -HW - 2.8, HW + 2.8); f.z = clamp(f.z, -HL - 2.8, HL + 2.8);
  }

  // ---------------------------------------------------------------- event loop
  function runEvent(ev) {
    switch (ev.type) {
      case 'toss': doToss(); break;
      case 'serveTouch': doServeTouch(); break;
      case 'touch': if (!s.rally.dead && ev.fid === s.fid) doTouch(ev); break;
      case 'attackTouch': if (!s.rally.dead && ev.fid === s.fid) doAttackTouch(ev); break;
      case 'aiAttack': if (!s.rally.dead && ev.fid === s.fid) openDecision(ev.team, 'attack', ev.tc3, { attacker: ev.attacker, P3: ev.P3, tc3: ev.tc3 }); break;
      case 'attackCommit': if (!s.rally.dead && ev.fid === s.fid) attackCommit(ev); break;
      case 'blockCommit': if (!s.rally.dead && ev.fid === s.fid) blockCommit(ev); break;
      case 'blockTouch': if (!s.rally.dead && ev.fid === s.fid) doBlockTouch(ev); break;
      case 'net': case 'cord': case 'netHit': case 'wide': if (!s.rally.dead && ev.fid === s.fid) netEvent(ev); break;
      case 'land': if (!s.rally.dead && ev.fid === s.fid) doLand(ev); break;
      case 'fourTouch': if (!s.rally.dead && ev.fid === s.fid) { const p = s.players[ev.pid]; setAct(p, 'receive', 'foot', ev.t, posAt(s.ball.flight, ev.t), { fail: true }); fault(p.team, 'four touches', 'Fault: four touches'); } break;
      case 'drillEnd': if (!s.rally.dead) { emit('drillEnd', {}); endRally(0, 'drill', { text: 'Drill rally over' }); } break;
      case 'nextRally': startRally(false); break;
      case 'nextSet': { const m = s.match; m.setNo++; m.firstServer = 1 - m.firstServer; m.pts = [0, 0]; m.serveCount = 0; m.serving = m.firstServer; announce(`Set ${m.setNo}`, 'set'); startRally(false); break; }
      case 'matchEnd': s.phase = 'matchEnd'; emit('matchEnd', { winner: s.match.winner }); break;
      default: break;
    }
  }

  // Which events must still fire when a flight was replaced: only those carrying the current fid.
  function update(dt) {
    if (s.hold || s.match.over && s.phase === 'matchEnd') return;
    // time scale: slow motion while a human decision is open
    const dtE = dt * s.ts;
    const tTick = s.t + dtE;
    let guard = 0;
    // events run at their own exact time (so a contact launches the ball at the contact instant, not one tick later)
    while (s.queue.length && s.queue[0].t <= tTick + 1e-9 && guard++ < 50) {
      const ev = s.queue.shift();
      if (ev.fid !== undefined && ev.fid !== s.fid && !ev.always) continue;
      s.t = Math.max(s.t, ev.t);
      runEvent(ev);
      if (s.hold) break;
    }
    s.t = tTick;
    movePlayers(dtE);
    faceUpdate();
    // ball
    const bl = s.ball;
    if (bl.flight) { const p = posAt(bl.flight, s.t); bl.x = p.x; bl.y = p.y; bl.z = p.z; const v = velAt(bl.flight, s.t); bl.vx = v.x; bl.vy = v.y; bl.vz = v.z; }
    else if (bl.free) { freeBall(dtE); bl.x = bl.free.x; bl.y = bl.free.y; bl.z = bl.free.z; bl.vx = bl.free.vx; bl.vy = bl.free.vy; bl.vz = bl.free.vz; }
    s.phaseT += 0;
    // slow motion towards human decisions
    let target = 1;
    const dm = cfg.decision || 'slow';
    for (const t of [0, 1]) {
      const pd = s.pending[t];
      if (s.teams[t].human && pd && s.t < pd.deadline - 0.02 && s.phase !== 'dead') { if (dm === 'slow') target = Math.min(target, 0.5); }
    }
    s.ts += (target - s.ts) * Math.min(1, dt * 7);
    stepCam(s.cam, s, dtE);
  }

  // human timing tap
  function tap(team) {
    const r = s.ring;
    if (!r || r.team !== team || r.tapped !== null) return false;
    if (s.t < r.open || s.t > r.tc - 0.04) return false;
    r.tapped = s.t; return true;
  }

  // Think: the best option and why (does not change anything)
  function suggest(team, kind) { return AI.decide(api, team, kind, s.pending[team] || {}, rA, { fixedIq: 1, noNoise: true, explain: true }); }

  const api = { s, P, W, netH: NETH, cfg, rng: rA, humanFlag: (t) => s.teams[t].human, ring: () => s.ring };

  if (cfg.resume) { const r = cfg.resume; Object.assign(s.match, { setNo: r.setNo, sets: [...r.sets], pts: [...r.pts], firstServer: r.firstServer, serving: r.serving, serveCount: r.serveCount, rallies: r.rallies }); startRally(true); } else startMatch();
  return { s, update, choose, tap, suggest, release, api, startRally, applyChoice: (t, p) => applyChoice(t, p) };
}
