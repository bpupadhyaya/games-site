// The volleyball simulation: deterministic, pure, no 3D. It owns every position, contact time, contact point and outcome.
// The presenter (web/view3d) only reads `getState()` (players[].act, ball, events) and animates; it never writes back.
// One human controls ONE player of team 0 (cfg.role); every other player, and the whole of team 1, is computer controlled.
import { G, BR, BR_PLAY, HIT0, BLOCK0, HW, HL, ATK, NET, MODES, setTarget, SHOTS, SHOT_IDS, SERVES, SETS, TECH, LEVELS, HUMAN_SKILL, REACH0, LUNGE, FREE, FRONT, isMB } from './consts.js';
import { START_ROT } from './model.js';
import { clamp, normal, r2, lerp } from './util.js';
import { posAt, velAt, speedAt, flightTo, landTime, netTime, timeAtHeight } from './ball.js';
import { dirOf, latSign, W, depthOf, latOf, sideOf, makeStats, courtLineup, rotateRot, slotPos, serverPos, techBand, techFor, intercept, solveClear, clearanceOf, landsIn, heightScale, idOf } from './model.js';
import { tmFromErr, aiSigma, LAG, WIN, OPEN, passQuality, setQuality, serveQuality, serveErrP, attackQuality } from './physics.js';
import * as AI from './ai.js';

const TUNE_DIG = { base: 0.78, skill: 0.5, speed: 0.55, stretch: 0.35, aq: 0.5 };
const READY = 1.7;          // s between a point and the start of the serve
const POINT_PAUSE = 2.6;    // s the point is shown before the next rally
const SET_PAUSE = 4.2;
const WIND = 0.35;          // s the server holds the ball before the toss
const OFFSIDE = 30;         // substitutes wait far off court

export function createSim(cfg0, rng) {
  const cfg = { mode: 'best3', women: false, role: null, levels: [3, 3], assist: 1, drill: null, watch: false, liberoServes: false, ...cfg0 };
  const women = !!cfg.women, K = heightScale(women);
  const NETH = women ? NET.f : NET.m;
  const rR = rng.fork();   // outcome rolls
  const rA = rng.fork();   // AI noise
  const rP = rng.fork();   // positions / cosmetics
  const mode = MODES[cfg.mode] ? cfg.mode : 'best3';
  const userType = cfg.role;           // player type id controlled by the human, or null

  const s = {
    t: 0, cfg: { mode, women, role: userType, levels: [...cfg.levels], assist: cfg.assist, drill: cfg.drill, watch: !!cfg.watch, liberoServes: !!cfg.liberoServes }, netH: NETH,
    phase: 'pre', phaseT: 0, hold: null,
    teams: [], players: [],
    ball: { x: 0, y: -5, z: 0, vx: 0, vy: 0, vz: 0, vis: false, flight: null, free: null, held: null, kind: null },
    match: { setNo: 1, sets: [0, 0], pts: [0, 0], firstServer: cfg.firstServer ?? 0, serving: cfg.firstServer ?? 0, rallies: 0, over: false, winner: null, history: [], setScores: [], stats: [0, 1].map(() => ({ aces: 0, kills: 0, blocks: 0, errors: 0, digs: 0 })), target: setTarget(mode, 1), mode },
    rally: null, queue: [], fid: 0, actSeq: 0, evSeq: 0, events: [],
    prompt: null, announce: null, last: null, userId: userType === null ? -1 : idOf(0, userType),
    input: { mx: 0, mz: 0, assist: cfg.assist }, pick: { serve: 'float', shot: 'auto', set: 'auto' }, rot: 0,
    toast: null, think: null,
  };
  const rotStart = [0, 1].map(() => START_ROT.slice());
  for (const t of [0, 1]) {
    const humanTeam = t === 0 && userType !== null;
    const L = LEVELS[(cfg.levels[t] || 3) - 1];
    const skill = humanTeam ? HUMAN_SKILL : L.skill;
    s.teams.push({ idx: t, level: cfg.levels[t] || 3, skill, iq: humanTeam ? 0.62 : L.iq, name: t === 0 ? 'Blue' : 'Red', rot: rotStart[t].slice(), rotN: 0, lineup: [], human: humanTeam });
    for (let tp = 0; tp < 7; tp++) {
      s.players.push({ id: idOf(t, tp), team: t, tp, st: makeStats(skill, tp, women), onCourt: false, slot: -1, front: false, x: t === 0 ? -OFFSIDE : OFFSIDE, z: 0, vx: 0, vz: 0, tx: 0, tz: 0, go: 0, hold: 0, lockFrom: 1e9, path: null, jy: 0, face: t === 0 ? 0 : Math.PI, act: null, user: idOf(t, tp) === s.userId, srvLat: -2.4 });
    }
  }
  const P = (id) => s.players[id];
  const emit = (type, d = {}) => { s.events.push({ id: s.evSeq++, type, t: s.t, ...d }); if (s.events.length > 80) s.events.splice(0, s.events.length - 80); };
  const schedule = (t, type, d = {}) => { const ev = { t, type, fid: s.fid, ...d }; let i = s.queue.length; while (i > 0 && s.queue[i - 1].t > t) i--; s.queue.splice(i, 0, ev); return ev; };
  const announce = (text, kind = 'info') => { s.announce = { text, kind, t: s.t, id: s.evSeq }; emit('announce', { text, kind }); };
  const userP = () => (s.userId >= 0 ? P(s.userId) : null);

  // ---------------------------------------------------------------- lineups and positions
  function refreshLineup(t) {
    const tm = s.teams[t];
    tm.lineup = courtLineup(tm.rot, t === 0 && userType !== null ? userType : -1, true, !!cfg.liberoServes);
    for (const p of s.players) {
      if (p.team !== t) continue;
      const sl = tm.lineup.indexOf(p.tp);
      const was = p.onCourt;
      p.onCourt = sl >= 0; p.slot = sl; p.front = sl >= 0 && FRONT[sl];
      if (!p.onCourt) { p.act = null; p.path = null; p.vx = p.vz = 0; p.jy = 0; p.x = (p.x > 0 ? 1 : -1) * OFFSIDE * 0 + (t === 0 ? -OFFSIDE : OFFSIDE); p.z = 0; p.tx = p.x; p.tz = p.z; }
      else if (!was) { const w = slotPos(t, sl); p.x = w.x > 0 ? HW + 2.2 : -HW - 2.2; p.z = w.z; p.tx = w.x; p.tz = w.z; p.vx = p.vz = 0; }
    }
  }
  const onCourt = (t) => s.players.filter((p) => p.team === t && p.onCourt);
  const lineupPid = (t, slot) => idOf(t, s.teams[t].lineup[slot]);

  // ---------------------------------------------------------------- movement
  const goto = (p, pos, delay = 0, force = false) => { if (p.user && s.phase === 'rally' && !force && !cfg.bot) return; p.tx = clamp(pos.x, -HW - 2.5, HW + 2.5); p.tz = clamp(pos.z, -HL - 3.5, HL + 3.5); p.go = s.t + delay; };
  const teleport = (p, pos) => { p.x = p.tx = pos.x; p.z = p.tz = pos.z; p.vx = p.vz = 0; p.path = null; };
  const setPath = (p, x1, z1, t0, t1) => { p.path = { x0: p.x, z0: p.z, x1, z1, t0, t1: Math.max(t1, t0 + 0.05) }; p.tx = x1; p.tz = z1; };
  const keepSide = (p) => { const m = 0.30; if (p.team === 0) { if (p.z > -m) p.z = -m; } else if (p.z < m) p.z = m; };
  function movePlayers(dt) {
    for (const p of s.players) {
      if (!p.onCourt) continue;
      const pa = p.path;
      if (pa && s.t >= pa.t0 - 1e-9) {
        const u = clamp((s.t - pa.t0) / (pa.t1 - pa.t0), 0, 1), kk = u * u * (3 - 2 * u), dk = (6 * u * (1 - u)) / (pa.t1 - pa.t0);
        p.vx = (pa.x1 - pa.x0) * dk; p.vz = (pa.z1 - pa.z0) * dk; p.x = pa.x0 + (pa.x1 - pa.x0) * kk; p.z = pa.z0 + (pa.z1 - pa.z0) * kk;
        if (u >= 1) { p.path = null; p.vx = p.vz = 0; }
      } else if (pa) { p.vx *= 0.9; p.vz *= 0.9; p.x += p.vx * dt; p.z += p.vz * dt; }
      else {
        const locked = s.t >= p.lockFrom && s.t < p.hold;
        let wvx = 0, wvz = 0;
        if (p.user && s.phase !== 'matchEnd' && !locked && !p.act?.air) {
          const m = s.input; const mag = Math.hypot(m.mx, m.mz);
          if (mag > 0.05) { const sc = Math.min(1, mag) * p.st.spd; wvx = m.mx / mag * sc; wvz = m.mz / mag * sc; p.tx = p.x; p.tz = p.z; }
          else if (s.t >= p.go) { const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz); if (d > 0.03) { const sp = Math.min(p.st.spd, Math.sqrt(2 * 9 * d) + 0.2); wvx = dx / d * sp; wvz = dz / d * sp; } }
        } else if (!locked && s.t >= p.go) {
          const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
          if (d > 0.03) { const sp = Math.min(p.st.spd, Math.sqrt(2 * 9 * d) + 0.2); wvx = dx / d * sp; wvz = dz / d * sp; }
        }
        const a = 14 * dt;
        const ex = wvx - p.vx, ez = wvz - p.vz, em = Math.hypot(ex, ez);
        if (em > a) { p.vx += ex / em * a; p.vz += ez / em * a; } else { p.vx = wvx; p.vz = wvz; }
        p.x += p.vx * dt; p.z += p.vz * dt;
      }
      if (p.user) { p.x = clamp(p.x, -HW - 2.8, HW + 2.8); p.z = clamp(p.z, -HL - 3.4, -0.30); }
      else if (!p.path) { p.x = clamp(p.x, -HW - 3.0, HW + 3.0); if (p.team === 0) p.z = clamp(p.z, -HL - 3.6, -0.30); else p.z = clamp(p.z, 0.30, HL + 3.6); }
      const ac = p.act;
      if (ac && ac.air && s.t >= ac.air.ts && s.t <= ac.air.te) { const half = ac.air.ta - ac.air.ts, u = (s.t - ac.air.ta) / half; p.jy = Math.max(0, ac.air.h * (1 - u * u)); } else p.jy = 0;
      if (ac && s.t > ac.t1) p.act = null;
    }
  }
  // Players do not stand inside each other: a soft push apart for anyone who is free to move (a player on a scripted contact path keeps its spot).
  function separate() {
    const on = s.players.filter((p) => p.onCourt);
    for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) {
      const a = on[i], b = on[j];
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d >= 0.5 || (a.jy > 0.3 && b.jy < 0.1) || (b.jy > 0.3 && a.jy < 0.1)) continue;
      const fa = !a.path && !a.user && !(a.act && s.t >= a.act.t0 && s.t <= a.act.tc + 0.3), fb = !b.path && !b.user && !(b.act && s.t >= b.act.t0 && s.t <= b.act.tc + 0.3);
      if (!fa && !fb) continue;
      const push = (0.5 - d) * 0.5 + 0.004, ux = d > 1e-4 ? dx / d : 1, uz = d > 1e-4 ? dz / d : 0;
      const wa = fa && fb ? 0.5 : fa ? 1 : 0, wb = fa && fb ? 0.5 : fb ? 1 : 0;
      a.x -= ux * push * 2 * wa; a.z -= uz * push * 2 * wa; b.x += ux * push * 2 * wb; b.z += uz * push * 2 * wb;
    }
  }
  function faceUpdate() {
    for (const p of s.players) {
      if (!p.onCourt) continue;
      const ac = p.act;
      let fx = null, fz = null;
      if (ac && s.t >= ac.t0 && s.t <= ac.t1 && ac.faceTo) { fx = ac.faceTo.x - p.x; fz = ac.faceTo.z - p.z; }
      else if (Math.hypot(p.vx, p.vz) > 1.7) { fx = p.vx; fz = p.vz; }
      else if (s.ball.vis && s.phase === 'rally' && depthOf(p.team, s.ball.z) > -1.5 && !p.user) { fx = s.ball.x - p.x; fz = s.ball.z - p.z; }
      else { fx = 0; fz = dirOf(p.team); }
      if (fx !== null && Math.hypot(fx, fz) > 1e-4) p.face = Math.atan2(fx, fz);
    }
  }

  // ---------------------------------------------------------------- acts
  function makeAct(p, kind, tech, tc, c, o = {}) {
    const T = TECH[tech] || TECH.bump;
    const act = {
      id: ++s.actSeq, kind, tech, t0: tc - (o.lead ?? T.lead), tc, t1: tc + (o.follow ?? T.follow), c: { x: r2(c.x), y: r2(c.y), z: r2(c.z) },
      to: o.to ?? null, faceTo: o.faceTo ?? o.to ?? null, air: o.air ?? null, shot: o.shot ?? null, q: o.q ?? 0.6, miss: !!o.miss, stretch: o.stretch ?? 0, side: o.side ?? 'R', pending: true, toss: o.toss ?? null, tr: o.tr ?? null,
    };
    if (act.air) act.t0 = Math.min(act.t0, act.air.ts - (o.approach ?? 0.62));
    p.act = act; return act;
  }
  const jumpAir = (tc, h, tupFix) => { const tup = tupFix ?? Math.sqrt(2 * Math.max(0.05, h) / G); return { ts: tc + 0.02 - tup, ta: tc + 0.02, te: tc + 0.02 + tup, h }; };

  // ---------------------------------------------------------------- ball
  function launch(fl, meta) {
    s.fid++;
    s.queue = s.queue.filter((e) => e.always);
    s.ball.flight = fl; s.ball.free = null; s.ball.vis = true; s.ball.held = null; s.ball.kind = meta.kind;
    s.ball.meta = meta;
    s.prompt = null;
    afterLaunch(fl, meta);
  }
  function startBounce(b, v) {
    s.ball.free = { x: b.x, y: Math.max(BR, b.y), z: b.z, vx: v.x * 0.5, vy: Math.abs(v.y) * 0.4, vz: v.z * 0.5, n: 0 };
    s.ball.flight = null;
  }
  function freeBall(dt) {
    const f = s.ball.free; if (!f) return;
    f.vy -= G * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
    if (f.y <= BR) { f.y = BR; if (Math.abs(f.vy) > 0.9 && f.n < 4) { f.vy = -f.vy * 0.5; f.n++; f.vx *= 0.8; f.vz *= 0.8; } else { f.vy = 0; const kk = Math.max(0, 1 - 2.4 * dt); f.vx *= kk; f.vz *= kk; } }
    f.x = clamp(f.x, -HW - 4, HW + 4); f.z = clamp(f.z, -HL - 4, HL + 4);
  }
  const ballAt = (fl, t) => posAt(fl, t);

  // ---------------------------------------------------------------- match flow
  function startMatch() {
    const m = s.match;
    m.firstServer = cfg.firstServer ?? (rR.next() < 0.5 ? 0 : 1); m.serving = m.firstServer;
    for (const t of [0, 1]) { s.teams[t].rot = START_ROT.slice(); refreshLineup(t); }
    startRally(true);
  }
  function startRally(instant = false) {
    const m = s.match;
    s.plans = {};
    s.rally = { no: ++m.rallies, server: m.serving, touches: [0, 0], last: null, lastBlock: false, kind: 'serve', isServe: true, dead: false, plan: null, atk: null, blk: null, setInfo: null, contacts: 0 };
    s.ball.vis = false; s.ball.flight = null; s.ball.free = null; s.fid++; s.queue = []; s.prompt = null;
    for (const t of [0, 1]) { refreshLineup(t); }
    s.hold = null; s.think = null;
    formServe(instant);
    s.phase = 'ready'; s.phaseT = s.t;
    const srv = P(lineupPid(m.serving, 0));
    s.ball.held = srv.id;
    if (s.userId === srv.id && !cfg.drill) {
      s.prompt = { kind: 'serveWait', pid: srv.id, label: 'SERVE', t: s.t };
      schedule(s.t + (instant ? 1.0 : READY) + 9, 'toss', { always: false });
    } else schedule(s.t + (instant ? 1.0 : READY), 'toss');
    announce(`${s.teams[m.serving].name} to serve`, 'serve');
    if (cfg.drill) drillStart();
  }
  function formServe(instant) {
    const m = s.match;
    for (const t of [0, 1]) {
      const intent = t === m.serving ? 'serveTeam' : 'receive';
      const srv = P(lineupPid(m.serving, 0));
      if (t === m.serving) { if (!srv.user) srv.srvLat = rP.range(-3.8, 3.8); srv.srvLat = clamp(srv.srvLat, -HW + 0.4, HW - 0.4); }
      const spots = AI.homeSpots(s, t, intent);
      for (const p of onCourt(t)) {
        const w = spots[p.id]; if (!w) continue;
        if (instant || Math.hypot(p.x - w.x, p.z - w.z) > 9) teleport(p, w); else goto(p, w, 0.05 * p.slot);
        p.hold = 0; p.lockFrom = 1e9; p.path = null; p.act = null; p.jy = 0;
      }
    }
  }
  function endRally(winner, reason, info = {}) {
    const R = s.rally; if (R.dead) return; R.dead = true;
    s.queue = s.queue.filter((e) => e.always); s.prompt = null;
    const m = s.match; m.pts[winner]++;
    m.history.push({ w: winner, r: reason, server: R.server });
    const st = m.stats;
    if (reason === 'ace') st[winner].aces++;
    if (reason === 'kill') st[winner].kills++;
    if (reason === 'block') st[winner].blocks++;
    if (info.loser !== undefined && /error|net|out|touch|double|lift|fault/.test(reason)) st[info.loser].errors++;
    s.last = { winner, reason, text: info.text || reason, t: s.t };
    emit('point', { winner, reason, text: info.text || reason, pts: [...m.pts], bk: s.ball.meta ? s.ball.meta.kind : null, contacts: R.contacts });
    s.phase = 'dead'; s.phaseT = s.t;
    const [a, b] = m.pts, hi = Math.max(a, b), lo = Math.min(a, b);
    const target = m.target;
    const setWon = hi >= target && hi - lo >= 2 ? (a > b ? 0 : 1) : null;
    // serving: the team that won the rally serves next; a side-out rotates the winners one position
    const wasServing = m.serving;
    if (winner !== wasServing && !cfg.drill) { m.serving = winner; s.teams[winner].rot = rotateRot(s.teams[winner].rot); s.teams[winner].rotN = (s.teams[winner].rotN + 1) % 6; emit('rotate', { team: winner }); }
    if (cfg.drill) { m.pts = [0, 0]; m.serving = cfg.drill.server ?? 0; }
    if (setWon !== null && !cfg.drill) {
      m.sets[setWon]++; m.setScores.push([a, b]); emit('setEnd', { winner: setWon, pts: [a, b], sets: [...m.sets] });
      const mo = MODES[mode];
      if (m.sets[setWon] >= mo.setsToWin) { m.over = true; m.winner = setWon; schedule(s.t + POINT_PAUSE + 0.8, 'matchEnd', { always: true }); }
      else schedule(s.t + SET_PAUSE, 'nextSet', { always: true });
    } else schedule(s.t + POINT_PAUSE, 'nextRally', { always: true });
  }

  // ---------------------------------------------------------------- serve
  function doToss() {
    const R = s.rally, m = s.match;
    if (R.dead) return;
    const srv = P(lineupPid(m.serving, 0));
    const human = srv.user && !cfg.bot;
    let type, aimC = null;
    if (human) type = s.pick.serve === 'jump' && srv.st.srv > 0 ? 'jump' : 'float';
    else { const d = AI.chooseServe(s, srv, rA); type = d.choice.type; aimC = d.choice.aim; R.serveDecision = d; if (cfg.watch) s.hold = { id: ++s.actSeq, team: m.serving, kind: 'serve', decision: d, pid: srv.id, at: { x: aimC.x, z: aimC.z } }; }
    const T = SERVES[type], tech = TECH[T.tech];
    const dir = dirOf(m.serving);
    s.phase = 'serve'; s.phaseT = s.t;
    s.prompt = null;
    const tr = s.t + WIND, tossT = type === 'jump' ? 1.15 : 0.95, tc = tr + tossT;
    // stand spot at the baseline; the server takes the toss point in front of the body (right-handed: ball to the right)
    const baseDepth = type === 'jump' ? HL + 0.15 : HL + 0.45;
    const stand = { x: clamp(srv.x, -HW + 0.4, HW - 0.4), z: -dir * baseDepth };
    const sx = stand.x - latSign(m.serving) * 0.20, sz = stand.z + dir * 0.28;
    const hJ = type === 'jump' ? clamp(srv.st.jump * 0.85, 0.25, 0.75) : 0;
    const y = type === 'jump' ? (HIT0 - 0.04) * K + hJ : tech.pref * K;
    const C = { x: sx, y, z: sz + (type === 'jump' ? dir * 0.40 : 0) };
    const hand = { x: stand.x - latSign(m.serving) * 0.0 + latSign(m.serving) * 0.14, y: 1.45 * K, z: stand.z + dir * 0.34 };
    R.serve = { type, C, tc, tr, stand, human };
    s.ball.vis = false;
    // The toss flight is launched at tr (the hand releases the ball at that instant)
    setPath(srv, stand.x, stand.z, s.t, tr - 0.05);
    srv.lockFrom = tr - 0.05; srv.hold = tc + 0.9;
    const air = type === 'jump' ? jumpAir(tc, hJ, 0.34) : null;
    const act = makeAct(srv, 'serve', T.tech, tc, C, { lead: tc - (s.t), follow: T.follow ?? 0.7, faceTo: { x: 0, z: dir * 4 }, air, toss: hand, tr, approach: 0.2 });
    act.t0 = s.t; act.stype = type; act.stand = stand;
    srv.tossHand = hand;
    schedule(tr, 'tossRelease', { hand, C, tr, tc, srvId: srv.id, stype: type, aimC });
    if (human) s.prompt = { kind: 'serve', pid: srv.id, label: 'SERVE', open: tr, close: tc - LAG.serve, tc, c: C, stand, type, pressed: null, press: null, win: WIN.serve };
    emit('serveStart', { team: m.serving, pid: srv.id, stype: type });
    // Receivers set their stance
    void T;
  }
  function tossRelease(ev) {
    const R = s.rally; if (R.dead) return;
    const srv = P(ev.srvId);
    s.ball.vis = true; s.ball.held = null;
    const fl = flightTo(ev.tr, ev.hand, ev.C, ev.tc - ev.tr);
    s.fid++;
    s.queue = s.queue.filter((e) => e.always);
    s.ball.flight = fl; s.ball.meta = { kind: 'toss', team: srv.team };
    if (srv.act) { const vv = velAt(fl, ev.tc), vl = Math.hypot(vv.x, vv.y, vv.z) || 1; srv.act.vin = { x: r2(vv.x / vl), y: r2(vv.y / vl), z: r2(vv.z / vl) }; srv.act.vspd = r2(vl); }
    schedule(ev.tc, 'serveTouch', { srvId: srv.id, C: ev.C, stype: ev.stype, aimC: ev.aimC });
    emit('toss', { team: srv.team });
    s.rally.serveAim = ev.aimC;
  }
  // timing score of the toucher: the human's press, or a sample for the computer
  function timingOf(p, plan, kind) {
    const win = WIN[kind] ?? 0.16, lag = LAG[kind] ?? 0.2;
    if (p.user && !cfg.bot) {
      const pr = plan && plan.press;
      if (pr) { const e = pr.t - (plan.tc - lag); return { tm: tmFromErr(e, win), e, auto: false }; }
      return { tm: kind === 'attack' ? 0.30 : kind === 'serve' ? 0.28 : 0.5, e: 0.3, auto: true };
    }
    const sg = cfg.bot && p.user ? cfg.bot.sigma : aiSigma(s.teams[p.team].skill);
    const e = normal(rA) * sg;
    return { tm: tmFromErr(e, win), e, auto: false };
  }
  function doServeTouch(ev) {
    const R = s.rally; if (R.dead) return;
    const srv = P(ev.srvId), tc = ev.t, type = ev.stype, T = SERVES[type];
    const plan = { tc, press: s.prompt && s.prompt.kind === 'serve' ? s.prompt.press : null };
    const tmv = timingOf(srv, plan, 'serve');
    const q = serveQuality(srv.st, tmv.tm, normal(rA));
    const C = ev.C, team = srv.team, opp = 1 - team;
    R.touches[team] = 1; R.last = { team, pid: srv.id }; R.kind = 'serve'; R.isServe = true;
    let aim = ev.aimC;
    if (srv.user && !cfg.bot) {
      const a = plan.press && plan.press.aim;
      const lat = a ? a.lat : 0, fw = a ? a.fwd : 0.25;
      aim = { x: clamp(lat * 3.9 * latSign(team), -HW + 0.4, HW - 0.4), z: -dirOf(opp) * clamp(5.6 + 2.8 * fw, 2.2, HL - 0.6) };
    }
    if (!aim) aim = { x: 0, z: -dirOf(opp) * 6 };
    // error?
    const errP = serveErrP(srv.st, type, tmv.tm);
    let tgt = { x: aim.x + normal(rR) * (0.35 + 1.7 * Math.pow(1 - q, 2)) / T.acc * 0.9, y: BR, z: aim.z + normal(rR) * (0.35 + 1.7 * Math.pow(1 - q, 2)) / T.acc * 0.9 };
    let margin = T.margin * (0.4 + 0.6 * q) + 0.05;
    let isErr = false, errKind = null;
    if (rR.next() < errP) {
      isErr = true;
      if (rR.next() < 0.5) { errKind = 'net'; margin = -0.45 - rR.next() * 0.2; } else { errKind = 'out'; tgt = { x: tgt.x + (rR.next() < 0.5 ? 1 : -1) * (HW - Math.abs(tgt.x) + 0.5 + rR.next() * 1.2), y: BR, z: tgt.z + -dirOf(opp) * (rR.next() < 0.5 ? 1.8 + rR.next() * 1.5 : 0) }; if (Math.abs(tgt.x) < HW + 0.3) tgt.z = -dirOf(opp) * (HL + 0.5 + rR.next() * 1.2); }
    }
    const dist = Math.hypot(tgt.x - C.x, tgt.z - C.z, C.y - BR);
    const speed = T.speed * (0.9 + 0.2 * q);
    const T0 = Math.max(0.5, dist / speed);
    let sol;
    if (errKind === 'net') { let T1 = T0; while (clearanceOf(C, tgt, T1, NETH) > -0.12 && T1 > 0.35) T1 *= 0.96; sol = { T: T1 };
    } else sol = solveClear(C, tgt, T0, NETH, Math.max(margin, 0.05), 2.4);
    const fl = flightTo(tc, C, tgt, sol.T);
    const act = srv.act; if (act) { act.q = q; act.pending = false; act.to = { x: tgt.x, z: tgt.z }; act.tm = r2(tmv.tm); act.tmE = r2(tmv.e); }
    emit('touch', { team, pid: srv.id, kind: 'serve', q, tm: tmv.tm, tmE: tmv.e, stype: type, auto: tmv.auto, c: { x: r2(C.x), y: r2(C.y), z: r2(C.z) }, aim: { x: r2(aim.x), z: r2(aim.z) } });
    if (cfg.drill) drillHook('serve', {});
    launch(fl, { kind: 'serve', team, q, power: speedAt(fl, tc), stype: type, errKind });
    void isErr;
  }

  // ---------------------------------------------------------------- launching and routing a flight
  // After a flight starts: legal crossing? Block? Who plays it next? Everything is scheduled here.
  function afterLaunch(fl, meta) {
    const R = s.rally, A = meta.team;
    const tl = landTime(fl) ?? s.t + 3;
    const nearNet = Math.abs(fl.z) < 0.02;
    const tn = nearNet ? null : netTime(fl, tl);
    const side0 = nearNet ? (fl.vz > 0 ? 1 : 0) : (fl.z < 0 ? 0 : 1);
    R.kind = meta.kind;
    const ownSide = meta.kind === 'pass' || meta.kind === 'set';      // meant to be played by the sender's team: it never "crosses"
    if (tn !== null && !ownSide) {
      const pn = posAt(fl, tn);
      if (Math.abs(pn.x) > HW + 0.12 && meta.kind !== 'toss') { schedule(tn, 'wide', { x: pn.x }); return; }
      if (pn.y < NETH + BR_PLAY * 0.3) { schedule(tn, 'netHit', { y: pn.y }); return; }
      if (pn.y < NETH + BR_PLAY + 0.0) { schedule(tn, 'cord', { y: pn.y }); return; }
      // clean crossing: the other team plays it (a block, if one is up, is resolved at the attack contact itself)
      R.touches[1 - side0] = 0;
      const other = 1 - side0;
      // blockers resolved at contact time (attack) -> if there is a block hit event it is already scheduled
      if (meta.blockHit) { schedule(meta.blockHit.t, 'blockTouch', { ...meta.blockHit }); return; }
      schedule(tn, 'cross', { x: pn.x, y: pn.y });
      planTouch(other, fl, { kind: 'receive', meta });
      afterCrossing(A, other, meta);
      return;
    }
    // stays on its own side
    if (ownSide || meta.kind === 'wild' || meta.kind === 'netDrop' || meta.kind === 'blockSoft' || meta.kind === 'blockKill' || meta.kind === 'cord') {
      const side = side0;
      const want = meta.kind === 'pass' ? { kind: 'set', meta } : meta.kind === 'set' ? { kind: 'attack', meta, pid: meta.attackerId } : { kind: 'receive', meta };
      s.rally.blk = null;
      const pl = planTouch(side, fl, want);
      if (meta.kind === 'set' && pl && pl.kind === 'attack') planBlock(1 - side, side, fl, pl.tc, pl.C.x);
      return;
    }
    // an attack or free ball that never crosses lands on its own side
    schedule(tl, 'land', { x: posAt(fl, tl).x, z: posAt(fl, tl).z });
  }
  function afterCrossing(A, other, meta) {
    // the sending team drops back into defence / cover
    const lat = meta.aimLat ?? 0;
    if (meta.kind === 'serve') {
      goto(P(lineupPid(A, 0)), W(A, -2.0, 7.0), 0.1);
      const sp = AI.homeSpots(s, A, 'defense', { lat: 0 });
      for (const p of onCourt(A)) { if (sp[p.id] && p.id !== lineupPid(A, 0)) goto(p, sp[p.id], 0.15 + p.st.react * 0.5); }
      const rc = AI.homeSpots(s, other, 'receive');
      for (const p of onCourt(other)) { if (rc[p.id] && !p.path) goto(p, rc[p.id], 0.0); }
    } else if (meta.kind === 'attack') {
      // handled by planBlock / defensive positions
    } else {
      const sp = AI.homeSpots(s, A, 'defense', { lat });
      for (const p of onCourt(A)) if (sp[p.id] && !p.path && !(p.act && s.t < p.act.t1)) goto(p, sp[p.id], 0.2 + p.st.react);
    }
  }

  // ---------------------------------------------------------------- planning a touch
  const ROLE_RCV = { 6: 0, 1: 0.10, 4: 0.10, 3: 0.35, 2: 0.55, 5: 0.55, 0: 0.95 };
  function planTouch(team, fl, want) {
    const R = s.rally;
    const tl = landTime(fl) ?? s.t + 3;
    const lp = posAt(fl, tl);
    const kind = want.kind;
    const lastSame = R.last && R.last.team === team && !R.lastBlock ? R.last.pid : -1;
    const nTouch = (R.touches[team] ?? 0) + 1;
    const outBall = Math.abs(lp.x) > HW + 0.3 || Math.abs(lp.z) > HL + 0.3;
    const wrongSide = sideOf(lp.z) !== team && kind !== 'receive';
    if (outBall && kind === 'receive' && !s.cfg.drill) { schedule(tl, 'land', { x: lp.x, z: lp.z }); return null; }
    let cands = onCourt(team).filter((p) => p.id !== lastSame);
    if (s.cfg.drill && s.cfg.drill.kind === 'serve' && team === 1) cands = [];
    if (kind === 'attack' && want.pid !== undefined) cands = cands.filter((p) => p.id === want.pid);
    const bands = kind === 'receive' ? ['bump', 'dig', 'over'] : kind === 'set' ? ['over', 'bump'] : kind === 'attack' ? ['spike'] : ['over', 'bump', 'dig'];
    let best = null;
    for (const p of cands) {
      for (const tech of bands) {
        const T = techBand(tech, women);
        let y0 = T.y0, y1 = T.y1, pref = T.pref;
        if (tech === 'spike') { y0 = Math.max((HIT0 + 0.05) * K, HIT0 * K + 0.58); y1 = HIT0 * K + p.st.jump - (women ? 0.12 : 0.05); pref = y1 - 0.06; if (y1 < y0 + 0.05) continue; }
        const ic = intercept(fl, p, s.t, { minY: y0, maxY: y1, preferY: pref, fwd: T.reach ?? T.fwd, human: p.user && !cfg.bot, tMin: s.t + (tech === 'spike' ? 0.5 : 0.28), spd: kind === 'receive' ? speedAt(fl, s.t + 0.2) : 0, dive: tech === 'dig' });
        if (!ic) continue;
        // an overhand touch of a fast ball is a risk: only the slow ones
        if (tech === 'over') { const v = speedAt(fl, ic.t); if (v > 12.5 && kind === 'receive') continue; if (p.tp === 6 && depthOf(team, ic.z) < ATK && kind !== 'receive') continue; }
        let cost = ic.cost + (tech === 'over' ? (kind === 'receive' ? 0.25 : kind === 'set' ? -0.15 : 0) : tech === 'dig' ? 0.35 : 0);
        if (kind === 'receive') cost += ROLE_RCV[p.tp] ?? 0.5;
        else if (kind === 'set') cost += p.tp === 0 ? 0 : p.tp === 6 ? 1.1 : 1.6;
        else if (kind === 'free') cost += p.tp === 0 || p.tp === 6 ? 0 : 0.4;
        if (p.user && !cfg.bot) cost -= 0.3;
        if (!best || cost < best.cost) best = { ...ic, cost, p, tech: ic.dive ? 'dive' : tech };
      }
    }
    if (!best) {
      if (kind === 'attack') { return planTouch(team, fl, { kind: 'free', meta: want.meta }); }
      schedule(tl, 'land', { x: lp.x, z: lp.z });
      // the nearest defender still chases the ball
      let near = null;
      for (const p of cands) { const d = Math.hypot(lp.x - p.x, lp.z - p.z); if (!near || d < near.d) near = { p, d }; }
      if (near && near.d < 8 && sideOf(lp.z) === team && !near.p.user) goto(near.p, { x: lp.x, z: lp.z }, near.p.st.react);
      void wrongSide;
      return null;
    }
    // Computer defenders do not dig every ball they could reach: how hard it was hit, how far they stretch and their skill decide.
    if (kind === 'receive' && want.meta && want.meta.kind === 'attack' && !(best.p.user && !cfg.bot)) {
      const v = speedAt(fl, best.t), vn = clamp((v - 9) / 17, 0, 1), aq = want.meta.q ?? 0.5;
      const digP = clamp(TUNE_DIG.base + TUNE_DIG.skill * (best.p.st.pass - 0.6) - TUNE_DIG.speed * vn - TUNE_DIG.stretch * (best.stretch ?? 0) - TUNE_DIG.aq * (aq - 0.5), 0.05, 0.95);
      if (rR.next() > digP) { schedule(tl, 'land', { x: lp.x, z: lp.z }); return null; }
    }
    const cp = commitPlan(team, fl, want, best);
    if (!cp && kind === 'attack') return planTouch(team, fl, { kind: 'free', meta: want.meta });
    return cp;
  }

  function defaultTarget(team, kind, p, C) {
    if (kind === 'receive') return W(team, -1.2, 1.5);
    if (kind === 'set') return W(team, SETS.outside.lat, SETS.outside.depth);
    if (kind === 'attack') return W(1 - team, 0, 5);
    return W(1 - team, 0, 5);
  }
  function commitPlan(team, fl, want, best) {
    const R = s.rally, p = best.p, kind = want.kind, tech = best.tech;
    const T = TECH[tech];
    const C = { x: best.x, y: best.y, z: best.z };
    const to = defaultTarget(team, kind, p, C);
    const ux = to.x - C.x, uz = to.z - C.z, ul = Math.hypot(ux, uz) || 1;
    const u = { x: ux / ul, z: uz / ul };
    const fwd = T.fwd;
    let stand;
    if (tech === 'spike') stand = { x: C.x - u.x * fwd - (-u.z) * 0.20, z: C.z - u.z * fwd - u.x * 0.20 };      // right-handed: the ball is on the right of the body
    else stand = { x: C.x - u.x * fwd, z: C.z - u.z * fwd };
    if (depthOf(team, stand.z) < 0.5) stand.z = W(team, 0, 0.5).z;
    const human = p.user && !cfg.bot;
    const lead = kind === 'attack' ? T.lead : T.lead;
    const plan = { id: ++s.actSeq, team, pid: p.id, kind, tech, tc: best.t, C, stand, to, human, stretch: best.stretch ?? 0, n: (R.touches[team] ?? 0) + 1, meta: want.meta, fid: s.fid, press: null, y: C.y };
    R.plan = plan;
    let air = null;
    if (tech === 'spike') {
      const h = clamp(C.y - HIT0 * K, 0.1, p.st.jump + 0.08);
      air = jumpAir(best.t, h);
      plan.air = air; plan.h = h;
    }
    const tStart = s.t + (human ? 0 : p.st.react), tArr = air ? air.ts - 0.04 : best.t - 0.10;
    if (!human) {
      const dx = stand.x - p.x, dz = stand.z - p.z, dd = Math.hypot(dx, dz), vmax = p.st.spd * (air ? 1.25 : 1.05), reach = vmax * Math.max(0.05, tArr - tStart);
      const fin = dd > reach ? { x: p.x + dx / dd * reach, z: p.z + dz / dd * reach } : stand;
      p.act = null; setPath(p, fin.x, fin.z, tStart, tArr);
      plan.fin = fin;
      if (tech === 'spike' && dd > reach + 0.05) { p.path = null; return null; }
    } else {
      p.act = null;
      plan.assistFrom = s.t;
    }
    p.lockFrom = tArr; p.hold = best.t + (air ? air.te - best.t + 0.2 : 0.4);
    const faceTo = tech === 'dive' ? { x: C.x, z: C.z } : { x: to.x, z: to.z };
    if (tech === 'dive') plan.over = best.over;
    const act = makeAct(p, kind === 'attack' ? 'attack' : kind === 'receive' ? 'receive' : kind === 'set' ? 'set' : 'free', tech, best.t, C, { lead, follow: T.follow, to, faceTo, air, stretch: plan.stretch, approach: 0.62 }); act.over = best.over;
    plan.act = act;
    { const vv = velAt(fl, best.t), vl = Math.hypot(vv.x, vv.y, vv.z) || 1; act.vin = { x: r2(vv.x / vl), y: r2(vv.y / vl), z: r2(vv.z / vl) }; act.vspd = r2(vl); }
    schedule(best.t, 'touch', { planId: plan.id });
    if (human) {
      const k = kind === 'attack' ? 'attack' : kind === 'set' ? 'set' : kind === 'free' ? 'free' : 'receive';
      s.prompt = { kind: k, pid: p.id, label: kind === 'attack' ? 'SPIKE' : kind === 'set' ? (tech === 'over' ? 'SET' : 'SET') : tech === 'dig' ? 'DIG' : 'PASS', open: Math.max(s.t, best.t - LAG[k] - OPEN), close: best.t - LAG[k], tc: best.t, c: C, stand, plan, pressed: null, press: null, win: WIN[k], tech };
    }
    // advance preparation of the rest of the team
    if (kind === 'receive') prepareAfterReceive(team, plan);
    if (kind === 'set') prepareSet(team, plan);
    s.plans = s.plans || {};
    s.plans[plan.id] = plan;
    return plan;
  }
  const planById = (id) => (s.plans ? s.plans[id] : null);

  // After the first touch is planned the setter and hitters start moving; after a set is planned the AI chooses the target and blockers/hitters react.
  function prepareAfterReceive(team, plan) {
    const sp = AI.homeSpots(s, team, 'offense');
    for (const p of onCourt(team)) {
      if (p.id === plan.pid || !sp[p.id] || p.path) continue;
      if (p.tp === 0) continue;       // the setter is planned by the second-touch plan after the pass
      goto(p, sp[p.id], 0.12 + p.st.react * 0.6);
    }
    const setter = onCourt(team).find((p) => p.tp === 0);
    if (setter && setter.id !== plan.pid) goto(setter, W(team, -1.4, 1.5), 0.05 + setter.st.react * 0.5);
    // the other team's front row gets ready to block, back row to dig
    const other = 1 - team;
    const sd = AI.homeSpots(s, other, 'defense', { lat: 0 });
    for (const p of onCourt(other)) if (sd[p.id] && !p.path && !(p.act && s.t < p.act.t1)) goto(p, sd[p.id], 0.25 + p.st.react);
  }
  function prepareSet(team, plan) {
    // the set decision happens just before the setter starts the touch
    const tDec = Math.max(s.t + 0.02, plan.tc - plan.act.t0 + plan.tc * 0 - 0.0);
    const when = Math.max(s.t + 0.02, plan.tc - (TECH[plan.tech].lead) - 0.08);
    schedule(when, 'decideSet', { planId: plan.id });
    void tDec;
  }

  // ---------------------------------------------------------------- set decision (AI) / human
  function decideSet(ev) {
    const R = s.rally, pl = planById(ev.planId); if (!pl || R.dead) return;
    const team = pl.team, setter = P(pl.pid);
    const inQ = (pl.meta && pl.meta.q) ?? 0.6;
    let dec;
    if (setter.user && !cfg.bot) dec = null;
    else {
      dec = AI.chooseSet(s, team, setter, inQ, rA, { tcSet: pl.tc });
      const dr = s.cfg.drill;
      if (dr && team === 0 && dr.kind === 'spike' && userP()) { const u = userP(); if (u.front) dec = { ...dec, choice: { target: u.x > 1.7 ? 'outside' : u.x < -1.7 ? 'right' : 'middle', attackerId: u.id } }; }
      if (dr && team === 0 && dr.kind === 'block') dec = { ...dec, choice: { target: 'over', attackerId: setter.id } };
      pl.decision = dec;
      if (cfg.watch) { const S0 = dec.choice.target !== 'dump' && dec.choice.target !== 'over' ? SETS[dec.choice.target] : null; s.hold = { team, kind: 'set', decision: dec, t: s.t, id: ++s.actSeq, pid: setter.id, at: S0 ? W(team, S0.lat, S0.depth) : null }; }
      applySetChoice(pl, dec.choice);
    }
    // the hitters read the plan and start moving early (the quick hitter needs the head start)
    s.think = null;
  }
  function applySetChoice(pl, choice) {
    pl.choice = choice;
    const team = pl.team;
    if (choice.target === 'dump' || choice.target === 'over') return;
    const att = P(choice.attackerId);
    const S = SETS[choice.target];
    if (!att) return;
    const spot = W(team, S.lat, S.depth);
    pl.target = choice.target; pl.attacker = att.id;
    // send the hitter to the take-off spot early: the spike take-off is behind the ball by the reach
    const tcA = pl.tc + S.T - 0.04;
    const hJ = clamp(att.st.jump, 0.2, 0.75);
    const tup = Math.sqrt(2 * hJ / G);
    const tsA = tcA - tup;
    const off = { x: spot.x, z: spot.z - dirOf(team) * (choice.target === 'pipe' ? 0.0 : 0.25) };
    if (att.user && !cfg.bot) { if (s.input.assist >= 2 && Math.hypot(s.input.mx, s.input.mz) < 0.12) { att.tx = off.x; att.tz = off.z; att.go = s.t; } return; }
    if (att.path || (att.act && s.t < att.act.t1 && att.act.kind !== 'attack')) return;
    att.act = null;
    const tArr = Math.max(s.t + 0.15, tsA - 0.06);
    const dx = off.x - att.x, dz = off.z - att.z, dd = Math.hypot(dx, dz), reach = att.st.spd * 1.25 * Math.max(0.05, tArr - s.t);
    const fin = dd > reach ? { x: att.x + dx / dd * reach, z: att.z + dz / dd * reach } : off;
    setPath(att, fin.x, fin.z, s.t, tArr);
    att.lockFrom = tArr; att.hold = tcA + 1.0;
    pl.hitterPre = true;
  }

  // ---------------------------------------------------------------- executing touches
  function aimOf(pl) { const pr = pl.press; return pr ? pr.aim : null; }
  function reachStretch(p, pl, b) {
    const dC = Math.hypot(p.x - b.x, p.z - b.z);
    const T = TECH[pl.tech];
    const extra = Math.max(0, dC - (T.reach ?? T.fwd) - (pl.tech === 'spike' ? 0.32 : 0.14));
    return extra / LUNGE;   // 1 = a full lunge; a dive goes beyond (up to 3)
  }
  function doTouch(ev) {
    const R = s.rally; if (R.dead) return;
    const pl = planById(ev.planId); if (!pl || pl.fid !== ev.fid) return;
    if (ev.fid !== s.fid) return;
    const p = P(pl.pid), team = pl.team;
    const fl = s.ball.flight; if (!fl) return;
    const tc = ev.t, b = posAt(fl, tc), vin = speedAt(fl, tc);
    const act = pl.act;
    const stretch = reachStretch(p, pl, b);
    R.last = { team, pid: p.id }; R.lastBlock = false; R.isServe = false;
    const n = (R.touches[team] = (R.touches[team] ?? 0) + 1);
    R.contacts++;
    // the human did not get to the ball
    if (stretch > (pl.tech === 'dive' ? 3.0 : 1.0) && p.user) {
      if (act) {
        act.miss = true; act.pending = false; act.stretch = 1;
        // the hands / arms reach for where the ball was, but the ball passes beside them: the reaching point sits 0.45 m towards the player
        const dx = p.x - b.x, dz = p.z - b.z, dl = Math.hypot(dx, dz) || 1;
        act.c = { x: r2(b.x + dx / dl * 0.45), y: r2(b.y), z: r2(b.z + dz / dl * 0.45) };
      }
      emit('miss', { team, pid: p.id, kind: pl.kind });
      R.touches[team]--; R.last = null;
      s.prompt = null;
      const tl = landTime(fl) ?? tc + 0.5; const lp = posAt(fl, tl);
      // the ball carries on to the floor
      schedule(tl, 'land', { x: lp.x, z: lp.z });
      return;
    }
    if (pl.kind === 'attack' && pl.tech === 'spike') return doAttack(pl, p, b, vin, stretch, tc);
    s.prompt = null;
    if (pl.kind === 'receive') return doReceive(pl, p, b, vin, stretch, tc, n);
    if (pl.kind === 'set') return doSet(pl, p, b, vin, stretch, tc, n);
    return doFree(pl, p, b, vin, stretch, tc, n);
  }
  const scatter = (sg) => ({ x: normal(rR) * sg, z: normal(rR) * sg });
  function setActResult(pl, act, q, tmv, to) {
    if (!act) return;
    act.q = q; act.pending = false; act.to = to ? { x: r2(to.x), z: r2(to.z) } : act.to; if (tmv) { act.tm = r2(tmv.tm); act.tmE = r2(tmv.e); }
    if (to) act.faceTo = { x: to.x, z: to.z };
  }
  function wild(team, p, b, why) {
    const T = rR.range(0.9, 1.5);
    const dir = dirOf(team);
    const to = { x: clamp(b.x + rR.range(-4.5, 4.5), -HW - 3, HW + 3), y: BR, z: clamp(b.z + dir * rR.range(-3, 7), -HL - 3, HL + 3) };
    const fl = flightTo(s.t, b, to, T);
    emit('shank', { team, pid: p.id, why });
    launch(fl, { kind: 'wild', team, q: 0.05 });
  }
  function doReceive(pl, p, b, vin, stretch, tc, n) {
    const R = s.rally, team = pl.team, act = pl.act, opp = 1 - team;
    const tmv = timingOf(p, pl, 'receive');
    let q = passQuality(p.st, tmv.tm, Math.min(stretch, 1.4), vin, normal(rA));
    if (cfg.drill && team === 0 && !p.user && cfg.drill.kind !== 'receive') q = Math.max(q, 0.85);     // practice: the team's own passes are good so you can practise your skill
    if (R.contacts <= 2 && s.ball.meta && s.ball.meta.kind === 'attack') s.match.stats[team].digs++;
    if (pl.tech === 'over' && q < 0.3 && rR.next() < 0.55 * (0.3 - q) / 0.3 && !(cfg.drill)) { emit('fault', { team, reason: 'lift' }); if (act) act.fail = true; endRally(1 - team, 'lift', { loser: team, text: 'Lift: the ball was caught, not hit' }); return; }
    emit('touch', { team, pid: p.id, kind: 'receive', n, q, tm: tmv.tm, tmE: tmv.e, tech: pl.tech, auto: tmv.auto, c: { x: r2(b.x), y: r2(b.y), z: r2(b.z) }, vin: r2(vin), dig: !!(s.ball.meta && s.ball.meta.kind === 'attack') });
    if (cfg.drill) drillHook('touch', { n, q, kind: 'receive', team });
    const aim = aimOf(pl);
    // a strong upward flick sends the first ball over the net (a free ball) when the pass is hopeless
    const overpass = !!(p.user && aim && aim.fwd > 0.8 && Math.abs(aim.lat) < 0.9);
    if (q < 0.42 && rR.next() < 0.85 * ((0.42 - q) / 0.42)) { setActResult(pl, act, q, tmv, null); wild(team, p, b, 'receive'); return; }
    if (overpass || R.forceOver) { return sendOver(pl, p, b, q, tmv, 'free'); }
    const spot0 = W(team, -1.3, 1.3);
    let tx = spot0.x, tz = spot0.z;
    if (aim && p.user) { tx += aim.lat * 1.4 * latSign(team); tz += dirOf(team) * aim.fwd * 0.8; }
    const sg = 0.10 + 1.45 * Math.pow(1 - q, 1.7);
    const e = scatter(sg);
    const bias = Math.max(0, 0.55 - q) * 1.6;
    const to = { x: tx + e.x, y: 1.1, z: tz + e.z - dirOf(team) * bias };
    if (depthOf(team, to.z) < 0.5) to.z = W(team, 0, 0.5).z;
    const T = 1.45 + 0.35 * (1 - q) * rR.next();
    const fl = flightTo(tc, b, to, T);
    setActResult(pl, act, q, tmv, to);
    launch(fl, { kind: 'pass', team, q, to });
  }
  function sendOver(pl, p, b, q, tmv, kind) {
    const team = pl.team, opp = 1 - team, act = pl.act;
    const aim = aimOf(pl);
    let tgt;
    if (p.user && aim) tgt = { x: clamp(aim.lat * 3.5 * latSign(team), -HW + 0.6, HW - 0.6), z: -dirOf(opp) * clamp(5.5 + aim.fwd * 2.2, 3, HL - 0.8) };
    else {
      // aim at the open court: far from their nearest defender
      let best = null;
      for (const lat of [-3.6, -2, 0, 2, 3.6]) for (const dp of [3.6, 5.5, 7.4]) {
        const t2 = W(opp, lat, dp);
        let d = 9; for (const q2 of onCourt(opp)) d = Math.min(d, Math.hypot(q2.x - t2.x, q2.z - t2.z));
        const sc = d + rA.next() * (1.2 - s.teams[team].iq);
        if (!best || sc > best.sc) best = { sc, t2 };
      }
      tgt = best.t2;
    }
    const e = scatter(0.18 + 1.5 * Math.pow(1 - q, 1.8));
    const to = { x: tgt.x + e.x, y: BR, z: tgt.z + e.z };
    const sol = solveClear(b, to, 1.1, NETH, 0.5 + normal(rR) * 0.12 * (1.2 - q), 2.6);
    const fl = flightTo(s.t, b, to, sol.T);
    setActResult(pl, act, q, tmv, to);
    launch(fl, { kind: 'free', team, q, to, aimLat: latOf(team, tgt.x) });
  }
  function doSet(pl, p, b, vin, stretch, tc, n) {
    const R = s.rally, team = pl.team, act = pl.act;
    const tmv = timingOf(p, pl, 'set');
    const inQ = (pl.meta && pl.meta.q) ?? 0.6;
    let q = setQuality(p.st, tmv.tm, stretch, inQ, normal(rA));
    if (cfg.drill && team === 0 && !p.user && cfg.drill.kind !== 'serve') q = Math.max(q, 0.9);
    if (tmv.tm < 0.3 && !tmv.auto && !cfg.drill && rR.next() < 0.22 * (0.3 - tmv.tm) / 0.3) { emit('fault', { team, reason: 'double contact' }); endRally(1 - team, 'double contact', { loser: team, text: 'Double contact on the set' }); return; }
    emit('touch', { team, pid: p.id, kind: 'set', n, q, tm: tmv.tm, tmE: tmv.e, tech: pl.tech, auto: tmv.auto, c: { x: r2(b.x), y: r2(b.y), z: r2(b.z) } });
    if (cfg.drill) drillHook('touch', { n, q, kind: 'set', team });
    // choose: the human's flick / button, else the AI decision made earlier
    let choice = pl.choice;
    if (p.user && !cfg.bot) {
      choice = humanSetChoice(pl, p);
      pl.choice = choice;
      if (choice.target !== 'dump' && choice.target !== 'over') applySetChoice(pl, choice);
    }
    if (!choice) { const d = AI.chooseSet(s, team, p, inQ, rA, { tcSet: pl.tc }); choice = d.choice; pl.choice = choice; pl.decision = d; if (choice.target !== 'dump' && choice.target !== 'over') applySetChoice(pl, choice); }
    if (q < 0.12 && rR.next() < 0.9 * (0.12 - q) / 0.12) { setActResult(pl, act, q, tmv, null); wild(team, p, b, 'set'); return; }
    if (choice.target === 'over') { return sendOver(pl, p, b, q, tmv, 'free'); }
    if (choice.target === 'dump') {
      setActResult(pl, act, q, tmv, null);
      const opp = 1 - team, aim = aimOf(pl);
      let tgt;
      if (p.user && aim) tgt = { x: clamp(-aim.lat * 0 + aim.lat * 3.0 * latSign(team), -HW + 0.6, HW - 0.6), z: -dirOf(opp) * clamp(3.2 + aim.fwd * 1.6, 1.8, 5.5) };
      else { let best = null; for (const lat of [-3.2, -1.6, 0, 1.6, 3.2]) for (const dp of [2.2, 3.6]) { const t2 = W(opp, lat, dp); let d = 9; for (const q2 of onCourt(opp)) if (!q2.front || !q2.blocking) d = Math.min(d, Math.hypot(q2.x - t2.x, q2.z - t2.z)); if (!best || d > best.d) best = { d, t2 }; } tgt = best.t2; }
      const e = scatter(0.3 + 1.2 * Math.pow(1 - q, 1.8));
      const to = { x: tgt.x + e.x, y: BR, z: tgt.z + e.z };
      const sol = solveClear(b, to, 0.6, NETH, 0.22 + normal(rR) * 0.1 * (1.2 - q), 2.0);
      const fl = flightTo(tc, b, to, sol.T);
      if (act) act.to = { x: to.x, z: to.z };
      launch(fl, { kind: 'free', team, q, to, dump: true, aimLat: latOf(team, tgt.x) });
      return;
    }
    const S = SETS[choice.target];
    const e = scatter(0.07 + 1.25 * Math.pow(1 - q, 1.7));
    const attId = choice.attackerId, att = P(attId);
    const yA = (HIT0 * K + 0.55 * clamp(att.st.jump, 0.2, 0.85)) + normal(rR) * 0.1 * (1.2 - q);
    const spot = W(team, S.lat, S.depth);
    let to = { x: spot.x + e.x, y: yA, z: spot.z + e.z * 0.8 };
    if (cfg.drill && cfg.drill.kind === 'spike' && team === 0 && !p.user) to = { x: spot.x, y: HIT0 * K + 0.72 * att.st.jump, z: spot.z };      // practice: a perfect set
    if (depthOf(team, to.z) < 0.56) to.z = W(team, 0, 0.56).z;
    // the set arrives T seconds later; its landing height is the hitting height
    const fl = flightTo(tc, b, to, S.T);
    setActResult(pl, act, q, tmv, to);
    s.rally.setInfo = { team, target: choice.target, attackerId: attId, to, q, tc, tA: tc + S.T };
    launch(fl, { kind: 'set', team, q, to, attackerId: attId, target: choice.target });
  }
  function humanSetChoice(pl, p) {
    const team = pl.team, aim = aimOf(pl);
    const lanes = AI.assignLanes(s, team);
    let target = null;
    const pk = s.pick.set;
    if (pk !== 'auto') target = pk;
    if (aim && (Math.hypot(aim.lat, aim.fwd) > 0.35)) {
      if (aim.fwd > 0.7 && Math.abs(aim.lat) < 0.6 && p.front) target = 'dump';
      else if (aim.fwd < -0.55 && Math.abs(aim.lat) < 0.7) target = 'pipe';
      else if (Math.abs(aim.lat) < 0.45 && aim.fwd >= 0) target = 'middle';
      else target = aim.lat > 0 ? 'outside' : 'right';
    }
    if (!target) { const d = AI.chooseSet(s, team, p, (pl.meta && pl.meta.q) ?? 0.6, rA, { iq: 0.7, tcSet: pl.tc }); return d.choice; }
    if (target === 'dump') return { target, attackerId: p.id };
    // find the player for the lane
    const want = target === 'outside' ? 'L' : target === 'middle' ? 'M' : target === 'right' ? 'R' : 'B';
    let att = null;
    for (const q of onCourt(team)) { if (q.id === p.id || q.tp === 6) continue; if (want === 'B' ? !q.front : lanes[q.id] === want) att = q; }
    if (!att) att = onCourt(team).find((q) => q.id !== p.id && q.front && q.tp !== 6) || onCourt(team).find((q) => q.id !== p.id && q.tp !== 6);
    if (!att) { const d = AI.chooseSet(s, team, p, 0.6, rA); return d.choice; }
    return { target: want === 'B' ? 'pipe' : target, attackerId: att.id };
  }
  function doFree(pl, p, b, vin, stretch, tc, n) {
    const tmv = timingOf(p, pl, 'free');
    const q = passQuality(p.st, tmv.tm, stretch, vin, normal(rA)) * 0.95 + 0.05;
    emit('touch', { team: pl.team, pid: p.id, kind: 'free', n, q, tm: tmv.tm, tmE: tmv.e, tech: pl.tech, auto: tmv.auto, c: { x: r2(b.x), y: r2(b.y), z: r2(b.z) } });
    if (cfg.drill) drillHook('touch', { n, q, kind: 'free', team: pl.team });
    if (q < 0.1 && rR.next() < 0.7) { wild(pl.team, p, b, 'free'); return; }
    sendOver(pl, p, b, q, tmv, 'free');
  }

  // ---------------------------------------------------------------- attack and block
  function doAttack(pl, p, b, vin, stretch, tc) {
    const R = s.rally, team = pl.team, opp = 1 - team, act = pl.act;
    s.prompt = null;
    const setQ = (pl.meta && pl.meta.q) ?? 0.6;
    const tmv = timingOf(p, pl, 'attack');
    // contact height versus the hitter's best height
    const q = attackQuality(p.st, tmv.tm, stretch, setQ, normal(rA));
    const blockers = (R.blk && R.blk.list ? R.blk.list : []).map((bl) => ({ id: bl.pid, x: bl.x, w: bl.w ?? 1 }));
    const aim = aimOf(pl);
    let shot, target, why = null;
    if (p.user && !cfg.bot) {
      const pk = s.pick.shot;
      shot = pk === 'auto' ? null : pk;
      const d = AI.chooseAttack(s, team, p, b, blockers, rA, { iq: 0.7, stretch });
      shot = shot || d.choice.shot;
      if (aim && Math.hypot(aim.lat, aim.fwd) > 0.3) target = { x: clamp(aim.lat * 4.0 * latSign(team), -HW + 0.45, HW - 0.45), z: -dirOf(opp) * clamp(5.0 + aim.fwd * 3.6, 1.5, HL - 0.5) };
      else target = d.choice.aim;
      if (shot === 'tip' && !(aim && Math.hypot(aim.lat, aim.fwd) > 0.3)) target = { x: d.choice.aim.x * 0.6, z: -dirOf(opp) * 2.6 };
    } else {
      const d = AI.chooseAttack(s, team, p, b, blockers, rA, { stretch });
      shot = d.choice.shot; target = d.choice.aim; why = d.reason;
      if (cfg.watch) s.hold = { id: ++s.actSeq, team, kind: 'attack', decision: d, pid: p.id, at: { x: target.x, z: target.z } };
    }
    const SH = SHOTS[shot];
    // the swing: power and accuracy
    const errP = clamp(0.20 - 0.26 * q * 0.8 + (shot === 'power' ? 0.07 : shot === 'tip' ? -0.05 : 0) + 0.20 * Math.max(0, stretch), 0.015, 0.7) * (1 - 0.2 * tmv.tm);
    let tgt = { x: target.x, z: target.z };
    const sc = (0.25 + 1.3 * Math.pow(1 - q, 1.8)) * (1.25 - 0.35 * SH.acc) * 0.95;
    tgt = { x: tgt.x + normal(rR) * sc * 0.85, y: BR, z: tgt.z + normal(rR) * sc };
    let errKind = null;
    if (rR.next() < errP) {
      if (rR.next() < 0.5 && shot !== 'tip') errKind = 'net'; else { errKind = 'out'; const side = rR.next() < 0.5; if (side) tgt.x = (tgt.x >= 0 ? 1 : -1) * (HW + 0.4 + rR.next() * 1.4); else tgt.z = -dirOf(opp) * (HL + 0.4 + rR.next() * 1.6); }
    }
    const dist = Math.hypot(tgt.x - b.x, tgt.z - b.z, b.y);
    const spd = SH.speed * (0.80 + 0.20 * p.st.pow) * (0.88 + 0.12 * q);
    const T0 = Math.max(0.28, dist / spd);
    let T, fl;
    if (errKind === 'net') {
      // a ball driven into the tape
      T = T0; fl = flightTo(tc, b, { x: tgt.x, y: BR, z: tgt.z }, T);
      for (let g = 0; g < 40 && clearanceOf(b, { x: tgt.x, y: BR, z: tgt.z }, T, NETH) > -0.15; g++) { T *= 0.97; }
      fl = flightTo(tc, b, { x: tgt.x, y: BR, z: tgt.z }, T);
    } else {
      const margin = 0.12 + 0.14 * (1 - q) + normal(rR) * 0.05;
      const sol = solveClear(b, { x: tgt.x, y: BR, z: tgt.z }, T0, NETH, Math.max(0.03, margin), 2.4);
      T = sol.T; fl = flightTo(tc, b, { x: tgt.x, y: BR, z: tgt.z }, T);
    }
    if (act) { act.shot = shot; act.to = { x: r2(tgt.x), z: r2(tgt.z) }; act.faceTo = { x: tgt.x, z: tgt.z }; act.q = q; act.pending = false; act.tm = r2(tmv.tm); act.tmE = r2(tmv.e); act.stretch = stretch; act.c = { x: r2(b.x), y: r2(b.y), z: r2(b.z) }; }
    emit('touch', { team, pid: p.id, kind: 'attack', n: R.touches[team], q, tm: tmv.tm, tmE: tmv.e, shot, auto: tmv.auto, c: { x: r2(b.x), y: r2(b.y), z: r2(b.z) }, aim: { x: r2(target.x), z: r2(target.z) }, speed: r2(speedAt(fl, tc)) });
    if (cfg.drill) drillHook('attack', { team, q, tm: tmv.tm });
    // net touch on a late swing taken right at the net
    const nd = depthOf(team, p.z);
    if (nd < 0.62 && rR.next() < 0.45 * (1.3 - tmv.tm) * (0.62 - nd) / 0.3) { if (act) act.netTouch = true; emit('fault', { team, reason: 'net touch' }); endRally(opp, 'net touch', { loser: team, text: 'Net touch by the hitter' }); return; }
    // resolve the block
    const bh = resolveBlock(opp, team, fl, tc, shot, q);
    if (bh && bh.fault) return;
    launch(fl, { kind: 'attack', team, q, shot, power: speedAt(fl, tc), to: tgt, blockHit: bh, errKind, aimLat: latOf(team, tgt.x) });
    void why;
  }
  // The defending team's block, planned when the set is launched (the hitter's contact time is then known).
  function planBlock(defTeam, atkTeam, setFl, tA, hitX) {
    const R = s.rally;
    // user-controlled front-row defenders get a ring; the rest are AI
    const bd = AI.chooseBlock(s, defTeam, atkTeam, hitX, rA);
    R.blk = { team: defTeam, list: [], read: bd.read, xe: bd.xe, tA, user: null };
    const dir = dirOf(defTeam);
    const tnEst = tA + 0.09;
    const list = bd.list.filter((e) => !(e.p.user && !cfg.bot));
    const userBlocker = userP() && userP().team === defTeam && userP().front && !cfg.bot ? userP() : null;
    const taken = new Set(list.map((e) => e.p.id));
    if (userBlocker && !taken.has(userBlocker.id)) {
      // the user may block: prepare the ring (opens before the hit); the body is theirs to move
      const h = clamp(userBlocker.st.jump * 0.95, 0.2, 0.7), tup = Math.sqrt(2 * h / G);
      s.prompt = { kind: 'block', pid: userBlocker.id, label: 'BLOCK', open: Math.max(s.t, tnEst - tup - LAG.block * 0 - OPEN), close: tnEst - tup, tc: tnEst, hitX, pressed: null, press: null, win: WIN.block, h, tup };
      R.blk.user = userBlocker.id;
    }
    for (const e of list) {
      const p = e.p;
      const h = clamp(p.st.jump * 0.95, 0.2, 0.7), tup = Math.sqrt(2 * h / G);
      const sg = 0.04 + 0.13 * (1 - p.st.blk) + (R.setInfo && R.setInfo.target === 'middle' ? 0.03 : 0);
      const ta = tnEst + normal(rA) * sg;
      const air = { ts: ta - tup, ta, te: ta + tup, h };
      const bx = clamp(e.x, -HW + 0.3, HW - 0.3), bz = dir > 0 ? -0.38 : 0.38;   // the blocker's own side of the net
      p.act = null;
      const tArr = Math.max(s.t + 0.12, air.ts - 0.08);
      const dx = bx - p.x, dz = bz - p.z, dd = Math.hypot(dx, dz), reach = p.st.spd * 1.15 * Math.max(0.05, tArr - s.t - p.st.react);
      const fin = dd > reach ? { x: p.x + dx / dd * reach, z: p.z + dz / dd * reach } : { x: bx, z: bz };
      if (dd > reach + 0.1) { goto(p, { x: bx, z: bz }, p.st.react); continue; }      // cannot get there in time: no jump
      setPath(p, fin.x, fin.z, s.t + p.st.react, tArr);
      p.lockFrom = tArr; p.hold = air.te + 0.3; p.blocking = true;
      const act = makeAct(p, 'block', 'block', ta, { x: fin.x, y: (BLOCK0 * K - 0.15) + h, z: 0 }, { air, lead: tup + 0.3, follow: tup + 0.5, faceTo: { x: fin.x, z: -dir * 3 }, approach: 0.5 });
      act.block = true;
      R.blk.list.push({ pid: p.id, x: fin.x, z: fin.z, air, h, w: p.tp === 6 ? 0 : 1, ta, act });
    }
    // back row to the dig spots of the expected attack; remaining front-row players off the net
    const sp = AI.homeSpots(s, defTeam, 'defense', { lat: latOf(defTeam, hitX) });
    for (const p of onCourt(defTeam)) {
      if (p.front && R.blk.list.some((b) => b.pid === p.id)) continue;
      if (p.user || !sp[p.id] || p.path) continue;
      const w = sp[p.id];
      if (p.front) goto(p, { x: w.x, z: -dir * clamp(depthOf(defTeam, w.z), 2.4, 4) * -1 * -1 }, 0.05 + p.st.react);
      else goto(p, w, 0.05 + p.st.react);
    }
  }
  function resolveBlock(opp, atk, fl, tcA, shot, q) {
    const R = s.rally, B = R.blk;
    // the block plan is cleared at the next set / possession
    if (!B || B.team !== opp) return null;
    const tl = landTime(fl) ?? tcA + 1;
    const tn = netTime(fl, tl);
    if (tn === null) return null;
    const pn = posAt(fl, tn);
    if (pn.y < NETH - 0.05 || Math.abs(pn.x) > HW + 0.1) return null;
    const power = speedAt(fl, tn);
    const cands = [];
    for (const bl of B.list) {
      const bp = P(bl.pid), a = bl.air;
      const jy = tn >= a.ts && tn <= a.te ? a.h * (1 - Math.pow((tn - a.ta) / (a.ta - a.ts), 2)) : 0;
      const top = BLOCK0 * K + jy;
      const hw = 0.30;
      if (Math.abs(pn.x - bl.x) <= hw + BR_PLAY * 0.3 && pn.y <= top - (women ? 0.27 : 0.20)) cands.push({ bl, bp, jy, top, edge: Math.abs(pn.x - bl.x) / hw, margin: top - pn.y });
    }
    // a human blocker who pressed
    const u = userP();
    if (u && B.user === u.id && u.act && u.act.kind === 'block' && u.act.air) {
      const a = u.act.air, dp = depthOf(u.team, u.z);
      const jy = tn >= a.ts && tn <= a.te ? a.h * (1 - Math.pow((tn - a.ta) / (a.ta - a.ts), 2)) : 0;
      const top = BLOCK0 * K + jy, hw = 0.30;
      const shift = (u.act.press && u.act.press.aim ? u.act.press.aim.lat : 0) * 0.30 * latSign(u.team) * 0;
      if (dp <= 1.4 && Math.abs(pn.x - u.x) <= hw + BR_PLAY * 0.3 && pn.y <= top - (women ? 0.27 : 0.20)) cands.push({ bl: { pid: u.id, x: u.x, air: a, h: a.h, ta: a.ta, act: u.act, user: true }, bp: u, jy, top, edge: Math.abs(pn.x - u.x) / hw, margin: top - pn.y });
    }
    if (!cands.length) {
      // missed: the blockers' hands go to where the ball is not
      for (const bl of B.list) if (bl.act) { bl.act.miss = true; }
      return null;
    }
    cands.sort((a, b) => a.edge - b.edge);
    const c = cands[0];
    const nBlock = cands.length;
    { const tErr = Math.abs((c.bl.ta ?? tn) - tn), dpt = depthOf(c.bp.team, c.bp.z);
      if (tErr > 0.17 && dpt < 0.5 && rR.next() < 0.5) { const act0 = c.bl.act; if (act0) act0.netTouch = true; emit('fault', { team: c.bp.team, reason: 'net touch' }); endRally(1 - c.bp.team, 'net touch', { loser: c.bp.team, text: 'Net touch by the blocker' }); return { t: -1, fault: true }; } }
    const blkSkill = c.bp.st.blk;
    const timing = clamp(1 - Math.abs(c.bl.ta - tn) / 0.2, 0.2, 1);
    const pStuff = clamp(0.16 + 0.55 * blkSkill * timing + 0.24 * clamp(c.margin / 0.3, 0, 1) - 0.32 * c.edge - 0.30 * clamp((power - 12) / 18, 0, 1) + 0.09 * (nBlock - 1) + (shot === 'tip' ? -0.15 : 0) + (c.bl.user ? 0.0 : 0), 0.04, 0.85);
    const r = rR.next();
    const kind = r < pStuff ? 'stuff' : r < pStuff + (1 - pStuff) * (c.edge > 0.7 ? 0.14 : 0.03) ? 'out' : 'soft';
    const tb = tn + 0.01;
    const pb = posAt(fl, tb);
    const act = c.bl.act;
    if (act) { act.c = { x: r2(pb.x), y: r2(pb.y), z: r2(pb.z) }; act.tc = tb; act.hit = true; act.miss = false; act.kind2 = kind; { const vv = velAt(fl, tb), vl = Math.hypot(vv.x, vv.y, vv.z) || 1; act.vin = { x: r2(vv.x / vl), y: r2(vv.y / vl), z: r2(vv.z / vl) }; act.vspd = r2(vl); } }
    for (const bl of B.list) if (bl !== c.bl && bl.act && !cands.some((cc) => cc.bl === bl)) bl.act.miss = true;
    return { t: tb, pid: c.bp.id, kind, c: { x: pb.x, y: pb.y, z: pb.z }, power };
  }
  function doBlockTouch(ev) {
    const R = s.rally; if (R.dead) return;
    const bp = P(ev.pid), opp = bp.team, atk = 1 - opp;
    const fl = s.ball.flight; if (!fl) return;
    const b = posAt(fl, ev.t);
    R.last = { team: opp, pid: bp.id }; R.lastBlock = true; R.touches[opp] = 0; R.touches[atk] = 0;
    emit('block', { team: opp, pid: bp.id, kind: ev.kind, c: { x: r2(b.x), y: r2(b.y), z: r2(b.z) } });
    if (cfg.drill) drillHook('block', { team: opp, kind: ev.kind });
    if (ev.kind === 'stuff') {
      const tz = -dirOf(atk) * rR.range(0.8, 3.4) * -1 * -1;
      const to = { x: clamp(b.x + rR.range(-1.6, 1.6), -HW + 0.2, HW - 0.2), y: BR, z: -dirOf(opp) * -rR.range(0.9, 3.2) * -1 };
      to.z = (atk === 0 ? -1 : 1) * rR.range(0.9, 3.4);
      void tz;
      launch(flightTo(s.t, b, to, rR.range(0.34, 0.5)), { kind: 'blockKill', team: opp, q: 0.5, to });
      if (bp.act) bp.act.to = { x: to.x, z: to.z };
    } else if (ev.kind === 'out') {
      const sx = b.x >= 0 ? 1 : -1;
      const to = { x: sx * (HW + rR.range(0.6, 2.4)), y: BR, z: (atk === 0 ? -1 : 1) * rR.range(1, 5) };
      launch(flightTo(s.t, b, to, rR.range(0.4, 0.7)), { kind: 'blockOut', team: opp, q: 0.3, to });
    } else {
      const toSide = rR.next() < 0.75 ? opp : atk;
      const to = { x: clamp(b.x + rR.range(-2, 2), -HW + 0.3, HW - 0.3), y: BR, z: (toSide === 0 ? -1 : 1) * rR.range(1.4, 4.4) };
      launch(flightTo(s.t, b, to, rR.range(0.9, 1.3)), { kind: 'blockSoft', team: opp, q: 0.4, to });
      if (bp.act) bp.act.to = { x: to.x, z: to.z };
    }
  }

  // ---------------------------------------------------------------- net, landing, faults
  function netEvent(ev) {
    const R = s.rally, fl = s.ball.flight; if (!fl) return;
    const last = R.last ? R.last.team : R.server;
    const pn = posAt(fl, ev.t);
    const side0 = fl.z < 0 ? 0 : 1;
    if (ev.type === 'cross') { emit('cross', { x: r2(pn.x), y: r2(pn.y) }); return; }
    if (ev.type === 'wide') { emit('wide', { x: pn.x }); startBounce(pn, velAt(fl, ev.t)); endRally(1 - last, 'out', { loser: last, text: 'Out: the ball crossed outside the antenna' }); return; }
    if (ev.type === 'cord') {
      if (R.isServe || true) {
        // the tape clips the ball: it loses pace and dribbles over
        const over = rR.next() < 0.6;
        const dir = side0 === 0 ? 1 : -1;
        const to = { x: clamp(pn.x + rR.range(-0.6, 0.6), -HW + 0.1, HW - 0.1), y: BR, z: (over ? dir : -dir) * rR.range(0.6, 1.8) };
        emit('cord', { over });
        launch(flightTo(s.t, { x: pn.x, y: pn.y + 0.04, z: (over ? dir : -dir) * 0.06 }, to, rR.range(0.4, 0.65)), { kind: over ? 'cordOver' : 'cord', team: last, q: 0.4, to });
        return;
      }
    }
    if (ev.type === 'netHit') {
      emit('netHit', { x: pn.x, y: pn.y });
      const text = R.isServe ? 'Service error: into the net' : 'Net: the ball hit the net';
      const to = { x: pn.x * 0.9, y: BR, z: (side0 === 0 ? -1 : 1) * 0.5 };
      const nt = R.touches[side0] ?? 0;
      const mk = s.ball.meta && s.ball.meta.kind;
      if (R.isServe || mk === 'attack' || nt >= 3) { startBounce({ x: pn.x, y: pn.y, z: pn.z - (side0 === 0 ? 0.05 : -0.05) }, { x: 0, y: -1, z: side0 === 0 ? -0.6 : 0.6 }); endRally(1 - last, R.isServe ? 'serve error' : 'net', { loser: last, text }); return; }
      // a ball that rolls off the tape can still be played by its own team
      launch(flightTo(s.t, { x: pn.x, y: pn.y, z: pn.z - (side0 === 0 ? 0.05 : -0.05) }, to, 0.4), { kind: 'netDrop', team: last, q: 0.3 });
    }
  }
  function doLand(ev) {
    const R = s.rally, fl = s.ball.flight; if (R.dead) return;
    const x = ev.x, z = ev.z, side = z < 0 ? 0 : 1;
    const last = R.last ? R.last.team : R.server;
    const inb = Math.abs(x) <= HW + 0.06 && Math.abs(z) <= HL + 0.06;
    if (fl) startBounce({ x, y: BR, z }, velAt(fl, ev.t));
    emit('land', { x: r2(x), z: r2(z), in: inb, side });
    const mk = s.ball.meta ? s.ball.meta.kind : null;
    if (R.isServe && side === R.server && inb) { endRally(1 - R.server, 'serve error', { loser: R.server, text: 'Service error: the ball did not cross' }); return; }
    if (inb) {
      const loser = side, w = 1 - loser;
      let reason = 'floor', txt = 'Ball down';
      if (mk === 'serve') { reason = 'ace'; txt = 'Ace'; }
      else if (mk === 'attack' && last === w) { reason = 'kill'; txt = 'Kill'; }
      else if (mk === 'blockKill') { reason = 'block'; txt = 'Block: point'; }
      else if (last === loser && mk !== 'attack') { reason = 'floor'; txt = 'The ball fell on its own side'; }
      endRally(w, reason, { loser, text: txt });
    } else {
      const lastKindAtk = mk === 'attack';
      const mkText = mk === 'serve' ? 'Service error: out' : lastKindAtk ? 'Hitting error: out' : 'Out';
      endRally(1 - last, mk === 'serve' ? 'serve error' : lastKindAtk ? 'hit error' : 'out', { loser: last, text: mkText });
    }
  }

  // ---------------------------------------------------------------- the event loop
  function runEvent(ev) {
    switch (ev.type) {
      case 'toss': doToss(); break;
      case 'tossRelease': tossRelease(ev); break;
      case 'serveTouch': doServeTouch(ev); break;
      case 'touch': doTouch(ev); break;
      case 'decideSet': decideSet(ev); break;
      case 'blockTouch': doBlockTouch(ev); break;
      case 'cross': case 'cord': case 'netHit': case 'wide': netEvent(ev); break;
      case 'land': doLand(ev); break;
      case 'drillEnd': if (!s.rally.dead) { emit('drillEnd', {}); endRally(0, 'drill', { text: 'Drill rally over' }); } break;
      case 'nextRally': startRally(false); break;
      case 'nextSet': { const m = s.match; m.setNo++; m.pts = [0, 0]; m.target = setTarget(mode, m.setNo); m.firstServer = MODES[mode].sets > 1 && m.setNo === MODES[mode].sets ? (rR.next() < 0.5 ? 0 : 1) : 1 - m.firstServer; m.serving = m.firstServer; for (const t of [0, 1]) { s.teams[t].rot = START_ROT.slice(); s.teams[t].rotN = 0; refreshLineup(t); } announce(`Set ${m.setNo}`, 'set'); startRally(false); break; }
      case 'matchEnd': s.phase = 'matchEnd'; emit('matchEnd', { winner: s.match.winner }); break;
      default: break;
    }
  }
  function update(dt) {
    if (s.hold || s.phase === 'matchEnd') return;
    const tTick = s.t + dt;
    let guard = 0;
    while (s.queue.length && s.queue[0].t <= tTick + 1e-9 && guard++ < 60) {
      const ev = s.queue.shift();
      if (ev.fid !== undefined && ev.fid !== s.fid && !ev.always) continue;
      s.t = Math.max(s.t, ev.t);
      runEvent(ev);
      if (s.hold) break;
    }
    s.t = tTick;
    // phase flags
    if (s.phase === 'serve' && s.ball.flight && s.ball.meta && s.ball.meta.kind === 'serve') s.phase = 'rally';
    else if (s.phase === 'serve' && s.ball.meta && s.ball.meta.kind !== 'toss' && s.ball.vis) s.phase = 'rally';
    assistStep();
    movePlayers(dt);
    separate();
    faceUpdate();
    const bl = s.ball;
    if (bl.flight) { const p = posAt(bl.flight, s.t); bl.x = p.x; bl.y = p.y; bl.z = p.z; const v = velAt(bl.flight, s.t); bl.vx = v.x; bl.vy = v.y; bl.vz = v.z; }
    else if (bl.free) { freeBall(dt); bl.x = bl.free.x; bl.y = bl.free.y; bl.z = bl.free.z; bl.vx = bl.free.vx; bl.vy = bl.free.vy; bl.vz = bl.free.vz; }
  }

  // ---------------------------------------------------------------- the human's controls
  // Movement help: when the controlled player is the one who must play the ball and the stick is idle, the sim steps to the contact spot;
  // in the last moments the stance snaps to the exact spot if the player is close enough.
  function assistStep() {
    const u = userP(); if (!u || !s.prompt || cfg.bot) return;
    const pr = s.prompt;
    if (pr.kind === 'block') {
      // movement help: slide to the net in front of the expected hitter while the stick is idle
      if (s.input.assist >= 1 && Math.hypot(s.input.mx, s.input.mz) < 0.12 && s.t < pr.close + 0.1 && !u.path) { u.tx = clamp(pr.hitX, -HW + 0.4, HW - 0.4); u.tz = -0.42; u.go = s.t; }
      return;
    }
    if (pr.kind === 'serveWait' || !pr.stand || pr.snapped) return;
    const idle = Math.hypot(s.input.mx, s.input.mz) < 0.12;
    const lvl = s.input.assist;
    const d = Math.hypot(u.x - pr.stand.x, u.z - pr.stand.z);
    const tLeft = pr.tc - s.t;
    if (lvl >= 2 && idle && tLeft > 0.2 && !u.path) { u.tx = pr.stand.x; u.tz = pr.stand.z; u.go = s.t; }
    const snapT = pr.kind === 'attack' ? (pr.plan.air ? pr.plan.air.ts - 0.5 : tLeft) : 0.42;
    if (lvl >= 1 && !u.path && ((pr.kind === 'attack' && pr.plan.air && s.t >= pr.plan.air.ts - 0.62) || (pr.kind !== 'attack' && tLeft <= 0.42)) && d < (pr.kind === 'attack' ? 2.2 : 1.1) && d > 0.02) {
      const tEnd = pr.kind === 'attack' ? pr.plan.air.ts - 0.04 : pr.tc - 0.10;
      if (tEnd > s.t + 0.05) { setPath(u, pr.stand.x, pr.stand.z, s.t, tEnd); pr.snapped = true; u.lockFrom = tEnd; }
    }
    void snapT;
  }
  function setMove(mx, mz) { s.input.mx = clamp(mx, -1, 1); s.input.mz = clamp(mz, -1, 1); }
  function choose(patch) { Object.assign(s.pick, patch); }
  // The human acts: the same call for a tap and for a flick. aim = { lat, fwd } in team-relative units (-1..1): lat > 0 = towards the team's left.
  function press(aim) {
    const pr = s.prompt, u = userP();
    if (!pr || !u) return false;
    if (pr.kind === 'serveWait') { s.queue = s.queue.filter((e) => e.type !== 'toss'); doToss(); return true; }
    if (s.t < pr.open - 0.0 || pr.pressed !== null) return false;
    if (pr.kind === 'block') {
      pr.pressed = s.t; pr.press = { t: s.t, aim };
      const h = pr.h, tup = pr.tup, dir = dirOf(u.team);
      const air = { ts: s.t, ta: s.t + tup, te: s.t + 2 * tup, h };
      const act = makeAct(u, 'block', 'block', s.t + tup, { x: u.x, y: BLOCK0 * K - 0.15 + h, z: 0 }, { air, lead: 0.0, follow: tup + 0.5, faceTo: { x: u.x, z: -dir * 3 }, approach: 0.3 });
      act.t0 = s.t - 0.25; act.block = true; act.press = { t: s.t, aim }; act.user = true;
      u.lockFrom = s.t; u.hold = air.te + 0.3; u.path = null;
      return true;
    }
    pr.pressed = s.t; pr.press = { t: s.t, aim };
    if (pr.plan) pr.plan.press = pr.press;
    emit('press', { kind: pr.kind, e: s.t - pr.close });
    if (pr.plan && pr.plan.act && aim) { /* the animation keeps its default target until contact */ }
    return true;
  }
  // Think: what a strong coach would do now, with reasons built from the real numbers.
  function suggest() {
    const u = userP(); if (!u) return null;
    const pr = s.prompt;
    const team = 0;
    if (pr && pr.kind === 'serveWait' || (pr && pr.kind === 'serve')) { const d = AI.chooseServe(s, u, { next: () => 0.9 }, { iq: 1 }); return { kind: 'serve', title: 'Serve', ...d }; }
    if (pr && pr.kind === 'set') { const inQ = (pr.plan.meta && pr.plan.meta.q) ?? 0.6; const d = AI.chooseSet(s, team, u, inQ, { next: () => 0.5 }, { iq: 1 }); return { kind: 'set', title: 'Set', ...d }; }
    if (pr && pr.kind === 'attack') { const R = s.rally; const blockers = (R.blk && R.blk.list ? R.blk.list : []).map((b) => ({ id: b.pid, x: b.x, w: 1 })); const d = AI.chooseAttack(s, team, u, pr.c, blockers, { next: () => 0.5 }, { iq: 1 }); return { kind: 'attack', title: 'Attack', ...d }; }
    return null;
  }

  // ---------------------------------------------------------------- practice drills (Learn)
  function drillStart() { /* configured through cfg.drill = { kind, server } */ }
  function drillHook(kind, d) {
    const dr = s.cfg.drill; if (!dr) return;
    if (dr.kind === 'receive' && kind === 'touch' && d.team === 0 && d.n === 1) schedule(s.t + 1.0, 'drillEnd', { always: true });
    if (dr.kind === 'set' && kind === 'touch' && d.team === 0 && d.n === 2) schedule(s.t + 1.1, 'drillEnd', { always: true });
    if (dr.kind === 'spike' && kind === 'attack' && d.team === 0) schedule(s.t + 1.6, 'drillEnd', { always: true });
    if (dr.kind === 'serve' && kind === 'serve') schedule(s.t + 2.4, 'drillEnd', { always: true });
    if (dr.kind === 'block' && kind === 'attack' && d.team === 1) schedule(s.t + 1.6, 'drillEnd', { always: true });
  }

  if (cfg.resume) {
    const r = cfg.resume, m = s.match;
    Object.assign(m, { setNo: r.setNo, sets: [...r.sets], pts: [...r.pts], firstServer: r.firstServer, serving: r.serving, rallies: r.rallies, setScores: (r.setScores || []).map((x) => [...x]), target: setTarget(mode, r.setNo) });
    for (const t of [0, 1]) { s.teams[t].rot = r.rot[t].slice(); s.teams[t].rotN = r.rotN ? r.rotN[t] : 0; refreshLineup(t); }
    startRally(true);
  } else startMatch();
  const sim = { s, update, setMove, press, choose, suggest, release: () => { s.hold = null; }, startRally };
  return sim;
}
